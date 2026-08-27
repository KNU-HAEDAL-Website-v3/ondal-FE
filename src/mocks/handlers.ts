// MSW 핸들러 - BE 계약(design.md 3절)을 흉내 낸다. 화면 미리보기용이지 계약의 기준이 아니다.
import { delay, http, HttpResponse } from 'msw'
import type {
  AssignmentResponse,
  CohortResponse,
  ErrorResponse,
  StatusBoardRow,
  SubmissionResponse,
  SubmissionStatus,
  SubmissionSummary,
  UserResponse,
  UserSummary,
} from '@/api/types'
import {
  assignments,
  cohorts,
  enrollments,
  submissions,
  users,
  type MockAssignment,
  type MockCohort,
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
    sessionNo: a.sessionNo,
    title: a.title,
    description: a.description,
    dueAt: a.dueAt,
    createdAt: a.createdAt,
    myStatus: mine ? statusOf(a, viewer.loginId) : null,
    submissionCount: canSeeCount ? submissions.filter((s) => s.assignmentId === a.id).length : null,
  }
}

/** BE 요청 검증 흉내 - title 필수·200자, description 10000자, dueAt 필수, sessionNo 1 이상(선택) */
function parseAssignmentBody(
  raw: unknown,
): { payload: Omit<MockAssignment, 'id' | 'cohortId' | 'createdAt'> } | { fail: HttpResponse<ErrorResponse> } {
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
  return { payload: { sessionNo, title, description, dueAt: new Date(body.dueAt).toISOString() } }
}

const archivedError = () =>
  error(409, 'COHORT_ARCHIVED', '보관된 분반은 변경할 수 없습니다. 보관을 해제한 뒤 다시 시도하세요.')

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
    return new HttpResponse(null, { status: 200 })
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
    const created: MockAssignment = {
      id: Math.max(0, ...assignments.map((a) => a.id)) + 1,
      cohortId: guard.cohort.id,
      createdAt: new Date().toISOString(),
      ...parsed.payload,
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
    Object.assign(found, parsed.payload)
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
