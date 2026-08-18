import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 개발 중 /api 요청은 로컬 백엔드(:8080)로 넘긴다 — 같은 origin이라 CORS·쿠키 문제 없음.
    // 백엔드 없이 화면만 볼 때는 `npm run dev:mock` (MSW).
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
})
