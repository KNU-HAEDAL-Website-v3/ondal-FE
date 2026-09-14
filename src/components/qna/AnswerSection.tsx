import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { useAnswers, useCreateAnswer, useDeleteAnswer, useUpdateAnswer } from '@/api/answers'
import type { AnswerResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { formatKst } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'

const CONTENT_MAX = 10000
const TEXTAREA_CLASS =
  'w-full rounded-[6px] border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * 질문 상세의 답변 영역 (docs/qna/fe.md 1절, 결정 11) - 목록(오래된 순) + 작성 폼 + 답변별 인라인 수정·삭제.
 * - 작성은 분반 소속 누구나(운영진 전용 아님). 보관 분반이면 폼 없이 열람만
 * - 수정·삭제 버튼은 응답의 canEdit·canDelete 로만 분기, 운영진이 남의 답변을 지울 때는 확인 문구에 작성자 명시
 * - 작성 중 내용은 임시 저장(lib/draft) - 세션 만료 후 복원
 */
export function AnswerSection({ cohortId, questionId, archived }: { cohortId: number; questionId: number; archived: boolean }) {
  const query = useAnswers(cohortId, questionId)
  const createMutation = useCreateAnswer(cohortId, questionId)
  const draftKey = `ondal-answer-draft:${cohortId}:${questionId}`
  const [content, setContent] = useState(() => readDraft<string>(draftKey) ?? '')
  useEffect(() => {
    if (content === '') clearDraft(draftKey)
    else writeDraft(draftKey, content)
  }, [draftKey, content])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || createMutation.isPending) return // 요청 중 중복 제출 방지 (규칙 2)
    createMutation.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setContent('') // 성공했을 때만 비운다 - 실패 시 입력 보존 (규칙 1)
          clearDraft(draftKey)
        },
      },
    )
  }

  return (
    <section className="space-y-4" aria-label="답변">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <MessageSquare className="size-5 text-primary" />
        답변 {query.data ? <span className="text-muted-foreground">{query.data.length}</span> : null}
      </h2>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">답변 불러오는 중...</p>
      ) : query.error ? (
        <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="rounded-[2px] border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          아직 답변이 없어요.{!archived && ' 첫 답변을 남겨 보세요.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {query.data.map((answer) => (
            <AnswerItem key={answer.id} answer={answer} cohortId={cohortId} questionId={questionId} />
          ))}
        </ul>
      )}

      {archived ? (
        <p className="text-sm text-muted-foreground">보관된 분반이라 새 답변은 남길 수 없어요.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-card/40 p-4">
          <label htmlFor="answer-content" className="text-sm font-semibold">
            답변 남기기
          </label>
          <textarea
            id="answer-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={CONTENT_MAX}
            rows={4}
            placeholder="같은 분반의 누구나 답변할 수 있어요. 코드는 그대로 붙여 넣어도 됩니다."
            className={TEXTAREA_CLASS}
          />
          {createMutation.error && <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">입력 내용은 이 탭에 임시 저장돼요.</span>
            <Button type="submit" size="sm" className="rounded-[2px]" disabled={createMutation.isPending || content.trim() === ''}>
              {createMutation.isPending ? '등록 중...' : '답변 등록'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

/** 답변 한 건 - 작성자 배지·시각·본문, canEdit 이면 인라인 수정, canDelete 면 삭제 */
function AnswerItem({ answer, cohortId, questionId }: { answer: AnswerResponse; cohortId: number; questionId: number }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(answer.content)
  const updateMutation = useUpdateAnswer(cohortId, questionId)
  const deleteMutation = useDeleteAnswer(cohortId, questionId)

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || updateMutation.isPending) return
    updateMutation.mutate({ answerId: answer.id, payload: { content: trimmed } }, { onSuccess: () => setEditing(false) })
  }
  const handleDelete = () => {
    const warning = answer.canEdit
      ? '이 답변을 삭제할까요? 삭제하면 되돌릴 수 없어요.'
      : `${answer.author.name} 님이 쓴 답변을 삭제합니다. 삭제하면 되돌릴 수 없어요. 계속할까요?`
    if (!window.confirm(warning)) return
    deleteMutation.mutate(answer.id)
  }

  return (
    <li className="rounded-lg border bg-card p-4" data-answer-id={answer.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{answer.author.name}</span>
          <Badge variant="secondary">{answer.author.title}</Badge>
          <span className="font-mono text-xs">{formatKst(answer.createdAt)}</span>
        </p>
        {(answer.canEdit || answer.canDelete) && !editing && (
          <div className="flex items-center gap-1">
            {answer.canEdit && (
              <Button variant="ghost" size="xs" className="rounded-[2px]" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                수정
              </Button>
            )}
            {answer.canDelete && (
              <Button variant="ghost" size="xs" className="rounded-[2px] text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 data-icon="inline-start" />
                삭제
              </Button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <form onSubmit={handleSave} className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={CONTENT_MAX}
            rows={4}
            aria-label="답변 수정"
            className={TEXTAREA_CLASS}
          />
          {updateMutation.error && <p className="text-sm text-destructive">{(updateMutation.error as Error).message}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="rounded-[2px]" disabled={updateMutation.isPending || draft.trim() === ''}>
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[2px]"
              onClick={() => {
                setEditing(false)
                setDraft(answer.content)
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap">{answer.content}</p>
      )}
      {deleteMutation.error && <p className="mt-2 text-sm text-destructive">{(deleteMutation.error as Error).message}</p>}
    </li>
  )
}
