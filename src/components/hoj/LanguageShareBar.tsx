import { cn } from '@/lib/utils'

/** 언어별 색 - 차트 토큰 5 + HOJ 브랜드색. 언어가 6종이라 딱 맞는다 (index.css) */
const SEGMENT_CLASS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-hoj-brand']

/**
 * 언어 비율 막대 (HOJ P3 사용자 페이지) - 연습 제출의 언어별 건수를 한 줄 막대로. 건수는 서버 값, 폭은 그 비율.
 */
export function LanguageShareBar({ languages }: { languages: { language: string; count: number }[] }) {
  const total = languages.reduce((sum, l) => sum + l.count, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">아직 연습 제출이 없어요.</p>
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-md bg-muted" role="img" aria-label="언어별 제출 비율">
        {languages.map((l, i) => (
          <span
            key={l.language}
            className={cn('h-full', SEGMENT_CLASS[i % SEGMENT_CLASS.length])}
            style={{ width: `${(l.count / total) * 100}%` }}
            title={`${l.language} ${l.count}건`}
          />
        ))}
      </div>
      <ul className="space-y-1 text-sm">
        {languages.map((l, i) => (
          <li key={l.language} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={cn('size-2.5 shrink-0 rounded-sm', SEGMENT_CLASS[i % SEGMENT_CLASS.length])} aria-hidden />
              {l.language}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {l.count}건 · {Math.round((l.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
