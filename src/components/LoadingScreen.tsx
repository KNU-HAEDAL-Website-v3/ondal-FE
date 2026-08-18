import { LoaderCircle } from 'lucide-react'

export function LoadingScreen({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground" role="status">
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
