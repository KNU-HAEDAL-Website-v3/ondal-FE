import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { SessionPayload, SessionResponse } from './types'

export const sessionKeys = {
  list: (cohortId: number) => ['cohorts', cohortId, 'sessions'] as const,
}

/** 출석 캐시 접두사 - 차시가 바뀌면(등록·삭제) 명부·내 출석도 다시 불러온다 */
export const attendanceKeyPrefix = (cohortId: number) => ['cohorts', cohortId, 'attendance'] as const

/** 차시 목록 - 날짜 → 번호 오름차순(서버 정렬). 분반 소속 누구나 */
export function fetchSessions(cohortId: number) {
  return apiFetch<SessionResponse[]>(`/api/cohorts/${cohortId}/sessions`)
}

export function useSessions(cohortId: number) {
  return useQuery({
    queryKey: sessionKeys.list(cohortId),
    queryFn: () => fetchSessions(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

function useInvalidateSessions(cohortId: number) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.list(cohortId) })
    void queryClient.invalidateQueries({ queryKey: attendanceKeyPrefix(cohortId) })
  }
}

/** 차시 등록 (운영진 이상) - sessionNo null 이면 자동 채번. 중복 409 CONFLICT, 보관 409 */
export function useCreateSession(cohortId: number) {
  const invalidate = useInvalidateSessions(cohortId)
  return useMutation({
    mutationFn: (payload: SessionPayload) =>
      apiFetch<SessionResponse>(`/api/cohorts/${cohortId}/sessions`, { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

/** 차시 수정 - 번호·제목·날짜 전체 교체 */
export function useUpdateSession(cohortId: number) {
  const invalidate = useInvalidateSessions(cohortId)
  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: SessionPayload }) =>
      apiFetch<SessionResponse>(`/api/cohorts/${cohortId}/sessions/${sessionId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

/** 차시 삭제 - 그 차시 출석 기록도 함께 삭제된다(서버 연쇄). 경고는 attendanceCount 로 */
export function useDeleteSession(cohortId: number) {
  const invalidate = useInvalidateSessions(cohortId)
  return useMutation({
    mutationFn: (sessionId: number) => apiFetch<void>(`/api/cohorts/${cohortId}/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
