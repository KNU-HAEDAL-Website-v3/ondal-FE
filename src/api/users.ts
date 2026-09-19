import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { UserDirectoryEntry, UserStatus } from './types'

export const userKeys = {
  all: ['users'] as const,
  list: (status?: UserStatus) => ['users', 'list', status ?? 'ALL'] as const,
}

/** 부원 목록 (운영진 이상, 수강생은 403) - status 를 주면 서버가 거른다. 승인 대기 → 최근 생성순 (서버 정렬) */
export function fetchUsers(status?: UserStatus) {
  const query = status ? `?status=${status}` : ''
  return apiFetch<UserDirectoryEntry[]>(`/api/users${query}`)
}

export function useUsers(status?: UserStatus, enabled = true) {
  return useQuery({ queryKey: userKeys.list(status), queryFn: () => fetchUsers(status), enabled })
}

/**
 * 승인 (운영진 이상, 멱등) - 응답이 갱신된 한 줄이라 목록 캐시를 제자리에서 바꾼다.
 * 대기 목록(status=PENDING)에서는 빠져야 하므로 그 캐시는 무효화한다.
 */
export function useApproveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => apiFetch<UserDirectoryEntry>(`/api/users/${userId}/approve`, { method: 'POST' }),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserDirectoryEntry[]>(userKeys.list(), (prev) =>
        prev?.map((u) => (u.id === updated.id ? updated : u)),
      )
      void queryClient.invalidateQueries({ queryKey: userKeys.list('PENDING') })
      void queryClient.invalidateQueries({ queryKey: userKeys.list('ACTIVE') })
    },
  })
}
