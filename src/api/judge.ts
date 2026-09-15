import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { assignmentKeys } from './assignments'
import { problemKeys } from './problems'
import type {
  JudgeConfigPayload,
  JudgeConfigResponse,
  JudgeRunPayload,
  JudgeRunResponse,
  JudgeSamplesResponse,
  RejudgeResponse,
} from './types'

/**
 * 자동 채점 - V7 이후 채점 기준(테스트케이스·실행 제한)은 **문제**의 것이다.
 * 같은 문제를 여러 분반에 배정해도 기준은 하나를 공유하므로 설정·예시·출제 도구는 문제 스코프,
 * 재채점만 과제 스코프로 남는다("내 반 제출만 다시 돌린다"는 분반 운영 동작).
 */
export const judgeKeys = {
  config: (problemId: number) => [...problemKeys.detail(problemId), 'judge'] as const,
  samples: (problemId: number) => [...problemKeys.detail(problemId), 'judge', 'samples'] as const,
}

const base = (problemId: number) => `/api/problems/${problemId}/judge`

/** #47 채점 설정·테스트케이스(비공개 포함) - 운영진. 수정 화면에서만 부른다(enabled) */
export function useJudgeConfig(problemId: number, enabled: boolean) {
  return useQuery({
    queryKey: judgeKeys.config(problemId),
    queryFn: () => apiFetch<JudgeConfigResponse>(base(problemId)),
    enabled: enabled && Number.isFinite(problemId),
  })
}

/**
 * #48 채점 설정 저장(통째 교체) - 문제 저장 뒤에 이어서 부르므로 problemId 는 호출 시점에 받는다(새 문제는 생성 응답의 id).
 * 케이스를 고치면 그 문제로 채점된 제출 전부가 재채점 대상이라, 문제·과제 캐시를 모두 무효화한다.
 */
export function useSaveJudgeConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ problemId, payload }: { problemId: number; payload: JudgeConfigPayload }) =>
      apiFetch<JudgeConfigResponse>(base(problemId), { method: 'PUT', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: problemKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['cohorts'] })
    },
  })
}

/** #49 출제 도구 실행 - 저장 없음. 기대 출력 채우기(expectedOutputs null) / 출제 검증(expectedOutputs 있음) */
export function useRunJudge(problemId: number) {
  return useMutation({
    mutationFn: (payload: JudgeRunPayload) =>
      apiFetch<JudgeRunResponse>(`${base(problemId)}/run`, { method: 'POST', json: payload }),
  })
}

/** #50 공개 케이스(예시)·제한·지원 언어 - 로그인한 누구나. 과제 상세와 HOJ 문제 화면이 같이 쓴다 */
export function useJudgeSamples(problemId: number, enabled: boolean) {
  return useQuery({
    queryKey: judgeKeys.samples(problemId),
    queryFn: () => apiFetch<JudgeSamplesResponse>(`${base(problemId)}/samples`),
    enabled: enabled && Number.isFinite(problemId),
  })
}

/** #51 재채점 - 운영진, 과제 스코프. 결과가 PENDING 으로 돌아가므로 과제 캐시 무효화 → 폴링이 다시 시작된다 */
export function useRejudge(cohortId: number, assignmentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<RejudgeResponse>(`/api/cohorts/${cohortId}/assignments/${assignmentId}/judge/rejudge`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}
