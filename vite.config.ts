import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // oidc 로그인은 브라우저가 BE 주소로 직접 이동하므로 상대 경로(프록시)로는 동작하지 않는다 - 빌드 때 걸러 운영 사고 방지.
  // mock 은 값과 무관하게 stub 흐름이라 제외 (api/auth.ts AUTH_MODE)
  if (env.VITE_API_MOCK !== 'true' && env.VITE_AUTH_MODE === 'oidc' && !/^https?:\/\//.test(env.VITE_API_BASE_URL ?? '')) {
    throw new Error('VITE_AUTH_MODE=oidc 에는 VITE_API_BASE_URL 절대 주소(https://...)가 필요합니다 - .env.example 참고')
  }

  // 앱은 하나다 - HOJ(문제 은행)는 같은 빌드 안의 모드(라우트별 셸)라 별도 산출 폴더·탭 제목 치환이 없다 (src/lib/appSwitch.ts).
  // HOJ 화면의 탭 제목은 HojShell 이 런타임에 바꾼다
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 개발 중 /api 요청은 로컬 백엔드(:8080)로 넘긴다 - 같은 origin이라 CORS·쿠키 문제 없음.
      // 백엔드 없이 화면만 볼 때는 `npm run dev:mock` (MSW).
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: false },
      },
    },
  }
})
