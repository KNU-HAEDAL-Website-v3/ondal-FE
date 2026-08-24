import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 출석 통계 카드 - 옅은 배경 + 우상단 워터마크 아이콘 (피그마 28:836 · 28:1013 공통) */
export function AttendanceStatCard({
  label,
  value,
  unit,
  icon: Icon,
  className,
  labelClassName,
}: {
  label: string
  value: string
  unit?: string
  icon?: LucideIcon
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg border bg-card p-4', className)}>
      {Icon && <Icon className="absolute -top-3 -right-3 size-16 opacity-10" />}
      <span className={cn('text-sm font-bold', labelClassName)}>{label}</span>
      <p className="mt-1 flex items-baseline gap-0.5">
        <span className="text-[32px] leading-10 font-bold tracking-tight">{value}</span>
        {unit && <span className="text-sm opacity-80">{unit}</span>}
      </p>
    </div>
  )
}
