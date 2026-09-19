import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * 편집기 전체 화면 덮개 (원안 "수강자 코드 과제 상세" 의 전체 화면 아이콘).
 * 화면 전체를 덮는 패널 하나 - 안에는 호출자가 편집기와 제출 줄을 그대로 넣는다. Esc 또는 닫기 버튼으로 닫힌다.
 * 열려 있는 동안 본문 스크롤을 막아 뒤 화면이 흔들리지 않게 한다.
 */
export function FullscreenPane({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          닫기 (Esc)
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  )
}
