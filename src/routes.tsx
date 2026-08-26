import { Route, Routes } from 'react-router'
import { RequireAuth } from '@/components/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import AssignmentDetailPage from '@/pages/AssignmentDetailPage'
import AssignmentFormPage from '@/pages/AssignmentFormPage'
import AssignmentsPage from '@/pages/AssignmentsPage'
import AttendancePage from '@/pages/AttendancePage'
import CohortPage from '@/pages/CohortPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import MyCohortsPage from '@/pages/MyCohortsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import NoticesPage from '@/pages/NoticesPage'
import ProblemsPage from '@/pages/ProblemsPage'

/**
 * 라우트 한눈에 보기.
 *   /login                     - 공개
 *   /                          - 홈 대시보드 (역할별: 수강자 / 교육운영진)
 *   /attendance                - 출석 (역할별: 출석 현황 / 출결 관리)
 *   /problems                  - 문제 목록
 *   /assignments               - 과제 목록 (?cohort= 분반 선택, 기본 내 첫 분반)
 *   /assignments/new           - 과제 등록 (운영진, ?cohort= 필수)
 *   /assignments/:assignmentId - 과제 상세 (?cohort=) - 제출란·내 기록·현황판(운영진) 포함
 *   /assignments/:assignmentId/edit - 과제 수정 (운영진)
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
          <Route path="assignments/new" element={<AssignmentFormPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
          <Route path="assignments/:assignmentId/edit" element={<AssignmentFormPage />} />
          {/* /submissions(분반 전체 제출 기록)는 P2 이연 - 채점 결과 중심 화면 (docs submission/design.md 결정 8) */}
          <Route path="cohorts" element={<MyCohortsPage />} />
          <Route path="cohorts/:cohortId" element={<CohortPage />} />
          <Route path="notices" element={<NoticesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
