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

  // 같은 코드베이스에서 두 앱이 나온다 (src/lib/apps.ts) - 배포 대상이 다르므로 산출 폴더도 나눈다.
  // Cloudflare Worker 는 각자 자기 dist 만 보면 되고, SPA fallback(index.html)도 각자 것을 쓴다
  const isHoj = (process.env.VITE_APP ?? env.VITE_APP) === 'hoj'

  // index.html 은 두 앱이 공유하므로 탭 제목만 빌드 때 갈아 끼운다.
  // 런타임(document.title)로 바꾸면 잠깐 반대 앱 이름이 보였다가 바뀐다 - 두 앱을 동시에 열어 두는 화면이라 헷갈린다
  const title = isHoj ? 'HOJ - 해달 온라인 저지' : 'Ondal - 해달 부트캠프 과제 플랫폼'

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'ondal-app-title',
        transformIndexHtml(html: string) {
          return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
        },
      },
    ],
    build: { outDir: isHoj ? 'dist-hoj' : 'dist' },
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
