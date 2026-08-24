import {
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Clock,
  Download,
} from 'lucide-react'
import { AttendanceStatCard } from '@/components/attendance/AttendanceStatCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Attendance BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_SUMMARY = { total: 32, present: 28, late: 2, absent: 2, todayRate: 88 }

const SAMPLE_ROWS = [
  { id: 1, name: '김철수', group: '5기 / A반', time: '08:55 AM', status: '출석', tone: 'green', rate: 100, barTone: 'indigo' },
  { id: 2, name: '이영희', group: '5기 / A반', time: '08:58 AM', status: '출석', tone: 'green', rate: 98, barTone: 'indigo' },
  { id: 3, name: '박지민', group: '5기 / A반', time: '09:15 AM', late: true, status: '지각', tone: 'yellow', rate: 92, barTone: 'amber' },
  { id: 4, name: '최동훈', group: '5기 / A반', time: '-', status: '결석', tone: 'red', rate: 85, barTone: 'red' },
  { id: 5, name: '정수진', group: '5기 / A반', time: '08:45 AM', status: '출석', tone: 'green', rate: 100, barTone: 'indigo' },
] as const

const STATUS_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
}

const BAR_TONES: Record<string, string> = {
  indigo: 'bg-[#4f46e5]',
  amber: 'bg-[#d97706]',
  red: 'bg-[#ba1a1a]',
}

/** 교육운영진 출결 관리 (피그마 28:1013) - 출결 요약 + 필터 + 수강생별 출결 테이블 */
export function OperatorAttendanceView() {
  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">출결 관리</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AttendanceStatCard label="전체 수강생" value={String(SAMPLE_SUMMARY.total)} unit="명" labelClassName="text-muted-foreground" />
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
        <AttendanceStatCard
          label="오늘 출석률"
          value={`${SAMPLE_SUMMARY.todayRate}%`}
          className="border-transparent bg-[#4f46e5] text-white"
          labelClassName="text-white/80"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Button variant="outline" size="sm" className="rounded-[2px]">
          <CalendarDays data-icon="inline-start" />
          2026-08-24
        </Button>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          기수: 5기
          <ChevronDown data-icon="inline-end" />
        </Button>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          반: A반
          <ChevronDown data-icon="inline-end" />
        </Button>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          상태: 전체
          <ChevronDown data-icon="inline-end" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-[2px]">
            <Download data-icon="inline-start" />
            출석부 다운로드
          </Button>
          <Button size="sm" className="rounded-[2px]">
            <CheckCheck data-icon="inline-start" />
            일괄 출석 처리
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="w-10 px-4 py-2">
                  <input type="checkbox" className="size-4 accent-primary" aria-label="전체 선택" />
                </th>
                <th className="px-2 py-2 text-left font-bold">수강생 이름</th>
                <th className="px-2 py-2 text-center font-bold">기수 / 반</th>
                <th className="px-2 py-2 text-center font-bold">출석 시간</th>
                <th className="px-2 py-2 text-center font-bold">출석 상태</th>
                <th className="px-4 py-2 text-right font-bold">출석률</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" className="size-4 accent-primary" aria-label={`${s.name} 선택`} />
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e3e1ec] text-[11px] font-semibold text-[#5d5e66]">
                        {s.name.charAt(0)}
                      </span>
                      <span className="font-medium">{s.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-[#464555]">{s.group}</td>
                  <td className={cn('px-2 py-3 text-center font-mono', 'late' in s && 'font-bold text-destructive')}>{s.time}</td>
                  <td className="px-2 py-3 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[s.tone])}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className={cn('font-mono text-xs font-semibold', s.barTone === 'red' && 'text-destructive')}>
                        {s.rate}%
                      </span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e3e1ec]">
                        <span className={cn('block h-full rounded-full', BAR_TONES[s.barTone])} style={{ width: `${s.rate}%` }} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">32명 중 5명 표시</p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="이전 페이지" disabled>
              <ChevronLeft />
            </Button>
            <Button size="sm" className="rounded-[2px] px-2.5">1</Button>
            <Button variant="outline" size="sm" className="rounded-[2px] px-2.5">2</Button>
            <Button variant="outline" size="sm" className="rounded-[2px] px-2.5">3</Button>
            <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="다음 페이지">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
