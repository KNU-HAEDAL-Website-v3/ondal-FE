import { Check, CircleDashed } from 'lucide-react'
import type { ProblemMyStatus } from '@/api/types'
import { cn } from '@/lib/utils'

/** 내 상태 칩 (HOJ P3) - 해결 초록 / 시도 중 빨강 / NONE 이면 흐린 "-". 값은 서버 myStatus 그대로 */
export function MyStatusBadge({ status, className }: { status: ProblemMyStatus; className?: string }) {
  if (status === 'NONE') return <span className={cn('text-xs text-muted-foreground', className)}>-</span>
  const solved = status === 'SOLVED'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap',
        solved ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
        className,
      )}
    >
      {solved ? <Check className="size-3" /> : <CircleDashed className="size-3" />}
      {solved ? '해결' : '시도 중'}
    </span>
  )
}
