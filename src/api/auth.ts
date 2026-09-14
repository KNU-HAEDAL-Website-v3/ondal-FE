import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch, BASE_URL } from './client'
import type { LogoutResponse, UserResponse } from './types'

export const meQueryKey = ['auth', 'me'] as const

/**
 * 로그인 방식 - 빌드 변수 VITE_AUTH_MODE 로 고정한다 (BE ondal.auth.mode 와 짝).
 *   stub(기본): POST /api/auth/login 에 loginId 만 보내면 통과 - local BE·mock
 *   oidc: GET /api/auth/login 으로 브라우저 이동 → 홈페이지(Keycloak) 로그인 → BE 콜백 → FE 복귀 - 운영 빌드
 * mock(MSW)은 스텁 흐름만 흉내 내므로 mock 이면 값과 무관하게 stub.
 */
export const AUTH_MODE: 'stub' | 'oidc' =
  import.meta.env.VITE_API_MOCK !== 'true' && import.meta.env.VITE_AUTH_MODE === 'oidc' ? 'oidc' : 'stub'

/** 로그인 상태 조회. 미로그인(401)은 에러가 아니라 null - 앱 진입 시 정상적으로 일어나는 일이다. */
export async function fetchMe(): Promise<UserResponse | null> {
  try {
    return await apiFetch<UserResponse>('/api/auth/me')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

/** 스텁 로그인 - loginId만 보내면 통과 (없으면 MEMBER로 생성). 운영(oidc)에는 이 엔드포인트가 없다(405) - oidcLoginUrl 로 이동한다. */
export function login(loginId: string) {
  return apiFetch<UserResponse>('/api/auth/login', { method: 'POST', json: { loginId } })
}

/**
 * 홈페이지 로그인 시작 주소 - fetch 가 아니라 브라우저가 직접 이동한다 (BE 가 Keycloak 로그인 화면으로 302).
 * 성공하면 BE 가 FE 의 returnTo(사이트 내부 경로)로, 실패하면 /login?error=<코드>[&returnTo=…] 로 돌려보낸다.
 * BASE_URL 이 절대 주소여야 한다 - 상대 경로면 SPA 호스트의 index.html 로 떨어진다 (vite.config.ts 가 빌드 때 검사).
 */
export function oidcLoginUrl(returnTo: string) {
  return `${BASE_URL}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}

/**
 * 세션이 이미 없어도 조용히 성공한다 (BE 계약).
 * oidc 모드면 logoutUrl 이 오고, FE 가 그 주소로 이동해야 홈페이지 세션까지 끝난다 - 공용 PC 에서 다음 사람이 앞사람 계정으로 자동 로그인되는 것을 막는다.
 */
export function logout() {
  return apiFetch<LogoutResponse>('/api/auth/logout', { method: 'POST' })
}

/**
 * 현재 로그인 사용자. data === null 이면 미로그인.
 * RequireAuth가 이 쿼리로 보호 라우트를 판정하고, 헤더가 이름을 표시한다.
 */
export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: fetchMe, staleTime: Infinity })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      // 로그인 직후: me를 갱신하고, 이전 사용자 기준으로 캐시된 데이터(분반 목록 등)는 버린다
      queryClient.clear()
      queryClient.setQueryData(meQueryKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(meQueryKey, null)
    },
  })
}
