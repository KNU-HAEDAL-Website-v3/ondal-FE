import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { HojRankingResponse, HojSubmissionFeed, HojUserPageResponse, JudgeStatus, Verdict } from './types'

/**
 * HOJ P3 - 채점 현황 피드 · 사용자 페이지 · 랭킹 (docs hoj/api.md 2~4절).
 * 전부 로그인 누구나(@LoginOnly). 문제 단위 리소스(북마크·풀이·정답 코드·실행)는 api/problems.ts.
 */
export const hojKeys = {
  all: ['hoj'] as const,
  feed: (filters: FeedFilters) => ['hoj', 'submissions', filters.verdict ?? '', filters.language ?? ''] as const,
  user: (userId: number) => ['hoj', 'users', userId] as const,
  ranking: (cohortId: number | null) => ['hoj', 'ranking', cohortId ?? 'all'] as const,
}

export interface FeedFilters {
  /** 판정 7종 - 서버 파라미터. 비우면 전체 */
  verdict?: Verdict | ''
  /** 제출 언어 - 서버 파라미터. 비우면 전체 */
  language?: string
}

/** 한 번에 받는 건수 - 서버 기본 50, 최대 200 */
export const FEED_PAGE_SIZE = 50

function feedPath(filters: FeedFilters, beforeId: number | null) {
  const params = new URLSearchParams()
  params.set('size', String(FEED_PAGE_SIZE))
  if (filters.verdict) params.set('verdict', filters.verdict)
  if (filters.language) params.set('language', filters.language)
  if (beforeId !== null) params.set('beforeId', String(beforeId))
  return `/api/hoj/submissions?${params.toString()}`
}

/**
 * 채점 현황 - 연습 제출 전체, 최신 먼저. "더 보기"는 마지막 항목 id 를 beforeId 커서로 넘긴다.
 * 채점 중(PENDING/RUNNING)인 항목이 보이면 5초마다 다시 불러 판정이 채워지게 한다 (fe: 10절)
 */
export function useHojSubmissions(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: hojKeys.feed(filters),
    queryFn: ({ pageParam }) => apiFetch<HojSubmissionFeed>(feedPath(filters, pageParam)),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextBeforeId,
    refetchInterval: (query) =>
      (query.state.data?.pages ?? []).some((page) => page.items.some((item) => judging(item.judgeStatus))) ? 5000 : false,
  })
}

const judging = (status: JudgeStatus) => status === 'PENDING' || status === 'RUNNING'

/** 사용자 페이지 - 누구나 누구의 페이지든(이름·활동만). 없는 사용자 404 */
export function useHojUser(userId: number) {
  return useQuery({
    queryKey: hojKeys.user(userId),
    queryFn: () => apiFetch<HojUserPageResponse>(`/api/hoj/users/${userId}`),
    enabled: Number.isFinite(userId),
  })
}

/** 랭킹 - 푼 문제 수 기준, 분반을 주면 그 분반 소속만. 순위·동점 처리는 서버 값 그대로 */
export function useHojRanking(cohortId: number | null) {
  const query = cohortId === null ? '' : `?cohortId=${cohortId}`
  return useQuery({
    queryKey: hojKeys.ranking(cohortId),
    queryFn: () => apiFetch<HojRankingResponse>(`/api/hoj/ranking${query}`),
  })
}
