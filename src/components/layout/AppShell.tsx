import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import {
  Bell,
  BookOpen,
  CircleHelp,
  Code,
  FileText,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Megaphone,
  Search,
  Settings,
  UserCheck,
} from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { SiteFooter } from '@/components/SiteFooter'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * 사이드바 메뉴 (피그마 28:368 계열 SideNavBar). 화면이 채워지면 to만 유지한 채 내용이 늘어난다.
 * "제출"(분반 전체 제출 기록)은 P2 이연으로 메뉴에서 뺐다 - 제출은 과제 상세 안에서 한다 (docs submission/design.md 결정 8).
 */
const NAV_ITEMS = [
  { to: '/', label: '홈', icon: LayoutGrid, end: true },
  { to: '/attendance', label: '출석', icon: UserCheck },
  { to: '/problems', label: '문제', icon: Code },
  { to: '/assignments', label: '과제', icon: FileText },
  { to: '/cohorts', label: '내 수업', icon: BookOpen },
  { to: '/notices', label: '공지사항', icon: Megaphone },
] as const

const navItemClass = (isActive: boolean) =>
  cn(
    'flex items-center gap-4 rounded-[4px] border-l-4 py-2 pl-3 pr-2 text-sm transition-colors',
    isActive
      ? 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'border-transparent text-sidebar-foreground hover:bg-secondary',
  )

/** 로그인 후 모든 화면의 공통 틀 - 좌측 사이드바 + 상단 바 + 본문 */
export function AppShell() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const logoutMutation = useLogout()

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r bg-sidebar px-4 py-6">
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
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item && item.end} className={({ isActive }) => navItemClass(isActive)}>
              <item.icon className="size-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t pt-4">
          <button type="button" className={cn(navItemClass(false), 'w-full')}>
            <CircleHelp className="size-[18px] shrink-0" />
            Support
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className={cn(navItemClass(false), 'w-full disabled:opacity-50')}
          >
            <LogOut className="size-[18px] shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="pl-60">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background px-4">
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="h-8 rounded-[6px] bg-muted pl-8 text-[13px]" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="알림" className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary">
              <Bell className="size-5" />
            </button>
            <button type="button" aria-label="도움말" className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary">
              <CircleHelp className="size-5" />
            </button>
            <button type="button" aria-label="설정" className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary">
              <Settings className="size-5" />
            </button>
            <span
              title={me?.name}
              className="ml-2 flex size-8 items-center justify-center rounded-xl border bg-[#e3e1ec] text-xs font-semibold text-foreground"
            >
              {me?.name?.charAt(0) ?? '?'}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] p-10">
          <Outlet />
        </main>
        <SiteFooter className="mx-auto w-full max-w-[1280px] px-10 pb-6" />
      </div>
    </div>
  )
}
