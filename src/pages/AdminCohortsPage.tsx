import { Link, useSearchParams } from 'react-router'
import { Archive, ArchiveRestore, ClipboardList, Pencil, Plus, Users } from 'lucide-react'
import { useArchiveCohort, useCohorts, useRestoreCohort } from '@/api/cohorts'
import type { CohortResponse, CohortStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * [관리자] 분반 관리 (UC-A1) - /admin/cohorts. 전체 분반을 상태별(진행 중 / 보관함)로 보고 생성·수정·보관·명부 진입.
 * 운영진 지정·수강생 배정은 각 분반의 명부 화면(/cohorts/:id/members)에서 한다.
 * 관리자 판정은 RequireAdmin(라우트 울타리) + 서버 @AdminOnly.
 */
export default function AdminCohortsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status: CohortStatus = searchParams.get('status') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
  const query = useCohorts(status)
  const archiveMutation = useArchiveCohort()
  const restoreMutation = useRestoreCohort()
  const busy = archiveMutation.isPending || restoreMutation.isPending
  const mutationError = archiveMutation.error ?? restoreMutation.error

  const handleArchive = (cohort: CohortResponse) => {
    if (
      !window.confirm(
        `'${cohort.name}' 분반을 보관할까요?\n보관되면 과제·제출·질문 등 모든 변경이 막히고 열람만 가능해요. 보관함에서 해제하면 되돌릴 수 있습니다.`,
      )
    ) {
      return
    }
    archiveMutation.mutate(cohort.id)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">분반 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            전체 분반 - 생성·수정·보관은 관리자만. 운영진 지정·수강생 배정은 각 분반의 명부에서 합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="분반 상태" className="flex overflow-hidden rounded-[2px] border text-sm">
            <button
              type="button"
              aria-pressed={status === 'ACTIVE'}
              onClick={() => setSearchParams({})}
              className={cn('px-3 py-1.5', status === 'ACTIVE' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              진행 중
            </button>
            <button
              type="button"
              aria-pressed={status === 'ARCHIVED'}
              onClick={() => setSearchParams({ status: 'ARCHIVED' })}
              className={cn('px-3 py-1.5', status === 'ARCHIVED' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              보관함
            </button>
          </div>
          <Button size="sm" className="rounded-[2px]" asChild>
            <Link to="/admin/cohorts/new">
              <Plus data-icon="inline-start" />
              분반 만들기
            </Link>
          </Button>
        </div>
      </header>

      {mutationError && <p className="text-sm text-destructive">{(mutationError as Error).message}</p>}

      {query.isPending ? (
        <LoadingScreen />
      ) : query.error ? (
        <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={status === 'ACTIVE' ? '진행 중인 분반이 없어요' : '보관된 분반이 없어요'}
          description={status === 'ACTIVE' ? '"분반 만들기"로 첫 분반을 만들고 운영진을 지정하세요.' : '보관하면 여기에 모입니다.'}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-[2px] border bg-card">
          {query.data.map((cohort) => (
            <CohortRow
              key={cohort.id}
              cohort={cohort}
              busy={busy}
              onArchive={() => handleArchive(cohort)}
              onRestore={() => restoreMutation.mutate(cohort.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CohortRow({
  cohort,
  busy,
  onArchive,
  onRestore,
}: {
  cohort: CohortResponse
  busy: boolean
  onArchive: () => void
  onRestore: () => void
}) {
  const archived = cohort.status === 'ARCHIVED'
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/cohorts/${cohort.id}`} className="font-semibold hover:underline">
            {cohort.name}
          </Link>
          {archived && (
            <Badge variant="outline">
              <Archive data-icon="inline-start" />
              보관됨
            </Badge>
          )}
        </div>
        {cohort.description && <p className="truncate text-xs text-muted-foreground">{cohort.description}</p>}
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>운영진 {cohort.operators.length === 0 ? '없음' : cohort.operators.map((op) => op.name).join(', ')}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            수강생 {cohort.studentCount ?? 0}명
          </span>
          <span className="font-mono">{formatKst(cohort.createdAt)}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
          <Link to={`/cohorts/${cohort.id}/members`}>
            <ClipboardList data-icon="inline-start" />
            명부·배정
          </Link>
        </Button>
        {!archived && (
          <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
            <Link to={`/admin/cohorts/${cohort.id}/edit`}>
              <Pencil data-icon="inline-start" />
              수정
            </Link>
          </Button>
        )}
        {archived ? (
          <Button variant="outline" size="sm" className="rounded-[2px]" onClick={onRestore} disabled={busy}>
            <ArchiveRestore data-icon="inline-start" />
            보관 해제
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="rounded-[2px] text-destructive" onClick={onArchive} disabled={busy}>
            <Archive data-icon="inline-start" />
            보관
          </Button>
        )}
      </div>
    </li>
  )
}
