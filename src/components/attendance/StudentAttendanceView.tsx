import { ChevronLeft, ChevronRight, CircleCheckBig, CircleX, Clock } from 'lucide-react'
import type { CohortResponse } from '@/api/types'
import { AttendanceStatCard } from '@/components/attendance/AttendanceStatCard'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Attendance BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_SUMMARY = { rate: 95, present: 6, late: 1, absent: 0 }

const SAMPLE_RECORDS = [
  { date: '2026-08-21', day: '금요일', session: '5차시', status: '출석', tone: 'green' },
  { date: '2026-08-20', day: '목요일', session: '4차시', status: '출석', tone: 'green' },
  { date: '2026-08-19', day: '수요일', session: '3차시', status: '지각', tone: 'yellow' },
  { date: '2026-08-18', day: '화요일', session: '2차시', status: '출석', tone: 'green' },
  { date: '2026-08-17', day: '월요일', session: '1차시', status: '미확인', tone: 'gray' },
] as const

const STATUS_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  gray: 'bg-[#e3e1ec] text-[#5d5e66]',
}

const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** 수강자 출석 현황 (피그마 28:836) - 전체 출석률 링 + 출석/지각/결석 요약 + 날짜별 기록 */
export function StudentAttendanceView({ cohorts }: { cohorts: CohortResponse[] }) {
  const activeCohort = cohorts.find((c) => c.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">출석 현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeCohort ? activeCohort.name : '소속된 분반이 없어요'}
        </p>
      </header>

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
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - SAMPLE_SUMMARY.rate / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-baseline justify-center pt-11">
              <span className="text-3xl font-bold">{SAMPLE_SUMMARY.rate}</span>
              <span className="text-sm font-semibold">%</span>
            </span>
          </div>
        </div>

        <AttendanceStatCard
          label="출석"
          value={String(SAMPLE_SUMMARY.present)}
          icon={CircleCheckBig}
          className="border-[#dcfce7] bg-[#f0fdf4] text-[#16a34a]"
        />
        <AttendanceStatCard
          label="지각"
          value={String(SAMPLE_SUMMARY.late)}
          icon={Clock}
          className="border-[#fef08a] bg-[#fefce8] text-[#b45309]"
        />
        <AttendanceStatCard
          label="결석"
          value={String(SAMPLE_SUMMARY.absent)}
          icon={CircleX}
          className="border-[#fecaca] bg-[#fef2f2] text-[#ba1a1a]"
        />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary px-4 py-3">
          <h2 className="text-base font-bold">날짜별 출석 기록</h2>
          <div className="flex items-center rounded-[4px] border bg-card">
            <button type="button" aria-label="이전 달" className="px-1.5 py-1 text-muted-foreground hover:bg-secondary">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-mono text-sm font-semibold">2026. 08</span>
            <button type="button" aria-label="다음 달" className="px-1.5 py-1 text-muted-foreground hover:bg-secondary">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">날짜</th>
                <th className="px-2 py-2 text-center font-bold">요일</th>
                <th className="px-2 py-2 text-center font-bold">차시</th>
                <th className="px-4 py-2 text-center font-bold">상태</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_RECORDS.map((r) => (
                <tr key={r.date} className="border-b last:border-0">
                  <td className="px-4 py-3.5 font-mono">{r.date}</td>
                  <td className="px-2 py-3.5 text-center text-[#464555]">{r.day}</td>
                  <td className="px-2 py-3.5 text-center">{r.session}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[r.tone])}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
