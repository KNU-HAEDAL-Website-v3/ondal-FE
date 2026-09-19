import { Fragment, useState } from 'react'
import { Download, Eye, Search } from 'lucide-react'
import { useStatusBoard } from '@/api/submissions'
import type { SubmissionStatus } from '@/api/types'
import { ApiErrorView } from '@/components/ApiErrorView'
import { VerdictBadge } from '@/components/judge/VerdictBadge'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { SubmissionDetailView } from '@/components/submissions/SubmissionDetailView'
import { downloadCsv, safeFileName, toCsv, todayStamp } from '@/lib/csv'
import { formatKst } from '@/lib/datetime'

type StatusFilter = 'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED' | 'LATE'
type VerdictFilter = 'ALL' | 'ACCEPTED' | 'NOT_ACCEPTED' | 'PENDING'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '상태 전체' },
  { value: 'SUBMITTED', label: '제출' },
  { value: 'LATE', label: '지각' },
  { value: 'NOT_SUBMITTED', label: '미제출' },
]
const VERDICT_OPTIONS: { value: VerdictFilter; label: string }[] = [
  { value: 'ALL', label: '판정 전체' },
  { value: 'ACCEPTED', label: '맞았습니다' },
  { value: 'NOT_ACCEPTED', label: '틀림·오류' },
  { value: 'PENDING', label: '채점 중' },
]

/** 상태 필터 - 서버 상태값 4종(제출·제출(추가)·지각·미제출)을 3묶음으로 */
function matchStatus(status: SubmissionStatus, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'SUBMITTED') return status === 'SUBMITTED' || status === 'SUBMITTED_EXTRA'
  return status === filter
}

/**
 * [운영진] 제출 현황판 (#22) - 현재 수강생 명단(이름순) x 상태/횟수/최근 제출/코멘트. 미제출자도 행으로 보인다.
 * "열람" = 최신 제출(대표)을 펼쳐 코드(#20)·파일(#21) 확인 + 코멘트 남기기(#45, canComment). 전체 이력 열람은 P2.
 * "코멘트" 열 = 최신 제출에 코멘트가 달렸는가(latestCommented) - 아직 검토하지 않은 제출을 한눈에.
 * "판정" 열 = 최신 제출의 자동 채점 판정(latestVerdict, judge/fe.md 3절) - 자동 채점 문제가 아니면 전부 '-'. 채점 중이면 2초 폴링.
 * 원안(교육운영진 과제 현황) 반영(2026-09-20): 상태·판정 필터 + 이름 검색(클라이언트), 범례, CSV 내려받기, 하단 "총 N명".
 */
export function StatusBoard({
  cohortId,
  assignmentId,
  canComment,
  title,
}: {
  cohortId: number
  assignmentId: number
  /** 코멘트 남기기·수정·지우기 가능 여부 - 운영진 + ACTIVE 분반. 표시는 서버 canManage 기준 */
  canComment: boolean
  /** CSV 파일명에 쓸 과제 이름 - 없으면 과제 id */
  title?: string
}) {
  const query = useStatusBoard(cohortId, assignmentId, true)
  const [openUserId, setOpenUserId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('ALL')
  const [keyword, setKeyword] = useState('')

  if (query.isPending) return <p className="text-sm text-muted-foreground">현황판을 불러오는 중...</p>
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const rows = query.data
  const submitted = rows.filter((r) => r.status !== 'NOT_SUBMITTED').length
  const judged = rows.some((r) => r.latestJudgeStatus !== null)
  const accepted = rows.filter((r) => r.latestVerdict === 'ACCEPTED').length
  const needle = keyword.trim().toLowerCase()
  const visible = rows.filter((r) => {
    if (!matchStatus(r.status, statusFilter)) return false
    if (verdictFilter === 'ACCEPTED' && r.latestVerdict !== 'ACCEPTED') return false
    if (verdictFilter === 'NOT_ACCEPTED' && (r.latestVerdict === null || r.latestVerdict === 'ACCEPTED')) return false
    if (verdictFilter === 'PENDING' && (r.latestJudgeStatus === null || r.latestVerdict !== null)) return false
    if (needle && !r.user.name.toLowerCase().includes(needle)) return false
    return true
  })
  const filtered = statusFilter !== 'ALL' || verdictFilter !== 'ALL' || needle !== ''

  const exportCsv = () => {
    const header = ['이름', '상태', '판정', '제출 횟수', '최근 제출(KST)', '코멘트']
    const body = visible.map((r) => [
      r.user.name,
      r.status,
      r.latestVerdict ?? (r.latestJudgeStatus ?? '-'),
      r.submissionCount,
      r.lastSubmittedAt === null ? '' : formatKst(r.lastSubmittedAt),
      r.latestSubmissionId === null ? '' : r.latestCommented ? '남김' : '아직',
    ])
    downloadCsv(`제출현황_${safeFileName(title ?? String(assignmentId))}_${todayStamp()}`, toCsv(header, body))
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">제출 현황판 (운영진)</h2>
        <p className="text-xs text-muted-foreground">
          {judged && (
            <>
              맞았습니다 <span className="font-mono">{accepted}</span> ·{' '}
            </>
          )}
          제출 {submitted} / {rows.length}명
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">이 분반에 수강생이 없어요.</p>
      ) : (
        <>
          {/* 원안: 상태 필터 · 검색 · 범례 한 줄 + 엑셀 다운로드 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="상태 필터"
              className="h-7 rounded-md border bg-card px-1.5 text-xs"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {judged && (
              <select
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value as VerdictFilter)}
                aria-label="판정 필터"
                className="h-7 rounded-md border bg-card px-1.5 text-xs"
              >
                {VERDICT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <label className="flex h-7 items-center gap-1 rounded-md border bg-card px-2">
              <Search className="size-3.5 text-muted-foreground" aria-hidden />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="수강생 이름"
                aria-label="수강생 검색"
                className="w-28 bg-transparent text-xs outline-none"
              />
            </label>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-muted-foreground">
              <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-success" aria-hidden />제출·맞음</span>
              <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-caution" aria-hidden />지각</span>
              <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-danger" aria-hidden />틀림·오류</span>
              <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-neutral" aria-hidden />미제출</span>
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-7 items-center gap-1 rounded-md border bg-card px-2 font-semibold text-muted-foreground hover:text-primary"
            >
              <Download className="size-3.5" aria-hidden />
              CSV
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">조건에 맞는 수강생이 없어요.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-bold">이름</th>
                    <th className="px-2 py-2 text-center font-bold">상태</th>
                    <th className="px-2 py-2 text-center font-bold">판정</th>
                    <th className="px-2 py-2 text-center font-bold">제출 횟수</th>
                    <th className="px-2 py-2 text-center font-bold">최근 제출</th>
                    <th className="px-2 py-2 text-center font-bold">코멘트</th>
                    <th className="px-2 py-2 text-center font-bold">제출물</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <Fragment key={row.user.id}>
                      <tr className="border-b last:border-0">
                        <td className="px-3 py-2.5 font-medium">{row.user.name}</td>
                        <td className="px-2 py-2.5 text-center">
                          <SubmissionStatusBadge status={row.status} />
                        </td>
                        <td className="px-2 py-2.5 text-center" data-judge-status={row.latestJudgeStatus ?? 'NONE'}>
                          {row.latestJudgeStatus === null ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <VerdictBadge status={row.latestJudgeStatus} verdict={row.latestVerdict} />
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">{row.submissionCount}</td>
                        <td className="px-2 py-2.5 text-center font-mono text-xs">
                          {row.lastSubmittedAt === null ? '-' : formatKst(row.lastSubmittedAt)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {row.latestSubmissionId === null ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : row.latestCommented ? (
                            <span className="inline-block rounded-md bg-info-bg px-2 py-0.5 text-xs font-bold text-info">남김</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">아직</span>
                          )}
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
                        <tr className="border-b bg-muted last:border-0">
                          <td colSpan={7}>
                            <SubmissionDetailView
                              cohortId={cohortId}
                              assignmentId={assignmentId}
                              submissionId={row.latestSubmissionId}
                              canComment={canComment}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>열람은 최신 제출 기준이에요. 파일 다운로드와 코멘트 남기기는 펼친 제출물 안에서 할 수 있습니다.</span>
            <span className="font-mono">{filtered ? `${visible.length} / 총 ${rows.length}명` : `총 ${rows.length}명`}</span>
          </p>
        </>
      )}
    </section>
  )
}
