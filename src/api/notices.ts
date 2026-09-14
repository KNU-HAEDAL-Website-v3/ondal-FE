import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { NoticePayload, NoticeResponse } from './types'

export const noticeKeys = {
  all: ['notices'] as const,
  list: () => ['notices', 'list'] as const,
  detail: (noticeId: number) => ['notices', 'detail', noticeId] as const,
}

/** 내가 볼 수 있는 공지 - 서버가 가시성(전체 + 소속 분반, 관리자는 전부)과 정렬(필독 먼저 → 최신순)을 정한다. 페이징 없음 */
export function fetchNotices() {
  return apiFetch<NoticeResponse[]>('/api/notices')
}

/** 단건 - 비소속의 분반 공지는 403, 없으면 404 */
export function fetchNotice(noticeId: number) {
  return apiFetch<NoticeResponse>(`/api/notices/${noticeId}`)
}

export function useNotices() {
  return useQuery({ queryKey: noticeKeys.list(), queryFn: fetchNotices })
}

export function useNotice(noticeId: number) {
  return useQuery({
    queryKey: noticeKeys.detail(noticeId),
    queryFn: () => fetchNotice(noticeId),
    enabled: Number.isFinite(noticeId),
  })
}

/** 쓰기 성공 시 공지 캐시(목록·단건) 통째로 무효화 */
function useInvalidateNotices() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: noticeKeys.all })
}

/** 등록 - 대상이 전체(cohortId null)면 관리자 API, 분반이면 그 분반 API. 응답은 같은 모양 */
export function useCreateNotice() {
  const invalidate = useInvalidateNotices()
  return useMutation({
    mutationFn: ({ cohortId, payload }: { cohortId: number | null; payload: NoticePayload }) =>
      apiFetch<NoticeResponse>(cohortId === null ? '/api/notices' : `/api/cohorts/${cohortId}/notices`, {
        method: 'POST',
        json: payload,
      }),
    onSuccess: invalidate,
  })
}

/** 수정(전체 교체) - 대상 분반은 바꿀 수 없다(API 없음). 권한 없으면 403, 보관 분반이면 409 */
export function useUpdateNotice(noticeId: number) {
  const invalidate = useInvalidateNotices()
  return useMutation({
    mutationFn: (payload: NoticePayload) =>
      apiFetch<NoticeResponse>(`/api/notices/${noticeId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

export function useDeleteNotice() {
  const invalidate = useInvalidateNotices()
  return useMutation({
    mutationFn: (noticeId: number) => apiFetch<void>(`/api/notices/${noticeId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
