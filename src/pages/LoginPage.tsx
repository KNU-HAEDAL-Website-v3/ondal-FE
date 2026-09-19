import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ExternalLink, LoaderCircle, TriangleAlert } from 'lucide-react'
import { AUTH_MODE, oidcLoginUrl, useLogin, useMe } from '@/api/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SiteFooter } from '@/components/SiteFooter'

const IS_MOCK = import.meta.env.VITE_API_MOCK === 'true'

/** returnTo는 우리 사이트 안의 경로만 허용 - 외부 URL로 튕기는 오픈 리다이렉트 방지. BE OidcAuthService.safeReturnTo 와 같은 규칙 */
function safeReturnTo(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value
  return '/'
}

/**
 * 홈페이지 로그인 실패 안내 - BE 가 /login?error=<코드> 로 돌려보낸다 (코드 원본: BE OidcLoginError).
 * 어느 경우든 "다시 로그인"으로 처음부터 새로 시작하면 된다.
 */
const OIDC_ERROR_MESSAGES: Record<string, string> = {
  ACCESS_DENIED: '홈페이지 로그인이 취소되었습니다.',
  STATE_MISMATCH: '로그인 절차가 만료되었거나 이미 처리된 요청이에요. 처음부터 다시 로그인해 주세요.',
  TOKEN_EXCHANGE_FAILED: '홈페이지에서 로그인 정보를 받아오지 못했습니다. 다시 시도해도 반복되면 운영진에게 알려 주세요.',
  INVALID_ID_TOKEN: '홈페이지 로그인 정보를 확인하지 못했습니다. 다시 시도해도 반복되면 운영진에게 알려 주세요.',
  INVALID_ACCOUNT: '홈페이지 계정 정보가 Ondal 규칙에 맞지 않아요(아이디 50자 초과 등). 운영진에게 문의해 주세요.',
  OIDC_UNAVAILABLE: '해달 홈페이지 로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
}

function oidcErrorMessage(code: string) {
  return OIDC_ERROR_MESSAGES[code] ?? `로그인에 실패했습니다. 다시 시도해 주세요. (${code})`
}

/**
 * 로그인 화면. 방식은 빌드 변수(AUTH_MODE)로 고정된다:
 *   stub: 아이디 폼 (BE StubAuthService - local·mock)
 *   oidc: "홈페이지 계정으로 로그인" 버튼 → Keycloak → BE 콜백 → returnTo 로 복귀 (운영)
 * 실패(/login?error=)·복귀(?returnTo=) 쿼리는 두 방식이 같은 규칙을 쓴다.
 */
export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const loginError = searchParams.get('error')
  const { data: me, isPending: isMePending } = useMe()

  if (isMePending) return <LoadingScreen label="로그인 상태 확인 중..." />
  if (me) return <Navigate to={returnTo} replace />

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="text-2xl font-bold tracking-tight text-primary">Ondal</p>
          <CardTitle className="text-lg">해달 부트캠프 LMS</CardTitle>
          <CardDescription>
            {AUTH_MODE === 'oidc' ? '해달 홈페이지 계정으로 로그인하세요.' : '해달 부원 아이디로 로그인하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginError && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert />
              <AlertTitle>로그인하지 못했어요</AlertTitle>
              <AlertDescription>{oidcErrorMessage(loginError)}</AlertDescription>
            </Alert>
          )}
          {AUTH_MODE === 'oidc' ? (
            <OidcLogin returnTo={returnTo} isRetry={loginError !== null} />
          ) : (
            <StubLoginForm returnTo={returnTo} />
          )}
        </CardContent>
      </Card>
      <SiteFooter />
    </main>
  )
}

/**
 * 운영: 홈페이지(Keycloak) 로그인. 버튼은 fetch 가 아니라 링크 - 브라우저가 BE 로그인 시작 주소로 이동한다.
 * 실패 후에는 "다시 로그인" - 같은 주소로 처음부터 다시 시작하면 된다.
 */
function OidcLogin({ returnTo, isRetry }: { returnTo: string; isRetry: boolean }) {
  return (
    <div className="space-y-4">
      <Button asChild className="w-full">
        <a href={oidcLoginUrl(returnTo)}>
          <ExternalLink data-icon="inline-start" />
          {isRetry ? '다시 로그인' : '홈페이지 계정으로 로그인'}
        </a>
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        해달 홈페이지 로그인 화면으로 이동했다가 돌아옵니다. 계정이 없으면 운영진에게 문의하세요.
      </p>
    </div>
  )
}

/** 개발: 스텁 로그인 폼 - 아이디만 입력하면 통과한다 (BE StubAuthService). mock 도 같은 흐름 */
function StubLoginForm({ returnTo }: { returnTo: string }) {
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const [loginId, setLoginId] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = loginId.trim()
    if (!trimmed || loginMutation.isPending) return // 요청 중 중복 제출 방지 (CLAUDE.md 규칙 2)
    loginMutation.mutate(trimmed, { onSuccess: () => navigate(returnTo, { replace: true }) })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="loginId">아이디</Label>
          <Input
            id="loginId"
            name="loginId"
            autoComplete="username"
            autoFocus
            required
            maxLength={50}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            disabled={loginMutation.isPending}
            aria-invalid={loginMutation.isError || undefined}
          />
        </div>

        {loginMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {loginMutation.error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loginMutation.isPending || !loginId.trim()}>
          {loginMutation.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          로그인
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {IS_MOCK
          ? '미리보기(mock) 모드 - admin · maintainer · operator1 · student1~3 · newbie 또는 아무 아이디로 로그인해 보세요.'
          : '개발용 스텁 로그인 - 아이디만 입력하면 통과합니다. 운영에서는 해달 홈페이지 계정으로 로그인합니다.'}
      </p>
    </>
  )
}
