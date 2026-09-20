// 코드 편집기 설정(글꼴 크기·탭 폭) - 테마(lib/editorTheme)와 같은 방식: 보는 사람 취향이라 이 브라우저에만 저장하고
// 한 곳에서 바꾸면 화면의 모든 편집기(제출 폼·정답 코드·열람 뷰)가 같이 바뀌도록 작은 스토어로 둔다 (HOJ P3, 마이페이지 "편집기 설정").

export interface EditorSettings {
  /** px - 12~20 */
  fontSize: number
  /** 스페이스 수 - 2 또는 4. 탭 문자 표시 폭과 자동 들여쓰기 단위 둘 다 */
  tabSize: 2 | 4
}

export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 20
export const TAB_SIZES = [2, 4] as const
export const DEFAULT_EDITOR_SETTINGS: EditorSettings = { fontSize: 14, tabSize: 4 }

const STORAGE_KEY = 'ondal-editor-settings'

function sanitize(raw: unknown): EditorSettings {
  const value = (raw ?? {}) as Partial<Record<keyof EditorSettings, unknown>>
  const fontSize = Number(value.fontSize)
  const tabSize = Number(value.tabSize)
  return {
    fontSize: Number.isInteger(fontSize) && fontSize >= FONT_SIZE_MIN && fontSize <= FONT_SIZE_MAX ? fontSize : DEFAULT_EDITOR_SETTINGS.fontSize,
    tabSize: tabSize === 2 || tabSize === 4 ? tabSize : DEFAULT_EDITOR_SETTINGS.tabSize,
  }
}

function readStored(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? DEFAULT_EDITOR_SETTINGS : sanitize(JSON.parse(raw))
  } catch {
    // 비공개 모드·저장소 차단·깨진 값 - 기본값으로 동작하면 된다
    return DEFAULT_EDITOR_SETTINGS
  }
}

let current: EditorSettings = readStored()
const listeners = new Set<() => void>()

export function getEditorSettings(): EditorSettings {
  return current
}

export function setEditorSettings(patch: Partial<EditorSettings>): void {
  const next = sanitize({ ...current, ...patch })
  if (next.fontSize === current.fontSize && next.tabSize === current.tabSize) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 저장만 실패 - 이번 방문 동안은 적용된다
  }
  listeners.forEach((listener) => listener())
}

export function subscribeEditorSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
