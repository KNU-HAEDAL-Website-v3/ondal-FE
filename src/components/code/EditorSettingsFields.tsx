import { useSyncExternalStore } from 'react'
import { Label } from '@/components/ui/label'
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  TAB_SIZES,
  getEditorSettings,
  setEditorSettings,
  subscribeEditorSettings,
} from '@/lib/editorSettings'
import { cn } from '@/lib/utils'

/**
 * 마이페이지 "편집기 설정" - 글꼴 크기(12~20px)·탭 폭(2/4). 이 브라우저에만 저장되고(lib/editorSettings) 화면의 모든 편집기·열람 뷰에 바로 적용된다.
 * CodeMirror 를 끌어오지 않으므로 테마 갤러리와 달리 지연 로딩이 필요 없다.
 */
export function EditorSettingsFields() {
  const settings = useSyncExternalStore(subscribeEditorSettings, getEditorSettings, getEditorSettings)
  const sizes = Array.from({ length: FONT_SIZE_MAX - FONT_SIZE_MIN + 1 }, (_, i) => FONT_SIZE_MIN + i)
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="editor-font-size">글꼴 크기</Label>
        <div className="flex items-center gap-2">
          <select
            id="editor-font-size"
            value={settings.fontSize}
            onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
            className="h-8 rounded-lg border bg-card px-2 text-sm"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
          <span className="font-mono text-muted-foreground" style={{ fontSize: `${settings.fontSize}px` }} aria-hidden>
            int main()
          </span>
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">탭 폭</legend>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="탭 폭">
          {TAB_SIZES.map((size) => {
            const selected = settings.tabSize === size
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setEditorSettings({ tabSize: size })}
                className={cn(
                  'rounded-md border px-3 py-1 text-xs transition-colors',
                  selected ? 'border-primary bg-secondary font-semibold text-primary' : 'hover:bg-secondary/50',
                )}
              >
                {size}칸
              </button>
            )
          })}
        </div>
      </fieldset>
      <p className="basis-full text-xs text-muted-foreground">탭 문자의 표시 폭과 Enter 뒤 자동 들여쓰기 단위가 함께 바뀌어요. 이 브라우저에만 저장돼요.</p>
    </div>
  )
}
