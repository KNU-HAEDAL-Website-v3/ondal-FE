import { useState, useSyncExternalStore } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { dracula } from '@uiw/codemirror-theme-dracula'
import { githubLight } from '@uiw/codemirror-theme-github'
import { solarizedLight } from '@uiw/codemirror-theme-solarized'
import { Check, Copy, Palette } from 'lucide-react'
import {
  EDITOR_THEMES,
  getEditorTheme,
  setEditorTheme,
  subscribeEditorTheme,
  type EditorThemeId,
} from '@/lib/editorTheme'

/**
 * CodeMirror 실제 구현 - 무거운 의존성(에디터 본체·언어·테마)이 전부 여기 모여 있다.
 * 화면에서는 `CodePane` 의 지연 로딩 껍데기를 통해서만 쓴다 - 에디터가 없는 화면의 첫 로딩을 늦추지 않기 위해서다.
 */

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

/** 'default' 는 CodeMirror 기본 밝은 화면 - 테마 확장을 붙이지 않는다 */
function themeExtensions(theme: EditorThemeId): Extension[] {
  switch (theme) {
    case 'githubLight':
      return [githubLight]
    case 'oneDark':
      return [oneDark]
    case 'dracula':
      return [dracula]
    case 'solarizedLight':
      return [solarizedLight]
    default:
      return []
  }
}

/** 어느 에디터에서 바꾸든 화면의 모든 에디터가 같은 테마를 쓰게 한다 */
function useEditorTheme(): EditorThemeId {
  return useSyncExternalStore(subscribeEditorTheme, getEditorTheme, getEditorTheme)
}

/** 테마 고르기 - 이 브라우저에만 저장된다 */
function ThemePicker({ id }: { id: string }) {
  const theme = useEditorTheme()
  return (
    <span className="flex items-center gap-1">
      <Palette className="size-3.5 text-muted-foreground" aria-hidden />
      <label htmlFor={id} className="sr-only">
        에디터 테마
      </label>
      <select
        id={id}
        value={theme}
        onChange={(e) => setEditorTheme(e.target.value as EditorThemeId)}
        className="h-6 rounded-[2px] border bg-card px-1 text-xs text-muted-foreground"
      >
        {EDITOR_THEMES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}

/**
 * 제출 폼 코드 탭의 편집기 - 줄번호·자동 들여쓰기·언어별 하이라이팅 (design.md 결정 17).
 * Tab 키는 들여쓰기로 먹지 않는다(CodeMirror 기본) - 키보드만 쓰는 사람이 Tab 으로 폼을 빠져나갈 수 있어야 한다.
 */
export function CodeEditorImpl({
  value,
  onChange,
  language,
}: {
  value: string
  onChange: (value: string) => void
  language: string | null
}) {
  const theme = useEditorTheme()
  return (
    <div className="space-y-1">
      <div className="flex justify-end">
        <ThemePicker id="code-editor-theme" />
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={languageExtensions(language)}
        theme={themeExtensions(theme)[0]}
        placeholder="코드를 붙여넣거나 작성하세요"
        height="224px"
        aria-label="제출 코드"
        className="overflow-hidden rounded-[2px] border font-mono text-sm [&_.cm-content]:font-mono [&_.cm-gutters]:font-mono [&_.cm-editor]:h-full [&_.cm-editor.cm-focused]:outline-none"
      />
    </div>
  )
}

/** 코드 열람 - 같은 에디터의 read-only 모드(작성과 색 일관) + 복사 버튼 */
export function CodeViewerImpl({ value, language }: { value: string; language: string | null }) {
  const theme = useEditorTheme()
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
        theme={themeExtensions(theme)[0]}
        maxHeight="320px"
        aria-label="제출 코드 열람"
        basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false, foldGutter: false }}
        className="overflow-hidden rounded-[2px] border font-mono text-xs [&_.cm-content]:font-mono [&_.cm-gutters]:font-mono [&_.cm-editor.cm-focused]:outline-none"
      />
    </div>
  )
}
