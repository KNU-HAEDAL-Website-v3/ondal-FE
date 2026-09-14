import { Link } from 'react-router'
import { GraduationCap, Settings2 } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { CohortSection } from '@/components/cohorts/CohortSection'

/**
 * 내 수업 - 소속 분반 목록. (구 홈 화면 내용, flows 1.1절 UC-S2)
 * GET /api/me/cohorts 를 status로 나눠 "현재 소속(ACTIVE)" / "지난 소속(ARCHIVED)" 두 접이식 섹션.
 */
export default function MyCohortsPage() {
  const { data: me } = useMe()
  const { data: cohorts, isPending, error, refetch } = useMyCohorts()
  const isAdmin = me?.globalRole === 'ADMIN'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 수업</h1>
          <p className="mt-1 text-sm text-muted-foreground">소속된 분반에서 과제를 확인하고 제출할 수 있어요.</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
            <Link to="/admin/cohorts">
              <Settings2 data-icon="inline-start" />
              분반 관리
            </Link>
          </Button>
        )}
      </header>

      {isPending ? (
        <LoadingScreen label="분반 목록 불러오는 중..." />
      ) : error ? (
        <ApiErrorView error={error} onRetry={() => void refetch()} />
      ) : cohorts.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" />}
          title="아직 소속된 분반이 없어요"
          description={
            isAdmin
              ? '관리자는 소속과 무관하게 전체 분반을 관리합니다. 분반 관리에서 분반을 만들고 운영진을 지정하세요 - 본인을 운영진에 넣으면 여기에도 보여요.'
              : '분반에 배정되면 여기에 표시됩니다. 운영진에게 문의해 주세요.'
          }
        >
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/cohorts">분반 관리로</Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <CohortSection title="현재 소속" cohorts={cohorts.filter((c) => c.status === 'ACTIVE')} defaultOpen />
          <CohortSection
            title="지난 소속"
            cohorts={cohorts.filter((c) => c.status === 'ARCHIVED')}
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  )
}
