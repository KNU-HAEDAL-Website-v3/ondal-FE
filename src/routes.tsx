import { Route, Routes } from 'react-router'
import { RequireAuth } from '@/components/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import AssignmentDetailPage from '@/pages/AssignmentDetailPage'
import AssignmentsPage from '@/pages/AssignmentsPage'
import AttendancePage from '@/pages/AttendancePage'
import CohortPage from '@/pages/CohortPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import MyCohortsPage from '@/pages/MyCohortsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import NoticesPage from '@/pages/NoticesPage'
import ProblemsPage from '@/pages/ProblemsPage'
import SubmissionsPage from '@/pages/SubmissionsPage'

/**
 * 라우트 한눈에 보기.
 *   /login                     - 공개
 *   /                          - 홈 대시보드 (역할별: 수강자 / 교육운영진)
 *   /attendance                - 출석 (역할별: 출석 현황 / 출결 관리)
 *   /problems                  - 문제 목록
 *   /assignments               - 과제 목록
 *   /assignments/:assignmentId - 과제 상세
 *   /submissions               - 제출 이력
 *   /cohorts                   - 내 수업 (분반 목록)
 *   /cohorts/:cohortId         - 분반 페이지 (비소속은 서버 403 → 홈)
 *   /notices                   - 공지사항 (역할별: 목록 / 관리)
 *   *                          - 404
 * 로그인 필요 화면은 RequireAuth(울타리) → AppShell(사이드바+상단 바) 아래에 둔다.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="cohorts" element={<MyCohortsPage />} />
          <Route path="cohorts/:cohortId" element={<CohortPage />} />
          <Route path="notices" element={<NoticesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
