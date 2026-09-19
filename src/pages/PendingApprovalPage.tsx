import { useNavigate } from 'react-router'
import { Hourglass, LogOut, RefreshCw } from 'lucide-react'
import { useLogout, useMe } from '@/api/auth'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'

/**
 * 승인 대기 화면 (docs 결정 10) - 홈페이지(구글) 로그인은 됐지만 운영진이 아직 부원인지 확인하지 않은 계정.
 * RequireAuth 가 me.status === 'PENDING' 이면 어느 주소에서든 이 화면만 그린다 - 사이드바·본문 없음.
 * 운영진이 승인하거나 분반에 배정하면 풀린다. 알림은 두지 않으므로(2026-09-14 확정) "다시 확인" 으로 본인이 새로고침한다.
 * 이름·아이디를 크게 보이는 이유: 운영진이 부원 목록에서 찾을 때 대조할 값이라 학생이 그대로 전달할 수 있어야 한다.
 */
export default function PendingApprovalPage() {
  const { data: me, refetch, isFetching } = useMe()
  const navigate = useNavigate()
  const logoutMutation = useLogout()

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: (data) => {
        if (data?.logoutUrl) window.location.assign(data.logoutUrl)
        else navigate('/login', { replace: true })
      },
    })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-bg text-warning">
          <Hourglass className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">승인을 기다리고 있어요</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          로그인은 됐지만 운영진이 아직 부원인지 확인하지 않았어요. 운영진이 승인하거나 분반에 배정하면 바로 이용할 수 있어요.
        </p>

        <dl className="mt-5 rounded-lg border bg-muted px-4 py-3 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">이름</dt>
            <dd className="font-semibold">{me?.name}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-4">
            <dt className="text-muted-foreground">로그인 아이디</dt>
            <dd className="font-mono text-xs leading-5 break-all">{me?.loginId}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          빨리 필요하면 운영진에게 위 이름과 아이디를 알려 주세요. 운영진은 부원 관리 화면에서 바로 승인할 수 있어요.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw data-icon="inline-start" className={isFetching ? 'animate-spin' : undefined} />
            {isFetching ? '확인 중...' : '승인됐는지 다시 확인'}
          </Button>
          <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut data-icon="inline-start" />
            로그아웃
          </Button>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
