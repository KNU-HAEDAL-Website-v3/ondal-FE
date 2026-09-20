import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  AcceptedSolution,
  JudgeRunResponse,
  PracticeSubmitPayload,
  ProblemPayload,
  ProblemResponse,
  ProblemRunPayload,
  ProblemSolution,
  ProblemSolutionsPayload,
  ProblemSummary,
  SubmissionResponse,
  SubmissionSummary,
} from './types'

/**
 * 문제 라이브러리(HOJ) - 분반에 속하지 않는 리소스라 키에 cohortId 가 없다 (V7).
 * 채점 설정·예시는 api/judge.ts, 태그는 api/tags.ts, 채점 현황·랭킹·사용자 페이지는 api/hoj.ts.
 */
export const problemKeys = {
  all: ['problems'] as const,
  lists: () => ['problems', 'list'] as const,
  list: (tagIds: number[]) => ['problems', 'list', [...tagIds].sort((a, b) => a - b)] as const,
  detail: (problemId: number) => ['problems', problemId] as const,
  mySubmissions: (problemId: number) => ['problems', problemId, 'submissions', 'my'] as const,
  submission: (problemId: number, submissionId: number) => ['problems', problemId, 'submissions', submissionId] as const,
  /** 다른 사람 풀이 - 언어 필터별로 따로 캐시 (P3, 5절) */
  acceptedSolutions: (problemId: number, language: string) => ['problems', problemId, 'accepted-solutions', language] as const,
  /** 정답 코드(참고 풀이) - 운영진 이상 (P3, 6절) */
  solutions: (problemId: number) => ['problems', problemId, 'solutions'] as const,
}

function listPath(tagIds: number[]) {
  if (tagIds.length === 0) return '/api/problems'
  const params = new URLSearchParams()
  tagIds.forEach((id) => params.append('tagIds', String(id)))
  return `/api/problems?${params.toString()}`
}

/**
 * 구 서버 호환 - 난이도·허용 언어 열(BE V9)·통계·내 상태·북마크(P3)가 아직 없는 서버의 응답에도 기본값을 채운다.
 * FE 가 BE 보다 먼저 배포돼도 목록·상세·출제 폼이 깨지지 않도록(필드가 없으면 "-" 와 제한 없음·0건으로 보인다)
 */
function withBankFields<T extends Partial<ProblemSummary> & { solved: boolean }>(problem: T): T {
  return {
    ...problem,
    difficulty: problem.difficulty ?? null,
    allowedLanguages: problem.allowedLanguages ?? [],
    solvedUserCount: problem.solvedUserCount ?? 0,
    submissionCount: problem.submissionCount ?? 0,
    acceptedRate: problem.acceptedRate ?? null,
    myStatus: problem.myStatus ?? (problem.solved ? 'SOLVED' : 'NONE'),
    bookmarked: problem.bookmarked ?? false,
  }
}

function withDetailFields(problem: Partial<ProblemResponse> & ProblemSummary): ProblemResponse {
  return { ...(problem as ProblemResponse), solutionLanguages: problem.solutionLanguages ?? [] }
}

/** 목록 - 번호 오름차순(서버 정렬). 태그를 주면 그 태그를 모두 가진 문제만(AND) */
export function useProblems(tagIds: number[] = []) {
  return useQuery({
    queryKey: problemKeys.list(tagIds),
    queryFn: () => apiFetch<ProblemSummary[]>(listPath(tagIds)).then((list) => list.map(withBankFields)),
  })
}

export function useProblem(problemId: number) {
  return useQuery({
    queryKey: problemKeys.detail(problemId),
    queryFn: () =>
      apiFetch<ProblemResponse>(`/api/problems/${problemId}`).then((problem) => withDetailFields(withBankFields(problem))),
    enabled: Number.isFinite(problemId),
  })
}

// ---- 북마크 (P3, 7절) ---------------------------------------------------------------------

/**
 * 북마크 켜기(PUT)·끄기(DELETE) - 멱등, 204. 목록·상세 캐시를 먼저 바꾸고(낙관적 갱신) 실패하면 되돌린다.
 * 별을 눌렀을 때 서버 왕복을 기다리면 목록이 굼떠 보인다 - 결과는 bookmarked 값 하나뿐이라 낙관적으로 그려도 어긋날 게 없다
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ problemId, bookmarked }: { problemId: number; bookmarked: boolean }) =>
      apiFetch<void>(`/api/problems/${problemId}/bookmark`, { method: bookmarked ? 'PUT' : 'DELETE' }),
    onMutate: async ({ problemId, bookmarked }) => {
      await queryClient.cancelQueries({ queryKey: problemKeys.lists() })
      await queryClient.cancelQueries({ queryKey: problemKeys.detail(problemId), exact: true })
      const lists = queryClient.getQueriesData<ProblemSummary[]>({ queryKey: problemKeys.lists() })
      const detail = queryClient.getQueryData<ProblemResponse>(problemKeys.detail(problemId))
      queryClient.setQueriesData<ProblemSummary[]>({ queryKey: problemKeys.lists() }, (old) =>
        old?.map((problem) => (problem.id === problemId ? { ...problem, bookmarked } : problem)),
      )
      queryClient.setQueryData<ProblemResponse>(problemKeys.detail(problemId), (old) => (old ? { ...old, bookmarked } : old))
      return { lists, detail }
    },
    onError: (_error, { problemId }, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data))
      if (context?.detail) queryClient.setQueryData(problemKeys.detail(problemId), context.detail)
    },
  })
}

// ---- 다른 사람 풀이 · 정답 코드 · 실행 (P3, 5·6·8절) -------------------------------------------

/** 다른 사람 풀이 - 그 문제를 맞힌 사람·운영진만(아니면 403 NOT_SOLVED). 펼칠 때만 부른다(enabled) */
export function useAcceptedSolutions(problemId: number, language: string, enabled: boolean) {
  const query = language === '' ? '' : `?language=${encodeURIComponent(language)}`
  return useQuery({
    queryKey: problemKeys.acceptedSolutions(problemId, language),
    queryFn: () => apiFetch<AcceptedSolution[]>(`/api/problems/${problemId}/accepted-solutions${query}`),
    enabled: enabled && Number.isFinite(problemId),
    // 403 NOT_SOLVED 는 다시 불러도 같다 - 재시도하지 않는다
    retry: false,
  })
}

/** 정답 코드(참고 풀이) - 운영진 이상. 상세의 "정답 코드 보기" 창과 수정 폼이 부른다 */
export function useProblemSolutions(problemId: number, enabled: boolean) {
  return useQuery({
    queryKey: problemKeys.solutions(problemId),
    queryFn: () => apiFetch<ProblemSolution[]>(`/api/problems/${problemId}/solutions`),
    enabled: enabled && Number.isFinite(problemId),
  })
}

/** 정답 코드 통째 교체 - 문제 저장 뒤에 이어서 부르므로 problemId 는 호출 시점에 받는다(새 문제는 생성 응답의 id) */
export function useSaveProblemSolutions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ problemId, payload }: { problemId: number; payload: ProblemSolutionsPayload }) =>
      apiFetch<ProblemSolution[]>(`/api/problems/${problemId}/solutions`, { method: 'PUT', json: payload }),
    onSuccess: (data, { problemId }) => {
      queryClient.setQueryData(problemKeys.solutions(problemId), data)
      // 상세의 solutionLanguages 가 바뀐다
      void queryClient.invalidateQueries({ queryKey: problemKeys.detail(problemId), exact: true })
    },
  })
}

/** 내 입력으로 실행 - 저장 없음, 로그인 누구나. 분당 10회 초과 429, 엔진 미연결 503 (화면이 안내) */
export function useRunProblem(problemId: number) {
  return useMutation({
    mutationFn: (payload: ProblemRunPayload) =>
      apiFetch<JudgeRunResponse>(`/api/problems/${problemId}/run`, { method: 'POST', json: payload }),
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
