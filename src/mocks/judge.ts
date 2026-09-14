// 자동 채점 mock 의 순수 로직 - BE judge 슬라이스 미러 (docs judge/design.md). HTTP 핸들러는 handlers.ts, 데이터는 data.ts
import type { JudgeConfigResponse, JudgeResultResponse, JudgeSamplesResponse, Verdict } from '@/api/types'
import { judgeResults, submissions, testCases, type MockAssignment, type MockJudgeCase, type MockJudgeResult, type MockSubmission, type MockTestCase } from './data'

/** BE application.yml ondal.judge.* 와 같은 값 */
export const JUDGE_DEFAULTS = { timeLimitMs: 2000, memoryLimitMb: 256, maxTimeLimitMs: 15000, maxMemoryLimitMb: 512, minTimeLimitMs: 100, minMemoryLimitMb: 16, maxTestCases: 50, maxRunInputs: 20 }
export const JUDGE_LANGUAGES = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript']

/** BE OutputComparator 미러 - \r\n → \n, 줄 끝 공백 제거, 마지막 빈 줄 제거 */
export function normalizeOutput(value: string | null | undefined): string {
  if (!value) return ''
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines.map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '')
}

export function casesOf(assignmentId: number): MockTestCase[] {
  return testCases.filter((t) => t.assignmentId === assignmentId).sort((a, b) => a.position - b.position)
}

export function isJudged(assignmentId: number): boolean {
  return testCases.some((t) => t.assignmentId === assignmentId)
}

export function limitsOf(a: MockAssignment) {
  return { timeLimitMs: a.timeLimitMs ?? JUDGE_DEFAULTS.timeLimitMs, memoryLimitMb: a.memoryLimitMb ?? JUDGE_DEFAULTS.memoryLimitMb }
}

export function resultOf(submissionId: number): MockJudgeResult | undefined {
  return judgeResults.find((r) => r.submissionId === submissionId)
}

// ---- 가짜 엔진 - BE FakeJudgeEngine 과 같은 규칙: 지시 주석 없으면 입력 echo ----------------------

export interface FakeRun {
  status: 'OK' | 'TIME_LIMIT' | 'MEMORY_LIMIT' | 'RUNTIME_ERROR' | 'ENGINE_ERROR'
  stdout: string
  stderr: string
  timeMs: number
  memoryKb: number
}

const DIRECTIVE = /judge:\s*(AC|WA|TLE|MLE|RE|CE|ERROR)(?:@(\d+))?/

/** `// judge: WA@1` 처럼 지시하면 그 케이스만 그 결과, `// judge: CE` 는 컴파일 에러, `// judge: ERROR` 는 엔진 장애 */
export function fakeRun(source: string, inputs: string[], limits: { timeLimitMs: number; memoryLimitMb: number }): { compileOutput: string | null; runs: FakeRun[] } | { engineError: string } {
  const m = DIRECTIVE.exec(source)
  const directive = m?.[1] ?? null
  const onlyIndex = m?.[2] === undefined ? null : Number(m[2])
  if (directive === 'ERROR') return { engineError: 'fake engine: 지시된 장애' }
  if (directive === 'CE') return { compileOutput: 'fake compile error: 지시된 컴파일 에러', runs: [] }
  const runs = inputs.map((input, i): FakeRun => {
    const applies = directive !== null && (onlyIndex === null || onlyIndex === i)
    switch (applies ? directive : 'AC') {
      case 'WA':
        return { status: 'OK', stdout: 'WRONG\n', stderr: '', timeMs: 5, memoryKb: 1024 }
      case 'TLE':
        return { status: 'TIME_LIMIT', stdout: '', stderr: '', timeMs: limits.timeLimitMs, memoryKb: 1024 }
      case 'MLE':
        return { status: 'MEMORY_LIMIT', stdout: '', stderr: '', timeMs: 5, memoryKb: limits.memoryLimitMb * 1024 }
      case 'RE':
        return { status: 'RUNTIME_ERROR', stdout: '', stderr: 'Segmentation fault', timeMs: 5, memoryKb: 1024 }
      default:
        return { status: 'OK', stdout: input, stderr: '', timeMs: 3, memoryKb: 1024 }
    }
  })
  return { compileOutput: null, runs }
}

/** BE JudgeService.verdictForRun 미러 - 기대 출력이 없으면 정상 종료는 null(판정 없음) */
export function runVerdict(run: FakeRun, expected: string | null): Verdict | null {
  switch (run.status) {
    case 'OK':
      return expected === null ? null : normalizeOutput(expected) === normalizeOutput(run.stdout) ? 'ACCEPTED' : 'WRONG_ANSWER'
    case 'TIME_LIMIT':
      return 'TIME_LIMIT'
    case 'MEMORY_LIMIT':
      return 'MEMORY_LIMIT'
    case 'RUNTIME_ERROR':
      return 'RUNTIME_ERROR'
    default:
      return 'JUDGE_ERROR'
  }
}

function upsertResult(next: MockJudgeResult) {
  const index = judgeResults.findIndex((r) => r.submissionId === next.submissionId)
  if (index === -1) judgeResults.push(next)
  else judgeResults[index] = next
}

/** 제출 1건을 지금 채점해 DONE/ERROR 로 저장 - BE JudgeAggregator 미러(첫 실패 = 대표 판정) */
export function judgeNow(submission: MockSubmission, assignment: MockAssignment) {
  const cases = casesOf(assignment.id)
  const pending = resultOf(submission.id)
  if (!pending || pending.status === 'DONE' || pending.status === 'ERROR') return
  const base = { submissionId: submission.id, assignmentId: assignment.id, judgedAt: new Date().toISOString() }
  const outcome = fakeRun(submission.codeText ?? '', cases.map((c) => c.input), limitsOf(assignment))
  if ('engineError' in outcome) {
    upsertResult({ ...base, status: 'ERROR', verdict: 'JUDGE_ERROR', passedCases: 0, totalCases: cases.length, maxTimeMs: null, maxMemoryKb: null, compileOutput: `채점 엔진 오류: ${outcome.engineError}`, cases: [] })
    return
  }
  if (outcome.compileOutput !== null) {
    upsertResult({ ...base, status: 'DONE', verdict: 'COMPILE_ERROR', passedCases: 0, totalCases: cases.length, maxTimeMs: null, maxMemoryKb: null, compileOutput: outcome.compileOutput, cases: [] })
    return
  }
  let overall: Verdict = 'ACCEPTED'
  let passed = 0
  let maxTime: number | null = null
  let maxMemory: number | null = null
  const caseResults: MockJudgeCase[] = cases.map((c, i) => {
    const run = outcome.runs[i]
    const verdict = runVerdict(run, c.expectedOutput) ?? 'JUDGE_ERROR'
    if (verdict === 'ACCEPTED') passed++
    else if (overall === 'ACCEPTED') overall = verdict
    maxTime = maxTime === null ? run.timeMs : Math.max(maxTime, run.timeMs)
    maxMemory = maxMemory === null ? run.memoryKb : Math.max(maxMemory, run.memoryKb)
    return { position: c.position, verdict, timeMs: run.timeMs, memoryKb: run.memoryKb, actualOutput: run.stdout.slice(0, 4096), truncated: run.stdout.length > 4096 }
  })
  upsertResult({ ...base, status: 'DONE', verdict: overall, passedCases: passed, totalCases: cases.length, maxTimeMs: maxTime, maxMemoryKb: maxMemory, compileOutput: null, cases: caseResults })
}

/** 제출·재채점 → PENDING 행 + 잠시 뒤 채점 (실 BE 의 비동기 워커 흉내 - 화면의 "채점 중" 이 보이도록 1.5초) */
export function enqueueJudge(submission: MockSubmission, assignment: MockAssignment, delayMs = 1500) {
  upsertResult({ submissionId: submission.id, assignmentId: assignment.id, status: 'PENDING', verdict: null, passedCases: 0, totalCases: 0, maxTimeMs: null, maxMemoryKb: null, compileOutput: null, cases: [], judgedAt: null })
  setTimeout(() => judgeNow(submission, assignment), delayMs)
}

/** 이 과제의 CODE 제출 전부 다시 채점 - 건수 반환 */
export function rejudgeAll(assignment: MockAssignment): number {
  const codes = submissions.filter((s) => s.assignmentId === assignment.id && s.type === 'CODE')
  for (const s of codes) enqueueJudge(s, assignment)
  return codes.length
}

export function toJudgeResultResponse(r: MockJudgeResult): JudgeResultResponse {
  const byPosition = new Map(casesOf(r.assignmentId).map((c) => [c.position, c]))
  return {
    status: r.status,
    verdict: r.verdict,
    passedCases: r.passedCases,
    totalCases: r.totalCases,
    maxTimeMs: r.maxTimeMs,
    maxMemoryKb: r.maxMemoryKb,
    compileOutput: r.compileOutput,
    judgedAt: r.judgedAt,
    cases: r.cases.map((c) => {
      const tc = byPosition.get(c.position)
      const isPublic = tc?.isPublic ?? false
      return {
        position: c.position,
        verdict: c.verdict,
        timeMs: c.timeMs,
        memoryKb: c.memoryKb,
        isPublic,
        input: isPublic ? (tc?.input ?? null) : null,
        expectedOutput: isPublic ? (tc?.expectedOutput ?? null) : null,
        actualOutput: isPublic ? c.actualOutput : null,
        truncated: isPublic && c.truncated,
      }
    }),
  }
}

export function judgeResponseFor(submissionId: number): JudgeResultResponse | null {
  const r = resultOf(submissionId)
  return r ? toJudgeResultResponse(r) : null
}

export function toJudgeConfigResponse(a: MockAssignment, queued: number): JudgeConfigResponse {
  const cases = casesOf(a.id)
  return {
    enabled: cases.length > 0,
    engineAvailable: true,
    ...limitsOf(a),
    defaultTimeLimitMs: JUDGE_DEFAULTS.timeLimitMs,
    defaultMemoryLimitMb: JUDGE_DEFAULTS.memoryLimitMb,
    maxTimeLimitMs: JUDGE_DEFAULTS.maxTimeLimitMs,
    maxMemoryLimitMb: JUDGE_DEFAULTS.maxMemoryLimitMb,
    maxTestCases: JUDGE_DEFAULTS.maxTestCases,
    languages: JUDGE_LANGUAGES,
    testCases: cases.map((c) => ({ id: c.id, position: c.position, input: c.input, expectedOutput: c.expectedOutput, isPublic: c.isPublic })),
    affectedSubmissions: submissions.filter((s) => s.assignmentId === a.id && s.type === 'CODE').length,
    rejudgeQueued: queued,
  }
}

export function toSamplesResponse(a: MockAssignment): JudgeSamplesResponse {
  const cases = casesOf(a.id)
  return {
    enabled: cases.length > 0,
    ...limitsOf(a),
    languages: JUDGE_LANGUAGES,
    samples: cases.filter((c) => c.isPublic).map((c) => ({ position: c.position, input: c.input, expectedOutput: c.expectedOutput })),
  }
}

/** 통째 교체 - BE 와 같이 기존 행 삭제 후 순서대로 재삽입(id 는 새로) */
export function replaceTestCases(a: MockAssignment, next: { input: string; expectedOutput: string; isPublic: boolean }[]) {
  for (let i = testCases.length - 1; i >= 0; i--) if (testCases[i].assignmentId === a.id) testCases.splice(i, 1)
  let id = Math.max(0, ...testCases.map((t) => t.id))
  next.forEach((c, position) => testCases.push({ id: ++id, assignmentId: a.id, position, input: c.input, expectedOutput: c.expectedOutput, isPublic: c.isPublic }))
}

/** 과제 삭제 연쇄 - judge_results → test_cases */
export function removeJudgeDataOf(assignmentId: number) {
  for (let i = judgeResults.length - 1; i >= 0; i--) if (judgeResults[i].assignmentId === assignmentId) judgeResults.splice(i, 1)
  for (let i = testCases.length - 1; i >= 0; i--) if (testCases[i].assignmentId === assignmentId) testCases.splice(i, 1)
}
