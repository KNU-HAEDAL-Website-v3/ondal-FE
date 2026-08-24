import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, EllipsisVertical, SquarePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// 모양 잡기용 견본 데이터 - Notice BE API가 생기면 실제 데이터로 교체한다.
const SAMPLE_NOTICES = [
  { id: 1, title: '[필독] 2026년 2학기 알고리즘 경진대회 안내', target: '전체 수강생', author: '관리자', status: '게시 중', tone: 'green', createdAt: '2026-08-20' },
  { id: 2, title: '2026-2 C언어 분반 첫 모임 안내', target: '2026-2 C언어', author: 'operator1', status: '게시 중', tone: 'green', createdAt: '2026-08-18' },
  { id: 3, title: '서버 점검에 따른 접속 단절 안내 (8/30 02:00~04:00)', target: '전체 사용자', author: '관리자', status: '예약됨', tone: 'yellow', createdAt: '2026-08-23' },
  { id: 4, title: '상반기 우수 수강생 시상 결과', target: '전체 수강생', author: '관리자', status: '숨김', tone: 'gray', createdAt: '2026-07-15' },
] as const

const STATUS_TONES: Record<string, string> = {
  green: 'bg-[#dcfce7] text-[#16a34a]',
  yellow: 'bg-[#fef08a] text-[#854d0e]',
  gray: 'bg-[#e3e1ec] text-[#5d5e66]',
}

const FILTER_LABEL_CLASS = 'text-xs font-bold tracking-[0.55px] text-muted-foreground'

/** 교육운영진 공지사항 관리 (피그마 2:37234) - 필터 + 공지 테이블 + 작성 진입 */
export function OperatorNoticesView() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-2.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공지사항 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">시스템 및 분반 관련 공지사항을 관리합니다</p>
        </div>
        <Button className="rounded-[2px]">
          <SquarePen data-icon="inline-start" />
          공지 작성
        </Button>
      </header>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLASS}>유형</span>
          <Button variant="outline" size="sm" className="justify-between rounded-[2px]">
            전체
            <ChevronDown data-icon="inline-end" />
          </Button>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLASS}>대상</span>
          <Button variant="outline" size="sm" className="justify-between rounded-[2px]">
            전체 수강생
            <ChevronDown data-icon="inline-end" />
          </Button>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLASS}>작성자</span>
          <Input placeholder="이름 검색" className="h-8 rounded-[2px] text-[13px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLASS}>상태</span>
          <Button variant="outline" size="sm" className="justify-between rounded-[2px]">
            게시 중
            <ChevronDown data-icon="inline-end" />
          </Button>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLASS}>날짜 범위</span>
          <Button variant="outline" size="sm" className="justify-between rounded-[2px]">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              전체 기간
            </span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        </label>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-[13px] tracking-[0.55px] text-muted-foreground">
                <th className="px-4 py-2 text-left font-bold">제목</th>
                <th className="px-2 py-2 text-center font-bold">대상</th>
                <th className="px-2 py-2 text-center font-bold">작성자</th>
                <th className="px-2 py-2 text-center font-bold">상태</th>
                <th className="px-2 py-2 text-center font-bold">등록일</th>
                <th className="px-4 py-2 text-center font-bold">관리</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_NOTICES.map((n) => (
                <tr key={n.id} className="border-b last:border-0">
                  <td className="px-4 py-3.5 font-semibold">{n.title}</td>
                  <td className="px-2 py-3.5 text-center text-[#464555]">{n.target}</td>
                  <td className="px-2 py-3.5 text-center font-medium">{n.author}</td>
                  <td className="px-2 py-3.5 text-center">
                    <span className={cn('inline-block rounded-[2px] px-2 py-0.5 text-xs font-bold', STATUS_TONES[n.tone])}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-2 py-3.5 text-center font-mono text-[#464555]">{n.createdAt}</td>
                  <td className="px-4 py-3.5 text-center">
                    <button type="button" aria-label={`${n.title} 관리`} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                      <EllipsisVertical className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-1.5 border-t px-4 py-3">
          <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="이전 페이지" disabled>
            <ChevronLeft />
          </Button>
          <Button size="sm" className="rounded-[2px] px-2.5">1</Button>
          <Button variant="outline" size="sm" className="rounded-[2px] px-2.5">2</Button>
          <Button variant="outline" size="sm" className="rounded-[2px] px-2.5">3</Button>
          <Button variant="outline" size="sm" className="rounded-[2px] px-2" aria-label="다음 페이지">
            <ChevronRight />
          </Button>
        </div>
      </section>
    </div>
  )
}
