import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Check, Pencil, Send, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
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
import { JudgeResultView } from '@/components/judge/JudgeResultView'
import { JudgeSamplesSection } from '@/components/judge/JudgeSamplesSection'
import { VerdictBadge } from '@/components/judge/VerdictBadge'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseId } from '@/lib/params'

const LANGUAGES = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript'] as const

const DRAFT_PREFIX = 'ondal-practice-draft'
const draftKey = (problemId: number) => `${DRAFT_PREFIX}:${problemId}`

interface PracticeDraft {
  codeText: string
  language: string
}

/**
 * HOJ 문제 상세 - 문제를 읽고 바로 풀어 채점받는 화면 (/problems/:problemId, V7).
 *
 * 분반 과제와 같은 채점 파이프라인을 쓰지만 마감·지각·운영진 코멘트가 없다(연습 제출).
 * 작성 중인 코드는 세션 만료에 대비해 임시 저장한다 (CLAUDE.md 규칙 1).
 */
export default function ProblemDetailPage() {
  const { problemId: problemParam } = useParams()
  const problemId = parseId(problemParam)
  const navigate = useNavigate()

  const problemQuery = useProblem(problemId)
  const mineQuery = useMyPracticeSubmissions(problemId)
  const submitMutation = useSubmitPractice(problemId)
  const deleteMutation = useDeleteProblem()

  const key = draftKey(problemId)
  const saved = readDraft<PracticeDraft>(key)
  const [codeText, setCodeText] = useState(saved?.codeText ?? '')
  const [language, setLanguage] = useState(saved?.language ?? '')
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    // 코드가 비어 있으면 저장할 게 없다 - 언어만 남기면 제출 성공 뒤에도 임시 저장본이 되살아난다
    if (codeText.trim() === '') clearDraft(key)
    else writeDraft<PracticeDraft>(key, { codeText, language })
  }, [key, codeText, language])

  if (!Number.isFinite(problemId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 문제 주소예요.')} />
  }
  if (problemQuery.isPending) return <LoadingScreen label="문제 불러오는 중..." />
  if (problemQuery.error) return <ApiErrorView error={problemQuery.error} onRetry={() => void problemQuery.refetch()} />

  const problem = problemQuery.data
  const canSubmit = problem.judgeEnabled && !submitMutation.isPending && codeText.trim() !== '' && language !== ''

  const handleSubmit = () => {
    if (!canSubmit) return
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

  const handleDelete = () => {
    if (!window.confirm(`#${problem.problemNo} ${problem.title} 문제를 삭제할까요? 되돌릴 수 없어요.`)) return
    deleteMutation.mutate(problem.id, { onSuccess: () => navigate('/problems', { replace: true }) })
  }

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
            {problem.solved && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">
                <Check className="size-3" />
                해결
              </span>
            )}
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
            {problem.assignedCount > 0 && <span>과제로 {problem.assignedCount}회 출제됨</span>}
            {problem.createdBy && <span>출제 {problem.createdBy}</span>}
          </p>
        </div>
        {problem.canEdit && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </header>

      {deleteMutation.error && <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>}

      <section aria-label="문제 본문" className="rounded-lg border bg-card p-4">
        {problem.description ? (
          <p className="text-sm leading-7 whitespace-pre-wrap">{problem.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">문제 본문이 아직 없어요.</p>
        )}
      </section>

      {problem.judgeEnabled && <JudgeSamplesSection problemId={problem.id} />}

      <section aria-label="풀이 제출" className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">풀이 제출</h2>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="제출 언어"
            className="h-8 rounded-lg border bg-card px-2 text-sm"
          >
            <option value="">언어 선택 (필수)</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {problem.judgeEnabled ? (
          <>
            <CodeEditor value={codeText} onChange={setCodeText} language={language === '' ? null : language} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                연습 제출이에요 - 분반 과제와 따로 기록되고, 마감·지각은 없어요. 여러 번 내도 괜찮아요.
              </p>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Send data-icon="inline-start" />
                {submitMutation.isPending ? '제출 중...' : '제출하기'}
              </Button>
            </div>
            {submitMutation.error && <p className="text-sm text-destructive">{(submitMutation.error as Error).message}</p>}
          </>
        ) : (
          <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
            아직 채점 기준(테스트케이스)이 없는 문제예요. 운영진이 등록하면 풀 수 있어요.
          </p>
        )}
      </section>

      <section aria-label="내 제출 기록" className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b bg-secondary px-4 py-3">
          <h2 className="text-base font-bold">내 제출 기록</h2>
        </div>
        {mineQuery.isPending ? (
          <LoadingScreen label="기록 불러오는 중..." />
        ) : mineQuery.error ? (
          <ApiErrorView error={mineQuery.error} onRetry={() => void mineQuery.refetch()} />
        ) : mineQuery.data.length === 0 ? (
          <EmptyState title="아직 제출한 적이 없어요" description="위에서 코드를 작성해 제출해 보세요." />
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** 한 줄 = 제출 1건. 누르면 코드 전문과 채점 결과가 펼쳐진다(단건 조회) */
function PracticeRow({
  problemId,
  row,
  order,
  open,
  onToggle,
}: {
  problemId: number
  row: SubmissionSummary
  order: number
  open: boolean
  onToggle: () => void
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
                  <CodeViewer value={detailQuery.data.codeText} language={detailQuery.data.language} />
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
