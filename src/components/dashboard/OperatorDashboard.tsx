import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  EllipsisVertical,
  ListFilter,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/StatCard'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - 과제/출석 BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_STUDENTS = [
  { id: 1, name: '김철수', className: 'A반', attendance: '100%', submission: '95%', lastSubmit: '10분 전', status: '우수', tone: 'green' },
  { id: 2, name: '이영희', className: 'A반', attendance: '85%', submission: '80%', lastSubmit: '2시간 전', status: '주의', tone: 'yellow' },
  { id: 3, name: '박지민', className: 'B반', attendance: '60%', submission: '75%', lastSubmit: '1일 전', status: '위험', tone: 'red', attendanceLow: true },
  { id: 4, name: '정민준', className: 'A반', attendance: '98%', submission: '100%', lastSubmit: '5분 전', status: '우수', tone: 'green' },
  { id: 5, name: '최수아', className: 'B반', attendance: '92%', submission: '90%', lastSubmit: '3시간 전', status: '정상', tone: 'blue' },
] as const

const STATUS_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
  blue: 'bg-[#dbeafe] text-[#1d4ed8]',
}

const SAMPLE_TODOS = [
  { id: 1, title: '출석 미체크 학생 확인', detail: '박지민 외 14명 출석 확인 필요' },
  { id: 2, title: '신규 과제 제출 확인', detail: '자료구조 3주차 과제 12건 미채점' },
  { id: 3, title: '교육 일지 작성', detail: '오늘 18:00까지' },
  { id: 4, title: 'A반 Q&A 세션 준비', detail: '자주 나온 알고리즘 질문 정리' },
] as const

/** 교육운영진 홈 대시보드 (피그마 28:35) */
export function OperatorDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">교육운영진 대시보드</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-[2px]">
            <Download data-icon="inline-start" />
            리포트 다운로드
          </Button>
          <Button className="rounded-[2px]">
            <Plus data-icon="inline-start" />
            과제 내기
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 수강생" value="32" unit="명" icon={Users} iconClassName="bg-secondary text-primary" />
        <StatCard label="오늘 출석률" value="91" unit="%" icon={UserCheck} iconClassName="bg-secondary text-primary" />
        <StatCard
          label="미채점 과제"
          value="12"
          unit="건"
          icon={ClipboardList}
          iconClassName="bg-[#fef3c7] text-[#854d0e]"
        />
        <StatCard
          label="마감 임박 과제"
          value="2"
          unit="개"
          valueClassName="text-destructive"
          icon={CalendarClock}
          iconClassName="bg-[#ffdad6] text-destructive"
          className="border-destructive/40"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">수강생 현황</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">수강생별 출석·과제 진행 상황</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-[2px]">
                기수 전체
                <ChevronDown data-icon="inline-end" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-[2px]">
                반 전체
                <ChevronDown data-icon="inline-end" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="필터">
                <ListFilter />
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-bold">이름</th>
                  <th className="px-2 py-2 text-center font-bold">반</th>
                  <th className="px-2 py-2 text-center font-bold">출석률</th>
                  <th className="px-2 py-2 text-center font-bold">과제 제출률</th>
                  <th className="px-2 py-2 text-center font-bold">최근 제출</th>
                  <th className="px-2 py-2 text-center font-bold">상태</th>
                  <th className="px-2 py-2 text-center font-bold">관리</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_STUDENTS.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-2 py-3 text-center text-[#464555]">{s.className}</td>
                    <td className={cn('px-2 py-3 text-center font-mono', 'attendanceLow' in s && 'font-bold text-destructive')}>
                      {s.attendance}
                    </td>
                    <td className="px-2 py-3 text-center font-mono">{s.submission}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground">{s.lastSubmit}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[s.tone])}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button type="button" aria-label={`${s.name} 관리`} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                        <EllipsisVertical className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">32명 중 5명 표시</p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="이전 페이지" disabled>
                <ChevronLeft />
              </Button>
              <Button size="sm" className="rounded-[2px] px-2" aria-label="다음 페이지">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-xl font-bold">오늘의 할 일</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">운영진 데일리 체크리스트</p>
          <ul className="mt-4 space-y-3">
            {SAMPLE_TODOS.map((todo) => (
              <li key={todo.id} className="flex items-start gap-3 rounded-md border p-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" aria-label={todo.title} />
                <div>
                  <p className="text-sm font-semibold">{todo.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{todo.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4 w-full rounded-[2px] border-dashed">
            <Plus data-icon="inline-start" />할 일 추가
          </Button>
        </section>
      </div>
    </div>
  )
}
