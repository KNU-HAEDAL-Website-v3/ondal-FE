import { Navigate, useNavigate } from 'react-router'
import { MessagesSquare } from 'lucide-react'
import { useMe } from '@/api/auth'
import { useCohorts, useMyCohorts } from '@/api/cohorts'
import type { CohortResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'

import { isAdminRole } from '@/lib/roles'
/**
 * Q&A 진입 - /questions. 사이드바에서 들어오는 분반 선택 화면 (2026-09-15).
 * Q&A 자체는 분반 스코프(/cohorts/:cohortId/questions)라 먼저 분반을 고르게 하고, 고르면 그 분반 목록으로 넘긴다.
 * - 선택지: 관리자 = 진행 중 분반 전부(전역 ADMIN 은 어느 분반이든 열람 통과) / 그 외 = 내 소속 분반
 * - 분반이 하나뿐이면 고를 게 없으므로 바로 넘긴다 (뒤로 가기에 남지 않도록 replace)
 */
export default function QuestionsEntryPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const isAdmin = isAdminRole(me?.globalRole)
  const myCohortsQuery = useMyCohorts()
  const adminCohortsQuery = useCohorts('ACTIVE', isAdmin)

  if (myCohortsQuery.isPending) return <LoadingScreen label="분반 목록 불러오는 중..." />
  if (myCohortsQuery.error) return <ApiErrorView error={myCohortsQuery.error} onRetry={() => void myCohortsQuery.refetch()} />
  if (isAdmin && adminCohortsQuery.isPending) return <LoadingScreen label="분반 목록 불러오는 중..." />
  if (isAdmin && adminCohortsQuery.error) {
    return <ApiErrorView error={adminCohortsQuery.error} onRetry={() => void adminCohortsQuery.refetch()} />
  }

  const options = isAdmin ? (adminCohortsQuery.data ?? []) : myCohortsQuery.data
  if (options.length === 1) return <Navigate to={`/cohorts/${options[0].id}/questions`} replace />

  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">Q&amp;A</h1>
        <p className="mt-1 text-sm text-muted-foreground">분반별 질문 게시판이에요. 먼저 분반을 고르세요.</p>
      </header>

      {options.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="size-8" />}
          title="아직 소속된 분반이 없어요"
          description="분반에 배정되면 그 분반의 Q&A 를 쓸 수 있어요. 운영진에게 배정을 요청하세요."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {options.map((cohort) => (
            <li key={cohort.id}>
              <CohortCard cohort={cohort} onSelect={() => navigate(`/cohorts/${cohort.id}/questions`)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CohortCard({ cohort, onSelect }: { cohort: CohortResponse; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-secondary/50"
    >
      <span className="flex items-center gap-2">
        <span className="font-bold">{cohort.name}</span>
        {cohort.status === 'ARCHIVED' && <Badge variant="outline">보관</Badge>}
      </span>
      {cohort.description && <span className="line-clamp-2 text-sm text-muted-foreground">{cohort.description}</span>}
      <span className="mt-auto text-xs text-muted-foreground">
        {cohort.status === 'ARCHIVED' ? '열람만 가능해요' : '질문하고 답변할 수 있어요'}
      </span>
    </button>
  )
}
