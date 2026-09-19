import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useJudgeConfig, useSaveJudgeConfig } from '@/api/judge'
import { useCreateProblem, useProblem, useUpdateProblem } from '@/api/problems'
import { useTags } from '@/api/tags'
import type { ProblemPayload } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import {
  JudgeConfigSection,
  draftEquals,
  draftFromConfig,
  emptyDraft,
  emptyExpectedCount,
  toPayload,
  type JudgeDraft,
} from '@/components/judge/JudgeConfigSection'
import { LoadingScreen } from '@/components/LoadingScreen'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseId } from '@/lib/params'
import { cn } from '@/lib/utils'

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring'

const DRAFT_PREFIX = 'ondal-problem-draft'
const draftKey = (problemId: number | null) => `${DRAFT_PREFIX}:${problemId ?? 'new'}`

interface ProblemDraft {
  problemNo: string
  title: string
  description: string
  tagIds: number[]
}

/**
 * 문제 출제·수정 (운영진 이상) - /problems/new · /problems/:problemId/edit.
 *
 * V7: 문제는 분반에 속하지 않는다 - 제목·본문·번호·태그·테스트케이스가 전부 여기 모인다.
 * 저장 버튼 하나로 문제 저장 -> 채점 설정 저장 순서로 두 번 부른다 (새 문제는 생성 응답의 id 로 이어서).
 * 작성 내용은 세션 만료에 대비해 임시 저장한다 (CLAUDE.md 규칙 1).
 */
export default function ProblemFormPage() {
  const { problemId: problemParam } = useParams()
  const editing = problemParam !== undefined
  const problemId = editing ? parseId(problemParam) : null
  const navigate = useNavigate()

  const existingQuery = useProblem(editing ? (problemId as number) : NaN)
  const judgeQuery = useJudgeConfig(editing ? (problemId as number) : NaN, editing)
  const tagsQuery = useTags()

  const key = draftKey(problemId)
  const saved = readDraft<ProblemDraft>(key)
  const [problemNo, setProblemNo] = useState(saved?.problemNo ?? '')
  const [title, setTitle] = useState(saved?.title ?? '')
  const [description, setDescription] = useState(saved?.description ?? '')
  const [tagIds, setTagIds] = useState<number[]>(saved?.tagIds ?? [])
  // 임시 저장본이 있으면 그것이 더 최신 - 서버 값으로 덮어쓰지 않는다
  const [prefilled, setPrefilled] = useState(!editing || saved !== null)

  const [judgeDraft, setJudgeDraft] = useState<JudgeDraft>(emptyDraft)
  const [judgeInitial, setJudgeInitial] = useState<JudgeDraft>(emptyDraft)
  const [judgePrefilled, setJudgePrefilled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreateProblem()
  const updateMutation = useUpdateProblem(editing ? (problemId as number) : NaN)
  const saveJudge = useSaveJudgeConfig()
  const pending = createMutation.isPending || updateMutation.isPending || saveJudge.isPending

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      setProblemNo(String(existingQuery.data.problemNo))
      setTitle(existingQuery.data.title)
      setDescription(existingQuery.data.description ?? '')
      setTagIds(existingQuery.data.tags.map((tag) => tag.id))
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  useEffect(() => {
    if (judgeQuery.data && !judgePrefilled) {
      const next = draftFromConfig(judgeQuery.data)
      setJudgeDraft(next)
      setJudgeInitial(next)
      setJudgePrefilled(true)
    }
  }, [judgeQuery.data, judgePrefilled])

  useEffect(() => {
    if (!prefilled) return
    if (title === '' && description === '' && tagIds.length === 0) clearDraft(key)
    else writeDraft<ProblemDraft>(key, { problemNo, title, description, tagIds })
  }, [key, prefilled, problemNo, title, description, tagIds])

  if (editing && !Number.isFinite(problemId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 문제 주소예요.')} />
  }
  if (editing && existingQuery.isPending) return <LoadingScreen label="문제 불러오는 중..." />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }

  const toggleTag = (tagId: number) =>
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))

  const payload = (): ProblemPayload => ({
    problemNo: problemNo.trim() === '' ? null : Number(problemNo),
    title: title.trim(),
    description: description.trim() === '' ? null : description,
    tagIds,
  })

  const judgeChanged = !draftEquals(judgeDraft, judgeInitial)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending || title.trim() === '') return
    setError(null)

    // 기대 출력이 빈 케이스는 "아무것도 출력하지 않아야 통과"가 된다 - 저장 직전에 한 번 더 묻는다 (2026-09-15 운영 피드백)
    const empties = emptyExpectedCount(judgeDraft)
    if (empties > 0 && !window.confirm(`기대 출력이 비어 있는 테스트케이스가 ${empties}개예요.\n그대로 저장하면 아무것도 출력하지 않아야 통과로 채점됩니다. 계속할까요?`)) {
      return
    }
    // 케이스를 바꾸면 이 문제로 채점된 제출 전부가 낡은 판정이 된다 - 다시 돌릴지 묻는다
    let rejudge = false
    if (editing && judgeChanged && (judgeQuery.data?.affectedSubmissions ?? 0) > 0) {
      rejudge = window.confirm(
        `채점 기준이 바뀌었어요. 이 문제로 채점된 제출 ${judgeQuery.data?.affectedSubmissions}건을 지금 다시 채점할까요?\n(취소하면 기존 판정이 그대로 남습니다)`,
      )
    }

    try {
      const savedProblem = editing
        ? await updateMutation.mutateAsync(payload())
        : await createMutation.mutateAsync(payload())
      if (!editing || judgeChanged) {
        await saveJudge.mutateAsync({ problemId: savedProblem.id, payload: toPayload(judgeDraft, rejudge) })
      }
      clearDraft(key)
      navigate(`/problems/${savedProblem.id}`, { replace: true })
    } catch (e) {
      // 실패해도 입력은 그대로 둔다 (CLAUDE.md 규칙 1)
      setError(e instanceof Error ? e.message : '저장에 실패했어요.')
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={editing ? `/problems/${problemId}` : '/problems'}>
          <ArrowLeft data-icon="inline-start" />
          {editing ? '문제로 돌아가기' : '문제 목록으로'}
        </Link>
      </Button>

      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '문제 수정' : '문제 출제'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          문제는 분반과 무관한 라이브러리예요. 만든 뒤 과제로 배정하면 여러 분반에서 같은 문제를 쓸 수 있어요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="problem-no">문제 번호</Label>
              <Input
                id="problem-no"
                type="number"
                min={1000}
                value={problemNo}
                onChange={(e) => setProblemNo(e.target.value)}
                placeholder="비우면 자동"
              />
              <p className="text-xs text-muted-foreground">비우면 자동으로 붙어요</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="problem-title">제목</Label>
              <Input
                id="problem-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="예: 두 수의 합"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="problem-description">문제 본문 (선택)</Label>
            <textarea
              id="problem-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={8}
              className={TEXTAREA_CLASS}
              placeholder="입력 형식·출력 형식·제한을 적어 주세요."
            />
          </div>

          <div className="space-y-2">
            <Label>태그</Label>
            {tagsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">태그 불러오는 중...</p>
            ) : (tagsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                아직 태그가 없어요. 태그는 관리자만 만들 수 있어요 - 필요하면 해구르르에게 요청하세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(tagsQuery.data ?? []).map((tag) => {
                  const selected = tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors',
                        selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <JudgeConfigSection
          problemId={editing ? (problemId as number) : null}
          config={judgeQuery.data ?? null}
          draft={judgeDraft}
          onChange={setJudgeDraft}
          disabled={pending}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending || title.trim() === ''}>
            {pending ? '저장 중...' : editing ? '저장' : '출제하기'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={editing ? `/problems/${problemId}` : '/problems'}>취소</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
