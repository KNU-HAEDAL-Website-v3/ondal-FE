import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAssignment, useCreateAssignment, useUpdateAssignment } from '@/api/assignments'
import { useCohort } from '@/api/cohorts'
import { useJudgeConfig, useSaveJudgeConfig } from '@/api/judge'
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
import { kstInputToIso, toKstInputValue } from '@/lib/datetime'

/**
 * 과제 등록·수정 폼 (운영진 이상, canManage 진입) - /assignments/new · /assignments/:id/edit, 분반은 ?cohort= 필수.
 * - 실패(400·409 등) 시 작성 내용 보존 + 에러 문구 표시 (CLAUDE.md 규칙 1)
 * - 요청 중 저장 버튼 잠금 (규칙 2)
 * - 보관 분반이면 저장 사전 비활성 (409 COHORT_ARCHIVED 규약)
 * - 마감 입력은 KST 기준, 서버 전송은 UTC ISO
 * - 아래 "자동 채점" 섹션(docs judge/fe.md 1절): 저장 버튼 하나로 과제(#16/#17) → 채점 설정(#48) 순서로 저장. 새 과제는 생성 응답의 id 로 이어서
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
  const judgeQuery = useJudgeConfig(cohortId, aid, editing)

  // "차시 추가"·블럭 "+ 과제"가 넘기는 차시 프리필 (?session= - assignment/design.md 결정 8)
  const sessionParam = searchParams.get('session')
  const [problemNo, setProblemNo] = useState('')
  const [sessionNo, setSessionNo] = useState(() =>
    !editing && sessionParam !== null && /^[1-9]\d*$/.test(sessionParam) ? sessionParam : '',
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  const [judgeDraft, setJudgeDraft] = useState<JudgeDraft>(emptyDraft)
  const [judgeInitial, setJudgeInitial] = useState<JudgeDraft>(emptyDraft)
  const [judgePrefilled, setJudgePrefilled] = useState(false)
  const [judgeError, setJudgeError] = useState<string | null>(null)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      const a = existingQuery.data
      setProblemNo(String(a.problemNo))
      setSessionNo(a.sessionNo === null ? '' : String(a.sessionNo))
      setTitle(a.title)
      setDescription(a.description ?? '')
      setDueAt(toKstInputValue(a.dueAt))
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  useEffect(() => {
    if (editing && judgeQuery.data && !judgePrefilled) {
      const draft = draftFromConfig(judgeQuery.data)
      setJudgeDraft(draft)
      setJudgeInitial(draft)
      setJudgePrefilled(true)
    }
  }, [editing, judgeQuery.data, judgePrefilled])

  const createMutation = useCreateAssignment(cohortId)
  const updateMutation = useUpdateAssignment(cohortId, aid)
  const mutation = editing ? updateMutation : createMutation
  const saveJudge = useSaveJudgeConfig(cohortId)

  if (!Number.isFinite(cohortId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '분반 정보가 없는 주소예요. 과제 목록에서 다시 들어와 주세요.')} />
  }
  if (editing && (existingQuery.isPending || judgeQuery.isPending)) return <LoadingScreen />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }
  if (editing && judgeQuery.error) {
    return <ApiErrorView error={judgeQuery.error} onRetry={() => void judgeQuery.refetch()} />
  }

  const cohort = cohortQuery.data
  const archived = cohort?.status === 'ARCHIVED'
  const saving = mutation.isPending || saveJudge.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const parsedProblemNo = problemNo.trim() === '' ? null : Number(problemNo)
    const originalProblemNo = editing ? existingQuery.data?.problemNo : undefined
    if (
      editing &&
      parsedProblemNo !== null &&
      originalProblemNo !== undefined &&
      parsedProblemNo !== originalProblemNo &&
      !window.confirm('문제 번호를 바꾸면 학생이 혼동할 수 있어요. 계속할까요?')
    ) {
      return
    }

    // 자동 채점 설정 - 바뀐 게 없으면 서버에 보내지 않는다(제출만 받는 과제의 흐름은 그대로)
    const judgeChanged = !draftEquals(judgeDraft, judgeInitial)
    const judgeNeedsSave = judgeChanged || (!editing && judgeDraft.enabled && judgeDraft.testCases.length > 0)
    if (editing && judgeChanged && judgeInitial.enabled && !judgeDraft.enabled) {
      if (!window.confirm(`테스트케이스 ${judgeInitial.testCases.length}개를 지우고 자동 채점을 해제합니다. 계속할까요?`)) return
    }
    // 기대 출력이 빈 케이스 = 채점 기준이 비었다는 뜻 - 그대로 두면 모든 제출이 틀렸습니다로 나온다 (2026-09-14 운영 피드백)
    const empties = emptyExpectedCount(judgeDraft)
    if (judgeNeedsSave && empties > 0) {
      const warning =
        `기대 출력이 비어 있는 테스트케이스가 ${empties}개 있어요.\n` +
        '이대로 저장하면 그 케이스는 "아무것도 출력하지 않아야" 통과합니다. 대부분은 정답 출력을 빠뜨린 경우예요.\n\n' +
        '그래도 저장할까요? (취소하면 폼으로 돌아가 정답 코드로 기대 출력을 채울 수 있어요)'
      if (!window.confirm(warning)) return
    }

    let rejudge = false
    const affected = judgeQuery.data?.affectedSubmissions ?? 0
    if (editing && judgeChanged && judgeDraft.enabled && affected > 0) {
      rejudge = window.confirm(
        `이 과제에 코드 제출 ${affected}건이 있어요. 새 테스트케이스·제한으로 다시 채점할까요?\n"취소"하면 기존 판정은 그대로 두고 저장만 해요.`,
      )
    }

    setJudgeError(null)
    let saved
    try {
      saved = await mutation.mutateAsync({
        problemNo: parsedProblemNo,
        sessionNo: sessionNo.trim() === '' ? null : Number(sessionNo),
        title: title.trim(),
        description: description.trim() === '' ? null : description,
        dueAt: kstInputToIso(dueAt),
      })
    } catch {
      return // mutation.error 가 폼 아래에 표시된다 - 입력은 그대로
    }
    const targetId = editing ? aid : saved.id
    if (judgeNeedsSave) {
      try {
        await saveJudge.mutateAsync({ assignmentId: targetId, payload: toPayload(judgeDraft, rejudge) })
      } catch (err) {
        const message = `과제는 저장됐지만 자동 채점 설정 저장에 실패했어요: ${(err as Error).message}`
        if (editing) {
          setJudgeError(message)
          return
        }
        // 새 과제는 이미 만들어졌다 - 다시 "등록"하면 중복이 되므로 수정 화면으로 보낸다
        window.alert(message)
        navigate(`/assignments/${targetId}/edit?cohort=${cohortId}`, { replace: true })
        return
      }
    }
    navigate(`/assignments/${targetId}?cohort=${cohortId}`, { replace: true })
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
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '과제 수정' : '과제 등록'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort ? cohort.name : ''}
          {editing && ' - 저장하면 전체 내용이 교체됩니다. 마감을 바꾸면 지각 판정도 새 마감 기준으로 다시 계산됩니다.'}
        </p>
      </header>

      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반은 과제를 변경할 수 없어요. 보관을 해제한 뒤 다시 시도해 주세요.
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="assignment-title">제목</Label>
          <Input
            id="assignment-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="예: 1차시 - 입출력 연습"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="assignment-problem-no">문제 번호 (선택)</Label>
            <Input
              id="assignment-problem-no"
              type="number"
              min={1000}
              value={problemNo}
              onChange={(e) => setProblemNo(e.target.value)}
              placeholder={editing ? '비우면 기존 번호 유지' : '비우면 자동 부여'}
            />
            <p className="text-xs text-muted-foreground">전역 유일, 1000부터. 중복이면 저장이 거부돼요.</p>
          </div>
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
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignment-description">설명 (선택)</Label>
          <textarea
            id="assignment-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            rows={8}
            placeholder="문제 설명 - 자동 채점 문제라면 예시 입출력은 아래 공개 케이스로 자동 표시되니 따로 적지 않아도 돼요"
            className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <JudgeConfigSection
          cohortId={cohortId}
          assignmentId={editing ? aid : null}
          config={judgeQuery.data ?? null}
          draft={judgeDraft}
          onChange={setJudgeDraft}
          disabled={archived || saving}
        />

        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
        {judgeError && <p className="text-sm text-destructive">{judgeError}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || archived} className="rounded-[2px]">
            {saving ? '저장 중...' : editing ? '저장' : '등록'}
          </Button>
          <Button type="button" variant="outline" className="rounded-[2px]" asChild>
            <Link to={editing ? `/assignments/${aid}?cohort=${cohortId}` : `/assignments?cohort=${cohortId}`}>취소</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
