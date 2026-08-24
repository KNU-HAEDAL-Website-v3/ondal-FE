import { Link } from 'react-router'
import { CalendarDays, ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Assignment BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_ASSIGNMENTS = [
  {
    id: 4,
    title: '4주차 과제',
    description: '동적 계획법(Dynamic Programming) 기초 및 응용 문제 풀이',
    dday: 'D-1',
    status: '진행 중',
    tone: 'green',
    solved: 3,
    total: 5,
    deadline: '2026.08.29 23:59',
    inProgress: true,
  },
  {
    id: 3,
    title: '3주차 과제',
    description: '그래프 탐색 (BFS/DFS) 및 최단 경로 알고리즘',
    dday: '완료',
    status: '제출 완료',
    tone: 'blue',
    solved: 5,
    total: 5,
    deadline: '2026.08.22 23:59',
    inProgress: false,
  },
] as const

const STATUS_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  blue: 'bg-[#dbeafe] text-[#1d4ed8]',
}

/** 과제 목록 (피그마 28:1317) - 주차별 과제 카드 그리드 */
export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">과제</h1>
          <p className="mt-1 text-sm text-muted-foreground">주차별 과제와 문제 목록</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          <ListFilter data-icon="inline-start" />
          필터
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_ASSIGNMENTS.map((a) => {
          const percent = Math.round((a.solved / a.total) * 100)
          return (
            <Link
              key={a.id}
              to={`/assignments/${a.id}`}
              className={cn(
                'rounded-lg border bg-card p-4 transition-shadow hover:shadow-md',
                a.inProgress && 'border-l-4 border-l-primary',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-[2px] bg-muted px-2 py-0.5 text-xs font-semibold text-[#464555]">{a.dday}</span>
                <span className={cn('rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[a.tone])}>{a.status}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{a.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
              <div className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#464555]">
                    진행률 ({a.solved}/{a.total})
                  </span>
                  <span className="font-mono font-semibold">{percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e3e1ec]">
                  <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  마감: {a.deadline}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
