import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { AssignmentPayload, AssignmentResponse } from './types'

export const assignmentKeys = {
  list: (cohortId: number) => ['cohorts', cohortId, 'assignments'] as const,
  detail: (cohortId: number, assignmentId: number) => ['cohorts', cohortId, 'assignments', assignmentId] as const,
}

/** 목록 - 서버가 차시 오름차순(차시 없음 마지막) → 등록순으로 준다. 기본 화면은 재정렬 없이 그대로 그린다 */
export function fetchAssignments(cohortId: number) {
  return apiFetch<AssignmentResponse[]>(`/api/cohorts/${cohortId}/assignments`)
}

/** 단건 - 다른 분반의 과제 id면 404 (존재 비노출) */
export function fetchAssignment(cohortId: number, assignmentId: number) {
  return apiFetch<AssignmentResponse>(`/api/cohorts/${cohortId}/assignments/${assignmentId}`)
}

export function useAssignments(cohortId: number) {
  return useQuery({
    queryKey: assignmentKeys.list(cohortId),
    queryFn: () => fetchAssignments(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

export function useAssignment(cohortId: number, assignmentId: number) {
  return useQuery({
    queryKey: assignmentKeys.detail(cohortId, assignmentId),
    queryFn: () => fetchAssignment(cohortId, assignmentId),
    enabled: Number.isFinite(cohortId) && Number.isFinite(assignmentId),
  })
}

/** 쓰기 성공 시 그 분반의 과제 캐시(목록·단건)를 통째로 무효화 - 키가 같은 접두사를 공유한다 */
function useInvalidateAssignments(cohortId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) })
}

export function useCreateAssignment(cohortId: number) {
  const invalidate = useInvalidateAssignments(cohortId)
  return useMutation({
    mutationFn: (payload: AssignmentPayload) =>
      apiFetch<AssignmentResponse>(`/api/cohorts/${cohortId}/assignments`, { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

export function useUpdateAssignment(cohortId: number, assignmentId: number) {
  const invalidate = useInvalidateAssignments(cohortId)
  return useMutation({
    mutationFn: (payload: AssignmentPayload) =>
      apiFetch<AssignmentResponse>(`/api/cohorts/${cohortId}/assignments/${assignmentId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

export function useDeleteAssignment(cohortId: number) {
  const invalidate = useInvalidateAssignments(cohortId)
  return useMutation({
    mutationFn: (assignmentId: number) =>
      apiFetch<void>(`/api/cohorts/${cohortId}/assignments/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
