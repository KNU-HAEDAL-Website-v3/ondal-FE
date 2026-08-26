import type { SubmissionStatus } from '@/api/types'
import { cn } from '@/lib/utils'

// 상태 배지 색 규칙 (docs submission/fe.md 2절): 제출 계열 초록, 지각 주황, 미제출 회색
const STATUS_META: Record<SubmissionStatus, { label: string; className: string }> = {
  NOT_SUBMITTED: { label: '미제출', className: 'bg-muted text-muted-foreground' },
  SUBMITTED: { label: '제출', className: 'bg-[#dcfce7] text-[#16a34a]' },
  SUBMITTED_EXTRA: { label: '제출(추가)', className: 'bg-[#dcfce7] text-[#16a34a]' },
  LATE: { label: '지각', className: 'bg-[#ffedd5] text-[#ea580c]' },
}

/** 서버 판정값(myStatus·현황판 status)을 그대로 배지로 - 프론트 재계산 금지 (CLAUDE.md 규칙 4) */
export function SubmissionStatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', meta.className, className)}>
      {meta.label}
    </span>
  )
}

/** 제출 이력 행의 지각 여부(late) 배지 - 역시 서버 판정값 그대로 */
export function LateBadge({ late }: { late: boolean }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold',
        late ? 'bg-[#ffedd5] text-[#ea580c]' : 'bg-[#dcfce7] text-[#16a34a]',
      )}
    >
      {late ? '지각' : '마감 내'}
    </span>
  )
}
