import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  PracticeSubmitPayload,
  ProblemPayload,
  ProblemResponse,
  ProblemSummary,
  SubmissionResponse,
  SubmissionSummary,
} from './types'

/**
 * 문제 라이브러리(HOJ) - 분반에 속하지 않는 리소스라 키에 cohortId 가 없다 (V7).
 * 채점 설정·예시는 api/judge.ts, 태그는 api/tags.ts.
 */
export const problemKeys = {
  all: ['problems'] as const,
  list: (tagIds: number[]) => ['problems', 'list', [...tagIds].sort((a, b) => a - b)] as const,
  detail: (problemId: number) => ['problems', problemId] as const,
  mySubmissions: (problemId: number) => ['problems', problemId, 'submissions', 'my'] as const,
  submission: (problemId: number, submissionId: number) => ['problems', problemId, 'submissions', submissionId] as const,
}

function listPath(tagIds: number[]) {
  if (tagIds.length === 0) return '/api/problems'
  const params = new URLSearchParams()
  tagIds.forEach((id) => params.append('tagIds', String(id)))
  return `/api/problems?${params.toString()}`
}

/** 목록 - 번호 오름차순(서버 정렬). 태그를 주면 그 태그를 모두 가진 문제만(AND) */
export function useProblems(tagIds: number[] = []) {
  return useQuery({
    queryKey: problemKeys.list(tagIds),
    queryFn: () => apiFetch<ProblemSummary[]>(listPath(tagIds)),
  })
}

export function useProblem(problemId: number) {
  return useQuery({
    queryKey: problemKeys.detail(problemId),
    queryFn: () => apiFetch<ProblemResponse>(`/api/problems/${problemId}`),
    enabled: Number.isFinite(problemId),
  })
}

/** 쓰기 성공 시 문제 캐시를 통째로 무효화 - 목록·상세가 같은 접두사를 공유한다 */
function useInvalidateProblems() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: problemKeys.all })
}

export function useCreateProblem() {
  const invalidate = useInvalidateProblems()
  return useMutation({
    mutationFn: (payload: ProblemPayload) => apiFetch<ProblemResponse>('/api/problems', { method: 'POST', json: payload }),
    onSuccess: invalidate,
  })
}

export function useUpdateProblem(problemId: number) {
  const invalidate = useInvalidateProblems()
  return useMutation({
    mutationFn: (payload: ProblemPayload) =>
      apiFetch<ProblemResponse>(`/api/problems/${problemId}`, { method: 'PUT', json: payload }),
    onSuccess: invalidate,
  })
}

/** 삭제 - 배정된 과제나 연습 제출이 있으면 409 (서버가 막는다) */
export function useDeleteProblem() {
  const invalidate = useInvalidateProblems()
  return useMutation({
    mutationFn: (problemId: number) => apiFetch<void>(`/api/problems/${problemId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

// ---- HOJ 연습 제출 -------------------------------------------------------------------------

/** 내 연습 제출 이력 - 최신 먼저. 코드 전문은 단건에서 */
export function useMyPracticeSubmissions(problemId: number) {
  return useQuery({
    queryKey: problemKeys.mySubmissions(problemId),
    queryFn: () => apiFetch<SubmissionSummary[]>(`/api/problems/${problemId}/submissions/my`),
    enabled: Number.isFinite(problemId),
    // 채점 중이면 2초마다 다시 - 과제 제출과 같은 규약 (judge/fe.md)
    refetchInterval: (query) =>
      (query.state.data ?? []).some((row) => row.judgeStatus === 'PENDING' || row.judgeStatus === 'RUNNING') ? 2000 : false,
  })
}

/** 내 연습 제출 단건 - 코드 전문 + 채점 결과. 남의 것이면 404 */
export function usePracticeSubmission(problemId: number, submissionId: number, enabled = true) {
  return useQuery({
    queryKey: problemKeys.submission(problemId, submissionId),
    queryFn: () => apiFetch<SubmissionResponse>(`/api/problems/${problemId}/submissions/${submissionId}`),
    enabled: enabled && Number.isFinite(problemId) && Number.isFinite(submissionId),
    refetchInterval: (query) => {
      const status = query.state.data?.judge?.status
      return status === 'PENDING' || status === 'RUNNING' ? 2000 : false
    },
  })
}

/** 연습 제출 - 성공하면 내 기록과 문제(해결 표시)를 다시 불러온다 */
export function useSubmitPractice(problemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: PracticeSubmitPayload) =>
      apiFetch<SubmissionResponse>(`/api/problems/${problemId}/submissions`, { method: 'POST', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: problemKeys.mySubmissions(problemId) })
      void queryClient.invalidateQueries({ queryKey: problemKeys.detail(problemId) })
    },
  })
}
