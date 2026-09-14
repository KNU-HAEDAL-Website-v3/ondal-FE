import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { useCreateQuestion, useQuestion, useUpdateQuestion } from '@/api/questions'
import type { QuestionPayload } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { parseId } from '@/lib/params'

const TITLE_MAX = 200
const CONTENT_MAX = 10000

// 작성 중인 내용을 이 탭(sessionStorage)에 임시 저장 - 세션 만료(401)로 로그인 화면에 다녀와도 입력이 남는다 (CLAUDE.md 규칙 1).
// 키는 분반·질문 단위: 등록 폼과 수정 폼, 서로 다른 글의 임시 저장본이 섞이지 않는다.
const DRAFT_PREFIX = 'ondal-question-draft'
const draftKey = (cohortId: number, questionId: number | null) => `${DRAFT_PREFIX}:${cohortId}:${questionId ?? 'new'}`

function readDraft(key: string): QuestionPayload | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as QuestionPayload) : null
  } catch {
    return null
  }
}
function writeDraft(key: string, payload: QuestionPayload) {
  try {
    sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // 저장 불가(용량·비공개 모드)면 조용히 넘어간다 - 폼 동작에는 영향 없음
  }
}
function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 위와 동일
  }
}

/**
 * 질문 등록(#25)·수정(#26) 폼 - /cohorts/:cohortId/questions/new · /cohorts/:cohortId/questions/:questionId/edit.
 * - 실패(400·403·409 등) 시 작성 내용 보존 + 에러 문구 표시, 요청 중 저장 버튼 잠금 (CLAUDE.md 규칙 1·2)
 * - 409 COHORT_ARCHIVED 는 홈으로 보내지 않고 안내만 - 보관 분반이면 저장을 사전에 비활성
 * - 수정 폼은 상세 응답으로 프리필. 작성자가 아니면(canEdit=false) 권한 밖 URL 직접 접근 → 홈 (규칙 3)
 */
export default function QuestionFormPage() {
  const { cohortId: cohortParam, questionId: questionParam } = useParams()
  const editing = questionParam !== undefined
  const cohortId = parseId(cohortParam)
  const questionId = editing ? parseId(questionParam) : NaN
  const navigate = useNavigate()

  const cohortQuery = useCohort(cohortId)
  const existingQuery = useQuestion(editing ? cohortId : NaN, questionId)

  const key = draftKey(cohortId, editing ? questionId : null)
  const [title, setTitle] = useState(() => readDraft(key)?.title ?? '')
  const [content, setContent] = useState(() => readDraft(key)?.content ?? '')
  // 임시 저장본이 있으면 그것이 더 최신 - 서버 값으로 덮어쓰지 않는다
  const [prefilled, setPrefilled] = useState(() => !editing || readDraft(key) !== null)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      setTitle(existingQuery.data.title)
      setContent(existingQuery.data.content)
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  useEffect(() => {
    if (!prefilled) return // 수정 폼이 서버 값을 채우기 전의 빈 상태는 저장하지 않는다
    if (title === '' && content === '') clearDraft(key)
    else writeDraft(key, { title, content })
  }, [key, title, content, prefilled])

  const createMutation = useCreateQuestion(cohortId)
  const updateMutation = useUpdateQuestion(cohortId, questionId)
  const mutation = editing ? updateMutation : createMutation

  if (!Number.isFinite(cohortId) || (editing && !Number.isFinite(questionId))) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 주소예요. 질문 목록에서 다시 들어와 주세요.')} />
  }
  if (editing && (existingQuery.isPending || cohortQuery.isPending)) return <LoadingScreen />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }

  const cohort = cohortQuery.data
  const archived = cohort?.status === 'ARCHIVED'
  const existing = existingQuery.data
  // 보관 분반은 작성자도 canEdit=false 라 아래 안내로 처리하고, 진행 중 분반에서 canEdit=false 면 남의 글 → 권한 밖 접근
  if (editing && existing && !existing.canEdit && !archived) {
    return <ApiErrorView error={new ApiError(403, 'FORBIDDEN', '작성자만 수정할 수 있습니다.')} />
  }

  const backTo = editing ? `/cohorts/${cohortId}/questions/${questionId}` : `/cohorts/${cohortId}/questions`
  const canSubmit = !mutation.isPending && !archived && title.trim() !== '' && content.trim() !== ''

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return // 요청 중 중복 제출 방지 (규칙 2)
    mutation.mutate(
      { title: title.trim(), content: content.trim() },
      {
        onSuccess: (saved) => {
          clearDraft(key) // 성공했을 때만 비운다 - 실패 시 입력 보존
          navigate(`/cohorts/${cohortId}/questions/${saved.id}`, { replace: true })
        },
      },
    )
  }

  const handleCancel = () => {
    clearDraft(key)
    navigate(backTo)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" type="button" onClick={handleCancel}>
        <ArrowLeft data-icon="inline-start" />
        {editing ? '질문 상세로' : '질문 목록으로'}
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '질문 수정' : '질문하기'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort ? `${cohort.name} - ` : ''}
          {editing ? '저장하면 전체 내용이 교체됩니다.' : '같은 분반의 수강생·운영진이 볼 수 있어요.'}
        </p>
      </header>

      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반은 질문을 {editing ? '수정' : '등록'}할 수 없어요. 보관을 해제한 뒤 다시 시도해 주세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="question-title">제목</Label>
          <Input
            id="question-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={TITLE_MAX}
            autoFocus={!editing}
            placeholder="예: 1차시 과제 입력 형식 질문"
          />
          <p className="text-right text-xs text-muted-foreground">
            {title.length}/{TITLE_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="question-content">내용</Label>
          <textarea
            id="question-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={CONTENT_MAX}
            rows={12}
            placeholder="어디까지 해 봤고 무엇이 막히는지 적으면 답을 얻기 쉬워요. 코드는 그대로 붙여 넣어도 됩니다."
            className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>입력 내용은 이 탭에 임시 저장돼요 - 세션이 만료돼 다시 로그인해도 유지됩니다.</span>
            <span>
              {content.length}/{CONTENT_MAX}
            </span>
          </p>
        </div>

        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!canSubmit} className="rounded-[2px]">
            {mutation.isPending ? '저장 중...' : editing ? '저장' : '등록'}
          </Button>
          <Button type="button" variant="outline" className="rounded-[2px]" onClick={handleCancel}>
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}
