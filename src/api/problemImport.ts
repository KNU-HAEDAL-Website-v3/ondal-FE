import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ProblemBankSource, ProblemBankSyncStatus, ProblemImportItem, ProblemImportResult } from './types'

/**
 * 한 요청에 담는 문제 수. 테스트케이스까지 담긴 번들은 문제당 100KB 안팎이라(100문제 = 약 10MB)
 * 한 번에 보내면 프록시·서버 요청 크기 제한에 걸릴 수 있어 1MB 안팎으로 나눠 보낸다.
 */
export const IMPORT_CHUNK_SIZE = 10

export interface ImportProgress {
  /** 지금 보내는 묶음 번호 (1부터) */
  chunk: number
  totalChunks: number
  /** 이 묶음에 든 문제 번호 범위 */
  from: number
  to: number
}

export interface ImportProblemsInput {
  problems: ProblemImportItem[]
  /** 같은 번호가 있을 때 덮어쓸지 - false 면 건너뜀 */
  overwrite: boolean
  onProgress?: (progress: ImportProgress) => void
}

/** 묶음 도중 실패 - 앞 묶음은 이미 저장된 상태라 어디까지 됐는지 함께 알린다 */
export class ImportChunkError extends Error {
  /** 실패 전까지 저장된 결과 */
  readonly done: ProblemImportResult
  readonly failedChunk: ImportProgress

  constructor(message: string, done: ProblemImportResult, failedChunk: ImportProgress) {
    super(message)
    this.name = 'ImportChunkError'
    this.done = done
    this.failedChunk = failedChunk
  }
}

function merge(acc: ProblemImportResult, next: ProblemImportResult): ProblemImportResult {
  return {
    created: acc.created + next.created,
    updated: acc.updated + next.updated,
    skipped: acc.skipped + next.skipped,
    createdTags: [...acc.createdTags, ...next.createdTags.filter((tag) => !acc.createdTags.includes(tag))],
    problemNos: [...acc.problemNos, ...next.problemNos],
  }
}

/**
 * 번들을 번호순으로 정렬해 IMPORT_CHUNK_SIZE 개씩 차례로 POST /api/problems/import 한다.
 * 서버는 요청 하나를 한 트랜잭션으로 처리하므로 묶음 단위로 원자적이다. 도중에 실패하면 ImportChunkError -
 * 같은 파일을 다시 올리면 번호가 같은 문제는 건너뛰므로(overwrite 가 아닐 때) 이어서 진행된다.
 */
export async function importProblemsInChunks({ problems, overwrite, onProgress }: ImportProblemsInput): Promise<ProblemImportResult> {
  const sorted = [...problems].sort((a, b) => a.problemNo - b.problemNo)
  const totalChunks = Math.ceil(sorted.length / IMPORT_CHUNK_SIZE)
  let acc: ProblemImportResult = { created: 0, updated: 0, skipped: 0, createdTags: [], problemNos: [] }
  for (let i = 0; i < totalChunks; i++) {
    const slice = sorted.slice(i * IMPORT_CHUNK_SIZE, (i + 1) * IMPORT_CHUNK_SIZE)
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (!first || !last) continue
    const progress: ImportProgress = { chunk: i + 1, totalChunks, from: first.problemNo, to: last.problemNo }
    onProgress?.(progress)
    try {
      const result = await apiFetch<ProblemImportResult>('/api/problems/import', { method: 'POST', json: { problems: slice, overwrite } })
      acc = merge(acc, result)
    } catch (e) {
      throw new ImportChunkError(e instanceof Error ? e.message : String(e), acc, progress)
    }
  }
  return acc
}

export const problemBankKeys = {
  source: ['problems', 'bank', 'source'] as const,
  status: ['problems', 'bank', 'status'] as const,
}

/** [관리자] HOJ 레포 설정 - "깃허브에서 가져오기" 버튼을 보일지(configured)와 레포·브랜치 표시 */
export function useProblemBankSource(enabled = true) {
  return useQuery({
    queryKey: problemBankKeys.source,
    queryFn: () => apiFetch<ProblemBankSource>('/api/problems/import/github'),
    enabled,
    staleTime: 60_000,
  })
}

/** [관리자] 깃허브 가져오기 작업 상태 - RUNNING 이면 1.5초마다 다시 읽는다 (대화상자가 열려 있을 때만) */
export function useGithubImportStatus(enabled: boolean) {
  return useQuery({
    queryKey: problemBankKeys.status,
    queryFn: () => apiFetch<ProblemBankSyncStatus>('/api/problems/import/github/status'),
    enabled,
    refetchInterval: (query) => (query.state.data?.state === 'RUNNING' ? 1500 : false),
  })
}

/**
 * [관리자] 깃허브에서 문제 가져오기 시작 - 서버가 레포 ref 의 zip 을 받아 problems/* 를 읽어 넣는 작업을 띄우고(202) 상태를 돌려준다.
 * 끝날 때까지는 useGithubImportStatus 가 폴링. 로컬 빌드(bank.json)·파일 선택이 필요 없는 기본 경로.
 * 서버에 토큰이 없으면 503 PROBLEM_BANK_NOT_CONFIGURED, 이미 도는 중이면 409
 */
export function useStartGithubImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (overwrite: boolean) =>
      apiFetch<ProblemBankSyncStatus>(`/api/problems/import/github?overwrite=${overwrite ? 'true' : 'false'}`, { method: 'POST' }),
    onSuccess: (status) => queryClient.setQueryData(problemBankKeys.status, status),
  })
}

/** [관리자] 문제 번들 파일 가져오기(보조 경로) - HOJ 레포의 빌드 산출물(JSON). 끝나면(실패해도 앞 묶음은 저장됨) 문제 목록·태그 캐시를 비운다 */
export function useImportProblems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importProblemsInChunks,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
