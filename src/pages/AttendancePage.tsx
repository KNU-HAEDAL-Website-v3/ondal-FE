import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OperatorAttendanceView } from '@/components/attendance/OperatorAttendanceView'
import { StudentAttendanceView } from '@/components/attendance/StudentAttendanceView'

/**
 * 출석 - 역할에 따라 수강자 출석 현황(피그마 28:836) / 교육운영진 출결 관리(28:1013)로 나뉜다.
 * 판정은 홈과 동일: ADMIN이거나 canManage 분반이 하나라도 있으면 교육운영진 뷰.
 */
export default function AttendancePage() {
  const { data: me } = useMe()
  const { data: cohorts, isPending, error, refetch } = useMyCohorts()

  if (isPending) return <LoadingScreen label="출석 정보 불러오는 중..." />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />

  const isOperator = me?.globalRole === 'ADMIN' || cohorts.some((c) => c.canManage)
  return isOperator ? <OperatorAttendanceView /> : <StudentAttendanceView cohorts={cohorts} />
}
