/// <reference types="vite/client" />

// import.meta.env.VITE_* 타입. 값은 .env.example 참고.
interface ImportMetaEnv {
  /** API 서버 주소. 비우면 같은 origin(개발은 vite 프록시 /api → :8080) */
  readonly VITE_API_BASE_URL?: string
  /** 'true'면 MSW mock 서버 사용 - 백엔드 없이 화면 미리보기용 */
  readonly VITE_API_MOCK?: string
}
