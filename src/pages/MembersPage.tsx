import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search, UserCheck, Users } from 'lucide-react'
import { useApproveUser, useUsers } from '@/api/users'
import type { UserDirectoryEntry, UserStatus } from '@/api/types'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Badge } from '@/components/ui/badge'
import { isAdminRole, globalRoleLabel } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

type Tab = 'PENDING' | 'ALL'

/**
 * 부원 관리 - /members (운영진 이상: 해구르르 또는 어느 분반이든 교육운영진. 수강생은 RequireOperator 가 홈으로).
 * 승인 대기(PENDING) 계정을 승인하고, 가입한 부원 전체와 소속을 훑는 화면 (docs 결정 10).
 * - 탭: 승인 대기 / 전체. ?status=PENDING 으로 들어오면 대기 탭 (대시보드 배너가 이 주소로 보낸다)
 * - 검색은 화면에서(이름·아이디) - 동아리 규모라 서버 페이징 없음
 * - 승인은 한 명씩 버튼 - 실수로 한꺼번에 승인하는 일을 막는다. 분반 배정으로도 승인되므로(자동 승인) 배정이 목적이면 명부 화면이 더 빠르다
 */
export default function MembersPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('status') === 'PENDING' ? 'PENDING' : 'ALL'
  const [term, setTerm] = useState('')
  const usersQuery = useUsers()
  const approveMutation = useApproveUser()

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const pendingCount = users.filter((u) => u.status === 'PENDING').length
  const visible = useMemo(() => {
    const q = term.trim().toLowerCase()
    return users
      .filter((u) => tab === 'ALL' || u.status === 'PENDING')
      .filter((u) => q === '' || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q))
  }, [users, tab, term])

  if (usersQuery.isPending) return <LoadingScreen label="부원 목록 불러오는 중..." />
  if (usersQuery.error) return <ApiErrorView error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />

  const setTab = (next: Tab) => setParams(next === 'PENDING' ? { status: 'PENDING' } : {}, { replace: true })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">부원 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            홈페이지로 로그인한 부원 {users.length}명 · 승인 대기 {pendingCount}명. 승인하거나 분반에 배정하면 Ondal 을 쓸 수 있어요.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="부원 상태" className="flex overflow-hidden rounded-lg border bg-card text-sm">
          <TabButton active={tab === 'PENDING'} onClick={() => setTab('PENDING')}>
            승인 대기
            <span className={cn('rounded-md px-1.5 text-xs font-bold', pendingCount > 0 ? 'bg-warning-bg text-warning' : 'bg-muted text-muted-foreground')}>
              {pendingCount}
            </span>
          </TabButton>
          <TabButton active={tab === 'ALL'} onClick={() => setTab('ALL')}>
            전체 <span className="rounded-md bg-muted px-1.5 text-xs font-bold text-muted-foreground">{users.length}</span>
          </TabButton>
        </div>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="이름 또는 아이디로 찾기" className="pl-8" aria-label="부원 검색" />
        </div>
      </div>

      {approveMutation.error && <p className="text-sm text-destructive">{(approveMutation.error as Error).message}</p>}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={tab === 'PENDING' && term === '' ? '승인을 기다리는 부원이 없어요' : '조건에 맞는 부원이 없어요'}
          description={tab === 'PENDING' && term === '' ? '새로 로그인한 부원이 생기면 여기에 나타나요.' : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">이름</th>
                <th className="px-3 py-2 text-left font-semibold">아이디</th>
                <th className="px-3 py-2 text-left font-semibold">상태</th>
                <th className="px-3 py-2 text-left font-semibold">소속</th>
                <th className="px-3 py-2 text-left font-semibold">가입</th>
                <th className="px-3 py-2 text-right font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((u) => (
                <tr key={u.id} className={u.status === 'PENDING' ? 'bg-warning-soft' : undefined}>
                  <td className="px-3 py-2 font-medium">
                    {u.name}
                    {isAdminRole(u.globalRole) && (
                      <Badge variant="secondary" className="ml-1.5">
                        {globalRoleLabel(u.globalRole)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{u.loginId}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={u.status} />
                  </td>
                  <td className="px-3 py-2">
                    {u.enrollments.length === 0 ? (
                      <span className="text-xs text-muted-foreground">미소속</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {u.enrollments.map((e) => (
                          <Badge key={e.cohortId} variant="outline" className={e.cohortStatus === 'ARCHIVED' ? 'opacity-60' : undefined}>
                            {e.cohortName} · {e.role === 'OPERATOR' ? '운영진' : '수강생'}
                            {e.cohortStatus === 'ARCHIVED' && ' (보관)'}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{formatKst(u.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {u.status === 'PENDING' && (
                      <Button
                        size="xs"
                        onClick={() => approveMutation.mutate(u.id)}
                        disabled={approveMutation.isPending && approveMutation.variables === u.id}
                      >
                        <UserCheck data-icon="inline-start" />
                        {approveMutation.isPending && approveMutation.variables === u.id ? '승인 중...' : '승인'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

/** 승인 상태 칩 - 대기는 노랑(warning), 이용 중은 초록(success). 상태색 토큰만 쓴다 (index.css) */
export function StatusChip({ status }: { status: UserStatus }) {
  return status === 'PENDING' ? (
    <span className="inline-block rounded-md bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">승인 대기</span>
  ) : (
    <span className="inline-block rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">이용 중</span>
  )
}

export type { UserDirectoryEntry }
