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

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** 401을 받았을 때 앱 전역에서 할 일(세션 만료 처리). main에서 등록한다. */
let onUnauthenticated: (() => void) | undefined
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON 본문 - 직렬화와 Content-Type을 대신 처리 */
  json?: unknown
}

/**
 * fetch 래퍼 - 모든 API 호출은 이 함수를 거친다.
 * - credentials: 'include' - 세션 쿠키를 항상 싣는다
 * - 2xx가 아니면 ApiError로 던진다 (본문 {code, message} 그대로)
 * - 204/빈 본문은 undefined
 */
export async function apiFetch<T>(path: string, { json, headers, ...init }: RequestOptions = {}): Promise<T> {
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
      body: json !== undefined ? JSON.stringify(json) : undefined,
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
