import { useNavigate } from 'react-router'
import { Archive, Users } from 'lucide-react'
import type { CohortResponse } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OperatorName } from './OperatorName'

/**
 * 홈의 분반 카드. 클릭하면 분반 페이지로.
 * 표시하는 값은 전부 서버 응답 그대로 - 내 배지(myTitle), 운영진(operators), 수강생 수(studentCount: STUDENT면 null이라 숨김).
 */
export function CohortCard({ cohort }: { cohort: CohortResponse }) {
  const navigate = useNavigate()
  const archived = cohort.status === 'ARCHIVED'

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`${cohort.name} 분반 페이지로 이동`}
      onClick={() => navigate(`/cohorts/${cohort.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/cohorts/${cohort.id}`)
        }
      }}
      className={
        'cursor-pointer transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ' +
        (archived ? 'opacity-80' : '')
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{cohort.name}</CardTitle>
          <Badge variant="secondary">{cohort.myTitle}</Badge>
          {archived && (
            <Badge variant="outline">
              <Archive data-icon="inline-start" />
              보관됨
            </Badge>
          )}
        </div>
        {cohort.description && <CardDescription>{cohort.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          운영진{' '}
          {cohort.operators.length === 0 ? (
            <span>없음</span>
          ) : (
            cohort.operators.map((op, i) => (
              <span key={op.id}>
                {i > 0 && ', '}
                <OperatorName operator={op} />
              </span>
            ))
          )}
        </span>
        {cohort.studentCount !== null && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            수강생 {cohort.studentCount}명
          </span>
        )}
        {cohort.canManage && <Badge variant="outline">운영 권한</Badge>}
      </CardContent>
    </Card>
  )
}
