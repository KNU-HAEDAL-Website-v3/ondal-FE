import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from './client'
import type { UserResponse } from './types'

export const meQueryKey = ['auth', 'me'] as const

/** 로그인 상태 조회. 미로그인(401)은 에러가 아니라 null — 앱 진입 시 정상적으로 일어나는 일이다. */
export async function fetchMe(): Promise<UserResponse | null> {
  try {
    return await apiFetch<UserResponse>('/api/auth/me')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

/** 스텁 로그인 — loginId만 보내면 통과 (없으면 MEMBER로 생성). 홈페이지 연동 시 이 함수만 바뀐다. */
export function login(loginId: string) {
  return apiFetch<UserResponse>('/api/auth/login', { method: 'POST', json: { loginId } })
}

/** 세션이 이미 없어도 조용히 성공한다 (BE 계약) */
export function logout() {
  return apiFetch<void>('/api/auth/logout', { method: 'POST' })
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
