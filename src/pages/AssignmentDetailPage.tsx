import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Clock, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAssignment, useAssignments, useDeleteAssignment } from '@/api/assignments'
import { useMe } from '@/api/auth'
import { useCohort, useMyCohorts } from '@/api/cohorts'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { isAdminRole } from '@/lib/roles'
import { JudgeSamplesSection } from '@/components/judge/JudgeSamplesSection'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MarkdownView } from '@/components/MarkdownView'
import { MySubmissionList } from '@/components/submissions/MySubmissionList'
import { StatusBoard } from '@/components/submissions/StatusBoard'
import { SubmissionForm } from '@/components/submissions/SubmissionForm'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { ddayLabel, formatKst, isOverdue, remainingLabel } from '@/lib/datetime'

/**
 * 과제 상세 (피그마 28:1433, 원안 "수강자 코드 과제 상세" · "교육운영진 과제 현황") - 설명·기간 + 제출란·내 제출 기록, 운영진에게는 현황판까지.
 * 분반은 ?cohort= (목록에서 링크로 전달, 없으면 내 첫 분반).
 * 자동 채점 문제(judgeEnabled)면 헤더 배지 + 예시 절(#50), 제출 결과는 내 기록·현황판 안에서 (docs judge/fe.md 2·3절).
 * 원안 반영(2026-09-20 전수 조사):
 *   - 학생: 자동 채점 과제는 xl 이상에서 좌 문제·우 편집기 2단 분할(편집기는 스크롤을 따라옴)
 *   - 운영진: 현황판이 설명 바로 아래(원안 "과제 현황"), 본인 제출란·기록은 접힌 "직접 제출해 보기" 안. 헤더의 내 상태 배지 대신 제출물 건수
 *   - 공통: 브레드크럼에 분반명, 마감까지 남은 시간, 같은 분반 과제 순서로 이전·다음 과제
 */
export default function AssignmentDetailPage() {
  const { assignmentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: me } = useMe()

  const aid = Number(assignmentId)
  const validAid = Number.isInteger(aid) && aid > 0
  const param = Number(searchParams.get('cohort'))
  const myCohortsQuery = useMyCohorts()
  const cohortId = Number.isInteger(param) && param > 0 ? param : (myCohortsQuery.data?.[0]?.id ?? NaN)

  const cohortQuery = useCohort(cohortId)
  const query = useAssignment(cohortId, validAid ? aid : NaN)
  const listQuery = useAssignments(cohortId) // 이전·다음 과제 - 목록 화면과 같은 순서(차시 → 등록순)
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
  const archived = cohort?.status === 'ARCHIVED'
  // 현황판 열람은 보관 분반에서도 유지 - canManage(ACTIVE 전용 쓰기 판정)가 아니라 역할로 판단
  const canSeeBoard = isAdminRole(me?.globalRole) || cohort?.myRole === 'OPERATOR'
  const overdue = isOverdue(assignment.dueAt)
  const remaining = overdue ? null : remainingLabel(assignment.dueAt)
  // 원안: 좌 문제 / 우 편집기 - 학생의 자동 채점 과제만. 파일·링크 과제, 보관 분반(제출란 없음), 운영진 화면(현황판이 주인공)은 위아래로
  const split = assignment.judgeEnabled && !archived && !canSeeBoard

  const list = listQuery.data ?? []
  const index = list.findIndex((a) => a.id === assignment.id)
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null

  const handleDelete = () => {
    // 삭제 = 연쇄 - 경고 건수는 서버가 준 submissionCount (운영진에게만 값이 온다)
    const count = assignment.submissionCount ?? 0
    const warning =
      count > 0
        ? `이 과제를 삭제할까요? 제출물 ${count}건이 함께 삭제됩니다. 되돌릴 수 없어요.`
        : '이 과제를 삭제할까요? 삭제하면 되돌릴 수 없어요.'
    if (!window.confirm(warning)) return
    deleteMutation.mutate(assignment.id, {
      onSuccess: () => navigate(`/assignments?cohort=${cohortId}`, { replace: true }),
    })
  }

  const description = (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">과제 설명</h2>
        {split && (
          <p className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted-foreground">
            <span>등록 {formatKst(assignment.createdAt)}</span>
            <span className="font-bold text-destructive">마감 {formatKst(assignment.dueAt)}</span>
          </p>
        )}
      </div>
      {assignment.description ? (
        <MarkdownView source={assignment.description} className="mt-3" />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">설명이 없습니다.</p>
      )}
    </section>
  )

  const period = (
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
  )

  const form = archived ? (
    <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
      보관된 분반이라 새 제출은 할 수 없어요. 기록 열람은 가능합니다.
    </p>
  ) : (
    <SubmissionForm
      cohortId={cohortId}
      assignmentId={assignment.id}
      dueAt={assignment.dueAt}
      judgeEnabled={assignment.judgeEnabled}
      problemId={assignment.problemId}
      editorHeight={split ? 'clamp(320px, 52svh, 640px)' : undefined}
    />
  )

  const myList = <MySubmissionList cohortId={cohortId} assignmentId={assignment.id} />

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="현재 위치">
          {cohort && (
            <>
              <Link to={`/cohorts/${cohort.id}`} className="hover:text-foreground">
                {cohort.name}
              </Link>
              <ChevronRight className="size-3.5" />
            </>
          )}
          <Link to={`/assignments?cohort=${cohortId}`} className="hover:text-foreground">
            과제
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{assignment.sessionNo === null ? '기타' : `${assignment.sessionNo}차시`}</span>
        </nav>
        {/* V7: 제목·본문·태그는 배정된 문제의 것 - HOJ 에서 같은 문제를 다시 볼 수 있게 링크를 둔다 */}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {assignment.tags.map((tag) => (
            <span key={tag.id} className="rounded-md bg-secondary px-1.5 py-0.5 font-semibold">
              {tag.name}
            </span>
          ))}
          <Link to={`/problems/${assignment.problemId}`} className="hover:text-primary hover:underline">
            HOJ 에서 이 문제 보기
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="font-mono text-primary">#{assignment.problemNo}</span>
            {assignment.title}
            {/* 운영진에게 본인의 "미제출" 배지는 과제 자체가 미제출로 읽혀 뺀다 - 대신 제출물 건수 */}
            {!canSeeBoard && assignment.myStatus !== null && <SubmissionStatusBadge status={assignment.myStatus} />}
            {canSeeBoard && typeof assignment.submissionCount === 'number' && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">제출물 {assignment.submissionCount}건</span>
            )}
            {assignment.judgeEnabled && (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-primary">자동 채점</span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Clock className="size-3.5" />
              {overdue ? '마감됨' : remaining ? `${ddayLabel(assignment.dueAt)} · ${remaining} 남음` : ddayLabel(assignment.dueAt)}
            </span>
            {canManage && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/assignments/${assignment.id}/edit?cohort=${cohortId}`}>
                    <Pencil data-icon="inline-start" />
                    수정
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 data-icon="inline-start" />
                  삭제
                </Button>
              </>
            )}
            {/* 원안의 "이전 문제 / 다음 문제" - 같은 분반 과제 목록 순서 */}
            {list.length > 1 && (
              <span className="flex items-center gap-1">
                {prev ? (
                  <Button variant="ghost" size="sm" asChild title={`#${prev.problemNo} ${prev.title}`}>
                    <Link to={`/assignments/${prev.id}?cohort=${cohortId}`}>
                      <ChevronLeft data-icon="inline-start" />
                      이전 과제
                    </Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    <ChevronLeft data-icon="inline-start" />
                    이전 과제
                  </Button>
                )}
                {next ? (
                  <Button variant="ghost" size="sm" asChild title={`#${next.problemNo} ${next.title}`}>
                    <Link to={`/assignments/${next.id}?cohort=${cohortId}`}>
                      다음 과제
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    다음 과제
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
        {deleteMutation.error && (
          <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>
        )}
      </header>

      {split ? (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <div className="space-y-4">
            {description}
            <JudgeSamplesSection problemId={assignment.problemId} />
          </div>
          <div className="xl:sticky xl:top-16">{form}</div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {description}
            {period}
          </div>
          {assignment.judgeEnabled && <JudgeSamplesSection problemId={assignment.problemId} />}
          {!canSeeBoard && form}
        </>
      )}

      {canSeeBoard ? (
        <>
          <StatusBoard cohortId={cohortId} assignmentId={assignment.id} canComment={canManage && !archived} title={`${assignment.problemNo}_${assignment.title}`} />
          {/* 운영진 본인 제출은 테스트 용도 - 원안 "과제 현황" 화면에는 없는 요소라 접어 둔다 */}
          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">직접 제출해 보기 · 내 제출 기록</summary>
            <div className="space-y-4 border-t p-4">
              {form}
              {myList}
            </div>
          </details>
        </>
      ) : (
        myList
      )}
    </div>
  )
}
