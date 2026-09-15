// 코드 에디터 테마 - 보는 사람 취향이라 이 브라우저에만 저장(localStorage)하고 서버로 보내지 않는다.
// 한 화면에 에디터가 여러 개(제출 폼·정답 코드·열람 뷰) 떠 있으므로, 한 곳에서 바꾸면 모두 같이 바뀌도록 작은 스토어로 둔다.

export type EditorThemeId = 'default' | 'githubLight' | 'oneDark' | 'dracula' | 'solarizedLight'

export const EDITOR_THEMES: { id: EditorThemeId; label: string }[] = [
  { id: 'default', label: '기본' },
  { id: 'githubLight', label: 'GitHub Light' },
  { id: 'oneDark', label: 'One Dark' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'solarizedLight', label: 'Solarized Light' },
]

const STORAGE_KEY = 'ondal-editor-theme'
const VALID_IDS = new Set<string>(EDITOR_THEMES.map((theme) => theme.id))

function readStored(): EditorThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw !== null && VALID_IDS.has(raw) ? (raw as EditorThemeId) : 'default'
  } catch {
    // 비공개 모드·저장소 차단 - 기본값으로 동작하면 된다
    return 'default'
  }
}

let current: EditorThemeId = readStored()
const listeners = new Set<() => void>()

export function getEditorTheme(): EditorThemeId {
  return current
}

export function setEditorTheme(id: EditorThemeId): void {
  if (id === current) return
  current = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // 저장만 실패 - 이번 방문 동안은 적용된다
  }
  listeners.forEach((listener) => listener())
}

export function subscribeEditorTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
