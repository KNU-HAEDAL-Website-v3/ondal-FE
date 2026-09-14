import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Archive, ArrowLeft, UserMinus, UserPlus } from 'lucide-react'
import { useMe } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { useAssignOperator, useAssignStudents, useMembers, useRemoveOperator, useRemoveStudent } from '@/api/members'
import type { MemberResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { parseLoginIds } from '@/lib/loginIds'
import { parseId } from '@/lib/params'

/**
 * 분반 명부·수강생 배정 (UC-O2) - /cohorts/:cohortId/members. 운영진 이상(자기 반)·관리자(모든 반).
 * - 명부(운영진 먼저)는 보관 분반에서도 열람 가능. 학생의 URL 직접 접근은 서버 403 → ApiErrorView 가 홈으로
 * - 수강생 배정(명단 붙여넣기)·제외: canManage(ACTIVE && 운영진 이상) 일 때만. 배정 응답이 갱신 명부라 재조회 없음
 * - 운영진 지정·해제: 관리자만(ADMIN). 강등 API 는 없어 "해제 후 수강생으로 배정"으로 안내
 * - 배정 명단은 임시 저장(세션 만료 대비), 실패 시 입력 보존·요청 중 잠금
 */
export default function CohortMembersPage() {
  const { cohortId: cohortParam } = useParams()
  const cohortId = parseId(cohortParam)
  const { data: me } = useMe()
  const cohortQuery = useCohort(cohortId)
  const membersQuery = useMembers(cohortId)

  const assignMutation = useAssignStudents(cohortId)
  const removeStudentMutation = useRemoveStudent(cohortId)
  const assignOperatorMutation = useAssignOperator(cohortId)
  const removeOperatorMutation = useRemoveOperator(cohortId)

  const draftKey = `ondal-roster-draft:${cohortId}`
  const [loginIdsText, setLoginIdsText] = useState(() => readDraft<string>(draftKey) ?? '')
  const [operatorLoginId, setOperatorLoginId] = useState('')
  useEffect(() => {
    if (loginIdsText === '') clearDraft(draftKey)
    else writeDraft(draftKey, loginIdsText)
  }, [draftKey, loginIdsText])

  if (!Number.isFinite(cohortId)) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 분반 주소예요.')} />
  if (cohortQuery.isPending || membersQuery.isPending) return <LoadingScreen label="명부 불러오는 중..." />
  if (cohortQuery.error) return <ApiErrorView error={cohortQuery.error} onRetry={() => void cohortQuery.refetch()} />
  if (membersQuery.error) return <ApiErrorView error={membersQuery.error} onRetry={() => void membersQuery.refetch()} />

  const cohort = cohortQuery.data
  const members = membersQuery.data
  const archived = cohort.status === 'ARCHIVED'
  const isAdmin = me?.globalRole === 'ADMIN'
  const canManage = cohort.canManage // ACTIVE && (ADMIN || OPERATOR) - 서버 판정값
  const canManageOperators = isAdmin && !archived
  const operators = members.filter((m) => m.role === 'OPERATOR')
  const students = members.filter((m) => m.role === 'STUDENT')
  const parsedIds = parseLoginIds(loginIdsText)

  const handleAssign = (e: FormEvent) => {
    e.preventDefault()
    if (parsedIds.length === 0 || assignMutation.isPending) return
    assignMutation.mutate(parsedIds, {
      onSuccess: () => {
        setLoginIdsText('') // 성공했을 때만 비운다 - 실패(409 등) 시 명단 보존
        clearDraft(draftKey)
      },
    })
  }

  const handleRemoveStudent = (m: MemberResponse) => {
    if (!window.confirm(`${m.user.name}(${m.user.loginId}) 수강생을 이 분반에서 제외할까요?\n소속만 해제되고 계정·제출 기록은 지워지지 않아요.`)) return
    removeStudentMutation.mutate(m.user.loginId)
  }

  const handleAssignOperator = (e: FormEvent) => {
    e.preventDefault()
    const id = operatorLoginId.trim()
    if (!id || assignOperatorMutation.isPending) return
    assignOperatorMutation.mutate(id, { onSuccess: () => setOperatorLoginId('') })
  }

  const handleRemoveOperator = (m: MemberResponse) => {
    if (!window.confirm(`${m.user.name}(${m.user.loginId}) 운영진을 해제할까요?\n다시 수강생으로 두려면 해제한 뒤 수강생 배정에서 추가하세요.`)) return
    removeOperatorMutation.mutate(m.user.loginId)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/cohorts/${cohortId}`}>
          <ArrowLeft data-icon="inline-start" />
          분반 페이지로
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">명부 · 배정</h1>
            {archived && (
              <Badge variant="outline">
                <Archive data-icon="inline-start" />
                보관됨
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort.name} - 운영진 {operators.length}명 · 수강생 {students.length}명
          </p>
        </div>
      </header>

      {archived && (
        <p className="rounded-[2px] border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 명부 열람만 가능하고 배정·해제는 보관을 해제한 뒤에 할 수 있어요.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">운영진</h2>
        <MemberTable
          members={operators}
          emptyText="지정된 운영진이 없어요."
          action={
            canManageOperators
              ? (m) => (
                  <Button
                    variant="outline"
                    size="xs"
                    className="rounded-[2px] text-destructive"
                    onClick={() => handleRemoveOperator(m)}
                    disabled={removeOperatorMutation.isPending}
                  >
                    <UserMinus data-icon="inline-start" />
                    해제
                  </Button>
                )
              : undefined
          }
        />
        {removeOperatorMutation.error && (
          <p className="text-sm text-destructive">{(removeOperatorMutation.error as Error).message}</p>
        )}
        {canManageOperators && (
          <form onSubmit={handleAssignOperator} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card/40 p-4">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="operator-login-id">운영진 지정 (관리자)</Label>
              <Input
                id="operator-login-id"
                value={operatorLoginId}
                onChange={(e) => setOperatorLoginId(e.target.value)}
                maxLength={50}
                placeholder="홈페이지 아이디 - 수강생이면 운영진으로 승격, 미소속이면 새로 소속"
                className="font-mono"
              />
            </div>
            <Button type="submit" size="sm" className="rounded-[2px]" disabled={!operatorLoginId.trim() || assignOperatorMutation.isPending}>
              <UserPlus data-icon="inline-start" />
              {assignOperatorMutation.isPending ? '지정 중...' : '운영진 지정'}
            </Button>
            {assignOperatorMutation.error && (
              <p className="basis-full text-sm text-destructive">{(assignOperatorMutation.error as Error).message}</p>
            )}
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">수강생</h2>
        <MemberTable
          members={students}
          emptyText="아직 배정된 수강생이 없어요."
          action={
            canManage
              ? (m) => (
                  <Button
                    variant="outline"
                    size="xs"
                    className="rounded-[2px] text-destructive"
                    onClick={() => handleRemoveStudent(m)}
                    disabled={removeStudentMutation.isPending}
                  >
                    <UserMinus data-icon="inline-start" />
                    제외
                  </Button>
                )
              : undefined
          }
        />
        {removeStudentMutation.error && (
          <p className="text-sm text-destructive">{(removeStudentMutation.error as Error).message}</p>
        )}
      </section>

      {canManage && (
        <section className="space-y-3 rounded-lg border bg-card/40 p-4">
          <div>
            <h2 className="font-bold">수강생 배정</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              홈페이지(Keycloak) 아이디 명단을 붙여 넣으세요 - 줄바꿈·쉼표·공백 구분. 아직 로그인한 적 없는 부원도 선등록되고, 이미
              소속된 수강생은 건너뜁니다. 운영진 아이디가 섞여 있으면 전체가 거부돼요.
            </p>
          </div>
          <form onSubmit={handleAssign} className="space-y-3">
            <textarea
              id="student-login-ids"
              aria-label="배정할 수강생 아이디 명단"
              value={loginIdsText}
              onChange={(e) => setLoginIdsText(e.target.value)}
              rows={5}
              placeholder={'hong\nkim, lee\n...'}
              className="w-full rounded-[6px] border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {assignMutation.error && <p className="text-sm text-destructive">{(assignMutation.error as Error).message}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" className="rounded-[2px]" disabled={parsedIds.length === 0 || assignMutation.isPending}>
                <UserPlus data-icon="inline-start" />
                {assignMutation.isPending ? '배정 중...' : parsedIds.length === 0 ? '배정' : `${parsedIds.length}명 배정`}
              </Button>
              <span className="text-xs text-muted-foreground">
                {parsedIds.length === 0 ? '인식된 아이디 없음' : `인식된 아이디: ${parsedIds.join(', ')}`}
              </span>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}

/** 명부 표 - 이름 · 아이디 · 직책 · 등록일 (+ 행 동작). 직책은 서버 문자열(title) 그대로 */
function MemberTable({
  members,
  emptyText,
  action,
}: {
  members: MemberResponse[]
  emptyText: string
  action?: (m: MemberResponse) => ReactNode
}) {
  if (members.length === 0) {
    return <p className="rounded-[2px] border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto rounded-[2px] border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">이름</th>
            <th className="px-3 py-2 text-left font-semibold">아이디</th>
            <th className="px-3 py-2 text-left font-semibold">직책</th>
            <th className="px-3 py-2 text-left font-semibold">등록일</th>
            {action && <th className="px-3 py-2 text-right font-semibold">관리</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map((m) => (
            <tr key={m.user.id}>
              <td className="px-3 py-2 font-medium">{m.user.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{m.user.loginId}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary">{m.title}</Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{formatKst(m.enrolledAt)}</td>
              {action && <td className="px-3 py-2 text-right">{action(m)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
