/// <reference types="vite/client" />

// import.meta.env.VITE_* 타입. 값은 .env.example 참고.
interface ImportMetaEnv {
  /** API 서버 주소. 비우면 같은 origin(개발은 vite 프록시 /api → :8080). oidc 모드는 절대 주소 필수 - 로그인이 브라우저 이동이라 프록시로는 안 됨 */
  readonly VITE_API_BASE_URL?: string
  /** 'true'면 MSW mock 서버 사용 - 백엔드 없이 화면 미리보기용 */
  readonly VITE_API_MOCK?: string
  /** 로그인 방식 - 'stub'(기본: 아이디 폼, local BE·mock) | 'oidc'(홈페이지 Keycloak 로그인 버튼, 운영 빌드). api/auth.ts AUTH_MODE */
  readonly VITE_AUTH_MODE?: string
  /** 어느 앱으로 빌드할지 - 'ondal'(기본: 과제 플랫폼) | 'hoj'(문제 은행). lib/apps.ts */
  readonly VITE_APP?: string
  /** HOJ 가 따로 떠 있는 주소. 비면 분리 전으로 보고 같은 앱의 /problems 로 링크한다 */
  readonly VITE_HOJ_URL?: string
  /** Ondal 주소 - HOJ 앱에서 "Ondal 로" 링크에 쓴다 */
  readonly VITE_ONDAL_URL?: string
}
