// MSW 핸들러 - BE 계약(design.md 3절)을 흉내 낸다. 화면 미리보기용이지 계약의 기준이 아니다.
import { delay, http, HttpResponse } from 'msw'
import type { CohortResponse, ErrorResponse, UserResponse, UserSummary } from '@/api/types'
import { cohorts, enrollments, users, type MockCohort, type MockUser } from './data'

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
]
