import { Fragment, useState } from 'react'
import { Eye } from 'lucide-react'
import { useStatusBoard } from '@/api/submissions'
import { ApiErrorView } from '@/components/ApiErrorView'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { SubmissionDetailView } from '@/components/submissions/SubmissionDetailView'
import { formatKst } from '@/lib/datetime'

/**
 * [운영진] 제출 현황판 (#22) - 현재 수강생 명단(이름순) x 상태/횟수/최근 제출. 미제출자도 행으로 보인다.
 * "열람" = 최신 제출(대표)을 펼쳐 코드(#20)·파일(#21) 확인. 전체 이력 열람은 P2.
 */
export function StatusBoard({ cohortId, assignmentId }: { cohortId: number; assignmentId: number }) {
  const query = useStatusBoard(cohortId, assignmentId, true)
  const [openUserId, setOpenUserId] = useState<number | null>(null)

  if (query.isPending) return <p className="text-sm text-muted-foreground">현황판을 불러오는 중...</p>
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const rows = query.data
  const submitted = rows.filter((r) => r.status !== 'NOT_SUBMITTED').length

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">제출 현황판 (운영진)</h2>
        <p className="text-xs text-muted-foreground">
          제출 {submitted} / {rows.length}명
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">이 분반에 수강생이 없어요.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-3 py-2 text-left font-bold">이름</th>
                <th className="px-2 py-2 text-center font-bold">상태</th>
                <th className="px-2 py-2 text-center font-bold">제출 횟수</th>
                <th className="px-2 py-2 text-center font-bold">최근 제출</th>
                <th className="px-2 py-2 text-center font-bold">제출물</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.user.id}>
                  <tr className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium">{row.user.name}</td>
                    <td className="px-2 py-2.5 text-center">
                      <SubmissionStatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono">{row.submissionCount}</td>
                    <td className="px-2 py-2.5 text-center font-mono text-xs">
                      {row.lastSubmittedAt === null ? '-' : formatKst(row.lastSubmittedAt)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {row.latestSubmissionId === null ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpenUserId(openUserId === row.user.id ? null : row.user.id)}
                          aria-expanded={openUserId === row.user.id}
                          aria-label={`${row.user.name} 최신 제출 열람`}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                        >
                          <Eye className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {openUserId === row.user.id && row.latestSubmissionId !== null && (
                    <tr className="border-b bg-muted/20 last:border-0">
                      <td colSpan={5}>
                        <SubmissionDetailView cohortId={cohortId} assignmentId={assignmentId} submissionId={row.latestSubmissionId} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">열람은 최신 제출 기준이에요. 파일 다운로드는 펼친 제출물 안에서 할 수 있습니다.</p>
    </section>
  )
}
