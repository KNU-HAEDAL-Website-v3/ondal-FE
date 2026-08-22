import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { CohortResponse } from '@/api/types'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CohortCard } from './CohortCard'

/**
 * "현재 소속" / "지난 소속" 접이식 섹션 (design.md 3절 FE 메모).
 * 펼쳤는데 비어 있으면 아무것도 표시하지 않는다 - 별도 문구 없음.
 */
export function CohortSection({
  title,
  cohorts,
  defaultOpen,
}: {
  title: string
  cohorts: CohortResponse[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-semibold text-foreground/80 hover:text-foreground">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" aria-hidden />
        {title}
        <span className="font-normal text-muted-foreground">({cohorts.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">
        {cohorts.map((cohort) => (
          <CohortCard key={cohort.id} cohort={cohort} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
