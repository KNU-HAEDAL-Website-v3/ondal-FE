import { Route, Routes } from 'react-router'
import { RequireAdmin } from '@/components/RequireAdmin'
import { RequireAuth } from '@/components/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import AdminCohortsPage from '@/pages/AdminCohortsPage'
import AssignmentDetailPage from '@/pages/AssignmentDetailPage'
import AssignmentFormPage from '@/pages/AssignmentFormPage'
import AssignmentsPage from '@/pages/AssignmentsPage'
import AttendancePage from '@/pages/AttendancePage'
import HelpPage from '@/pages/HelpPage'
import CohortFormPage from '@/pages/CohortFormPage'
import CohortMembersPage from '@/pages/CohortMembersPage'
import CohortPage from '@/pages/CohortPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import MyCohortsPage from '@/pages/MyCohortsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import NoticeDetailPage from '@/pages/NoticeDetailPage'
import NoticeFormPage from '@/pages/NoticeFormPage'
import NoticesPage from '@/pages/NoticesPage'
import ProblemsPage from '@/pages/ProblemsPage'
import QuestionDetailPage from '@/pages/QuestionDetailPage'
import QuestionFormPage from '@/pages/QuestionFormPage'
import QuestionsPage from '@/pages/QuestionsPage'

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
 *   /cohorts/:cohortId/members - 명부·수강생 배정 (운영진 이상·관리자, 학생은 서버 403 → 홈)
 *   /admin/cohorts             - [관리자] 분반 관리 - 목록·보관 (?status=ARCHIVED 보관함)
 *   /admin/cohorts/new         - [관리자] 분반 만들기 (+운영진 지정)
 *   /admin/cohorts/:cohortId/edit - [관리자] 분반 수정 (이름·설명)
 *   /cohorts/:cohortId/questions                  - Q&A 질문 목록 (분반 소속 누구나)
 *   /cohorts/:cohortId/questions/new              - 질문 등록
 *   /cohorts/:cohortId/questions/:questionId      - 질문 상세 (수정·삭제 버튼은 서버 canEdit·canDelete)
 *   /cohorts/:cohortId/questions/:questionId/edit - 질문 수정 (작성자)
 *   /notices                   - 공지사항 목록 (서버 가시성: 전체 + 소속 분반, 관리자 전부). 작성 버튼은 관리자·운영진
 *   /notices/new               - 공지 작성 (?cohort= 대상 프리셀렉트) - 전체 공지는 관리자, 분반 공지는 그 분반 운영진 이상
 *   /notices/:noticeId         - 공지 상세 (수정·삭제 버튼은 서버 canEdit·canDelete)
 *   /notices/:noticeId/edit    - 공지 수정 (대상 고정)
 *   /help                      - 도움말 (역할별 할 수 있는 일·문제 보고 방법) - 사이드바·상단 아이콘에서 진입
 *   *                          - 404
 * 로그인 필요 화면은 RequireAuth(울타리) → AppShell(사이드바+상단 바) 아래에, 관리자 화면은 그 안의 RequireAdmin 아래에 둔다.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="assignments/new" element={<AssignmentFormPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
          <Route path="assignments/:assignmentId/edit" element={<AssignmentFormPage />} />
          {/* /submissions(분반 전체 제출 기록)는 P2 이연 - 채점 결과 중심 화면 (docs submission/design.md 결정 8) */}
          <Route path="cohorts" element={<MyCohortsPage />} />
          <Route path="cohorts/:cohortId" element={<CohortPage />} />
          <Route path="cohorts/:cohortId/members" element={<CohortMembersPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin/cohorts" element={<AdminCohortsPage />} />
            <Route path="admin/cohorts/new" element={<CohortFormPage />} />
            <Route path="admin/cohorts/:cohortId/edit" element={<CohortFormPage />} />
          </Route>
          <Route path="cohorts/:cohortId/questions" element={<QuestionsPage />} />
          <Route path="cohorts/:cohortId/questions/new" element={<QuestionFormPage />} />
          <Route path="cohorts/:cohortId/questions/:questionId" element={<QuestionDetailPage />} />
          <Route path="cohorts/:cohortId/questions/:questionId/edit" element={<QuestionFormPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="notices/new" element={<NoticeFormPage />} />
          <Route path="notices/:noticeId" element={<NoticeDetailPage />} />
          <Route path="notices/:noticeId/edit" element={<NoticeFormPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
