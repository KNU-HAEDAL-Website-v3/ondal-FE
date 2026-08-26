import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// [P2 이연 - 현재 라우트 미노출] 분반 전체 제출 기록 화면. 화면의 본체가 채점 결과(맞았습니다/시간/메모리)라
// 자동 채점(P2) 이후에 다시 붙인다 (docs submission/design.md 결정 8). P1 제출·이력은 과제 상세 안에 있다.
// 모양 잡기용 견본 데이터 - 채점 BE가 생기면 실제 데이터로 교체한다.
const SAMPLE_SUBMISSIONS = [
  { id: 6, submittedAt: '2026-08-24 14:02', problem: 'Valid Parentheses', language: 'Python 3', result: '틀렸습니다', tone: 'red', time: '82 ms', memory: '31,120 KB' },
  { id: 5, submittedAt: '2026-08-23 21:47', problem: 'Valid Parentheses', language: 'Python 3', result: '컴파일 에러', tone: 'yellow', time: '-', memory: '-' },
  { id: 4, submittedAt: '2026-08-22 18:10', problem: 'Binary Search', language: 'Python 3', result: '맞았습니다', tone: 'green', time: '64 ms', memory: '29,412 KB' },
  { id: 3, submittedAt: '2026-08-22 17:55', problem: 'Binary Search', language: 'Python 3', result: '시간 초과', tone: 'amber', time: '2,000 ms', memory: '30,004 KB' },
  { id: 2, submittedAt: '2026-08-21 20:31', problem: '계단 오르기', language: 'C++ 17', result: '맞았습니다', tone: 'green', time: '12 ms', memory: '2,180 KB' },
  { id: 1, submittedAt: '2026-08-20 19:02', problem: '피보나치 함수', language: 'Python 3', result: '틀렸습니다', tone: 'red', time: '45 ms', memory: '28,916 KB' },
] as const

const RESULT_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  red: 'bg-[#ffdad6] text-[#ba1a1a]',
  amber: 'bg-[#92400e] text-white',
}

/** 제출 이력 - 수강자 홈(피그마 28:368)의 최근 제출 테이블 패턴을 전체 이력으로 확장 */
export default function SubmissionsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">제출</h1>
          <p className="mt-1 text-sm text-muted-foreground">내 제출 이력과 채점 결과</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-[2px]">
          <ListFilter data-icon="inline-start" />
          필터
        </Button>
      </header>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">제출 시각</th>
                <th className="px-2 py-2 text-left font-bold">문제명</th>
                <th className="px-2 py-2 text-center font-bold">언어</th>
                <th className="px-2 py-2 text-center font-bold">결과</th>
                <th className="px-2 py-2 text-right font-bold">실행 시간</th>
                <th className="px-4 py-2 text-right font-bold">메모리</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_SUBMISSIONS.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-[#464555]">{s.submittedAt}</td>
                  <td className="px-2 py-3 font-medium">{s.problem}</td>
                  <td className="px-2 py-3 text-center font-mono text-[#464555]">{s.language}</td>
                  <td className="px-2 py-3 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', RESULT_TONES[s.tone])}>
                      {s.result}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-mono">{s.time}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.memory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">총 6건</p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="이전 페이지" disabled>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="다음 페이지" disabled>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
