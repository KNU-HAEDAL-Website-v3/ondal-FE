import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Activity, Code2, LayoutGrid, ListChecks, LogOut, Tags, Trophy, UserRound } from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { SiteFooter } from '@/components/SiteFooter'
import { AppSwitchButton } from '@/components/AppSwitchButton'
import { rememberPath } from '@/lib/appSwitch'
import { cn } from '@/lib/utils'

import { isAdminRole, globalRoleLabel } from '@/lib/roles'
/**
 * HOJ 모드의 틀 - 상단 가로 네비 하나뿐인 가벼운 셸. 같은 앱 안에서 /problems·/admin/tags 에만 씌워진다 (routes.tsx, 2026-09-19 PM 결정 - docs 결정 9).
 *
 * Ondal 의 AppShell(좌측 사이드바 + 분반 운영 메뉴)과 일부러 다르게 생겼다:
 * HOJ 는 "문제를 골라 푼다"가 거의 전부라 좌측에 상시 메뉴를 둘 만큼 화면이 많지 않고,
 * 문제 본문·에디터에 가로 폭을 주는 편이 낫다. 나중에 대회가 붙으면 여기에 한 줄이 늘어난다.
 * P3(docs hoj/api.md 10절): 문제 · 채점 현황 · 랭킹 · 내 페이지(/problems/users/{내 id}) · 태그 관리(관리자).
 */
/** 정적 경로들 - "문제" 메뉴는 /problems 와 /problems/:id 에서만 활성, 이 접두사들에서는 아니다 */
const HOJ_STATIC = ['/problems/status', '/problems/ranking', '/problems/users']

export function HojShell() {
  const { data: me } = useMe()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const nav = [
    { to: '/problems', label: '문제', icon: ListChecks, adminOnly: false },
    { to: '/problems/status', label: '채점 현황', icon: Activity, adminOnly: false },
    { to: '/problems/ranking', label: '랭킹', icon: Trophy, adminOnly: false },
    { to: `/problems/users/${me?.id ?? ''}`, label: '내 페이지', icon: UserRound, adminOnly: false },
    { to: '/admin/tags', label: '태그 관리', icon: Tags, adminOnly: true },
  ]

  // 같은 앱이라 탭 제목은 index.html 하나뿐 - HOJ 모드에 있는 동안만 바꾼다
  useEffect(() => {
    document.title = 'HOJ - 해달 온라인 저지'
    return () => {
      document.title = 'Ondal - 해달 부트캠프 과제 플랫폼'
    }
  }, [])

  // 이 모드에서 마지막으로 본 화면 - Ondal 에 갔다가 "HOJ로 이동하기" 로 돌아올 때 여기로 온다 (lib/appSwitch)
  useEffect(() => {
    rememberPath('hoj', `${pathname}${search}`)
  }, [pathname, search])
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

  const isActive = (to: string) => {
    if (to === '/problems') return pathname === to || (pathname.startsWith('/problems/') && !HOJ_STATIC.some((prefix) => pathname.startsWith(prefix)))
    if (to.startsWith('/problems/users/')) return pathname === to
    return pathname === to || pathname.startsWith(`${to}/`)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-sidebar">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2">
          <Link to="/problems" className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-hoj-brand">
              <Code2 className="size-5 text-white" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-hoj-brand">HOJ</span>
              <span className="text-[11px] font-semibold tracking-[0.55px] text-sidebar-foreground">해달 온라인 저지</span>
            </span>
          </Link>

          <nav className="order-last flex w-full flex-wrap items-center gap-0.5 md:order-none md:w-auto md:gap-1">
            {nav.filter((item) => !item.adminOnly || isAdminRole(me?.globalRole)).map((item) => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors md:px-3',
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
            {/* 같은 앱의 다른 모드(과제 플랫폼)로 - 메뉴가 바뀌므로 확인을 받고 넘어간다 (lib/appSwitch) */}
            <AppSwitchButton
              to="ondal"
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-sidebar-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <LayoutGrid className="size-3.5 shrink-0" />
              Ondal로 이동하기
            </AppSwitchButton>
            {/* AppShell 상단 바와 같은 구성 - 아바타·이름을 누르면 마이페이지 (2026-09-20 전수 조사) */}
            {me && (
              <Link
                to="/me"
                className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-secondary"
                title={`마이페이지 - ${globalRoleLabel(me.globalRole)}`}
              >
                <span className="flex size-8 items-center justify-center rounded-full border bg-secondary text-xs font-semibold">
                  {me.name?.charAt(0) ?? '?'}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{me.name}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-secondary disabled:opacity-50"
            >
              <LogOut className="size-4 shrink-0" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* AppShell 과 같은 규칙 - 본문이 남는 높이를 채우고 푸터는 맨 아래 */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <SiteFooter className="mx-auto w-full max-w-6xl px-4 pb-6" />
    </div>
  )
}
