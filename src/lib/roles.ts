import type { GlobalRole } from '@/api/types'

/**
 * 전역 역할 판정·표시 (docs 결정 12, 2026-09-19).
 * 해구르르(ADMIN)와 관리자(MAINTAINER, 유지보수 팀)는 **권한이 같다** - 서버 User.isAdmin() 과 같은 규칙.
 * 화면의 권한 분기는 반드시 isAdminRole 로 하고 `globalRole === 'ADMIN'` 을 직접 비교하지 않는다.
 * 분반 안의 직책(교육운영진 등)은 서버 RoleTitle 문자열을 그대로 쓴다 - 여기는 전역 역할 이름만.
 */
export function isAdminRole(role: GlobalRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MAINTAINER'
}

/** 전역 역할의 표시 이름 - 서버 RoleTitle 의 해구르르·관리자와 같은 글자 */
export const GLOBAL_ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: '해구르르',
  MAINTAINER: '관리자',
  MEMBER: '부원',
}

export function globalRoleLabel(role: GlobalRole | null | undefined): string {
  return role ? GLOBAL_ROLE_LABEL[role] : '부원'
}
