import { Fragment, useState } from 'react'
import { ChevronDown, Gavel } from 'lucide-react'
import type { JudgeCaseView, JudgeResultResponse } from '@/api/types'
import { VERDICT_META, VerdictBadge, isJudging } from '@/components/judge/VerdictBadge'
import { formatKst } from '@/lib/datetime'
import { cn } from '@/lib/utils'

/**
 * 채점 결과 상세 (docs judge/fe.md 3절) - 제출 펼침 뷰의 코드 아래·코멘트 위.
 * 요약 줄(배지·통과 N/M·최대 시간·메모리·채점 시각) + 케이스 표. 공개 케이스 행은 펼쳐서 입력/기대 출력/실제 출력을 나란히.
 * 모든 값은 서버 그대로 - 판정·통과 수를 여기서 다시 계산하지 않는다.
 */
export function JudgeResultView({ judge }: { judge: JudgeResultResponse }) {
  const judging = isJudging(judge.status)
  return (
    <section aria-label="채점 결과" className="rounded-[2px] border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-bold tracking-[0.55px]">
          <Gavel className="size-3.5" />
          채점 결과
        </span>
        <VerdictBadge status={judge.status} verdict={judge.verdict} />
        {!judging && (
          <>
            <span>
              통과 <span className="font-mono">{judge.passedCases}/{judge.totalCases}</span>
            </span>
            {judge.maxTimeMs !== null && <span className="font-mono">{judge.maxTimeMs} ms</span>}
            {judge.maxMemoryKb !== null && <span className="font-mono">{judge.maxMemoryKb} KB</span>}
            {judge.judgedAt && <span className="font-mono">{formatKst(judge.judgedAt)}</span>}
          </>
        )}
      </div>

      {judging && <p className="mt-2 text-sm text-muted-foreground">채점 중이에요. 결과가 나오면 자동으로 바뀝니다.</p>}

      {judge.verdict === 'JUDGE_ERROR' && (
        <p className="mt-2 text-sm text-muted-foreground">
          채점 서버 문제로 판정을 내지 못했어요. 코드 문제가 아니에요 - 운영진이 재채점하면 해결됩니다.
        </p>
      )}

      {judge.compileOutput && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted-foreground">{judge.verdict === 'COMPILE_ERROR' ? '컴파일 메시지' : '메시지'}</p>
          <pre className="mt-1 max-h-48 overflow-auto rounded-[2px] bg-muted p-2 font-mono text-xs leading-5 whitespace-pre-wrap">{judge.compileOutput}</pre>
        </div>
      )}

      {judge.cases.length > 0 && (
        <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="w-10 py-1.5 font-semibold">#</th>
              <th scope="col" className="py-1.5 font-semibold">판정</th>
              <th scope="col" className="py-1.5 font-semibold">시간</th>
              <th scope="col" className="py-1.5 font-semibold">메모리</th>
              <th scope="col" className="w-20 py-1.5 text-right font-semibold">입출력</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {judge.cases.map((c) => (
              <CaseRow key={c.position} c={c} />
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  )
}

function CaseRow({ c }: { c: JudgeCaseView }) {
  const [open, setOpen] = useState(false)
  const meta = VERDICT_META[c.verdict]
  return (
    <Fragment>
      <tr data-case-position={c.position}>
        <td className="py-1.5 font-mono text-xs text-muted-foreground">{c.position + 1}</td>
        <td className="py-1.5">
          <span className={cn('inline-block rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold', meta.className)}>{meta.label}</span>
        </td>
        <td className="py-1.5 font-mono text-xs">{c.timeMs === null ? '-' : `${c.timeMs} ms`}</td>
        <td className="py-1.5 font-mono text-xs">{c.memoryKb === null ? '-' : `${c.memoryKb} KB`}</td>
        <td className="py-1.5 text-right">
          {c.isPublic ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={`케이스 ${c.position + 1} 입출력 ${open ? '접기' : '보기'}`}
              className="inline-flex items-center gap-0.5 rounded px-1 text-xs font-semibold text-primary hover:bg-secondary"
            >
              공개
              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">비공개</span>
          )}
        </td>
      </tr>
      {open && c.isPublic && (
        <tr>
          <td colSpan={5} className="pb-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <IoBlock label="입력" value={c.input ?? ''} />
              <IoBlock label="기대 출력" value={c.expectedOutput ?? ''} />
              <IoBlock label={c.truncated ? '실제 출력 (일부)' : '실제 출력'} value={c.actualOutput ?? ''} highlight={c.verdict === 'WRONG_ANSWER'} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function IoBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <pre
        className={cn(
          'mt-0.5 max-h-40 min-h-8 overflow-auto rounded-[2px] border bg-muted/40 p-2 font-mono text-xs leading-5 whitespace-pre-wrap',
          highlight && 'border-[#fca5a5] bg-[#fef2f2]',
        )}
      >
        {value === '' ? <span className="text-muted-foreground">(없음)</span> : value}
      </pre>
    </div>
  )
}
