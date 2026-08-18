import { Link, Outlet, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { Button } from '@/components/ui/button'

/** 로그인 후 모든 화면의 공통 틀 — 상단 바(로고 · 사용자 · 로그아웃) + 본문 */
export function AppShell() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const logoutMutation = useLogout()

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-primary">HOJ</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Haedal Online Judge</span>
          </Link>
          {me && (
            <div className="flex items-center gap-3">
              <span className="text-sm">
                <span className="font-medium">{me.name}</span>
                <span className="text-muted-foreground">님</span>
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
                <LogOut data-icon="inline-start" />
                로그아웃
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
