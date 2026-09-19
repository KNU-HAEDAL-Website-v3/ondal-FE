import { useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, ListChecks, Search, UserPlus } from 'lucide-react'
import { useAssignOperator, useAssignStudents } from '@/api/members'
import { useUsers } from '@/api/users'
import type { MemberResponse, UserDirectoryEntry } from '@/api/types'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Button } from '@/components/ui/button'
import { isAdminRole, globalRoleLabel } from '@/lib/roles'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseLoginIds } from '@/lib/loginIds'
import { cn } from '@/lib/utils'

type Mode = 'STUDENT' | 'OPERATOR'
type Filter = 'ALL' | 'UNASSIGNED' | 'PENDING'
type Tab = 'PICK' | 'PASTE'

/**
 * 명부 배정 모달 (2026-09-19 PM) - 아이디를 타이핑하는 대신 **가입한 부원 목록(GET /api/users)에서 체크박스로 고른다**.
 * - mode STUDENT: 수강생 배정 (운영진 이상). 보조 탭 "명단 붙여넣기" - 아직 로그인한 적 없는 부원을 아이디로 선등록할 때 (PM: 보조로 유지)
 * - mode OPERATOR: 운영진 지정 (관리자만) - 수강생이면 승격, 미소속이면 새로 소속. 목록에서만 고른다
 * - 이미 이 반에 있는 사람은 잠그고 사유를 보인다. 승인 대기 계정은 배정과 동시에 승인된다(BE 자동 승인)
 * - 드래그 앤 드롭은 두지 않았다 - 체크박스가 키보드·모바일에서도 되고, 수십 명을 고를 때 더 빠르다
 * 배정 요청은 기존 API 그대로: 수강생 = POST .../students(일괄), 운영진 = PUT .../operators/{loginId}(한 명씩 순서대로)
 */
export function MemberPickerDialog({
  cohortId,
  cohortName,
  members,
  mode,
  open,
  onOpenChange,
}: {
  cohortId: number
  cohortName: string
  members: MemberResponse[]
  mode: Mode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const usersQuery = useUsers(undefined, open)
  const assignStudents = useAssignStudents(cohortId)
  const assignOperator = useAssignOperator(cohortId)

  const [tab, setTab] = useState<Tab>('PICK')
  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 명단 붙여넣기 - 세션 만료 대비 임시 저장 (예전 화면과 같은 키라 쓰다 만 명단이 그대로 살아 있다)
  const draftKey = `ondal-roster-draft:${cohortId}`
  const [pasteText, setPasteText] = useState(() => readDraft<string>(draftKey) ?? '')
  useEffect(() => {
    if (pasteText === '') clearDraft(draftKey)
    else writeDraft(draftKey, pasteText)
  }, [draftKey, pasteText])

  // 닫힐 때 선택·검색은 비운다 (붙여넣기 명단은 임시 저장이라 남긴다)
  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setTerm('')
      setFilter('ALL')
      setSubmitError(null)
      setTab('PICK')
    }
  }, [open])

  const roster = useMemo(() => new Map(members.map((m) => [m.user.loginId, m])), [members])

  /** 이 사람을 이 모드로 넣을 수 있는가 - 못 넣으면 사유 */
  const lockReason = (u: UserDirectoryEntry): string | null => {
    const mine = roster.get(u.loginId)
    if (!mine) return null
    if (mode === 'STUDENT') return mine.role === 'OPERATOR' ? '이 반 운영진 - 수강생으로 못 넣어요' : '이미 수강생'
    return mine.role === 'OPERATOR' ? '이미 운영진' : null // 수강생이면 승격 가능
  }

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const visible = useMemo(() => {
    const q = term.trim().toLowerCase()
    return users
      .filter((u) => filter !== 'UNASSIGNED' || u.enrollments.every((e) => e.cohortStatus === 'ARCHIVED'))
      .filter((u) => filter !== 'PENDING' || u.status === 'PENDING')
      .filter((u) => q === '' || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q))
  }, [users, filter, term])
  const selectable = visible.filter((u) => lockReason(u) === null)
  const allVisibleSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.loginId))

  const toggle = (loginId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(loginId)) next.delete(loginId)
      else next.add(loginId)
      return next
    })
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) selectable.forEach((u) => next.delete(u.loginId))
      else selectable.forEach((u) => next.add(u.loginId))
      return next
    })

  const pastedIds = parseLoginIds(pasteText)
  const targetIds = tab === 'PASTE' ? pastedIds : [...selected]
  const pendingSelected = users.filter((u) => selected.has(u.loginId) && u.status === 'PENDING').length

  const submit = async () => {
    if (targetIds.length === 0 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (mode === 'STUDENT') {
        await assignStudents.mutateAsync(targetIds)
      } else {
        for (const loginId of targetIds) {
          await assignOperator.mutateAsync(loginId) // 한 명씩 - 실패한 사람부터 다시 시도할 수 있게 순서대로
        }
      }
      if (tab === 'PASTE') {
        setPasteText('')
        clearDraft(draftKey)
      }
      onOpenChange(false)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '배정에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = mode === 'STUDENT' ? '수강생 추가' : '운영진 지정'
  const verb = mode === 'STUDENT' ? '수강생으로 배정' : '운영진으로 지정'

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {title} - {cohortName}
          </DialogTitle>
          <DialogDescription>
            {mode === 'STUDENT'
              ? '홈페이지로 로그인한 부원 목록에서 골라요. 승인 대기 중인 부원은 배정과 함께 승인돼요.'
              : '고른 사람은 이 분반의 운영진이 돼요 - 수강생이면 승격, 미소속이면 새로 소속. 승인 대기 중이면 함께 승인돼요.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'STUDENT' && (
          <div role="tablist" aria-label="추가 방식" className="flex w-fit overflow-hidden rounded-lg border bg-card text-sm">
            <TabButton active={tab === 'PICK'} onClick={() => setTab('PICK')}>
              <ListChecks className="size-4" />
              목록에서 선택
            </TabButton>
            <TabButton active={tab === 'PASTE'} onClick={() => setTab('PASTE')}>
              <ClipboardPaste className="size-4" />
              명단 붙여넣기
            </TabButton>
          </div>
        )}

        {tab === 'PICK' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="이름 또는 아이디로 찾기" className="pl-8" aria-label="부원 검색" autoFocus />
              </div>
              <div className="flex overflow-hidden rounded-lg border bg-card text-xs">
                <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
                  전체
                </FilterButton>
                <FilterButton active={filter === 'UNASSIGNED'} onClick={() => setFilter('UNASSIGNED')}>
                  미소속만
                </FilterButton>
                <FilterButton active={filter === 'PENDING'} onClick={() => setFilter('PENDING')}>
                  승인 대기만
                </FilterButton>
              </div>
            </div>

            {usersQuery.isPending ? (
              <LoadingScreen label="부원 목록 불러오는 중..." />
            ) : usersQuery.error ? (
              <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
                부원 목록을 불러오지 못했어요: {usersQuery.error.message}
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="w-8 px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label="보이는 부원 전체 선택"
                          checked={allVisibleSelected}
                          disabled={selectable.length === 0}
                          onChange={toggleAllVisible}
                          className="size-4 accent-primary"
                        />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold">이름</th>
                      <th className="px-2 py-2 text-left font-semibold">아이디</th>
                      <th className="px-2 py-2 text-left font-semibold">상태 · 소속</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          조건에 맞는 부원이 없어요. 아직 로그인한 적 없는 부원은 "명단 붙여넣기"로 선등록할 수 있어요.
                        </td>
                      </tr>
                    )}
                    {visible.map((u) => {
                      const locked = lockReason(u)
                      const checked = selected.has(u.loginId)
                      const others = u.enrollments.filter((e) => e.cohortId !== cohortId)
                      return (
                        <tr
                          key={u.id}
                          onClick={() => !locked && toggle(u.loginId)}
                          className={cn(
                            'transition-colors',
                            locked ? 'text-muted-foreground' : 'cursor-pointer hover:bg-secondary',
                            checked && 'bg-secondary',
                          )}
                        >
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${u.name} 선택`}
                              checked={checked}
                              disabled={locked !== null}
                              onChange={() => toggle(u.loginId)}
                              onClick={(e) => e.stopPropagation()}
                              className="size-4 accent-primary"
                            />
                          </td>
                          <td className="px-2 py-2 font-medium">
                            {u.name}
                            {isAdminRole(u.globalRole) && <span className="ml-1 text-xs font-normal text-muted-foreground">{globalRoleLabel(u.globalRole)}</span>}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs break-all">{u.loginId}</td>
                          <td className="px-2 py-2">
                            <span className="flex flex-wrap items-center gap-1 text-xs">
                              {locked ? (
                                <span className="rounded-md bg-neutral-bg px-1.5 py-0.5 font-semibold text-neutral">{locked}</span>
                              ) : roster.get(u.loginId)?.role === 'STUDENT' && mode === 'OPERATOR' ? (
                                <span className="rounded-md bg-info-bg px-1.5 py-0.5 font-semibold text-info">수강생 → 운영진 승격</span>
                              ) : null}
                              {u.status === 'PENDING' && (
                                <span className="rounded-md bg-warning-bg px-1.5 py-0.5 font-semibold text-warning">승인 대기 · 배정하면 승인</span>
                              )}
                              {others.map((e) => (
                                <span key={e.cohortId} className={cn('rounded-md bg-muted px-1.5 py-0.5', e.cohortStatus === 'ARCHIVED' && 'opacity-60')}>
                                  {e.cohortName} {e.role === 'OPERATOR' ? '운영진' : '수강생'}
                                  {e.cohortStatus === 'ARCHIVED' && ' (보관)'}
                                </span>
                              ))}
                              {!locked && u.status !== 'PENDING' && others.length === 0 && <span className="text-muted-foreground">미소속</span>}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              홈페이지(Keycloak) 아이디 명단을 붙여 넣으세요 - 줄바꿈·쉼표·공백 구분. 아직 로그인한 적 없는 부원도 선등록되고(바로 이용 가능), 이미 소속된 수강생은
              건너뜁니다. 운영진 아이디가 섞여 있으면 전체가 거부돼요.
            </p>
            <textarea
              aria-label="배정할 수강생 아이디 명단"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder={'hong@gmail.com\nkim, lee\n...'}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              {pastedIds.length === 0 ? '인식된 아이디 없음' : `인식된 아이디 ${pastedIds.length}개: ${pastedIds.join(', ')}`}
            </p>
          </div>
        )}

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <span className="mr-auto text-sm text-muted-foreground">
            {targetIds.length === 0 ? '선택된 부원 없음' : `${targetIds.length}명 선택`}
            {tab === 'PICK' && pendingSelected > 0 && ` · 승인 대기 ${pendingSelected}명 포함`}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button onClick={() => void submit()} disabled={targetIds.length === 0 || submitting}>
            <UserPlus data-icon="inline-start" />
            {submitting ? '배정 중...' : targetIds.length === 0 ? verb : `${targetIds.length}명 ${verb}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('px-2.5 py-1.5 font-semibold transition-colors', active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted')}
    >
      {children}
    </button>
  )
}
