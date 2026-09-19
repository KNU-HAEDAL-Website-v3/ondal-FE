import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

/** 서버 살아 있는지 - 관리자 개요 "시스템 상태" 용 (GET /api/health, 로그인 면제). 실패도 상태값이라 재시도하지 않는다 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ status: string }>('/api/health'),
    retry: false,
    refetchInterval: 60_000,
  })
}
