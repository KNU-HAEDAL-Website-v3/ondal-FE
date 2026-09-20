import { useEffect, useState } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useRunProblem } from '@/api/problems'
import type { JudgeRunResponse } from '@/api/types'
import { VERDICT_META } from '@/components/judge/VerdictBadge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border bg-background px-2 py-1.5 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * "내 입력으로 실행" (HOJ P3, docs hoj/api.md 8절) - 제출 전에 내가 넣은 입력으로 돌려 본다. 저장·채점 없음.
 * 입력 칸은 공개 예시 1의 입력으로 미리 채운다. 결과는 stdout·stderr·시간·메모리, 컴파일 에러면 그 메시지.
 * 한도(분당 10회, 429)·엔진 미연결(503)은 안내 문구로. 접혀 있다가 펼쳐 쓴다 - 편집기 아래 세로 공간을 아끼기 위해.
 */
export function RunPanel({ problemId, language, sourceCode, sampleInput }: { problemId: number; language: string; sourceCode: string; sampleInput: string | null }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<JudgeRunResponse | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const runMutation = useRunProblem(problemId)

  // 예시 입력이 도착하면 아직 손대지 않은 입력 칸을 채운다
  useEffect(() => {
    if (!touched && sampleInput !== null) setInput(sampleInput)
  }, [sampleInput, touched])

  const canRun = language !== '' && sourceCode.trim() !== '' && !runMutation.isPending
  const run = () => {
    if (!canRun) return
    setNote(null)
    runMutation.mutate(
      { language, sourceCode, inputs: [input] },
      {
        onSuccess: (data) => setResult(data),
        onError: (e) => {
          setResult(null)
          if (e instanceof ApiError && e.is('TOO_MANY_REQUESTS')) setNote('실행은 1분에 10회까지예요. 잠시 뒤 다시 시도해 주세요.')
          else if (e instanceof ApiError && e.is('JUDGE_UNAVAILABLE')) setNote('채점 엔진이 아직 연결되지 않았어요. 제출은 되지만 실행은 엔진 연결 뒤에 쓸 수 있어요.')
          else setNote(e.message)
        },
      },
    )
  }
  const first = result?.runs[0] ?? null

  return (
    <div className="rounded-lg border bg-muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold tracking-[0.55px] text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Play className="size-3.5" aria-hidden />
          내 입력으로 실행
        </span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-3">
          <p className="text-xs text-muted-foreground">제출 전에 위 코드를 이 입력으로 한 번 돌려 봐요. 채점·기록 없이 출력만 보여 주고, 1분에 10회까지예요.</p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">입력 (표준 입력)</span>
            <textarea
              value={input}
              onChange={(e) => {
                setTouched(true)
                setInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  run()
                }
              }}
              rows={3}
              maxLength={10000}
              placeholder="여기 입력이 표준 입력으로 들어가요"
              className={TEXTAREA_CLASS}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={run} disabled={!canRun}>
              <Play data-icon="inline-start" />
              {runMutation.isPending ? '실행 중...' : '실행'}
            </Button>
            {language === '' && <span className="text-xs text-muted-foreground">언어를 먼저 고르세요</span>}
            {language !== '' && sourceCode.trim() === '' && <span className="text-xs text-muted-foreground">코드를 먼저 작성하세요</span>}
            {note && (
              <p className="text-xs text-destructive" role="alert">
                {note}
              </p>
            )}
          </div>
          {result && (
            <div className="space-y-2" aria-live="polite">
              {result.compileOutput !== null ? (
                <div>
                  <p className="text-xs font-semibold text-danger">컴파일 에러</p>
                  <pre className="mt-0.5 overflow-auto rounded-lg border bg-card p-2 font-mono text-xs leading-5 whitespace-pre-wrap text-danger">{result.compileOutput}</pre>
                </div>
              ) : first ? (
                <>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">출력 (stdout)</p>
                      <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        {first.verdict !== null && first.verdict !== 'ACCEPTED' && (
                          <span className={cn('rounded-md px-1.5 py-0.5 font-sans font-bold', VERDICT_META[first.verdict].className)}>{VERDICT_META[first.verdict].label}</span>
                        )}
                        {first.timeMs !== null && `${first.timeMs} ms`}
                        {first.memoryKb !== null && ` · ${first.memoryKb} KB`}
                      </span>
                    </div>
                    <pre className="mt-0.5 min-h-10 overflow-auto rounded-lg border bg-card p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
                      {first.stdout === '' ? <span className="text-muted-foreground">(출력 없음)</span> : first.stdout}
                    </pre>
                  </div>
                  {first.stderr !== '' && (
                    <div>
                      <p className="text-xs font-semibold text-danger">stderr</p>
                      <pre className="mt-0.5 overflow-auto rounded-lg border bg-card p-2 font-mono text-xs leading-5 whitespace-pre-wrap text-danger">{first.stderr}</pre>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
