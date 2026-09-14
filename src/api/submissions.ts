import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, BASE_URL } from './client'
import { assignmentKeys } from './assignments'
import type { JudgeStatus, StatusBoardRow, SubmissionCommentPayload, SubmissionPayload, SubmissionResponse, SubmissionSummary } from './types'

/** 채점이 진행 중이면 2초마다 다시 읽는다 (judge/design.md 결정 5) - 탭이 숨겨지면 TanStack Query 기본값대로 멈춘다 */
const judging = (status: JudgeStatus | null | undefined) => status === 'PENDING' || status === 'RUNNING'
const POLL_MS = 2000

export const submissionKeys = {
  my: (cohortId: number, assignmentId: number) =>
    ['cohorts', cohortId, 'assignments', assignmentId, 'submissions', 'my'] as const,
  detail: (cohortId: number, assignmentId: number, submissionId: number) =>
    ['cohorts', cohortId, 'assignments', assignmentId, 'submissions', submissionId] as const,
  board: (cohortId: number, assignmentId: number) =>
    ['cohorts', cohortId, 'assignments', assignmentId, 'status-board'] as const,
}

function base(cohortId: number, assignmentId: number) {
  return `/api/cohorts/${cohortId}/assignments/${assignmentId}`
}

/** 파일 다운로드(#21)는 fetch 없이 브라우저가 직접 연다 - 세션 쿠키는 same-origin 요청에 자동으로 실린다 */
export function submissionFileUrl(cohortId: number, assignmentId: number, submissionId: number) {
  return `${BASE_URL}${base(cohortId, assignmentId)}/submissions/${submissionId}/file`
}

/** 내 제출 이력(#19) - 서버가 최신순으로 준다 */
export function useMySubmissions(cohortId: number, assignmentId: number) {
  return useQuery({
    queryKey: submissionKeys.my(cohortId, assignmentId),
    queryFn: () => apiFetch<SubmissionSummary[]>(`${base(cohortId, assignmentId)}/submissions/my`),
    enabled: Number.isFinite(cohortId) && Number.isFinite(assignmentId),
    refetchInterval: (query) => (query.state.data?.some((s) => judging(s.judgeStatus)) ? POLL_MS : false),
  })
}

/** 제출 단건(#20) - 코드 전문 포함. 행을 펼쳤을 때만 부른다(enabled) */
export function useSubmission(cohortId: number, assignmentId: number, submissionId: number | null) {
  return useQuery({
    queryKey: submissionKeys.detail(cohortId, assignmentId, submissionId ?? -1),
    queryFn: () => apiFetch<SubmissionResponse>(`${base(cohortId, assignmentId)}/submissions/${submissionId}`),
    enabled: submissionId !== null,
    refetchInterval: (query) => (judging(query.state.data?.judge?.status) ? POLL_MS : false),
  })
}

/** 현황판(#22) - 운영진 전용이라 canManage일 때만 부른다(enabled) */
export function useStatusBoard(cohortId: number, assignmentId: number, enabled: boolean) {
  return useQuery({
    queryKey: submissionKeys.board(cohortId, assignmentId),
    queryFn: () => apiFetch<StatusBoardRow[]>(`${base(cohortId, assignmentId)}/status-board`),
    enabled: enabled && Number.isFinite(cohortId) && Number.isFinite(assignmentId),
    refetchInterval: (query) => (query.state.data?.some((r) => judging(r.latestJudgeStatus)) ? POLL_MS : false),
  })
}

/**
 * 제출(#18) - multipart: request JSON 파트 + file 파트(선택).
 * 성공 시 이 분반의 과제 캐시 전체를 무효화 - 이력·상태 배지(myStatus)·현황판이 같은 키 접두사를 공유한다.
 */
export function useCreateSubmission(cohortId: number, assignmentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, file }: { payload: SubmissionPayload; file: File | null }) => {
      const form = new FormData()
      form.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      if (file) form.append('file', file)
      return apiFetch<SubmissionResponse>(`${base(cohortId, assignmentId)}/submissions`, { method: 'POST', form })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}

/**
 * [운영진] 제출 코멘트 남기기·덮어쓰기(#45) - 제출 1건에 1개, 점수 없음.
 * 성공 시 이 분반의 과제 캐시 전체를 무효화 - 상세(comment)·내 이력(hasComment)·현황판(latestCommented)이 같은 접두사를 공유한다.
 */
export function useCommentSubmission(cohortId: number, assignmentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: number; payload: SubmissionCommentPayload }) =>
      apiFetch<SubmissionResponse>(`${base(cohortId, assignmentId)}/submissions/${submissionId}/comment`, { method: 'PUT', json: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}

/** [운영진] 제출 코멘트 지우기(#46) - 멱등 204 */
export function useClearSubmissionComment(cohortId: number, assignmentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (submissionId: number) =>
      apiFetch<void>(`${base(cohortId, assignmentId)}/submissions/${submissionId}/comment`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}
