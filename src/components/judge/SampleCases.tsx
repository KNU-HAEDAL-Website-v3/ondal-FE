import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export interface SampleCase {
  position: number
  input: string
  expectedOutput: string
}

/**
 * 예시 입력/출력 블록 (docs judge/design.md 결정 10) - 학생 과제 상세와 출제 미리보기가 공용.
 * 공개 케이스가 곧 예시 - 운영진이 설명에 예시를 따로 적을 필요가 없다.
 */
export function SampleCases({ samples, emptyText }: { samples: SampleCase[]; emptyText?: string }) {
  if (samples.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText ?? '공개된 예시가 없어요.'}</p>
  }
  return (
    <div className="space-y-3">
      {samples.map((s, index) => (
        <div key={s.position} className="grid gap-2 sm:grid-cols-2" data-sample-position={s.position}>
          <SampleBlock label={`예시 입력 ${index + 1}`} value={s.input} />
          <SampleBlock label={`예시 출력 ${index + 1}`} value={s.expectedOutput} />
        </div>
      ))}
    </div>
  )
}

function SampleBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // 클립보드 불가(권한·비보안 컨텍스트) - 조용히 넘어간다
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`${label} 복사`}
          className="flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-primary"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="mt-0.5 min-h-10 overflow-auto rounded-lg border bg-muted p-2 font-mono text-sm leading-5 whitespace-pre-wrap">
        {value === '' ? <span className="text-muted-foreground">(입력 없음)</span> : value}
      </pre>
    </div>
  )
}
