import { useLocation } from 'react-router'
import { Info } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OperatorDashboard } from '@/components/dashboard/OperatorDashboard'
import { StudentDashboard } from '@/components/dashboard/StudentDashboard'

/**
 * 홈 대시보드 - 역할에 따라 수강자(피그마 28:368) / 교육운영진(28:35) 뷰로 나뉜다.
 * 판정: ADMIN이거나 canManage 분반이 하나라도 있으면 교육운영진 뷰.
 * 403 리다이렉트 안내(notice)는 홈에서만 표시한다 (ApiErrorView가 여기로 보낸다).
 */
export default function HomePage() {
  const { data: me } = useMe()
  const { data: cohorts, isPending, error, refetch } = useMyCohorts()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  if (isPending) return <LoadingScreen label="대시보드 불러오는 중..." />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />

  const isOperator = me?.globalRole === 'ADMIN' || cohorts.some((c) => c.canManage)

  return (
    <div className="space-y-6">
      {notice && (
        <Alert>
          <Info />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {isOperator ? <OperatorDashboard /> : <StudentDashboard cohorts={cohorts} />}
    </div>
  )
}
