import type { ErrorResponse } from './types'

/**
 * 서버 에러를 담는 예외. code로 분기한다 (design.md 3절):
 *   UNAUTHENTICATED(401) → 재로그인 유도 · FORBIDDEN(403) → 홈 리다이렉트 · NOT_FOUND(404) → 안내 페이지
 * status 0 + code NETWORK 는 서버에 아예 닿지 못한 경우.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  is(code: string) {
    return this.code === code
  }
}

/** 파일 다운로드처럼 fetch 없이 브라우저가 직접 여는 URL을 만들 때도 이 값을 쓴다 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** 401을 받았을 때 앱 전역에서 할 일(세션 만료 처리). main에서 등록한다. */
let onUnauthenticated: (() => void) | undefined
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

/**
 * 403 USER_PENDING(승인 대기)을 받았을 때 - 로그인 뒤 운영진이 아직 승인하지 않은 계정. main 이 me 의 status 를 PENDING 으로 바꿔
 * RequireAuth 가 대기 화면을 그리게 한다. 홈으로 보내는 일반 403(FORBIDDEN)과는 다른 코드다 (docs 결정 10)
 */
let onPending: (() => void) | undefined
export function setPendingHandler(handler: () => void) {
  onPending = handler
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON 본문 - 직렬화와 Content-Type을 대신 처리 */
  json?: unknown
  /** multipart 본문(제출 등) - Content-Type은 브라우저가 boundary와 함께 채우므로 건드리지 않는다 */
  form?: FormData
}

/**
 * fetch 래퍼 - 모든 API 호출은 이 함수를 거친다.
 * - credentials: 'include' - 세션 쿠키를 항상 싣는다
 * - 2xx가 아니면 ApiError로 던진다 (본문 {code, message} 그대로)
 * - 204/빈 본문은 undefined
 */
export async function apiFetch<T>(path: string, { json, form, headers, ...init }: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE_URL + path, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : form,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  }

  const text = await res.text()
  const data: unknown = text ? safeJson(text) : undefined

  if (!res.ok) {
    const body = (data ?? {}) as Partial<ErrorResponse>
    const error = new ApiError(res.status, body.code ?? 'UNKNOWN', body.message ?? `요청에 실패했습니다. (${res.status})`)
    if (res.status === 401) onUnauthenticated?.()
    if (res.status === 403 && error.is('USER_PENDING')) onPending?.()
    throw error
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
