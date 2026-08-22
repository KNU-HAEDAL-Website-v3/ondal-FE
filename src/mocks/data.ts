// mock 데이터 - BE LocalDataSeeder와 같은 내용을 유지한다 (계정·분반이 다르면 팀원이 혼란스럽다).
// 계정: admin(ADMIN) / operator1 / student1~3. 모르는 아이디로 로그인하면 MEMBER로 새로 만든다 (find-or-create).
// 분반: "2026-2 C언어"(ACTIVE: operator1 + student1~3), "2026-1 파이썬"(ARCHIVED: student1)

import type { CohortStatus, EnrollmentRole, GlobalRole } from '@/api/types'

export interface MockUser {
  id: number
  loginId: string
  name: string
  globalRole: GlobalRole
}

export interface MockCohort {
  id: number
  name: string
  description: string | null
  status: CohortStatus
  createdAt: string
}

export interface MockEnrollment {
  cohortId: number
  loginId: string
  role: EnrollmentRole
}

export const users: MockUser[] = [
  { id: 1, loginId: 'admin', name: '관리자', globalRole: 'ADMIN' },
  { id: 2, loginId: 'operator1', name: 'operator1', globalRole: 'MEMBER' },
  { id: 3, loginId: 'student1', name: 'student1', globalRole: 'MEMBER' },
  { id: 4, loginId: 'student2', name: 'student2', globalRole: 'MEMBER' },
  { id: 5, loginId: 'student3', name: 'student3', globalRole: 'MEMBER' },
]

export const cohorts: MockCohort[] = [
  { id: 1, name: '2026-2 C언어', description: '샘플 분반 (진행 중)', status: 'ACTIVE', createdAt: '2026-08-01T00:00:00Z' },
  { id: 2, name: '2026-1 파이썬', description: '샘플 분반 (보관됨)', status: 'ARCHIVED', createdAt: '2026-03-01T00:00:00Z' },
]

export const enrollments: MockEnrollment[] = [
  { cohortId: 1, loginId: 'operator1', role: 'OPERATOR' },
  { cohortId: 1, loginId: 'student1', role: 'STUDENT' },
  { cohortId: 1, loginId: 'student2', role: 'STUDENT' },
  { cohortId: 1, loginId: 'student3', role: 'STUDENT' },
  { cohortId: 2, loginId: 'student1', role: 'STUDENT' },
]
