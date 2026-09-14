/**
 * 명단 붙여넣기 → loginId 목록. 줄바꿈·쉼표·세미콜론·공백 어느 것으로 구분해도 된다.
 * 빈 항목 제거, 중복은 첫 번째만(입력 순서 유지) - 서버도 중복을 한 번만 처리하지만 화면의 "n명" 표시가 정확해야 한다.
 */
export function parseLoginIds(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(/[\s,;]+/)) {
    const id = raw.trim()
    if (id && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}
