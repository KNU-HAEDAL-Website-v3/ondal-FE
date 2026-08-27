// 백엔드 DTO 미러 - 계약의 기준은 BE springdoc(OpenAPI). 여기 타입은 그 요약본이다.
// 필드가 필요하면 프론트에서 조합하지 말고 BE에 API 변경을 요청한다 (CLAUDE.md).

export type GlobalRole = 'ADMIN' | 'MEMBER'
export type EnrollmentRole = 'OPERATOR' | 'STUDENT'
export type CohortStatus = 'ACTIVE' | 'ARCHIVED'

/**
 * 직책 명칭 - 서버(RoleTitle)가 정한 표시 문자열을 그대로 쓴다: '해구르르' | '교육운영진' | '일반 수강생'.
 * 프론트는 자체 매핑을 갖지 않는다 (명칭이 바뀌어도 서버만 고치면 됨).
 */
export type RoleTitle = string

/** GET /api/auth/me, POST /api/auth/login - 본인 정보 */
export interface UserResponse {
  id: number
  loginId: string
  name: string
  globalRole: GlobalRole
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

/** 제출 상태 4종 - 서버 계산값. 프론트 재계산 금지, 배지 매핑만 한다 (CLAUDE.md 규칙 4) */
export type SubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'SUBMITTED_EXTRA' | 'LATE'

/** GET·POST·PUT /api/cohorts/{cohortId}/assignments - 목록·단건·등록·수정 응답이 전부 이 하나 */
export interface AssignmentResponse {
  id: number
  /** 문제 번호 - 전역 유일, 1000부터. 표시는 #1000 형식 (schema.md 결정 9) */
  problemNo: number
  /** 차시 번호 - 차시에 속하지 않는 과제는 null. 목록은 차시 오름차순(null 마지막) → 등록순 (서버 정렬) */
  sessionNo: number | null
  title: string
  /** 과제 내용 - 문제 링크를 포함한 자유 텍스트 (선택) */
  description: string | null
  /** 마감 시각(UTC) - KST 변환 표시는 프론트 몫. 지각 판정은 서버가 이 값으로 계산 */
  dueAt: string
  createdAt: string
  /** 요청자 본인의 제출 상태 - 분반 비소속(비소속 관리자)이면 null */
  myStatus: SubmissionStatus | null
  /** 제출 이력 총 건수 - 운영진·관리자만 값, 수강생은 null. 삭제 확인 창의 "제출물 N건" 경고에 사용 */
  submissionCount: number | null
}

/** POST·PUT /api/cohorts/{cohortId}/assignments 요청 본문 - 필드·검증 동일 (PUT은 전체 교체) */
export interface AssignmentPayload {
  /** 등록: 비우면(null) 자동 채번. 수정: 비우면 기존 번호 유지. 중복은 409 */
  problemNo: number | null
  sessionNo: number | null
  title: string
  description: string | null
  dueAt: string
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
}

/** GET .../status-board(#22) 행 - 현재 수강생 명단(이름순), 미제출자 포함 */
export interface StatusBoardRow {
  user: UserSummary
  status: SubmissionStatus
  submissionCount: number
  lastSubmittedAt: string | null
  /** 최신 제출 id - 상세(#20)·파일(#21) 진입용. 제출 없으면 null */
  latestSubmissionId: number | null
}

/** 모든 에러 응답의 공통 모양 */
export interface ErrorResponse {
  code: string
  message: string
}
