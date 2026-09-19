import { useState } from 'react'
import { FileJson, Upload } from 'lucide-react'
import { IMPORT_CHUNK_SIZE, ImportChunkError, useImportProblems, type ImportProgress } from '@/api/problemImport'
import type { ProblemImportItem, ProblemImportResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * [관리자] 문제 가져오기 - 문제 은행 레포(ondal-problems)가 만든 번들 JSON 파일을 골라 올린다.
 * 파일은 브라우저에서 읽어 미리 검사(문제 수·번호)한 뒤 IMPORT_CHUNK_SIZE 개씩 나눠 POST /api/problems/import 한다 -
 * 묶음 하나가 서버의 한 트랜잭션. 도중에 실패하면 앞 묶음은 남고, 같은 파일을 다시 올리면 번호가 같은 문제는 건너뛰어 이어진다.
 * 같은 번호가 있으면 기본은 건너뛰고, "덮어쓰기"를 켜면 본문·태그·테스트케이스까지 교체된다 (재채점은 하지 않음)
 */
export function ImportProblemsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importMutation = useImportProblems()
  const [items, setItems] = useState<ProblemImportItem[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ProblemImportResult | null>(null)

  const handleFile = async (file: File | undefined) => {
    setResult(null)
    setParseError(null)
    setItems(null)
    importMutation.reset()
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

  const submit = () => {
    if (!items) return
    setResult(null)
    importMutation.mutate(
      { problems: items, overwrite, onProgress: setProgress },
      { onSuccess: (r) => setResult(r), onSettled: () => setProgress(null) },
    )
  }

  const chunkCount = items ? Math.ceil(items.length / IMPORT_CHUNK_SIZE) : 0
  const error = importMutation.error
  const savedBeforeFailure = error instanceof ImportChunkError ? error.done.created + error.done.updated + error.done.skipped : 0

  return (
    <Dialog open={open} onOpenChange={(next) => !importMutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>문제 가져오기</DialogTitle>
          <DialogDescription>
            문제 은행 레포가 만든 번들(JSON)을 올려요. {IMPORT_CHUNK_SIZE}문제씩 나눠 보내고, 번호가 같은 문제는 건너뛰어요. 덮어쓰기를 켜면
            본문·태그·테스트케이스를 교체해요. 없는 태그는 새로 만들어요.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm hover:border-primary hover:bg-secondary/50">
          <FileJson className="size-6 text-muted-foreground" aria-hidden />
          <span className="font-semibold">{fileName === '' ? '번들 JSON 파일 고르기' : fileName}</span>
          <span className="text-xs text-muted-foreground">bank.json 또는 {'{ "problems": [...] }'} 모양</span>
          <input type="file" accept="application/json,.json" className="sr-only" disabled={importMutation.isPending} onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        {items && !result && (
          <div className="space-y-2 text-sm">
            <p>
              문제 <strong>{items.length}개</strong> - 번호 {Math.min(...items.map((i) => i.problemNo))} ~ {Math.max(...items.map((i) => i.problemNo))}
              {' · '}테스트케이스 {items.reduce((n, i) => n + (i.testCases?.length ?? 0), 0)}개
              {chunkCount > 1 && ` · ${chunkCount}번에 나눠 보내요`}
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={overwrite}
                disabled={importMutation.isPending}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="size-4 accent-primary"
              />
              같은 번호가 있으면 덮어쓰기 (본문·태그·제한·테스트케이스 교체, 재채점 없음)
            </label>
          </div>
        )}
        {importMutation.isPending && progress && (
          <p className="text-sm text-muted-foreground" role="status">
            묶음 {progress.chunk}/{progress.totalChunks} 보내는 중 · 문제 {progress.from}~{progress.to}
          </p>
        )}
        {error && (
          <div className="space-y-1 text-sm text-destructive">
            <p>
              {error instanceof ImportChunkError ? `문제 ${error.failedChunk.from}~${error.failedChunk.to} 묶음에서 실패: ` : ''}
              {error.message}
            </p>
            {savedBeforeFailure > 0 && (
              <p className="text-muted-foreground">
                앞의 {savedBeforeFailure}문제는 이미 저장됐어요. 같은 파일을 다시 올리면 번호가 같은 문제는 건너뛰고 이어서 진행돼요.
              </p>
            )}
          </div>
        )}
        {result && (
          <p className="rounded-lg border bg-success-soft px-3 py-2 text-sm">
            추가 <strong>{result.created}</strong> · 갱신 <strong>{result.updated}</strong> · 건너뜀 <strong>{result.skipped}</strong>
            {result.createdTags.length > 0 && ` · 새 태그: ${result.createdTags.join(', ')}`}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importMutation.isPending}>
            {result ? '닫기' : '취소'}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={!items || importMutation.isPending}>
              <Upload data-icon="inline-start" />
              {importMutation.isPending ? '가져오는 중...' : items ? `${items.length}문제 가져오기` : '가져오기'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
