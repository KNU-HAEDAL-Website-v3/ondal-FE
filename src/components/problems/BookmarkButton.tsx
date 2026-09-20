import { Star } from 'lucide-react'
import { useToggleBookmark } from '@/api/problems'
import { cn } from '@/lib/utils'

/**
 * 북마크 별 (HOJ P3, 7절) - 목록 행과 상세 헤더가 같이 쓴다. 누르면 낙관적으로 바뀌고 실패하면 되돌아간다 (api/problems useToggleBookmark).
 * withLabel 이면 "북마크"/"북마크됨" 글자를 붙인 버튼(상세 헤더), 아니면 별 아이콘만(목록 행)
 */
export function BookmarkButton({ problemId, bookmarked, withLabel = false, className }: { problemId: number; bookmarked: boolean; withLabel?: boolean; className?: string }) {
  const mutation = useToggleBookmark()
  const label = bookmarked ? '북마크 해제' : '북마크'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        mutation.mutate({ problemId, bookmarked: !bookmarked })
      }}
      aria-pressed={bookmarked}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md transition-colors',
        withLabel ? 'border px-2.5 py-1 text-xs font-semibold' : 'p-1',
        bookmarked ? 'text-caution' : 'text-muted-foreground hover:text-caution',
        withLabel && bookmarked && 'border-caution bg-caution-bg',
        withLabel && !bookmarked && 'hover:bg-secondary',
        className,
      )}
    >
      <Star className={cn('size-4', bookmarked && 'fill-current')} aria-hidden />
      {withLabel && (bookmarked ? '북마크됨' : '북마크')}
    </button>
  )
}
