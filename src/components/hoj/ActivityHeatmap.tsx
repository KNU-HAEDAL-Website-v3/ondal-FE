import { todayKstInputValue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * 활동 잔디 (HOJ P3 사용자 페이지) - 최근 365일, 주 단위 열 × 요일 행, 4단계 농도. 값은 서버 activity(KST 날짜별 연습 제출 수) 그대로.
 * 색은 상태색 토큰만 - 중간 농도 두 단계는 success 를 카드색과 섞은 불투명 색(color-mix)이라 바닥에 따라 달라지지 않는다.
 */

const DAY_MS = 86_400_000
const WEEKDAY_LABELS = ['', '월', '', '수', '', '금', '']

/** 건수 → 농도 0~4 */
function levelOf(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

const LEVEL_CLASS = [
  'bg-muted',
  'bg-success-bg',
  'bg-[color-mix(in_oklch,var(--success)_45%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--success)_70%,var(--card))]',
  'bg-success',
]

/** "2026-09-19" ↔ UTC 자정 ms - 달력 계산은 시간대와 무관하게 날짜 문자열로만 */
function dateToMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function ActivityHeatmap({ activity }: { activity: { date: string; count: number }[] }) {
  const counts = new Map(activity.map((a) => [a.date, a.count]))
  const todayMs = dateToMs(todayKstInputValue())
  const firstMs = todayMs - 364 * DAY_MS
  // 첫 열이 일요일에서 시작하도록 앞을 채운다 - 열 = 주(일~토)
  const startMs = firstMs - new Date(firstMs).getUTCDay() * DAY_MS
  const totalDays = Math.round((todayMs - startMs) / DAY_MS) + 1
  const weeks = Math.ceil(totalDays / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const ms = startMs + i * DAY_MS
    if (ms > todayMs) return null
    const date = msToDate(ms)
    return { date, count: counts.get(date) ?? 0, inRange: ms >= firstMs }
  })
  // 달 이름표 - 그 주의 첫날(일요일)의 달이 앞 주와 다르면 그 열 위에 붙인다
  const monthLabels = Array.from({ length: weeks }, (_, week) => {
    const ms = startMs + week * 7 * DAY_MS
    const month = new Date(ms).getUTCMonth()
    const prev = week === 0 ? -1 : new Date(ms - 7 * DAY_MS).getUTCMonth()
    return month !== prev && ms <= todayMs ? `${month + 1}월` : ''
  })

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-max pr-2">
          <div className="ml-7 grid gap-[3px] text-[10px] leading-3 text-muted-foreground" style={{ gridTemplateColumns: `repeat(${weeks}, 0.75rem)` }} aria-hidden>
            {monthLabels.map((label, i) => (
              <span key={i} className="whitespace-nowrap">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            <div className="grid w-6 gap-[3px] text-[10px] leading-3 text-muted-foreground" style={{ gridTemplateRows: 'repeat(7, 0.75rem)' }} aria-hidden>
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div
              className="grid grid-flow-col gap-[3px]"
              style={{ gridTemplateRows: 'repeat(7, 0.75rem)', gridAutoColumns: '0.75rem' }}
              role="img"
              aria-label="최근 365일 날짜별 연습 제출 수"
            >
              {cells.map((cell, i) =>
                cell === null || !cell.inRange ? (
                  <span key={i} className="size-3" />
                ) : (
                  <span
                    key={cell.date}
                    title={`${cell.date.replace(/-/g, '.')} · ${cell.count}건`}
                    className={cn('size-3 rounded-sm', LEVEL_CLASS[levelOf(cell.count)])}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground" aria-hidden>
        적음
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={cn('size-3 rounded-sm', cls)} />
        ))}
        많음
      </div>
    </div>
  )
}
