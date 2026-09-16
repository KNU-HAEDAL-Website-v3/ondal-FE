import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Code, Plus, Search } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { useProblems } from '@/api/problems'
import { useTags } from '@/api/tags'
import type { ProblemSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { cn } from '@/lib/utils'

/**
 * HOJ - 지금까지 만든 문제를 모아 보는 곳 (/problems, V7).
 *
 * 분반과 무관하다: 로그인한 누구나 목록·상세를 보고 풀 수 있다. 출제·수정은 운영진 이상(서버가 canEdit 로 알려준다).
 * 태그 필터는 AND(고른 태그를 모두 가진 문제)이고 서버가 처리한다 - 번호·제목 검색만 화면에서 거른다.
 */
export default function ProblemsPage() {
  const { data: me } = useMe()
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const myCohortsQuery = useMyCohorts()
  const tagsQuery = useTags()
  const problemsQuery = useProblems(selectedTags)

  const toggleTag = (tagId: number) =>
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))

  const term = keyword.trim().toLowerCase()
  const problems = (problemsQuery.data ?? []).filter(
    (problem) => term === '' || problem.title.toLowerCase().includes(term) || String(problem.problemNo).includes(term),
  )
  // 출제 권한 = ADMIN 이거나 어느 분반에서든 운영진 (BE @OperatorAnywhere 와 같은 조건). 최종 판정은 서버(403)
  const canCreate = me?.globalRole === 'ADMIN' || (myCohortsQuery.data ?? []).some((cohort) => cohort.canManage)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HOJ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            해달 온라인 저지 - 지금까지 만든 문제를 모아 둔 곳이에요. 과제와 무관하게 풀어 보고 바로 채점받을 수 있어요.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="rounded-[2px]" asChild>
            <Link to="/problems/new">
              <Plus data-icon="inline-start" />
              문제 출제
            </Link>
          </Button>
        )}
      </header>

      <section className="space-y-3 rounded-lg border bg-card p-3" aria-label="문제 찾기">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="번호 또는 제목으로 찾기"
            aria-label="문제 검색"
            className="pl-8"
          />
        </div>
        {(tagsQuery.data ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-[0.55px] text-muted-foreground">태그</span>
            {(tagsQuery.data ?? []).map((tag) => {
              const selected = selectedTags.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-[2px] border px-2.5 py-1 text-xs transition-colors',
                    selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                  )}
                >
                  {selected && <Check className="size-3" />}
                  {tag.name}
                </button>
              )
            })}
            {selectedTags.length > 1 && (
              <span className="text-xs text-muted-foreground">고른 태그를 모두 가진 문제만 보여요</span>
            )}
            {selectedTags.length > 0 && (
              <Button variant="ghost" size="xs" className="rounded-[2px]" onClick={() => setSelectedTags([])}>
                필터 해제
              </Button>
            )}
          </div>
        )}
      </section>

      {problemsQuery.isPending ? (
        <LoadingScreen label="문제 불러오는 중..." />
      ) : problemsQuery.error ? (
        <ApiErrorView error={problemsQuery.error} onRetry={() => void problemsQuery.refetch()} />
      ) : problems.length === 0 ? (
        <EmptyState
          icon={<Code className="size-8" />}
          title={term !== '' || selectedTags.length > 0 ? '조건에 맞는 문제가 없어요' : '아직 등록된 문제가 없어요'}
          description={
            term !== '' || selectedTags.length > 0
              ? '검색어나 태그를 바꿔 보세요.'
              : '운영진이 문제를 출제하면 여기에 모입니다.'
          }
        />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-bold">번호</th>
                  <th className="px-2 py-2 text-left font-bold">제목</th>
                  <th className="px-2 py-2 text-left font-bold">태그</th>
                  <th className="px-2 py-2 text-center font-bold">출제</th>
                  <th className="px-4 py-2 text-center font-bold">내 상태</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => (
                  <ProblemRow key={problem.id} problem={problem} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function ProblemRow({ problem }: { problem: ProblemSummary }) {
  return (
    <tr className="border-b last:border-0 hover:bg-secondary/40">
      <td className="px-4 py-3">
        <Link to={`/problems/${problem.id}`} className="font-mono font-semibold text-primary">
          #{problem.problemNo}
        </Link>
      </td>
      <td className="px-2 py-3">
        <Link to={`/problems/${problem.id}`} className="font-medium hover:underline">
          {problem.title}
        </Link>
        {!problem.judgeEnabled && (
          <span className="ml-2 text-xs text-muted-foreground">채점 기준 없음</span>
        )}
      </td>
      <td className="px-2 py-3">
        <span className="flex flex-wrap gap-1">
          {problem.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </span>
      </td>
      <td className="px-2 py-3 text-center text-xs text-muted-foreground">
        {problem.assignedCount === 0 ? '-' : `${problem.assignedCount}회`}
      </td>
      <td className="px-4 py-3 text-center">
        {problem.solved ? (
          <span className="inline-flex items-center gap-1 rounded-[2px] bg-success-bg px-2 py-0.5 text-xs font-bold text-success">
            <Check className="size-3" />
            해결
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  )
}
