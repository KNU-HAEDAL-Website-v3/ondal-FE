import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { cohortKeys } from './cohorts'
import type { MemberResponse, StudentAssignPayload } from './types'

export const memberKeys = {
  list: (cohortId: number) => ['cohorts', 'members', cohortId] as const,
}

/** 분반 명부 - 운영진 먼저(서버 정렬). 운영진 이상만, 학생은 403. 보관 분반도 열람 가능 */
export function fetchMembers(cohortId: number) {
  return apiFetch<MemberResponse[]>(`/api/cohorts/${cohortId}/members`)
}

export function useMembers(cohortId: number) {
  return useQuery({
    queryKey: memberKeys.list(cohortId),
    queryFn: () => fetchMembers(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

/**
 * 명부가 바뀌면 분반 요약(운영진 목록·수강생 수)도 바뀐다 - 상세·내 분반·관리자 목록을 다시 불러온다.
 * 명부 자체는 응답(갱신 명부)으로 바로 채우거나(setQueryData) 무효화한다.
 */
function useRefreshAfterRosterChange(cohortId: number) {
  const queryClient = useQueryClient()
  return (roster?: MemberResponse[]) => {
    if (roster) queryClient.setQueryData(memberKeys.list(cohortId), roster)
    else void queryClient.invalidateQueries({ queryKey: memberKeys.list(cohortId) })
    void queryClient.invalidateQueries({ queryKey: cohortKeys.detail(cohortId) })
    void queryClient.invalidateQueries({ queryKey: cohortKeys.mine() })
    void queryClient.invalidateQueries({ queryKey: ['cohorts', 'list'] })
  }
}

/** 수강생 일괄 배정 (운영진 이상, 멱등) - 응답이 갱신된 명부라 재조회 없음. 이미 운영진인 loginId 가 섞이면 409 (아무도 배정되지 않음) */
export function useAssignStudents(cohortId: number) {
  const refresh = useRefreshAfterRosterChange(cohortId)
  return useMutation({
    mutationFn: (loginIds: string[]) =>
      apiFetch<MemberResponse[]>(`/api/cohorts/${cohortId}/students`, {
        method: 'POST',
        json: { loginIds } satisfies StudentAssignPayload,
      }),
    onSuccess: (roster) => refresh(roster),
  })
}

/** 수강생 제외 (운영진 이상) - 소속만 지운다. 운영진이거나 미소속이면 404 */
export function useRemoveStudent(cohortId: number) {
  const refresh = useRefreshAfterRosterChange(cohortId)
  return useMutation({
    mutationFn: (loginId: string) =>
      apiFetch<void>(`/api/cohorts/${cohortId}/students/${encodeURIComponent(loginId)}`, { method: 'DELETE' }),
    onSuccess: () => refresh(),
  })
}

/** [관리자] 운영진 지정 (멱등) - 미소속이면 소속시키고, 수강생이면 승격. 선등록 가능 */
export function useAssignOperator(cohortId: number) {
  const refresh = useRefreshAfterRosterChange(cohortId)
  return useMutation({
    mutationFn: (loginId: string) =>
      apiFetch<MemberResponse>(`/api/cohorts/${cohortId}/operators/${encodeURIComponent(loginId)}`, { method: 'PUT' }),
    onSuccess: () => refresh(),
  })
}

/** [관리자] 운영진 해제 - 운영진 소속만 지운다. 수강생이거나 미소속이면 404. 강등은 없다(해제 후 수강생으로 다시 배정) */
export function useRemoveOperator(cohortId: number) {
  const refresh = useRefreshAfterRosterChange(cohortId)
  return useMutation({
    mutationFn: (loginId: string) =>
      apiFetch<void>(`/api/cohorts/${cohortId}/operators/${encodeURIComponent(loginId)}`, { method: 'DELETE' }),
    onSuccess: () => refresh(),
  })
}
