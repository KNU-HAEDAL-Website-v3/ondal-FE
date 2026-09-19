import { Link } from 'react-router'
import { CalendarClock, CircleCheckBig, FileText, GraduationCap, Megaphone, Play, UserCheck } from 'lucide-react'
import { useAssignments } from '@/api/assignments'
import { useMyAttendance } from '@/api/attendances'
import { useMe } from '@/api/auth'
import { useNotices } from '@/api/notices'
import type { CohortResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/StatCard'
import { SubmissionStatusBadge } from '@/components/submissions/SubmissionStatusBadge'
import { ddayLabel, formatKst, isOverdue } from '@/lib/datetime'

/**
 * 수강자 홈 대시보드 (피그마 28:368) - 첫 ACTIVE 분반 기준 실데이터 요약.
 * 카드·목록 값은 전부 서버 응답(과제 myStatus·출석 rate·공지 pinned) - 프론트는 세고 고르기만 한다 (CLAUDE.md 규칙 4).
 * 채점 결과 위젯은 자동 채점(P2 Judge0) 전까지 두지 않는다 - 가짜 결과를 보이지 않게. 대신 마감 임박 과제와 필독 공지.
 */
export function StudentDashboard({ cohorts }: { cohorts: CohortResponse[] }) {
  const { data: me } = useMe()
  const activeCohort = cohorts.find((c) => c.status === 'ACTIVE')
  const cohortId = activeCohort?.id ?? NaN
  const assignmentsQuery = useAssignments(cohortId)
  const attendanceQuery = useMyAttendance(cohortId)
  const noticesQuery = useNotices()

  const assignments = assignmentsQuery.data ?? []
  // 진행 중 = 마감 전. 가까운 마감 순
  const open = assignments.filter((a) => !isOverdue(a.dueAt)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const nearest = open[0]
  const submitted = assignments.filter((a) => a.myStatus !== null && a.myStatus !== 'NOT_SUBMITTED').length
  const rate = attendanceQuery.data?.summary.rate ?? null
  const notices = (noticesQuery.data ?? []).slice(0, 3) // 서버 정렬 = 필독 먼저 → 최신순
  const loaded = activeCohort !== undefined && !assignmentsQuery.isPending

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">안녕하세요, {me?.name}님</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <GraduationCap className="size-4" />
            {activeCohort ? activeCohort.name : '소속된 분반이 없어요'}
          </p>
        </div>
        {activeCohort && (
          <Button asChild>
            <Link to={nearest ? `/assignments/${nearest.id}?cohort=${cohortId}` : `/assignments?cohort=${cohortId}`}>
              <Play data-icon="inline-start" />
              {nearest ? '가장 급한 과제로' : '과제 보기'}
            </Link>
          </Button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="진행 중인 과제" value={loaded ? String(open.length) : '-'} unit="개" icon={FileText} iconClassName="bg-secondary text-primary" />
        <StatCard
          label="가장 가까운 마감"
          value={loaded && nearest ? ddayLabel(nearest.dueAt) : '-'}
          valueClassName={nearest ? 'text-destructive' : undefined}
          icon={CalendarClock}
          iconClassName="bg-danger-bg text-destructive"
        />
        <StatCard
          label="제출한 과제"
          value={loaded ? String(submitted) : '-'}
          unit={loaded ? `/ ${assignments.length}개` : undefined}
          valueClassName="text-success"
          icon={CircleCheckBig}
          iconClassName="bg-success-bg text-success"
        />
        <StatCard
          label="전체 출석률"
          value={attendanceQuery.isPending && activeCohort ? '-' : rate === null ? '-' : String(rate)}
          unit={rate === null ? undefined : '%'}
          icon={UserCheck}
          iconClassName="bg-secondary text-primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight">마감 임박 과제</h2>
            {activeCohort && (
              <Button variant="link" size="sm" asChild>
                <Link to={`/assignments?cohort=${cohortId}`}>전체 과제</Link>
              </Button>
            )}
          </div>
          {!activeCohort ? (
            <p className="mt-4 text-sm text-muted-foreground">분반에 배정되면 과제가 여기에 표시됩니다.</p>
          ) : assignmentsQuery.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">과제 불러오는 중...</p>
          ) : assignmentsQuery.error ? (
            <p className="mt-4 text-sm text-destructive">{assignmentsQuery.error.message}</p>
          ) : open.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">진행 중인 과제가 없어요. 수고했어요!</p>
          ) : (
            <ul className="mt-4 divide-y">
              {open.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/assignments/${a.id}?cohort=${cohortId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:bg-secondary/40"
                  >
                    <span className="font-mono font-semibold text-primary">#{a.problemNo}</span>
                    <span className="font-semibold">{a.title}</span>
                    {a.myStatus !== null && <SubmissionStatusBadge status={a.myStatus} />}
                    <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className="rounded-md bg-success-bg px-1.5 py-0.5 font-semibold text-success">{ddayLabel(a.dueAt)}</span>
                      {formatKst(a.dueAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight">공지</h2>
            <Button variant="link" size="sm" asChild>
              <Link to="/notices">전체 보기</Link>
            </Button>
          </div>
          {noticesQuery.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">공지 불러오는 중...</p>
          ) : notices.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">아직 공지가 없어요.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link to={`/notices/${n.id}`} className="flex items-start gap-2 rounded-md border p-3 text-sm hover:bg-secondary/40">
                    <Megaphone className={`mt-0.5 size-4 shrink-0 ${n.pinned ? 'text-danger' : 'text-primary'}`} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {n.pinned && <span className="rounded-md bg-danger-bg px-1.5 py-0.5 text-[11px] font-bold text-danger">필독</span>}
                        <span className="truncate font-semibold">{n.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{n.cohort?.name ?? '전체 공지'} · {n.author.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
