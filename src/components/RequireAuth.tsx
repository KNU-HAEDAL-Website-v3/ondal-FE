import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '@/api/auth'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ApiErrorView } from '@/components/ApiErrorView'

/**
 * 로그인이 필요한 라우트의 울타리.
 * - 판정 중: 로딩 화면 (깜빡이며 로그인 페이지로 튕기지 않게)
 * - 미로그인(null): /login 으로, 원래 가려던 곳은 returnTo 로 넘겨 로그인 후 복귀
 * - 서버 연결 실패: 에러 화면 + 재시도 (로그인 페이지로 보내면 원인을 오해한다)
 * 세션이 도중에 만료되면 apiFetch가 me를 null로 바꾸고(main.tsx), 이 컴포넌트가 다시 렌더되며 로그인으로 보낸다.
 */
export function RequireAuth() {
  const location = useLocation()
  const { data: me, isPending, error, refetch } = useMe()

  if (isPending) return <LoadingScreen label="로그인 상태 확인 중..." />
  if (error) return <ApiErrorView error={error} onRetry={() => void refetch()} />
  if (!me) {
    const returnTo = location.pathname + location.search
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }
  return <Outlet />
}
