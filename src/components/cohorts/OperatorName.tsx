import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { UserSummary } from '@/api/types'

/**
 * 운영진 이름 — 다른 색으로 표시하고, 클릭하면 작은 팝업에 이름 + 직책(title). (PM 결정 2026-08-17)
 * title은 서버가 정한 문자열('해구르르' / '교육운영진')을 그대로 보여준다.
 */
export function OperatorName({ operator }: { operator: UserSummary }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-sm font-medium text-indigo-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-indigo-400"
          // 카드 전체가 링크라 클릭이 카드 이동으로 번지지 않게 막는다
          onClick={(e) => e.stopPropagation()}
        >
          {operator.name}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <span className="font-medium">{operator.name}</span>
        <span className="text-muted-foreground"> · {operator.title}</span>
      </PopoverContent>
    </Popover>
  )
}
