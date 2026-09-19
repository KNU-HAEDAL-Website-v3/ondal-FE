/**
 * Ondal(과제 플랫폼)과 HOJ(문제 은행)는 **같은 앱 안의 두 모드**다 (2026-09-19 PM 결정 - docs 결정 9, 별도 앱 분리(결정 8)는 철회).
 *
 * - 주소는 하나: `/problems/*`·`/admin/tags` 가 HOJ 모드, 나머지가 Ondal 모드 (routes.tsx 가 셸을 나눈다)
 * - 다른 것은 셸(메뉴)뿐: Ondal 은 좌측 사이드바(AppShell), HOJ 는 상단 가로 메뉴(HojShell)
 * - 서로 오가는 버튼(AppSwitchButton)은 확인 팝업을 거치고, 돌아올 때는 그 모드에서 **마지막에 보던 화면**으로 간다
 *
 * 마지막 화면은 탭 단위(sessionStorage)로 기억한다 - 다른 탭·다음 방문에는 영향 없음.
 */
export type AppMode = 'ondal' | 'hoj'

export const MODE_LABEL: Record<AppMode, string> = {
  ondal: 'Ondal(과제)',
  hoj: 'HOJ(문제 은행)',
}

/** 기억된 화면이 없을 때 가는 곳 */
export const MODE_HOME: Record<AppMode, string> = {
  ondal: '/',
  hoj: '/problems',
}

const HOJ_PATH = /^\/(problems|admin\/tags)(\/|$)/

export function modeOf(pathname: string): AppMode {
  return HOJ_PATH.test(pathname) ? 'hoj' : 'ondal'
}

const storageKey = (mode: AppMode) => `ondal-last-path:${mode}`

/** 셸이 경로가 바뀔 때마다 부른다 - 이 모드에서 마지막으로 본 화면 */
export function rememberPath(mode: AppMode, path: string) {
  try {
    sessionStorage.setItem(storageKey(mode), path)
  } catch {
    // 저장소를 못 쓰는 환경(시크릿 창 제한 등) - 기억 못 해도 동작에는 지장 없다
  }
}

/** 이 모드로 건너갈 때 갈 곳 - 기억된 화면, 없으면 그 모드의 홈 */
export function lastPath(mode: AppMode): string {
  try {
    const saved = sessionStorage.getItem(storageKey(mode))
    if (saved && modeOf(saved) === mode) return saved
  } catch {
    // 위와 같다
  }
  return MODE_HOME[mode]
}
