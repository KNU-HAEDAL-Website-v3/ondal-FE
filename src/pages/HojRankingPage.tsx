import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheckBig, Medal, Trophy } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useCohorts, useMyCohorts } from '@/api/cohorts'
import { useHojRanking } from '@/api/hoj'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { StatCard } from '@/components/dashboard/StatCard'
import { Badge } from '@/components/ui/badge'
import { formatKst } from '@/lib/datetime'
import { isAdminRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

/**
 * 랭킹 - 푼 문제 수 기준 (/problems/ranking, P3 - docs hoj/api.md 4절·10절, 결정 13). 점수·티어는 없다.
 * 순위·동점(1, 1, 3)·정렬은 전부 서버 값 그대로. 분반 필터 = 내 분반(관리자는 진행 중인 전체 분반, useCohorts). 내 행은 강조하고 위에 "내 순위" 카드.
 */
export default function HojRankingPage() {
  const { data: me } = useMe()
  const isAdmin = isAdminRole(me?.globalRole)
  const myCohortsQuery = useMyCohorts()
  const allCohortsQuery = useCohorts('ACTIVE', isAdmin)
  const [cohortId, setCohortId] = useState<number | null>(null)
  const rankingQuery = useHojRanking(cohortId)

  const cohortOptions = (isAdmin ? allCohortsQuery.data : myCohortsQuery.data) ?? []
  const ranking = rankingQuery.data
  const mine = ranking?.me ?? null

  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">랭킹</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          푼 문제 수로 줄을 세워요. 같은 수면 먼저 도달한 사람이 앞이고, 동점은 같은 순위예요. 점수·티어는 없어요.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="내 순위"
          value={mine ? `#${mine.rank}` : '-'}
          unit={mine ? undefined : '아직 푼 문제가 없어요'}
          icon={Trophy}
          valueClassName={mine ? 'text-primary' : undefined}
          iconClassName="bg-secondary text-primary"
        />
        <StatCard
          label="내가 푼 문제"
          value={String(mine?.solvedCount ?? 0)}
          unit="개"
          icon={CircleCheckBig}
          valueClassName="text-success"
          iconClassName="bg-success-bg text-success"
        />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card" aria-label="랭킹 표">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-base font-bold">{cohortId === null ? '전체' : (cohortOptions.find((c) => c.id === cohortId)?.name ?? '분반')} 랭킹</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            분반
            <select
              value={cohortId ?? ''}
              onChange={(e) => setCohortId(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="분반 필터"
              className="h-8 rounded-lg border bg-card px-2 text-sm text-foreground"
            >
              <option value="">전체</option>
              {cohortOptions.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                  {cohort.status === 'ARCHIVED' ? ' (보관됨)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rankingQuery.isPending ? (
          <LoadingScreen label="랭킹 불러오는 중..." />
        ) : rankingQuery.error ? (
          <ApiErrorView error={rankingQuery.error} onRetry={() => void rankingQuery.refetch()} />
        ) : ranking && ranking.items.length === 0 ? (
          <EmptyState compact icon={<Trophy className="size-8" />} title="아직 문제를 푼 사람이 없어요" description="첫 정답을 맞히면 여기 1위에 이름이 올라가요." />
        ) : (
          ranking && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                      <th className="px-4 py-2 text-left font-bold whitespace-nowrap">순위</th>
                      <th className="px-2 py-2 text-left font-bold whitespace-nowrap">이름</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">푼 문제</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">제출</th>
                      <th className="px-4 py-2 text-right font-bold whitespace-nowrap">마지막 정답</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.items.map((row) => {
                      const isMe = me?.id === row.user.id
                      return (
                        <tr key={row.user.id} className={cn('border-b last:border-0', isMe ? 'bg-secondary font-semibold' : 'hover:bg-secondary/40')} aria-current={isMe ? 'true' : undefined}>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                            <span className={cn('inline-flex items-center gap-1', row.rank <= 3 && 'font-bold text-primary')}>
                              {row.rank <= 3 && <Medal className="size-4" aria-hidden />}
                              {row.rank}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Link to={`/problems/users/${row.user.id}`} className="hover:underline">
                                {row.user.name}
                              </Link>
                              <Badge variant="secondary">{row.user.title}</Badge>
                              {isMe && <span className="text-xs text-primary">나</span>}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right font-mono whitespace-nowrap">{row.solvedCount}</td>
                          <td className="px-2 py-3 text-right font-mono text-xs whitespace-nowrap text-muted-foreground">{row.submissionCount}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap text-muted-foreground">{formatKst(row.lastSolvedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t bg-muted px-4 py-2 text-xs text-muted-foreground">총 {ranking.items.length}명 · 푼 문제가 없는 사람은 나오지 않아요</div>
            </>
          )
        )}
      </section>
    </div>
  )
}
