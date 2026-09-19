import { Link, useParams } from 'react-router'
import { ArrowLeft, MessageSquare, MessagesSquare, Plus } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { useQuestions } from '@/api/questions'
import type { QuestionResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { parseId } from '@/lib/params'

/**
 * Q&A 질문 목록 (#23) - /cohorts/:cohortId/questions. 분반 페이지에서 진입한다 (docs/qna/fe.md 1절).
 * - 서버 정렬(최신순) 그대로, 페이징 없음
 * - "질문하기"는 소속이면 누구나(등록 권한 = 소속 누구나) - 보관 분반이면 비활성
 * - 작성자 직책 배지는 서버 문자열(author.title) 그대로
 */
export default function QuestionsPage() {
  const { cohortId: cohortParam } = useParams()
  const cohortId = parseId(cohortParam)
  const cohortQuery = useCohort(cohortId)
  const questionsQuery = useQuestions(cohortId)

  if (!Number.isFinite(cohortId)) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 분반 주소예요.')} />
  if (cohortQuery.isPending) return <LoadingScreen />
  if (cohortQuery.error) return <ApiErrorView error={cohortQuery.error} onRetry={() => void cohortQuery.refetch()} />

  const cohort = cohortQuery.data
  const archived = cohort.status === 'ARCHIVED'

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/cohorts/${cohortId}`}>
          <ArrowLeft data-icon="inline-start" />
          분반 페이지로
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Q&A</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cohort.name} - 질문 게시판. 소속이면 누구나 질문하고 볼 수 있어요.</p>
        </div>
        {archived ? (
          <Button size="sm" disabled>
            <Plus data-icon="inline-start" />
            질문하기
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link to={`/cohorts/${cohortId}/questions/new`}>
              <Plus data-icon="inline-start" />
              질문하기
            </Link>
          </Button>
        )}
      </header>

      {archived && (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 질문 열람만 가능합니다.
        </p>
      )}

      {questionsQuery.isPending ? (
        <LoadingScreen />
      ) : questionsQuery.error ? (
        <ApiErrorView error={questionsQuery.error} onRetry={() => void questionsQuery.refetch()} />
      ) : questionsQuery.data.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="size-8" />}
          title="아직 질문이 없어요"
          description={archived ? '보관된 분반이라 새 질문은 올릴 수 없어요.' : '첫 질문을 올려 보세요.'}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {questionsQuery.data.map((q) => (
            <QuestionRow key={q.id} question={q} cohortId={cohortId} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** 한 줄 요약: 제목 + 내용 미리보기 왼쪽, 작성자·직책·시각 오른쪽 */
function QuestionRow({ question, cohortId }: { question: QuestionResponse; cohortId: number }) {
  return (
    <li>
      <Link
        to={`/cohorts/${cohortId}/questions/${question.id}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-secondary/50"
      >
        <span className="min-w-0 flex-1 basis-64">
          <span className="block truncate font-semibold">{question.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{question.content}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${question.answerCount > 0 ? 'bg-secondary text-primary' : 'bg-muted'}`}
            aria-label={`답변 ${question.answerCount}개`}
          >
            <MessageSquare className="size-3" />
            {question.answerCount}
          </span>
          <span className="font-medium text-foreground">{question.author.name}</span>
          <Badge variant="secondary">{question.author.title}</Badge>
          <span className="font-mono">{formatKst(question.createdAt)}</span>
        </span>
      </Link>
    </li>
  )
}
