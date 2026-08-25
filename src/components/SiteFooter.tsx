import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CREDITS } from '@/lib/credits'
import { cn } from '@/lib/utils'

/** 화면 하단 공통 - 저작권은 단체 명의, 개발자는 "만든 사람들" 팝업(기수별, GitHub 링크) */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('flex items-center justify-center gap-2 text-xs text-muted-foreground', className)}>
      <span>© 2026 KNU 해달(HAEDAL)</span>
      <span aria-hidden>·</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            만든 사람들
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto space-y-3 px-4 py-3 text-sm">
          {CREDITS.map((gen) => (
            <div key={gen.generation}>
              <p className="text-xs font-bold text-muted-foreground">Ondal 개발 {gen.generation}기</p>
              <ul className="mt-1.5 space-y-1">
                {gen.members.map((member) => (
                  <li key={member.github} className="flex items-center justify-between gap-6">
                    <a
                      href={`https://github.com/${member.github}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {member.name ?? `@${member.github}`}
                    </a>
                    <span className="text-xs text-muted-foreground">{member.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </footer>
  )
}
