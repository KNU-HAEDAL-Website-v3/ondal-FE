import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Megaphone, Pencil, Search, SquarePen, Trash2 } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useMyCohorts } from '@/api/cohorts'
import { useDeleteNotice, useNotices } from '@/api/notices'
import type { NoticeResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { isAdminRole } from '@/lib/roles'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

type Target = 'all' | 'global' | number

/**
 * 공지사항 - 역할 무관 한 화면 (docs/notice/fe.md 1절). 목록은 서버가 가시성(전체 + 소속 분반, 관리자는 전부)·정렬(필독 먼저)을 정한 그대로.
 * - "공지 작성"은 관리자이거나 canManage 분반이 하나라도 있으면 (홈의 운영진 뷰 판정과 동일)
 * - 대상 필터는 클라이언트 - 목록이 이미 내가 볼 수 있는 것만이라 안전. 선택지는 목록에 실제 등장한 분반(관리자는 소속 없이도 모든 분반 공지를 본다)
 * 원안(관리자·교육운영진 공지 관리) 반영(2026-09-20): 헤더 우측은 CTA 만, 필터(대상·제목/작성자 검색)는 아래 패널, 행에 수정·삭제(서버 canEdit·canDelete), 하단 "총 N건"
 */
export default function NoticesPage() {
  const { data: me } = useMe()
  const cohortsQuery = useMyCohorts()
  const noticesQuery = useNotices()
  const deleteMutation = useDeleteNotice()
  const [target, setTarget] = useState<Target>('all')
  const [keyword, setKeyword] = useState('')

  if (noticesQuery.isPending || cohortsQuery.isPending) return <LoadingScreen label="공지사항 불러오는 중..." />
  if (noticesQuery.error) return <ApiErrorView error={noticesQuery.error} onRetry={() => void noticesQuery.refetch()} />
  if (cohortsQuery.error) return <ApiErrorView error={cohortsQuery.error} onRetry={() => void cohortsQuery.refetch()} />

  const notices = noticesQuery.data
  const canWrite = isAdminRole(me?.globalRole) || cohortsQuery.data.some((c) => c.canManage)
  const cohortOptions = uniqueCohorts(notices)
  const needle = keyword.trim().toLowerCase()
  const visible = notices.filter((n) => {
    if (target === 'global' ? n.cohort !== null : target !== 'all' && n.cohort?.id !== target) return false
    if (needle && !n.title.toLowerCase().includes(needle) && !n.author.name.toLowerCase().includes(needle)) return false
    return true
  })

  const handleDelete = (notice: NoticeResponse) => {
    if (!window.confirm(`"${notice.title}" 공지를 삭제할까요? 되돌릴 수 없어요.`)) return
    deleteMutation.mutate(notice.id)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
          <p className="mt-1 text-sm text-muted-foreground">전체 공지와 소속 분반 공지 - 필독이 먼저 보여요.</p>
        </div>
        {canWrite && (
          <Button size="sm" asChild>
            <Link to="/notices/new">
              <SquarePen data-icon="inline-start" />
              공지 작성
            </Link>
          </Button>
        )}
      </header>

      {notices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">대상</span>
            <select
              value={String(target)}
              onChange={(e) => setTarget(e.target.value === 'all' ? 'all' : e.target.value === 'global' ? 'global' : Number(e.target.value))}
              aria-label="대상 필터"
              className="h-8 rounded-lg border bg-card px-2 text-sm"
            >
              <option value="all">전체 보기</option>
              <option value="global">전체 공지만</option>
              {cohortOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제목 · 작성자 검색"
              aria-label="공지 검색"
              className="w-40 bg-transparent text-sm outline-none"
            />
          </label>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {visible.length === notices.length ? `총 ${notices.length}건` : `${visible.length} / 총 ${notices.length}건`}
          </span>
        </div>
      )}

      {deleteMutation.error && <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-8" />}
          title={notices.length === 0 ? '공지가 없어요' : '조건에 맞는 공지가 없어요'}
          description={notices.length === 0 ? (canWrite ? '첫 공지를 작성해 보세요.' : '공지가 등록되면 여기에 표시됩니다.') : '대상이나 검색어를 바꿔 보세요.'}
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {visible.map((n) => (
            <NoticeRow key={n.id} notice={n} onDelete={handleDelete} deleting={deleteMutation.isPending} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** 목록에 등장한 분반(중복 제거, 등장 순서) - 필터 선택지 */
function uniqueCohorts(notices: NoticeResponse[]) {
  const seen = new Map<number, string>()
  for (const n of notices) {
    if (n.cohort && !seen.has(n.cohort.id)) seen.set(n.cohort.id, n.cohort.name)
  }
  return [...seen].map(([id, name]) => ({ id, name }))
}

/** 행 - 필독은 빨간 아이콘·배지 (피그마 2:37234 파생 스타일 유지). 수정·삭제는 서버 판정(canEdit·canDelete)대로 - 원안 "관리" 열 */
function NoticeRow({ notice, onDelete, deleting }: { notice: NoticeResponse; onDelete: (notice: NoticeResponse) => void; deleting: boolean }) {
  return (
    <li className="flex items-center gap-2 pr-3">
      <Link
        to={`/notices/${notice.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-secondary/50"
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            notice.pinned ? 'bg-danger-bg text-danger' : 'bg-secondary text-primary',
          )}
        >
          <Megaphone className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {notice.pinned && (
              <span className="shrink-0 rounded-md bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">필독</span>
            )}
            <span className="truncate font-semibold">{notice.title}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {notice.cohort?.name ?? '전체 공지'} · {notice.author.name} · <span className="font-mono">{formatKst(notice.createdAt)}</span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      {(notice.canEdit || notice.canDelete) && (
        <span className="flex shrink-0 items-center gap-1">
          {notice.canEdit && (
            <Button variant="ghost" size="sm" asChild aria-label={`${notice.title} 수정`}>
              <Link to={`/notices/${notice.id}/edit`}>
                <Pencil data-icon="inline-start" />
                수정
              </Link>
            </Button>
          )}
          {notice.canDelete && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(notice)} disabled={deleting} aria-label={`${notice.title} 삭제`}>
              <Trash2 data-icon="inline-start" />
              삭제
            </Button>
          )}
        </span>
      )}
    </li>
  )
}
