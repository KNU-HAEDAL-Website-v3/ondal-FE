import { useState } from 'react'
import { Link } from 'react-router'
import { Pencil } from 'lucide-react'
import { useProblemSolutions } from '@/api/problems'
import { ApiErrorView } from '@/components/ApiErrorView'
import { CodeViewer } from '@/components/code/CodePane'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * "정답 코드 보기" 창 (HOJ P3, docs hoj/api.md 6절) - 운영진 이상만. 언어 탭 + 열람 뷰. 고치는 건 문제 수정 폼에서.
 * 열 때 GET /solutions 를 부른다 - 상세 응답의 solutionLanguages 는 존재 여부(버튼 표시)용일 뿐 코드는 여기서 받는다.
 */
export function SolutionsDialog({ problemId, open, onOpenChange }: { problemId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useProblemSolutions(problemId, open)
  const [selected, setSelected] = useState<string | null>(null)
  const solutions = query.data ?? []
  const active = solutions.find((s) => s.language === selected) ?? solutions[0] ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>정답 코드</DialogTitle>
          <DialogDescription>운영진에게만 보이는 참고 풀이예요. 채점 설정·질문 답변 때 참고하세요 - 학생에게는 존재도 보이지 않아요.</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">정답 코드 불러오는 중...</p>
        ) : query.error ? (
          <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
        ) : solutions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">등록된 정답 코드가 없어요. 문제 수정에서 추가할 수 있어요.</p>
        ) : (
          <div className="min-h-0 space-y-2 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="정답 코드 언어">
              {solutions.map((s) => {
                const isActive = active?.language === s.language
                return (
                  <button
                    key={s.language}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelected(s.language)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      isActive ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                    )}
                  >
                    {s.language}
                  </button>
                )
              })}
            </div>
            {active && (
              <div role="tabpanel" className="space-y-1.5">
                <CodeViewer value={active.codeText} language={active.language} />
                <p className="text-xs text-muted-foreground">
                  마지막 수정 {active.updatedBy.name} · {formatKst(active.updatedAt)}
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/problems/${problemId}/edit`}>
              <Pencil data-icon="inline-start" />
              문제 수정에서 고치기
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
