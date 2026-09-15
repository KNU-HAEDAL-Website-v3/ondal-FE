import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { ArrowUpRight, Code2, ListChecks, LogOut, Tags } from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { SiteFooter } from '@/components/SiteFooter'
import { crossAppLinkProps, ondalHref } from '@/lib/apps'
import { cn } from '@/lib/utils'

/**
 * HOJ 전용 틀 - 상단 가로 네비 하나뿐인 가벼운 셸 (2026-09-15 PM 결정으로 Ondal 과 분리).
 *
 * Ondal 의 AppShell(좌측 사이드바 + 분반 운영 메뉴)과 일부러 다르게 생겼다:
 * HOJ 는 "문제를 골라 푼다"가 거의 전부라 좌측에 상시 메뉴를 둘 만큼 화면이 많지 않고,
 * 문제 본문·에디터에 가로 폭을 주는 편이 낫다. 나중에 대회가 붙으면 여기에 한 줄이 늘어난다.
 */
const NAV = [
  { to: '/problems', label: '문제', icon: ListChecks },
  { to: '/admin/tags', label: '태그 관리', icon: Tags, adminOnly: true },
] as const

export function HojShell() {
  const { data: me } = useMe()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const logoutMutation = useLogout()

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: (data) => {
        // oidc: 홈페이지 세션까지 끝내러 이동 - BE 가 HOJ 로그인 화면으로 돌려보낸다(app=hoj 로 시작했으므로)
        if (data?.logoutUrl) window.location.assign(data.logoutUrl)
        else navigate('/login', { replace: true })
      },
    })
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-sidebar">
        <div className="mx-auto flex h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4">
          <Link to="/problems" className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-sidebar-primary">
              <Code2 className="size-5 text-white" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-primary">HOJ</span>
              <span className="text-[11px] font-semibold tracking-[0.55px] text-sidebar-foreground">해달 온라인 저지</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.filter((item) => !('adminOnly' in item && item.adminOnly) || me?.globalRole === 'ADMIN').map((item) => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-secondary',
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* 두 앱은 성격이 달라 화면을 나눴다 - 여기서 과제 플랫폼으로 건너간다 */}
            <a
              href={ondalHref('/')}
              {...crossAppLinkProps(ondalHref('/') !== '/')}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              Ondal(과제)로
              <ArrowUpRight className="size-3.5" />
            </a>
            {me && (
              <span className="flex items-center gap-2" title={me.globalRole === 'ADMIN' ? '해구르르(관리자)' : '부원'}>
                <span className="flex size-8 items-center justify-center rounded-xl border bg-secondary text-xs font-semibold">
                  {me.name?.charAt(0) ?? '?'}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{me.name}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-secondary disabled:opacity-50"
            >
              <LogOut className="size-4 shrink-0" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
