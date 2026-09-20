import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, BookOpen, GraduationCap, Hourglass, RefreshCw, Users } from 'lucide-react'
import { useCohorts } from '@/api/cohorts'
import { useHealth } from '@/api/health'
import { useProblems } from '@/api/problems'
import { useUsers } from '@/api/users'
import { StatCard } from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/button'
import { formatKst } from '@/lib/datetime'

/**
 * 관리자 개요 (원안 "관리자 개요" 화면, 2026-09-20 전수 조사 반영) - 관리자 홈 맨 위에 붙는 절.
 * 원안의 KPI 4장(전체 사용자·현재 수강생·진행 중 부트캠프·오늘 제출) 중 기존 API 로 셀 수 있는 것만 둔다:
 *   전체 부원(GET /api/users) · 승인 대기 · 진행 중 분반(GET /api/cohorts?status=ACTIVE) · HOJ 문제 수(GET /api/problems).
 * "오늘 제출"·채점 대기·평균 채점 시간·감사 로그는 서버 집계가 없어 두지 않는다(기능 없는 자리 금지) - BE 가 생기면 카드를 늘린다.
 * 시스템 상태는 GET /api/health 하나(1분마다 재확인). 새로고침은 화면의 모든 캐시를 다시 불러온다.
 */
export function AdminOverview() {
  const queryClient = useQueryClient()
  const usersQuery = useUsers()
  const pendingQuery = useUsers('PENDING')
  const cohortsQuery = useCohorts('ACTIVE')
  const problemsQuery = useProblems()
  const healthQuery = useHealth()

  const count = (q: { data?: unknown[]; isPending: boolean; isError: boolean }) => (q.isPending || q.isError ? '-' : String(q.data?.length ?? 0))
  const pending = pendingQuery.data ?? []
  const healthy = healthQuery.data?.status === 'UP'

  return (
    <section aria-label="관리자 개요" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">관리자 개요</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">전체 부원 · 분반 · HOJ · 서버 상태 한눈에</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void queryClient.invalidateQueries()}>
          <RefreshCw data-icon="inline-start" />
          새로고침
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 부원" value={count(usersQuery)} unit="명" icon={Users} iconClassName="bg-secondary text-primary" />
        <StatCard
          label="승인 대기"
          value={count(pendingQuery)}
          unit="명"
          valueClassName={pending.length > 0 ? 'text-warning' : undefined}
          icon={Hourglass}
          iconClassName={pending.length > 0 ? 'bg-warning-bg text-warning' : 'bg-secondary text-primary'}
        />
        <StatCard label="진행 중 분반" value={count(cohortsQuery)} unit="개" icon={GraduationCap} iconClassName="bg-secondary text-primary" />
        <StatCard label="HOJ 문제" value={count(problemsQuery)} unit="개" icon={BookOpen} iconClassName="bg-secondary text-primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Activity className="size-4 text-muted-foreground" aria-hidden />
            시스템 상태
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">API 서버</dt>
              <dd>
                {healthQuery.isPending ? (
                  <span className="text-xs text-muted-foreground">확인 중...</span>
                ) : healthy ? (
                  <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">정상</span>
                ) : (
                  <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">응답 없음</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">마지막 확인</dt>
              <dd className="font-mono text-xs">{healthQuery.dataUpdatedAt ? formatKst(new Date(healthQuery.dataUpdatedAt).toISOString()) : '-'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">채점 엔진 상태는 과제의 자동 채점 설정 화면에서 확인해요. 채점 대기·평균 채점 시간 집계는 아직 없어요.</p>
        </section>

        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold">승인 대기</h3>
            <Button variant="link" size="sm" asChild>
              <Link to="/members?status=PENDING">부원 관리로</Link>
            </Button>
          </div>
          {pendingQuery.isPending ? (
            <p className="mt-3 text-sm text-muted-foreground">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">승인을 기다리는 계정이 없어요.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {pending.slice(0, 5).map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{u.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{u.loginId}</span>
                </li>
              ))}
              {pending.length > 5 && <li className="py-2 text-xs text-muted-foreground">외 {pending.length - 5}명</li>}
            </ul>
          )}
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {[
              { to: '/members', label: '부원 관리' },
              { to: '/admin/cohorts', label: '분반 관리' },
              { to: '/problems', label: 'HOJ 문제' },
              { to: '/problems/status', label: '채점 현황' },
              { to: '/admin/tags', label: '태그 관리' },
            ].map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="block rounded-md border px-3 py-1.5 font-medium hover:bg-secondary/50">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}
