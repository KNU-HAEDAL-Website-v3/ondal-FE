// mock 데이터 - BE LocalDataSeeder와 같은 내용을 유지한다 (계정·분반이 다르면 팀원이 혼란스럽다).
// 계정: admin(ADMIN) / operator1 / student1~3. 모르는 아이디로 로그인하면 MEMBER로 새로 만든다 (find-or-create).
// 분반: "2026-2 C언어"(ACTIVE: operator1 + student1~3), "2026-1 파이썬"(ARCHIVED: student1)

import type { AttendanceStatus, CohortStatus, EnrollmentRole, GlobalRole, JudgeStatus, UserStatus, Verdict } from '@/api/types'

export interface MockUser {
  id: number
  loginId: string
  name: string
  globalRole: GlobalRole
  /** 승인 상태 - newbie 만 PENDING (시더와 동일). 스텁 로그인으로 새로 생긴 계정은 ACTIVE */
  status: UserStatus
  /** 프로필 사진 - 운영은 홈페이지(구글) 프로필을 로그인 때 받아 옴. mock 은 student1 만 사진(로컬 svg), 나머지는 이름 첫 글자 */
  avatarUrl?: string | null
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
  /** 소속 등록 시각 - 시드는 생략(분반 생성 시각으로 표시), 화면에서 배정한 것은 채운다 */
  enrolledAt?: string
}

export const users: MockUser[] = [
  { id: 1, loginId: 'admin', name: '관리자', globalRole: 'ADMIN', status: 'ACTIVE' },
  // 관리자(MAINTAINER) - 유지보수 팀. 해구르르와 같은 권한, 표시만 다름 (BE LocalDataSeeder 와 동일, docs 결정 12)
  { id: 7, loginId: 'maintainer', name: '유지보수', globalRole: 'MAINTAINER', status: 'ACTIVE' },
  { id: 2, loginId: 'operator1', name: 'operator1', globalRole: 'MEMBER', status: 'ACTIVE' },
  { id: 3, loginId: 'student1', name: 'student1', globalRole: 'MEMBER', status: 'ACTIVE', avatarUrl: '/favicon.svg' },
  { id: 4, loginId: 'student2', name: 'student2', globalRole: 'MEMBER', status: 'ACTIVE' },
  { id: 5, loginId: 'student3', name: 'student3', globalRole: 'MEMBER', status: 'ACTIVE' },
  // 승인 대기 화면·부원 관리(승인) 확인용 - newbie 로 로그인하면 "승인 대기" 만 보인다 (BE LocalDataSeeder 와 동일)
  { id: 6, loginId: 'newbie', name: '신입부원', globalRole: 'MEMBER', status: 'PENDING' },
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

/** V7: 문제 = 분반 무관 라이브러리 항목. 제목·본문·번호·제한·테스트케이스가 여기 있다 */
export interface MockProblem {
  id: number
  problemNo: number
  title: string
  description: string | null
  tagIds: number[]
  /** 자동 채점 제한 - 없으면(undefined/null) 서버 기본값. PUT .../judge 로만 바뀐다 */
  timeLimitMs?: number | null
  memoryLimitMb?: number | null
  /** V9 난이도 1~25 (없으면 미지정) · 허용 언어 (없으면 제한 없음) */
  difficulty?: number | null
  allowedLanguages?: string[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MockTag {
  id: number
  name: string
  createdAt: string
}

/** V7: 과제 = 배정("이 문제를 이 분반에 이 마감으로") */
export interface MockAssignment {
  id: number
  cohortId: number
  problemId: number
  sessionNo: number | null
  dueAt: string
  createdAt: string
}

const now = Date.now()
const days = (n: number) => new Date(now + n * 86_400_000).toISOString()
const hours = (n: number) => new Date(now + n * 3_600_000).toISOString()

// BE LocalDataSeeder와 동일: 태그 3개 + 문제 3개, 진행 중 분반에 1차시(마감 지남) · 2차시(마감 전) · 차시 없음으로 배정
export const tags: MockTag[] = [
  { id: 1, name: '구현', createdAt: days(-20) },
  { id: 2, name: '다이나믹 프로그래밍', createdAt: days(-20) },
  { id: 3, name: '사칙연산', createdAt: days(-20) },
]

export const problems: MockProblem[] = [
  {
    id: 1,
    problemNo: 1000,
    title: '두 수의 합',
    difficulty: 1,
    description: '두 정수 A와 B를 한 줄에 공백으로 구분해 입력받아 A+B를 출력하는 프로그램을 작성해 제출하세요.',
    tagIds: [1, 3],
    createdBy: '관리자',
    createdAt: days(-10),
    updatedAt: days(-10),
  },
  {
    id: 2,
    problemNo: 1001,
    title: '조건문과 반복문',
    difficulty: 4,
    allowedLanguages: ['C'],
    description: '정수 N을 입력받아 N단 구구단을 출력하는 문제와, 점수를 입력받아 등급(A~F)을 출력하는 문제를 풀어 제출하세요.',
    tagIds: [1],
    createdBy: '관리자',
    createdAt: days(-9),
    updatedAt: days(-9),
  },
  {
    id: 3,
    problemNo: 1002,
    title: '설문 - 스터디 시간 조사',
    description: '차시와 무관한 공지형 과제입니다. 설문 링크를 확인하세요.',
    tagIds: [],
    createdBy: null,
    createdAt: days(-8),
    updatedAt: days(-8),
  },
]

export const assignments: MockAssignment[] = [
  { id: 1, cohortId: 1, problemId: 1, sessionNo: 1, dueAt: days(-3), createdAt: days(-10) },
  { id: 2, cohortId: 1, problemId: 2, sessionNo: 2, dueAt: days(7), createdAt: days(-9) },
  { id: 3, cohortId: 1, problemId: 3, sessionNo: null, dueAt: days(14), createdAt: days(-8) },
]

export interface MockQuestion {
  id: number
  cohortId: number
  loginId: string
  title: string
  content: string
  createdAt: string
}

// BE LocalDataSeeder.seedQuestions 와 동일: 진행 중 분반에 student1·student2 질문 각 1건 (등록 순서 = student1 → student2, 목록은 최신순)
export const questions: MockQuestion[] = [
  {
    id: 1,
    cohortId: 1,
    loginId: 'student1',
    title: '1차시 과제 입력 형식 질문',
    content: 'A와 B가 한 줄에 공백으로 들어온다고 했는데, 줄바꿈으로 나뉘어 들어오는 경우도 처리해야 하나요?',
    createdAt: days(-2),
  },
  {
    id: 2,
    cohortId: 1,
    loginId: 'student2',
    title: '제출 후 코드를 수정하면 어떻게 되나요?',
    content: '이미 제출한 과제의 코드를 고쳐 다시 제출하면 이전 제출은 사라지나요, 아니면 이력이 남나요?',
    createdAt: days(-1),
  },
]

export interface MockAnswer {
  id: number
  questionId: number
  loginId: string
  content: string
  createdAt: string
}

// BE LocalDataSeeder 와 동일: 1차시 질문(id 1)에 운영진 답변 1건
export const answers: MockAnswer[] = [
  {
    id: 1,
    questionId: 1,
    loginId: 'operator1',
    content: 'scanf("%d %d", &a, &b) 는 공백과 줄바꿈을 모두 구분자로 읽으니 따로 처리하지 않아도 됩니다.',
    createdAt: hours(-36),
  },
]

export interface MockNotice {
  id: number
  /** null = 전체 공지(관리자), 값 = 분반 공지(운영진 이상) */
  cohortId: number | null
  loginId: string
  title: string
  content: string
  pinned: boolean
  createdAt: string
}

// BE LocalDataSeeder.seedNotices 와 동일: 전체 공지(관리자, 필독) 1 + 진행 중 분반 공지(operator1) 1
export const notices: MockNotice[] = [
  {
    id: 1,
    cohortId: null,
    loginId: 'admin',
    title: '2026-2 부트캠프 운영 안내',
    content: '과제는 마감 전까지 몇 번이든 다시 제출할 수 있습니다. 마감 후 제출은 지각으로 표시되며, 질문은 분반 Q&A 게시판을 이용해 주세요.',
    pinned: true,
    createdAt: days(-6),
  },
  {
    id: 2,
    cohortId: 1,
    loginId: 'operator1',
    title: '2026-2 C언어 첫 모임 안내',
    content: '첫 모임은 개강 주 화요일 19:00 공대 4호관 실습실입니다. 노트북과 충전기를 가져오세요.',
    pinned: false,
    createdAt: days(-4),
  },
]

export interface MockSession {
  id: number
  cohortId: number
  sessionNo: number
  title: string | null
  /** KST 달력일 yyyy-MM-dd */
  heldOn: string
  createdAt: string
}

export interface MockAttendance {
  sessionId: number
  loginId: string
  status: AttendanceStatus
  checkedAt: string
  checkedBy: string
}

/** 오늘 기준 n일 뒤의 KST 달력일 - 차시 날짜 시드용 */
const kstDate = (n: number) => new Date(now + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

// BE LocalDataSeeder.seedAttendance 와 동일: 진행 중 분반에 차시 2개(10일 전·3일 전) + 기록 5건
// 1차시 = student1 출석 · student2 지각 · student3 결석 / 2차시 = student1·student2 출석, student3 미확인(기록 없음)
export const sessions: MockSession[] = [
  { id: 1, cohortId: 1, sessionNo: 1, title: '입출력 연습', heldOn: kstDate(-10), createdAt: days(-10) },
  { id: 2, cohortId: 1, sessionNo: 2, title: '조건문과 반복문', heldOn: kstDate(-3), createdAt: days(-3) },
]

export const attendances: MockAttendance[] = [
  { sessionId: 1, loginId: 'student1', status: 'PRESENT', checkedAt: days(-10), checkedBy: 'operator1' },
  { sessionId: 1, loginId: 'student2', status: 'LATE', checkedAt: days(-10), checkedBy: 'operator1' },
  { sessionId: 1, loginId: 'student3', status: 'ABSENT', checkedAt: days(-10), checkedBy: 'operator1' },
  { sessionId: 2, loginId: 'student1', status: 'PRESENT', checkedAt: days(-3), checkedBy: 'operator1' },
  { sessionId: 2, loginId: 'student2', status: 'PRESENT', checkedAt: days(-3), checkedBy: 'operator1' },
]

export interface MockSubmission {
  id: number
  /** 과제 제출이면 값, HOJ 연습 제출이면 null (V7) */
  assignmentId: number | null
  /** HOJ 연습 제출이면 값 */
  problemId?: number | null
  loginId: string
  type: 'CODE' | 'FILE' | 'LINK'
  codeText: string | null
  language: string | null
  fileName: string | null
  fileSize: number | null
  links: string[]
  submittedAt: string
  /** 운영진 코멘트 - 제출 1건에 1개(덮어쓰기), 없으면 null. loginId = 마지막으로 남긴 운영진 */
  comment: { content: string; loginId: string; commentedAt: string } | null
}

const sampleCode = `#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
`

// BE LocalDataSeeder와 동일: 1차시(마감 -3일)에 상태 4종 재현 - student1 제출(CODE) / student2 제출(추가)(CODE→LINK) / student3 지각(LINK).
// 2차시는 student1만 제출(나머지 미제출). FILE 제출은 시딩하지 않는다(파일 실체가 필요해 부적합).
// student1 의 1차시 제출에 operator1 코멘트 1건 - 코멘트 상자·배지·현황판 표시를 바로 확인 (BE 시더 동일)
const samplePython = `a, b = map(int, input().split())
print(a + b)
`

const sampleJava = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println(sc.nextInt() + sc.nextInt());
    }
}
`

const sampleTimes = `#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    for (int i = 1; i <= 3; i++) printf("%d%c", n * i, i == 3 ? '\\n' : ' ');
    return 0;
}
`

export const submissions: MockSubmission[] = [
  { id: 1, assignmentId: 1, loginId: 'student1', type: 'CODE', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: days(-5),
    comment: { content: '입력 처리가 깔끔합니다. 변수명(a, b)만 조금 더 의미 있게 지어 보세요.', loginId: 'operator1', commentedAt: days(-4) } },
  { id: 2, assignmentId: 1, loginId: 'student2', type: 'CODE', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: days(-4), comment: null },
  { id: 3, assignmentId: 1, loginId: 'student2', type: 'LINK', codeText: null, language: null, fileName: null, fileSize: null, links: ['https://github.com/example/aplusb', 'https://aplusb.example.dev'], submittedAt: days(-1), comment: null },
  { id: 4, assignmentId: 1, loginId: 'student3', type: 'LINK', codeText: null, language: null, fileName: null, fileSize: null, links: ['https://github.com/example/late-submit'], submittedAt: days(-1), comment: null },
  { id: 5, assignmentId: 2, loginId: 'student1', type: 'CODE', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-1), comment: null },
  // ---- HOJ 연습 제출 (P3 화면 확인용 - 채점 현황·랭킹·사용자 페이지·다른 사람 풀이가 이 기록으로 채워진다) ----
  // 1000(A+B): student1 Python 정답 · student2 오답 뒤 정답 · student3 컴파일 에러 / 1001(구구단, C 전용): operator1·student1 정답, student2 시간 초과, student3 오답
  { id: 6, assignmentId: null, problemId: 1, loginId: 'student1', type: 'CODE', codeText: samplePython, language: 'Python 3', fileName: null, fileSize: null, links: [], submittedAt: days(-6), comment: null },
  { id: 7, assignmentId: null, problemId: 1, loginId: 'student2', type: 'CODE', codeText: sampleCode.replace('a + b', 'a - b'), language: 'C', fileName: null, fileSize: null, links: [], submittedAt: days(-2), comment: null },
  { id: 8, assignmentId: null, problemId: 1, loginId: 'student2', type: 'CODE', codeText: sampleCode, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-47), comment: null },
  { id: 9, assignmentId: null, problemId: 1, loginId: 'student3', type: 'CODE', codeText: sampleJava.replace('nextInt()', 'nextInt('), language: 'Java', fileName: null, fileSize: null, links: [], submittedAt: days(-1), comment: null },
  { id: 10, assignmentId: null, problemId: 2, loginId: 'student3', type: 'CODE', codeText: sampleTimes.replace('n * i', 'n + i'), language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-5), comment: null },
  { id: 11, assignmentId: null, problemId: 2, loginId: 'operator1', type: 'CODE', codeText: sampleTimes, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-3), comment: null },
  { id: 12, assignmentId: null, problemId: 2, loginId: 'student1', type: 'CODE', codeText: sampleTimes, language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-2), comment: null },
  { id: 13, assignmentId: null, problemId: 2, loginId: 'student2', type: 'CODE', codeText: sampleTimes.replace('i <= 3', 'i >= 1'), language: 'C', fileName: null, fileSize: null, links: [], submittedAt: hours(-0.5), comment: null },
]

/** 문제별 정답 코드(참고 풀이, P3 6절) - 운영진 이상만 읽고 쓴다. 학생에게는 존재도 안 보인다 */
export interface MockSolution {
  problemId: number
  language: string
  codeText: string
  updatedBy: string
  updatedAt: string
}

export const problemSolutions: MockSolution[] = [
  { problemId: 1, language: 'C', codeText: sampleCode, updatedBy: 'admin', updatedAt: days(-10) },
  { problemId: 1, language: 'Python 3', codeText: samplePython, updatedBy: 'admin', updatedAt: days(-10) },
]

/** 북마크(P3 7절) - "loginId:problemId". 브라우저 세션 동안만 남는다 */
export const bookmarks = new Set<string>(['student1:2'])

// ---- 자동 채점 (docs judge/design.md) - BE LocalDataSeeder 동일: 1차시(A+B)에 케이스 3개(첫 번째 공개), 코드 제출 결과 student1 ACCEPTED 3/3 · student2 WRONG_ANSWER 2/3
// 가짜 엔진(mocks/judge.ts)은 BE FakeJudgeEngine 과 같이 지시 주석 없으면 입력을 echo 한다 - 이 과제(기대 출력 = 합)에 새로 제출하면 틀렸습니다가 정상. 맞았습니다를 보려면 기대 출력 = 입력인 문제를 출제하거나 `// judge: AC` 대신 echo 규칙을 따른다
export interface MockTestCase {
  id: number
  problemId: number
  position: number
  input: string
  expectedOutput: string
  isPublic: boolean
}

export interface MockJudgeCase {
  position: number
  verdict: Verdict
  timeMs: number | null
  memoryKb: number | null
  actualOutput: string
  truncated: boolean
}

export interface MockJudgeResult {
  submissionId: number
  problemId: number
  status: JudgeStatus
  verdict: Verdict | null
  passedCases: number
  totalCases: number
  maxTimeMs: number | null
  maxMemoryKb: number | null
  compileOutput: string | null
  cases: MockJudgeCase[]
  judgedAt: string | null
}

export const testCases: MockTestCase[] = [
  { id: 1, problemId: 1, position: 0, input: '1 2\n', expectedOutput: '3\n', isPublic: true },
  { id: 2, problemId: 1, position: 1, input: '10 20\n', expectedOutput: '30\n', isPublic: false },
  { id: 3, problemId: 1, position: 2, input: '-5 5\n', expectedOutput: '0\n', isPublic: false },
  // 1001 도 자동 채점 (P3 mock 확장 - 랭킹·사용자 페이지에 푼 문제가 2개 이상 있어야 화면이 읽힌다)
  { id: 4, problemId: 2, position: 0, input: '3\n', expectedOutput: '3 6 9\n', isPublic: true },
  { id: 5, problemId: 2, position: 1, input: '7\n', expectedOutput: '7 14 21\n', isPublic: false },
]

const acceptedAplusB = (submissionId: number, judgedAt: string): MockJudgeResult => ({
  submissionId, problemId: 1, status: 'DONE', verdict: 'ACCEPTED', passedCases: 3, totalCases: 3, maxTimeMs: 3, maxMemoryKb: 1600, compileOutput: null, judgedAt,
  cases: [
    { position: 0, verdict: 'ACCEPTED', timeMs: 2, memoryKb: 1536, actualOutput: '3\n', truncated: false },
    { position: 1, verdict: 'ACCEPTED', timeMs: 2, memoryKb: 1536, actualOutput: '30\n', truncated: false },
    { position: 2, verdict: 'ACCEPTED', timeMs: 3, memoryKb: 1600, actualOutput: '0\n', truncated: false },
  ],
})

const acceptedTimes = (submissionId: number, judgedAt: string): MockJudgeResult => ({
  submissionId, problemId: 2, status: 'DONE', verdict: 'ACCEPTED', passedCases: 2, totalCases: 2, maxTimeMs: 4, maxMemoryKb: 1720, compileOutput: null, judgedAt,
  cases: [
    { position: 0, verdict: 'ACCEPTED', timeMs: 3, memoryKb: 1700, actualOutput: '3 6 9\n', truncated: false },
    { position: 1, verdict: 'ACCEPTED', timeMs: 4, memoryKb: 1720, actualOutput: '7 14 21\n', truncated: false },
  ],
})

export const judgeResults: MockJudgeResult[] = [
  acceptedAplusB(1, days(-5)),
  {
    submissionId: 2, problemId: 1, status: 'DONE', verdict: 'WRONG_ANSWER', passedCases: 2, totalCases: 3, maxTimeMs: 3, maxMemoryKb: 1600, compileOutput: null, judgedAt: days(-4),
    cases: [
      { position: 0, verdict: 'ACCEPTED', timeMs: 2, memoryKb: 1536, actualOutput: '3\n', truncated: false },
      { position: 1, verdict: 'ACCEPTED', timeMs: 2, memoryKb: 1536, actualOutput: '30\n', truncated: false },
      { position: 2, verdict: 'WRONG_ANSWER', timeMs: 3, memoryKb: 1600, actualOutput: '10\n', truncated: false },
    ],
  },
  acceptedTimes(5, hours(-1)),
  // ---- 연습 제출 결과 (submissions 6~13 과 짝) ----
  { ...acceptedAplusB(6, days(-6)), maxTimeMs: 31, maxMemoryKb: 9800 },
  {
    submissionId: 7, problemId: 1, status: 'DONE', verdict: 'WRONG_ANSWER', passedCases: 1, totalCases: 3, maxTimeMs: 3, maxMemoryKb: 1600, compileOutput: null, judgedAt: days(-2),
    cases: [
      { position: 0, verdict: 'WRONG_ANSWER', timeMs: 2, memoryKb: 1536, actualOutput: '-1\n', truncated: false },
      { position: 1, verdict: 'WRONG_ANSWER', timeMs: 2, memoryKb: 1536, actualOutput: '-10\n', truncated: false },
      { position: 2, verdict: 'ACCEPTED', timeMs: 3, memoryKb: 1600, actualOutput: '0\n', truncated: false },
    ],
  },
  acceptedAplusB(8, hours(-47)),
  { submissionId: 9, problemId: 1, status: 'DONE', verdict: 'COMPILE_ERROR', passedCases: 0, totalCases: 3, maxTimeMs: null, maxMemoryKb: null, compileOutput: "Main.java:7: error: ')' expected", cases: [], judgedAt: days(-1) },
  {
    submissionId: 10, problemId: 2, status: 'DONE', verdict: 'WRONG_ANSWER', passedCases: 0, totalCases: 2, maxTimeMs: 4, maxMemoryKb: 1700, compileOutput: null, judgedAt: hours(-5),
    cases: [
      { position: 0, verdict: 'WRONG_ANSWER', timeMs: 3, memoryKb: 1700, actualOutput: '4 5 6\n', truncated: false },
      { position: 1, verdict: 'WRONG_ANSWER', timeMs: 4, memoryKb: 1700, actualOutput: '8 9 10\n', truncated: false },
    ],
  },
  acceptedTimes(11, hours(-3)),
  acceptedTimes(12, hours(-2)),
  {
    submissionId: 13, problemId: 2, status: 'DONE', verdict: 'TIME_LIMIT', passedCases: 0, totalCases: 2, maxTimeMs: 2000, maxMemoryKb: 1700, compileOutput: null, judgedAt: hours(-0.5),
    cases: [
      { position: 0, verdict: 'TIME_LIMIT', timeMs: 2000, memoryKb: 1700, actualOutput: '', truncated: false },
      { position: 1, verdict: 'TIME_LIMIT', timeMs: 2000, memoryKb: 1700, actualOutput: '', truncated: false },
    ],
  },
]
