import { useState, type FormEvent } from 'react'
import { Archive, CheckCheck, CircleCheckBig, CircleX, Clock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMarkAttendance, useRoster } from '@/api/attendances'
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
import { formatKst, formatKstDate, todayKstInputValue, weekdayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT']

/**
 * 교육운영진 출결 관리 (피그마 28:1013) - 분반 선택 → 차시 선택(추가·수정·삭제) → 차시 명부에 출석 표시 (docs/attendance/fe.md 1절).
 * - 분반 선택지: 관리자 = 진행 중 분반 전부 / 운영진 = canManage 소속 분반
 * - 표시는 셀렉트 바꾸는 즉시 PUT(원소 1개), "일괄 출석 처리"는 미확인 전원을 PRESENT 로. 응답 명부로 즉시 갱신
 * - 요약·출석률은 서버 값 그대로. 보관 분반은 열람만
 */
export function OperatorAttendanceView({ cohorts }: { cohorts: CohortResponse[] }) {
  const { data: me } = useMe()
  const isAdmin = me?.globalRole === 'ADMIN'
  const adminCohortsQuery = useCohorts('ACTIVE', isAdmin)
  const options = isAdmin ? (adminCohortsQuery.data ?? []) : cohorts.filter((c) => c.canManage)

  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)
  const cohort = options.find((c) => c.id === selectedCohortId) ?? options[0]

  if (isAdmin && adminCohortsQuery.isPending) return <LoadingScreen label="분반 목록 불러오는 중..." />
  if (isAdmin && adminCohortsQuery.error) {
    return <ApiErrorView error={adminCohortsQuery.error} onRetry={() => void adminCohortsQuery.refetch()} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">출결 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">차시를 고르고 수강생별로 출석 · 지각 · 결석을 표시하세요.</p>
        </div>
        {options.length > 1 && (
          <select
            value={cohort?.id ?? ''}
            onChange={(e) => setSelectedCohortId(Number(e.target.value))}
            aria-label="분반 선택"
            className="h-8 rounded-[2px] border bg-card px-2 text-sm"
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {cohort ? (
        <CohortAttendance key={cohort.id} cohort={cohort} />
      ) : (
        <EmptyState title="운영할 수 있는 분반이 없어요" description="분반의 운영진으로 지정되면 여기에서 출결을 관리할 수 있어요." />
      )}
    </div>
  )
}

/** 한 분반의 출결 - 차시 목록·선택·편집 + 명부 */
function CohortAttendance({ cohort }: { cohort: CohortResponse }) {
  const archived = cohort.status === 'ARCHIVED'
  const sessionsQuery = useSessions(cohort.id)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [editor, setEditor] = useState<'closed' | 'create' | 'edit'>('closed')

  if (sessionsQuery.isPending) return <LoadingScreen label="차시 불러오는 중..." />
  if (sessionsQuery.error) return <ApiErrorView error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />

  const sessions = sessionsQuery.data
  // 기본 선택 = 가장 최근 날짜(목록은 날짜 오름차순이라 마지막)
  const session = sessions.find((s) => s.id === selectedSessionId) ?? sessions[sessions.length - 1]

  return (
    <div className="space-y-6">
      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 출석 기록 열람만 가능하고 차시 추가·표시는 보관을 해제한 뒤에 할 수 있어요.
        </p>
      )}

      <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Label htmlFor="session-select" className="text-xs font-bold tracking-[0.55px] text-muted-foreground">
          차시
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
        {!archived && (
          <div className="ml-auto flex items-center gap-2">
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
          </div>
        )}
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
        <Roster key={session.id} cohortId={cohort.id} session={session} readOnly={archived} onDeleted={() => setSelectedSessionId(null)} />
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

/** 차시 명부 - 요약 카드 + 수강생별 상태 셀렉트(즉시 저장) + 일괄 출석 처리 + 차시 삭제 */
function Roster({
  cohortId,
  session,
  readOnly,
  onDeleted,
}: {
  cohortId: number
  session: SessionResponse
  readOnly: boolean
  onDeleted: () => void
}) {
  const rosterQuery = useRoster(cohortId, session.id)
  const markMutation = useMarkAttendance(cohortId, session.id)
  const deleteMutation = useDeleteSession(cohortId)

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
        <AttendanceStatCard label="출석" value={String(summary.present)} icon={CircleCheckBig} className="border-[#dcfce7] bg-[#f0fdf4] text-[#16a34a]" />
        <AttendanceStatCard label="지각" value={String(summary.late)} icon={Clock} className="border-[#fef08a] bg-[#fefce8] text-[#b45309]" />
        <AttendanceStatCard label="결석" value={String(summary.absent)} icon={CircleX} className="border-[#fecaca] bg-[#fef2f2] text-[#ba1a1a]" />
        <AttendanceStatCard
          label="이 차시 출석률"
          value={summary.rate === null ? '-' : `${summary.rate}%`}
          className="border-transparent bg-[#4f46e5] text-white"
          labelClassName="text-white/80"
        />
      </div>

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
            <span className="text-xs text-muted-foreground">미확인 {summary.unchecked}명</span>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button size="sm" className="rounded-[2px]" onClick={markAllUnchecked} disabled={unchecked.length === 0 || markMutation.isPending}>
                <CheckCheck data-icon="inline-start" />
                일괄 출석 처리{unchecked.length > 0 ? ` (${unchecked.length})` : ''}
              </Button>
              <Button variant="outline" size="sm" className="rounded-[2px] text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 data-icon="inline-start" />
                차시 삭제
              </Button>
            </div>
          )}
        </div>
        {(markMutation.error || deleteMutation.error) && (
          <p className="px-4 pt-3 text-sm text-destructive">{((markMutation.error ?? deleteMutation.error) as Error).message}</p>
        )}
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
                {rows.map((row) => (
                  <RosterRow key={row.user.id} row={row} readOnly={readOnly} busy={markMutation.isPending} onChange={(status) => mark(row.user.loginId, status)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e3e1ec] text-[11px] font-semibold text-[#5d5e66]">
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
              row.status === 'PRESENT' && 'bg-[#dcfce7] text-[#16a34a]',
              row.status === 'LATE' && 'bg-[#fef08a] text-[#854d0e]',
              row.status === 'ABSENT' && 'bg-[#ffdad6] text-[#ba1a1a]',
              row.status === null && 'bg-[#e3e1ec] text-[#5d5e66]',
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
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e3e1ec]">
            <span
              className={cn('block h-full rounded-full', rate === null ? 'bg-transparent' : rate < 70 ? 'bg-[#ba1a1a]' : rate < 90 ? 'bg-[#d97706]' : 'bg-[#4f46e5]')}
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
