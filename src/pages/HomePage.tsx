import { useLocation } from 'react-router'
import { GraduationCap, Info } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { CohortSection } from '@/components/cohorts/CohortSection'

/**
 * 홈 - 인사말 + 내 분반. (flows 1.1절 UC-S2, design.md 3절 FE 메모)
 * GET /api/me/cohorts 를 status로 나눠 "현재 소속(ACTIVE)" / "지난 소속(ARCHIVED)" 두 접이식 섹션, 현재 소속이 위.
 * 아예 소속이 없으면(빈 배열) 미소속 안내.
 */
export default function HomePage() {
  const { data: me } = useMe()
  const { data: cohorts, isPending, error, refetch } = useMyCohorts()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">안녕하세요, {me?.name}님</h1>
        <p className="mt-1 text-sm text-muted-foreground">소속된 분반에서 과제를 확인하고 제출할 수 있어요.</p>
      </div>

      {notice && (
        <Alert>
          <Info />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {isPending ? (
        <LoadingScreen label="분반 목록 불러오는 중..." />
      ) : error ? (
        <ApiErrorView error={error} onRetry={() => void refetch()} />
      ) : cohorts.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" />}
          title="아직 소속된 분반이 없어요"
          description={
            me?.globalRole === 'ADMIN'
              ? '관리자는 소속과 무관하게 전체 분반을 관리합니다 - 분반 관리 화면은 다음 단계에서 추가됩니다.'
              : '분반에 배정되면 여기에 표시됩니다. 운영진에게 문의해 주세요.'
          }
        />
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
