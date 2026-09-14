import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { QuestionPayload, QuestionResponse } from './types'

export const questionKeys = {
  list: (cohortId: number) => ['cohorts', cohortId, 'questions'] as const,
  detail: (cohortId: number, questionId: number) => ['cohorts', cohortId, 'questions', questionId] as const,
}

/** 목록 - 서버가 최신순(createdAt desc, 같은 시각은 id desc)으로 준다. 페이징 없음, 재정렬 없이 그대로 그린다 */
export function fetchQuestions(cohortId: number) {
  return apiFetch<QuestionResponse[]>(`/api/cohorts/${cohortId}/questions`)
}

/** 단건 - 다른 분반의 질문 id면 404 (존재 비노출) */
export function fetchQuestion(cohortId: number, questionId: number) {
  return apiFetch<QuestionResponse>(`/api/cohorts/${cohortId}/questions/${questionId}`)
}

export function useQuestions(cohortId: number) {
  return useQuery({
    queryKey: questionKeys.list(cohortId),
    queryFn: () => fetchQuestions(cohortId),
    enabled: Number.isFinite(cohortId),
  })
}

export function useQuestion(cohortId: number, questionId: number) {
  return useQuery({
    queryKey: questionKeys.detail(cohortId, questionId),
    queryFn: () => fetchQuestion(cohortId, questionId),
    enabled: Number.isFinite(cohortId) && Number.isFinite(questionId),
  })
}

/** 쓰기 성공 시 그 분반의 질문 캐시(목록·단건)를 통째로 무효화 - 키가 같은 접두사를 공유한다 */
function useInvalidateQuestions(cohortId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: questionKeys.list(cohortId) })
}

export function useCreateQuestion(cohortId: number) {
  const invalidate = useInvalidateQuestions(cohortId)
  return useMutation({
    mutationFn: (payload: QuestionPayload) =>
      apiFetch<QuestionResponse>(`/api/cohorts/${cohortId}/questions`, { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

export function useUpdateQuestion(cohortId: number, questionId: number) {
  const invalidate = useInvalidateQuestions(cohortId)
  return useMutation({
    mutationFn: (payload: QuestionPayload) =>
      apiFetch<QuestionResponse>(`/api/cohorts/${cohortId}/questions/${questionId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

export function useDeleteQuestion(cohortId: number) {
  const invalidate = useInvalidateQuestions(cohortId)
  return useMutation({
    mutationFn: (questionId: number) =>
      apiFetch<void>(`/api/cohorts/${cohortId}/questions/${questionId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
