import { ChevronRight, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Notice BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_NOTICES = [
  { id: 1, title: '2026년 2학기 알고리즘 경진대회 안내', target: '전체 수강생', author: '관리자', createdAt: '2026-08-20', pinned: true },
  { id: 2, title: '2026-2 C언어 분반 첫 모임 안내', target: '2026-2 C언어', author: 'operator1', createdAt: '2026-08-18', pinned: false },
  { id: 3, title: '해달 스터디룸 이용 수칙 안내', target: '전체 수강생', author: '관리자', createdAt: '2026-08-12', pinned: false },
  { id: 4, title: '여름방학 특강 자료 공유', target: '2026-2 C언어', author: 'operator1', createdAt: '2026-08-05', pinned: false },
] as const

/** 수강자 공지사항 목록 - 운영진 관리 화면(피그마 2:37234)에서 읽기 전용으로 파생 */
export function StudentNoticesView() {
  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
        <p className="mt-1 text-sm text-muted-foreground">분반과 시스템 공지를 확인하세요</p>
      </header>

      <section className="divide-y rounded-lg border bg-card">
        {SAMPLE_NOTICES.map((n) => (
          <button
            key={n.id}
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-secondary/50"
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                n.pinned ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-secondary text-primary',
              )}
            >
              <Megaphone className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                {n.pinned && (
                  <span className="shrink-0 rounded-[2px] bg-[#ffdad6] px-2 py-0.5 text-xs font-bold text-[#ba1a1a]">필독</span>
                )}
                <span className="truncate font-semibold">{n.title}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {n.target} · {n.author} · <span className="font-mono">{n.createdAt}</span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </section>
    </div>
  )
}
