import { useState } from 'react'
import { ChevronDown, Download, FileArchive, Link2 } from 'lucide-react'
import { submissionFileUrl, useMySubmissions } from '@/api/submissions'
import type { SubmissionSummary } from '@/api/types'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LateBadge } from '@/components/submissions/SubmissionStatusBadge'
import { SubmissionDetailView } from '@/components/submissions/SubmissionDetailView'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/** 내 제출 기록(#19) - 최신이 대표(맨 위). 행을 펼치면 코드 전문(#20)을 가져온다 */
export function MySubmissionList({ cohortId, assignmentId }: { cohortId: number; assignmentId: number }) {
  const query = useMySubmissions(cohortId, assignmentId)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (query.isPending) return <p className="text-sm text-muted-foreground">제출 기록을 불러오는 중...</p>
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const submissions = query.data
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">내 제출 기록</h2>
      {submissions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">아직 제출한 기록이 없어요.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {submissions.map((s, index) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              order={submissions.length - index}
              latest={index === 0}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
              cohortId={cohortId}
              assignmentId={assignmentId}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SubmissionRow({
  submission,
  order,
  latest,
  expanded,
  onToggle,
  cohortId,
  assignmentId,
}: {
  submission: SubmissionSummary
  order: number
  latest: boolean
  expanded: boolean
  onToggle: () => void
  cohortId: number
  assignmentId: number
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left text-sm hover:bg-secondary/50"
      >
        <span className="w-10 font-mono text-xs text-muted-foreground">#{order}</span>
        <LateBadge late={submission.late} />
        {latest && <span className="rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-primary">최신</span>}
        <span className="font-mono text-xs">{formatKst(submission.submittedAt)}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {submission.language}
          {submission.fileName && (
            <>
              <FileArchive className="size-3.5" />
              {submission.fileName}
            </>
          )}
          {submission.linkUrl && <Link2 className="size-3.5" aria-label="링크 포함" />}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {submission.fileName && (
            <a
              href={submissionFileUrl(cohortId, assignmentId, submission.id)}
              download={submission.fileName}
              onClick={(e) => e.stopPropagation()}
              aria-label="제출 파일 다운로드"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
            >
              <Download className="size-4" />
            </a>
          )}
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>
      {expanded && (
        <div className="mb-2 rounded-[2px] border bg-muted/20">
          <SubmissionDetailView cohortId={cohortId} assignmentId={assignmentId} submissionId={submission.id} />
        </div>
      )}
    </li>
  )
}
