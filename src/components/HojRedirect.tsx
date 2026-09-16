import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { hojHref } from '@/lib/apps'

/**
 * HOJ 가 따로 배포된 뒤, Ondal 에 남아 있던 문제 관련 주소로 들어온 사람을 HOJ 로 넘긴다.
 *
 * 라우트를 그냥 지우면 그동안 공유된 링크(`/problems/12` 같은 것)와 북마크가 전부 404 가 된다.
 * 두 앱은 경로 체계를 일부러 같게 뒀으므로(hojRoutes.tsx) 현재 경로를 그대로 붙이면 같은 화면으로 떨어진다.
 *
 * `replace` 인 이유: 뒤로 가기를 누르면 다시 이 화면으로 들어와 무한 왕복이 된다.
 */
export function HojRedirect() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    window.location.replace(hojHref(`${pathname}${search}`))
  }, [pathname, search])

  return (
    <p className="text-sm text-muted-foreground">
      문제 은행(HOJ)으로 이동하는 중이에요...
    </p>
  )
}
