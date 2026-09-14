import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { CohortCreatePayload, CohortResponse, CohortStatus, CohortUpdatePayload } from './types'

export const cohortKeys = {
  all: ['cohorts'] as const,
  mine: () => ['cohorts', 'mine'] as const,
  detail: (cohortId: number) => ['cohorts', 'detail', cohortId] as const,
  /** [관리자] 상태별 전체 목록 */
  list: (status: CohortStatus) => ['cohorts', 'list', status] as const,
}

/** 내가 소속된 모든 분반 (ACTIVE 먼저, 그 다음 ARCHIVED - 정렬은 서버가 한다). 빈 배열 = 미소속 */
export function fetchMyCohorts() {
  return apiFetch<CohortResponse[]>('/api/me/cohorts')
}

/** 분반 단건. 비소속이면 403 FORBIDDEN, 없으면 404 NOT_FOUND (ADMIN) 또는 403 (그 외) */
export function fetchCohort(cohortId: number) {
  return apiFetch<CohortResponse>(`/api/cohorts/${cohortId}`)
}

/** [관리자] 전체 분반 - 상태별(기본 ACTIVE), 최신순. 비관리자는 403 */
export function fetchCohorts(status: CohortStatus) {
  return apiFetch<CohortResponse[]>(`/api/cohorts?status=${status}`)
}

export function useMyCohorts() {
  return useQuery({ queryKey: cohortKeys.mine(), queryFn: fetchMyCohorts })
}

export function useCohort(cohortId: number) {
  return useQuery({
    queryKey: cohortKeys.detail(cohortId),
    queryFn: () => fetchCohort(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

/** [관리자] 상태별 전체 목록. enabled=false 면 호출하지 않는다 (비관리자 화면에서 분기용) */
export function useCohorts(status: CohortStatus, enabled = true) {
  return useQuery({ queryKey: cohortKeys.list(status), queryFn: () => fetchCohorts(status), enabled })
}

/**
 * 분반 자체가 바뀌면(생성·수정·보관) 'cohorts' 접두사 캐시를 통째로 무효화 - 관리자 목록·내 분반·상세·명부가 모두 이 접두사를 쓴다.
 * 분반 하위 데이터(과제·질문)도 같은 접두사라 함께 다시 불러오지만, 이 쓰기는 드물어 감수한다.
 */
function useInvalidateCohorts() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: cohortKeys.all })
}

/** [관리자] 분반 생성 + 운영진 동시 지정 (UC-A1). 201 + CohortResponse */
export function useCreateCohort() {
  const invalidate = useInvalidateCohorts()
  return useMutation({
    mutationFn: (payload: CohortCreatePayload) => apiFetch<CohortResponse>('/api/cohorts', { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

/** [관리자] 이름·설명 전체 교체. 보관 분반이면 409 COHORT_ARCHIVED */
export function useUpdateCohort(cohortId: number) {
  const invalidate = useInvalidateCohorts()
  return useMutation({
    mutationFn: (payload: CohortUpdatePayload) =>
      apiFetch<CohortResponse>(`/api/cohorts/${cohortId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

/** [관리자] 보관 (멱등) - 보관되면 누구도 변경 불가, 열람만 */
export function useArchiveCohort() {
  const invalidate = useInvalidateCohorts()
  return useMutation({
    mutationFn: (cohortId: number) => apiFetch<CohortResponse>(`/api/cohorts/${cohortId}/archive`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

/** [관리자] 보관 해제 (멱등) */
export function useRestoreCohort() {
  const invalidate = useInvalidateCohorts()
  return useMutation({
    mutationFn: (cohortId: number) => apiFetch<CohortResponse>(`/api/cohorts/${cohortId}/restore`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
