// 작성 중인 폼 내용을 이 탭(sessionStorage)에 임시 저장 - 세션 만료(401)로 로그인 화면에 다녀와도 입력이 남는다 (CLAUDE.md 규칙 1).
// 키는 화면·대상 단위로 호출자가 정한다 (예: ondal-question-draft:1:new). 저장 불가(용량·비공개 모드)면 조용히 넘어간다 - 폼 동작에는 영향 없음.

export function readDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeDraft<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 무시
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 무시
  }
}
