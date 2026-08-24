import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 대시보드 상단 KPI 카드 (피그마 28:404 계열) */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  valueClassName,
  iconClassName,
  className,
}: {
  label: string
  value: string
  unit?: string
  icon: LucideIcon
  valueClassName?: string
  iconClassName?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between rounded-lg border bg-card p-4', className)}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-[0.55px] text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-0.5">
          <span className={cn('text-[32px] leading-10 font-bold tracking-tight', valueClassName)}>{value}</span>
          {unit && <span className="text-sm text-[#464555]">{unit}</span>}
        </span>
      </div>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconClassName)}>
        <Icon className="size-5" />
      </span>
    </div>
  )
}
