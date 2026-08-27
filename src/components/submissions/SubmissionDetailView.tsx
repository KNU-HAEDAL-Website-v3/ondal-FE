import { Download, ExternalLink } from 'lucide-react'
import { submissionFileUrl, useSubmission } from '@/api/submissions'
import { ApiErrorView } from '@/components/ApiErrorView'
import { formatKst } from '@/lib/datetime'

/**
 * 제출 단건(#20) 펼침 뷰 - 내 이력 행과 현황판(운영진) 열람이 공용한다.
 * 코드 전문은 이 컴포넌트가 마운트될 때(행을 펼칠 때)만 서버에서 가져온다.
 */
export function SubmissionDetailView({
  cohortId,
  assignmentId,
  submissionId,
}: {
  cohortId: number
  assignmentId: number
  submissionId: number
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
      {submission.codeText !== null && (
        <pre className="max-h-80 overflow-auto rounded-[2px] border bg-muted/40 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
          {submission.codeText}
        </pre>
      )}
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
    </div>
  )
}
