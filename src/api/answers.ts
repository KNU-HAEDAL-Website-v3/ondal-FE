import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { questionKeys } from './questions'
import type { AnswerPayload, AnswerResponse } from './types'

/** 질문 상세 키의 하위 - 질문 캐시 접두사('cohorts', cohortId, 'questions')를 무효화하면 답변도 함께 갱신된다 */
export const answerKeys = {
  list: (cohortId: number, questionId: number) => [...questionKeys.detail(cohortId, questionId), 'answers'] as const,
}

const base = (cohortId: number, questionId: number) => `/api/cohorts/${cohortId}/questions/${questionId}/answers`

/** 답변 목록 - 오래된 순(서버 정렬). 분반 소속 누구나 */
export function fetchAnswers(cohortId: number, questionId: number) {
  return apiFetch<AnswerResponse[]>(base(cohortId, questionId))
}

export function useAnswers(cohortId: number, questionId: number) {
  return useQuery({
    queryKey: answerKeys.list(cohortId, questionId),
    queryFn: () => fetchAnswers(cohortId, questionId),
    enabled: Number.isFinite(cohortId) && Number.isFinite(questionId),
  })
}

/** 답변이 바뀌면 질문 목록·상세(answerCount)와 답변 목록을 함께 무효화 - 같은 접두사 */
function useInvalidateQuestionTree(cohortId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: questionKeys.list(cohortId) })
}

export function useCreateAnswer(cohortId: number, questionId: number) {
  const invalidate = useInvalidateQuestionTree(cohortId)
  return useMutation({
    mutationFn: (payload: AnswerPayload) => apiFetch<AnswerResponse>(base(cohortId, questionId), { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

export function useUpdateAnswer(cohortId: number, questionId: number) {
  const invalidate = useInvalidateQuestionTree(cohortId)
  return useMutation({
    mutationFn: ({ answerId, payload }: { answerId: number; payload: AnswerPayload }) =>
      apiFetch<AnswerResponse>(`${base(cohortId, questionId)}/${answerId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

export function useDeleteAnswer(cohortId: number, questionId: number) {
  const invalidate = useInvalidateQuestionTree(cohortId)
  return useMutation({
    mutationFn: (answerId: number) => apiFetch<void>(`${base(cohortId, questionId)}/${answerId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
