import { Outlet } from 'react-router'
import { ApiError } from '@/api/client'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'

import { isAdminRole } from '@/lib/roles'
/**
 * 문제 출제·수정 화면의 울타리 - RequireAuth 안쪽에서만 쓴다(me 가 이미 로드된 상태).
 *
 * 통과 조건은 BE `@OperatorAnywhere` 와 같다: **ADMIN 이거나 어느 분반에서든 운영진**.
 * 문제(Problem)는 분반에 속하지 않아 경로에 {cohortId} 가 없으므로 분반별 판정(canManage 한 곳)으로는 가를 수 없고,
 * "내 분반 중 canManage 가 하나라도 있는가" 로 본다.
 *
 * 통과하지 못하면 ApiErrorView 가 403 을 받아 **홈으로 돌려보낸다**(CLAUDE.md 규칙 3, RequireAdmin 과 동일).
 * 서버도 403 을 내므로 이건 화면 차원의 1차 방어 - 없으면 수강생이 출제 폼을 다 채운 뒤에야 403 을 만난다.
 * ※ 아래 ApiError 의 문구는 FORBIDDEN 이면 리다이렉트로 대체되어 화면에 뜨지 않는다(RequireAdmin 도 같음) - 로그·의도 표시용.
 */
export function RequireOperator() {
  const { data: me } = useMe()
  const myCohortsQuery = useMyCohorts()

  if (isAdminRole(me?.globalRole)) {
    return <Outlet />
  }
  // 소속을 받아야 판정할 수 있다 - 받기 전에 막으면 운영진도 잠깐 튕긴다
  if (myCohortsQuery.isPending) {
    return <LoadingScreen label="권한 확인 중..." />
  }
  if ((myCohortsQuery.data ?? []).some((cohort) => cohort.canManage)) {
    return <Outlet />
  }
  return (
    <ApiErrorView
      error={new ApiError(403, 'FORBIDDEN', '문제 출제는 운영진 이상만 할 수 있어요. 문제를 보고 푸는 건 누구나 가능해요.')}
    />
  )
}
