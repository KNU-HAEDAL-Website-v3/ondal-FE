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

/** GET·POST·PUT /api/cohorts/{cohortId}/assignments - 목록·단건·등록·수정 응답이 전부 이 하나 */
export interface AssignmentResponse {
  id: number
  /** 차시 번호 - 차시에 속하지 않는 과제는 null. 목록은 차시 오름차순(null 마지막) → 등록순 (서버 정렬) */
  sessionNo: number | null
  title: string
  /** 과제 내용 - 문제 링크를 포함한 자유 텍스트 (선택) */
  description: string | null
  /** 마감 시각(UTC) - KST 변환 표시는 프론트 몫. 지각 판정은 서버가 이 값으로 계산 */
  dueAt: string
  createdAt: string
}

/** POST·PUT /api/cohorts/{cohortId}/assignments 요청 본문 - 필드·검증 동일 (PUT은 전체 교체) */
export interface AssignmentPayload {
  sessionNo: number | null
  title: string
  description: string | null
  dueAt: string
}

/** 모든 에러 응답의 공통 모양 */
export interface ErrorResponse {
  code: string
  message: string
}
