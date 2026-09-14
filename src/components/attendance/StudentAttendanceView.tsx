import { useState, type ReactNode } from 'react'
import { Archive, CircleCheckBig, CircleX, Clock } from 'lucide-react'
import { useMyAttendance } from '@/api/attendances'
import type { CohortResponse } from '@/api/types'
import { AttendanceStatCard } from '@/components/attendance/AttendanceStatCard'
import { AttendanceStatusBadge } from '@/components/attendance/AttendanceStatusBadge'
import { Badge } from '@/components/ui/badge'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKstDate, weekdayLabel } from '@/lib/datetime'

const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * 수강자 출석 현황 (피그마 28:836) - 분반 선택 → 출석률 링 + 출석/지각/결석 카드 + 차시별 기록 (docs/attendance/fe.md 1절).
 * 출석률·요약·상태는 전부 서버 값(GET /attendances/me) - 요일만 heldOn 으로 계산한다.
 */
export function StudentAttendanceView({ cohorts }: { cohorts: CohortResponse[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const cohort = cohorts.find((c) => c.id === selectedId) ?? cohorts.find((c) => c.status === 'ACTIVE') ?? cohorts[0]
  const cohortId = cohort?.id ?? NaN
  const query = useMyAttendance(cohortId)

  if (!cohort) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState title="소속된 분반이 없어요" description="분반에 배정되면 출석 기록이 여기에 표시됩니다." />
      </div>
    )
  }
  if (query.isPending) return <LoadingScreen label="출석 정보 불러오는 중..." />
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const { summary, records } = query.data
  const rate = summary.rate

  return (
    <div className="space-y-6">
      <Header
        subtitle={cohort.name}
        archived={cohort.status === 'ARCHIVED'}
        selector={
          cohorts.length > 1 ? (
            <select
              value={cohort.id}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              aria-label="분반 선택"
              className="h-8 rounded-[2px] border bg-card px-2 text-sm"
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === 'ARCHIVED' ? ' (보관됨)' : ''}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-base font-bold">나의 전체 출석률</h2>
          <div className="relative">
            <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
              <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="12" className="stroke-[#e3e1ec]" />
              <circle
                cx="60"
                cy="60"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
                className="stroke-[#4f46e5]"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - (rate ?? 0) / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-baseline justify-center pt-11" data-testid="attendance-rate">
              <span className="text-3xl font-bold">{rate ?? '-'}</span>
              {rate !== null && <span className="text-sm font-semibold">%</span>}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {rate === null ? '아직 판정된 차시가 없어요' : `판정된 ${summary.present + summary.late + summary.absent}차시 기준 · 미확인 ${summary.unchecked}`}
          </p>
        </div>

        <AttendanceStatCard label="출석" value={String(summary.present)} icon={CircleCheckBig} className="border-[#dcfce7] bg-[#f0fdf4] text-[#16a34a]" />
        <AttendanceStatCard label="지각" value={String(summary.late)} icon={Clock} className="border-[#fef08a] bg-[#fefce8] text-[#b45309]" />
        <AttendanceStatCard label="결석" value={String(summary.absent)} icon={CircleX} className="border-[#fecaca] bg-[#fef2f2] text-[#ba1a1a]" />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary px-4 py-3">
          <h2 className="text-base font-bold">차시별 출석 기록</h2>
          <span className="text-xs text-muted-foreground">전체 {records.length}차시 · 최신 차시 먼저</span>
        </div>
        {records.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">아직 등록된 차시가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-bold">날짜</th>
                  <th className="px-2 py-2 text-center font-bold">요일</th>
                  <th className="px-2 py-2 text-left font-bold">차시</th>
                  <th className="px-4 py-2 text-center font-bold">상태</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.session.id} className="border-b last:border-0">
                    <td className="px-4 py-3.5 font-mono">{formatKstDate(r.session.heldOn)}</td>
                    <td className="px-2 py-3.5 text-center text-[#464555]">{weekdayLabel(r.session.heldOn)}</td>
                    <td className="px-2 py-3.5">
                      <span className="font-semibold">{r.session.sessionNo}차시</span>
                      {r.session.title && <span className="ml-1.5 text-muted-foreground">{r.session.title}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <AttendanceStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Header({ subtitle, archived, selector }: { subtitle?: string; archived?: boolean; selector?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">출석 현황</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {subtitle ?? '소속된 분반이 없어요'}
          {archived && (
            <Badge variant="outline">
              <Archive data-icon="inline-start" />
              보관됨
            </Badge>
          )}
        </p>
      </div>
      {selector}
    </header>
  )
}
