import { useState } from 'react'
import { FileJson, GitBranch, Upload } from 'lucide-react'
import { IMPORT_CHUNK_SIZE, ImportChunkError, useImportFromGithub, useImportProblems, useProblemBankSource, type ImportProgress } from '@/api/problemImport'
import type { ProblemImportItem, ProblemImportResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * [관리자] 문제 가져오기 - 두 경로.
 * 1. 깃허브에서 가져오기(기본): 서버가 문제 은행 레포(ondal-problems) 의 브랜치를 직접 받아 problems/* 를 읽는다 - 로컬 빌드·파일 선택 없음.
 *    서버에 레포 토큰이 없으면(configured=false) 안내만 하고 아래 파일 경로를 쓴다.
 * 2. 번들 파일(보조): 레포의 tools/build.py 산출물(bank.json)을 골라 IMPORT_CHUNK_SIZE 개씩 나눠 POST /api/problems/import.
 * 둘 다 규칙은 같다 - 번호가 키, 같은 번호는 기본 건너뛰고 "덮어쓰기"를 켜면 본문·태그·제한·테스트케이스 교체(재채점 없음).
 */
export function ImportProblemsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sourceQuery = useProblemBankSource(open)
  const githubMutation = useImportFromGithub()
  const fileMutation = useImportProblems()
  const [items, setItems] = useState<ProblemImportItem[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<{ from: string; summary: ProblemImportResult } | null>(null)

  const busy = githubMutation.isPending || fileMutation.isPending
  const source = sourceQuery.data

  const importFromGithub = () => {
    setResult(null)
    fileMutation.reset()
    githubMutation.mutate(overwrite, {
      onSuccess: (r) => setResult({ from: `${r.repo}@${r.ref} · 커밋 ${r.commitSha.slice(0, 7)} · 레포 문제 ${r.problemsInRepo}개`, summary: r.result }),
    })
  }

  const handleFile = async (file: File | undefined) => {
    setResult(null)
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
    setResult(null)
    githubMutation.reset()
    fileMutation.mutate(
      { problems: items, overwrite, onProgress: setProgress },
      { onSuccess: (r) => setResult({ from: fileName, summary: r }), onSettled: () => setProgress(null) },
    )
  }

  const chunkCount = items ? Math.ceil(items.length / IMPORT_CHUNK_SIZE) : 0
  const fileError = fileMutation.error
  const savedBeforeFailure = fileError instanceof ImportChunkError ? fileError.done.created + fileError.done.updated + fileError.done.skipped : 0

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
            <Button size="sm" onClick={importFromGithub} disabled={busy || !source?.configured}>
              {githubMutation.isPending ? '레포에서 받는 중...' : `${source?.ref ?? 'main'} 가져오기`}
            </Button>
          </div>
          {sourceQuery.isPending && <p className="text-xs text-muted-foreground">레포 설정을 확인하는 중...</p>}
          {sourceQuery.error && <p className="text-xs text-destructive">레포 설정을 읽지 못했어요: {sourceQuery.error.message}</p>}
          {source && !source.configured && (
            <p className="text-xs text-muted-foreground">서버에 레포 읽기 토큰이 없어요 (.env PROBLEM_BANK_GITHUB_TOKEN). 아래 파일로 가져올 수 있어요.</p>
          )}
          {source?.configured && !githubMutation.isPending && (
            <p className="text-xs text-muted-foreground">서버가 레포의 problems/ 폴더를 읽어 넣어요. 머지된 최신 내용이 기준이라 로컬 빌드가 필요 없어요.</p>
          )}
          {githubMutation.error && <p className="text-xs text-destructive">{githubMutation.error.message}</p>}
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
        {items && !result && (
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

        {result && (
          <p className="rounded-lg border bg-success-soft px-3 py-2 text-sm" role="status">
            추가 <strong>{result.summary.created}</strong> · 갱신 <strong>{result.summary.updated}</strong> · 건너뜀 <strong>{result.summary.skipped}</strong>
            {result.summary.createdTags.length > 0 && ` · 새 태그: ${result.summary.createdTags.join(', ')}`}
            <span className="mt-1 block text-xs text-muted-foreground">{result.from}</span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {result ? '닫기' : '취소'}
          </Button>
          {!result && (
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
