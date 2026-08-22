import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { SearchX, TriangleAlert } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'

/**
 * 조회 실패의 공통 처리 - 페이지는 에러를 여기로 넘기기만 한다 (CLAUDE.md 필수 동작 규칙 3, design.md 3절).
 * - FORBIDDEN(403): 홈으로 리다이렉트 + 안내 문구 (권한 밖 URL 직접 접근). **홈 리다이렉트는 이 코드에만**
 * - NOT_FOUND(404): 그 자리에서 "찾을 수 없음" 안내 (홈으로 보내지 않음)
 * - 그 외(네트워크·5xx): 서버 메시지 + 재시도
 */
export function ApiErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError) {
    if (error.is('FORBIDDEN')) {
      return <Navigate to="/" replace state={{ notice: '접근 권한이 없는 페이지예요. 홈으로 이동했습니다.' }} />
    }
    if (error.is('NOT_FOUND')) {
      return (
        <EmptyState icon={<SearchX className="size-8" />} title="찾을 수 없어요" description={error.message} />
      )
    }
  }
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
  return (
    <EmptyState icon={<TriangleAlert className="size-8" />} title="불러오지 못했어요" description={message}>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </EmptyState>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
