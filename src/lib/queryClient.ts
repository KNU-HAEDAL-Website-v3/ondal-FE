import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 서버가 명확히 답한 에러(401/403/404 등)는 재시도해도 결과가 같다 — 네트워크 실패만 1회 재시도
      retry: (failureCount, error) => !(error instanceof ApiError && error.status !== 0) && failureCount < 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})
