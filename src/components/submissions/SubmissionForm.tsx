import { useRef, useState } from 'react'
import { Code, FileArchive, Send } from 'lucide-react'
import { useCreateSubmission } from '@/api/submissions'
import { Button } from '@/components/ui/button'
import { isOverdue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const LANGUAGES = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript'] as const
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 서버 제한(20MB)의 선반영 - 최종 판정은 서버

/**
 * 제출 폼 (#18) - 본문은 코드/파일 탭 택1, 링크는 공통. 최소 1개여야 제출 가능(버튼 비활성으로 선반영).
 * CLAUDE.md 필수 규칙: 실패 시 입력 보존(상태를 지우지 않는다) + 요청 중 버튼 잠금.
 * 마감 후에도 제출 가능 - "지각 제출로 기록" 확인 안내 후 진행 (flows UC-S4 A1).
 */
export function SubmissionForm({ cohortId, assignmentId, dueAt }: { cohortId: number; assignmentId: number; dueAt: string }) {
  const [tab, setTab] = useState<'code' | 'file'>('code')
  const [codeText, setCodeText] = useState('')
  const [language, setLanguage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mutation = useCreateSubmission(cohortId, assignmentId)

  const hasBody = tab === 'code' ? codeText.trim() !== '' : file !== null
  const canSubmit = (hasBody || linkUrl.trim() !== '') && !mutation.isPending

  const handleFileChange = (selected: File | null) => {
    setFileError(null)
    if (!selected) {
      setFile(null)
      return
    }
    if (!selected.name.toLowerCase().endsWith('.zip')) {
      setFile(null)
      setFileError('zip 파일만 업로드할 수 있어요.')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null)
      setFileError('파일은 20MB 이하여야 해요.')
      return
    }
    setFile(selected)
  }

  const handleSubmit = () => {
    if (isOverdue(dueAt) && !window.confirm('마감이 지난 과제예요. 지각 제출로 기록됩니다. 계속할까요?')) return
    const usingCode = tab === 'code' && codeText.trim() !== ''
    mutation.mutate(
      {
        payload: {
          codeText: usingCode ? codeText : null,
          language: usingCode && language !== '' ? language : null,
          linkUrl: linkUrl.trim() !== '' ? linkUrl.trim() : null,
        },
        file: tab === 'file' ? file : null,
      },
      {
        onSuccess: () => {
          // 성공했을 때만 비운다 - 실패 시 입력 보존 (CLAUDE.md 규칙 1)
          setCodeText('')
          setLanguage('')
          setLinkUrl('')
          setFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        },
      },
    )
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
      active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
    )

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4">
        <div className="flex" role="tablist" aria-label="제출 방식">
          <button type="button" role="tab" aria-selected={tab === 'code'} className={tabClass(tab === 'code')} onClick={() => setTab('code')}>
            <Code className="size-4" />
            코드 작성
          </button>
          <button type="button" role="tab" aria-selected={tab === 'file'} className={tabClass(tab === 'file')} onClick={() => setTab('file')}>
            <FileArchive className="size-4" />
            파일 업로드
          </button>
        </div>
        {tab === 'code' && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="제출 언어"
            className="h-8 rounded-[2px] border bg-card px-2 text-sm"
          >
            <option value="">언어 선택 (선택)</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-3 p-4">
        {tab === 'code' ? (
          <textarea
            value={codeText}
            onChange={(e) => setCodeText(e.target.value)}
            placeholder="코드를 붙여넣으세요"
            aria-label="제출 코드"
            spellCheck={false}
            className="h-56 w-full resize-y rounded-[2px] border bg-muted/40 p-3 font-mono text-sm outline-none focus:border-primary"
          />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[2px] border border-dashed p-6 text-center">
            <FileArchive className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">zip 파일 1개, 최대 20MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              aria-label="제출 파일"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="max-w-full text-sm file:mr-3 file:rounded-[2px] file:border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-semibold"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(0)}KB)
              </p>
            )}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="링크 (선택) - GitHub·배포 URL"
            aria-label="제출 링크"
            className="h-9 min-w-60 flex-1 rounded-[2px] border bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <Button className="rounded-[2px]" onClick={handleSubmit} disabled={!canSubmit}>
            <Send data-icon="inline-start" />
            {mutation.isPending ? '제출 중...' : '제출하기'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">코드 또는 파일 중 하나(택1)나 링크, 최소 1개면 제출할 수 있어요. 재제출은 이력으로 쌓입니다.</p>
        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
        {mutation.isSuccess && !mutation.isPending && <p className="text-sm font-semibold text-[#16a34a]">제출 완료! 아래 기록에서 확인하세요.</p>}
      </div>
    </section>
  )
}
