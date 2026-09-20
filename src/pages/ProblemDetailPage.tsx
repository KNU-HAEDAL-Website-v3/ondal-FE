import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, KeyRound, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useJudgeSamples } from '@/api/judge'
import {
  useMyPracticeSubmissions,
  usePracticeSubmission,
  useProblem,
  useDeleteProblem,
  useSubmitPractice,
} from '@/api/problems'
import type { SubmissionSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeEditor, CodeViewer } from '@/components/code/CodePane'
import { FullscreenPane } from '@/components/code/FullscreenPane'
import { JudgeResultView } from '@/components/judge/JudgeResultView'
import { JudgeSamplesSection } from '@/components/judge/JudgeSamplesSection'
import { VerdictBadge } from '@/components/judge/VerdictBadge'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MarkdownView } from '@/components/MarkdownView'
import { AcceptedSolutionsSection } from '@/components/problems/AcceptedSolutionsSection'
import { BookmarkButton } from '@/components/problems/BookmarkButton'
import { DifficultyBadge } from '@/components/problems/DifficultyBadge'
import { MyStatusBadge } from '@/components/problems/MyStatusBadge'
import { RunPanel } from '@/components/problems/RunPanel'
import { SolutionsDialog } from '@/components/problems/SolutionsDialog'
import { codeTemplate, isUntouched } from '@/lib/codeTemplates'
import { selectableLanguages } from '@/lib/languages'
import { formatKst } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseId } from '@/lib/params'


const DRAFT_PREFIX = 'ondal-practice-draft'
const draftKey = (problemId: number) => `${DRAFT_PREFIX}:${problemId}`

interface PracticeDraft {
  codeText: string
  language: string
}

/** 마지막으로 제출 언어로 고른 것 - 문제를 옮겨 다녀도 같은 언어로 시작하게 (P3). 이 브라우저에만 */
const LAST_LANGUAGE_KEY = 'ondal-hoj-last-language'
function readLastLanguage(): string {
  try {
    return localStorage.getItem(LAST_LANGUAGE_KEY) ?? ''
  } catch {
    return ''
  }
}
function writeLastLanguage(language: string) {
  try {
    if (language === '') localStorage.removeItem(LAST_LANGUAGE_KEY)
    else localStorage.setItem(LAST_LANGUAGE_KEY, language)
  } catch {
    // 저장소를 못 쓰는 환경 - 기억 못 해도 동작에는 지장 없다
  }
}

/**
 * HOJ 문제 상세 - 문제를 읽고 바로 풀어 채점받는 화면 (/problems/:problemId, V7).
 *
 * 분반 과제와 같은 채점 파이프라인을 쓰지만 마감·지각·운영진 코멘트가 없다(연습 제출).
 * 작성 중인 코드는 세션 만료에 대비해 임시 저장한다 (CLAUDE.md 규칙 1).
 * P3(docs hoj/api.md 10절): 북마크 · 통계(푼 사람·제출·정답률) · 언어별 코드 템플릿 · 마지막 언어 기억 · Ctrl+Enter 제출 ·
 * "내 입력으로 실행" · 내 기록의 "다시 편집" · "다른 사람 풀이"(맞힌 사람·운영진) · 운영진 "정답 코드 보기".
 */
export default function ProblemDetailPage() {
  const { problemId: problemParam } = useParams()
  const problemId = parseId(problemParam)
  const navigate = useNavigate()

  const problemQuery = useProblem(problemId)
  const mineQuery = useMyPracticeSubmissions(problemId)
  const submitMutation = useSubmitPractice(problemId)
  const deleteMutation = useDeleteProblem()
  const samplesQuery = useJudgeSamples(problemId, problemQuery.data?.judgeEnabled === true)

  const key = draftKey(problemId)
  const saved = readDraft<PracticeDraft>(key)
  const [codeText, setCodeText] = useState(saved?.codeText ?? '')
  const [language, setLanguage] = useState(saved?.language ?? '')
  const [openId, setOpenId] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const initializedRef = useRef(false)
  const editorRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // 코드가 비어 있으면 저장할 게 없다 - 언어만 남기면 제출 성공 뒤에도 임시 저장본이 되살아난다
    if (codeText.trim() === '') clearDraft(key)
    else writeDraft<PracticeDraft>(key, { codeText, language })
  }, [key, codeText, language])

  // 임시 저장본이 없으면 마지막에 쓴 언어로 시작한다 - 이 문제의 허용 언어에 있을 때만. 편집기가 비어 있으면 그 언어의 뼈대까지
  useEffect(() => {
    const problem = problemQuery.data
    if (!problem || initializedRef.current) return
    initializedRef.current = true
    if (language !== '') return
    const last = readLastLanguage()
    if (last === '' || !selectableLanguages(problem.allowedLanguages).includes(last)) return
    setLanguage(last)
    if (isUntouched(codeText)) setCodeText(codeTemplate(last))
  }, [problemQuery.data, language, codeText])

  if (!Number.isFinite(problemId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 문제 주소예요.')} />
  }
  if (problemQuery.isPending) return <LoadingScreen label="문제 불러오는 중..." />
  if (problemQuery.error) return <ApiErrorView error={problemQuery.error} onRetry={() => void problemQuery.refetch()} />

  const problem = problemQuery.data
  const languages = selectableLanguages(problem.allowedLanguages)
  const canSubmit = problem.judgeEnabled && !submitMutation.isPending && codeText.trim() !== '' && language !== ''

  const handleSubmit = () => {
    if (!canSubmit) return
    writeLastLanguage(language)
    submitMutation.mutate(
      { codeText, language },
      {
        onSuccess: (created) => {
          // 성공했을 때만 비운다 - 실패하면 코드가 그대로 남아야 한다 (규칙 1)
          clearDraft(key)
          setCodeText('')
          setOpenId(created.id)
        },
      },
    )
  }

  /** 언어를 고르면 기억하고, 편집기가 비어 있거나 손대지 않은 뼈대뿐이면 그 언어의 뼈대로 갈아 끼운다 */
  const handleLanguageChange = (next: string) => {
    setLanguage(next)
    writeLastLanguage(next)
    if (isUntouched(codeText)) setCodeText(next === '' ? '' : codeTemplate(next))
  }

  /** 내 기록의 "다시 편집" - 그 제출의 코드·언어를 편집기로. 작성 중인 내용이 있으면 확인을 받는다 (규칙 1) */
  const handleEditAgain = (code: string, lang: string | null) => {
    if (!isUntouched(codeText) && codeText !== code && !window.confirm('작성 중인 코드를 이 제출의 코드로 바꿀까요? 지금 편집기의 내용은 사라져요.')) return
    setCodeText(code)
    if (lang !== null && languages.includes(lang)) {
      setLanguage(lang)
      writeLastLanguage(lang)
    }
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDelete = () => {
    if (!window.confirm(`#${problem.problemNo} ${problem.title} 문제를 삭제할까요? 되돌릴 수 없어요.`)) return
    deleteMutation.mutate(problem.id, { onSuccess: () => navigate('/problems', { replace: true }) })
  }

  const handleReset = () => {
    if (codeText === '' || window.confirm('작성한 코드를 모두 지울까요? 임시 저장본도 함께 지워져요.')) setCodeText('')
  }

  // 원안(수강자 코드 과제 상세): 좌 문제 / 우 편집기. 채점 기준이 없는 문제는 편집기가 없으므로 위아래로
  const split = problem.judgeEnabled
  const sampleInput = samplesQuery.data ? (samplesQuery.data.samples[0]?.input ?? '') : null
  // 다른 사람 풀이는 맞힌 사람·운영진 이상만 (결정 13). canEdit = 운영진 이상(@OperatorAnywhere)과 같은 판정
  const canSeeSolutions = problem.myStatus === 'SOLVED' || problem.canEdit

  const statement = (
    <section aria-label="문제 본문" className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">난이도</span>
        <DifficultyBadge value={problem.difficulty} />
        {problem.allowedLanguages.length > 0 && (
          <span className="rounded-md bg-info-bg px-1.5 py-0.5 font-semibold text-info">{problem.allowedLanguages.join(' · ')} 전용 문제</span>
        )}
      </div>
      {problem.description ? (
        <MarkdownView source={problem.description} />
      ) : (
        <p className="text-sm text-muted-foreground">문제 본문이 아직 없어요.</p>
      )}
    </section>
  )

  const languageSelect = (
    <select
      value={language}
      onChange={(e) => handleLanguageChange(e.target.value)}
      aria-label="제출 언어"
      className="h-8 rounded-lg border bg-card px-2 text-sm"
    >
      <option value="">언어 선택 (필수)</option>
      {languages.map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
  )

  const editor = (
    <CodeEditor
      value={codeText}
      onChange={setCodeText}
      language={language === '' ? null : language}
      height={fullscreen ? 'calc(100svh - 11rem)' : split ? 'clamp(320px, 52svh, 640px)' : undefined}
      onReset={handleReset}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
      onSubmit={handleSubmit}
    />
  )

  const actionRow = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        연습 제출이에요 - 분반 과제와 따로 기록되고, 마감·지각은 없어요. 여러 번 내도 괜찮아요.
      </p>
      <Button onClick={handleSubmit} disabled={!canSubmit} title="Ctrl+Enter (Mac: Cmd+Enter)">
        <Send data-icon="inline-start" />
        {submitMutation.isPending ? '제출 중...' : '제출하기'}
        <kbd className="ml-1 hidden rounded-md border border-primary-foreground/40 px-1 font-mono text-[10px] font-normal sm:inline">Ctrl+Enter</kbd>
      </Button>
    </div>
  )

  const submitPanel = (
    <section ref={editorRef} aria-label="풀이 제출" className="scroll-mt-20 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">풀이 제출</h2>
        {languageSelect}
      </div>
      {problem.allowedLanguages.length > 0 && (
        <p className="text-xs text-muted-foreground">이 문제는 {problem.allowedLanguages.join(', ')} 로만 제출할 수 있어요.</p>
      )}

      {problem.judgeEnabled ? (
        <>
          {!fullscreen && editor}
          <FullscreenPane open={fullscreen} title={`#${problem.problemNo} ${problem.title} - 전체 화면`} onClose={() => setFullscreen(false)}>
            <div className="flex items-center justify-end">{languageSelect}</div>
            {editor}
            {actionRow}
            {submitMutation.error && <p className="text-sm text-destructive">{(submitMutation.error as Error).message}</p>}
          </FullscreenPane>
          {!fullscreen && <RunPanel problemId={problem.id} language={language} sourceCode={codeText} sampleInput={sampleInput} />}
          {!fullscreen && actionRow}
          {submitMutation.error && !fullscreen && <p className="text-sm text-destructive">{(submitMutation.error as Error).message}</p>}
        </>
      ) : (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
          아직 채점 기준(테스트케이스)이 없는 문제예요. 운영진이 등록하면 풀 수 있어요.
        </p>
      )}
    </section>
  )

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/problems">
          <ArrowLeft data-icon="inline-start" />
          HOJ 목록으로
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-2.5">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="font-mono text-primary">#{problem.problemNo}</span>
            {problem.title}
            <MyStatusBadge status={problem.myStatus} />
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {problem.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
            <span className="font-mono">
              시간 {problem.timeLimitMs} ms · 메모리 {problem.memoryLimitMb} MB
            </span>
            {/* P3 통계 - 서버 값 그대로 (정답률은 채점 0건이면 null) */}
            <span>
              푼 사람 {problem.solvedUserCount}명 · 제출 {problem.submissionCount}건 · 정답률 {problem.acceptedRate === null ? '-' : `${problem.acceptedRate}%`}
            </span>
            {problem.assignedCount > 0 && <span>과제로 {problem.assignedCount}회 출제됨</span>}
            {problem.createdBy && <span>출제 {problem.createdBy}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BookmarkButton problemId={problem.id} bookmarked={problem.bookmarked} withLabel />
          {problem.canEdit && (
            <>
              {/* 정답 코드는 운영진 이상에게만 존재가 보인다 (P3 6절) - solutionLanguages 가 비어 있으면 안내만 */}
              {problem.solutionLanguages.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setSolutionsOpen(true)}>
                  <KeyRound data-icon="inline-start" />
                  정답 코드 보기
                  <span className="font-mono text-[11px] text-muted-foreground">{problem.solutionLanguages.join(' · ')}</span>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  등록된 정답 코드 없음 -{' '}
                  <Link to={`/problems/${problem.id}/edit`} className="underline hover:text-primary">
                    문제 수정에서 추가
                  </Link>
                </span>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to={`/problems/${problem.id}/edit`}>
                  <Pencil data-icon="inline-start" />
                  수정
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 data-icon="inline-start" />
                삭제
              </Button>
            </>
          )}
        </div>
      </header>
      {problem.canEdit && solutionsOpen && <SolutionsDialog problemId={problem.id} open onOpenChange={(open) => !open && setSolutionsOpen(false)} />}

      {deleteMutation.error && <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>}

      {split ? (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <div className="space-y-4">
            {statement}
            <JudgeSamplesSection problemId={problem.id} />
          </div>
          <div className="xl:sticky xl:top-16">{submitPanel}</div>
        </div>
      ) : (
        <>
          {statement}
          {submitPanel}
        </>
      )}

      <section aria-label="내 제출 기록" className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b bg-secondary px-4 py-3">
          <h2 className="text-base font-bold">내 제출 기록</h2>
        </div>
        {mineQuery.isPending ? (
          <LoadingScreen label="기록 불러오는 중..." />
        ) : mineQuery.error ? (
          <ApiErrorView error={mineQuery.error} onRetry={() => void mineQuery.refetch()} />
        ) : mineQuery.data.length === 0 ? (
          <EmptyState compact title="아직 제출한 적이 없어요" description="위에서 코드를 작성해 제출해 보세요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-bold">순번</th>
                  <th className="px-2 py-2 text-left font-bold">언어</th>
                  <th className="px-2 py-2 text-center font-bold">채점 결과</th>
                  <th className="px-4 py-2 text-right font-bold">제출 시각</th>
                </tr>
              </thead>
              <tbody>
                {mineQuery.data.map((row, index) => (
                  <PracticeRow
                    key={row.id}
                    problemId={problem.id}
                    row={row}
                    order={mineQuery.data.length - index}
                    open={openId === row.id}
                    onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                    onEditAgain={problem.judgeEnabled ? handleEditAgain : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canSeeSolutions && <AcceptedSolutionsSection problemId={problem.id} allowedLanguages={problem.allowedLanguages} />}
    </div>
  )
}

/** 한 줄 = 제출 1건. 누르면 코드 전문과 채점 결과가 펼쳐진다(단건 조회). "다시 편집"은 그 코드를 편집기로 */
function PracticeRow({
  problemId,
  row,
  order,
  open,
  onToggle,
  onEditAgain,
}: {
  problemId: number
  row: SubmissionSummary
  order: number
  open: boolean
  onToggle: () => void
  onEditAgain?: (code: string, language: string | null) => void
}) {
  const detailQuery = usePracticeSubmission(problemId, row.id, open)
  return (
    <>
      <tr className="cursor-pointer border-b last:border-0 hover:bg-secondary/40" onClick={onToggle}>
        <td className="px-4 py-3 font-mono">#{order}</td>
        <td className="px-2 py-3">{row.language}</td>
        <td className="px-2 py-3 text-center">
          <VerdictBadge status={row.judgeStatus} verdict={row.verdict} />
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{formatKst(row.submittedAt)}</td>
      </tr>
      {open && (
        <tr className="border-b last:border-0">
          <td colSpan={4} className="space-y-3 bg-secondary/20 px-4 py-3">
            {detailQuery.isPending ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : detailQuery.error ? (
              <ApiErrorView error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
            ) : (
              <>
                {detailQuery.data.judge && <JudgeResultView judge={detailQuery.data.judge} />}
                {detailQuery.data.codeText !== null && (
                  <>
                    {onEditAgain && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => onEditAgain(detailQuery.data.codeText ?? '', detailQuery.data.language)}
                        >
                          <RotateCcw data-icon="inline-start" />
                          다시 편집
                        </Button>
                      </div>
                    )}
                    <CodeViewer value={detailQuery.data.codeText} language={detailQuery.data.language} />
                  </>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
