import { Link } from 'react-router'
import { Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ApiErrorView'

/**
 * 문제 - 온라인 저지 문제 모음은 P3(공개 문제 풀·리더보드, docs mvp-scope.md 5절). 지금은 모든 문제가 과제로 배정되므로 과제 페이지로 안내한다.
 * 견본 데이터(가짜 정답률·판정)는 두지 않는다 - 실사용 화면에 없는 기능이 있는 것처럼 보이지 않게.
 */
export default function ProblemsPage() {
  return (
    <div className="space-y-6">
      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">문제</h1>
        <p className="mt-1 text-sm text-muted-foreground">공개 문제 모음 · 자동 채점 · 리더보드는 다음 단계(P3)에서 열립니다.</p>
      </header>
      <EmptyState
        icon={<Code className="size-8" />}
        title="지금은 과제에서 문제를 풉니다"
        description="분반에 배정된 문제는 과제 페이지에서 차시별로 볼 수 있어요. 문제 번호(#1000~)는 그대로 이어집니다."
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/assignments">과제 페이지로</Link>
        </Button>
      </EmptyState>
    </div>
  )
}
