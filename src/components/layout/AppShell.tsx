import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
  BookOpen,
  CircleHelp,
  Code,
  FileText,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Settings2,
  UserCheck,
} from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { SiteFooter } from '@/components/SiteFooter'
import { AppSwitchButton } from '@/components/AppSwitchButton'
import { rememberPath } from '@/lib/appSwitch'
import { cn } from '@/lib/utils'

/**
 * 사이드바 메뉴 (피그마 28:368 계열 SideNavBar). 화면이 채워지면 to만 유지한 채 내용이 늘어난다.
 * "제출"(분반 전체 제출 기록)은 P2 이연으로 메뉴에서 뺐다 - 제출은 과제 상세 안에서 한다 (docs submission/design.md 결정 8).
 */
/** Q&A 본체 경로 - /cohorts/:id/questions[/...]. 분반 스코프라 "내 수업"(/cohorts) 과 접두사가 겹친다 */
const COHORT_QUESTIONS = /^\/cohorts\/[^/]+\/questions(\/|$)/

const NAV_ITEMS = [
  { to: '/', label: '홈', icon: LayoutGrid, end: true },
  { to: '/attendance', label: '출석', icon: UserCheck },
  { to: '/assignments', label: '과제', icon: FileText },
  // Q&A 를 보는 중에는 "내 수업"이 켜지면 안 된다 - 경로는 /cohorts 로 시작하지만 다른 메뉴다
  { to: '/cohorts', label: '내 수업', icon: BookOpen, inactiveWhen: COHORT_QUESTIONS },
  // Q&A 는 분반 스코프(/cohorts/:id/questions)라 분반 페이지 안에만 있었는데, 그 링크 하나가 유일한 통로여서
  // "Q&A 게시판이 없다"는 피드백이 나왔다 (2026-09-15) - 출결과 같은 "분반 먼저 고르기" 진입 화면을 둔다.
  // 분반이 하나면 /questions 가 곧바로 /cohorts/{id}/questions 로 넘어가므로 그 경로도 이 메뉴로 친다
  { to: '/questions', label: 'Q&A', icon: MessagesSquare, activeWhen: COHORT_QUESTIONS },
  { to: '/notices', label: '공지사항', icon: Megaphone },
  // 관리자 전용 - 분반 생성·보관·운영진 지정 (UC-A1). 비관리자에게는 숨기고, 라우트는 RequireAdmin 이 지킨다
  { to: '/admin/cohorts', label: '분반 관리', icon: Settings2, adminOnly: true },
  // 태그 관리는 문제의 것이라 HOJ 모드 메뉴(HojShell)에 있다 - 여기 없다
] as const

interface NavMatch {
  to: string
  end?: boolean
  /** 이 경로들도 이 메뉴로 친다 (다른 곳으로 넘어가는 진입 화면용) */
  activeWhen?: RegExp
  /** 접두사가 겹치지만 이 메뉴가 아닌 경로 */
  inactiveWhen?: RegExp
}

/**
 * 사이드바 하이라이트 판정 - NavLink 의 기본 접두사 매칭으로는 틀리는 자리가 있어 직접 계산한다.
 * 2026-09-15 제보: Q&A 를 누르면 Q&A 가 아니라 바로 위 "내 수업"이 켜짐.
 * 원인은 /questions 가 분반이 하나일 때 /cohorts/{id}/questions 로 넘어가는 것 - 접두사로만 보면 /cohorts 가 맞아 버린다.
 */
function isNavActive(item: NavMatch, pathname: string): boolean {
  if (item.activeWhen?.test(pathname)) return true
  if (item.inactiveWhen?.test(pathname)) return false
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

const navItemClass = (isActive: boolean) =>
  cn(
    'flex items-center gap-4 rounded-[4px] border-l-4 py-2 pl-3 pr-2 text-sm transition-colors',
    isActive
      ? 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'border-transparent text-sidebar-foreground hover:bg-secondary',
  )

/**
 * 로그인 후 모든 화면의 공통 틀 - 좌측 사이드바 + 상단 바 + 본문.
 * 피그마 원안의 검색창·알림·설정 버튼은 뒤에 기능이 없어 뺐다(2026-09-14 - 동작 없는 버튼은 테스터에게 버그로 보인다).
 * 검색은 검색 API 가 생길 때, 알림은 P2 제외 확정(디스코드 알림 안 함), 설정은 설정할 항목이 생길 때 되살린다.
 *
 * 폭 md(768px) 미만에서는 사이드바를 서랍으로 접는다 (2026-09-16 전수조사).
 * 그 전에는 240px 사이드바가 고정이라 390px 폰에서 본문 실사용 폭이 70px 뿐이었다 - 테스트 주간에 학생이 폰으로 열면 그대로 막힘.
 */
export function AppShell() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const logoutMutation = useLogout()
  const [navOpen, setNavOpen] = useState(false)

  // 메뉴를 고르면 화면이 넘어가므로 서랍은 닫는다 - 안 닫으면 새 화면이 서랍에 가려진다
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // 이 모드에서 마지막으로 본 화면 - HOJ 에 갔다가 "Ondal로 이동하기" 로 돌아올 때 여기로 온다 (lib/appSwitch)
  useEffect(() => {
    rememberPath('ondal', `${pathname}${search}`)
  }, [pathname, search])

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: (data) => {
        // oidc: 홈페이지(Keycloak) 세션까지 끝내러 이동 - 끝나면 Keycloak 이 /login 으로 돌려보낸다 (공용 PC 의 SSO 자동 로그인 방지)
        // stub·요청 실패(data 없음): 기존처럼 로그인 화면으로
        if (data?.logoutUrl) window.location.assign(data.logoutUrl)
        else navigate('/login', { replace: true })
      },
    })
  }

  return (
    <div className="min-h-svh bg-background">
      {/* 서랍이 열렸을 때 본문을 덮는 막 - 눌러서 닫는다. md 이상에서는 사이드바가 늘 보이므로 없다 */}
      {navOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r bg-sidebar px-4 py-6',
          'transition-transform duration-200 md:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link to="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-sidebar-primary">
            <GraduationCap className="size-5 text-white" />
          </span>
          <span className="flex flex-col">
            <span className="text-xl leading-7 font-black tracking-tight text-primary">Ondal</span>
            <span className="text-[11px] leading-4 font-semibold tracking-[0.55px] text-sidebar-foreground">
              LMS Platform
            </span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => !('adminOnly' in item && item.adminOnly) || me?.globalRole === 'ADMIN').map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={navItemClass(active)}>
                <item.icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t pt-4">
          {/*
            HOJ(문제 은행)는 같은 앱 안의 다른 모드 - 메뉴가 통째로 바뀌므로 확인을 받고 넘어간다 (2026-09-19 PM, lib/appSwitch).
            부트캠프 운영(분반·과제·출석)과 결이 달라 아래쪽에 따로 둔다 (2026-09-15 PM 지정 위치)
          */}
          <AppSwitchButton to="hoj" className={cn(navItemClass(false), 'w-full')}>
            <Code className="size-[18px] shrink-0" />
            HOJ로 이동하기
          </AppSwitchButton>
          <Link
            to="/help"
            aria-current={isNavActive({ to: '/help' }, pathname) ? 'page' : undefined}
            className={cn(navItemClass(isNavActive({ to: '/help' }, pathname)), 'w-full')}
          >
            <CircleHelp className="size-[18px] shrink-0" />
            도움말
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className={cn(navItemClass(false), 'w-full disabled:opacity-50')}
          >
            <LogOut className="size-[18px] shrink-0" />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-12 items-center border-b bg-background px-4">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={navOpen}
            className="-ml-1 flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/help"
              aria-label="도움말"
              className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary"
            >
              <CircleHelp className="size-5" />
            </Link>
            {/* 누구로 로그인했는지 - 역할을 바꿔 가며 테스트할 때 헷갈리지 않도록 이름을 그대로 보여 준다 */}
            <span className="ml-1 flex items-center gap-2" title={me?.globalRole === 'ADMIN' ? '해구르르(관리자)' : '부원'}>
              <span className="flex size-8 items-center justify-center rounded-xl border bg-neutral-bg text-xs font-semibold text-foreground">
                {me?.name?.charAt(0) ?? '?'}
              </span>
              <span className="text-sm font-medium">{me?.name}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] p-4 md:p-10">
          <Outlet />
        </main>
        <SiteFooter className="mx-auto w-full max-w-[1280px] px-4 pb-6 md:px-10" />
      </div>
    </div>
  )
}
