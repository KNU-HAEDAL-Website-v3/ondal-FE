/**
 * Ondal 과 HOJ 는 같은 코드베이스에서 나오는 **두 개의 앱**이다 (2026-09-15 PM 결정).
 *
 * - Ondal(ondal.…): 부트캠프 과제 제출·관리 - 분반·과제·출석·공지·Q&A
 * - HOJ(hoj.…): 문제 은행 - 문제 풀이·출제·태그. 추후 자체 프로그래밍 대회
 *
 * 성격이 달라 화면을 나눴지만 **백엔드는 하나**다 - 채점·사용자·세션을 두 벌로 만들지 않는다 (BE CLAUDE.md 원칙 1).
 * 어느 앱으로 빌드할지는 VITE_APP 이 정하고, 서로를 가리키는 링크는 VITE_ONDAL_URL·VITE_HOJ_URL 로 받는다.
 *
 * ※ 주소가 비어 있으면(분리 배포 전) 같은 출처의 경로로 떨어뜨린다 - HOJ 서브도메인이 생기기 전에도 화면이 끊기지 않게.
 */

export type AppId = 'ondal' | 'hoj'

export const APP: AppId = import.meta.env.VITE_APP === 'hoj' ? 'hoj' : 'ondal'

export const IS_HOJ = APP === 'hoj'

const HOJ_URL = (import.meta.env.VITE_HOJ_URL ?? '').replace(/\/$/, '')
const ONDAL_URL = (import.meta.env.VITE_ONDAL_URL ?? '').replace(/\/$/, '')

/** HOJ 가 다른 출처에 따로 떠 있는가 - 링크를 새 탭으로 열지 판단한다 */
export const HOJ_IS_SEPARATE = HOJ_URL !== ''

/** HOJ 문제 목록 주소. 분리 전에는 같은 앱의 /problems */
export function hojHref(path = '/problems'): string {
  return HOJ_URL === '' ? path : `${HOJ_URL}${path}`
}

/** Ondal 주소. HOJ 앱에서 "Ondal 로 돌아가기" 에 쓴다 */
export function ondalHref(path = '/'): string {
  return ONDAL_URL === '' ? path : `${ONDAL_URL}${path}`
}

/**
 * 다른 앱으로 가는 링크에 붙일 속성 - 분리돼 있으면 새 탭.
 * 같은 앱 안이면 react-router 의 Link 를 쓰면 되므로 이 속성은 비어 있다.
 */
export function crossAppLinkProps(separate: boolean) {
  return separate ? ({ target: '_blank', rel: 'noopener noreferrer' } as const) : ({} as const)
}
