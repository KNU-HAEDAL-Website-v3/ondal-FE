// 백엔드 DTO 미러 - 계약의 기준은 BE springdoc(OpenAPI). 여기 타입은 그 요약본이다.
// 필드가 필요하면 프론트에서 조합하지 말고 BE에 API 변경을 요청한다 (CLAUDE.md).

/** 전역 역할 - ADMIN(해구르르)과 MAINTAINER(관리자, 유지보수 팀)는 권한이 같다. 화면 판정은 lib/roles isAdminRole 로만 (docs 결정 12) */
export type GlobalRole = 'ADMIN' | 'MAINTAINER' | 'MEMBER'
export type EnrollmentRole = 'OPERATOR' | 'STUDENT'
export type CohortStatus = 'ACTIVE' | 'ARCHIVED'

/**
 * 직책 명칭 - 서버(RoleTitle)가 정한 표시 문자열을 그대로 쓴다: '해구르르' | '관리자' | '교육운영진' | '일반 수강생'.
 * 프론트는 자체 매핑을 갖지 않는다 (명칭이 바뀌어도 서버만 고치면 됨).
 */
export type RoleTitle = string

/** 승인 상태 - PENDING(첫 홈페이지 로그인, 운영진 승인 대기 - 다른 API 는 403 USER_PENDING) / ACTIVE (docs 결정 10) */
export type UserStatus = 'PENDING' | 'ACTIVE'

/** GET /api/auth/me, POST /api/auth/login - 본인 정보 */
export interface UserResponse {
  id: number
  loginId: string
  name: string
  globalRole: GlobalRole
  status: UserStatus
}

/** 부원 목록 한 줄의 소속 요약 - GET /api/users */
export interface EnrollmentBrief {
  cohortId: number
  cohortName: string
  cohortStatus: CohortStatus
  role: EnrollmentRole
}

/** GET /api/users (운영진 이상) - 부원 관리·명부 배정 모달이 쓴다. 승인 대기가 먼저, 그 다음 최근 생성순 */
export interface UserDirectoryEntry {
  id: number
  loginId: string
  name: string
  globalRole: GlobalRole
  status: UserStatus
  /** 계정 생성 시각(UTC) - 첫 로그인 또는 선등록 시각 */
  createdAt: string
  enrollments: EnrollmentBrief[]
}

/** POST /api/auth/logout - 응답 시점에 Ondal 세션은 이미 끝난 상태 */
export interface LogoutResponse {
  /**
   * 홈페이지(Keycloak) 세션까지 끝내는 주소 - 있으면 FE 가 이 주소로 브라우저 이동(fetch 아님), 끝나면 Keycloak 이 /login 으로 돌려보낸다.
   * 스텁 모드·홈페이지가 주소를 안 주면 null → 그냥 /login 으로 이동
   */
  logoutUrl: string | null
}

/** 타인에게 공개되는 최소 정보 (분반 카드의 운영진 목록) - loginId·globalRole 없음 */
export interface UserSummary {
  id: number
  name: string
  title: RoleTitle
}

/** GET /api/me/cohorts, GET /api/cohorts/{id} - 목록·단건 응답이 전부 이 하나 */
export interface CohortResponse {
  id: number
  name: string
  description: string | null
  status: CohortStatus
  createdAt: string
  operators: UserSummary[]
  /** 요청자가 OPERATOR/ADMIN일 때만 값, STUDENT면 null */
  studentCount: number | null
  /** 요청자의 소속 역할. 비소속(ADMIN이 남의 분반을 볼 때) null */
  myRole: EnrollmentRole | null
  /** 홈 카드의 내 배지에 그대로 표시 */
  myTitle: RoleTitle
  /** 운영 기능 진입 가능 여부 - 프론트는 이 값만 보고 분기 */
  canManage: boolean
}

/** POST /api/cohorts 요청 (관리자) - 생성과 동시에 운영진 지정 가능. 아직 로그인한 적 없는 loginId 도 선등록 */
export interface CohortCreatePayload {
  name: string
  description: string | null
  operatorLoginIds: string[]
}

/** PUT /api/cohorts/{id} 요청 (관리자) - 이름·설명 전체 교체. 운영진은 /operators API 로 따로 */
export interface CohortUpdatePayload {
  name: string
  description: string | null
}

/** GET /api/cohorts/{id}/members 행 - 운영진 이상만 보는 응답이라 loginId 포함(UserResponse). 서버 정렬: 운영진 먼저 */
export interface MemberResponse {
  user: UserResponse
  role: EnrollmentRole
  title: RoleTitle
  /** 소속 등록 시각(UTC) */
  enrolledAt: string
}

/** POST /api/cohorts/{id}/students 요청 - 빈 목록 400, 중복은 한 번만, 이미 운영진인 loginId 는 409 CONFLICT */
export interface StudentAssignPayload {
  loginIds: string[]
}

/** 제출 상태 4종 - 서버 계산값. 프론트 재계산 금지, 배지 매핑만 한다 (CLAUDE.md 규칙 4) */
export type SubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'SUBMITTED_EXTRA' | 'LATE'

/**
 * GET·POST·PUT /api/cohorts/{cohortId}/assignments - 목록·단건·등록·수정 응답이 전부 이 하나.
 * V7 이후 과제는 "문제를 분반에 배정한 것" - 제목·본문·번호·태그는 배정된 문제(Problem)에서 온다(서버가 펴서 내려준다).
 */
export interface AssignmentResponse {
  id: number
  /** 배정된 문제 id - 문제 상세(HOJ)·채점 설정으로 갈 때 쓴다 */
  problemId: number
  /** 문제 번호 - 전역 유일, 1000부터. 표시는 #1000 형식 (schema.md 결정 9) */
  problemNo: number
  /** 차시 번호 - 차시에 속하지 않는 과제는 null. 목록은 차시 오름차순(null 마지막) → 등록순 (서버 정렬) */
  sessionNo: number | null
  title: string
  /** 문제 본문 - 배정된 문제의 것 (선택) */
  description: string | null
  /** 문제에 붙은 태그 - 이름순 */
  tags: TagResponse[]
  /** 마감 시각(UTC) - KST 변환 표시는 프론트 몫. 지각 판정은 서버가 이 값으로 계산 */
  dueAt: string
  createdAt: string
  /** 요청자 본인의 제출 상태 - 분반 비소속(비소속 관리자)이면 null */
  myStatus: SubmissionStatus | null
  /** 제출 이력 총 건수 - 운영진·관리자만 값, 수강생은 null. 삭제 확인 창의 "제출물 N건" 경고에 사용 */
  submissionCount: number | null
  /** 자동 채점 문제인가 = 테스트케이스 1개 이상 (judge/design.md 결정 1) - 목록 배지·상세 예시 절 */
  judgeEnabled: boolean
}

/**
 * POST·PUT /api/cohorts/{cohortId}/assignments 요청 본문 - 필드·검증 동일 (PUT은 전체 교체).
 * V7: 제목·본문·번호는 문제의 것이라 여기 없다 - 새 문제를 내려면 POST /api/problems 를 먼저 부른다.
 */
export interface AssignmentPayload {
  /** 배정할 문제 id - 라이브러리에서 고르거나(가져오기) 방금 만든 문제의 id */
  problemId: number
  sessionNo: number | null
  dueAt: string
}

// ---- 문제 라이브러리 (HOJ) - V7 ------------------------------------------------------------

/** 문제 태그 - 알고리즘·자료구조 분류. 만들고 고치는 건 관리자만 */
export interface TagResponse {
  id: number
  name: string
}

/** POST·PUT /api/tags 요청 (관리자) */
export interface TagPayload {
  name: string
}

/** 나의 문제 상태 (HOJ P3, hoj/api.md 1절) - SOLVED(맞힌 적 있음) / ATTEMPTED(채점된 제출은 있으나 아직) / NONE */
export type ProblemMyStatus = 'SOLVED' | 'ATTEMPTED' | 'NONE'

/** GET /api/problems 행 - 본문은 빼고 목록에 필요한 것만 */
export interface ProblemSummary {
  id: number
  problemNo: number
  title: string
  tags: TagResponse[]
  /** 자동 채점 문제인가 = 테스트케이스 1개 이상 */
  judgeEnabled: boolean
  /** 과제로 배정된 횟수 - 0이면 아직 한 번도 안 낸 문제 */
  assignedCount: number
  /** 요청자가 맞힌 적이 있는가 - 과제 제출·HOJ 연습 어느 쪽이든. myStatus 의 하위 호환 */
  solved: boolean
  /** 난이도 1~25 - 표기 "대분류-소분류"(lib/difficulty). null = 미지정 (V9) */
  difficulty: number | null
  /** 제출 허용 언어 - 빈 배열이면 제한 없음. 제출 폼의 언어 선택지를 이 목록으로 좁힌다 (V9) */
  allowedLanguages: string[]
  /** 이 문제를 푼 사람 수 - ACCEPTED 판정이 있는 사용자 수, 연습·과제 합산 (P3) */
  solvedUserCount: number
  /** 채점된 제출 수 - 연습·과제 합산 (P3) */
  submissionCount: number
  /** ACCEPTED 비율(%) - 채점된 제출이 0이면 null. 프론트 재계산 금지 (P3) */
  acceptedRate: number | null
  /** 나의 상태 - 목록의 내 상태 열·필터 (P3) */
  myStatus: ProblemMyStatus
  /** 내가 북마크했는지 - PUT/DELETE /bookmark 로 바뀐다 (P3) */
  bookmarked: boolean
}

/** GET /api/problems/{id} - 목록 행 + 본문·제한·권한 판정값 */
export interface ProblemResponse extends ProblemSummary {
  description: string | null
  /** 서버 기본값이 적용된 실제 값 */
  timeLimitMs: number
  memoryLimitMb: number
  /** 출제자 이름 - V7 이전 문제는 알 수 없어 null */
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** 수정·삭제 버튼 분기 - 프론트는 이 값만 본다 */
  canEdit: boolean
  /** 저장된 정답 코드(참고 풀이)의 언어 목록 - 운영진 이상에게만 값, 그 밖에는 [] (P3, 6절) */
  solutionLanguages: string[]
}

// ---- HOJ P3 - 채점 현황 · 사용자 페이지 · 랭킹 · 풀이 공개 · 정답 코드 · 실행 (docs hoj/api.md) ----------

/** 피드·사용자 페이지의 문제 요약 - 번호·제목만 (상세 링크용) */
export interface HojProblemRef {
  id: number
  problemNo: number
  title: string
}

/** GET /api/hoj/submissions 의 items 항목 - 연습 제출 1건. codeText 는 내려오지 않는다 (2절) */
export interface HojSubmissionItem {
  id: number
  problem: HojProblemRef
  user: UserSummary
  language: string
  judgeStatus: JudgeStatus
  /** 채점 중(PENDING/RUNNING)이면 null */
  verdict: Verdict | null
  passedCases: number
  totalCases: number
  maxTimeMs: number | null
  maxMemoryKb: number | null
  submittedAt: string
}

/** GET /api/hoj/submissions - 최신 제출 먼저(id desc). nextBeforeId 가 null 이면 더 없음 */
export interface HojSubmissionFeed {
  items: HojSubmissionItem[]
  /** 다음 페이지 커서 = 마지막 항목 id. 더 없으면 null */
  nextBeforeId: number | null
}

/** 사용자 페이지의 푼 문제·시도 중 문제 격자 항목 */
export interface HojProblemChip extends HojProblemRef {
  difficulty: number | null
}

/** GET /api/hoj/users/{userId} - 활동 통계 (3절). 값은 전부 서버 계산 - 재계산 금지 */
export interface HojUserPageResponse {
  user: UserSummary
  /** 계정 생성 시각(UTC) */
  joinedAt: string
  /** 4절 랭킹의 순위 - 푼 문제 0개면 null */
  rank: number | null
  stats: {
    /** 푼 문제 수 - 연습·과제 합산 */
    solvedCount: number
    /** 시도 중인 문제 수 */
    attemptedCount: number
    /** 연습 제출 수 */
    submissionCount: number
    /** 연습 제출 중 ACCEPTED 수 */
    acceptedCount: number
    /** 연습 제출 정답률(%) - 제출 0건이면 null */
    acceptedRate: number | null
  }
  /** 연습 제출의 언어별 건수 - 많은 순 */
  languages: { language: string; count: number }[]
  /** 번호 오름차순 */
  solvedProblems: HojProblemChip[]
  attemptedProblems: HojProblemChip[]
  /** 태그별 푼 문제 / 전체 문제 - 태그 이름순, total 0 인 태그 생략 */
  tagStats: { tag: TagResponse; solved: number; total: number }[]
  /** 최근 365일 KST 날짜별 연습 제출 수 - 0인 날은 생략 */
  activity: { date: string; count: number }[]
  /** 최근 연습 제출 20건 - 피드 항목과 같은 모양 */
  recentSubmissions: HojSubmissionItem[]
}

/** GET /api/hoj/ranking 행 - 동점은 같은 순위(1, 1, 3). 푼 문제 0개는 제외 (4절) */
export interface HojRankingItem {
  rank: number
  user: UserSummary
  solvedCount: number
  /** 연습 제출 수 */
  submissionCount: number
  lastSolvedAt: string
}

export interface HojRankingResponse {
  items: HojRankingItem[]
  /** 요청자의 순위 - 푼 문제 0개면 null */
  me: { rank: number; solvedCount: number } | null
}

/** GET /api/problems/{id}/accepted-solutions 항목 - 사용자당 최신 정답 1건, 요청자 본인 제외 (5절). 못 푼 사람은 403 NOT_SOLVED */
export interface AcceptedSolution {
  submissionId: number
  user: UserSummary
  language: string
  codeText: string
  submittedAt: string
  maxTimeMs: number | null
  maxMemoryKb: number | null
}

/** GET·PUT /api/problems/{id}/solutions 응답 항목 - 언어별 참고 풀이, 운영진 이상만 (6절) */
export interface ProblemSolution {
  language: string
  codeText: string
  updatedBy: UserSummary
  updatedAt: string
}

/** PUT /api/problems/{id}/solutions 본문 - 전체 교체(빈 배열 = 모두 삭제). 최대 6개, 언어 중복 400, 코드 100,000자 이하 */
export interface ProblemSolutionsPayload {
  solutions: { language: string; codeText: string }[]
}

/** POST /api/problems/{id}/run 본문 - 저장 없이 내 입력으로 실행 (8절). inputs 1~5개. 응답은 JudgeRunResponse. 분당 10회 초과 429 TOO_MANY_REQUESTS */
export interface ProblemRunPayload {
  language: string
  sourceCode: string
  inputs: string[]
}

/** POST·PUT /api/problems 요청 (운영진 이상) - 테스트케이스·제한은 .../judge 에서 따로 */
export interface ProblemPayload {
  /** 등록: 비우면 자동 채번. 수정: 비우면 기존 번호 유지. 중복은 409 */
  problemNo: number | null
  title: string
  description: string | null
  /** 통째 교체 - 빈 배열이면 태그 없음 */
  tagIds: number[]
  /** 난이도 1~25 ((대분류-1)*5+소분류). null = 미지정 */
  difficulty: number | null
  /** 제출 허용 언어 (lib/languages LANGUAGES 의 값). 빈 배열 = 제한 없음 */
  allowedLanguages: string[]
}

/** POST /api/problems/{id}/submissions 요청 - HOJ 연습 제출은 코드만 */
export interface PracticeSubmitPayload {
  codeText: string
  language: string
}

/** 제출 형태 - 3종 택1 (docs/submission/design.md 결정 12) */
export type SubmissionType = 'CODE' | 'FILE' | 'LINK'

/** POST .../submissions 의 request JSON 파트 - 파일은 별도 multipart 파트(file). type별 필수·금지 조합은 서버 검증 */
export interface SubmissionPayload {
  type: SubmissionType
  /** CODE 필수 */
  codeText: string | null
  /** CODE 필수 */
  language: string | null
  /** LINK 필수 - 1~5개, 입력 순서 보존 */
  linkUrls: string[] | null
}

/** POST(#18)·GET 단건(#20) 응답 - 코드 전문 포함 */
export interface SubmissionResponse {
  id: number
  user: UserSummary
  type: SubmissionType
  codeText: string | null
  language: string | null
  fileName: string | null
  fileSize: number | null
  /** 링크 URL 목록 - position 순. LINK 외 형태는 빈 배열 */
  links: string[]
  /** 제출 시각(UTC) = 서버 수신 시각 */
  submittedAt: string
  /** 지각 여부 - 서버 판정값. 마감이 수정되면 재조회 시 바뀔 수 있다 */
  late: boolean
  /** 운영진 코멘트 - 없으면 null. 점수는 없다 (submission/design.md 결정 18) */
  comment: SubmissionComment | null
  /** 자동 채점 결과 - CODE 제출이고 자동 채점 문제일 때만, 아니면 null. 제출 직후는 status PENDING (judge/api.md 2절) */
  judge: JudgeResultResponse | null
}

/** 제출에 달린 운영진 코멘트 - 제출 1건에 1개, 덮어쓰기 */
export interface SubmissionComment {
  content: string
  /** 마지막으로 남긴(수정한) 운영진 - title 은 서버 직책 문자열 그대로 */
  author: UserSummary
  /** 마지막 변경 시각(UTC) */
  commentedAt: string
}

/** PUT .../submissions/{submissionId}/comment(#45) 본문 - 지우기는 DELETE(#46), 본문 없음 */
export interface SubmissionCommentPayload {
  content: string
}

/** GET .../submissions/my(#19) 행 - 코드 전문 제외(확인은 단건 #20) */
export interface SubmissionSummary {
  id: number
  type: SubmissionType
  language: string | null
  fileName: string | null
  fileSize: number | null
  links: string[]
  submittedAt: string
  late: boolean
  /** 운영진 코멘트가 달렸는가 - 행 배지용. 내용은 단건(#20) */
  hasComment: boolean
  /** 채점 상태 - 채점 대상이 아니면 null */
  judgeStatus: JudgeStatus | null
  /** 판정 - DONE·ERROR 일 때만. 표의 채점 결과 열 */
  verdict: Verdict | null
}

/** GET .../status-board(#22) 행 - 현재 수강생 명단(이름순), 미제출자 포함 */
export interface StatusBoardRow {
  user: UserSummary
  status: SubmissionStatus
  submissionCount: number
  lastSubmittedAt: string | null
  /** 최신 제출 id - 상세(#20)·파일(#21) 진입용. 제출 없으면 null */
  latestSubmissionId: number | null
  /** 최신 제출에 운영진 코멘트가 달렸는가 - 검토 안 한 제출을 한눈에. 제출 없으면 false */
  latestCommented: boolean
  /** 최신 제출의 채점 상태 - 채점 대상이 아니거나 제출 없음이면 null */
  latestJudgeStatus: JudgeStatus | null
  /** 최신 제출의 판정 - 현황판 판정 열 */
  latestVerdict: Verdict | null
}

/** GET·POST·PUT /api/cohorts/{cohortId}/questions - 목록·단건·등록·수정 응답이 전부 이 하나 (docs/qna/api.md 3절) */
export interface QuestionResponse {
  id: number
  title: string
  content: string
  /** 작성자 - loginId·globalRole 없음. title 은 서버가 정한 직책 문자열 그대로 배지 표시 */
  author: UserSummary
  /** 등록 시각(UTC) - 수정 시각 열은 없음 (qna/design.md 결정 6) */
  createdAt: string
  /** 작성자 본인 && 분반 ACTIVE - 프론트는 이 값만 보고 수정 버튼 분기 (loginId 비교·역할 판정 금지) */
  canEdit: boolean
  /** (작성자 본인 || 운영진 이상) && 분반 ACTIVE - 삭제 버튼 분기 */
  canDelete: boolean
  /** 답변 수 - 목록 "답변 N" 표시 */
  answerCount: number
}

/** POST·PUT /api/cohorts/{cohortId}/questions 요청 본문 - 필드·검증 동일 (PUT 은 전체 교체). title 200자·content 10000자, 둘 다 필수 */
export interface QuestionPayload {
  title: string
  content: string
}

/** GET·POST·PUT /api/cohorts/{id}/questions/{qid}/answers 응답 - 오래된 순(대화 흐름). canEdit·canDelete 는 질문과 같은 규칙 */
export interface AnswerResponse {
  id: number
  content: string
  author: UserSummary
  createdAt: string
  canEdit: boolean
  canDelete: boolean
}

/** POST·PUT 답변 요청 - content 10000자 필수 */
export interface AnswerPayload {
  content: string
}

/** 공지 대상 분반 요약 - 전체 공지면 응답의 cohort 가 null */
export interface NoticeCohortSummary {
  id: number
  name: string
}

/** GET·POST·PUT /api/notices… 응답이 전부 이 하나 (docs/notice/api.md 3절). 목록은 서버가 가시성·정렬(필독 먼저)을 정한 그대로 */
export interface NoticeResponse {
  id: number
  title: string
  content: string
  /** 필독 - 목록 최상단 고정 + "필독" 배지 */
  pinned: boolean
  /** 분반 공지면 대상 분반, 전체 공지면 null */
  cohort: NoticeCohortSummary | null
  author: UserSummary
  createdAt: string
  /** 전체 공지: 관리자 / 분반 공지: 분반 ACTIVE && 그 분반 운영진 이상 - 프론트는 이 값만 보고 수정 버튼 분기 */
  canEdit: boolean
  /** canEdit 과 같은 규칙 (공지는 관리 권한이 곧 수정·삭제 권한) */
  canDelete: boolean
}

/** POST /api/notices(전체, 관리자) · POST /api/cohorts/{id}/notices(분반) · PUT /api/notices/{id} 요청 - 필드·검증 동일. title 200·content 10000 필수 */
export interface NoticePayload {
  title: string
  content: string
  pinned: boolean
}

/** 출석 판정 3종 - 서버 값. "미확인"은 상태가 아니라 기록 없음(null) (docs/attendance/design.md 결정 2). GET /api/cohorts/{id}/sessions… */
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT'

/** GET·POST·PUT /api/cohorts/{id}/sessions 응답 - 차시(수업 회차). heldOn 은 KST 달력일 yyyy-MM-dd */
export interface SessionResponse {
  id: number
  sessionNo: number
  title: string | null
  heldOn: string
  createdAt: string
  /** 이 차시의 출석 기록 수 - 삭제 경고용 */
  attendanceCount: number
}

/** POST·PUT 차시 요청 - 등록 때 sessionNo null 이면 자동 채번(최대 + 1). 번호 중복은 409 */
export interface SessionPayload {
  sessionNo: number | null
  title: string | null
  heldOn: string
}

/** 출석 집계 - 차시 요약·학생 누계 공용. rate = 출석 ÷ 판정된 차시 × 100(정수), 판정 0건이면 null. 프론트 재계산 금지 */
export interface AttendanceStats {
  present: number
  late: number
  absent: number
  unchecked: number
  rate: number | null
}

/** 차시 명부 행 (운영진) - user 는 loginId 포함(표시 요청에 필요), stats 는 이 학생의 분반 누계 */
export interface AttendanceRow {
  user: UserResponse
  status: AttendanceStatus | null
  checkedAt: string | null
  stats: AttendanceStats
}

/** GET·PUT /api/cohorts/{id}/sessions/{sid}/attendances 응답 - 표시 응답도 이 모양(재조회 불필요) */
export interface AttendanceRosterResponse {
  session: SessionResponse
  summary: AttendanceStats
  rows: AttendanceRow[]
}

/** PUT 표시 요청 - 차시 단위 일괄 upsert. status null 은 기록 삭제(미확인으로) */
export interface AttendanceMarkPayload {
  records: { loginId: string; status: AttendanceStatus | null }[]
}

/** GET /api/cohorts/{id}/attendances/me 응답 - 누계 + 차시별 기록(최신 차시 먼저) */
export interface MyAttendanceResponse {
  summary: AttendanceStats
  records: { session: SessionResponse; status: AttendanceStatus | null; checkedAt: string | null }[]
}

/** 모든 에러 응답의 공통 모양 */
export interface ErrorResponse {
  code: string
  message: string
}

// ---- 자동 채점 (docs judge/api.md) ----------------------------------------------------------------

/** 채점 진행 상태 - PENDING(대기) → RUNNING → DONE(판정 있음) / ERROR(엔진 장애 - verdict JUDGE_ERROR) */
export type JudgeStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR'

/** 판정 7종 (judge/design.md 결정 4) - 서버 값 그대로 표시, 재계산 금지 */
export type Verdict = 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT' | 'MEMORY_LIMIT' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'JUDGE_ERROR'

/** 케이스 1개의 결과 - 공개 케이스만 입력·기대 출력·실제 출력이 실린다(운영진에게도 같은 규칙) */
export interface JudgeCaseView {
  position: number
  verdict: Verdict
  timeMs: number | null
  memoryKb: number | null
  isPublic: boolean
  input: string | null
  expectedOutput: string | null
  /** 4KB 로 잘림(truncated) */
  actualOutput: string | null
  truncated: boolean
}

/** 제출 응답의 judge 필드 */
export interface JudgeResultResponse {
  status: JudgeStatus
  verdict: Verdict | null
  passedCases: number
  totalCases: number
  maxTimeMs: number | null
  maxMemoryKb: number | null
  /** 컴파일 에러 메시지(8KB) 또는 채점 오류 사유 */
  compileOutput: string | null
  cases: JudgeCaseView[]
  judgedAt: string | null
}

export interface TestCaseResponse {
  id: number
  position: number
  input: string
  expectedOutput: string
  isPublic: boolean
}

export interface TestCasePayload {
  input: string
  expectedOutput: string
  isPublic: boolean
}

/** GET·PUT .../judge (#47·#48) - 설정 + 케이스 전체(비공개 포함) + 폼 안내용 기본값·상한·지원 언어 */
export interface JudgeConfigResponse {
  enabled: boolean
  /** 엔진 연결 여부 - false 면 저장은 되지만 제출은 채점 대기, 실행(#49)은 503 */
  engineAvailable: boolean
  timeLimitMs: number
  memoryLimitMb: number
  defaultTimeLimitMs: number
  defaultMemoryLimitMb: number
  maxTimeLimitMs: number
  maxMemoryLimitMb: number
  maxTestCases: number
  languages: string[]
  testCases: TestCaseResponse[]
  /** 이 과제의 코드 제출 건수 = 재채점 대상 */
  affectedSubmissions: number
  /** #48 에서 실제로 재채점 큐에 넣은 건수 */
  rejudgeQueued: number
}

/** PUT .../judge 본문 - 통째 교체. testCases 빈 배열 = 자동 채점 해제. 제한 null = 서버 기본값 */
export interface JudgeConfigPayload {
  timeLimitMs: number | null
  memoryLimitMb: number | null
  testCases: TestCasePayload[]
  rejudge: boolean
}

/** POST .../judge/run (#49) - 저장 없이 정답 코드 실행. expectedOutputs 가 있으면 판정까지 */
export interface JudgeRunPayload {
  language: string
  sourceCode: string
  inputs: string[]
  expectedOutputs: string[] | null
  timeLimitMs: number | null
  memoryLimitMb: number | null
}

export interface JudgeRunResponse {
  /** 컴파일 에러 메시지 - 성공이면 null */
  compileOutput: string | null
  runs: {
    index: number
    stdout: string
    stderr: string
    /** expectedOutputs 를 준 경우의 판정. 없어도 실행 실패(TLE 등)는 값 */
    verdict: Verdict | null
    timeMs: number | null
    memoryKb: number | null
  }[]
}

/** GET .../judge/samples (#50) - 공개 케이스(예시)·제한·지원 언어. 소속 누구나 */
export interface JudgeSamplesResponse {
  enabled: boolean
  timeLimitMs: number
  memoryLimitMb: number
  languages: string[]
  samples: { position: number; input: string; expectedOutput: string }[]
}

/** POST .../judge/rejudge (#51) - 202 */
export interface RejudgeResponse {
  queued: number
}

// ---- 문제 번들 가져오기 (관리자) - HOJ 레포 ondal-problems 의 빌드 산출물 ----------------------

/** 번들의 문제 한 건 - 번호가 키. 서버 ProblemImportRequest.ImportProblem 미러 */
export interface ProblemImportItem {
  problemNo: number
  title: string
  description?: string | null
  difficulty?: number | null
  allowedLanguages?: string[]
  /** 태그 이름 - 없으면 서버가 만든다 */
  tags?: string[]
  timeLimitMs?: number | null
  memoryLimitMb?: number | null
  testCases?: TestCasePayload[]
}

/** POST /api/problems/import */
export interface ProblemImportRequest {
  problems: ProblemImportItem[]
  /** 같은 번호가 있을 때 덮어쓸지 - false 면 건너뜀 */
  overwrite: boolean
}

export interface ProblemImportResult {
  created: number
  updated: number
  skipped: number
  createdTags: string[]
  problemNos: number[]
}

/** GET /api/problems/import/github (관리자) - 서버가 어느 레포·브랜치에서 가져오도록 설정돼 있는지. configured=false 면 파일 업로드만 가능 */
export interface ProblemBankSource {
  configured: boolean
  repo: string
  ref: string
}

/** 깃허브 가져오기 완료 결과 - 어느 커밋을 가져왔는지 + 가져오기 집계(파일 업로드와 같은 규칙) */
export interface ProblemBankSyncResult {
  repo: string
  ref: string
  commitSha: string
  problemsInRepo: number
  importedAt: string
  result: ProblemImportResult
}

/**
 * 깃허브 가져오기 작업 상태 - POST /api/problems/import/github 는 작업을 시작하고 이 상태를 돌려준다(202), 화면은 GET .../status 를 폴링.
 * 수 초~수십 초 걸리는 일이라 요청 하나로 기다리면 프록시가 끊는다. 상태는 서버 메모리 - 재시작하면 IDLE
 */
export interface ProblemBankSyncStatus {
  state: 'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'
  step: string | null
  processed: number
  total: number
  startedAt: string | null
  finishedAt: string | null
  fetchMs: number | null
  importMs: number | null
  overwrite: boolean
  requestedBy: string | null
  /** DONE 일 때 */
  outcome: ProblemBankSyncResult | null
  /** FAILED 일 때 */
  error: { code: string; message: string } | null
}

// ---- 마이페이지 ------------------------------------------------------------------------------

/** GET /api/me/stats - 본인 활동 요약. 점수·랭킹 없음 */
export interface MyStatsResponse {
  /** 계정 생성 시각(UTC) - 첫 로그인 또는 선등록 시각 */
  joinedAt: string
  /** 분반 과제 제출 건수 (재제출 포함) */
  assignmentSubmissions: number
  /** HOJ 연습 제출 건수 (재제출 포함) */
  practiceSubmissions: number
  /** 맞힌 문제 수 - 과제·연습 어느 쪽이든 정답 판정을 받은 문제 */
  solvedProblems: number
}
