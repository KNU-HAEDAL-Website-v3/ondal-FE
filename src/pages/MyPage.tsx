import { useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import { Archive, BookOpen, CheckCircle2, ClipboardList, Code, LogOut, Palette } from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { useMyStats } from '@/api/me'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKst } from '@/lib/datetime'
import { EDITOR_THEMES, getEditorTheme, setEditorTheme, subscribeEditorTheme, type EditorThemeId } from '@/lib/editorTheme'

/**
 * 마이페이지 - /me (2026-09-19 신설: 원안 피그마·와이어프레임에 없던 화면. 상단 바의 내 이름을 누르면 온다).
 * 내 정보(이름·로그인 아이디·직책·상태·가입일) · 활동(과제 제출·연습 제출·맞힌 문제) · 소속 분반 · 설정(코드 에디터 테마) · 로그아웃.
 * 이름·아이디는 홈페이지(Keycloak)가 원본이라 여기서 고칠 수 없다 - 바꾸려면 홈페이지에서. 점수·랭킹은 없다(P3 티어 이전)
 */
export default function MyPage() {
  const { data: me } = useMe()
  const cohortsQuery = useMyCohorts()
  const statsQuery = useMyStats()
  const navigate = useNavigate()
  const logoutMutation = useLogout()
  const theme = useSyncExternalStore(subscribeEditorTheme, getEditorTheme)

  if (cohortsQuery.isPending || statsQuery.isPending) return <LoadingScreen label="내 정보 불러오는 중..." />
  if (cohortsQuery.error) return <ApiErrorView error={cohortsQuery.error} onRetry={() => void cohortsQuery.refetch()} />
  if (statsQuery.error) return <ApiErrorView error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />

  const cohorts = cohortsQuery.data
  const stats = statsQuery.data
  const isAdmin = me?.globalRole === 'ADMIN'
  const roleLabel = isAdmin ? '해구르르 (관리자)' : cohorts.some((c) => c.canManage) ? '교육운영진' : '부원'

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: (data) => {
        if (data?.logoutUrl) window.location.assign(data.logoutUrl)
        else navigate('/login', { replace: true })
      },
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full border bg-neutral-bg text-lg font-bold text-foreground">
            {me?.name?.charAt(0) ?? '?'}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{me?.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut data-icon="inline-start" />
          로그아웃
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-bold">내 정보</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">이름</dt>
              <dd className="font-medium">{me?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">로그인 아이디</dt>
              <dd className="font-mono text-xs leading-5 break-all">{me?.loginId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">직책</dt>
              <dd>{roleLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">상태</dt>
              <dd>
                <span className="inline-block rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">이용 중</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">가입</dt>
              <dd className="font-mono text-xs">{formatKst(stats.joinedAt)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">이름과 아이디는 해달 홈페이지 계정의 것이에요. 바꾸려면 홈페이지에서 바꾸면 다음 로그인 때 반영돼요.</p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-bold">활동</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat icon={ClipboardList} label="과제 제출" value={stats.assignmentSubmissions} unit="건" />
            <Stat icon={Code} label="HOJ 연습 제출" value={stats.practiceSubmissions} unit="건" />
            <Stat icon={CheckCircle2} label="맞힌 문제" value={stats.solvedProblems} unit="개" accent />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">제출 건수는 재제출을 포함해요. 맞힌 문제는 과제든 연습이든 한 번이라도 정답 판정을 받은 문제 수예요.</p>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">소속 분반</h2>
          <Link to="/cohorts" className="text-xs font-semibold text-primary hover:underline">
            내 수업으로
          </Link>
        </div>
        {cohorts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">아직 소속된 분반이 없어요. 운영진이 배정하면 여기에 나타나요.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {cohorts.map((cohort) => (
              <li key={cohort.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link to={`/cohorts/${cohort.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                  {cohort.name}
                </Link>
                <span className="flex items-center gap-1.5">
                  <Badge variant="secondary">{cohort.myTitle}</Badge>
                  {cohort.status === 'ARCHIVED' && (
                    <Badge variant="outline">
                      <Archive data-icon="inline-start" />
                      보관됨
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Palette className="size-4 text-muted-foreground" aria-hidden />
          설정
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="editor-theme" className="text-muted-foreground">
            코드 에디터 테마
          </label>
          <select
            id="editor-theme"
            value={theme}
            onChange={(e) => setEditorTheme(e.target.value as EditorThemeId)}
            className="h-8 rounded-lg border bg-card px-2 text-sm"
          >
            {EDITOR_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">이 브라우저에만 저장돼요. 제출·문제 풀이·코드 열람 화면에 모두 적용됩니다.</span>
        </div>
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value, unit, accent }: { icon: typeof Code; label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted px-3 py-2.5">
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span className={accent ? 'text-2xl font-bold text-success' : 'text-2xl font-bold'}>{value}</span>
      <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
    </div>
  )
}
