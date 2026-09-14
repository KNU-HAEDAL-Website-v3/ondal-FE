import { Gavel } from 'lucide-react'
import { useJudgeSamples } from '@/api/judge'
import { SampleCases } from '@/components/judge/SampleCases'

/**
 * 학생 과제 상세의 자동 채점 절 (docs judge/fe.md 2절) - 제한 + 공개 케이스 예시(#50). judgeEnabled 인 과제에서만 그린다.
 * 조회 실패는 과제 상세를 막지 않는다 - 예시만 빠진다.
 */
export function JudgeSamplesSection({ cohortId, assignmentId }: { cohortId: number; assignmentId: number }) {
  const query = useJudgeSamples(cohortId, assignmentId, true)
  if (query.isPending) return <p className="text-sm text-muted-foreground">예시를 불러오는 중...</p>
  if (query.error || !query.data.enabled) return null
  const data = query.data
  return (
    <section aria-label="자동 채점 안내" className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-[0.55px] text-muted-foreground">
          <Gavel className="size-3.5" />
          자동 채점 문제
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          시간 {data.timeLimitMs} ms · 메모리 {data.memoryLimitMb} MB
        </span>
        <span className="text-xs text-muted-foreground">언어: {data.languages.join(', ')}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        코드로 제출하면 아래 예시를 포함한 테스트케이스로 자동 채점돼요. 출력은 줄 끝 공백과 마지막 빈 줄을 무시하고 비교합니다.
      </p>
      <div className="mt-3">
        <SampleCases samples={data.samples} emptyText="공개된 예시가 없어요. 문제 설명을 참고해 주세요." />
      </div>
    </section>
  )
}
