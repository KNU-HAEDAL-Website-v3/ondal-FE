import { Route, Routes } from 'react-router'
import { RequireAuth } from '@/components/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import CohortPage from '@/pages/CohortPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * 라우트 한눈에 보기.
 *   /login                — 공개
 *   /                     — 홈 (로그인 필요)
 *   /cohorts/:cohortId    — 분반 페이지 (로그인 + 소속 필요, 비소속은 서버 403 → 홈)
 *   *                     — 404
 * 로그인 필요 화면은 RequireAuth(울타리) → AppShell(상단 바) 아래에 둔다.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="cohorts/:cohortId" element={<CohortPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
