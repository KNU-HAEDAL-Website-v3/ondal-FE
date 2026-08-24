import { Link } from 'react-router'
import { CalendarClock, CircleCheckBig, FileText, GraduationCap, Play, UserCheck } from 'lucide-react'
import { useMe } from '@/api/auth'
import type { CohortResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/StatCard'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - 과제/제출 BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_SUBMISSIONS = [
  { id: 1, problem: 'Valid Parentheses', language: 'Python 3', result: '틀렸습니다', tone: 'red', submittedAt: '1시간 전' },
  { id: 2, problem: 'Valid Parentheses', language: 'Python 3', result: '컴파일 에러', tone: 'yellow', submittedAt: '어제' },
  { id: 3, problem: 'Binary Search', language: 'Python 3', result: '맞았습니다', tone: 'green', submittedAt: '2일 전' },
] as const

const RESULT_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
}

/** 수강자 홈 대시보드 (피그마 28:368) */
export function StudentDashboard({ cohorts }: { cohorts: CohortResponse[] }) {
  const { data: me } = useMe()
  const activeCohort = cohorts.find((c) => c.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">안녕하세요, {me?.name}님</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#464555]">
            <GraduationCap className="size-4" />
            {activeCohort ? activeCohort.name : '소속된 분반이 없어요'}
          </p>
        </div>
        <Button className="rounded-[2px]" asChild>
          <Link to="/assignments">
            <Play data-icon="inline-start" />
            이어서 학습하기
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="진행 중인 과제" value="2" unit="개" icon={FileText} iconClassName="bg-secondary text-primary" />
        <StatCard
          label="과제 마감 D-Day"
          value="D-1"
          valueClassName="text-destructive"
          icon={CalendarClock}
          iconClassName="bg-[#ffdad6] text-destructive"
        />
        <StatCard
          label="최근 제출 결과"
          value="정답"
          valueClassName="text-[#16a34a]"
          icon={CircleCheckBig}
          iconClassName="bg-[#dcfce7] text-[#16a34a]"
        />
        <StatCard label="전체 출석률" value="95" unit="%" icon={UserCheck} iconClassName="bg-secondary text-primary" />
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-xl font-bold">최근 제출 결과</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">문제명</th>
                <th className="px-2 py-2 text-center font-bold">언어</th>
                <th className="px-2 py-2 text-center font-bold">결과</th>
                <th className="px-4 py-2 text-right font-bold">제출 시각</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_SUBMISSIONS.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono">{s.problem}</td>
                  <td className="px-2 py-3 text-center font-mono text-[#464555]">{s.language}</td>
                  <td className="px-2 py-3 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', RESULT_TONES[s.tone])}>
                      {s.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-muted-foreground">{s.submittedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-center">
          <Button variant="link" size="sm" asChild>
            <Link to="/submissions">더보기</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
