import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useMe } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useCohorts, useMyCohorts } from '@/api/cohorts'
import { useCreateNotice, useNotice, useUpdateNotice } from '@/api/notices'
import { Button } from '@/components/ui/button'
import { isAdminRole } from '@/lib/roles'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseId } from '@/lib/params'

const TITLE_MAX = 200
const CONTENT_MAX = 10000
/** 대상 선택값 - 'global'(전체 공지) 또는 분반 id 문자열 */
const GLOBAL = 'global'

interface NoticeDraft {
  title: string
  content: string
  pinned: boolean
  target: string
}

const draftKey = (noticeId: number | null) => `ondal-notice-draft:${noticeId ?? 'new'}`

/**
 * 공지 작성 /notices/new(?cohort=) · 수정 /notices/:noticeId/edit (docs/notice/fe.md 1절).
 * - 대상 선택(작성 때만): 관리자 = "전체 공지" + 진행 중 분반 전부(GET /api/cohorts) / 운영진 = canManage 인 소속 분반. 대상에 따라 등록 API 가 갈린다
 * - 수정은 대상 고정(변경 API 없음). canEdit 없는 글의 edit URL 직접 접근 → 권한 밖 → 홈 (CLAUDE.md 규칙 3)
 * - 실패 시 입력 보존·요청 중 잠금, 임시 저장(lib/draft - 세션 만료 대비)
 */
export default function NoticeFormPage() {
  const { noticeId: noticeParam } = useParams()
  const editing = noticeParam !== undefined
  const noticeId = editing ? parseId(noticeParam) : NaN
  const [searchParams] = useSearchParams()
  const cohortParam = parseId(searchParams.get('cohort') ?? undefined)
  const navigate = useNavigate()
  const { data: me } = useMe()
  const isAdmin = isAdminRole(me?.globalRole)

  const myCohortsQuery = useMyCohorts()
  const adminCohortsQuery = useCohorts('ACTIVE', isAdmin && !editing)
  const existingQuery = useNotice(editing ? noticeId : NaN)

  const key = draftKey(editing ? noticeId : null)
  const [title, setTitle] = useState(() => readDraft<NoticeDraft>(key)?.title ?? '')
  const [content, setContent] = useState(() => readDraft<NoticeDraft>(key)?.content ?? '')
  const [pinned, setPinned] = useState(() => readDraft<NoticeDraft>(key)?.pinned ?? false)
  const [target, setTarget] = useState(() => readDraft<NoticeDraft>(key)?.target ?? (Number.isFinite(cohortParam) ? String(cohortParam) : ''))
  // 임시 저장본이 있으면 그것이 더 최신 - 서버 값으로 덮어쓰지 않는다
  const [prefilled, setPrefilled] = useState(() => !editing || readDraft<NoticeDraft>(key) !== null)

  useEffect(() => {
    if (editing && existingQuery.data && !prefilled) {
      setTitle(existingQuery.data.title)
      setContent(existingQuery.data.content)
      setPinned(existingQuery.data.pinned)
      setPrefilled(true)
    }
  }, [editing, existingQuery.data, prefilled])

  useEffect(() => {
    if (!prefilled) return
    if (title === '' && content === '') clearDraft(key)
    else writeDraft<NoticeDraft>(key, { title, content, pinned, target })
  }, [key, title, content, pinned, target, prefilled])

  const createMutation = useCreateNotice()
  const updateMutation = useUpdateNotice(noticeId)
  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = editing ? updateMutation.error : createMutation.error

  if (editing && !Number.isFinite(noticeId)) {
    return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 공지 주소예요.')} />
  }
  if (editing && existingQuery.isPending) return <LoadingScreen />
  if (editing && existingQuery.error) {
    return <ApiErrorView error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
  }
  if (!editing && (myCohortsQuery.isPending || (isAdmin && adminCohortsQuery.isPending))) return <LoadingScreen />
  if (!editing && myCohortsQuery.error) {
    return <ApiErrorView error={myCohortsQuery.error} onRetry={() => void myCohortsQuery.refetch()} />
  }
  if (!editing && isAdmin && adminCohortsQuery.error) {
    return <ApiErrorView error={adminCohortsQuery.error} onRetry={() => void adminCohortsQuery.refetch()} />
  }

  const existing = existingQuery.data
  if (editing && existing && !existing.canEdit) {
    return <ApiErrorView error={new ApiError(403, 'FORBIDDEN', '이 공지를 수정할 권한이 없어요.')} />
  }

  // 대상 선택지 - 관리자: 전체 공지 + 진행 중 분반 전부 / 운영진: 운영 권한이 있는 소속 분반
  const options: { value: string; label: string }[] = editing
    ? []
    : [
        ...(isAdmin ? [{ value: GLOBAL, label: '전체 공지 - 로그인한 모든 사용자' }] : []),
        ...(isAdmin ? (adminCohortsQuery.data ?? []) : (myCohortsQuery.data ?? []).filter((c) => c.canManage)).map((c) => ({
          value: String(c.id),
          label: `${c.name} - 분반 공지`,
        })),
      ]
  if (!editing && options.length === 0) {
    return <ApiErrorView error={new ApiError(403, 'FORBIDDEN', '공지를 작성할 수 있는 분반이 없어요.')} />
  }
  // 저장된 선택이 선택지에 없으면(분반 보관 등) 첫 선택지로
  const selectedTarget = options.some((o) => o.value === target) ? target : (options[0]?.value ?? '')

  const canSubmit = !isPending && title.trim() !== '' && content.trim() !== '' && (editing || selectedTarget !== '')
  const backTo = editing ? `/notices/${noticeId}` : '/notices'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return // 요청 중 중복 제출 방지 (규칙 2)
    const payload = { title: title.trim(), content: content.trim(), pinned }
    if (editing) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          clearDraft(key)
          navigate(backTo, { replace: true })
        },
      })
    } else {
      createMutation.mutate(
        { cohortId: selectedTarget === GLOBAL ? null : Number(selectedTarget), payload },
        {
          onSuccess: (saved) => {
            clearDraft(key)
            navigate(`/notices/${saved.id}`, { replace: true })
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
        {editing ? '공지 상세로' : '공지 목록으로'}
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{editing ? '공지 수정' : '공지 작성'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing
            ? `대상: ${existing?.cohort?.name ?? '전체 공지'} (변경 불가) - 저장하면 전체 내용이 교체됩니다.`
            : '전체 공지는 로그인한 모든 사용자가, 분반 공지는 그 분반 소속자가 봅니다.'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {!editing && (
          <div className="space-y-2">
            <Label htmlFor="notice-target">대상</Label>
            <select
              id="notice-target"
              value={selectedTarget}
              onChange={(e) => setTarget(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notice-title">제목</Label>
          <Input
            id="notice-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={TITLE_MAX}
            autoFocus={!editing}
            placeholder="예: 2026-2 부트캠프 운영 안내"
          />
          <p className="text-right text-xs text-muted-foreground">
            {title.length}/{TITLE_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notice-content">내용</Label>
          <textarea
            id="notice-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={CONTENT_MAX}
            rows={12}
            placeholder="공지 내용 - 줄바꿈이 그대로 표시됩니다."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>입력 내용은 이 탭에 임시 저장돼요 - 세션이 만료돼 다시 로그인해도 유지됩니다.</span>
            <span>
              {content.length}/{CONTENT_MAX}
            </span>
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            id="notice-pinned"
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="size-4 accent-primary"
          />
          필독 - 목록 최상단에 고정하고 "필독" 배지를 표시
        </label>

        {mutationError && <p className="text-sm text-destructive">{(mutationError as Error).message}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!canSubmit}>
            {isPending ? '저장 중...' : editing ? '저장' : '등록'}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}
