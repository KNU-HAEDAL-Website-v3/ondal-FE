import { Link } from 'react-router'
import { ArrowRight, Hourglass } from 'lucide-react'
import { useUsers } from '@/api/users'

/**
 * 운영진 대시보드 상단 배너 - 승인 대기 부원이 있으면 수와 함께 부원 관리(대기 탭)로 안내한다 (docs 결정 10).
 * 알림 기능이 없으므로(2026-09-14 확정) 운영진이 홈에 들어올 때 눈에 띄는 것이 유일한 통로다. 0명이면 아무것도 그리지 않는다.
 * 운영진 이상만 보는 대시보드 안에서만 쓴다 - 수강생이 부르면 서버가 403 을 내므로 다른 자리에 두지 말 것.
 */
export function PendingApprovalBanner() {
  const pendingQuery = useUsers('PENDING')
  const count = pendingQuery.data?.length ?? 0
  if (count === 0) return null

  return (
    <Link
      to="/members?status=PENDING"
      className="flex items-center gap-3 rounded-lg border border-warning-bg bg-warning-soft px-4 py-3 text-sm transition-colors hover:border-warning"
    >
      <Hourglass className="size-4 shrink-0 text-warning" aria-hidden />
      <span>
        <strong>승인 대기 {count}명</strong> - 홈페이지로 로그인했지만 아직 승인 전이에요. 승인하거나 분반에 배정하면 Ondal 을 쓸 수 있어요.
      </span>
      <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
