/** 제출 언어 6종 - BE ondal.judge.languages 의 키와 같은 문자열 (judge/design.md 결정 7). 출제 폼의 허용 언어 선택지도 이 목록 */
export const LANGUAGES = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript'] as const

/** 문제에 허용 언어가 걸려 있으면 그 언어만, 없으면 전부 */
export function selectableLanguages(allowed: readonly string[] | undefined): readonly string[] {
  return allowed && allowed.length > 0 ? LANGUAGES.filter((lang) => allowed.includes(lang)) : LANGUAGES
}
