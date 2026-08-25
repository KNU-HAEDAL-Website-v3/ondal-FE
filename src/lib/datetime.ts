// 시각 표시 규칙 (CLAUDE.md 필수 동작 규칙 4): 서버는 UTC, 표시는 KST.
// D-day 문구는 dueAt 기반 표시 가공 - 허용 범위 (docs assignment/fe.md 2절).
// 제출/미제출/지각 판정은 서버 값만 쓴다 - 여기서 계산하지 않는다.

const KST = 'Asia/Seoul'

/** UTC ISO → "2026.08.29 23:59" (KST) */
export function formatKst(iso: string): string {
  return new Date(iso)
    .toLocaleString('sv-SE', {
      timeZone: KST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/-/g, '.')
}

/** KST 달력 날짜(자정)를 UTC ms로 - D-day는 시각이 아니라 날짜 차이로 센다 */
function kstDateMs(date: Date): number {
  return Date.parse(date.toLocaleDateString('sv-SE', { timeZone: KST }))
}

/** D-3 / D-DAY / 마감 */
export function ddayLabel(dueAtIso: string, now: Date = new Date()): string {
  const days = Math.round((kstDateMs(new Date(dueAtIso)) - kstDateMs(now)) / 86_400_000)
  if (days > 0) return `D-${days}`
  if (days === 0) return 'D-DAY'
  return '마감'
}

/** 마감 시각(분 단위)이 지났는지 - 카드 강조 표시용 */
export function isOverdue(dueAtIso: string, now: Date = new Date()): boolean {
  return Date.parse(dueAtIso) < now.getTime()
}

/** UTC ISO → <input type="datetime-local"> 값 "2026-08-29T23:59" (KST 기준) */
export function toKstInputValue(iso: string): string {
  return new Date(iso)
    .toLocaleString('sv-SE', {
      timeZone: KST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(' ', 'T')
}

/** datetime-local 값을 KST로 해석해 UTC ISO로 - 브라우저 시간대와 무관하게 동작 */
export function kstInputToIso(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString()
}
