import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { attendanceKeyPrefix, sessionKeys } from './sessions'
import type { AttendanceMarkPayload, AttendanceRosterResponse, MyAttendanceResponse } from './types'

export const attendanceKeys = {
  roster: (cohortId: number, sessionId: number) => [...attendanceKeyPrefix(cohortId), 'roster', sessionId] as const,
  me: (cohortId: number) => [...attendanceKeyPrefix(cohortId), 'me'] as const,
}

/** 차시 명부 (운영진 이상) - 행 = 현재 수강생(이름순), 요약·학생별 누계 포함. 학생은 403 */
export function fetchRoster(cohortId: number, sessionId: number) {
  return apiFetch<AttendanceRosterResponse>(`/api/cohorts/${cohortId}/sessions/${sessionId}/attendances`)
}

/** 내 출석 (분반 소속자) - 누계(출석률)와 차시별 기록, 최신 차시 먼저 */
export function fetchMyAttendance(cohortId: number) {
  return apiFetch<MyAttendanceResponse>(`/api/cohorts/${cohortId}/attendances/me`)
}

export function useRoster(cohortId: number, sessionId: number) {
  return useQuery({
    queryKey: attendanceKeys.roster(cohortId, sessionId),
    queryFn: () => fetchRoster(cohortId, sessionId),
    enabled: Number.isFinite(cohortId) && Number.isFinite(sessionId),
  })
}

export function useMyAttendance(cohortId: number) {
  return useQuery({
    queryKey: attendanceKeys.me(cohortId),
    queryFn: () => fetchMyAttendance(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

/**
 * 출석 표시 (운영진 이상, 차시 단위 일괄 upsert) - 한 명 바꾸기도 원소 1개짜리 목록, status null 은 기록 삭제.
 * 응답이 갱신된 명부라 바로 캐시에 넣는다(재조회 불필요). 차시 목록의 attendanceCount 도 바뀌므로 함께 무효화
 */
export function useMarkAttendance(cohortId: number, sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AttendanceMarkPayload) =>
      apiFetch<AttendanceRosterResponse>(`/api/cohorts/${cohortId}/sessions/${sessionId}/attendances`, {
        method: 'PUT',
        json: payload,
      }),
    onSuccess: (roster) => {
      queryClient.setQueryData(attendanceKeys.roster(cohortId, sessionId), roster)
      void queryClient.invalidateQueries({ queryKey: sessionKeys.list(cohortId) })
    },
  })
}
