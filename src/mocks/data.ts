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

export interface MockAssignment {
  id: number
  cohortId: number
  sessionNo: number | null
  title: string
  description: string | null
  dueAt: string
  createdAt: string
}

const now = Date.now()
const days = (n: number) => new Date(now + n * 86_400_000).toISOString()
const hours = (n: number) => new Date(now + n * 3_600_000).toISOString()

// BE LocalDataSeeder와 동일: 진행 중 분반에 1차시(마감 지남) · 2차시(마감 전) · 차시 없음
export const assignments: MockAssignment[] = [
  {
    id: 1,
    cohortId: 1,
    sessionNo: 1,
    title: '1차시 - 입출력 연습',
    description: '백준 1000번(A+B)을 풀고 코드를 제출하세요. https://www.acmicpc.net/problem/1000',
    dueAt: days(-3),
    createdAt: days(-10),
  },
  {
    id: 2,
    cohortId: 1,
    sessionNo: 2,
    title: '2차시 - 조건문과 반복문',
    description: '백준 2739번(구구단), 9498번(시험 성적)을 풀어 제출하세요.',
    dueAt: days(7),
    createdAt: days(-9),
  },
  {
    id: 3,
    cohortId: 1,
    sessionNo: null,
    title: '설문 - 스터디 시간 조사',
    description: '차시와 무관한 공지형 과제입니다. 설문 링크를 확인하세요.',
    dueAt: days(14),
    createdAt: days(-8),
  },
]

export interface MockSubmission {
  id: number
  assignmentId: number
  loginId: string
  codeText: string | null
  language: string | null
  fileName: string | null
  fileSize: number | null
  linkUrl: string | null
  submittedAt: string
}

const sampleCode = `#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
`

// BE LocalDataSeeder와 동일: 1차시(마감 -3일)에 상태 4종 재현 - student1 제출 / student2 제출(추가) / student3 지각.
// 2차시는 student1만 제출(나머지 미제출). zip 제출은 시딩하지 않는다(파일 실체가 필요해 부적합).
export const submissions: MockSubmission[] = [
  { id: 1, assignmentId: 1, loginId: 'student1', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, linkUrl: null, submittedAt: days(-5) },
  { id: 2, assignmentId: 1, loginId: 'student2', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, linkUrl: null, submittedAt: days(-4) },
  { id: 3, assignmentId: 1, loginId: 'student2', codeText: `${sampleCode}// 리팩터링 재제출\n`, language: 'C', fileName: null, fileSize: null, linkUrl: 'https://github.com/example/aplusb', submittedAt: days(-1) },
  { id: 4, assignmentId: 1, loginId: 'student3', codeText: null, language: null, fileName: null, fileSize: null, linkUrl: 'https://github.com/example/late-submit', submittedAt: days(-1) },
  { id: 5, assignmentId: 2, loginId: 'student1', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, linkUrl: null, submittedAt: hours(-1) },
]
