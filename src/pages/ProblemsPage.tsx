import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowDownUp, Check, Code, Plus, Search, Upload } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { useProblems } from '@/api/problems'
import { useTags } from '@/api/tags'
import type { ProblemSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isAdminRole } from '@/lib/roles'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { DifficultyBadge } from '@/components/problems/DifficultyBadge'
import { ImportProblemsDialog } from '@/components/problems/ImportProblemsDialog'
import { TIER_LABELS, tierOf } from '@/lib/difficulty'
import { cn } from '@/lib/utils'

/**
 * HOJ - 지금까지 만든 문제를 모아 보는 곳 (/problems, V7).
 *
 * 분반과 무관하다: 로그인한 누구나 목록·상세를 보고 풀 수 있다. 출제·수정은 운영진 이상(서버가 canEdit 로 알려준다).
 * 태그 필터는 AND(고른 태그를 모두 가진 문제)이고 서버가 처리한다 - 번호·제목·태그 이름 검색, 난이도 필터, 정렬은 화면에서 한다.
 * 목록은 많아야 수백 개(문제 은행 100 + 출제분)라 서버 정렬·페이징 없이 통째로 받아 화면에서 거른다.
 */

/** 목록 정렬 - 서버는 번호 오름차순으로만 준다. 값이 같으면 번호 오름차순으로 묶어 순서가 흔들리지 않게 */
type ProblemSort = 'no-asc' | 'no-desc' | 'difficulty-asc' | 'difficulty-desc' | 'unsolved-first' | 'assigned-desc'

const SORT_OPTIONS: ReadonlyArray<{ value: ProblemSort; label: string }> = [
  { value: 'no-asc', label: '번호 오름차순' },
  { value: 'no-desc', label: '번호 내림차순' },
  { value: 'difficulty-asc', label: '난이도 낮은 순' },
  { value: 'difficulty-desc', label: '난이도 높은 순' },
  { value: 'unsolved-first', label: '안 푼 문제 먼저' },
  { value: 'assigned-desc', label: '출제 많은 순' },
]

/** 난이도 미지정(null)은 오름차순·내림차순 어느 쪽이든 맨 뒤 */
function compareProblems(a: ProblemSummary, b: ProblemSummary, sort: ProblemSort): number {
  const byNo = a.problemNo - b.problemNo
  switch (sort) {
    case 'no-asc':
      return byNo
    case 'no-desc':
      return -byNo
    case 'difficulty-asc':
    case 'difficulty-desc': {
      if (a.difficulty === null || b.difficulty === null) {
        if (a.difficulty === b.difficulty) return byNo
        return a.difficulty === null ? 1 : -1
      }
      const byDifficulty = sort === 'difficulty-asc' ? a.difficulty - b.difficulty : b.difficulty - a.difficulty
      return byDifficulty !== 0 ? byDifficulty : byNo
    }
    case 'unsolved-first':
      return a.solved === b.solved ? byNo : a.solved ? 1 : -1
    case 'assigned-desc':
      return b.assignedCount - a.assignedCount || byNo
  }
}

/** 태그가 이보다 많으면 많이 쓰인 것부터 이 개수만 보이고 "모두 보기"로 펼친다 - 문제 은행 100문제에 태그가 92개 */
const TAG_PREVIEW_COUNT = 20

export default function ProblemsPage() {
  const { data: me } = useMe()
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [tier, setTier] = useState<number | null>(null) // 난이도 대분류 필터 - 화면에서 거른다
  const [sort, setSort] = useState<ProblemSort>('no-asc')
  const [tagQuery, setTagQuery] = useState('') // 태그 버튼 목록을 이름으로 좁힌다 - 문제 검색과는 별개
  const [showAllTags, setShowAllTags] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const myCohortsQuery = useMyCohorts()
  const tagsQuery = useTags()
  const problemsQuery = useProblems(selectedTags)

  const toggleTag = (tagId: number) =>
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))

  const term = keyword.trim().toLowerCase()
  const matchesTerm = (problem: ProblemSummary) =>
    term === '' ||
    problem.title.toLowerCase().includes(term) ||
    String(problem.problemNo).includes(term) ||
    problem.tags.some((tag) => tag.name.toLowerCase().includes(term))
  const problems = (problemsQuery.data ?? [])
    .filter(matchesTerm)
    .filter((problem) => tier === null || tierOf(problem.difficulty) === tier)
    .sort((a, b) => compareProblems(a, b, sort))
  const hasFilter = term !== '' || selectedTags.length > 0 || tier !== null

  // 태그별 문제 수 - 서버가 준 목록(고른 태그 AND) 기준. 태그를 고른 상태에서 0 이면 그 태그를 더해도 남는 문제가 없다는 뜻
  const tagCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const problem of problemsQuery.data ?? []) {
      for (const tag of problem.tags) counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1)
    }
    return counts
  }, [problemsQuery.data])
  const allTags = tagsQuery.data ?? []
  // 고른 태그 → 문제 많은 태그 → 이름순. 서버는 이름순으로만 주므로 여기서 다시 세운다
  const orderedTags = useMemo(
    () =>
      [...(tagsQuery.data ?? [])].sort((a, b) => {
        const bySelected = Number(selectedTags.includes(b.id)) - Number(selectedTags.includes(a.id))
        if (bySelected !== 0) return bySelected
        const byCount = (tagCounts.get(b.id) ?? 0) - (tagCounts.get(a.id) ?? 0)
        return byCount !== 0 ? byCount : a.name.localeCompare(b.name, 'ko')
      }),
    [tagsQuery.data, selectedTags, tagCounts],
  )
  const tagTerm = tagQuery.trim().toLowerCase()
  const tagsCollapsible = allTags.length > TAG_PREVIEW_COUNT
  const visibleTags =
    tagTerm !== ''
      ? orderedTags.filter((tag) => tag.name.toLowerCase().includes(tagTerm))
      : tagsCollapsible && !showAllTags
        ? orderedTags.slice(0, TAG_PREVIEW_COUNT)
        : orderedTags
  // 출제 권한 = ADMIN 이거나 어느 분반에서든 운영진 (BE @OperatorAnywhere 와 같은 조건). 최종 판정은 서버(403)
  const canCreate = isAdminRole(me?.globalRole) || (myCohortsQuery.data ?? []).some((cohort) => cohort.canManage)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HOJ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            해달 온라인 저지 - 지금까지 만든 문제를 모아 둔 곳이에요. 과제와 무관하게 풀어 보고 바로 채점받을 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 번들 가져오기는 관리자만 - 태그 어휘까지 만들기 때문 (BE @AdminOnly) */}
          {isAdminRole(me?.globalRole) && (
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload data-icon="inline-start" />
              문제 가져오기
            </Button>
          )}
          {canCreate && (
            <Button size="sm" asChild>
              <Link to="/problems/new">
                <Plus data-icon="inline-start" />
                문제 출제
              </Link>
            </Button>
          )}
        </div>
      </header>
      {importOpen && <ImportProblemsDialog open onOpenChange={(open) => !open && setImportOpen(false)} />}

      <section className="space-y-3 rounded-lg border bg-card p-3" aria-label="문제 찾기">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="번호·제목·태그로 찾기"
              aria-label="문제 검색"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {problemsQuery.data && <span className="text-xs text-muted-foreground">{problems.length}문제</span>}
            <Label htmlFor="problem-sort" className="sr-only">
              문제 정렬
            </Label>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDownUp className="size-3.5" aria-hidden />
              정렬
            </span>
            <select
              id="problem-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as ProblemSort)}
              className="h-7 rounded-md border bg-card px-2 text-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="난이도 필터">
          <span className="mr-1 font-semibold text-muted-foreground">난이도</span>
          {TIER_LABELS.map((label, index) => {
            const value = index + 1
            const selected = tier === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTier(selected ? null : value)}
                className={cn(
                  'rounded-md border px-2.5 py-1 transition-colors',
                  selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        {allTags.length > 0 && (
          <div className="space-y-2" aria-label="태그 필터">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-[0.55px] text-muted-foreground">태그</span>
              {tagsCollapsible && (
                <Input
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="태그 이름으로 찾기"
                  aria-label="태그 찾기"
                  className="h-7 w-44 text-xs"
                />
              )}
              {selectedTags.length > 1 && (
                <span className="text-xs text-muted-foreground">고른 태그를 모두 가진 문제만 보여요</span>
              )}
              {selectedTags.length > 0 && (
                <Button variant="ghost" size="xs" onClick={() => setSelectedTags([])}>
                  필터 해제
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {visibleTags.map((tag) => {
                const selected = selectedTags.includes(tag.id)
                const count = tagCounts.get(tag.id) ?? 0
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors',
                      selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                      !selected && problemsQuery.data && count === 0 && 'text-muted-foreground',
                    )}
                  >
                    {selected && <Check className="size-3" />}
                    {tag.name}
                    {problemsQuery.data && <span className="font-normal text-muted-foreground">{count}</span>}
                  </button>
                )
              })}
              {visibleTags.length === 0 && <span className="text-xs text-muted-foreground">이름에 맞는 태그가 없어요</span>}
              {tagsCollapsible && tagTerm === '' && (
                <Button variant="ghost" size="xs" onClick={() => setShowAllTags((prev) => !prev)}>
                  {showAllTags ? '접기' : `태그 모두 보기 (${allTags.length})`}
                </Button>
              )}
            </div>
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
          title={hasFilter ? '조건에 맞는 문제가 없어요' : '아직 등록된 문제가 없어요'}
          description={hasFilter ? '검색어·난이도·태그를 바꿔 보세요.' : '운영진이 문제를 출제하면 여기에 모입니다.'}
        />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-bold">번호</th>
                  <th className="px-2 py-2 text-left font-bold">난이도</th>
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
        <DifficultyBadge value={problem.difficulty} />
      </td>
      <td className="px-2 py-3">
        <Link to={`/problems/${problem.id}`} className="font-medium hover:underline">
          {problem.title}
        </Link>
        {!problem.judgeEnabled && (
          <span className="ml-2 text-xs text-muted-foreground">채점 기준 없음</span>
        )}
        {problem.allowedLanguages.length > 0 && (
          <span className="ml-2 rounded-md bg-info-bg px-1.5 py-0.5 text-[11px] font-semibold text-info">{problem.allowedLanguages.join(' · ')} 전용</span>
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
          <span className="inline-flex items-center gap-1 rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">
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
