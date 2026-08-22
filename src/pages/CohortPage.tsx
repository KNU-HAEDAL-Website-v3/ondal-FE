import { Link, useParams } from 'react-router'
import { Archive, ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OperatorName } from '@/components/cohorts/OperatorName'

/**
 * 분반 페이지 - 지금은 머리말(이름·상태·운영진)만. 차시 목록·과제는 다음 슬라이스(Assignment)에서 채운다.
 * 비소속 URL 직접 접근(403) → ApiErrorView가 홈으로 보낸다. 잘못된 id → 404 안내.
 */
export default function CohortPage() {
  const { cohortId } = useParams()
  const id = Number(cohortId)
  const validId = Number.isInteger(id) && id > 0
  const { data: cohort, isPending, error, refetch } = useCohort(validId ? id : NaN)

  if (!validId) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 분반 주소예요.')} />
  if (isPending) return <LoadingScreen />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />

  const archived = cohort.status === 'ARCHIVED'

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

      <section className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        차시·과제 목록은 다음 단계(Assignment 슬라이스)에서 여기에 표시됩니다.
        {cohort.canManage && <p className="mt-1">운영 기능(과제 등록·수강생 배정·현황판)도 함께 추가됩니다.</p>}
      </section>
    </div>
  )
}
