import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OperatorNoticesView } from '@/components/notices/OperatorNoticesView'
import { StudentNoticesView } from '@/components/notices/StudentNoticesView'

/**
 * 공지사항 - 역할에 따라 수강자 목록 / 교육운영진 관리(피그마 2:37234) 뷰로 나뉜다.
 * 판정은 홈과 동일: ADMIN이거나 canManage 분반이 하나라도 있으면 교육운영진 뷰.
 */
export default function NoticesPage() {
  const { data: me } = useMe()
  const { data: cohorts, isPending, error, refetch } = useMyCohorts()

  if (isPending) return <LoadingScreen label="공지사항 불러오는 중..." />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />

  const isOperator = me?.globalRole === 'ADMIN' || cohorts.some((c) => c.canManage)
  return isOperator ? <OperatorNoticesView /> : <StudentNoticesView />
}
