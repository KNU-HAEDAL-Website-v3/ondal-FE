import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowDownUp, CheckCheck, CircleCheckBig, CircleX, Clock, Download, Pencil, Plus, Trash2, X } from 'lucide-react'
import { attendanceKeys, fetchRoster, useMarkAttendance, useRoster } from '@/api/attendances'
import { useMe } from '@/api/auth'
import { useCohorts } from '@/api/cohorts'
import { useCreateSession, useDeleteSession, useSessions, useUpdateSession } from '@/api/sessions'
import type { AttendanceRow, AttendanceStatus, CohortResponse, SessionResponse } from '@/api/types'
import { AttendanceStatCard } from '@/components/attendance/AttendanceStatCard'
import { ATTENDANCE_STATUS_LABEL, AttendanceStatusBadge } from '@/components/attendance/AttendanceStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { downloadCsv, safeFileName, todayStamp, toCsv } from '@/lib/csv'
import { formatKst, formatKstDate, todayKstInputValue, weekdayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT']

/** 내보내기·정렬에서 쓰는 상태 이름 - 미확인(기록 없음)까지 포함한 표시용 */
function statusLabel(status: AttendanceStatus | null): string {
  return status === null ? '미확인' : ATTENDANCE_STATUS_LABEL[status]
}

type RosterSort = 'name' | 'status' | 'loginId'

const ROSTER_SORT_LABEL: Record<RosterSort, string> = {
  name: '이름순',
  status: '상태순',
  loginId: '학번순',
}

/** 상태 정렬 순서 - 손이 가야 하는 것부터: 미확인 → 결석 → 지각 → 출석 */
const STATUS_RANK: Record<string, number> = { '': 0, ABSENT: 1, LATE: 2, PRESENT: 3 }

const byName = (a: AttendanceRow, b: AttendanceRow) => a.user.name.localeCompare(b.user.name, 'ko') || a.user.id - b.user.id

/** 기본값 name 은 서버 정렬(이름 → id)과 같아서 기존 화면과 순서가 달라지지 않는다 */
function sortRows(rows: AttendanceRow[], sort: RosterSort): AttendanceRow[] {
  const copy = [...rows]
  switch (sort) {
    case 'loginId':
      return copy.sort((a, b) => a.user.loginId.localeCompare(b.user.loginId, 'ko', { numeric: true }) || byName(a, b))
    case 'status':
      return copy.sort((a, b) => STATUS_RANK[a.status ?? ''] - STATUS_RANK[b.status ?? ''] || byName(a, b))
    default:
      return copy.sort(byName)
  }
}

/**
 * 교육운영진 출결 관리 (피그마 28:1013) - 분반 선택 → 차시 선택(추가·수정·삭제) → 차시 명부에 출석 표시 (docs/attendance/fe.md 1절).
 * - 분반 선택지: 관리자 = 진행 중 분반 전부 / 운영진 = canManage 소속 분반
 * - 표시는 셀렉트 바꾸는 즉시 PUT(원소 1개), "일괄 출석 처리"는 미확인 전원을 PRESENT 로. 응답 명부로 즉시 갱신
 * - 요약·출석률은 서버 값 그대로. 보관 분반은 열람만
 *
 * 2026-09-15: 분반 선택을 헤더 구석 셀렉트에서 본문 첫 단계로 올렸다.
 * 예전에는 분반이 하나면 셀렉트가 아예 숨고 여러 개여도 첫 분반이 자동으로 잡혀서, 출결이 분반과 무관하게 통합된 것처럼 보였다.
 */
export function OperatorAttendanceView({ cohorts }: { cohorts: CohortResponse[] }) {
  const { data: me } = useMe()
  const isAdmin = me?.globalRole === 'ADMIN'
  const adminCohortsQuery = useCohorts('ACTIVE', isAdmin)
  const options = isAdmin ? (adminCohortsQuery.data ?? []) : cohorts.filter((c) => c.canManage)

  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)

  if (isAdmin && adminCohortsQuery.isPending) return <LoadingScreen label="분반 목록 불러오는 중..." />
  if (isAdmin && adminCohortsQuery.error) {
    return <ApiErrorView error={adminCohortsQuery.error} onRetry={() => void adminCohortsQuery.refetch()} />
  }

  // 분반이 하나뿐이면 고를 게 없으니 자동 선택 - 선택 줄은 그대로 남겨 "어느 분반의 출결인지"를 항상 보이게 한다.
  // 둘 이상이면 반드시 직접 고르게 한다 (자동 선택은 다른 반 출결을 자기 반으로 착각하게 만든다)
  const cohort = options.length === 1 ? options[0] : (options.find((c) => c.id === selectedCohortId) ?? null)

  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">출결 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">분반을 고르고, 차시를 고른 뒤 수강생별로 출석 · 지각 · 결석을 표시하세요.</p>
      </header>

      {options.length === 0 ? (
        <EmptyState title="운영할 수 있는 분반이 없어요" description="분반의 운영진으로 지정되면 여기에서 출결을 관리할 수 있어요." />
      ) : (
        <>
          <section className="space-y-2 rounded-lg border bg-card p-3" aria-label="분반 선택">
            <p className="text-xs font-bold tracking-[0.55px] text-muted-foreground">1. 분반</p>
            <div className="flex flex-wrap gap-2">
              {options.map((c) => {
                const selected = c.id === cohort?.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedCohortId(c.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-[2px] border px-3 py-1.5 text-sm transition-colors',
                      selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                    )}
                  >
                    {c.name}
                    {c.status === 'ARCHIVED' && <Badge variant="outline">보관</Badge>}
                  </button>
                )
              })}
            </div>
          </section>

          {cohort ? (
            <CohortAttendance key={cohort.id} cohort={cohort} />
          ) : (
            <EmptyState title="분반을 먼저 고르세요" description="차시와 명부는 고른 분반의 것만 보여 줍니다." />
          )}
        </>
      )}
    </div>
  )
}

/** 한 분반의 출결 - 차시 목록·선택·편집 + 명부 + 분반 전체 내보내기 */
function CohortAttendance({ cohort }: { cohort: CohortResponse }) {
  const archived = cohort.status === 'ARCHIVED'
  const sessionsQuery = useSessions(cohort.id)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [editor, setEditor] = useState<'closed' | 'create' | 'edit'>('closed')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  if (sessionsQuery.isPending) return <LoadingScreen label="차시 불러오는 중..." />
  if (sessionsQuery.error) return <ApiErrorView error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />

  const sessions = sessionsQuery.data
  // 기본 선택 = 가장 최근 날짜(목록은 날짜 오름차순이라 마지막)
  const session = sessions.find((s) => s.id === selectedSessionId) ?? sessions[sessions.length - 1]

  /**
   * 분반 전체 차시 출석부 - 가로 = 차시, 세로 = 수강생.
   * 차시마다 명부를 따로 받아야 해서(차시 단위 API) 병렬로 모아 붙인다 - 캐시에 있으면 재요청하지 않는다.
   */
  const exportCohort = async () => {
    if (sessions.length === 0 || exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const rosters = await Promise.all(
        sessions.map((s) =>
          queryClient.fetchQuery({
            queryKey: attendanceKeys.roster(cohort.id, s.id),
            queryFn: () => fetchRoster(cohort.id, s.id),
          }),
        ),
      )
      // 수강생 = 전 차시 명부의 합집합 - 배정·제외로 차시마다 명부가 다를 수 있다. 누계(stats)는 분반 기준이라 마지막 값으로 덮어써도 같다
      const students = new Map<string, AttendanceRow>()
      rosters.forEach((r) => r.rows.forEach((row) => students.set(row.user.loginId, row)))
      const statusPerSession = rosters.map((r) => new Map(r.rows.map((row) => [row.user.loginId, row.status])))
      const ordered = [...students.values()].sort(byName)

      const header = [
        '이름',
        '학번',
        ...sessions.map((s) => `${s.sessionNo}차시(${s.heldOn.slice(5)})`),
        '출석',
        '지각',
        '결석',
        '출석률',
      ]
      const rows = ordered.map((row) => [
        row.user.name,
        row.user.loginId,
        ...statusPerSession.map((m) => statusLabel(m.get(row.user.loginId) ?? null)),
        row.stats.present,
        row.stats.late,
        row.stats.absent,
        row.stats.rate === null ? '-' : `${row.stats.rate}%`,
      ])
      downloadCsv(`출석부_${safeFileName(cohort.name)}_전체_${todayStamp()}`, toCsv(header, rows))
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 출석 기록 열람만 가능하고 차시 추가·표시는 보관을 해제한 뒤에 할 수 있어요.
        </p>
      )}

      <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Label htmlFor="session-select" className="text-xs font-bold tracking-[0.55px] text-muted-foreground">
          2. 차시
        </Label>
        {sessions.length === 0 ? (
          <span className="text-sm text-muted-foreground">아직 차시가 없어요 - 먼저 차시를 추가하세요.</span>
        ) : (
          <select
            id="session-select"
            value={session?.id ?? ''}
            onChange={(e) => {
              setSelectedSessionId(Number(e.target.value))
              setEditor('closed')
            }}
            className="h-8 rounded-[2px] border bg-card px-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sessionNo}차시 · {formatKstDate(s.heldOn)}
                {s.title ? ` · ${s.title}` : ''}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          {sessions.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-[2px]" onClick={() => void exportCohort()} disabled={exporting}>
              <Download data-icon="inline-start" />
              {exporting ? '내보내는 중...' : '분반 전체 내보내기'}
            </Button>
          )}
          {!archived && (
            <>
              {session && (
                <Button variant="outline" size="sm" className="rounded-[2px]" onClick={() => setEditor(editor === 'edit' ? 'closed' : 'edit')}>
                  <Pencil data-icon="inline-start" />
                  차시 수정
                </Button>
              )}
              <Button size="sm" className="rounded-[2px]" onClick={() => setEditor(editor === 'create' ? 'closed' : 'create')}>
                <Plus data-icon="inline-start" />
                차시 추가
              </Button>
            </>
          )}
        </div>
        {exportError && <p className="w-full text-sm text-destructive">{exportError}</p>}
      </section>

      {editor !== 'closed' && !archived && (
        <SessionEditor
          cohortId={cohort.id}
          session={editor === 'edit' ? session : undefined}
          nextSessionNo={Math.max(0, ...sessions.map((s) => s.sessionNo)) + 1}
          onDone={(saved) => {
            setEditor('closed')
            if (saved) setSelectedSessionId(saved.id)
          }}
        />
      )}

      {session ? (
        <Roster
          key={session.id}
          cohort={cohort}
          session={session}
          readOnly={archived}
          onDeleted={() => setSelectedSessionId(null)}
        />
      ) : (
        !archived && <EmptyState title="차시를 추가하면 출석을 표시할 수 있어요" description="번호는 자동으로 붙고, 수업 날짜만 고르면 됩니다." />
      )}
    </div>
  )
}

/** 차시 추가·수정 인라인 폼 - 번호(자동 채번 기본)·날짜·제목 */
function SessionEditor({
  cohortId,
  session,
  nextSessionNo,
  onDone,
}: {
  cohortId: number
  session?: SessionResponse
  nextSessionNo: number
  onDone: (saved?: SessionResponse) => void
}) {
  const editing = session !== undefined
  const [sessionNo, setSessionNo] = useState(editing ? String(session.sessionNo) : String(nextSessionNo))
  const [heldOn, setHeldOn] = useState(editing ? session.heldOn : todayKstInputValue())
  const [title, setTitle] = useState(editing ? (session.title ?? '') : '')
  const createMutation = useCreateSession(cohortId)
  const updateMutation = useUpdateSession(cohortId)
  const isPending = createMutation.isPending || updateMutation.isPending
  const error = editing ? updateMutation.error : createMutation.error

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending || heldOn === '') return
    const payload = { sessionNo: sessionNo.trim() === '' ? null : Number(sessionNo), title: title.trim() === '' ? null : title.trim(), heldOn }
    if (editing) {
      updateMutation.mutate({ sessionId: session.id, payload }, { onSuccess: (saved) => onDone(saved) })
    } else {
      createMutation.mutate(payload, { onSuccess: (saved) => onDone(saved) })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card/40 p-4" aria-label={editing ? '차시 수정' : '차시 추가'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{editing ? `${session.sessionNo}차시 수정` : '차시 추가'}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone()} aria-label="닫기">
          <X />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="session-no">차시 번호</Label>
          <Input id="session-no" type="number" min={1} value={sessionNo} onChange={(e) => setSessionNo(e.target.value)} required={editing} placeholder="비우면 자동" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="session-held-on">수업 날짜</Label>
          <Input id="session-held-on" type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="session-title">제목 (선택)</Label>
          <Input id="session-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 포인터와 배열" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="rounded-[2px]" disabled={isPending || heldOn === ''}>
          {isPending ? '저장 중...' : editing ? '저장' : '추가'}
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-[2px]" onClick={() => onDone()}>
          취소
        </Button>
      </div>
    </form>
  )
}

/** 차시 명부 - 조회·표시·삭제를 맡고, 표 자체(정렬·내보내기)는 RosterTable 이 그린다 */
function Roster({
  cohort,
  session,
  readOnly,
  onDeleted,
}: {
  cohort: CohortResponse
  session: SessionResponse
  readOnly: boolean
  onDeleted: () => void
}) {
  const rosterQuery = useRoster(cohort.id, session.id)
  const markMutation = useMarkAttendance(cohort.id, session.id)
  const deleteMutation = useDeleteSession(cohort.id)

  if (rosterQuery.isPending) return <LoadingScreen label="명부 불러오는 중..." />
  if (rosterQuery.error) return <ApiErrorView error={rosterQuery.error} onRetry={() => void rosterQuery.refetch()} />

  const { summary, rows } = rosterQuery.data
  const unchecked = rows.filter((r) => r.status === null)

  const mark = (loginId: string, status: AttendanceStatus | null) => {
    if (markMutation.isPending) return // 요청 중 잠금 (CLAUDE.md 규칙 2)
    markMutation.mutate({ records: [{ loginId, status }] })
  }
  const markAllUnchecked = () => {
    if (unchecked.length === 0 || markMutation.isPending) return
    if (!window.confirm(`미확인 ${unchecked.length}명을 모두 출석으로 표시할까요? 표시한 뒤에도 한 명씩 바꿀 수 있어요.`)) return
    markMutation.mutate({ records: unchecked.map((r) => ({ loginId: r.user.loginId, status: 'PRESENT' as const })) })
  }
  const handleDelete = () => {
    const warning =
      session.attendanceCount > 0
        ? `${session.sessionNo}차시를 삭제할까요? 출석 기록 ${session.attendanceCount}건이 함께 삭제되고 되돌릴 수 없어요.`
        : `${session.sessionNo}차시를 삭제할까요? 되돌릴 수 없어요.`
    if (!window.confirm(warning)) return
    deleteMutation.mutate(session.id, { onSuccess: onDeleted })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AttendanceStatCard label="전체 수강생" value={String(rows.length)} unit="명" labelClassName="text-muted-foreground" />
        <AttendanceStatCard label="출석" value={String(summary.present)} icon={CircleCheckBig} className="border-success-bg bg-success-soft text-success" />
        <AttendanceStatCard label="지각" value={String(summary.late)} icon={Clock} className="border-warning-bg bg-warning-soft text-warning" />
        <AttendanceStatCard label="결석" value={String(summary.absent)} icon={CircleX} className="border-danger-border bg-danger-soft text-danger" />
        <AttendanceStatCard
          label="이 차시 출석률"
          value={summary.rate === null ? '-' : `${summary.rate}%`}
          className="border-transparent bg-[#4f46e5] text-white"
          labelClassName="text-white/80"
        />
      </div>

      <RosterTable
        cohort={cohort}
        session={session}
        rows={rows}
        uncheckedCount={summary.unchecked}
        readOnly={readOnly}
        busy={markMutation.isPending}
        error={markMutation.error ?? deleteMutation.error}
        deleting={deleteMutation.isPending}
        onMark={mark}
        onMarkAllUnchecked={markAllUnchecked}
        onDeleteSession={handleDelete}
      />
    </div>
  )
}

/** 명부 표 - 정렬 기준 선택 + 이 차시 CSV 내보내기 + 상태 셀렉트(즉시 저장) */
function RosterTable({
  cohort,
  session,
  rows,
  uncheckedCount,
  readOnly,
  busy,
  error,
  deleting,
  onMark,
  onMarkAllUnchecked,
  onDeleteSession,
}: {
  cohort: CohortResponse
  session: SessionResponse
  rows: AttendanceRow[]
  uncheckedCount: number
  readOnly: boolean
  busy: boolean
  error: unknown
  deleting: boolean
  onMark: (loginId: string, status: AttendanceStatus | null) => void
  onMarkAllUnchecked: () => void
  onDeleteSession: () => void
}) {
  /**
   * 정렬 순서는 "기준을 고른 그 순간"의 것을 고정한다 (loginId 목록 스냅샷).
   * 출석을 표시할 때마다 다시 정렬하면 상태순에서 방금 누른 행이 위아래로 튀어, 명부를 짚어 가며 체크할 수 없다.
   * 명부가 바뀌어(배정·제외) 스냅샷에 없는 사람은 뒤에 붙는다.
   */
  const [snapshot, setSnapshot] = useState<{ sort: RosterSort; ids: string[] }>(() => ({
    sort: 'name',
    ids: sortRows(rows, 'name').map((r) => r.user.loginId),
  }))
  const changeSort = (sort: RosterSort) => setSnapshot({ sort, ids: sortRows(rows, sort).map((r) => r.user.loginId) })

  const rank = new Map(snapshot.ids.map((loginId, index) => [loginId, index]))
  const ordered = [...rows].sort(
    (a, b) => (rank.get(a.user.loginId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.user.loginId) ?? Number.MAX_SAFE_INTEGER),
  )

  const exportSession = () => {
    const header = ['이름', '학번', '상태', '표시 시각', '누계 출석', '누계 지각', '누계 결석', '누계 출석률']
    const csvRows = ordered.map((row) => [
      row.user.name,
      row.user.loginId,
      statusLabel(row.status),
      row.checkedAt ? formatKst(row.checkedAt) : '',
      row.stats.present,
      row.stats.late,
      row.stats.absent,
      row.stats.rate === null ? '-' : `${row.stats.rate}%`,
    ])
    downloadCsv(`출석부_${safeFileName(cohort.name)}_${session.sessionNo}차시_${todayStamp()}`, toCsv(header, csvRows))
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">
            {session.sessionNo}차시 · {formatKstDate(session.heldOn)} ({weekdayLabel(session.heldOn)})
          </h2>
          {session.title && <Badge variant="secondary">{session.title}</Badge>}
          {readOnly && (
            <Badge variant="outline">
              <Archive data-icon="inline-start" />
              열람만
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">미확인 {uncheckedCount}명</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="roster-sort" className="sr-only">
            명부 정렬
          </Label>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowDownUp className="size-3.5" aria-hidden />
            정렬
          </span>
          <select
            id="roster-sort"
            value={snapshot.sort}
            onChange={(e) => changeSort(e.target.value as RosterSort)}
            className="h-7 rounded-[2px] border bg-card px-2 text-xs"
          >
            {(Object.keys(ROSTER_SORT_LABEL) as RosterSort[]).map((key) => (
              <option key={key} value={key}>
                {ROSTER_SORT_LABEL[key]}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="rounded-[2px]" onClick={exportSession} disabled={rows.length === 0}>
            <Download data-icon="inline-start" />
            이 차시 내보내기
          </Button>
          {!readOnly && (
            <>
              <Button size="sm" className="rounded-[2px]" onClick={onMarkAllUnchecked} disabled={uncheckedCount === 0 || busy}>
                <CheckCheck data-icon="inline-start" />
                일괄 출석 처리{uncheckedCount > 0 ? ` (${uncheckedCount})` : ''}
              </Button>
              <Button variant="outline" size="sm" className="rounded-[2px] text-destructive" onClick={onDeleteSession} disabled={deleting}>
                <Trash2 data-icon="inline-start" />
                차시 삭제
              </Button>
            </>
          )}
        </div>
      </div>
      {error !== null && error !== undefined && <p className="px-4 pt-3 text-sm text-destructive">{(error as Error).message}</p>}
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">이 분반에 수강생이 없어요. 명부에서 먼저 배정하세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">수강생</th>
                <th className="px-2 py-2 text-center font-bold">상태</th>
                <th className="px-2 py-2 text-center font-bold">표시 시각</th>
                <th className="px-4 py-2 text-right font-bold">누계 출석률</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <RosterRow key={row.user.id} row={row} readOnly={readOnly} busy={busy} onChange={(status) => onMark(row.user.loginId, status)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RosterRow({
  row,
  readOnly,
  busy,
  onChange,
}: {
  row: AttendanceRow
  readOnly: boolean
  busy: boolean
  onChange: (status: AttendanceStatus | null) => void
}) {
  const rate = row.stats.rate
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <span className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-[11px] font-semibold text-neutral">
            {row.user.name.charAt(0)}
          </span>
          <span className="font-medium">{row.user.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.user.loginId}</span>
        </span>
      </td>
      <td className="px-2 py-3 text-center">
        {readOnly ? (
          <AttendanceStatusBadge status={row.status} />
        ) : (
          <select
            value={row.status ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as AttendanceStatus))}
            disabled={busy}
            aria-label={`${row.user.name} 출석 상태`}
            className={cn(
              'h-7 rounded-[2px] border px-2 text-xs font-bold',
              row.status === 'PRESENT' && 'bg-success-bg text-success',
              row.status === 'LATE' && 'bg-warning-bg text-warning',
              row.status === 'ABSENT' && 'bg-danger-bg text-danger',
              row.status === null && 'bg-neutral-bg text-neutral',
            )}
          >
            <option value="">미확인</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ATTENDANCE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-2 py-3 text-center font-mono text-xs text-muted-foreground">{row.checkedAt ? formatKst(row.checkedAt) : '-'}</td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          <span className={cn('font-mono text-xs font-semibold', rate !== null && rate < 70 && 'text-destructive')}>
            {rate === null ? '-' : `${rate}%`}
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-bg">
            <span
              // 막대 채움이라 글자용 warning(#854d0e)을 쓰면 탁해진다 - 채움 두께에 맞는 caution(주황)을 쓴다
              className={cn('block h-full rounded-full', rate === null ? 'bg-transparent' : rate < 70 ? 'bg-danger' : rate < 90 ? 'bg-caution' : 'bg-[#4f46e5]')}
              style={{ width: `${rate ?? 0}%` }}
            />
          </span>
          <span className="text-[11px] text-muted-foreground">
            {row.stats.present}·{row.stats.late}·{row.stats.absent}
          </span>
        </span>
      </td>
    </tr>
  )
}
