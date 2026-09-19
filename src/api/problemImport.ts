import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ProblemImportRequest, ProblemImportResult } from './types'

/** [관리자] 문제 번들 가져오기 - 문제 은행 레포의 빌드 산출물(JSON). 성공하면 문제 목록·태그 캐시를 비운다 */
export function useImportProblems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProblemImportRequest) =>
      apiFetch<ProblemImportResult>('/api/problems/import', { method: 'POST', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
