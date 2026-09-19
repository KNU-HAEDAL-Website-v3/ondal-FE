import { useEffect, useState, type FormEvent } from 'react'
import { Download, ExternalLink, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { submissionFileUrl, useClearSubmissionComment, useCommentSubmission, useSubmission } from '@/api/submissions'
import type { SubmissionResponse } from '@/api/types'
import { ApiErrorView } from '@/components/ApiErrorView'
import { CodeViewer } from '@/components/code/CodePane'
import { JudgeResultView } from '@/components/judge/JudgeResultView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKst } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'

const COMMENT_MAX = 5000
const TEXTAREA_CLASS =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 제출 단건(#20) 펼침 뷰 - 내 이력 행과 현황판(운영진) 열람이 공용한다.
 * 코드 전문은 이 컴포넌트가 마운트될 때(행을 펼칠 때)만 서버에서 가져온다.
 * 코드 아래에 채점 결과(judge - 자동 채점 문제의 CODE 제출만, judge/fe.md 3절), 하단에 운영진 코멘트(design.md 결정 18) - 학생은 읽기만, canComment(운영진 + ACTIVE)면 남기기·수정·지우기.
 */
export function SubmissionDetailView({
  cohortId,
  assignmentId,
  submissionId,
  canComment,
}: {
  cohortId: number
  assignmentId: number
  submissionId: number
  /** 코멘트 쓰기 UI 표시 여부 - 서버 canManage 기준. 실제 방어는 서버(403·409) */
  canComment: boolean
}) {
  const query = useSubmission(cohortId, assignmentId, submissionId)

  if (query.isPending) return <p className="p-3 text-sm text-muted-foreground">불러오는 중...</p>
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const submission = query.data
  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">
        {submission.user.name} · {formatKst(submission.submittedAt)}
        {submission.language ? ` · ${submission.language}` : ''}
      </p>
      {submission.codeText !== null && <CodeViewer value={submission.codeText} language={submission.language} />}
      <div className="space-y-1.5 text-sm">
        {submission.fileName !== null && (
          <a
            href={submissionFileUrl(cohortId, assignmentId, submission.id)}
            download={submission.fileName}
            className="flex w-fit items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <Download className="size-4" />
            {submission.fileName}
            {submission.fileSize !== null && ` (${(submission.fileSize / 1024).toFixed(0)}KB)`}
          </a>
        )}
        {submission.links.map((url, index) => (
          <a
            key={url + index}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex w-fit max-w-full items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <ExternalLink className="size-4 shrink-0" />
            <span className="truncate">{url}</span>
          </a>
        ))}
      </div>
      {submission.judge !== null && <JudgeResultView judge={submission.judge} />}
      {(submission.comment !== null || canComment) && (
        <CommentBox cohortId={cohortId} assignmentId={assignmentId} submission={submission} canComment={canComment} />
      )}
    </div>
  )
}

/**
 * 운영진 코멘트 상자 - 제출 1건에 코멘트 1개(덮어쓰기), 점수 없음.
 * - 코멘트 없음 + canComment: 바로 작성 폼 (초안은 sessionStorage - 세션 만료 후 복원)
 * - 코멘트 있음: 작성자·직책·시각·내용. canComment 면 수정(인라인)·지우기(confirm)
 * - 학생: 읽기만 (코멘트 없으면 상자 자체가 안 보인다)
 */
function CommentBox({
  cohortId,
  assignmentId,
  submission,
  canComment,
}: {
  cohortId: number
  assignmentId: number
  submission: SubmissionResponse
  canComment: boolean
}) {
  const comment = submission.comment
  const draftKey = `ondal-submission-comment-draft:${cohortId}:${assignmentId}:${submission.id}`
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(() => (comment === null ? (readDraft<string>(draftKey) ?? '') : comment.content))
  const commentMutation = useCommentSubmission(cohortId, assignmentId)
  const clearMutation = useClearSubmissionComment(cohortId, assignmentId)

  // 새 코멘트 작성 중인 내용만 초안으로 보존 - 수정 중 내용은 서버 값이 있으니 저장하지 않는다
  useEffect(() => {
    if (comment !== null) return
    if (content === '') clearDraft(draftKey)
    else writeDraft(draftKey, content)
  }, [comment, content, draftKey])

  const showForm = canComment && (comment === null || editing)

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || commentMutation.isPending) return
    commentMutation.mutate(
      { submissionId: submission.id, payload: { content: trimmed } },
      {
        onSuccess: (saved) => {
          clearDraft(draftKey)
          setEditing(false)
          setContent(saved.comment?.content ?? trimmed)
        },
      },
    )
  }

  const handleClear = () => {
    if (!window.confirm(`${submission.user.name} 님 제출에 남긴 코멘트를 지웁니다. 지우면 되돌릴 수 없어요. 계속할까요?`)) return
    clearMutation.mutate(submission.id, {
      onSuccess: () => {
        setEditing(false)
        setContent('')
      },
    })
  }

  return (
    <section aria-label="운영진 코멘트" className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-bold tracking-[0.55px]">
            <MessageSquare className="size-3.5" />
            운영진 코멘트
          </span>
          {comment !== null && (
            <>
              <span className="font-medium text-foreground">{comment.author.name}</span>
              <Badge variant="secondary">{comment.author.title}</Badge>
              <span className="font-mono">{formatKst(comment.commentedAt)}</span>
            </>
          )}
        </p>
        {canComment && comment !== null && !editing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
             
              onClick={() => {
                setContent(comment.content)
                setEditing(true)
              }}
            >
              <Pencil data-icon="inline-start" />
              수정
            </Button>
            <Button variant="ghost" size="xs" className="text-destructive" onClick={handleClear} disabled={clearMutation.isPending}>
              <Trash2 data-icon="inline-start" />
              {clearMutation.isPending ? '지우는 중...' : '지우기'}
            </Button>
          </div>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSave} className="mt-2 space-y-2">
          <textarea
            id={`submission-comment-${submission.id}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            aria-label={comment === null ? '코멘트 작성' : '코멘트 수정'}
            placeholder={`${submission.user.name} 님에게 남길 코멘트를 적어 주세요. 점수는 없고, 학생 본인만 볼 수 있어요.`}
            className={TEXTAREA_CLASS}
          />
          {commentMutation.error && <p className="text-sm text-destructive">{(commentMutation.error as Error).message}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={commentMutation.isPending || content.trim() === ''}>
              {commentMutation.isPending ? '저장 중...' : comment === null ? '코멘트 남기기' : '저장'}
            </Button>
            {comment !== null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
               
                onClick={() => {
                  setEditing(false)
                  setContent(comment.content)
                }}
              >
                취소
              </Button>
            )}
          </div>
        </form>
      ) : (
        comment !== null && <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">{comment.content}</p>
      )}
      {clearMutation.error && <p className="mt-2 text-sm text-destructive">{(clearMutation.error as Error).message}</p>}
    </section>
  )
}
