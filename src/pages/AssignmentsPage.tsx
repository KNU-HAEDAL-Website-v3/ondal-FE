import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarDays, LayoutGrid, List, Plus } from 'lucide-react'
import { useAssignments } from '@/api/assignments'
import { useCohort, useMyCohorts } from '@/api/cohorts'
import type { AssignmentResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { ddayLabel, formatKst, isOverdue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const VIEW_STORAGE_KEY = 'ondal-assignments-view'
type ViewMode = 'grid' | 'border'

/**
 * 과제 목록 - 2단 구조: 차시 블럭(테두리 섹션) → 문제 목록 (assignment/design.md 결정 8).
 * - 차시 블럭은 sessionNo 그룹 - 빈 차시 없음(과제가 있어야 블럭 생성)
 * - "차시 추가"(운영진) = 다음 차시 번호 프리필 등록 폼, 블럭 안 "+ 과제" = 그 차시 번호 프리필
 * - 보기 토글: 그리드(카드) / 보더(행) - localStorage 저장
 * 분반은 ?cohort= 로 정하고, 없으면 내 첫 분반. 상태 배지 = 서버 판정값 myStatus 그대로.
 */
export default function AssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const myCohortsQuery = useMyCohorts()

  const param = Number(searchParams.get('cohort'))
  const cohortId = Number.isInteger(param) && param > 0 ? param : (myCohortsQuery.data?.[0]?.id ?? NaN)

  const cohortQuery = useCohort(cohortId)
  const assignmentsQuery = useAssignments(cohortId)

  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === 'border' ? 'border' : 'grid',
  )
  const changeView = (next: ViewMode) => {
    setView(next)
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  if (myCohortsQuery.isPending) return <LoadingScreen />
  if (myCohortsQuery.error) {
    return <ApiErrorView error={myCohortsQuery.error} onRetry={() => void myCohortsQuery.refetch()} />
  }

  const myCohorts = myCohortsQuery.data
  if (!Number.isFinite(cohortId)) {
    return <EmptyState title="소속된 분반이 없어요" description="분반에 배정되면 과제가 여기에 표시됩니다." />
  }

  const cohort = cohortQuery.data
  const assignments = assignmentsQuery.data ?? []
  const groups = groupBySession(assignments)
  const canWrite = (cohort?.canManage ?? false) && cohort?.status !== 'ARCHIVED'
  const nextSessionNo = Math.max(0, ...assignments.map((a) => a.sessionNo ?? 0)) + 1

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">과제</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort ? `${cohort.name} - 차시별 문제 목록` : '차시별 문제 목록'}
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
          <div role="group" aria-label="보기 방식" className="flex overflow-hidden rounded-[2px] border">
            <button
              type="button"
              aria-pressed={view === 'grid'}
              aria-label="그리드 보기"
              onClick={() => changeView('grid')}
              className={cn('px-2 py-1.5', view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              aria-pressed={view === 'border'}
              aria-label="보더 보기"
              onClick={() => changeView('border')}
              className={cn('px-2 py-1.5', view === 'border' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              <List className="size-4" />
            </button>
          </div>
          {canWrite && (
            <>
              <Button size="sm" variant="outline" className="rounded-[2px]" asChild>
                <Link to={`/assignments/new?cohort=${cohortId}&session=${nextSessionNo}`}>
                  <Plus data-icon="inline-start" />
                  차시 추가
                </Link>
              </Button>
              <Button size="sm" className="rounded-[2px]" asChild>
                <Link to={`/assignments/new?cohort=${cohortId}`}>
                  <Plus data-icon="inline-start" />
                  과제 등록
                </Link>
              </Button>
            </>
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
          <section key={group.label} className="space-y-3 rounded-lg border bg-card/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{group.label}</h2>
              {canWrite && (
                <Button size="sm" variant="outline" className="rounded-[2px]" asChild>
                  <Link
                    to={`/assignments/new?cohort=${cohortId}${group.sessionNo !== null ? `&session=${group.sessionNo}` : ''}`}
                    aria-label={`${group.label}에 과제 추가`}
                  >
                    <Plus data-icon="inline-start" />
                    과제
                  </Link>
                </Button>
              )}
            </div>
            {view === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((a) => (
                  <AssignmentCard key={a.id} assignment={a} cohortId={cohortId} />
                ))}
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-[2px] border bg-card">
                {group.items.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} cohortId={cohortId} />
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  )
}

/** 서버 정렬이 차시끼리 붙여 주므로(오름차순, null 마지막) 인접 그룹으로만 묶으면 된다 */
function groupBySession(assignments: AssignmentResponse[]) {
  const groups: { label: string; sessionNo: number | null; items: AssignmentResponse[] }[] = []
  for (const a of assignments) {
    const label = a.sessionNo === null ? '기타' : `${a.sessionNo}차시`
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(a)
    else groups.push({ label, sessionNo: a.sessionNo, items: [a] })
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
      <h3 className="mt-3 text-lg font-bold">
        <span className="mr-1.5 font-mono text-primary">#{assignment.problemNo}</span>
        {assignment.title}
      </h3>
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

/** 보더(행) 보기 - 한 줄 요약: 번호·제목·배지 왼쪽, 마감 오른쪽 */
function AssignmentRow({ assignment, cohortId }: { assignment: AssignmentResponse; cohortId: number }) {
  const overdue = isOverdue(assignment.dueAt)
  return (
    <li>
      <Link
        to={`/assignments/${assignment.id}?cohort=${cohortId}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm hover:bg-secondary/50"
      >
        <span className="font-mono font-semibold text-primary">#{assignment.problemNo}</span>
        <span className="font-semibold">{assignment.title}</span>
        <span
          className={cn(
            'rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold',
            overdue ? 'bg-muted text-muted-foreground' : 'bg-[#dcfce7] text-[#16a34a]',
          )}
        >
          {ddayLabel(assignment.dueAt)}
        </span>
        {assignment.myStatus !== null && <SubmissionStatusBadge status={assignment.myStatus} />}
        <span className="ml-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {formatKst(assignment.dueAt)}
        </span>
      </Link>
    </li>
  )
}
