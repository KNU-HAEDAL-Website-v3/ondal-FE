import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronRight, Clock, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAssignment, useDeleteAssignment } from '@/api/assignments'
import { useCohort, useMyCohorts } from '@/api/cohorts'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ddayLabel, formatKst, isOverdue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * 과제 상세 (피그마 28:1433) - 설명 + 기간. 분반은 ?cohort= (목록에서 링크로 전달, 없으면 내 첫 분반).
 * 문제 목록·진행률·채점 결과는 P2·P3 요소라 아직 없다 (docs assignment/fe.md 3절).
 * 제출란은 제출 슬라이스에서 이 화면에 추가된다.
 */
export default function AssignmentDetailPage() {
  const { assignmentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const aid = Number(assignmentId)
  const validAid = Number.isInteger(aid) && aid > 0
  const param = Number(searchParams.get('cohort'))
  const myCohortsQuery = useMyCohorts()
  const cohortId = Number.isInteger(param) && param > 0 ? param : (myCohortsQuery.data?.[0]?.id ?? NaN)

  const cohortQuery = useCohort(cohortId)
  const query = useAssignment(cohortId, validAid ? aid : NaN)
  const deleteMutation = useDeleteAssignment(cohortId)

  if (!validAid) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 과제 주소예요.')} />

  if (!Number.isFinite(cohortId)) {
    if (myCohortsQuery.isPending) return <LoadingScreen />
    if (myCohortsQuery.error) {
      return <ApiErrorView error={myCohortsQuery.error} onRetry={() => void myCohortsQuery.refetch()} />
    }
    return <EmptyState title="소속된 분반이 없어요" description="분반에 배정되면 과제를 볼 수 있습니다." />
  }

  if (query.isPending) return <LoadingScreen />
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const assignment = query.data
  const cohort = cohortQuery.data
  const canManage = cohort?.canManage ?? false
  const overdue = isOverdue(assignment.dueAt)

  const handleDelete = () => {
    if (!window.confirm('이 과제를 삭제할까요? 삭제하면 되돌릴 수 없어요.')) return
    deleteMutation.mutate(assignment.id, {
      onSuccess: () => navigate(`/assignments?cohort=${cohortId}`, { replace: true }),
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="현재 위치">
          <Link to={`/assignments?cohort=${cohortId}`} className="hover:text-foreground">
            과제
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{assignment.sessionNo === null ? '기타' : `${assignment.sessionNo}차시`}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-[2px] border bg-card px-3 py-1.5 text-xs font-semibold',
                overdue ? 'text-muted-foreground' : 'text-[#464555]',
              )}
            >
              <Clock className="size-3.5" />
              {overdue ? '마감됨' : ddayLabel(assignment.dueAt)}
            </span>
            {canManage && (
              <>
                <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
                  <Link to={`/assignments/${assignment.id}/edit?cohort=${cohortId}`}>
                    <Pencil data-icon="inline-start" />
                    수정
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-[2px] text-destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 data-icon="inline-start" />
                  삭제
                </Button>
              </>
            )}
          </div>
        </div>
        {deleteMutation.error && (
          <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">과제 설명</h2>
          <p className="mt-3 text-sm leading-6 font-medium whitespace-pre-line">
            {assignment.description ?? '설명이 없습니다.'}
          </p>
        </section>

        <section className="flex flex-col justify-center gap-4 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">등록일</h2>
            <p className="mt-1 font-mono text-sm">{formatKst(assignment.createdAt)}</p>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">마감일</h2>
            <p className="mt-1 font-mono text-sm font-bold text-destructive">{formatKst(assignment.dueAt)}</p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        제출란은 다음 단계(제출 슬라이스)에서 여기에 추가됩니다.
      </section>
    </div>
  )
}
