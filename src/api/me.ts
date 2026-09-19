import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { MyStatsResponse } from './types'

export const meKeys = {
  stats: ['me', 'stats'] as const,
}

/** 마이페이지 활동 요약 - 본인 것만 (GET /api/me/stats) */
export function useMyStats() {
  return useQuery({ queryKey: meKeys.stats, queryFn: () => apiFetch<MyStatsResponse>('/api/me/stats') })
}
