import { Link } from 'react-router'
import { Archive, BookOpen, CircleCheckBig, ClipboardList, Code, GraduationCap, Palette } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { useMyStats } from '@/api/me'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EditorThemeGallery } from '@/components/code/CodePane'
import { StatCard } from '@/components/dashboard/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKstDay } from '@/lib/datetime'
import { isAdminRole, globalRoleLabel } from '@/lib/roles'

/**
 * 마이페이지 - /me (2026-09-19 신설: 원안 피그마·와이어프레임에 없던 화면 - 화면 정의는 docs `screens/my-page.md`). 상단 바의 내 이름을 누르면 온다.
 * 홈 대시보드와 같은 문법: 헤더 → KPI 카드 4장(StatCard) → 1:2 그리드(내 정보 · 코드 에디터 테마) → 소속 분반.
 * 이름·아이디는 홈페이지(Keycloak)가 원본이라 여기서 고칠 수 없다 - 바꾸려면 홈페이지에서. 점수·랭킹은 없다(P3 티어 이전).
 * 로그아웃은 사이드바에 있으므로 여기 두지 않는다.
 */
export default function MyPage() {
  const { data: me } = useMe()
  const cohortsQuery = useMyCohorts()
  const statsQuery = useMyStats()

  if (cohortsQuery.isPending || statsQuery.isPending) return <LoadingScreen label="내 정보 불러오는 중..." />
  if (cohortsQuery.error) return <ApiErrorView error={cohortsQuery.error} onRetry={() => void cohortsQuery.refetch()} />
  if (statsQuery.error) return <ApiErrorView error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />

  const cohorts = cohortsQuery.data
  const stats = statsQuery.data
  const isAdmin = isAdminRole(me?.globalRole)
  const roleLabel = isAdmin ? globalRoleLabel(me?.globalRole) : cohorts.some((c) => c.canManage) ? '교육운영진' : '부원'
  const activeCount = cohorts.filter((c) => c.status === 'ACTIVE').length
  const archivedCount = cohorts.length - activeCount

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3 border-b pb-2.5">
        <span className="flex size-12 items-center justify-center rounded-full border bg-neutral-bg text-lg font-bold text-foreground">
          {me?.name?.charAt(0) ?? '?'}
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{me?.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{roleLabel}</p>
        </div>
      </header>

      {/* 활동 - 홈은 현재 분반 기준, 여기는 가입 후 누적. 값은 전부 서버(/api/me/stats) 그대로 */}
      <div className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="과제 제출" value={String(stats.assignmentSubmissions)} unit="건" icon={ClipboardList} iconClassName="bg-secondary text-primary" />
          <StatCard label="HOJ 연습 제출" value={String(stats.practiceSubmissions)} unit="건" icon={Code} iconClassName="bg-secondary text-primary" />
          <StatCard
            label="맞힌 문제"
            value={String(stats.solvedProblems)}
            unit="개"
            valueClassName="text-success"
            icon={CircleCheckBig}
            iconClassName="bg-success-bg text-success"
          />
          <StatCard
            label="소속 분반"
            value={String(activeCount)}
            unit={archivedCount > 0 ? `개 · 지난 ${archivedCount}개` : '개'}
            icon={GraduationCap}
            iconClassName="bg-secondary text-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">제출 건수는 재제출을 포함해요. 맞힌 문제는 과제든 연습이든 한 번이라도 정답 판정을 받은 문제 수예요.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-bold">내 정보</h2>
          <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">이름</dt>
            <dd className="font-medium">{me?.name}</dd>
            <dt className="text-muted-foreground">로그인 아이디</dt>
            <dd className="font-mono text-xs leading-5 break-all">{me?.loginId}</dd>
            <dt className="text-muted-foreground">가입</dt>
            <dd>{formatKstDay(stats.joinedAt)}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">이름과 아이디는 해달 홈페이지 계정을 따라요. 홈페이지에서 바꾸면 다음 로그인 때 반영돼요.</p>
        </section>

        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Palette className="size-4 text-muted-foreground" aria-hidden />
              코드 에디터 테마
            </h2>
            <span className="text-xs text-muted-foreground">이 브라우저에만 저장돼요</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">과제 제출·문제 풀이·코드 열람 화면의 편집기에 바로 적용돼요.</p>
          <div className="mt-3">
            <EditorThemeGallery />
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">소속 분반</h2>
          <Button variant="link" size="sm" asChild>
            <Link to="/cohorts">내 수업으로</Link>
          </Button>
        </div>
        {cohorts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">아직 소속된 분반이 없어요. 운영진이 배정하면 여기에 나타나요.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {cohorts.map((cohort) => {
              const archived = cohort.status === 'ARCHIVED'
              return (
                <li
                  key={cohort.id}
                  className={archived ? 'flex flex-wrap items-center justify-between gap-2 py-2 text-sm opacity-70' : 'flex flex-wrap items-center justify-between gap-2 py-2 text-sm'}
                >
                  <Link to={`/cohorts/${cohort.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                    {cohort.name}
                  </Link>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary">{cohort.myTitle}</Badge>
                    {archived && (
                      <Badge variant="outline">
                        <Archive data-icon="inline-start" />
                        보관됨
                      </Badge>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
