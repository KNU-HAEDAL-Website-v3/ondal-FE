import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useDeleteNotice, useNotice } from '@/api/notices'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiErrorView } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatKst } from '@/lib/datetime'
import { parseId } from '@/lib/params'

/**
 * 공지 상세 (#29) - /notices/:noticeId. 수정·삭제 버튼은 응답의 canEdit·canDelete 로만 분기 (docs/notice/fe.md).
 * 비소속의 분반 공지는 서버 403 → ApiErrorView 가 홈으로, 없는 글은 404 안내.
 */
export default function NoticeDetailPage() {
  const { noticeId: noticeParam } = useParams()
  const noticeId = parseId(noticeParam)
  const navigate = useNavigate()
  const query = useNotice(noticeId)
  const deleteMutation = useDeleteNotice()

  if (!Number.isFinite(noticeId)) return <ApiErrorView error={new ApiError(404, 'NOT_FOUND', '존재하지 않는 공지 주소예요.')} />
  if (query.isPending) return <LoadingScreen />
  if (query.error) return <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />

  const notice = query.data

  const handleDelete = () => {
    if (!window.confirm(`'${notice.title}' 공지를 삭제할까요? 삭제하면 되돌릴 수 없어요.`)) return
    deleteMutation.mutate(notice.id, { onSuccess: () => navigate('/notices', { replace: true }) })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/notices">
          <ArrowLeft data-icon="inline-start" />
          공지 목록으로
        </Link>
      </Button>

      <header className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {notice.pinned && <Badge variant="destructive">필독</Badge>}
          <Badge variant="outline">{notice.cohort?.name ?? '전체 공지'}</Badge>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{notice.title}</h1>
          {(notice.canEdit || notice.canDelete) && (
            <div className="flex shrink-0 items-center gap-2">
              {notice.canEdit && (
                <Button variant="outline" size="sm" className="rounded-[2px]" asChild>
                  <Link to={`/notices/${notice.id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    수정
                  </Link>
                </Button>
              )}
              {notice.canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-[2px] text-destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 data-icon="inline-start" />
                  삭제
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{notice.author.name}</span>
          <Badge variant="secondary">{notice.author.title}</Badge>
          <span className="font-mono text-xs">{formatKst(notice.createdAt)}</span>
        </p>
        {deleteMutation.error && <p className="text-sm text-destructive">{(deleteMutation.error as Error).message}</p>}
      </header>

      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm leading-6 break-words whitespace-pre-wrap">{notice.content}</p>
      </section>
    </div>
  )
}
