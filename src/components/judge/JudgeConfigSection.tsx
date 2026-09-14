import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Gavel, Plus, Trash2, Wand2, XCircle } from 'lucide-react'
import { useRunJudge } from '@/api/judge'
import type { JudgeConfigPayload, JudgeConfigResponse, JudgeRunResponse, Verdict } from '@/api/types'
import { CodeEditor } from '@/components/code/CodePane'
import { VERDICT_META } from '@/components/judge/VerdictBadge'
import { SampleCases } from '@/components/judge/SampleCases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { cn } from '@/lib/utils'

// ---- 폼 상태 ---------------------------------------------------------------------------------

export interface TestCaseDraft {
  input: string
  expectedOutput: string
  isPublic: boolean
}

/** 과제 폼이 들고 있는 자동 채점 초안 - 숫자 입력은 문자열로 두고 저장 시 변환(빈 값 = 서버 기본값) */
export interface JudgeDraft {
  enabled: boolean
  timeLimitMs: string
  memoryLimitMb: string
  testCases: TestCaseDraft[]
}

/** 새 과제 - 서버 설정을 아직 못 받으므로 폼만 비운 채(제한은 서버 기본값 사용 = 빈 값) 시작 */
export function emptyDraft(): JudgeDraft {
  return { enabled: false, timeLimitMs: '', memoryLimitMb: '', testCases: [] }
}

export function draftFromConfig(config: JudgeConfigResponse): JudgeDraft {
  return {
    enabled: config.enabled,
    timeLimitMs: String(config.timeLimitMs),
    memoryLimitMb: String(config.memoryLimitMb),
    testCases: config.testCases.map((t) => ({ input: t.input, expectedOutput: t.expectedOutput, isPublic: t.isPublic })),
  }
}

export function draftEquals(a: JudgeDraft, b: JudgeDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 저장 본문 - 토글이 꺼져 있으면 케이스 0개(= 자동 채점 해제). 제한 빈 값은 null(서버 기본값) */
export function toPayload(draft: JudgeDraft, rejudge: boolean): JudgeConfigPayload {
  return {
    timeLimitMs: draft.timeLimitMs.trim() === '' ? null : Number(draft.timeLimitMs),
    memoryLimitMb: draft.memoryLimitMb.trim() === '' ? null : Number(draft.memoryLimitMb),
    testCases: draft.enabled ? draft.testCases : [],
    rejudge,
  }
}

const LANGUAGE_FALLBACK = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript']
const TEXTAREA_CLASS =
  'w-full resize-y rounded-[2px] border bg-background px-2 py-1.5 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring'

type RunMark = { verdict: Verdict | null; stdout: string; timeMs: number | null; memoryKb: number | null }

/**
 * 출제 섹션 - 과제 폼 아래 "자동 채점" (docs judge/fe.md 1절).
 * - 표 하나로 끝: 입력 · 기대 출력 · 공개 · 삭제. 행 추가는 버튼
 * - 정답 코드 상자: "기대 출력 채우기"(#49, expectedOutputs 없이 → stdout 을 빈 칸에) / "출제 검증"(#49, 기대 출력과 비교 → 행별 ✅/❌)
 * - 정답 코드는 저장하지 않는다(서버에 열 없음) - 세션 초안으로만 보존
 * - 새 과제(assignmentId null)는 실행 API 경로가 없어 두 버튼 비활성 - 등록 뒤 수정 화면에서 사용
 * - 값은 서버가 준 기본값·상한·지원 언어(config)를 그대로 표시, 없으면(새 과제) 최소 안내만
 */
export function JudgeConfigSection({
  cohortId,
  assignmentId,
  config,
  draft,
  onChange,
  disabled,
}: {
  cohortId: number
  assignmentId: number | null
  config: JudgeConfigResponse | null
  draft: JudgeDraft
  onChange: (next: JudgeDraft) => void
  disabled: boolean
}) {
  const answerKey = `ondal-judge-answer-draft:${cohortId}:${assignmentId ?? 'new'}`
  const [answer, setAnswer] = useState(() => readDraft<{ language: string; code: string }>(answerKey) ?? { language: '', code: '' })
  const [marks, setMarks] = useState<Record<number, RunMark>>({})
  const [runNote, setRunNote] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const runMutation = useRunJudge(cohortId, assignmentId ?? NaN)

  useEffect(() => {
    if (answer.code === '' && answer.language === '') clearDraft(answerKey)
    else writeDraft(answerKey, answer)
  }, [answer, answerKey])

  const languages = config?.languages ?? LANGUAGE_FALLBACK
  const maxCases = config?.maxTestCases ?? 50
  const canRun = assignmentId !== null && !disabled && answer.language !== '' && answer.code.trim() !== '' && draft.testCases.length > 0 && !runMutation.isPending

  const update = (patch: Partial<JudgeDraft>) => onChange({ ...draft, ...patch })
  const updateCase = (index: number, patch: Partial<TestCaseDraft>) =>
    update({ testCases: draft.testCases.map((c, i) => (i === index ? { ...c, ...patch } : c)) })
  const addCase = () => {
    if (draft.testCases.length >= maxCases) return
    // 첫 케이스는 공개가 기본(design.md 결정 10) - 학생 화면의 예시가 된다
    update({ testCases: [...draft.testCases, { input: '', expectedOutput: '', isPublic: draft.testCases.length === 0 }] })
  }
  const removeCase = (index: number) => {
    update({ testCases: draft.testCases.filter((_, i) => i !== index) })
    setMarks({})
  }

  const toggle = (enabled: boolean) => {
    if (enabled && draft.testCases.length === 0) {
      update({ enabled, testCases: [{ input: '', expectedOutput: '', isPublic: true }] })
      return
    }
    update({ enabled })
  }

  const limits = () => ({
    timeLimitMs: draft.timeLimitMs.trim() === '' ? null : Number(draft.timeLimitMs),
    memoryLimitMb: draft.memoryLimitMb.trim() === '' ? null : Number(draft.memoryLimitMb),
  })

  const applyRun = (result: JudgeRunResponse, verifying: boolean) => {
    if (result.compileOutput !== null) {
      setMarks({})
      setRunNote(`컴파일 에러:\n${result.compileOutput}`)
      return
    }
    const next: Record<number, RunMark> = {}
    for (const run of result.runs) next[run.index] = { verdict: run.verdict, stdout: run.stdout, timeMs: run.timeMs, memoryKb: run.memoryKb }
    setMarks(next)
    if (verifying) {
      const failed = result.runs.filter((r) => r.verdict !== 'ACCEPTED').length
      setRunNote(failed === 0 ? `출제 검증 통과 - 정답 코드가 ${result.runs.length}개 케이스를 모두 통과했어요.` : `케이스 ${failed}개가 정답 코드와 다르게 나왔어요. 기대 출력이나 코드를 확인해 주세요.`)
    } else {
      const failedRuns = result.runs.filter((r) => r.verdict !== null)
      setRunNote(
        failedRuns.length === 0
          ? `기대 출력을 채웠어요. 내용을 확인하고 저장하세요.`
          : `${failedRuns.length}개 케이스에서 정답 코드가 정상 종료하지 않아 기대 출력을 채우지 못했어요(${failedRuns.map((r) => VERDICT_META[r.verdict as Verdict].label).join(', ')}).`,
      )
    }
  }

  const fillExpected = () => {
    const filled = draft.testCases.filter((c) => c.expectedOutput.trim() !== '').length
    const overwrite = filled > 0 && window.confirm(`이미 기대 출력이 있는 케이스 ${filled}개도 정답 코드의 출력으로 덮어쓸까요? "취소"하면 빈 칸만 채워요.`)
    runMutation.mutate(
      { language: answer.language, sourceCode: answer.code, inputs: draft.testCases.map((c) => c.input), expectedOutputs: null, ...limits() },
      {
        onSuccess: (result) => {
          applyRun(result, false)
          if (result.compileOutput !== null) return
          update({
            testCases: draft.testCases.map((c, i) => {
              const run = result.runs[i]
              if (!run || run.verdict !== null) return c   // 실행 실패(TLE 등)는 채우지 않음
              if (c.expectedOutput.trim() !== '' && !overwrite) return c
              return { ...c, expectedOutput: run.stdout }
            }),
          })
        },
        onError: (e) => setRunNote((e as Error).message),
      },
    )
  }

  const verify = () => {
    runMutation.mutate(
      {
        language: answer.language,
        sourceCode: answer.code,
        inputs: draft.testCases.map((c) => c.input),
        expectedOutputs: draft.testCases.map((c) => c.expectedOutput),
        ...limits(),
      },
      { onSuccess: (result) => applyRun(result, true), onError: (e) => setRunNote((e as Error).message) },
    )
  }

  return (
    <section aria-label="자동 채점" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => toggle(e.target.checked)}
            disabled={disabled}
            aria-label="자동 채점 사용"
            className="size-4"
          />
          <Gavel className="size-4 text-primary" />
          자동 채점
        </label>
        <p className="text-xs text-muted-foreground">
          {draft.enabled
            ? '테스트케이스가 1개 이상이면 코드 제출이 자동으로 채점돼요. 점수는 없고 판정만 나옵니다.'
            : '켜면 테스트케이스 표가 열려요. 끄면 제출만 받는 과제로 저장됩니다.'}
        </p>
      </div>

      {draft.enabled && (
        <div className="space-y-5 p-4">
          {config && !config.engineAvailable && (
            <p className="rounded-[2px] border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground">
              채점 엔진이 아직 연결되지 않았어요. 테스트케이스 저장은 되지만 제출은 "채점 중"으로 대기하고, 기대 출력 채우기·출제 검증은 엔진 연결 뒤에 쓸 수 있어요.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="judge-time-limit">시간 제한 (ms)</Label>
              <Input
                id="judge-time-limit"
                type="number"
                min={100}
                max={config?.maxTimeLimitMs ?? undefined}
                step={100}
                value={draft.timeLimitMs}
                onChange={(e) => update({ timeLimitMs: e.target.value })}
                disabled={disabled}
                placeholder={config ? `비우면 기본 ${config.defaultTimeLimitMs}` : '비우면 서버 기본값'}
              />
              <p className="text-xs text-muted-foreground">
                {config ? `기본 ${config.defaultTimeLimitMs}ms, 최대 ${config.maxTimeLimitMs}ms. ` : ''}Java·Python 문제는 넉넉히 주세요.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="judge-memory-limit">메모리 제한 (MB)</Label>
              <Input
                id="judge-memory-limit"
                type="number"
                min={16}
                max={config?.maxMemoryLimitMb ?? undefined}
                step={16}
                value={draft.memoryLimitMb}
                onChange={(e) => update({ memoryLimitMb: e.target.value })}
                disabled={disabled}
                placeholder={config ? `비우면 기본 ${config.defaultMemoryLimitMb}` : '비우면 서버 기본값'}
              />
              {config && <p className="text-xs text-muted-foreground">기본 {config.defaultMemoryLimitMb}MB, 최대 {config.maxMemoryLimitMb}MB</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">
                테스트케이스 <span className="font-mono">{draft.testCases.length}/{maxCases}</span>
              </h3>
              <p className="text-xs text-muted-foreground">공개 케이스는 학생에게 예시로 보이고, 채점 결과에서 실제 출력까지 보여요.</p>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-10 py-1.5 font-semibold">#</th>
                  <th scope="col" className="py-1.5 font-semibold">입력</th>
                  <th scope="col" className="py-1.5 font-semibold">기대 출력</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">공개</th>
                  <th scope="col" className="w-24 py-1.5 text-center font-semibold">검증</th>
                  <th scope="col" className="w-10 py-1.5"><span className="sr-only">삭제</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {draft.testCases.map((c, index) => {
                  const mark = marks[index]
                  return (
                    <tr key={index} data-case-index={index} className="align-top">
                      <td className="py-2 font-mono text-xs text-muted-foreground">{index + 1}</td>
                      <td className="py-2 pr-2">
                        <textarea
                          value={c.input}
                          onChange={(e) => updateCase(index, { input: e.target.value })}
                          rows={2}
                          disabled={disabled}
                          aria-label={`케이스 ${index + 1} 입력`}
                          placeholder="표준 입력 (줄바꿈 그대로)"
                          className={TEXTAREA_CLASS}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <textarea
                          value={c.expectedOutput}
                          onChange={(e) => updateCase(index, { expectedOutput: e.target.value })}
                          rows={2}
                          disabled={disabled}
                          aria-label={`케이스 ${index + 1} 기대 출력`}
                          placeholder="비워 두고 아래 정답 코드로 채울 수 있어요"
                          className={TEXTAREA_CLASS}
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={c.isPublic}
                          onChange={(e) => updateCase(index, { isPublic: e.target.checked })}
                          disabled={disabled}
                          aria-label={`케이스 ${index + 1} 공개`}
                          className="mt-2 size-4"
                        />
                      </td>
                      <td className="py-2 text-center text-xs">
                        {mark && mark.verdict !== null && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 font-bold',
                              mark.verdict === 'ACCEPTED' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]',
                            )}
                            aria-label={`케이스 ${index + 1} 검증 ${VERDICT_META[mark.verdict].label}`}
                          >
                            {mark.verdict === 'ACCEPTED' ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                            {VERDICT_META[mark.verdict].label}
                          </span>
                        )}
                        {mark && mark.verdict === null && <span className="text-muted-foreground">출력 채움</span>}
                        {mark && mark.timeMs !== null && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{mark.timeMs} ms</p>}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeCase(index)}
                          disabled={disabled}
                          aria-label={`케이스 ${index + 1} 삭제`}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Button type="button" variant="outline" size="sm" className="mt-2 rounded-[2px]" onClick={addCase} disabled={disabled || draft.testCases.length >= maxCases}>
              <Plus data-icon="inline-start" />
              케이스 추가
            </Button>
          </div>

          <div className="rounded-[2px] border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-[0.55px] text-muted-foreground">
                <Wand2 className="size-3.5" />
                정답 코드로 채우기·검증
              </h3>
              <select
                value={answer.language}
                onChange={(e) => setAnswer({ ...answer, language: e.target.value })}
                disabled={disabled}
                aria-label="정답 코드 언어"
                className="h-8 rounded-[2px] border bg-card px-2 text-sm"
              >
                <option value="">언어 선택</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              정답 코드를 붙여 넣으면 입력마다 실행해 기대 출력을 채우거나, 표의 기대 출력과 맞는지 검증할 수 있어요. 정답 코드는 저장되지 않아요.
              {assignmentId === null && ' 새 과제는 등록한 뒤 수정 화면에서 실행할 수 있어요.'}
            </p>
            <div className="mt-2">
              <CodeEditor value={answer.code} onChange={(code) => setAnswer({ ...answer, code })} language={answer.language === '' ? null : answer.language} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-[2px]" onClick={fillExpected} disabled={!canRun}>
                {runMutation.isPending ? '실행 중...' : '기대 출력 채우기'}
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-[2px]" onClick={verify} disabled={!canRun}>
                출제 검증
              </Button>
              {runNote && <p className="text-xs whitespace-pre-wrap text-muted-foreground" role="status">{runNote}</p>}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              aria-expanded={previewOpen}
              className="flex items-center gap-1 text-xs font-bold tracking-[0.55px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn('size-3.5 transition-transform', previewOpen && 'rotate-180')} />
              학생에게 보이는 예시 미리보기 ({draft.testCases.filter((c) => c.isPublic).length}개)
            </button>
            {previewOpen && (
              <div className="mt-2">
                <SampleCases
                  samples={draft.testCases.map((c, i) => ({ position: i, ...c })).filter((c) => c.isPublic)}
                  emptyText="공개 케이스가 없어요. 첫 케이스를 공개하면 학생에게 예시로 보여요."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
