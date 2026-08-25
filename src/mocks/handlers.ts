// MSW 핸들러 - BE 계약(design.md 3절)을 흉내 낸다. 화면 미리보기용이지 계약의 기준이 아니다.
import { delay, http, HttpResponse } from 'msw'
import type { AssignmentResponse, CohortResponse, ErrorResponse, UserResponse, UserSummary } from '@/api/types'
import { assignments, cohorts, enrollments, users, type MockAssignment, type MockCohort, type MockUser } from './data'

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

function toAssignmentResponse(a: MockAssignment): AssignmentResponse {
  return { id: a.id, sessionNo: a.sessionNo, title: a.title, description: a.description, dueAt: a.dueAt, createdAt: a.createdAt }
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
    return HttpResponse.json(list.map(toAssignmentResponse))
  }),

  http.get('/api/cohorts/:cohortId/assignments/:assignmentId', async ({ params }) => {
    await delay(250)
    const user = currentUser()
    if (!user) return unauthenticated()
    const guard = cohortGuard(user, Number(params.cohortId), false)
    if ('fail' in guard) return guard.fail
    const found = assignments.find((a) => a.id === Number(params.assignmentId) && a.cohortId === guard.cohort.id)
    if (!found) return error(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.')
    return HttpResponse.json(toAssignmentResponse(found))
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
    return HttpResponse.json(toAssignmentResponse(created), {
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
    return HttpResponse.json(toAssignmentResponse(found))
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
    assignments.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
