import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Check, ExternalLink, Plus, Search } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAssignment, useCreateAssignment, useUpdateAssignment } from '@/api/assignments'
import { useCohort } from '@/api/cohorts'
import { useProblems } from '@/api/problems'
import type { ProblemSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { kstInputToIso, toKstInputValue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * 과제 등록·수정 = "문제를 이 분반에 배정" (운영진 이상, canManage 진입) - /assignments/new · /assignments/:id/edit, 분반은 ?cohort= 필수.
 *
 * V7: 제목·본문·문제 번호·테스트케이스는 문제(Problem)의 것이라 이 화면에 없다.
 * 여기서 정하는 것은 **어느 문제를·몇 차시에·언제까지** 세 가지뿐 - 새 문제가 필요하면 HOJ 출제 화면으로 보낸다.
 * 같은 문제를 다른 분반에 다시 배정해도 테스트케이스는 하나를 공유하므로 채점 기준이 갈라지지 않는다.
 *
 * - 실패(400·409 등) 시 입력 보존 + 에러 문구 표시 (CLAUDE.md 규칙 1)
 * - 요청 중 저장 버튼 잠금 (규칙 2)
 * - 보관 분반이면 저장 사전 비활성 (409 COHORT_ARCHIVED 규약)
 * - 마감 입력은 KST 기준, 서버 전송은 UTC ISO
 */
export default function AssignmentFormPage() {
  const { assignmentId } = useParams()
  const editing = assignmentId !== undefined
  const aid = Number(assignmentId)
  const [searchParams] = useSearchParams()
  const cohortParam = Number(searchParams.get('cohort'))
  const cohortId = Number.isInteger(cohortParam) && cohortParam > 0 ? cohortParam : NaN
  const navigate = useNavigate()

  const cohortQuery = useCohort(cohortId)
  const existingQuery = useAssignment(editing ? cohortId : NaN, editing ? aid : NaN)
  const problemsQuery = useProblems()

  // "차시 추가"·블럭 "+ 과제"가 넘기는 차시 프리필 (?session= - assignment/design.md 결정 8)
  const sessionParam = searchParams.get('session')
  const [problemId, setProblemId] = useState<number | null>(null)
  const [sessionNo, setSessionNo] = useState(() =>
    !editing && sessionParam !== null && /^[1-9]\d*$/.test(sessionParam) ? sessionParam : '',
  )
  const [dueAt, setDueAt] = useState('')
  const [keyword, setKeyword] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      const a = existingQuery.data
      setProblemId(a.problemId)
      setSessionNo(a.sessionNo === null ? '' : String(a.sessionNo))
      setDueAt(toKstInputValue(a.dueAt))
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  const createMutation = useCreateAssignment(cohortId)
  const updateMutation = useUpdateAssignment(cohortId, aid)
  const mutation = editing ? updateMutation : createMutation

  if (!Number.isFinite(cohortId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '분반 정보가 없는 주소예요. 과제 목록에서 다시 들어와 주세요.')} />
  }
  if (editing && existingQuery.isPending) return <LoadingScreen />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }

  const cohort = cohortQuery.data
  const archived = cohort?.status === 'ARCHIVED'
  const saving = mutation.isPending
  const problems = problemsQuery.data ?? []
  const selected = problems.find((problem) => problem.id === problemId) ?? null

  const term = keyword.trim().toLowerCase()
  const visible = problems.filter(
    (problem) => term === '' || problem.title.toLowerCase().includes(term) || String(problem.problemNo).includes(term),
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (saving || problemId === null || dueAt === '') return
    // 배정된 문제를 바꾸면 학생이 보던 문제가 달라진다 - 기존 제출은 남지만 기준이 바뀌므로 한 번 묻는다
    if (editing && existingQuery.data && problemId !== existingQuery.data.problemId) {
      if (!window.confirm('배정된 문제를 다른 문제로 바꿉니다.\n학생에게 보이는 문제가 달라지고, 이미 낸 제출은 그대로 남아요. 계속할까요?')) {
        return
      }
    }
    mutation.mutate(
      {
        problemId,
        sessionNo: sessionNo.trim() === '' ? null : Number(sessionNo),
        dueAt: kstInputToIso(dueAt),
      },
      {
        onSuccess: (saved) => navigate(`/assignments/${editing ? aid : saved.id}?cohort=${cohortId}`, { replace: true }),
        // 실패하면 아무것도 지우지 않는다 - mutation.error 가 폼 아래에 표시된다 (규칙 1)
      },
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={editing ? `/assignments/${aid}?cohort=${cohortId}` : `/assignments?cohort=${cohortId}`}>
          <ArrowLeft data-icon="inline-start" />
          {editing ? '과제 상세로' : '과제 목록으로'}
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '과제 수정' : '과제 배정'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort ? `${cohort.name} - ` : ''}
          HOJ 에 있는 문제를 골라 이 분반에 배정해요. 문제 자체(제목·본문·테스트케이스)는 문제 화면에서 고칩니다.
        </p>
      </header>

      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반은 과제를 변경할 수 없어요. 보관을 해제한 뒤 다시 시도해 주세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="문제 고르기">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-base font-bold">1. 문제 고르기</Label>
            <Button type="button" variant="outline" size="sm" className="rounded-[2px]" asChild>
              <Link to="/problems/new">
                <Plus data-icon="inline-start" />
                새 문제 출제
              </Link>
            </Button>
          </div>

          {selected && (
            <div className="flex flex-wrap items-center gap-2 rounded-[2px] border border-primary bg-secondary px-3 py-2 text-sm">
              <Check className="size-4 text-primary" />
              <span className="font-mono font-semibold text-primary">#{selected.problemNo}</span>
              <span className="font-medium">{selected.title}</span>
              {selected.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
              {!selected.judgeEnabled && <span className="text-xs text-muted-foreground">채점 기준 없음 - 제출만 받아요</span>}
              <Link
                to={`/problems/${selected.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                문제 보기
                <ExternalLink className="size-3" />
              </Link>
            </div>
          )}

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

          {problemsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">문제 목록 불러오는 중...</p>
          ) : problems.length === 0 ? (
            <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
              아직 출제된 문제가 없어요. "새 문제 출제"로 먼저 문제를 만들어 주세요.
            </p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto rounded-[2px] border">
              {visible.map((problem) => (
                <ProblemChoice
                  key={problem.id}
                  problem={problem}
                  selected={problem.id === problemId}
                  onSelect={() => setProblemId(problem.id)}
                />
              ))}
              {visible.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">조건에 맞는 문제가 없어요.</li>
              )}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="배정 설정">
          <Label className="text-base font-bold">2. 차시와 마감</Label>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignment-session">차시 번호 (선택)</Label>
              <Input
                id="assignment-session"
                type="number"
                min={1}
                value={sessionNo}
                onChange={(e) => setSessionNo(e.target.value)}
                placeholder="비우면 차시 없는 과제"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-due">마감 시각 (KST)</Label>
              <Input
                id="assignment-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
              {editing && <p className="text-xs text-muted-foreground">마감을 바꾸면 지각 판정도 새 마감 기준으로 다시 계산돼요.</p>}
            </div>
          </div>
        </section>

        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || archived || problemId === null || dueAt === ''} className="rounded-[2px]">
            {saving ? '저장 중...' : editing ? '저장' : '배정하기'}
          </Button>
          <Button type="button" variant="outline" className="rounded-[2px]" asChild>
            <Link to={editing ? `/assignments/${aid}?cohort=${cohortId}` : `/assignments?cohort=${cohortId}`}>취소</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}

function ProblemChoice({
  problem,
  selected,
  onSelect,
}: {
  problem: ProblemSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
          selected ? 'bg-secondary font-semibold' : 'hover:bg-secondary/50',
        )}
      >
        <span className="font-mono text-primary">#{problem.problemNo}</span>
        <span className="min-w-0 flex-1 truncate">{problem.title}</span>
        {problem.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            {tag.name}
          </Badge>
        ))}
        {problem.assignedCount > 0 && (
          <span className="text-xs text-muted-foreground">{problem.assignedCount}회 출제</span>
        )}
        {selected && <Check className="size-4 text-primary" />}
      </button>
    </li>
  )
}
