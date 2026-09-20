import { useState } from 'react'
import { Activity, Loader2, Search } from 'lucide-react'
import { useHojSubmissions } from '@/api/hoj'
import type { HojSubmissionItem, Verdict } from '@/api/types'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SubmissionFeedTable } from '@/components/hoj/SubmissionFeedTable'
import { VERDICT_META, isJudging } from '@/components/judge/VerdictBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LANGUAGES } from '@/lib/languages'

/**
 * 채점 현황 - HOJ 연습 제출 전체의 피드 (/problems/status, P3 - docs hoj/api.md 2절·10절).
 * 분반 과제 제출은 섞지 않는다(PM 결정). 판정·언어는 서버 파라미터, 문제 번호/제목·이름 검색은 받아 온 것 안에서(클라이언트).
 * 채점 중인 항목이 보이면 5초마다 새로 고치고, "더 보기"는 마지막 항목 id 를 커서로 다음 50건을 잇는다 (api/hoj.ts).
 */
export default function HojStatusPage() {
  const [verdict, setVerdict] = useState<Verdict | ''>('')
  const [language, setLanguage] = useState('')
  const [keyword, setKeyword] = useState('')
  const feed = useHojSubmissions({ verdict, language })

  const items = (feed.data?.pages ?? []).flatMap((page) => page.items)
  const term = keyword.trim().toLowerCase()
  const matches = (item: HojSubmissionItem) =>
    term === '' ||
    String(item.problem.problemNo).includes(term) ||
    item.problem.title.toLowerCase().includes(term) ||
    item.user.name.toLowerCase().includes(term)
  const visible = items.filter(matches)
  const judging = items.some((item) => isJudging(item.judgeStatus))
  const hasFilter = verdict !== '' || language !== '' || term !== ''

  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">채점 현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">HOJ 연습 제출의 채점 결과가 최신순으로 모여요. 분반 과제 제출은 여기 없어요.</p>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3" aria-label="채점 현황 필터">
        <select value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict | '')} aria-label="판정 필터" className="h-8 rounded-lg border bg-card px-2 text-sm">
          <option value="">판정 전체</option>
          {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
            <option key={v} value={v}>
              {VERDICT_META[v].label}
            </option>
          ))}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="언어 필터" className="h-8 rounded-lg border bg-card px-2 text-sm">
          <option value="">언어 전체</option>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="문제 번호·제목·이름으로 찾기" aria-label="채점 현황 검색" className="pl-8" />
        </div>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {judging && (
            <span className="flex items-center gap-1" role="status">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              채점 중인 제출이 있어 5초마다 새로 고쳐요
            </span>
          )}
          {feed.data && <span>{visible.length}건 표시 중</span>}
        </span>
      </section>

      {feed.isPending ? (
        <LoadingScreen label="채점 현황 불러오는 중..." />
      ) : feed.error ? (
        <ApiErrorView error={feed.error} onRetry={() => void feed.refetch()} />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card" aria-label="채점 현황 목록">
          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={<Activity className="size-8" />}
              title={hasFilter ? '조건에 맞는 제출이 없어요' : '아직 연습 제출이 없어요'}
              description={hasFilter ? '판정·언어·검색어를 바꿔 보세요.' : '문제를 풀어 제출하면 여기에 최신순으로 쌓여요.'}
            />
          ) : (
            <SubmissionFeedTable items={visible} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-4 py-2 text-xs text-muted-foreground">
            <span>
              {items.length}건 불러옴{term !== '' && ` · 검색 결과 ${visible.length}건`}
            </span>
            {feed.hasNextPage ? (
              <Button variant="outline" size="sm" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                {feed.isFetchingNextPage ? '불러오는 중...' : '더 보기'}
              </Button>
            ) : (
              items.length > 0 && <span>마지막까지 봤어요</span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
