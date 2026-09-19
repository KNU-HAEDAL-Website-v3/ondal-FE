import { formatDifficulty, tierClass, tierOf } from '@/lib/difficulty'
import { cn } from '@/lib/utils'

/** 난이도 칩 - "3-4" 처럼 두 숫자, 대분류 색. 미지정이면 흐린 "-" (문제 목록·상세·과제 상세) */
export function DifficultyBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  const tier = tierOf(value)
  return (
    <span
      title={tier === null ? '난이도 미지정' : `난이도 ${formatDifficulty(value)} (대분류 ${tier})`}
      className={cn('inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold', tierClass(tier), className)}
    >
      {formatDifficulty(value)}
    </span>
  )
}
