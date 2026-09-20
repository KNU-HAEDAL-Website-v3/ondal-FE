import { useState } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { CodeEditor } from '@/components/code/CodePane'
import { Button } from '@/components/ui/button'
import { codeTemplate, isUntouched } from '@/lib/codeTemplates'
import { LANGUAGES } from '@/lib/languages'
import { cn } from '@/lib/utils'

/** 출제·수정 폼이 들고 있는 정답 코드 초안 - 언어당 1개, 저장 때 PUT /solutions 로 통째 교체 */
export interface SolutionDraft {
  language: string
  codeText: string
}

/**
 * 출제·수정 폼의 "정답 코드" 절 (HOJ P3, docs hoj/api.md 6절) - 언어 탭 + 편집기, 언어 추가/삭제.
 * 저장은 폼이 문제 → 채점 설정 → 정답 코드 순서로 부른다. 자동 채점 절의 "정답 코드로 채우기·검증" 상자(저장 안 함)와는 별개다 - 그쪽은 출제 도구, 여기는 보관.
 */
export function SolutionsSection({ draft, onChange, disabled }: { draft: SolutionDraft[]; onChange: (next: SolutionDraft[]) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = draft.find((s) => s.language === selected) ?? draft[0] ?? null
  const remaining = LANGUAGES.filter((lang) => !draft.some((s) => s.language === lang))

  const add = (language: string) => {
    if (language === '' || draft.some((s) => s.language === language)) return
    onChange([...draft, { language, codeText: codeTemplate(language) }])
    setSelected(language)
  }
  const remove = (language: string) => {
    const target = draft.find((s) => s.language === language)
    if (!target) return
    if (!isUntouched(target.codeText) && !window.confirm(`${language} 정답 코드를 지울까요? 저장하면 서버에서도 지워져요.`)) return
    const next = draft.filter((s) => s.language !== language)
    onChange(next)
    setSelected(next[0]?.language ?? null)
  }
  const update = (language: string, codeText: string) => onChange(draft.map((s) => (s.language === language ? { ...s, codeText } : s)))

  return (
    <section aria-label="정답 코드" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <KeyRound className="size-4 text-primary" aria-hidden />
          정답 코드 (참고 풀이)
        </h2>
        <p className="text-xs text-muted-foreground">운영진에게만 보여요. 언어별로 하나씩, 최대 {LANGUAGES.length}개. 학생에게는 존재도 보이지 않아요.</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="정답 코드 언어">
          {draft.map((s) => {
            const isActive = active?.language === s.language
            return (
              <button
                key={s.language}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelected(s.language)}
                disabled={disabled}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  isActive ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                  s.codeText.trim() === '' && 'border-dashed',
                )}
              >
                {s.language}
              </button>
            )
          })}
          {remaining.length > 0 && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Plus className="size-3.5" aria-hidden />
              <select value="" onChange={(e) => add(e.target.value)} disabled={disabled} aria-label="정답 코드 언어 추가" className="h-7 rounded-md border bg-card px-1.5 text-xs text-foreground">
                <option value="">언어 추가</option>
                {remaining.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {active === null ? (
          <p className="text-sm text-muted-foreground">아직 정답 코드가 없어요. 언어를 추가하고 코드를 붙여 넣으면 저장할 때 함께 올라가요.</p>
        ) : (
          <div role="tabpanel" className="space-y-2">
            <CodeEditor value={active.codeText} onChange={(code) => update(active.language, code)} language={active.language} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {active.codeText.trim() === '' ? '비어 있는 언어는 저장하지 않아요.' : `${active.language} 정답 코드 - 저장하면 이 언어의 기존 코드를 대체해요.`}
              </p>
              <Button type="button" variant="ghost" size="xs" className="text-destructive" onClick={() => remove(active.language)} disabled={disabled}>
                <Trash2 data-icon="inline-start" />
                {active.language} 삭제
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
