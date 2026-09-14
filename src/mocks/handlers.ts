// MSW 핸들러 - BE 계약(design.md 3절)을 흉내 낸다. 화면 미리보기용이지 계약의 기준이 아니다.
import { delay, http, HttpResponse } from 'msw'
import type {
  AnswerResponse,
  AssignmentResponse,
  AttendanceRosterResponse,
  AttendanceStats,
  AttendanceStatus,
  CohortResponse,
  CohortStatus,
  ErrorResponse,
  LogoutResponse,
  MemberResponse,
  MyAttendanceResponse,
  NoticeResponse,
  QuestionResponse,
  SessionResponse,
  StatusBoardRow,
  SubmissionResponse,
  SubmissionStatus,
  SubmissionSummary,
  UserResponse,
  UserSummary,
} from '@/api/types'
import {
  answers,
  assignments,
  attendances,
  cohorts,
  enrollments,
  notices,
  questions,
  sessions,
  submissions,
  users,
  type MockAnswer,
  type MockAssignment,
  type MockAttendance,
  type MockCohort,
  type MockEnrollment,
  type MockNotice,
  type MockQuestion,
  type MockSession,
  type MockSubmission,
  type MockUser,
} from './data'

const SESSION_KEY = 'ondal-mock-session' // 새로고침해도 로그인이 유지되도록 sessionStorage에 loginId 보관

function currentUser(): MockUser | null {
  const loginId = sessionStorage.getItem(SESSION_KEY)
  return loginId ? (users.find((u) => u.loginId === loginId) ?? null) : null
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json<ErrorResponse>({ code, message }, { status })
}

const unauthenticated = () => error(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')

function toUserResponse(u: MockUser): UserResponse {
  return { id: u.id, loginId: u.loginId, name: u.name, globalRole: u.globalRole }
}

/** BE RoleTitle.of - ADMIN이면 어디서든 해구르르 → OPERATOR면 교육운영진 → 나머지 */
function titleOf(user: MockUser, cohortId: number): string {
  if (user.globalRole === 'ADMIN') return '해구르르'
  const e = enrollments.find((x) => x.cohortId === cohortId && x.loginId === user.loginId)
  return e?.role === 'OPERATOR' ? '교육운영진' : '일반 수강생'
}

/** BE CohortResponseAssembler - 보는 사람(viewer)에 따라 studentCount·myRole·canManage가 달라진다 */
function toCohortResponse(cohort: MockCohort, viewer: MockUser): CohortResponse {
  const mine = enrollments.find((e) => e.cohortId === cohort.id && e.loginId === viewer.loginId)
  const isAdmin = viewer.globalRole === 'ADMIN'
  const isOperator = mine?.role === 'OPERATOR'
  const operators: UserSummary[] = enrollments
    .filter((e) => e.cohortId === cohort.id && e.role === 'OPERATOR')
    .map((e) => users.find((u) => u.loginId === e.loginId)!)
    .map((u) => ({ id: u.id, name: u.name, title: titleOf(u, cohort.id) }))
  const studentCount = enrollments.filter((e) => e.cohortId === cohort.id && e.role === 'STUDENT').length
  return {
    ...cohort,
    operators,
    studentCount: isAdmin || isOperator ? studentCount : null,
    myRole: mine?.role ?? null,
    myTitle: titleOf(viewer, cohort.id),
    canManage: cohort.status === 'ACTIVE' && (isAdmin || isOperator),
  }
}

/**
 * BE 권한 판정 요약 - ADMIN 통과, 그 외 소속 확인(requireOperator면 OPERATOR만).
 * 비소속은 분반 존재와 무관하게 403(존재 비노출), ADMIN인데 분반이 없으면 404.
 * 통과 시 분반을 돌려준다.
 */
function cohortGuard(
  user: MockUser,
  cohortId: number,
  requireOperator: boolean,
): { cohort: MockCohort } | { fail: HttpResponse<ErrorResponse> } {
  if (!Number.isInteger(cohortId)) return { fail: error(400, 'INVALID_INPUT', '잘못된 분반 id 입니다.') }
  const cohort = cohorts.find((c) => c.id === cohortId)
  if (user.globalRole !== 'ADMIN') {
    const mine = enrollments.find((e) => e.cohortId === cohortId && e.loginId === user.loginId)
    if (!mine || (requireOperator && mine.role !== 'OPERATOR')) {
      return { fail: error(403, 'FORBIDDEN', '이 분반에 접근할 권한이 없습니다.') }
    }
  }
  if (!cohort) return { fail: error(404, 'NOT_FOUND', '분반을 찾을 수 없습니다.') }
  return { cohort }
}

/** BE SubmissionStatus.from - ISO 문자열은 같은 포맷(UTC Z)이라 사전순 비교 = 시간순 비교 */
function statusOf(assignment: MockAssignment, loginId: string): SubmissionStatus {
  const mine = submissions.filter((s) => s.assignmentId === assignment.id && s.loginId === loginId)
  const onTime = mine.some((s) => s.submittedAt <= assignment.dueAt)
  const late = mine.some((s) => s.submittedAt > assignment.dueAt)
  if (onTime && late) return 'SUBMITTED_EXTRA'
  if (onTime) return 'SUBMITTED'
  if (late) return 'LATE'
  return 'NOT_SUBMITTED'
}

/** BE AssignmentResponseAssembler - myStatus는 소속자만, submissionCount는 운영진·관리자만 */
function toAssignmentResponse(a: MockAssignment, viewer: MockUser): AssignmentResponse {
  const mine = enrollments.find((e) => e.cohortId === a.cohortId && e.loginId === viewer.loginId)
  const canSeeCount = viewer.globalRole === 'ADMIN' || mine?.role === 'OPERATOR'
  return {
    id: a.id,
    problemNo: a.problemNo,
    sessionNo: a.sessionNo,
    title: a.title,
    description: a.description,
    dueAt: a.dueAt,
    createdAt: a.createdAt,
    myStatus: mine ? statusOf(a, viewer.loginId) : null,
    submissionCount: canSeeCount ? submissions.filter((s) => s.assignmentId === a.id).length : null,
  }
}

/** BE 요청 검증 흉내 - title 필수·200자, description 10000자, dueAt 필수, sessionNo 1 이상·problemNo 1000 이상(선택) */
function parseAssignmentBody(
  raw: unknown,
): { payload: Omit<MockAssignment, 'id' | 'cohortId' | 'createdAt' | 'problemNo'> & { problemNo: number | null } } | { fail: HttpResponse<ErrorResponse> } {
  const body = (raw ?? {}) as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title : ''
  if (title.trim() === '') return { fail: error(400, 'INVALID_INPUT', '과제 제목은 비어 있을 수 없습니다.') }
  if (title.length > 200) return { fail: error(400, 'INVALID_INPUT', '과제 제목은 200자 이하여야 합니다.') }
  const description = typeof body.description === 'string' ? body.description : null
  if (description !== null && description.length > 10000) {
    return { fail: error(400, 'INVALID_INPUT', '과제 내용은 10000자 이하여야 합니다.') }
  }
  if (typeof body.dueAt !== 'string' || Number.isNaN(Date.parse(body.dueAt))) {
    return { fail: error(400, 'INVALID_INPUT', '마감 시각은 비어 있을 수 없습니다.') }
  }
  const sessionNo = body.sessionNo === null || body.sessionNo === undefined ? null : Number(body.sessionNo)
  if (sessionNo !== null && (!Number.isInteger(sessionNo) || sessionNo < 1)) {
    return { fail: error(400, 'INVALID_INPUT', '차시 번호는 1 이상이어야 합니다.') }
  }
  const problemNo = body.problemNo === null || body.problemNo === undefined ? null : Number(body.problemNo)
  if (problemNo !== null && (!Number.isInteger(problemNo) || problemNo < 1000)) {
    return { fail: error(400, 'INVALID_INPUT', '문제 번호는 1000 이상이어야 합니다.') }
  }
  return { payload: { problemNo, sessionNo, title, description, dueAt: new Date(body.dueAt).toISOString() } }
}

const archivedError = () =>
  error(409, 'COHORT_ARCHIVED', '보관된 분반은 변경할 수 없습니다. 보관을 해제한 뒤 다시 시도하세요.')

// ---- 분반 관리·명부 헬퍼 -------------------------------------------------------------------

/** BE @AdminOnly - 관리자가 아니면 403 */
const forbiddenAdmin = () => error(403, 'FORBIDDEN', '관리자만 사용할 수 있습니다.')

/** BE UserService.findOrCreateMember - 모르는 loginId 는 MEMBER 로 선등록 (이름 = loginId) */
function findOrCreateUser(loginId: string): MockUser {
  let user = users.find((u) => u.loginId === loginId)
  if (!user) {
    user = { id: Math.max(0, ...users.map((u) => u.id)) + 1, loginId, name: loginId, globalRole: 'MEMBER' }
    users.push(user)
  }
  return user
}

/** loginId 검증 - @NotBlank·@Size(50) 미러. 목록이면 @NotEmpty 도 */
function validateLoginIds(raw: unknown, allowEmpty: boolean): { ids: string[] } | { fail: HttpResponse<ErrorResponse> } {
  if (!Array.isArray(raw)) return { fail: error(400, 'INVALID_INPUT', 'loginIds는 비어 있을 수 없습니다.') }
  if (!allowEmpty && raw.length === 0) return { fail: error(400, 'INVALID_INPUT', 'loginIds는 비어 있을 수 없습니다.') }
  const ids: string[] = []
  for (const item of raw) {
    const id = typeof item === 'string' ? item.trim() : ''
    if (!id) return { fail: error(400, 'INVALID_INPUT', 'loginId는 비어 있을 수 없습니다.') }
    if (id.length > 50) return { fail: error(400, 'INVALID_INPUT', 'loginId는 50자 이하여야 합니다.') }
    ids.push(id)
  }
  return { ids }
}

function toMemberResponse(e: MockEnrollment): MemberResponse {
  const user = users.find((u) => u.loginId === e.loginId)!
  const cohort = cohorts.find((c) => c.id === e.cohortId)
  return {
    user: toUserResponse(user),
    role: e.role,
    title: titleOf(user, e.cohortId),
    enrolledAt: e.enrolledAt ?? cohort?.createdAt ?? new Date(0).toISOString(),
  }
}

/** 명부 - 운영진 먼저(서버 정렬), 같은 역할 안에서는 등록 순서 */
function membersOf(cohortId: number): MemberResponse[] {
  return enrollments
    .filter((e) => e.cohortId === cohortId)
    .sort((a, b) => Number(a.role === 'STUDENT') - Number(b.role === 'STUDENT'))
    .map(toMemberResponse)
}

/**
 * BE EnrollmentService.assign - 없는 사람은 만들고, 같은 role 이면 그대로(멱등), 다른 role 로 소속이면 409 (전체 롤백 - 아무도 배정되지 않음).
 * 트랜잭션 미러: 충돌을 먼저 전부 검사한 뒤 반영한다
 */
function assignRole(cohort: MockCohort, loginIds: string[], role: MockEnrollment['role']): HttpResponse<ErrorResponse> | null {
  const unique = [...new Set(loginIds)]
  for (const loginId of unique) {
    const existing = enrollments.find((e) => e.cohortId === cohort.id && e.loginId === loginId)
    if (existing && existing.role !== role) {
      return error(409, 'CONFLICT', `이미 ${existing.role} 로 소속된 사용자입니다: ${loginId}`)
    }
  }
  const now = new Date().toISOString()
  for (const loginId of unique) {
    findOrCreateUser(loginId)
    if (!enrollments.some((e) => e.cohortId === cohort.id && e.loginId === loginId)) {
      enrollments.push({ cohortId: cohort.id, loginId, role, enrolledAt: now })
    }
  }
  return null
}

/** 분반 쓰기 3종(수정·명부 변경)의 공통 앞부분 - 404 → 보관 409 */
function requireActiveCohort(cohortId: number): { cohort: MockCohort } | { fail: HttpResponse<ErrorResponse> } {
  const cohort = cohorts.find((c) => c.id === cohortId)
  if (!cohort) return { fail: error(404, 'NOT_FOUND', '분반을 찾을 수 없습니다.') }
  if (cohort.status === 'ARCHIVED') return { fail: archivedError() }
  return { cohort }
}

// ---- 공지 헬퍼 ------------------------------------------------------------------------

/** BE NoticeService.requireManage / Assembler canManage - 전체: 관리자 / 분반: ACTIVE && (관리자 || 그 분반 운영진) */
function canManageNotice(n: MockNotice, viewer: MockUser): boolean {
  if (n.cohortId === null) return viewer.globalRole === 'ADMIN'
  const cohort = cohorts.find((c) => c.id === n.cohortId)
  if (!cohort || cohort.status !== 'ACTIVE') return false
  const mine = enrollments.find((e) => e.cohortId === n.cohortId && e.loginId === viewer.loginId)
  return viewer.globalRole === 'ADMIN' || mine?.role === 'OPERATOR'
}

/** 가시성 - 전체 공지는 누구나, 분반 공지는 소속자·관리자 */
function canViewNotice(n: MockNotice, viewer: MockUser): boolean {
  if (n.cohortId === null || viewer.globalRole === 'ADMIN') return true
  return enrollments.some((e) => e.cohortId === n.cohortId && e.loginId === viewer.loginId)
}

function toNoticeResponse(n: MockNotice, viewer: MockUser): NoticeResponse {
  const cohort = n.cohortId === null ? null : (cohorts.find((c) => c.id === n.cohortId) ?? null)
  const author = users.find((u) => u.loginId === n.loginId)!
  const canManage = canManageNotice(n, viewer)
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    cohort: cohort ? { id: cohort.id, name: cohort.name } : null,
    // 전체 공지 작성자는 분반 역할 없이(관리자 → 해구르르), 분반 공지 작성자는 그 분반 역할 기준
    author: { id: author.id, name: author.name, title: titleOf(author, n.cohortId ?? 0) },
    createdAt: n.createdAt,
    canEdit: canManage,
    canDelete: canManage,
  }
}

/** 필독 먼저 → 최신순 → id desc (notice/design.md 결정 6) */
const byNoticeOrder = (a: MockNotice, b: MockNotice) =>
  Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id

/** 등록·수정 공통 검증 - BE NoticeCreateRequest·NoticeUpdateRequest 미러 (pinned 생략 = false) */
function parseNoticeBody(
  raw: unknown,
): { payload: { title: string; content: string; pinned: boolean } } | { fail: HttpResponse<ErrorResponse> } {
  const body = (raw ?? {}) as { title?: unknown; content?: unknown; pinned?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!title) return { fail: error(400, 'INVALID_INPUT', '공지 제목은 비어 있을 수 없습니다.') }
  if (title.length > 200) return { fail: error(400, 'INVALID_INPUT', '공지 제목은 200자 이하여야 합니다.') }
  if (!content) return { fail: error(400, 'INVALID_INPUT', '공지 내용은 비어 있을 수 없습니다.') }
  if (content.length > 10000) return { fail: error(400, 'INVALID_INPUT', '공지 내용은 10000자 이하여야 합니다.') }
  return { payload: { title, content, pinned: body.pinned === true } }
}

/** 수정·삭제 앞부분 - 404 → (분반 공지) 보관 409 → 관리 권한 403 */
function requireManageableNotice(noticeId: number, user: MockUser): { notice: MockNotice; index: number } | { fail: HttpResponse<ErrorResponse> } {
  const index = notices.findIndex((n) => n.id === noticeId)
  if (index < 0) return { fail: error(404, 'NOT_FOUND', '공지를 찾을 수 없습니다.') }
  const notice = notices[index]
  if (notice.cohortId !== null && cohorts.find((c) => c.id === notice.cohortId)?.status === 'ARCHIVED') return { fail: archivedError() }
  if (!canManageNotice(notice, user)) return { fail: error(403, 'FORBIDDEN', '권한이 없습니다.') }
  return { notice, index }
}

// ---- 출석 헬퍼 ------------------------------------------------------------------------

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT']

/** BE AttendanceStats.of - rate = 출석 ÷ 판정 × 100 정수, 판정 0건 null. total 은 기준 개수(명단 수 또는 차시 수) */
function attendanceStats(records: MockAttendance[], total: number): AttendanceStats {
  const present = records.filter((a) => a.status === 'PRESENT').length
  const late = records.filter((a) => a.status === 'LATE').length
  const absent = records.filter((a) => a.status === 'ABSENT').length
  const decided = present + late + absent
  return { present, late, absent, unchecked: Math.max(0, total - decided), rate: decided === 0 ? null : Math.round((present * 100) / decided) }
}

function toSessionResponse(s: MockSession): SessionResponse {
  return { ...s, attendanceCount: attendances.filter((a) => a.sessionId === s.id).length }
}

/** 날짜 → 번호 오름차순 (서버 정렬) */
function cohortSessions(cohortId: number): MockSession[] {
  return sessions.filter((s) => s.cohortId === cohortId).sort((a, b) => a.heldOn.localeCompare(b.heldOn) || a.sessionNo - b.sessionNo)
}

/** 명부 행 = 현재 STUDENT 명단, 이름순 (운영진 제외) */
function studentsOf(cohortId: number): MockUser[] {
  return enrollments
    .filter((e) => e.cohortId === cohortId && e.role === 'STUDENT')
    .map((e) => users.find((u) => u.loginId === e.loginId)!)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

function rosterOf(cohortId: number, session: MockSession): AttendanceRosterResponse {
  const students = studentsOf(cohortId)
  const sessionIds = new Set(cohortSessions(cohortId).map((s) => s.id))
  const cohortRecords = attendances.filter((a) => sessionIds.has(a.sessionId))
  const rows = students.map((u) => {
    const mine = attendances.find((a) => a.sessionId === session.id && a.loginId === u.loginId)
    return {
      user: toUserResponse(u),
      status: mine?.status ?? null,
      checkedAt: mine?.checkedAt ?? null,
      stats: attendanceStats(cohortRecords.filter((a) => a.loginId === u.loginId), sessionIds.size),
    }
  })
  const onRoster = attendances.filter((a) => a.sessionId === session.id && students.some((u) => u.loginId === a.loginId))
  return { session: toSessionResponse(session), summary: attendanceStats(onRoster, rows.length), rows }
}

/** 차시 등록·수정 검증 - BE SessionCreateRequest/UpdateRequest 미러 */
function parseSessionBody(
  raw: unknown,
  requireNo: boolean,
): { payload: { sessionNo: number | null; title: string | null; heldOn: string } } | { fail: HttpResponse<ErrorResponse> } {
  const body = (raw ?? {}) as { sessionNo?: unknown; title?: unknown; heldOn?: unknown }
  const sessionNo = body.sessionNo === null || body.sessionNo === undefined ? null : Number(body.sessionNo)
  if (sessionNo === null && requireNo) return { fail: error(400, 'INVALID_INPUT', '차시 번호는 비어 있을 수 없습니다.') }
  if (sessionNo !== null && (!Number.isInteger(sessionNo) || sessionNo < 1)) return { fail: error(400, 'INVALID_INPUT', '차시 번호는 1 이상이어야 합니다.') }
  const title = typeof body.title === 'string' && body.title.trim() !== '' ? body.title.trim() : null
  if (title !== null && title.length > 100) return { fail: error(400, 'INVALID_INPUT', '차시 제목은 100자 이하여야 합니다.') }
  if (typeof body.heldOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.heldOn)) {
    return { fail: error(400, 'INVALID_INPUT', '수업 날짜는 비어 있을 수 없습니다.') }
  }
  return { payload: { sessionNo, title, heldOn: body.heldOn } }
}

// ---- Q&A 헬퍼 ------------------------------------------------------------------------

/** BE QuestionResponseAssembler - canEdit(작성자 && ACTIVE), canDelete(canEdit || 운영진 이상 && ACTIVE). 작성자 직책은 이 분반 역할 기준 */
function toQuestionResponse(q: MockQuestion, cohort: MockCohort, viewer: MockUser): QuestionResponse {
  const active = cohort.status === 'ACTIVE'
  const mine = enrollments.find((e) => e.cohortId === cohort.id && e.loginId === viewer.loginId)
  const canModerate = active && (viewer.globalRole === 'ADMIN' || mine?.role === 'OPERATOR')
  const canEdit = active && q.loginId === viewer.loginId
  return {
    id: q.id,
    title: q.title,
    content: q.content,
    author: toUserSummary(q.loginId, cohort.id),
    createdAt: q.createdAt,
    canEdit,
    canDelete: canEdit || canModerate,
    answerCount: answers.filter((a) => a.questionId === q.id).length,
  }
}

/** BE AnswerResponseAssembler - 질문과 같은 규칙 */
function toAnswerResponse(a: MockAnswer, cohort: MockCohort, viewer: MockUser): AnswerResponse {
  const active = cohort.status === 'ACTIVE'
  const mine = enrollments.find((e) => e.cohortId === cohort.id && e.loginId === viewer.loginId)
  const canModerate = active && (viewer.globalRole === 'ADMIN' || mine?.role === 'OPERATOR')
  const canEdit = active && a.loginId === viewer.loginId
  return { id: a.id, content: a.content, author: toUserSummary(a.loginId, cohort.id), createdAt: a.createdAt, canEdit, canDelete: canEdit || canModerate }
}

/** 답변 본문 검증 - BE AnswerCreateRequest/UpdateRequest 미러 */
function parseAnswerBody(raw: unknown): { content: string } | { fail: HttpResponse<ErrorResponse> } {
  const body = (raw ?? {}) as { content?: unknown }
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return { fail: error(400, 'INVALID_INPUT', '답변 내용은 비어 있을 수 없습니다.') }
  if (content.length > 10000) return { fail: error(400, 'INVALID_INPUT', '답변 내용은 10000자 이하여야 합니다.') }
  return { content }
}

/** 등록·수정 공통 검증 - BE QuestionCreateRequest·QuestionUpdateRequest 미러 (title 200자·content 10000자, 둘 다 필수) */
function parseQuestionBody(
  raw: unknown,
): { payload: { title: string; content: string } } | { fail: HttpResponse<ErrorResponse> } {
  const body = (raw ?? {}) as { title?: unknown; content?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!title) return { fail: error(400, 'INVALID_INPUT', '질문 제목은 비어 있을 수 없습니다.') }
  if (title.length > 200) return { fail: error(400, 'INVALID_INPUT', '질문 제목은 200자 이하여야 합니다.') }
  if (!content) return { fail: error(400, 'INVALID_INPUT', '질문 내용은 비어 있을 수 없습니다.') }
  if (content.length > 10000) return { fail: error(400, 'INVALID_INPUT', '질문 내용은 10000자 이하여야 합니다.') }
  return { payload: { title, content } }
}

// ---- 제출 헬퍼 ----------------------------------------------------------------------

/** 업로드된 zip 실체 - 다운로드 응답용. 시드 제출에는 파일이 없다(브라우저 세션 안에서 올린 것만) */
const fileBlobs = new Map<number, Blob>()

/** cohortGuard + 과제 스코프 조회(불일치·부재 404) - 손자 리소스 체인의 mock 버전 */
function assignmentGuard(
  user: MockUser,
  cohortId: number,
  assignmentId: number,
  requireOperator: boolean,
): { cohort: MockCohort; assignment: MockAssignment } | { fail: HttpResponse<ErrorResponse> } {
  const guard = cohortGuard(user, cohortId, requireOperator)
  if ('fail' in guard) return guard
  const assignment = assignments.find((a) => a.id === assignmentId && a.cohortId === guard.cohort.id)
  if (!assignment) return { fail: error(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.') }
  return { cohort: guard.cohort, assignment }
}

function toUserSummary(loginId: string, cohortId: number): UserSummary {
  const found = users.find((u) => u.loginId === loginId)!
  return { id: found.id, name: found.name, title: titleOf(found, cohortId) }
}

function toSubmissionResponse(s: MockSubmission, a: MockAssignment, cohortId: number): SubmissionResponse {
  return {
    id: s.id,
    user: toUserSummary(s.loginId, cohortId),
    type: s.type,
    codeText: s.codeText,
    language: s.language,
    fileName: s.fileName,
    fileSize: s.fileSize,
    links: s.links,
    submittedAt: s.submittedAt,
    late: s.submittedAt > a.dueAt,
  }
}

function toSubmissionSummary(s: MockSubmission, a: MockAssignment): SubmissionSummary {
  return {
    id: s.id,
    type: s.type,
    language: s.language,
    fileName: s.fileName,
    fileSize: s.fileSize,
    links: s.links,
    submittedAt: s.submittedAt,
    late: s.submittedAt > a.dueAt,
  }
}

/** 스코프(과제) + 열람 권한(본인 또는 운영진·관리자)을 한 번에 - 불일치·타인 것은 null(404, 존재 비노출) */
function findViewableSubmission(
  user: MockUser,
  cohortId: number,
  assignmentId: number,
  submissionId: number,
): MockSubmission | null {
  const found = submissions.find((s) => s.id === submissionId && s.assignmentId === assignmentId)
  if (!found) return null
  if (found.loginId === user.loginId || user.globalRole === 'ADMIN') return found
  const mine = enrollments.find((e) => e.cohortId === cohortId && e.loginId === user.loginId)
  return mine?.role === 'OPERATOR' ? found : null
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(400)
    const body = (await request.json().catch(() => null)) as { loginId?: unknown } | null
    const loginId = typeof body?.loginId === 'string' ? body.loginId.trim() : ''
    if (!loginId) return error(400, 'INVALID_INPUT', 'loginId는 비어 있을 수 없습니다.')
    if (loginId.length > 50) return error(400, 'INVALID_INPUT', 'loginId는 50자 이하여야 합니다.')

    let user = users.find((u) => u.loginId === loginId)
    if (!user) {
      user = { id: users.length + 1, loginId, name: loginId, globalRole: 'MEMBER' } // find-or-create
      users.push(user)
    }
    sessionStorage.setItem(SESSION_KEY, user.loginId)
    return HttpResponse.json(toUserResponse(user))
  }),

  http.get('/api/auth/me', async () => {
    await delay(200)
    const user = currentUser()
    return user ? HttpResponse.json(toUserResponse(user)) : unauthenticated()
  }),

  http.post('/api/auth/logout', async () => {
    await delay(200)
    sessionStorage.removeItem(SESSION_KEY) // 세션이 없어도 조용히 성공
    const body: LogoutResponse = { logoutUrl: null } // 스텁 흐름 - 홈페이지(SSO) 로그아웃 주소 없음
    return HttpResponse.json(body)
  }),

  http.get('/api/me/cohorts', async () => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const mine = cohorts.filter((c) => enrollments.some((e) => e.cohortId === c.id && e.loginId === user.loginId))
    // 정렬: ACTIVE 먼저 → 최신순 (서버 규칙)
    mine.sort((a, b) => Number(a.status === 'ARCHIVED') - Number(b.status === 'ARCHIVED') || b.createdAt.localeCompare(a.createdAt))
    return HttpResponse.json(mine.map((c) => toCohortResponse(c, user)))
  }),

  http.get('/api/cohorts/:cohortId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const id = Number(params.cohortId)
    if (!Number.isInteger(id)) return error(400, 'INVALID_INPUT', '잘못된 분반 id 입니다.')
    const cohort = cohorts.find((c) => c.id === id)
    const isMember = enrollments.some((e) => e.cohortId === id && e.loginId === user.loginId)
    // 권한 판정 순서(BE): ADMIN이 아니고 소속도 아니면 존재 여부와 무관하게 403 (존재 비노출) / ADMIN인데 없으면 404
    if (user.globalRole !== 'ADMIN' && !isMember) return error(403, 'FORBIDDEN', '이 분반에 접근할 권한이 없습니다.')
    if (!cohort) return error(404, 'NOT_FOUND', '분반을 찾을 수 없습니다.')
    return HttpResponse.json(toCohortResponse(cohort, user))
  }),

  // ---- 분반 관리 (#2·#3·#5~#7, 관리자) --------------------------------------------------

  http.get('/api/cohorts', async ({ request }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const status = (new URL(request.url).searchParams.get('status') ?? 'ACTIVE') as CohortStatus
    if (status !== 'ACTIVE' && status !== 'ARCHIVED') return error(400, 'INVALID_INPUT', '잘못된 status 값입니다.')
    const list = cohorts.filter((c) => c.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return HttpResponse.json(list.map((c) => toCohortResponse(c, user)))
  }),

  http.post('/api/cohorts', async ({ request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const body = ((await request.json().catch(() => null)) ?? {}) as { name?: unknown; description?: unknown; operatorLoginIds?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return error(400, 'INVALID_INPUT', '분반 이름은 비어 있을 수 없습니다.')
    if (name.length > 100) return error(400, 'INVALID_INPUT', '분반 이름은 100자 이하여야 합니다.')
    const description = typeof body.description === 'string' && body.description.trim() !== '' ? body.description : null
    if (description !== null && description.length > 2000) return error(400, 'INVALID_INPUT', '설명은 2000자 이하여야 합니다.')
    const operators = validateLoginIds(body.operatorLoginIds ?? [], true)
    if ('fail' in operators) return operators.fail
    const created: MockCohort = {
      id: Math.max(0, ...cohorts.map((c) => c.id)) + 1,
      name,
      description,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }
    cohorts.push(created)
    assignRole(created, operators.ids, 'OPERATOR') // 새 분반이라 충돌 없음
    return HttpResponse.json(toCohortResponse(created, user), {
      status: 201,
      headers: { Location: `/api/cohorts/${created.id}` },
    })
  }),

  http.put('/api/cohorts/:cohortId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const body = ((await request.json().catch(() => null)) ?? {}) as { name?: unknown; description?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return error(400, 'INVALID_INPUT', '분반 이름은 비어 있을 수 없습니다.')
    if (name.length > 100) return error(400, 'INVALID_INPUT', '분반 이름은 100자 이하여야 합니다.')
    const description = typeof body.description === 'string' && body.description.trim() !== '' ? body.description : null
    if (description !== null && description.length > 2000) return error(400, 'INVALID_INPUT', '설명은 2000자 이하여야 합니다.')
    const target = requireActiveCohort(Number(params.cohortId))
    if ('fail' in target) return target.fail
    Object.assign(target.cohort, { name, description })
    return HttpResponse.json(toCohortResponse(target.cohort, user))
  }),

  http.post('/api/cohorts/:cohortId/archive', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const cohort = cohorts.find((c) => c.id === Number(params.cohortId))
    if (!cohort) return error(404, 'NOT_FOUND', '분반을 찾을 수 없습니다.')
    cohort.status = 'ARCHIVED' // 멱등
    return HttpResponse.json(toCohortResponse(cohort, user))
  }),

  http.post('/api/cohorts/:cohortId/restore', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const cohort = cohorts.find((c) => c.id === Number(params.cohortId))
    if (!cohort) return error(404, 'NOT_FOUND', '분반을 찾을 수 없습니다.')
    cohort.status = 'ACTIVE' // 멱등
    return HttpResponse.json(toCohortResponse(cohort, user))
  }),

  // ---- 명부·배정 (#8~#12, 운영진 이상 / 운영진 지정·해제는 관리자) ----------------------------

  http.get('/api/cohorts/:cohortId/members', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    return HttpResponse.json(membersOf(guard.cohort.id))
  }),

  http.post('/api/cohorts/:cohortId/students', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const body = ((await request.json().catch(() => null)) ?? {}) as { loginIds?: unknown }
    const parsed = validateLoginIds(body.loginIds, false)
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const conflict = assignRole(guard.cohort, parsed.ids, 'STUDENT')
    if (conflict) return conflict
    return HttpResponse.json(membersOf(guard.cohort.id)) // 갱신된 명부 전체
  }),

  http.delete('/api/cohorts/:cohortId/students/:loginId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const loginId = decodeURIComponent(String(params.loginId))
    const index = enrollments.findIndex((e) => e.cohortId === guard.cohort.id && e.loginId === loginId && e.role === 'STUDENT')
    if (index < 0) return error(404, 'NOT_FOUND', `해당 분반의 수강생이 아닙니다: ${loginId}`)
    enrollments.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.put('/api/cohorts/:cohortId/operators/:loginId', async ({ params }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const loginId = decodeURIComponent(String(params.loginId))
    if (loginId.length > 50) return error(400, 'INVALID_INPUT', 'loginId는 50자 이하여야 합니다.')
    const target = requireActiveCohort(Number(params.cohortId))
    if ('fail' in target) return target.fail
    findOrCreateUser(loginId)
    let enrollment = enrollments.find((e) => e.cohortId === target.cohort.id && e.loginId === loginId)
    if (!enrollment) {
      enrollment = { cohortId: target.cohort.id, loginId, role: 'OPERATOR', enrolledAt: new Date().toISOString() }
      enrollments.push(enrollment)
    } else {
      enrollment.role = 'OPERATOR' // 수강생이면 승격, 이미 운영진이면 그대로 (멱등)
    }
    return HttpResponse.json(toMemberResponse(enrollment))
  }),

  http.delete('/api/cohorts/:cohortId/operators/:loginId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const target = requireActiveCohort(Number(params.cohortId))
    if ('fail' in target) return target.fail
    const loginId = decodeURIComponent(String(params.loginId))
    const index = enrollments.findIndex((e) => e.cohortId === target.cohort.id && e.loginId === loginId && e.role === 'OPERATOR')
    if (index < 0) return error(404, 'NOT_FOUND', `해당 분반의 운영진이 아닙니다: ${loginId}`)
    enrollments.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- 공지사항 (#28~#33) ----------------------------------------------------------------

  http.get('/api/notices', async () => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const list = notices.filter((n) => canViewNotice(n, user)).sort(byNoticeOrder)
    return HttpResponse.json(list.map((n) => toNoticeResponse(n, user)))
  }),

  http.get('/api/notices/:noticeId', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const found = notices.find((n) => n.id === Number(params.noticeId))
    if (!found) return error(404, 'NOT_FOUND', '공지를 찾을 수 없습니다.')
    if (!canViewNotice(found, user)) return error(403, 'FORBIDDEN', '이 분반에 접근할 권한이 없습니다.')
    return HttpResponse.json(toNoticeResponse(found, user))
  }),

  http.post('/api/notices', async ({ request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    if (user.globalRole !== 'ADMIN') return forbiddenAdmin()
    const parsed = parseNoticeBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    const created: MockNotice = {
      id: Math.max(0, ...notices.map((n) => n.id)) + 1,
      cohortId: null,
      loginId: user.loginId,
      createdAt: new Date().toISOString(),
      ...parsed.payload,
    }
    notices.push(created)
    return HttpResponse.json(toNoticeResponse(created, user), { status: 201, headers: { Location: `/api/notices/${created.id}` } })
  }),

  http.post('/api/cohorts/:cohortId/notices', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const parsed = parseNoticeBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const created: MockNotice = {
      id: Math.max(0, ...notices.map((n) => n.id)) + 1,
      cohortId: guard.cohort.id,
      loginId: user.loginId,
      createdAt: new Date().toISOString(),
      ...parsed.payload,
    }
    notices.push(created)
    return HttpResponse.json(toNoticeResponse(created, user), { status: 201, headers: { Location: `/api/notices/${created.id}` } })
  }),

  http.put('/api/notices/:noticeId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const parsed = parseNoticeBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    const target = requireManageableNotice(Number(params.noticeId), user)
    if ('fail' in target) return target.fail
    Object.assign(target.notice, parsed.payload)
    return HttpResponse.json(toNoticeResponse(target.notice, user))
  }),

  http.delete('/api/notices/:noticeId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const target = requireManageableNotice(Number(params.noticeId), user)
    if ('fail' in target) return target.fail
    notices.splice(target.index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- 차시 (#34~#37, 목록 소속자 / 쓰기 운영진 이상) ----------------------------------------

  http.get('/api/cohorts/:cohortId/sessions', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    return HttpResponse.json(cohortSessions(guard.cohort.id).map(toSessionResponse))
  }),

  http.post('/api/cohorts/:cohortId/sessions', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const parsed = parseSessionBody(await request.json().catch(() => null), false)
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const existing = cohortSessions(guard.cohort.id)
    const sessionNo = parsed.payload.sessionNo ?? Math.max(0, ...existing.map((s) => s.sessionNo)) + 1
    if (existing.some((s) => s.sessionNo === sessionNo)) return error(409, 'CONFLICT', `이미 사용 중인 차시 번호입니다: ${sessionNo}`)
    const created: MockSession = {
      id: Math.max(0, ...sessions.map((s) => s.id)) + 1,
      cohortId: guard.cohort.id,
      sessionNo,
      title: parsed.payload.title,
      heldOn: parsed.payload.heldOn,
      createdAt: new Date().toISOString(),
    }
    sessions.push(created)
    return HttpResponse.json(toSessionResponse(created), {
      status: 201,
      headers: { Location: `/api/cohorts/${guard.cohort.id}/sessions/${created.id}` },
    })
  }),

  http.put('/api/cohorts/:cohortId/sessions/:sessionId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const parsed = parseSessionBody(await request.json().catch(() => null), true)
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const found = sessions.find((s) => s.id === Number(params.sessionId) && s.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '차시를 찾을 수 없습니다.')
    const sessionNo = parsed.payload.sessionNo!
    if (sessionNo !== found.sessionNo && cohortSessions(guard.cohort.id).some((s) => s.sessionNo === sessionNo)) {
      return error(409, 'CONFLICT', `이미 사용 중인 차시 번호입니다: ${sessionNo}`)
    }
    Object.assign(found, { sessionNo, title: parsed.payload.title, heldOn: parsed.payload.heldOn })
    return HttpResponse.json(toSessionResponse(found))
  }),

  http.delete('/api/cohorts/:cohortId/sessions/:sessionId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const index = sessions.findIndex((s) => s.id === Number(params.sessionId) && s.cohortId === guard.cohort.id)
    if (index < 0) return error(404, 'NOT_FOUND', '차시를 찾을 수 없습니다.')
    const sessionId = sessions[index].id
    for (let i = attendances.length - 1; i >= 0; i--) if (attendances[i].sessionId === sessionId) attendances.splice(i, 1) // 기록 연쇄 삭제
    sessions.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- 출석 (#38~#40, 명부·표시 운영진 이상 / 내 출석 소속자) ----------------------------------

  http.get('/api/cohorts/:cohortId/sessions/:sessionId/attendances', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const session = sessions.find((s) => s.id === Number(params.sessionId) && s.cohortId === guard.cohort.id)
    if (!session) return error(404, 'NOT_FOUND', '차시를 찾을 수 없습니다.')
    return HttpResponse.json(rosterOf(guard.cohort.id, session))
  }),

  http.put('/api/cohorts/:cohortId/sessions/:sessionId/attendances', async ({ params, request }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    const body = ((await request.json().catch(() => null)) ?? {}) as { records?: unknown }
    if (!Array.isArray(body.records) || body.records.length === 0) return error(400, 'INVALID_INPUT', 'records는 비어 있을 수 없습니다.')
    const last = new Map<string, AttendanceStatus | null>() // 같은 loginId 는 마지막 값
    for (const item of body.records as { loginId?: unknown; status?: unknown }[]) {
      const loginId = typeof item.loginId === 'string' ? item.loginId.trim() : ''
      if (!loginId) return error(400, 'INVALID_INPUT', 'loginId는 비어 있을 수 없습니다.')
      if (item.status !== null && item.status !== undefined && !ATTENDANCE_STATUSES.includes(item.status as AttendanceStatus)) {
        return error(400, 'INVALID_INPUT', '요청 본문을 읽을 수 없습니다.')
      }
      last.set(loginId, (item.status ?? null) as AttendanceStatus | null)
    }
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const session = sessions.find((s) => s.id === Number(params.sessionId) && s.cohortId === guard.cohort.id)
    if (!session) return error(404, 'NOT_FOUND', '차시를 찾을 수 없습니다.')
    const students = studentsOf(guard.cohort.id)
    for (const [loginId] of last) {
      if (!students.some((u) => u.loginId === loginId)) return error(404, 'NOT_FOUND', `해당 분반의 수강생이 아닙니다: ${loginId}`)
    }
    const now = new Date().toISOString()
    for (const [loginId, status] of last) {
      const index = attendances.findIndex((a) => a.sessionId === session.id && a.loginId === loginId)
      if (status === null) {
        if (index >= 0) attendances.splice(index, 1)
      } else if (index >= 0) {
        Object.assign(attendances[index], { status, checkedAt: now, checkedBy: user.loginId })
      } else {
        attendances.push({ sessionId: session.id, loginId, status, checkedAt: now, checkedBy: user.loginId })
      }
    }
    return HttpResponse.json(rosterOf(guard.cohort.id, session))
  }),

  http.get('/api/cohorts/:cohortId/attendances/me', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const list = cohortSessions(guard.cohort.id)
    const mine = attendances.filter((a) => a.loginId === user.loginId && list.some((s) => s.id === a.sessionId))
    const body: MyAttendanceResponse = {
      summary: attendanceStats(mine, list.length),
      records: [...list].reverse().map((s) => {
        const record = mine.find((a) => a.sessionId === s.id)
        return { session: toSessionResponse(s), status: record?.status ?? null, checkedAt: record?.checkedAt ?? null }
      }),
    }
    return HttpResponse.json(body)
  }),

  // ---- Q&A (#23~#27) ----------------------------------------------------------------
  // 권한 순서(BE): @CohortRole 소속 판정(403·404) → @Valid(400) → 서비스: 보관 409 → 질문 스코프 404 → 본인·운영진 403

  http.get('/api/cohorts/:cohortId/questions', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const list = questions
      .filter((q) => q.cohortId === guard.cohort.id)
      // 최신순, 같은 시각은 id 내림차순 (qna/design.md 결정 5)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    return HttpResponse.json(list.map((q) => toQuestionResponse(q, guard.cohort, user)))
  }),

  http.get('/api/cohorts/:cohortId/questions/:questionId', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const found = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    return HttpResponse.json(toQuestionResponse(found, guard.cohort, user))
  }),

  http.post('/api/cohorts/:cohortId/questions', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const parsed = parseQuestionBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const created: MockQuestion = {
      id: Math.max(0, ...questions.map((q) => q.id)) + 1,
      cohortId: guard.cohort.id,
      loginId: user.loginId, // 작성자는 요청자 본인으로 고정
      createdAt: new Date().toISOString(),
      ...parsed.payload,
    }
    questions.push(created)
    return HttpResponse.json(toQuestionResponse(created, guard.cohort, user), {
      status: 201,
      headers: { Location: `/api/cohorts/${guard.cohort.id}/questions/${created.id}` },
    })
  }),

  http.put('/api/cohorts/:cohortId/questions/:questionId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const parsed = parseQuestionBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const found = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    // 운영진·관리자도 남의 글은 수정 불가 - 삭제만 가능 (qna/design.md 결정 2)
    if (found.loginId !== user.loginId) return error(403, 'FORBIDDEN', '작성자만 수정할 수 있습니다.')
    Object.assign(found, parsed.payload)
    return HttpResponse.json(toQuestionResponse(found, guard.cohort, user))
  }),

  http.delete('/api/cohorts/:cohortId/questions/:questionId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const index = questions.findIndex((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (index < 0) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    const mine = enrollments.find((e) => e.cohortId === guard.cohort.id && e.loginId === user.loginId)
    const isModerator = user.globalRole === 'ADMIN' || mine?.role === 'OPERATOR'
    if (questions[index].loginId !== user.loginId && !isModerator) {
      return error(403, 'FORBIDDEN', '작성자 또는 운영진만 삭제할 수 있습니다.')
    }
    const questionId = questions[index].id
    for (let i = answers.length - 1; i >= 0; i--) if (answers[i].questionId === questionId) answers.splice(i, 1) // 답변 연쇄 삭제
    questions.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- Q&A 답변 (#41~#44) - 조회·등록 소속 누구나, 수정 작성자, 삭제 작성자 또는 운영진 ----------------

  http.get('/api/cohorts/:cohortId/questions/:questionId/answers', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const question = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!question) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    const list = answers.filter((a) => a.questionId === question.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    return HttpResponse.json(list.map((a) => toAnswerResponse(a, guard.cohort, user)))
  }),

  http.post('/api/cohorts/:cohortId/questions/:questionId/answers', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const parsed = parseAnswerBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const question = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!question) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    const created: MockAnswer = {
      id: Math.max(0, ...answers.map((a) => a.id)) + 1,
      questionId: question.id,
      loginId: user.loginId,
      content: parsed.content,
      createdAt: new Date().toISOString(),
    }
    answers.push(created)
    return HttpResponse.json(toAnswerResponse(created, guard.cohort, user), {
      status: 201,
      headers: { Location: `/api/cohorts/${guard.cohort.id}/questions/${question.id}/answers/${created.id}` },
    })
  }),

  http.put('/api/cohorts/:cohortId/questions/:questionId/answers/:answerId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const parsed = parseAnswerBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const question = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!question) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    const found = answers.find((a) => a.id === Number(params.answerId) && a.questionId === question.id)
    if (!found) return error(404, 'NOT_FOUND', '답변을 찾을 수 없습니다.')
    if (found.loginId !== user.loginId) return error(403, 'FORBIDDEN', '작성자만 수정할 수 있습니다.')
    found.content = parsed.content
    return HttpResponse.json(toAnswerResponse(found, guard.cohort, user))
  }),

  http.delete('/api/cohorts/:cohortId/questions/:questionId/answers/:answerId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const question = questions.find((q) => q.id === Number(params.questionId) && q.cohortId === guard.cohort.id)
    if (!question) return error(404, 'NOT_FOUND', '질문을 찾을 수 없습니다.')
    const index = answers.findIndex((a) => a.id === Number(params.answerId) && a.questionId === question.id)
    if (index < 0) return error(404, 'NOT_FOUND', '답변을 찾을 수 없습니다.')
    const mine = enrollments.find((e) => e.cohortId === guard.cohort.id && e.loginId === user.loginId)
    const isModerator = user.globalRole === 'ADMIN' || mine?.role === 'OPERATOR'
    if (answers[index].loginId !== user.loginId && !isModerator) return error(403, 'FORBIDDEN', '작성자 또는 운영진만 삭제할 수 있습니다.')
    answers.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- 과제 (#13~#17) ---------------------------------------------------------------

  http.get('/api/cohorts/:cohortId/assignments', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const list = assignments
      .filter((a) => a.cohortId === guard.cohort.id)
      .sort(
        (a, b) =>
          (a.sessionNo ?? Number.MAX_SAFE_INTEGER) - (b.sessionNo ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt.localeCompare(b.createdAt),
      )
    return HttpResponse.json(list.map((a) => toAssignmentResponse(a, user)))
  }),

  http.get('/api/cohorts/:cohortId/assignments/:assignmentId', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const found = assignments.find((a) => a.id === Number(params.assignmentId) && a.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.')
    return HttpResponse.json(toAssignmentResponse(found, user))
  }),

  http.post('/api/cohorts/:cohortId/assignments', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const parsed = parseAssignmentBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    // BE 채번 미러: 비우면 자동(최대+1, 1000 시작), 지정 시 전역 중복 409
    if (parsed.payload.problemNo !== null && assignments.some((a) => a.problemNo === parsed.payload.problemNo)) {
      return error(409, 'CONFLICT', `이미 사용 중인 문제 번호입니다: ${parsed.payload.problemNo}`)
    }
    const created: MockAssignment = {
      id: Math.max(0, ...assignments.map((a) => a.id)) + 1,
      cohortId: guard.cohort.id,
      createdAt: new Date().toISOString(),
      ...parsed.payload,
      problemNo: parsed.payload.problemNo ?? Math.max(999, ...assignments.map((a) => a.problemNo)) + 1,
    }
    assignments.push(created)
    return HttpResponse.json(toAssignmentResponse(created, user), {
      status: 201,
      headers: { Location: `/api/cohorts/${guard.cohort.id}/assignments/${created.id}` },
    })
  }),

  http.put('/api/cohorts/:cohortId/assignments/:assignmentId', async ({ params, request }) => {
    await delay(400)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const found = assignments.find((a) => a.id === Number(params.assignmentId) && a.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.')
    const parsed = parseAssignmentBody(await request.json().catch(() => null))
    if ('fail' in parsed) return parsed.fail
    // BE 미러: 비우면 기존 번호 유지, 변경 시 중복 409(자기 자신 제외)
    const requestedNo = parsed.payload.problemNo
    if (requestedNo !== null && assignments.some((a) => a.problemNo === requestedNo && a.id !== found.id)) {
      return error(409, 'CONFLICT', `이미 사용 중인 문제 번호입니다: ${requestedNo}`)
    }
    Object.assign(found, parsed.payload, { problemNo: requestedNo ?? found.problemNo })
    return HttpResponse.json(toAssignmentResponse(found, user))
  }),

  http.delete('/api/cohorts/:cohortId/assignments/:assignmentId', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), true)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()
    const index = assignments.findIndex((a) => a.id === Number(params.assignmentId) && a.cohortId === guard.cohort.id)
    if (index === -1) return error(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.')
    const assignmentId = assignments[index].id
    // BE 연쇄 삭제 - 파일 → 제출 이력 → 과제 순서 (schema.md 4절)
    for (let i = submissions.length - 1; i >= 0; i--) {
      if (submissions[i].assignmentId === assignmentId) {
        fileBlobs.delete(submissions[i].id)
        submissions.splice(i, 1)
      }
    }
    assignments.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- 제출 (#18~#22) ---------------------------------------------------------------

  http.post('/api/cohorts/:cohortId/assignments/:assignmentId/submissions', async ({ params, request }) => {
    await delay(500)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = assignmentGuard(user, Number(params.cohortId), Number(params.assignmentId), false)
    if ('fail' in guard) return guard.fail
    if (guard.cohort.status === 'ARCHIVED') return archivedError()

    const formData = await request.formData().catch(() => null)
    if (!formData) return error(400, 'INVALID_INPUT', '요청 본문을 읽을 수 없습니다.')
    const requestPart = formData.get('request')
    if (requestPart === null) return error(400, 'INVALID_INPUT', '필수 요청 파트가 없습니다: request')
    const rawJson = typeof requestPart === 'string' ? requestPart : await requestPart.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawJson) as Record<string, unknown>
    } catch {
      return error(400, 'INVALID_INPUT', '요청 본문을 읽을 수 없습니다.')
    }

    // BE SubmissionService.validate 미러 - 3종 택1(type), 형태별 필수·금지
    const normalize = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)
    const type = body.type
    if (type !== 'CODE' && type !== 'FILE' && type !== 'LINK') {
      return error(400, 'INVALID_INPUT', '제출 형태는 필수입니다.')
    }
    const codeText = normalize(body.codeText)
    const language = normalize(body.language)
    const linkUrls = Array.isArray(body.linkUrls) ? body.linkUrls.map((u) => (typeof u === 'string' ? u.trim() : '')) : []
    const filePart = formData.get('file')
    const file = filePart instanceof File && filePart.size > 0 ? filePart : null

    if (codeText !== null && codeText.length > 100_000) return error(400, 'INVALID_INPUT', '코드는 100000자 이하여야 합니다.')
    if (language !== null && language.length > 30) return error(400, 'INVALID_INPUT', '제출 언어는 30자 이하여야 합니다.')
    if (linkUrls.some((u) => u.length > 2048)) return error(400, 'INVALID_INPUT', '링크는 2048자 이하여야 합니다.')
    if (type === 'CODE') {
      if (codeText === null) return error(400, 'INVALID_INPUT', '코드 제출에는 코드가 있어야 합니다.')
      if (language === null) return error(400, 'INVALID_INPUT', '코드 제출에는 제출 언어가 있어야 합니다.')
      if (file !== null || linkUrls.length > 0) return error(400, 'INVALID_INPUT', '코드 제출에는 파일·링크를 담을 수 없습니다.')
    }
    if (type === 'FILE') {
      if (file === null) return error(400, 'INVALID_INPUT', '파일 제출에는 zip 파일이 있어야 합니다.')
      if (codeText !== null || language !== null || linkUrls.length > 0) {
        return error(400, 'INVALID_INPUT', '파일 제출에는 코드·언어·링크를 담을 수 없습니다.')
      }
      if (!file.name.toLowerCase().endsWith('.zip')) return error(400, 'INVALID_INPUT', 'zip 파일만 업로드할 수 있습니다.')
      if (file.size > 10 * 1024 * 1024) return error(400, 'INVALID_INPUT', '파일은 10MB 이하여야 합니다.')
    }
    if (type === 'LINK') {
      if (codeText !== null || language !== null || file !== null) {
        return error(400, 'INVALID_INPUT', '링크 제출에는 코드·언어·파일을 담을 수 없습니다.')
      }
      if (linkUrls.length === 0) return error(400, 'INVALID_INPUT', '링크 제출에는 링크가 1개 이상 있어야 합니다.')
      if (linkUrls.length > 5) return error(400, 'INVALID_INPUT', '링크는 최대 5개까지입니다.')
      if (linkUrls.some((u) => u === '')) return error(400, 'INVALID_INPUT', '빈 링크는 담을 수 없습니다.')
    }

    const created: MockSubmission = {
      id: Math.max(0, ...submissions.map((s) => s.id)) + 1,
      assignmentId: guard.assignment.id,
      loginId: user.loginId,
      type,
      codeText: type === 'CODE' ? codeText : null,
      language: type === 'CODE' ? language : null,
      fileName: type === 'FILE' ? (file?.name ?? null) : null,
      fileSize: type === 'FILE' ? (file?.size ?? null) : null,
      links: type === 'LINK' ? linkUrls : [],
      submittedAt: new Date().toISOString(), // 서버 수신 시각 기준 지각 판정
    }
    submissions.push(created)
    if (file) fileBlobs.set(created.id, file)
    return HttpResponse.json(toSubmissionResponse(created, guard.assignment, guard.cohort.id), {
      status: 201,
      headers: { Location: `/api/cohorts/${guard.cohort.id}/assignments/${guard.assignment.id}/submissions/${created.id}` },
    })
  }),

  // 경로 매칭 순서 주의 - /submissions/my 를 /submissions/:submissionId 보다 먼저 등록한다
  http.get('/api/cohorts/:cohortId/assignments/:assignmentId/submissions/my', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = assignmentGuard(user, Number(params.cohortId), Number(params.assignmentId), false)
    if ('fail' in guard) return guard.fail
    const mine = submissions
      .filter((s) => s.assignmentId === guard.assignment.id && s.loginId === user.loginId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return HttpResponse.json(mine.map((s) => toSubmissionSummary(s, guard.assignment)))
  }),

  http.get('/api/cohorts/:cohortId/assignments/:assignmentId/submissions/:submissionId', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = assignmentGuard(user, Number(params.cohortId), Number(params.assignmentId), false)
    if ('fail' in guard) return guard.fail
    const found = findViewableSubmission(user, guard.cohort.id, guard.assignment.id, Number(params.submissionId))
    if (!found) return error(404, 'NOT_FOUND', '제출물을 찾을 수 없습니다.')
    return HttpResponse.json(toSubmissionResponse(found, guard.assignment, guard.cohort.id))
  }),

  http.get('/api/cohorts/:cohortId/assignments/:assignmentId/submissions/:submissionId/file', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = assignmentGuard(user, Number(params.cohortId), Number(params.assignmentId), false)
    if ('fail' in guard) return guard.fail
    const found = findViewableSubmission(user, guard.cohort.id, guard.assignment.id, Number(params.submissionId))
    if (!found || found.fileName === null) return error(404, 'NOT_FOUND', '제출 파일이 없습니다.')
    const blob = fileBlobs.get(found.id)
    if (!blob) return error(404, 'NOT_FOUND', '제출 파일을 찾을 수 없습니다.')
    return new HttpResponse(blob, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(found.fileName)}`,
      },
    })
  }),

  http.get('/api/cohorts/:cohortId/assignments/:assignmentId/status-board', async ({ params }) => {
    await delay(300)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = assignmentGuard(user, Number(params.cohortId), Number(params.assignmentId), true)
    if ('fail' in guard) return guard.fail
    const rows: StatusBoardRow[] = enrollments
      .filter((e) => e.cohortId === guard.cohort.id && e.role === 'STUDENT')
      .map((e) => {
        const mine = submissions
          .filter((s) => s.assignmentId === guard.assignment.id && s.loginId === e.loginId)
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        const latest = mine[0] ?? null
        return {
          user: toUserSummary(e.loginId, guard.cohort.id),
          status: statusOf(guard.assignment, e.loginId),
          submissionCount: mine.length,
          lastSubmittedAt: latest?.submittedAt ?? null,
          latestSubmissionId: latest?.id ?? null,
        }
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
    return HttpResponse.json(rows)
  }),
]
