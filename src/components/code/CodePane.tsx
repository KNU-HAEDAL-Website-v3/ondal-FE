import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { Check, Copy } from 'lucide-react'

/** 제출 언어 라벨 → CodeMirror 언어 확장. 매핑 없는 값은 하이라이팅 없이 표시 (submission/fe.md 2절) */
function languageExtensions(language: string | null): Extension[] {
  switch (language) {
    case 'C':
    case 'C++':
      return [cpp()]
    case 'Java':
      return [java()]
    case 'Python 3':
      return [python()]
    case 'JavaScript':
      return [javascript()]
    case 'TypeScript':
      return [javascript({ typescript: true })]
    default:
      return []
  }
}

/** 제출 폼 코드 탭의 편집기 - 줄번호·자동 들여쓰기·언어별 하이라이팅 (design.md 결정 17) */
export function CodeEditor({
  value,
  onChange,
  language,
}: {
  value: string
  onChange: (value: string) => void
  language: string | null
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={languageExtensions(language)}
      placeholder="코드를 붙여넣거나 작성하세요"
      height="224px"
      aria-label="제출 코드"
      className="overflow-hidden rounded-[2px] border font-mono text-sm [&_.cm-editor]:h-full [&_.cm-editor.cm-focused]:outline-none"
    />
  )
}

/** 코드 열람 - 같은 에디터의 read-only 모드(작성과 색 일관) + 복사 버튼 */
export function CodeViewer({ value, language }: { value: string; language: string | null }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard 권한이 없으면 조용히 무시 - 드래그 복사는 여전히 가능
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        aria-label="코드 복사"
        className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-[2px] border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground shadow-xs hover:text-primary"
      >
        {copied ? <Check className="size-3.5 text-[#16a34a]" /> : <Copy className="size-3.5" />}
        {copied ? '복사됨' : '복사'}
      </button>
      <CodeMirror
        value={value}
        readOnly
        editable={false}
        extensions={languageExtensions(language)}
        maxHeight="320px"
        aria-label="제출 코드 열람"
        basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false, foldGutter: false }}
        className="overflow-hidden rounded-[2px] border font-mono text-xs [&_.cm-editor.cm-focused]:outline-none"
      />
    </div>
  )
}
