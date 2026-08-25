import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAssignment, useCreateAssignment, useUpdateAssignment } from '@/api/assignments'
import { useCohort } from '@/api/cohorts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { kstInputToIso, toKstInputValue } from '@/lib/datetime'

/**
 * 과제 등록·수정 폼 (운영진 이상, canManage 진입) - /assignments/new · /assignments/:id/edit, 분반은 ?cohort= 필수.
 * - 실패(400·409 등) 시 작성 내용 보존 + 에러 문구 표시 (CLAUDE.md 규칙 1)
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

  const [sessionNo, setSessionNo] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      const a = existingQuery.data
      setSessionNo(a.sessionNo === null ? '' : String(a.sessionNo))
      setTitle(a.title)
      setDescription(a.description ?? '')
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      {
        sessionNo: sessionNo.trim() === '' ? null : Number(sessionNo),
        title: title.trim(),
        description: description.trim() === '' ? null : description,
        dueAt: kstInputToIso(dueAt),
      },
      {
        onSuccess: (saved) =>
          navigate(`/assignments/${editing ? aid : saved.id}?cohort=${cohortId}`, { replace: true }),
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="assignment-title">제목</Label>
          <Input
            id="assignment-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="예: 백준 1000번 - A+B"
          />
        </div>

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
            placeholder="문제 링크를 포함한 자유 텍스트"
            className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={mutation.isPending || archived} className="rounded-[2px]">
            {mutation.isPending ? '저장 중...' : editing ? '저장' : '등록'}
          </Button>
          <Button type="button" variant="outline" className="rounded-[2px]" asChild>
            <Link to={editing ? `/assignments/${aid}?cohort=${cohortId}` : `/assignments?cohort=${cohortId}`}>취소</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
