import { Link } from 'react-router'
import type { HojSubmissionItem } from '@/api/types'
import { VerdictBadge } from '@/components/judge/VerdictBadge'
import { formatKst } from '@/lib/datetime'

/**
 * 연습 제출 피드 표 (HOJ P3) - 채점 현황(/problems/status)과 사용자 페이지 "최근 제출"이 같이 쓴다.
 * 열: 시간 · 사용자(→사용자 페이지) · 문제(→상세) · 언어 · 결과 · 통과 · 시간/메모리. 값은 전부 서버 그대로, 코드는 싣지 않는다.
 * 빈 상태·로딩은 호출자가 그린다 - 여기는 행이 1개 이상일 때의 표만
 */
export function SubmissionFeedTable({ items, showUser = true }: { items: HojSubmissionItem[]; showUser?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
            <th className="px-4 py-2 text-left font-bold whitespace-nowrap">시간</th>
            {showUser && <th className="px-2 py-2 text-left font-bold whitespace-nowrap">사용자</th>}
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">문제</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">언어</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">결과</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">통과</th>
            <th className="px-4 py-2 text-right font-bold whitespace-nowrap">시간 / 메모리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-secondary/40">
              <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">{formatKst(item.submittedAt)}</td>
              {showUser && (
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <Link to={`/problems/users/${item.user.id}`} className="font-medium hover:underline">
                    {item.user.name}
                  </Link>
                </td>
              )}
              {/* 좁은 화면에서 제목이 한 글자씩 꺾이지 않게 최소 폭 - 표는 overflow-x-auto 로 가로 스크롤 */}
              <td className="min-w-[12rem] px-2 py-2.5">
                <Link to={`/problems/${item.problem.id}`} className="hover:underline">
                  <span className="font-mono font-semibold text-primary">#{item.problem.problemNo}</span>
                  <span className="ml-1.5">{item.problem.title}</span>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-xs whitespace-nowrap">{item.language}</td>
              <td className="px-2 py-2.5 text-center">
                <VerdictBadge status={item.judgeStatus} verdict={item.verdict} />
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs whitespace-nowrap text-muted-foreground">
                {item.verdict === null ? '-' : `${item.passedCases}/${item.totalCases}`}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap text-muted-foreground">
                {item.maxTimeMs === null ? '-' : `${item.maxTimeMs} ms`} / {item.maxMemoryKb === null ? '-' : `${Math.round(item.maxMemoryKb / 1024)} MB`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
