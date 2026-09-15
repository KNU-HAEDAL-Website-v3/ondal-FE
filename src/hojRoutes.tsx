import { Navigate, Route, Routes } from 'react-router'
import { RequireAdmin } from '@/components/RequireAdmin'
import { RequireAuth } from '@/components/RequireAuth'
import { RequireOperator } from '@/components/RequireOperator'
import { HojShell } from '@/components/layout/HojShell'
import AdminTagsPage from '@/pages/AdminTagsPage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProblemDetailPage from '@/pages/ProblemDetailPage'
import ProblemFormPage from '@/pages/ProblemFormPage'
import ProblemsPage from '@/pages/ProblemsPage'

/**
 * HOJ 앱의 라우트 (VITE_APP=hoj 빌드) - 문제 은행·풀이·출제만 담는다.
 *
 *   /                          - /problems 로
 *   /login                     - 공개
 *   /problems                  - 문제 목록 (로그인 누구나)
 *   /problems/:problemId       - 문제 상세 - 본문·예시·풀이 제출·내 기록
 *   /problems/new              - 문제 출제 (RequireOperator)
 *   /problems/:problemId/edit  - 문제 수정 (RequireOperator)
 *   /admin/tags                - [관리자] 태그 관리 - 태그는 문제의 것이라 Ondal 이 아니라 여기 있다
 *   *                          - 404
 *
 * 경로를 Ondal 과 같게(/problems/…) 둔 이유: 두 앱이 같은 페이지 컴포넌트를 공유하므로
 * 내부 링크(to="/problems/3")가 양쪽에서 그대로 동작한다. 분리 배포 전후로 링크를 고칠 일이 없다.
 */
export function HojRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<HojShell />}>
          <Route index element={<Navigate to="/problems" replace />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="problems/:problemId" element={<ProblemDetailPage />} />
          <Route element={<RequireOperator />}>
            <Route path="problems/new" element={<ProblemFormPage />} />
            <Route path="problems/:problemId/edit" element={<ProblemFormPage />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="admin/tags" element={<AdminTagsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
