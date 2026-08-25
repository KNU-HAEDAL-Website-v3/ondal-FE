import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { useLogin, useMe } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SiteFooter } from '@/components/SiteFooter'

const IS_MOCK = import.meta.env.VITE_API_MOCK === 'true'

/** returnTo는 우리 사이트 안의 경로만 허용 - 외부 URL로 튕기는 오픈 리다이렉트 방지 */
function safeReturnTo(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/'
}

/**
 * 스텁 로그인 화면 - 아이디만 입력하면 통과한다 (BE StubAuthService).
 * 홈페이지 연동으로 바뀌면 이 폼이 "해달 홈페이지로 이동" 버튼으로 바뀌고, returnTo 복귀 흐름은 그대로 쓴다.
 */
export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const navigate = useNavigate()
  const { data: me, isPending: isMePending } = useMe()
  const loginMutation = useLogin()
  const [loginId, setLoginId] = useState('')

  if (isMePending) return <LoadingScreen label="로그인 상태 확인 중..." />
  if (me) return <Navigate to={returnTo} replace />

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = loginId.trim()
    if (!trimmed || loginMutation.isPending) return // 요청 중 중복 제출 방지 (CLAUDE.md 규칙 2)
    loginMutation.mutate(trimmed, { onSuccess: () => navigate(returnTo, { replace: true }) })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="text-2xl font-bold tracking-tight text-primary">Ondal</p>
          <CardTitle className="text-lg">해달 부트캠프 LMS</CardTitle>
          <CardDescription>해달 부원 아이디로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
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
              ? '미리보기(mock) 모드 - admin · operator1 · student1~3 또는 아무 아이디로 로그인해 보세요.'
              : '개발용 스텁 로그인 - 아이디만 입력하면 통과합니다. 계정은 해달 홈페이지에서 만듭니다.'}
          </p>
        </CardContent>
      </Card>
      <SiteFooter />
    </main>
  )
}
