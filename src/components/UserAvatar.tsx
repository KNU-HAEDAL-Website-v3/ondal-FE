import { useState } from 'react'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-lg',
} as const

/**
 * 프로필 아바타 - 원안(ui-v1 상단 바)의 사진 아바타. 사진(avatarUrl, 홈페이지 구글 프로필)이 있으면 사진, 없거나 못 불러오면 이름 첫 글자.
 * 사진은 로그인 때 서버가 ID 토큰 picture 클레임으로 받아 둔 주소 - Ondal 은 업로드를 받지 않는다 (docs 결정 14)
 */
export function UserAvatar({ name, avatarUrl, size = 'sm', className }: { name: string | null | undefined; avatarUrl: string | null | undefined; size?: keyof typeof SIZE; className?: string }) {
  const [broken, setBroken] = useState(false)
  const initial = name?.trim().charAt(0) || '?'
  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full border object-cover', SIZE[size], className)}
      />
    )
  }
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full border bg-neutral-bg font-semibold text-foreground', SIZE[size], className)}>
      {initial}
    </span>
  )
}
