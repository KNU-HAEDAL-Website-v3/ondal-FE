import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Lock, Users } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAcceptedSolutions } from '@/api/problems'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { CodeViewer } from '@/components/code/CodePane'
import { Badge } from '@/components/ui/badge'
import { formatKst } from '@/lib/datetime'
import { selectableLanguages } from '@/lib/languages'
import { cn } from '@/lib/utils'

/**
 * "다른 사람 풀이" (HOJ P3, docs hoj/api.md 5절) - 그 문제를 맞힌 사람과 운영진만 볼 수 있다(결정 13: 표절 우려라 맞힌 뒤에만).
 * 절 자체는 호출자가 myStatus === 'SOLVED' || canEdit 일 때만 그리고, 펼칠 때 비로소 조회한다. 서버가 403 NOT_SOLVED 를 주면 안내문.
 * 내용은 사용자당 최신 정답 1건(본인 제외) - 언어 필터는 서버 파라미터.
 */
export function AcceptedSolutionsSection({ problemId, allowedLanguages }: { problemId: number; allowedLanguages: string[] }) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState('')
  const query = useAcceptedSolutions(problemId, language, open)

  return (
    <section aria-label="다른 사람 풀이" className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1.5 text-base font-bold hover:text-primary">
          <Users className="size-4" aria-hidden />
          다른 사람 풀이
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {open ? (
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="풀이 언어 필터" className="h-7 rounded-md border bg-card px-1.5 text-xs">
            <option value="">언어 전체</option>
            {selectableLanguages(allowedLanguages).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">맞힌 사람들의 최신 정답 코드 - 펼쳐서 보기</span>
        )}
      </div>
      {open &&
        (query.isPending ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">풀이 불러오는 중...</p>
        ) : query.error ? (
          query.error instanceof ApiError && query.error.is('NOT_SOLVED') ? (
            <EmptyState compact icon={<Lock className="size-8" />} title="이 문제를 맞힌 뒤에 볼 수 있어요" description={query.error.message} />
          ) : (
            <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
          )
        ) : query.data.length === 0 ? (
          <EmptyState compact title="아직 공개된 풀이가 없어요" description={language === '' ? '다른 사람이 이 문제를 맞히면 여기 보여요.' : '이 언어로 맞힌 사람이 아직 없어요.'} />
        ) : (
          <ul className="divide-y">
            {query.data.map((solution) => (
              <li key={solution.submissionId} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/problems/users/${solution.user.id}`} className="font-medium hover:underline">
                    {solution.user.name}
                  </Link>
                  <Badge variant="secondary">{solution.user.title}</Badge>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold">{solution.language}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {solution.maxTimeMs === null ? '-' : `${solution.maxTimeMs} ms`} · {solution.maxMemoryKb === null ? '-' : `${solution.maxMemoryKb} KB`} · {formatKst(solution.submittedAt)}
                  </span>
                </div>
                <CodeViewer value={solution.codeText} language={solution.language} />
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
