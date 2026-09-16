import type { AttendanceStatus } from '@/api/types'
import { cn } from '@/lib/utils'

// 배지 색 규칙 (docs attendance/fe.md 2절): 출석 초록 / 지각 노랑 / 결석 빨강 / 미확인(기록 없음) 회색
const STATUS_META: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT: { label: '출석', className: 'bg-success-bg text-success' },
  LATE: { label: '지각', className: 'bg-warning-bg text-warning' },
  ABSENT: { label: '결석', className: 'bg-danger-bg text-danger' },
}
const UNCHECKED = { label: '미확인', className: 'bg-neutral-bg text-neutral' }

/** 서버 판정값을 그대로 배지로 - null 은 미확인. 프론트 재계산 금지 (CLAUDE.md 규칙 4) */
export function AttendanceStatusBadge({ status, className }: { status: AttendanceStatus | null; className?: string }) {
  const meta = status === null ? UNCHECKED : STATUS_META[status]
  return (
    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', meta.className, className)}>
      {meta.label}
    </span>
  )
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: STATUS_META.PRESENT.label,
  LATE: STATUS_META.LATE.label,
  ABSENT: STATUS_META.ABSENT.label,
}
