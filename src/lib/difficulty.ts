/**
 * 문제 난이도 (V9, 2026-09-19 PM) - 서버는 1~25 정수 하나를 저장하고, 화면은 "대분류-소분류"(1-1 ~ 5-5)로 보인다.
 *   value = (대분류 - 1) * 5 + 소분류. 둘 다 클수록 어렵다.
 *   백준 티어 대응: 1 = 브론즈, 2 = 실버, 3 = 골드, 4 = 플래티넘, 5 = 다이아 (소분류는 5→1 이 아니라 1→5 로 오름차순)
 */
export const TIER_LABELS = ['1 (입문)', '2 (기초)', '3 (중급)', '4 (심화)', '5 (도전)'] as const

/** 대분류 1~5 - 미지정(null)이면 null */
export function tierOf(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value < 1 || value > 25) return null
  return Math.floor((value - 1) / 5) + 1
}

/** 소분류 1~5 */
export function subOf(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value < 1 || value > 25) return null
  return ((value - 1) % 5) + 1
}

export function toDifficulty(tier: number, sub: number): number {
  return (tier - 1) * 5 + sub
}

/** "3-4" 표기. 미지정이면 "-" */
export function formatDifficulty(value: number | null | undefined): string {
  const tier = tierOf(value)
  const sub = subOf(value)
  return tier === null || sub === null ? '-' : `${tier}-${sub}`
}

/** 대분류별 칩 색 - 상태색 토큰만 (index.css). 1 회색 → 2 초록 → 3 노랑(골드) → 4 파랑 → 5 빨강 */
export function tierClass(tier: number | null): string {
  switch (tier) {
    case 1:
      return 'bg-neutral-bg text-neutral'
    case 2:
      return 'bg-success-bg text-success'
    case 3:
      return 'bg-warning-bg text-warning'
    case 4:
      return 'bg-info-bg text-info'
    case 5:
      return 'bg-danger-bg text-danger'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
