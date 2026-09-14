import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, ClipboardList, Eye, Megaphone, Plus, UserCheck, Users } from 'lucide-react'
import { useAssignments } from '@/api/assignments'
import { useRoster } from '@/api/attendances'
import { useMe } from '@/api/auth'
import { useCohorts } from '@/api/cohorts'
import { useNotices } from '@/api/notices'
import { useSessions } from '@/api/sessions'
import { useStatusBoard } from '@/api/submissions'
import type { AssignmentResponse, CohortResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/StatCard'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { ddayLabel, formatKst, isOverdue } from '@/lib/datetime'

const DUE_SOON_DAYS = 7

/**
 * 교육운영진 홈 대시보드 (피그마 28:35) - 운영 분반 하나를 골라 실데이터 요약 (docs/mvp-scope.md "운영진 · 파악: 현황판").
 * - 분반 선택지: 관리자 = 진행 중 분반 전부 / 운영진 = canManage 분반
 * - 카드: 수강생 수(분반 응답)·최근 차시 출석률(출석 명부 요약)·마감 임박 과제(7일 이내)·미제출 수강생(선택 과제의 현황판)
 * - 표: 선택한 과제의 제출 현황판(서버 판정값 그대로). 견본의 "할 일" 체크리스트는 서버 개념이 없어 빠른 이동으로 대체
 */
export function OperatorDashboard({ cohorts }: { cohorts: CohortResponse[] }) {
  const { data: me } = useMe()
  const isAdmin = me?.globalRole === 'ADMIN'
  const adminCohortsQuery = useCohorts('ACTIVE', isAdmin)
  const options = isAdmin ? (adminCohortsQuery.data ?? []) : cohorts.filter((c) => c.canManage)
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)
  const cohort = options.find((c) => c.id === selectedCohortId) ?? options[0]

  if (isAdmin && adminCohortsQuery.isPending) return <LoadingScreen label="대시보드 불러오는 중..." />
  if (isAdmin && adminCohortsQuery.error) {
    return <ApiErrorView error={adminCohortsQuery.error} onRetry={() => void adminCohortsQuery.refetch()} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">교육운영진 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort ? `${cohort.name} - 제출·출석 현황 한눈에` : '운영할 수 있는 분반이 없어요'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {options.length > 1 && (
            <select
              value={cohort?.id ?? ''}
              onChange={(e) => setSelectedCohortId(Number(e.target.value))}
              aria-label="분반 선택"
              className="h-8 rounded-[2px] border bg-card px-2 text-sm"
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {cohort && (
            <Button className="rounded-[2px]" asChild>
              <Link to={`/assignments/new?cohort=${cohort.id}`}>
                <Plus data-icon="inline-start" />
                과제 내기
              </Link>
            </Button>
          )}
        </div>
      </header>

      {cohort ? (
        <CohortOverview key={cohort.id} cohort={cohort} />
      ) : (
        <EmptyState
          title="운영할 분반이 없어요"
          description={isAdmin ? '분반 관리에서 분반을 만들고 운영진을 지정하세요.' : '분반의 운영진으로 지정되면 여기에서 현황을 볼 수 있어요.'}
        >
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/cohorts">분반 관리로</Link>
            </Button>
          )}
        </EmptyState>
      )}
    </div>
  )
}

function CohortOverview({ cohort }: { cohort: CohortResponse }) {
  const cohortId = cohort.id
  const assignmentsQuery = useAssignments(cohortId)
  const sessionsQuery = useSessions(cohortId)
  const noticesQuery = useNotices()
  const latestSession = sessionsQuery.data?.[sessionsQuery.data.length - 1]
  const rosterQuery = useRoster(cohortId, latestSession?.id ?? NaN)

  const assignments = assignmentsQuery.data ?? []
  const open = assignments.filter((a) => !isOverdue(a.dueAt)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const dueSoon = open.filter((a) => Date.parse(a.dueAt) - Date.now() <= DUE_SOON_DAYS * 86_400_000)
  // 현황판 대상: 기본 = 가장 가까운 마감의 진행 중 과제, 없으면 가장 최근 마감 과제
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const boardTarget: AssignmentResponse | undefined =
    assignments.find((a) => a.id === selectedAssignmentId) ?? open[0] ?? [...assignments].sort((a, b) => b.dueAt.localeCompare(a.dueAt))[0]
  const boardQuery = useStatusBoard(cohortId, boardTarget?.id ?? NaN, boardTarget !== undefined)
  const rows = boardQuery.data ?? []
  const notSubmitted = rows.filter((r) => r.status === 'NOT_SUBMITTED').length
  const rate = rosterQuery.data?.summary.rate ?? null
  const notices = (noticesQuery.data ?? []).filter((n) => n.cohort === null || n.cohort.id === cohortId).slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 수강생" value={String(cohort.studentCount ?? 0)} unit="명" icon={Users} iconClassName="bg-secondary text-primary" />
        <StatCard
          label={latestSession ? `최근 차시 출석률 (${latestSession.sessionNo}차시)` : '최근 차시 출석률'}
          value={rosterQuery.isPending && latestSession ? '-' : rate === null ? '-' : String(rate)}
          unit={rate === null ? undefined : '%'}
          icon={UserCheck}
          iconClassName="bg-secondary text-primary"
        />
        <StatCard
          label={`마감 임박 과제 (${DUE_SOON_DAYS}일 이내)`}
          value={assignmentsQuery.isPending ? '-' : String(dueSoon.length)}
          unit="개"
          valueClassName={dueSoon.length > 0 ? 'text-destructive' : undefined}
          icon={CalendarClock}
          iconClassName="bg-[#ffdad6] text-destructive"
          className={dueSoon.length > 0 ? 'border-destructive/40' : undefined}
        />
        <StatCard
          label="미제출 수강생"
          value={boardTarget === undefined ? '-' : boardQuery.isPending ? '-' : String(notSubmitted)}
          unit={boardTarget ? `/ ${rows.length}명` : undefined}
          icon={ClipboardList}
          iconClassName="bg-[#fef3c7] text-[#854d0e]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">제출 현황</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">과제별 수강생 제출 · 미제출 · 지각 (서버 판정값)</p>
            </div>
            {assignments.length > 0 && (
              <select
                value={boardTarget?.id ?? ''}
                onChange={(e) => setSelectedAssignmentId(Number(e.target.value))}
                aria-label="현황 과제 선택"
                className="h-8 max-w-full rounded-[2px] border bg-card px-2 text-sm"
              >
                {[...assignments].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.problemNo} {a.title} · {isOverdue(a.dueAt) ? '마감' : ddayLabel(a.dueAt)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {assignmentsQuery.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">과제 불러오는 중...</p>
          ) : assignmentsQuery.error ? (
            <p className="mt-4 text-sm text-destructive">{assignmentsQuery.error.message}</p>
          ) : !boardTarget ? (
            <p className="mt-4 text-sm text-muted-foreground">
              아직 과제가 없어요.{' '}
              <Link to={`/assignments/new?cohort=${cohortId}`} className="text-primary underline-offset-2 hover:underline">
                첫 과제 내기
              </Link>
            </p>
          ) : boardQuery.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">현황판 불러오는 중...</p>
          ) : boardQuery.error ? (
            <p className="mt-4 text-sm text-destructive">{boardQuery.error.message}</p>
          ) : (
            <>
              <p className="mt-3 text-xs text-muted-foreground">
                마감 {formatKst(boardTarget.dueAt)} · 제출 {rows.length - notSubmitted} / {rows.length}명
              </p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">이 분반에 수강생이 없어요.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                        <th className="px-4 py-2 text-left font-bold">이름</th>
                        <th className="px-2 py-2 text-center font-bold">상태</th>
                        <th className="px-2 py-2 text-center font-bold">제출 횟수</th>
                        <th className="px-2 py-2 text-center font-bold">최근 제출</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.user.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{row.user.name}</td>
                          <td className="px-2 py-2.5 text-center">
                            <SubmissionStatusBadge status={row.status} />
                          </td>
                          <td className="px-2 py-2.5 text-center font-mono">{row.submissionCount}</td>
                          <td className="px-2 py-2.5 text-center font-mono text-xs text-muted-foreground">
                            {row.lastSubmittedAt === null ? '-' : formatKst(row.lastSubmittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 text-right">
                <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
                  <Link to={`/assignments/${boardTarget.id}?cohort=${cohortId}`}>
                    <Eye data-icon="inline-start" />
                    과제 상세·제출물 열람
                  </Link>
                </Button>
              </div>
            </>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-xl font-bold">빠른 이동</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {[
                { to: `/cohorts/${cohortId}`, label: '분반 페이지' },
                { to: `/cohorts/${cohortId}/members`, label: '명부 · 수강생 배정' },
                { to: '/attendance', label: '출결 관리' },
                { to: `/assignments?cohort=${cohortId}`, label: '과제 관리' },
                { to: `/cohorts/${cohortId}/questions`, label: 'Q&A 게시판' },
                { to: `/notices/new?cohort=${cohortId}`, label: '분반 공지 작성' },
              ].map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="block rounded-md border px-3 py-2 font-medium hover:bg-secondary/50">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">공지</h2>
              <Button variant="link" size="sm" asChild>
                <Link to="/notices">전체 보기</Link>
              </Button>
            </div>
            {noticesQuery.isPending ? (
              <p className="mt-3 text-sm text-muted-foreground">공지 불러오는 중...</p>
            ) : notices.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">아직 공지가 없어요.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link to={`/notices/${n.id}`} className="flex items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-secondary/40">
                      <Megaphone className={`mt-0.5 size-4 shrink-0 ${n.pinned ? 'text-[#ba1a1a]' : 'text-primary'}`} />
                      <span className="min-w-0 truncate font-semibold">{n.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
