import { CircleCheckBig, Code, ListFilter, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/StatCard'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Problem BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_PROBLEMS = [
  { no: 1, title: '1로 만들기', assignment: '3주차 과제', status: '정답', tone: 'indigo', acceptRate: '92%', action: '보기' },
  { no: 2, title: '피보나치 함수', assignment: '3주차 과제', status: '오답', tone: 'red', acceptRate: '78%', action: '재시도' },
  { no: 3, title: '계단 오르기', assignment: '3주차 과제', status: '정답', tone: 'indigo', acceptRate: '85%', action: '보기' },
  { no: 4, title: 'LCS (Longest Common Subsequence)', assignment: '3주차 과제', status: '시간 초과', tone: 'amber', acceptRate: '43%', action: '재시도' },
  { no: 5, title: '동전 1', assignment: '3주차 과제', status: '미제출', tone: 'gray', acceptRate: '66%', action: '풀기' },
  { no: 6, title: 'Valid Parentheses', assignment: '4주차 과제', status: '오답', tone: 'red', acceptRate: '71%', action: '재시도' },
  { no: 7, title: 'Binary Search', assignment: '4주차 과제', status: '정답', tone: 'indigo', acceptRate: '88%', action: '보기' },
] as const

const STATUS_TONES: Record<string, string> = {
  indigo: 'bg-[#e0e7ff] text-primary',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
  amber: 'bg-[#92400e] text-white',
  gray: 'bg-[#e3e1ec] text-[#5d5e66]',
}

/** 문제 목록 - 과제 상세(피그마 28:1433)의 문제 테이블 패턴을 전체 문제 모음으로 확장 */
export default function ProblemsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">문제</h1>
          <p className="mt-1 text-sm text-muted-foreground">과제로 배정된 전체 문제 모음</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          <ListFilter data-icon="inline-start" />
          필터
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 문제" value="7" unit="개" icon={Code} iconClassName="bg-secondary text-primary" />
        <StatCard
          label="해결한 문제"
          value="3"
          unit="개"
          valueClassName="text-[#16a34a]"
          icon={CircleCheckBig}
          iconClassName="bg-[#dcfce7] text-[#16a34a]"
        />
        <StatCard label="전체 정답률" value="74" unit="%" icon={Target} iconClassName="bg-secondary text-primary" />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
              <th className="px-4 py-2 text-left font-bold">번호</th>
              <th className="px-2 py-2 text-left font-bold">문제 제목</th>
              <th className="px-2 py-2 text-center font-bold">과제</th>
              <th className="px-2 py-2 text-center font-bold">상태</th>
              <th className="px-2 py-2 text-center font-bold">정답률</th>
              <th className="px-4 py-2 text-center font-bold">액션</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_PROBLEMS.map((p) => (
              <tr key={p.no} className="border-b last:border-0">
                <td className="px-4 py-4 font-medium">문제 {p.no}</td>
                <td className="px-2 py-4">{p.title}</td>
                <td className="px-2 py-4 text-center text-[#464555]">{p.assignment}</td>
                <td className="px-2 py-4 text-center">
                  <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[p.tone])}>
                    {p.status}
                  </span>
                </td>
                <td className="px-2 py-4 text-center font-mono">{p.acceptRate}</td>
                <td className="px-4 py-4 text-center">
                  <Button variant="outline" size="sm" className="rounded-[2px]">
                    {p.action}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
