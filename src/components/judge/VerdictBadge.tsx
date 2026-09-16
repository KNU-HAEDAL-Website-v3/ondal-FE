import { Loader2 } from 'lucide-react'
import type { JudgeStatus, Verdict } from '@/api/types'
import { cn } from '@/lib/utils'

/** 판정 표시 규칙 (docs judge/fe.md 3절) - 서버 verdict 를 그대로 매핑, 재계산 금지 */
export const VERDICT_META: Record<Verdict, { label: string; className: string }> = {
  ACCEPTED: { label: '맞았습니다', className: 'bg-success-bg text-success' },
  WRONG_ANSWER: { label: '틀렸습니다', className: 'bg-danger-bg text-danger' },
  TIME_LIMIT: { label: '시간 초과', className: 'bg-caution-bg text-caution' },
  MEMORY_LIMIT: { label: '메모리 초과', className: 'bg-caution-bg text-caution' },
  RUNTIME_ERROR: { label: '런타임 에러', className: 'bg-danger-bg text-danger' },
  COMPILE_ERROR: { label: '컴파일 에러', className: 'bg-muted text-muted-foreground' },
  JUDGE_ERROR: { label: '채점 오류', className: 'border border-dashed bg-muted text-muted-foreground' },
}

export function isJudging(status: JudgeStatus | null | undefined): boolean {
  return status === 'PENDING' || status === 'RUNNING'
}

const BASE_CLASS = 'inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 text-xs font-bold whitespace-nowrap'

/**
 * 채점 배지 - status 가 null 이면 채점 대상이 아니라 아무것도 그리지 않는다.
 * PENDING/RUNNING = "채점 중"(스피너), DONE/ERROR = verdict 문구.
 */
export function VerdictBadge({ status, verdict, className }: { status: JudgeStatus | null; verdict: Verdict | null; className?: string }) {
  if (status === null) return null
  if (isJudging(status) || verdict === null) {
    return (
      <span className={cn(BASE_CLASS, 'bg-secondary text-muted-foreground', className)} aria-label="채점 중">
        <Loader2 className="size-3 animate-spin" />
        채점 중
      </span>
    )
  }
  const meta = VERDICT_META[verdict]
  return <span className={cn(BASE_CLASS, meta.className, className)}>{meta.label}</span>
}
