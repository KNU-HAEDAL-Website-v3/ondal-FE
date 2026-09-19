import { Outlet } from 'react-router'
import { ApiError } from '@/api/client'
import { useMe } from '@/api/auth'
import { ApiErrorView } from '@/components/ApiErrorView'

import { isAdminRole } from '@/lib/roles'
/**
 * 관리자(ADMIN) 전용 라우트의 울타리 - RequireAuth 안쪽에서만 쓴다(me 가 이미 로드된 상태).
 * 비관리자의 URL 직접 접근은 권한 밖 접근 규칙대로 홈 + 안내 (CLAUDE.md 규칙 3). 서버도 @AdminOnly 로 403 을 낸다 - 이건 화면 차원의 1차 방어
 */
export function RequireAdmin() {
  const { data: me } = useMe()
  if (!isAdminRole(me?.globalRole)) {
    return <ApiErrorView error={new ApiError(403, 'FORBIDDEN', '관리자만 들어갈 수 있는 화면이에요.')} />
  }
  return <Outlet />
}
