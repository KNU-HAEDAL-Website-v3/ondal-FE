import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { CohortResponse } from './types'

export const cohortKeys = {
  all: ['cohorts'] as const,
  mine: () => ['cohorts', 'mine'] as const,
  detail: (cohortId: number) => ['cohorts', 'detail', cohortId] as const,
}

/** 내가 소속된 모든 분반 (ACTIVE 먼저, 그 다음 ARCHIVED - 정렬은 서버가 한다). 빈 배열 = 미소속 */
export function fetchMyCohorts() {
  return apiFetch<CohortResponse[]>('/api/me/cohorts')
}

/** 분반 단건. 비소속이면 403 FORBIDDEN, 없으면 404 NOT_FOUND (ADMIN) 또는 403 (그 외) */
export function fetchCohort(cohortId: number) {
  return apiFetch<CohortResponse>(`/api/cohorts/${cohortId}`)
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
