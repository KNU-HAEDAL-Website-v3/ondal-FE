import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { assignmentKeys } from './assignments'
import type {
  JudgeConfigPayload,
  JudgeConfigResponse,
  JudgeRunPayload,
  JudgeRunResponse,
  JudgeSamplesResponse,
  RejudgeResponse,
} from './types'

/** 과제 상세 키의 하위 - 이 분반 과제 캐시 접두사를 무효화하면 채점 설정·예시도 함께 갱신된다 */
export const judgeKeys = {
  config: (cohortId: number, assignmentId: number) => [...assignmentKeys.detail(cohortId, assignmentId), 'judge'] as const,
  samples: (cohortId: number, assignmentId: number) => [...assignmentKeys.detail(cohortId, assignmentId), 'judge', 'samples'] as const,
}

const base = (cohortId: number, assignmentId: number) => `/api/cohorts/${cohortId}/assignments/${assignmentId}/judge`

/** #47 채점 설정·테스트케이스(비공개 포함) - 운영진. 수정 화면에서만 부른다(enabled) */
export function useJudgeConfig(cohortId: number, assignmentId: number, enabled: boolean) {
  return useQuery({
    queryKey: judgeKeys.config(cohortId, assignmentId),
    queryFn: () => apiFetch<JudgeConfigResponse>(base(cohortId, assignmentId)),
    enabled: enabled && Number.isFinite(cohortId) && Number.isFinite(assignmentId),
  })
}

/**
 * #48 채점 설정 저장(통째 교체) - 과제 저장 뒤에 이어서 부르므로 assignmentId 는 호출 시점에 받는다(새 과제는 생성 응답의 id).
 * 성공 시 이 분반 과제 캐시 전체 무효화 - judgeEnabled·예시·제출 결과가 같은 접두사
 */
export function useSaveJudgeConfig(cohortId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: number; payload: JudgeConfigPayload }) =>
      apiFetch<JudgeConfigResponse>(base(cohortId, assignmentId), { method: 'PUT', json: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}

/** #49 출제 도구 실행 - 저장 없음. 기대 출력 채우기(expectedOutputs null) / 출제 검증(expectedOutputs 있음) */
export function useRunJudge(cohortId: number, assignmentId: number) {
  return useMutation({
    mutationFn: (payload: JudgeRunPayload) =>
      apiFetch<JudgeRunResponse>(`${base(cohortId, assignmentId)}/run`, { method: 'POST', json: payload }),
  })
}

/** #50 공개 케이스(예시)·제한·지원 언어 - 소속 누구나. 자동 채점 문제일 때만(enabled) */
export function useJudgeSamples(cohortId: number, assignmentId: number, enabled: boolean) {
  return useQuery({
    queryKey: judgeKeys.samples(cohortId, assignmentId),
    queryFn: () => apiFetch<JudgeSamplesResponse>(`${base(cohortId, assignmentId)}/samples`),
    enabled: enabled && Number.isFinite(cohortId) && Number.isFinite(assignmentId),
  })
}

/** #51 재채점 - 운영진. 결과가 PENDING 으로 돌아가므로 과제 캐시 무효화 → 폴링이 다시 시작된다 */
export function useRejudge(cohortId: number, assignmentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<RejudgeResponse>(`${base(cohortId, assignmentId)}/rejudge`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(cohortId) }),
  })
}
