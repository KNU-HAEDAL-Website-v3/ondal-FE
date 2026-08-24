import { Link, useParams } from 'react-router'
import { ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Assignment BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_DETAIL = {
  title: '3주차 과제',
  remaining: '마감까지 14일',
  description: [
    '알고리즘 기초 과정의 3주차 과제입니다. 동적 계획법(Dynamic Programming)의 기본 원리를 이해하고, 메모이제이션(Memoization)과 타뷸레이션(Tabulation) 기법을 활용하여 주어진 문제들을 최적화하여 해결해야 합니다. 모든 코드는 시간 복잡도 요구사항을 충족해야 합니다.',
    '** 여러분 몰라도 AI 사용하지 마시고 일단 혼자 해보세요!! 그래야 실력이 늘 수 있습니다!',
  ],
  startAt: '2026. 08. 15 00:00',
  deadline: '2026. 08. 29 23:59',
  solved: 2,
  total: 5,
}

const SAMPLE_PROBLEMS = [
  { no: 1, title: '1로 만들기', status: '정답', tone: 'indigo', score: '100 / 100', action: '보기' },
  { no: 2, title: '피보나치 함수', status: '오답', tone: 'red', score: '40 / 100', scoreLow: true, action: '재시도' },
  { no: 3, title: '계단 오르기', status: '정답', tone: 'indigo', score: '100 / 100', action: '보기' },
  { no: 4, title: 'LCS (Longest Common Subsequence)', status: '시간 초과', tone: 'amber', score: '0 / 100', scoreLow: true, action: '재시도' },
  { no: 5, title: '동전 1', status: '미제출', tone: 'gray', score: '-', action: '풀기' },
] as const

const STATUS_TONES: Record<string, string> = {
  indigo: 'bg-[#e0e7ff] text-primary',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
  amber: 'bg-[#92400e] text-white',
  gray: 'bg-[#e3e1ec] text-[#5d5e66]',
}

/** 과제 상세 (피그마 28:1433) - 과제 설명 + 기간 + 진행률 + 문제 목록 */
export default function AssignmentDetailPage() {
  const { assignmentId } = useParams()
  const percent = Math.round((SAMPLE_DETAIL.solved / SAMPLE_DETAIL.total) * 100)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="현재 위치">
          <Link to="/assignments" className="hover:text-foreground">
            과제
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{assignmentId}주차</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{SAMPLE_DETAIL.title}</h1>
          <span className="flex items-center gap-1.5 rounded-[2px] border bg-card px-3 py-1.5 text-xs font-semibold text-[#464555]">
            <Clock className="size-3.5" />
            {SAMPLE_DETAIL.remaining}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px_260px]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">과제 설명</h2>
          {SAMPLE_DETAIL.description.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-6 font-medium whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="flex flex-col justify-center gap-4 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">시작일</h2>
            <p className="mt-1 font-mono text-sm">{SAMPLE_DETAIL.startAt}</p>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-[0.55px] text-muted-foreground">마감일</h2>
            <p className="mt-1 font-mono text-sm font-bold text-destructive">{SAMPLE_DETAIL.deadline}</p>
          </div>
        </section>

        <section className="flex flex-col justify-center rounded-lg bg-[#4f46e5] p-4 text-white">
          <h2 className="text-xs font-bold tracking-[0.55px] text-white/80">진행률</h2>
          <p className="mt-1">
            <span className="text-3xl font-bold">{SAMPLE_DETAIL.solved}</span>
            <span className="ml-1 text-sm text-white/80">/ {SAMPLE_DETAIL.total} 완료</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold">문제 목록</h2>
          <p className="text-sm text-muted-foreground">전체 문제 수 : {SAMPLE_DETAIL.total}개</p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">번호</th>
                <th className="px-2 py-2 text-left font-bold">문제 제목</th>
                <th className="px-2 py-2 text-center font-bold">상태</th>
                <th className="px-2 py-2 text-center font-bold">채점 결과</th>
                <th className="px-4 py-2 text-center font-bold">액션</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PROBLEMS.map((p) => (
                <tr key={p.no} className="border-b last:border-0">
                  <td className="px-4 py-4 font-medium">문제 {p.no}</td>
                  <td className="px-2 py-4">{p.title}</td>
                  <td className="px-2 py-4 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[p.tone])}>
                      {p.status}
                    </span>
                  </td>
                  <td className={cn('px-2 py-4 text-center font-mono', 'scoreLow' in p && 'text-destructive')}>{p.score}</td>
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
      </section>
    </div>
  )
}
