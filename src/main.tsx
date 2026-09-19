import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { meQueryKey } from '@/api/auth'
import { setPendingHandler, setUnauthenticatedHandler } from '@/api/client'
import type { UserResponse } from '@/api/types'
import { queryClient } from '@/lib/queryClient'
import { AppRoutes } from '@/routes'
import './index.css'

// 세션 만료(401)를 어디서 받든 me를 null로 → RequireAuth가 로그인 화면으로 보낸다 (returnTo 포함)
setUnauthenticatedHandler(() => queryClient.setQueryData(meQueryKey, null))
// 승인 대기(403 USER_PENDING)를 어디서 받든 me.status 를 PENDING 으로 → RequireAuth 가 대기 화면을 그린다 (docs 결정 10)
setPendingHandler(() =>
  queryClient.setQueryData<UserResponse | null>(meQueryKey, (me) => (me ? { ...me, status: 'PENDING' } : me)),
)

/** VITE_API_MOCK=true 면 MSW mock 서버를 먼저 띄운다 - 백엔드 없이 화면 미리보기(Cloudflare Pages)용 */
async function enableMocking() {
  if (import.meta.env.VITE_API_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
