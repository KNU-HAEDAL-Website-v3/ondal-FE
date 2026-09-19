import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileJson, GitBranch, Upload } from 'lucide-react'
import {
  IMPORT_CHUNK_SIZE,
  ImportChunkError,
  useGithubImportStatus,
  useImportProblems,
  useProblemBankSource,
  useStartGithubImport,
  type ImportProgress,
} from '@/api/problemImport'
import type { ProblemBankSyncStatus, ProblemImportItem, ProblemImportResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatKst } from '@/lib/datetime'

/**
 * [관리자] 문제 가져오기 - 두 경로.
 * 1. 깃허브에서 가져오기(기본): 서버가 문제 은행 레포(ondal-problems) 의 브랜치를 직접 받아 problems/* 를 읽는다 - 로컬 빌드·파일 선택 없음.
 *    수 초~수십 초 걸려서 서버는 작업을 띄우고(202) 상태만 돌려준다 - 여기서는 끝날 때까지 상태를 폴링해 단계·진행 수를 보여 준다.
 *    서버에 레포 토큰이 없으면(configured=false) 안내만 하고 아래 파일 경로를 쓴다.
 * 2. 번들 파일(보조): 레포의 tools/build.py 산출물(bank.json)을 골라 IMPORT_CHUNK_SIZE 개씩 나눠 POST /api/problems/import.
 * 둘 다 규칙은 같다 - 번호가 키, 같은 번호는 기본 건너뛰고 "덮어쓰기"를 켜면 본문·태그·제한·테스트케이스 교체(재채점 없음).
 */
export function ImportProblemsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const sourceQuery = useProblemBankSource(open)
  const source = sourceQuery.data
  const statusQuery = useGithubImportStatus(open && source?.configured === true)
  const startMutation = useStartGithubImport()
  const fileMutation = useImportProblems()
  const [items, setItems] = useState<ProblemImportItem[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [fileResult, setFileResult] = useState<{ from: string; summary: ProblemImportResult } | null>(null)

  const status = statusQuery.data
  const running = status?.state === 'RUNNING'
  const busy = startMutation.isPending || fileMutation.isPending || running

  // 작업이 끝나는 순간 문제 목록·태그 캐시를 비운다 (RUNNING → DONE/FAILED 전이를 잡는다)
  const previousState = useRef<ProblemBankSyncStatus['state'] | undefined>(undefined)
  useEffect(() => {
    const now = status?.state
    if (previousState.current === 'RUNNING' && (now === 'DONE' || now === 'FAILED')) {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
    previousState.current = now
  }, [status?.state, queryClient])

  const startGithub = () => {
    setFileResult(null)
    fileMutation.reset()
    startMutation.mutate(overwrite)
  }

  const handleFile = async (file: File | undefined) => {
    setFileResult(null)
    setParseError(null)
    setItems(null)
    fileMutation.reset()
    if (!file) return
    setFileName(file.name)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const list = Array.isArray(parsed) ? parsed : (parsed as { problems?: unknown })?.problems
      if (!Array.isArray(list) || list.length === 0) throw new Error('problems 배열이 없어요')
      for (const item of list as ProblemImportItem[]) {
        if (typeof item.problemNo !== 'number' || typeof item.title !== 'string') throw new Error('problemNo·title 이 없는 문제가 있어요')
      }
      setItems(list as ProblemImportItem[])
    } catch (e) {
      setParseError(`번들 파일을 읽지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const importFile = () => {
    if (!items) return
    setFileResult(null)
    startMutation.reset()
    fileMutation.mutate(
      { problems: items, overwrite, onProgress: setProgress },
      { onSuccess: (r) => setFileResult({ from: fileName, summary: r }), onSettled: () => setProgress(null) },
    )
  }

  const chunkCount = items ? Math.ceil(items.length / IMPORT_CHUNK_SIZE) : 0
  const fileError = fileMutation.error
  const savedBeforeFailure = fileError instanceof ImportChunkError ? fileError.done.created + fileError.done.updated + fileError.done.skipped : 0
  const percent = status && status.total > 0 ? Math.min(100, Math.round((status.processed / status.total) * 100)) : 0

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>문제 가져오기</DialogTitle>
          <DialogDescription>
            문제 은행 레포에서 바로 가져오거나 번들 파일을 올려요. 번호가 같은 문제는 건너뛰고, 덮어쓰기를 켜면 본문·태그·제한·테스트케이스를 교체해요. 없는 태그는 새로 만들어요.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overwrite} disabled={busy} onChange={(e) => setOverwrite(e.target.checked)} className="size-4 accent-primary" />
          같은 번호가 있으면 덮어쓰기 (레포 내용으로 맞춤, 재채점 없음)
        </label>

        {/* 1. 깃허브 - 기본 경로 */}
        <section className="space-y-2 rounded-lg border bg-muted p-3 text-sm" aria-label="깃허브에서 가져오기">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-semibold">
              <GitBranch className="size-4" aria-hidden />
              깃허브에서 가져오기
              {source && <span className="font-mono text-xs font-normal text-muted-foreground">{source.repo}@{source.ref}</span>}
            </p>
            <Button size="sm" onClick={startGithub} disabled={busy || !source?.configured}>
              {running ? '가져오는 중...' : startMutation.isPending ? '시작하는 중...' : `${source?.ref ?? 'main'} 가져오기`}
            </Button>
          </div>
          {sourceQuery.isPending && <p className="text-xs text-muted-foreground">레포 설정을 확인하는 중...</p>}
          {sourceQuery.error && <p className="text-xs text-destructive">레포 설정을 읽지 못했어요: {sourceQuery.error.message}</p>}
          {source && !source.configured && (
            <p className="text-xs text-muted-foreground">서버에 레포 읽기 토큰이 없어요 (.env PROBLEM_BANK_GITHUB_TOKEN). 아래 파일로 가져올 수 있어요.</p>
          )}
          {source?.configured && !status && !statusQuery.error && (
            <p className="text-xs text-muted-foreground">서버가 레포의 problems/ 폴더를 읽어 넣어요. 머지된 최신 내용이 기준이라 로컬 빌드가 필요 없어요.</p>
          )}
          {statusQuery.error && <p className="text-xs text-destructive">진행 상태를 읽지 못했어요: {statusQuery.error.message}</p>}
          {startMutation.error && <p className="text-xs text-destructive">{startMutation.error.message}</p>}

          {status?.state === 'RUNNING' && (
            <div className="space-y-1" role="status">
              <p className="text-xs">
                {status.step} {status.total > 0 && `· ${status.processed}/${status.total}`}
                {status.requestedBy && <span className="text-muted-foreground"> · {status.requestedBy} 시작</span>}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden>
                <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${status.total > 0 ? percent : 15}%` }} />
              </div>
            </div>
          )}
          {status?.state === 'DONE' && status.outcome && (
            <p className="rounded-lg border bg-success-soft px-3 py-2 text-sm" role="status">
              추가 <strong>{status.outcome.result.created}</strong> · 갱신 <strong>{status.outcome.result.updated}</strong> · 건너뜀{' '}
              <strong>{status.outcome.result.skipped}</strong>
              {status.outcome.result.createdTags.length > 0 && ` · 새 태그: ${status.outcome.result.createdTags.join(', ')}`}
              <span className="mt-1 block text-xs text-muted-foreground">
                {status.outcome.repo}@{status.outcome.ref} · 커밋 {status.outcome.commitSha.slice(0, 7)} · 레포 문제 {status.outcome.problemsInRepo}개
                {status.fetchMs !== null && status.importMs !== null && ` · 받기 ${(status.fetchMs / 1000).toFixed(1)}초 · 넣기 ${(status.importMs / 1000).toFixed(1)}초`}
                {status.finishedAt && ` · ${formatKst(status.finishedAt)}`}
              </span>
            </p>
          )}
          {status?.state === 'FAILED' && status.error && (
            <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive" role="alert">
              실패: {status.error.message}
              <span className="mt-1 block text-xs text-muted-foreground">
                {status.step && `${status.step} 단계`}
                {status.finishedAt && ` · ${formatKst(status.finishedAt)}`} · 고친 뒤 다시 누르면 처음부터 다시 해요
              </span>
            </p>
          )}
        </section>

        {/* 2. 파일 - 보조 경로 */}
        <p className="text-center text-xs text-muted-foreground">또는 번들 파일로</p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center text-sm hover:border-primary hover:bg-secondary/50">
          <FileJson className="size-6 text-muted-foreground" aria-hidden />
          <span className="font-semibold">{fileName === '' ? '번들 JSON 파일 고르기' : fileName}</span>
          <span className="text-xs text-muted-foreground">bank.json 또는 {'{ "problems": [...] }'} 모양 · {IMPORT_CHUNK_SIZE}문제씩 나눠 보내요</span>
          <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>
        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        {items && !fileResult && (
          <p className="text-sm">
            문제 <strong>{items.length}개</strong> - 번호 {Math.min(...items.map((i) => i.problemNo))} ~ {Math.max(...items.map((i) => i.problemNo))}
            {' · '}테스트케이스 {items.reduce((n, i) => n + (i.testCases?.length ?? 0), 0)}개
            {chunkCount > 1 && ` · ${chunkCount}번에 나눠 보내요`}
          </p>
        )}
        {fileMutation.isPending && progress && (
          <p className="text-sm text-muted-foreground" role="status">
            묶음 {progress.chunk}/{progress.totalChunks} 보내는 중 · 문제 {progress.from}~{progress.to}
          </p>
        )}
        {fileError && (
          <div className="space-y-1 text-sm text-destructive">
            <p>
              {fileError instanceof ImportChunkError ? `문제 ${fileError.failedChunk.from}~${fileError.failedChunk.to} 묶음에서 실패: ` : ''}
              {fileError.message}
            </p>
            {savedBeforeFailure > 0 && (
              <p className="text-muted-foreground">앞의 {savedBeforeFailure}문제는 이미 저장됐어요. 같은 파일을 다시 올리면 번호가 같은 문제는 건너뛰고 이어서 진행돼요.</p>
            )}
          </div>
        )}
        {fileResult && (
          <p className="rounded-lg border bg-success-soft px-3 py-2 text-sm" role="status">
            추가 <strong>{fileResult.summary.created}</strong> · 갱신 <strong>{fileResult.summary.updated}</strong> · 건너뜀 <strong>{fileResult.summary.skipped}</strong>
            {fileResult.summary.createdTags.length > 0 && ` · 새 태그: ${fileResult.summary.createdTags.join(', ')}`}
            <span className="mt-1 block text-xs text-muted-foreground">{fileResult.from}</span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {fileResult || status?.state === 'DONE' ? '닫기' : '취소'}
          </Button>
          {!fileResult && (
            <Button variant="outline" onClick={importFile} disabled={!items || busy}>
              <Upload data-icon="inline-start" />
              {fileMutation.isPending ? '가져오는 중...' : items ? `파일 ${items.length}문제 가져오기` : '파일 가져오기'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
