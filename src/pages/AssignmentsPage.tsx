import { Link, useSearchParams } from 'react-router'
import { CalendarDays, Plus } from 'lucide-react'
import { useAssignments } from '@/api/assignments'
import { useCohort, useMyCohorts } from '@/api/cohorts'
import type { AssignmentResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { ddayLabel, formatKst, isOverdue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * 과제 목록 (피그마 28:1317) - 차시별 그룹, 서버 정렬(차시 오름차순 → 등록순) 그대로.
 * 분반은 ?cohort= 로 정하고, 없으면 내 첫 분반(ACTIVE 우선 - 서버 정렬). 여러 분반 소속이면 셀렉터 표시.
 * 카드의 상태 배지 = 서버 판정값 myStatus 그대로 (프론트 재계산 금지).
 */
export default function AssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const myCohortsQuery = useMyCohorts()

  const param = Number(searchParams.get('cohort'))
  const cohortId = Number.isInteger(param) && param > 0 ? param : (myCohortsQuery.data?.[0]?.id ?? NaN)

  const cohortQuery = useCohort(cohortId)
  const assignmentsQuery = useAssignments(cohortId)

  if (myCohortsQuery.isPending) return <LoadingScreen />
  if (myCohortsQuery.error) {
    return <ApiErrorView error={myCohortsQuery.error} onRetry={() => void myCohortsQuery.refetch()} />
  }

  const myCohorts = myCohortsQuery.data
  if (!Number.isFinite(cohortId)) {
    return <EmptyState title="소속된 분반이 없어요" description="분반에 배정되면 과제가 여기에 표시됩니다." />
  }

  const cohort = cohortQuery.data
  const groups = groupBySession(assignmentsQuery.data ?? [])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">과제</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort ? `${cohort.name} - 차시별 과제 목록` : '차시별 과제 목록'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {myCohorts.length > 1 && (
            <select
              value={cohortId}
              onChange={(e) => setSearchParams({ cohort: e.target.value })}
              aria-label="분반 선택"
              className="h-8 rounded-[2px] border bg-card px-2 text-sm"
            >
              {myCohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === 'ARCHIVED' ? ' (보관됨)' : ''}
                </option>
              ))}
            </select>
          )}
          {cohort?.canManage && (
            <Button size="sm" className="rounded-[2px]" asChild>
              <Link to={`/assignments/new?cohort=${cohortId}`}>
                <Plus data-icon="inline-start" />
                과제 등록
              </Link>
            </Button>
          )}
        </div>
      </header>

      {cohort?.status === 'ARCHIVED' && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 과제 열람만 가능합니다.
        </p>
      )}

      {assignmentsQuery.isPending ? (
        <LoadingScreen />
      ) : assignmentsQuery.error ? (
        <ApiErrorView error={assignmentsQuery.error} onRetry={() => void assignmentsQuery.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="등록된 과제가 없어요"
          description={cohort?.canManage ? '첫 과제를 등록해 보세요.' : '과제가 등록되면 여기에 표시됩니다.'}
        />
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-3">
            <h2 className="text-lg font-bold">{group.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((a) => (
                <AssignmentCard key={a.id} assignment={a} cohortId={cohortId} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

/** 서버 정렬이 차시끼리 붙여 주므로(오름차순, null 마지막) 인접 그룹으로만 묶으면 된다 */
function groupBySession(assignments: AssignmentResponse[]) {
  const groups: { label: string; items: AssignmentResponse[] }[] = []
  for (const a of assignments) {
    const label = a.sessionNo === null ? '기타' : `${a.sessionNo}차시`
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(a)
    else groups.push({ label, items: [a] })
  }
  return groups
}

function AssignmentCard({ assignment, cohortId }: { assignment: AssignmentResponse; cohortId: number }) {
  const overdue = isOverdue(assignment.dueAt)
  return (
    <Link
      to={`/assignments/${assignment.id}?cohort=${cohortId}`}
      className={cn(
        'rounded-lg border bg-card p-4 transition-shadow hover:shadow-md',
        !overdue && 'border-l-4 border-l-primary',
      )}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-block rounded-[2px] px-2 py-0.5 text-xs font-semibold',
            overdue ? 'bg-muted text-muted-foreground' : 'bg-[#dcfce7] text-[#16a34a]',
          )}
        >
          {ddayLabel(assignment.dueAt)}
        </span>
        {assignment.myStatus !== null && <SubmissionStatusBadge status={assignment.myStatus} />}
      </span>
      <h3 className="mt-3 text-lg font-bold">{assignment.title}</h3>
      {assignment.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assignment.description}</p>
      )}
      <p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        마감: {formatKst(assignment.dueAt)}
      </p>
    </Link>
  )
}
