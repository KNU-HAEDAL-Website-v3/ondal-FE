import { Link, useParams } from 'react-router'
import { Archive, ArrowLeft } from 'lucide-react'
import { useMe } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OperatorName } from '@/components/cohorts/OperatorName'

/**
 * 분반 페이지 - 머리말(이름·상태·운영진) + 하위 화면 진입(과제·Q&A·명부).
 * 비소속 URL 직접 접근(403) → ApiErrorView가 홈으로 보낸다. 잘못된 id → 404 안내.
 */
export default function CohortPage() {
  const { cohortId } = useParams()
  const id = Number(cohortId)
  const validId = Number.isInteger(id) && id > 0
  const { data: me } = useMe()
  const { data: cohort, isPending, error, refetch } = useCohort(validId ? id : NaN)

  if (!validId) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 분반 주소예요.')} />
  if (isPending) return <LoadingScreen />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />

  const archived = cohort.status === 'ARCHIVED'
  // 명부 열람은 보관 분반에서도 유지 - canManage(ACTIVE 전용 쓰기 판정)가 아니라 역할로 판단 (현황판과 같은 규칙)
  const canSeeRoster = me?.globalRole === 'ADMIN' || cohort.myRole === 'OPERATOR'

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/">
          <ArrowLeft data-icon="inline-start" />
          홈으로
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{cohort.name}</h1>
          <Badge variant="secondary">{cohort.myTitle}</Badge>
          {archived && (
            <Badge variant="outline">
              <Archive data-icon="inline-start" />
              보관됨
            </Badge>
          )}
        </div>
        {cohort.description && <p className="text-muted-foreground">{cohort.description}</p>}
        <p className="text-sm text-muted-foreground">
          운영진{' '}
          {cohort.operators.length === 0
            ? '없음'
            : cohort.operators.map((op, i) => (
                <span key={op.id}>
                  {i > 0 && ', '}
                  <OperatorName operator={op} />
                </span>
              ))}
          {cohort.studentCount !== null && <span> · 수강생 {cohort.studentCount}명</span>}
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight">과제</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            이 분반의 차시별 과제 목록{cohort.canManage && ' - 등록·수정·삭제 가능'}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/assignments?cohort=${cohort.id}`}>과제 보기</Link>
        </Button>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Q&A</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            이 분반의 질문 게시판 - 소속이면 누구나 질문·열람{archived && ' (보관됨 - 열람만 가능)'}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/cohorts/${cohort.id}/questions`}>질문 보기</Link>
        </Button>
      </section>

      {canSeeRoster && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight">명부 · 수강생 배정</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              운영진·수강생 명단 확인
              {cohort.canManage && ', 아이디 명단 붙여넣기로 일괄 배정·제외'}
              {archived && ' (보관됨 - 열람만)'}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/cohorts/${cohort.id}/members`}>명부 보기</Link>
          </Button>
        </section>
      )}
    </div>
  )
}
