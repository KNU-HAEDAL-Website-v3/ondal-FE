import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useCohort, useCreateCohort, useUpdateCohort } from '@/api/cohorts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseLoginIds } from '@/lib/loginIds'
import { parseId } from '@/lib/params'

const NAME_MAX = 100
const DESCRIPTION_MAX = 2000

interface CohortDraft {
  name: string
  description: string
  operators: string
}

const draftKey = (cohortId: number | null) => `ondal-cohort-draft:${cohortId ?? 'new'}`

/**
 * [관리자] 분반 등록·수정 (UC-A1) - /admin/cohorts/new · /admin/cohorts/:cohortId/edit.
 * - 등록: 이름·설명 + 운영진 loginId 명단(선택) 일괄 지정 → 성공 시 명부 화면으로 (다음 단계인 수강생 배정을 바로 이어서)
 * - 수정: 이름·설명 전체 교체. 운영진은 명부 화면에서 지정·해제. 보관 분반은 409 규약대로 사전 비활성 + 안내
 * - 실패 시 입력 보존·요청 중 잠금, 임시 저장(세션 만료 대비 - lib/draft)
 */
export default function CohortFormPage() {
  const { cohortId: cohortParam } = useParams()
  const editing = cohortParam !== undefined
  const cohortId = editing ? parseId(cohortParam) : NaN
  const navigate = useNavigate()

  const existingQuery = useCohort(editing ? cohortId : NaN)

  const key = draftKey(editing ? cohortId : null)
  const [name, setName] = useState(() => readDraft<CohortDraft>(key)?.name ?? '')
  const [description, setDescription] = useState(() => readDraft<CohortDraft>(key)?.description ?? '')
  const [operators, setOperators] = useState(() => readDraft<CohortDraft>(key)?.operators ?? '')
  // 임시 저장본이 있으면 그것이 더 최신 - 서버 값으로 덮어쓰지 않는다
  const [prefilled, setPrefilled] = useState(() => !editing || readDraft<CohortDraft>(key) !== null)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      setName(existingQuery.data.name)
      setDescription(existingQuery.data.description ?? '')
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  useEffect(() => {
    if (!prefilled) return
    if (name === '' && description === '' && operators === '') clearDraft(key)
    else writeDraft<CohortDraft>(key, { name, description, operators })
  }, [key, name, description, operators, prefilled])

  const createMutation = useCreateCohort()
  const updateMutation = useUpdateCohort(cohortId)
  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = editing ? updateMutation.error : createMutation.error

  if (editing && !Number.isFinite(cohortId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 분반 주소예요.')} />
  }
  if (editing && existingQuery.isPending) return <LoadingScreen />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }

  const archived = editing && existingQuery.data?.status === 'ARCHIVED'
  const operatorLoginIds = parseLoginIds(operators)
  const canSubmit = !isPending && !archived && name.trim() !== ''
  const backTo = '/admin/cohorts'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return // 요청 중 중복 제출 방지 (규칙 2)
    const trimmedDescription = description.trim()
    if (editing) {
      updateMutation.mutate(
        { name: name.trim(), description: trimmedDescription === '' ? null : trimmedDescription },
        {
          onSuccess: () => {
            clearDraft(key)
            navigate(backTo, { replace: true })
          },
        },
      )
    } else {
      createMutation.mutate(
        { name: name.trim(), description: trimmedDescription === '' ? null : trimmedDescription, operatorLoginIds },
        {
          onSuccess: (saved) => {
            clearDraft(key)
            navigate(`/cohorts/${saved.id}/members`, { replace: true })
          },
        },
      )
    }
  }

  const handleCancel = () => {
    clearDraft(key)
    navigate(backTo)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" type="button" onClick={handleCancel}>
        <ArrowLeft data-icon="inline-start" />
        분반 관리로
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '분반 수정' : '분반 만들기'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing
            ? '이름·설명을 바꿉니다. 운영진 지정·해제는 명부 화면에서 합니다.'
            : '분반을 만들고 운영진을 함께 지정합니다. 수강생 배정은 만든 뒤 명부 화면에서 이어서 합니다.'}
        </p>
      </header>

      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반은 수정할 수 없어요. 분반 관리의 보관함에서 해제한 뒤 다시 시도해 주세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cohort-name">분반 이름</Label>
          <Input
            id="cohort-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={NAME_MAX}
            autoFocus={!editing}
            placeholder="예: 2026-2 C언어"
          />
          <p className="text-right text-xs text-muted-foreground">
            {name.length}/{NAME_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cohort-description">설명 (선택)</Label>
          <textarea
            id="cohort-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="수업 요일·시간, 대상 등 수강생 홈 카드에 보일 한두 줄"
            className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-right text-xs text-muted-foreground">
            {description.length}/{DESCRIPTION_MAX}
          </p>
        </div>

        {!editing && (
          <div className="space-y-2">
            <Label htmlFor="cohort-operators">운영진 아이디 (선택)</Label>
            <textarea
              id="cohort-operators"
              value={operators}
              onChange={(e) => setOperators(e.target.value)}
              rows={3}
              placeholder={'홈페이지(Keycloak) 아이디를 줄바꿈이나 쉼표로 구분해 입력\n예: hong, kim'}
              className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              {operatorLoginIds.length === 0
                ? '아직 로그인한 적 없는 부원도 아이디만 정확하면 지정할 수 있어요. 나중에 명부에서 추가·해제 가능.'
                : `운영진 ${operatorLoginIds.length}명: ${operatorLoginIds.join(', ')}`}
            </p>
          </div>
        )}

        {mutationError && <p className="text-sm text-destructive">{(mutationError as Error).message}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!canSubmit} className="rounded-[2px]">
            {isPending ? '저장 중...' : editing ? '저장' : '만들기'}
          </Button>
          <Button type="button" variant="outline" className="rounded-[2px]" onClick={handleCancel}>
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}
