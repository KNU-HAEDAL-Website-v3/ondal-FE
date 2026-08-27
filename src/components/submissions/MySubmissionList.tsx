import { Fragment, useState } from 'react'
import { ChevronDown, Code, Download, FileArchive, Link2 } from 'lucide-react'
import { submissionFileUrl, useMySubmissions } from '@/api/submissions'
import type { SubmissionSummary, SubmissionType } from '@/api/types'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LateBadge } from '@/components/submissions/SubmissionStatusBadge'
import { SubmissionDetailView } from '@/components/submissions/SubmissionDetailView'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<SubmissionType, { label: string; Icon: typeof Code }> = {
  CODE: { label: '코드 제출', Icon: Code },
  FILE: { label: '파일 업로드', Icon: FileArchive },
  LINK: { label: '링크 제출', Icon: Link2 },
}

/**
 * 내 제출 기록(#19) - 표: 순번 · 제출 형태 · 지각 · 제출 시각 (design.md 결정 15).
 * 채점 결과 열은 P2 자리 예약 - 자동 채점 도입 시 지각 열 뒤에 추가한다.
 * 행을 펼치면 코드 전문(#20)을 가져온다.
 */
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
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="w-12 py-2 font-semibold">순번</th>
              <th scope="col" className="py-2 font-semibold">제출 형태</th>
              <th scope="col" className="py-2 font-semibold">지각</th>
              <th scope="col" className="py-2 font-semibold">제출 시각</th>
              <th scope="col" className="w-16 py-2"><span className="sr-only">동작</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
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
          </tbody>
        </table>
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
  const { label, Icon } = TYPE_LABEL[submission.type]
  const detail =
    submission.type === 'CODE' ? submission.language : submission.type === 'FILE' ? submission.fileName : `${submission.links.length}개`
  return (
    <Fragment>
      <tr onClick={onToggle} aria-expanded={expanded} className="cursor-pointer hover:bg-secondary/50">
        <td className="py-2.5 font-mono text-xs text-muted-foreground">#{order}</td>
        <td className="py-2.5">
          <span className="flex items-center gap-1.5">
            <Icon className="size-3.5 text-muted-foreground" />
            {label}
            {detail && <span className="text-xs text-muted-foreground">({detail})</span>}
            {latest && <span className="rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-primary">최신</span>}
          </span>
        </td>
        <td className="py-2.5">
          <LateBadge late={submission.late} />
        </td>
        <td className="py-2.5 font-mono text-xs">{formatKst(submission.submittedAt)}</td>
        <td className="py-2.5">
          <span className="flex items-center justify-end gap-2">
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
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="pb-2">
            <div className="rounded-[2px] border bg-muted/20">
              <SubmissionDetailView cohortId={cohortId} assignmentId={assignmentId} submissionId={submission.id} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
