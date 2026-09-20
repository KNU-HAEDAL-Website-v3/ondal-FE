import { Link, useParams } from 'react-router'
import { CircleCheckBig, CircleDashed, Code, Percent, Trophy, UserRound } from 'lucide-react'
import { useMe } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useHojUser } from '@/api/hoj'
import type { HojProblemChip } from '@/api/types'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActivityHeatmap } from '@/components/hoj/ActivityHeatmap'
import { LanguageShareBar } from '@/components/hoj/LanguageShareBar'
import { SubmissionFeedTable } from '@/components/hoj/SubmissionFeedTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKstDay } from '@/lib/datetime'
import { formatDifficulty } from '@/lib/difficulty'
import { parseId } from '@/lib/params'
import { cn } from '@/lib/utils'

/**
 * HOJ 사용자 페이지 - 누구나 누구의 활동이든 본다 (/problems/users/:userId, P3 - docs hoj/api.md 3절·10절). 이름·활동만, 아이디는 없다.
 * 홈 대시보드 문법: 헤더(이름·직책·가입·순위) → StatCard 4장 → 1:2(언어 비율 · 푼 문제 격자) → 활동 잔디 → 1:2(태그 숙련도 · 최근 제출).
 * 값은 전부 서버 응답 그대로(정답률·순위 포함) - 화면은 그리기만 한다. 본인이면 헤더에 마이페이지 링크.
 */
export default function HojUserPage() {
  const { userId: userParam } = useParams()
  const userId = parseId(userParam)
  const { data: me } = useMe()
  const query = useHojUser(userId)

  if (!Number.isFinite(userId)) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 사용자 주소예요.')} />
  if (query.isPending) return <LoadingScreen label="사용자 페이지 불러오는 중..." />
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const page = query.data
  const isMe = me?.id === page.user.id

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3 border-b pb-2.5">
        <span className="flex size-12 items-center justify-center rounded-full border bg-neutral-bg text-lg font-bold text-foreground">
          {page.user.name.charAt(0) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {page.user.name}
            <Badge variant="secondary">{page.user.title}</Badge>
            {isMe && <span className="text-sm font-medium text-primary">내 페이지</span>}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>가입 {formatKstDay(page.joinedAt)}</span>
            <Link to="/problems/ranking" className="flex items-center gap-1 hover:underline">
              <Trophy className="size-3.5" aria-hidden />
              {page.rank === null ? '순위 없음 (아직 푼 문제가 없어요)' : `랭킹 ${page.rank}위`}
            </Link>
          </p>
        </div>
        {isMe && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/me">
              <UserRound data-icon="inline-start" />
              마이페이지
            </Link>
          </Button>
        )}
      </header>

      <div className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="푼 문제" value={String(page.stats.solvedCount)} unit="개" icon={CircleCheckBig} valueClassName="text-success" iconClassName="bg-success-bg text-success" />
          <StatCard label="시도 중" value={String(page.stats.attemptedCount)} unit="개" icon={CircleDashed} valueClassName={page.stats.attemptedCount > 0 ? 'text-danger' : undefined} iconClassName="bg-danger-bg text-danger" />
          <StatCard label="연습 제출" value={String(page.stats.submissionCount)} unit="건" icon={Code} iconClassName="bg-secondary text-primary" />
          <StatCard
            label="정답률"
            value={page.stats.acceptedRate === null ? '-' : String(page.stats.acceptedRate)}
            unit={page.stats.acceptedRate === null ? '제출 없음' : `% · 정답 ${page.stats.acceptedCount}건`}
            icon={Percent}
            iconClassName="bg-secondary text-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">푼 문제·시도 중은 과제든 연습이든 채점 결과 기준이에요. 제출·정답률·언어·잔디는 HOJ 연습 제출만 세요.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4" aria-label="언어 비율">
          <h2 className="text-base font-bold">언어 비율</h2>
          <div className="mt-3">
            <LanguageShareBar languages={page.languages} />
          </div>
        </section>
        <section className="rounded-lg border bg-card p-4 lg:col-span-2" aria-label="푼 문제">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">푼 문제</h2>
            <span className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-success" /> 해결
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-danger" /> 시도 중
              </span>
            </span>
          </div>
          {page.solvedProblems.length === 0 && page.attemptedProblems.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">아직 채점받은 문제가 없어요.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <ProblemChips label="해결" problems={page.solvedProblems} tone="solved" />
              <ProblemChips label="시도 중" problems={page.attemptedProblems} tone="attempted" />
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4" aria-label="활동 잔디">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">활동</h2>
          <span className="text-xs text-muted-foreground">최근 365일 · 날짜별 연습 제출 수 (KST)</span>
        </div>
        <div className="mt-3">
          <ActivityHeatmap activity={page.activity} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4" aria-label="태그 숙련도">
          <h2 className="text-base font-bold">태그 숙련도</h2>
          {page.tagStats.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">태그가 달린 문제가 아직 없어요.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {page.tagStats.map((row) => (
                <li key={row.tag.id} className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{row.tag.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {row.solved} / {row.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-md bg-muted" aria-hidden>
                    <div className="h-full rounded-md bg-primary" style={{ width: `${row.total === 0 ? 0 : (row.solved / row.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="overflow-hidden rounded-lg border bg-card lg:col-span-2" aria-label="최근 제출">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-base font-bold">최근 제출</h2>
            <Button variant="link" size="sm" asChild>
              <Link to="/problems/status">채점 현황 전체 보기</Link>
            </Button>
          </div>
          {page.recentSubmissions.length === 0 ? (
            <EmptyState compact title="아직 연습 제출이 없어요" description="HOJ 에서 문제를 풀어 제출하면 여기에 쌓여요." />
          ) : (
            <SubmissionFeedTable items={page.recentSubmissions} showUser={false} />
          )}
        </section>
      </div>
    </div>
  )
}

/** 문제 번호 칩 격자 - 초록 = 해결, 빨강 = 시도 중. 각각 문제 상세로 */
function ProblemChips({ label, problems, tone }: { label: string; problems: HojProblemChip[]; tone: 'solved' | 'attempted' }) {
  if (problems.length === 0) return null
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.55px] text-muted-foreground">
        {label} <span className="font-mono">{problems.length}</span>
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {problems.map((problem) => (
          <li key={problem.id}>
            <Link
              to={`/problems/${problem.id}`}
              title={`#${problem.problemNo} ${problem.title} · 난이도 ${formatDifficulty(problem.difficulty)}`}
              className={cn(
                'inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold transition-opacity hover:opacity-80',
                tone === 'solved' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
              )}
            >
              {problem.problemNo}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
