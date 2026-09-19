import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Archive, ArrowLeft, ShieldPlus, UserMinus, UserPlus } from 'lucide-react'
import { useMe } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useCohort } from '@/api/cohorts'
import { useMembers, useRemoveOperator, useRemoveStudent } from '@/api/members'
import type { MemberResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MemberPickerDialog } from '@/components/cohorts/MemberPickerDialog'
import { formatKst } from '@/lib/datetime'
import { parseId } from '@/lib/params'

/**
 * 분반 명부·수강생 배정 (UC-O2) - /cohorts/:cohortId/members. 운영진 이상(자기 반)·관리자(모든 반).
 * - 명부(운영진 먼저)는 보관 분반에서도 열람 가능. 학생의 URL 직접 접근은 서버 403 → ApiErrorView 가 홈으로
 * - 수강생 추가·제외: canManage(ACTIVE && 운영진 이상) 일 때만. 추가는 MemberPickerDialog(부원 목록에서 체크박스 선택, 보조 탭 명단 붙여넣기)
 * - 운영진 지정·해제: 관리자만(ADMIN). 지정도 같은 모달(OPERATOR 모드). 강등 API 는 없어 "해제 후 수강생으로 추가"로 안내
 * - 2026-09-19 PM: 아이디 타이핑 대신 목록 선택으로 바꿈 - 구글 로그인은 아이디가 이메일이라 오타가 잦고, 승인 대기 계정을 배정과 함께 승인하려면 목록이 있어야 함
 */
export default function CohortMembersPage() {
  const { cohortId: cohortParam } = useParams()
  const cohortId = parseId(cohortParam)
  const { data: me } = useMe()
  const cohortQuery = useCohort(cohortId)
  const membersQuery = useMembers(cohortId)

  const removeStudentMutation = useRemoveStudent(cohortId)
  const removeOperatorMutation = useRemoveOperator(cohortId)
  const [picker, setPicker] = useState<'STUDENT' | 'OPERATOR' | null>(null)

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

  const handleRemoveStudent = (m: MemberResponse) => {
    if (!window.confirm(`${m.user.name}(${m.user.loginId}) 수강생을 이 분반에서 제외할까요?\n소속만 해제되고 계정·제출 기록은 지워지지 않아요.`)) return
    removeStudentMutation.mutate(m.user.loginId)
  }

  const handleRemoveOperator = (m: MemberResponse) => {
    if (!window.confirm(`${m.user.name}(${m.user.loginId}) 운영진을 해제할까요?\n다시 수강생으로 두려면 해제한 뒤 수강생 추가에서 고르세요.`)) return
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
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
          보관된 분반이에요. 명부 열람만 가능하고 배정·해제는 보관을 해제한 뒤에 할 수 있어요.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">운영진</h2>
          {canManageOperators && (
            <Button size="sm" variant="outline" onClick={() => setPicker('OPERATOR')}>
              <ShieldPlus data-icon="inline-start" />
              운영진 지정
            </Button>
          )}
        </div>
        <MemberTable
          members={operators}
          emptyText="지정된 운영진이 없어요."
          action={
            canManageOperators
              ? (m) => (
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-destructive"
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
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">수강생</h2>
          {canManage && (
            <Button size="sm" onClick={() => setPicker('STUDENT')}>
              <UserPlus data-icon="inline-start" />
              수강생 추가
            </Button>
          )}
        </div>
        <MemberTable
          members={students}
          emptyText={canManage ? '아직 배정된 수강생이 없어요. "수강생 추가"에서 부원 목록을 보고 고르세요.' : '아직 배정된 수강생이 없어요.'}
          action={
            canManage
              ? (m) => (
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-destructive"
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

      {picker && (
        <MemberPickerDialog
          cohortId={cohortId}
          cohortName={cohort.name}
          members={members}
          mode={picker}
          open
          onOpenChange={(open) => !open && setPicker(null)}
        />
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
    return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
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
              <td className="px-3 py-2 font-mono text-xs break-all">{m.user.loginId}</td>
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
