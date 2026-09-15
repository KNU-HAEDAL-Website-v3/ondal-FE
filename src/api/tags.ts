import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { problemKeys } from './problems'
import type { TagPayload, TagResponse } from './types'

/**
 * 문제 태그 - 조회는 누구나(출제 화면 선택지·목록 필터), 등록·수정·삭제는 관리자만.
 * 태그 이름이 바뀌면 그 태그가 붙은 문제 표시도 함께 바뀌므로, 쓰기 성공 시 문제 캐시도 무효화한다.
 */
export const tagKeys = {
  list: ['tags'] as const,
}

export function useTags() {
  return useQuery({
    queryKey: tagKeys.list,
    queryFn: () => apiFetch<TagResponse[]>('/api/tags'),
  })
}

function useInvalidateTags() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: tagKeys.list })
    void queryClient.invalidateQueries({ queryKey: problemKeys.all })
  }
}

export function useCreateTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (payload: TagPayload) => apiFetch<TagResponse>('/api/tags', { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

export function useUpdateTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: ({ tagId, payload }: { tagId: number; payload: TagPayload }) =>
      apiFetch<TagResponse>(`/api/tags/${tagId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

/** 삭제 - 쓰는 문제가 있으면 409 (서버가 막는다) */
export function useDeleteTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (tagId: number) => apiFetch<void>(`/api/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
