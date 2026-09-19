import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { useDeleteQuestion, useQuestion } from '@/api/questions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { AnswerSection } from '@/components/qna/AnswerSection'
import { formatKst } from '@/lib/datetime'
import { parseId } from '@/lib/params'

/**
 * 질문 상세 (#24) - /cohorts/:cohortId/questions/:questionId.
 * 수정·삭제 버튼은 응답의 canEdit·canDelete 로만 분기한다 (프론트에서 loginId 비교·역할 판정 금지 - docs/qna/design.md 결정 3).
 * 다른 분반의 글·없는 글은 404 안내, 비소속은 403 → 홈 (ApiErrorView 공통).
 */
export default function QuestionDetailPage() {
  const { cohortId: cohortParam, questionId: questionParam } = useParams()
  const cohortId = parseId(cohortParam)
  const questionId = parseId(questionParam)
  const navigate = useNavigate()
  const query = useQuestion(cohortId, questionId)
  const cohortQuery = useCohort(cohortId) // 답변 폼 노출 판정(보관 분반이면 열람만)
  const deleteMutation = useDeleteQuestion(cohortId)

  if (!Number.isFinite(cohortId) || !Number.isFinite(questionId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 질문 주소예요.')} />
  }
  if (query.isPending) return <LoadingScreen />
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const question = query.data

  const handleDelete = () => {
    // canEdit 이 false 인데 canDelete 면 남의 글을 지우는 운영진 - 작성자 글임을 알린다 (fe.md 1절). 답변도 함께 지워진다
    const answers = question.answerCount > 0 ? ` 답변 ${question.answerCount}건도 함께 삭제돼요.` : ''
    const warning = question.canEdit
      ? `이 질문을 삭제할까요?${answers} 삭제하면 되돌릴 수 없어요.`
      : `${question.author.name} 님이 쓴 질문을 삭제합니다.${answers} 삭제하면 되돌릴 수 없어요. 계속할까요?`
    if (!window.confirm(warning)) return
    deleteMutation.mutate(question.id, {
      onSuccess: () => navigate(`/cohorts/${cohortId}/questions`, { replace: true }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/cohorts/${cohortId}/questions`}>
          <ArrowLeft data-icon="inline-start" />
          질문 목록으로
        </Link>
      </Button>

      <header className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{question.title}</h1>
          {(question.canEdit || question.canDelete) && (
            <div className="flex shrink-0 items-center gap-2">
              {question.canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/cohorts/${cohortId}/questions/${question.id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    수정
                  </Link>
                </Button>
              )}
              {question.canDelete && (
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
              )}
            </div>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{question.author.name}</span>
          <Badge variant="secondary">{question.author.title}</Badge>
          <span className="font-mono text-xs">{formatKst(question.createdAt)}</span>
        </p>
        {deleteMutation.error && (
          <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>
        )}
      </header>

      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm leading-6 break-words whitespace-pre-wrap">{question.content}</p>
      </section>

      <AnswerSection cohortId={cohortId} questionId={question.id} archived={cohortQuery.data?.status === 'ARCHIVED'} />
    </div>
  )
}
