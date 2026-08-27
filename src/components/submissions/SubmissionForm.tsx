import { useRef, useState } from 'react'
import { Code, FileArchive, Link2, Plus, Send, X } from 'lucide-react'
import { useCreateSubmission } from '@/api/submissions'
import type { SubmissionType } from '@/api/types'
import { Button } from '@/components/ui/button'
import { isOverdue } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const LANGUAGES = ['C', 'C++', 'Java', 'Python 3', 'JavaScript', 'TypeScript'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 서버 제한(10MB)의 선반영 - 최종 판정은 서버
const MAX_LINKS = 5

/**
 * 제출 폼 (#18) - 3종 택1(type): 코드(언어 필수) / zip 파일(10MB) / 링크(1~5개, + 버튼).
 * 선택한 탭의 필수값이 다 차야 제출 가능(버튼 비활성으로 서버 400 선반영).
 * CLAUDE.md 필수 규칙: 실패 시 입력 보존(상태를 지우지 않는다) + 요청 중 버튼 잠금.
 * 마감 후에도 제출 가능 - "지각 제출로 기록" 확인 안내 후 진행 (flows UC-S4 A1).
 */
export function SubmissionForm({ cohortId, assignmentId, dueAt }: { cohortId: number; assignmentId: number; dueAt: string }) {
  const [tab, setTab] = useState<SubmissionType>('CODE')
  const [codeText, setCodeText] = useState('')
  const [language, setLanguage] = useState('')
  const [linkUrls, setLinkUrls] = useState<string[]>([''])
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mutation = useCreateSubmission(cohortId, assignmentId)

  const filledLinks = linkUrls.map((url) => url.trim()).filter((url) => url !== '')
  const canSubmit =
    !mutation.isPending &&
    (tab === 'CODE'
      ? codeText.trim() !== '' && language !== ''
      : tab === 'FILE'
        ? file !== null
        : filledLinks.length >= 1)

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
      setFileError('파일은 10MB 이하여야 해요.')
      return
    }
    setFile(selected)
  }

  const setLinkAt = (index: number, value: string) => {
    setLinkUrls((prev) => prev.map((url, i) => (i === index ? value : url)))
  }

  const removeLinkAt = (index: number) => {
    setLinkUrls((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  const handleSubmit = () => {
    if (isOverdue(dueAt) && !window.confirm('마감이 지난 과제예요. 지각 제출로 기록됩니다. 계속할까요?')) return
    mutation.mutate(
      {
        payload: {
          type: tab,
          codeText: tab === 'CODE' ? codeText : null,
          language: tab === 'CODE' ? language : null,
          linkUrls: tab === 'LINK' ? filledLinks : null,
        },
        file: tab === 'FILE' ? file : null,
      },
      {
        onSuccess: () => {
          // 성공했을 때만 비운다 - 실패 시 입력 보존 (CLAUDE.md 규칙 1)
          setCodeText('')
          setLanguage('')
          setLinkUrls([''])
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
        <div className="flex" role="tablist" aria-label="제출 형태">
          <button type="button" role="tab" aria-selected={tab === 'CODE'} className={tabClass(tab === 'CODE')} onClick={() => setTab('CODE')}>
            <Code className="size-4" />
            코드 작성
          </button>
          <button type="button" role="tab" aria-selected={tab === 'FILE'} className={tabClass(tab === 'FILE')} onClick={() => setTab('FILE')}>
            <FileArchive className="size-4" />
            파일 업로드
          </button>
          <button type="button" role="tab" aria-selected={tab === 'LINK'} className={tabClass(tab === 'LINK')} onClick={() => setTab('LINK')}>
            <Link2 className="size-4" />
            링크 제출
          </button>
        </div>
        {tab === 'CODE' && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="제출 언어"
            className="h-8 rounded-[2px] border bg-card px-2 text-sm"
          >
            <option value="">언어 선택 (필수)</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-3 p-4">
        {tab === 'CODE' && (
          <textarea
            value={codeText}
            onChange={(e) => setCodeText(e.target.value)}
            placeholder="코드를 붙여넣으세요"
            aria-label="제출 코드"
            spellCheck={false}
            className="h-56 w-full resize-y rounded-[2px] border bg-muted/40 p-3 font-mono text-sm outline-none focus:border-primary"
          />
        )}
        {tab === 'FILE' && (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[2px] border border-dashed p-6 text-center">
            <FileArchive className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">zip 파일 1개, 최대 10MB</p>
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
        {tab === 'LINK' && (
          <div className="min-h-56 space-y-2 rounded-[2px] border p-4">
            <p className="text-sm text-muted-foreground">GitHub·배포 URL 등을 1~5개 제출할 수 있어요. 입력 순서대로 저장됩니다.</p>
            {linkUrls.map((url, index) => (
              // index key 사용: 순서가 곧 의미(position)라 재정렬이 없다
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setLinkAt(index, e.target.value)}
                  placeholder="https://"
                  aria-label={`제출 링크 ${index + 1}`}
                  className="h-9 flex-1 rounded-[2px] border bg-card px-3 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => removeLinkAt(index)}
                  aria-label={`링크 ${index + 1} 삭제`}
                  className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {linkUrls.length < MAX_LINKS && (
              <button
                type="button"
                onClick={() => setLinkUrls((prev) => [...prev, ''])}
                className="flex items-center gap-1 rounded-[2px] border border-dashed px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" />
                링크 추가 ({linkUrls.length}/{MAX_LINKS})
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">코드 / 파일 / 링크 중 한 형태를 골라 제출해요. 재제출은 이력으로 쌓입니다.</p>
          <Button className="rounded-[2px]" onClick={handleSubmit} disabled={!canSubmit}>
            <Send data-icon="inline-start" />
            {mutation.isPending ? '제출 중...' : '제출하기'}
          </Button>
        </div>

        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
        {mutation.isSuccess && !mutation.isPending && <p className="text-sm font-semibold text-[#16a34a]">제출 완료! 아래 기록에서 확인하세요.</p>}
      </div>
    </section>
  )
}
