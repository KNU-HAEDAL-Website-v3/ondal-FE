import { useEffect, useRef, useState } from 'react'
import { Code, FileArchive, Link2, Plus, Save, Send, X } from 'lucide-react'
import { useCreateSubmission } from '@/api/submissions'
import type { SubmissionType } from '@/api/types'
import { CodeEditor } from '@/components/code/CodePane'
import { FullscreenPane } from '@/components/code/FullscreenPane'
import { Button } from '@/components/ui/button'
import { isOverdue } from '@/lib/datetime'
import { clearDraft, readDraft, writeDraft } from '@/lib/draft'
import { cn } from '@/lib/utils'

import { useProblem } from '@/api/problems'
import { selectableLanguages } from '@/lib/languages'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 서버 제한(10MB)의 선반영 - 최종 판정은 서버
const MAX_LINKS = 5

// 작성 중인 제출 내용은 이 탭에 임시 저장(lib/draft) - 세션 만료(401)로 로그인 화면에 다녀와도 코드가 남는다 (CLAUDE.md 규칙 1).
// 키는 과제 단위: 과제마다 따로 남고, 제출에 성공하면 지운다.
// 파일(zip)은 직렬화할 수 없어 저장 대상이 아니다 - 브라우저가 파일 입력을 비우므로 다시 고르면 된다.
const DRAFT_PREFIX = 'ondal-submission-draft'
const draftKey = (cohortId: number, assignmentId: number) => `${DRAFT_PREFIX}:${cohortId}:${assignmentId}`

interface SubmissionDraft {
  tab: SubmissionType
  codeText: string
  language: string
  linkUrls: string[]
}

/** "임시 저장됨 14:23:05" 표시용 - 원안의 "마지막 임시 저장" 문구 */
function timeLabel(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * 제출 폼 (#18) - 3종 택1(type): 코드(언어 필수) / zip 파일(10MB) / 링크(1~5개, + 버튼).
 * 선택한 탭의 필수값이 다 차야 제출 가능(버튼 비활성으로 서버 400 선반영).
 * CLAUDE.md 필수 규칙: 실패 시 입력 보존(상태를 지우지 않는다) + 요청 중 버튼 잠금.
 * 마감 후에도 제출 가능 - "지각 제출로 기록" 확인 안내 후 진행 (flows UC-S4 A1).
 * 원안(수강자 코드 과제 상세) 반영(2026-09-20): 편집기 초기화·전체 화면, 임시 저장 시각 표시, 파일은 드래그로도 첨부.
 */
export function SubmissionForm({
  cohortId,
  assignmentId,
  dueAt,
  judgeEnabled = false,
  problemId,
  editorHeight,
}: {
  cohortId: number
  assignmentId: number
  dueAt: string
  /** 자동 채점 문제 - 코드 제출은 바로 채점된다는 안내 (judge/fe.md 2절) */
  judgeEnabled?: boolean
  /** 배정된 문제 id - 허용 언어(V9)를 읽어 언어 선택지를 좁힌다. 서버도 같은 규칙으로 400 을 낸다 */
  problemId?: number
  /** 편집기 높이 - 과제 상세가 2단 분할일 때 화면 높이에 맞춰 키운다 */
  editorHeight?: string
}) {
  const problemQuery = useProblem(problemId ?? NaN)
  const allowedLanguages = problemQuery.data?.allowedLanguages ?? []
  const key = draftKey(cohortId, assignmentId)
  const [tab, setTab] = useState<SubmissionType>(() => readDraft<SubmissionDraft>(key)?.tab ?? 'CODE')
  const [codeText, setCodeText] = useState(() => readDraft<SubmissionDraft>(key)?.codeText ?? '')
  const [language, setLanguage] = useState(() => readDraft<SubmissionDraft>(key)?.language ?? '')
  const [linkUrls, setLinkUrls] = useState<string[]>(() => readDraft<SubmissionDraft>(key)?.linkUrls ?? [''])
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mutation = useCreateSubmission(cohortId, assignmentId)

  useEffect(() => {
    const empty = codeText === '' && language === '' && linkUrls.every((url) => url.trim() === '')
    if (empty) {
      clearDraft(key)
      setSavedAt(null)
    } else {
      writeDraft<SubmissionDraft>(key, { tab, codeText, language, linkUrls })
      setSavedAt(timeLabel(new Date()))
    }
  }, [key, tab, codeText, language, linkUrls])

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

  const handleReset = () => {
    if (codeText === '' || window.confirm('작성한 코드를 모두 지울까요? 임시 저장본도 함께 지워져요.')) setCodeText('')
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
          clearDraft(key)
          setCodeText('')
          setLanguage('')
          setLinkUrls([''])
          setFile(null)
          setFullscreen(false)
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

  const languageSelect = (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      aria-label="제출 언어"
      className="h-8 rounded-lg border bg-card px-2 text-sm"
    >
      <option value="">언어 선택 (필수)</option>
      {selectableLanguages(allowedLanguages).map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
  )

  const editor = (
    <CodeEditor
      value={codeText}
      onChange={setCodeText}
      language={language === '' ? null : language}
      height={fullscreen ? 'calc(100svh - 11rem)' : editorHeight}
      onReset={handleReset}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
    />
  )

  const actionRow = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>
          {judgeEnabled
            ? '자동 채점 문제예요. 코드 제출은 바로 채점되고, zip·링크는 운영진이 확인합니다. 재제출은 이력으로 쌓여요.'
            : '코드 / 파일 / 링크 중 한 형태를 골라 제출해요. 재제출은 이력으로 쌓입니다.'}
        </span>
        {savedAt && tab !== 'FILE' && (
          <span className="inline-flex items-center gap-1 font-mono" title="이 브라우저 탭에 자동으로 임시 저장돼요 - 로그인 화면에 다녀와도 남아요">
            <Save className="size-3" aria-hidden />
            임시 저장됨 {savedAt}
          </span>
        )}
      </p>
      <Button onClick={handleSubmit} disabled={!canSubmit}>
        <Send data-icon="inline-start" />
        {mutation.isPending ? '제출 중...' : '제출하기'}
      </Button>
    </div>
  )

  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          {tab === 'CODE' && languageSelect}
        </div>
        {tab === 'CODE' && allowedLanguages.length > 0 && (
          <p className="pb-2 text-xs text-muted-foreground">이 문제는 {allowedLanguages.join(', ')} 로만 제출할 수 있어요.</p>
        )}
      </div>

      <div className="space-y-3 p-4">
        {tab === 'CODE' && !fullscreen && editor}
        {tab === 'CODE' && (
          <FullscreenPane open={fullscreen} title="코드 작성 - 전체 화면" onClose={() => setFullscreen(false)}>
            <div className="flex items-center justify-end">{languageSelect}</div>
            {editor}
            {actionRow}
            {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
          </FullscreenPane>
        )}
        {tab === 'FILE' && (
          <div
            role="button"
            tabIndex={0}
            aria-label="zip 파일을 끌어다 놓거나 눌러서 고르기"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFileChange(e.dataTransfer.files?.[0] ?? null)
            }}
            className={cn(
              'flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors',
              dragging ? 'border-primary bg-secondary' : 'hover:border-primary/60',
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileArchive className="size-6" />
            </span>
            <p className="text-sm font-semibold">{file ? file.name : '클릭하거나 파일을 드래그하세요'}</p>
            <p className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)}KB · 다시 고르려면 누르세요` : 'zip 파일 1개, 최대 10MB'}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              aria-label="제출 파일"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              onClick={(e) => e.stopPropagation()}
              className="sr-only"
            />
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
        )}
        {tab === 'LINK' && (
          <div className="min-h-56 space-y-2 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">GitHub 저장소·배포 URL 등을 1~5개 제출할 수 있어요. 입력 순서대로 저장됩니다.</p>
            {linkUrls.map((url, index) => (
              // index key 사용: 순서가 곧 의미(position)라 재정렬이 없다
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setLinkAt(index, e.target.value)}
                  placeholder={index === 0 ? 'https://github.com/username/repository' : 'https://'}
                  aria-label={`제출 링크 ${index + 1}`}
                  className="h-9 flex-1 rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary"
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
                className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" />
                링크 추가 ({linkUrls.length}/{MAX_LINKS})
              </button>
            )}
          </div>
        )}

        {!fullscreen && actionRow}

        {mutation.error && !fullscreen && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
        {mutation.isSuccess && !mutation.isPending && (
          <p className="text-sm font-semibold text-success">
            {judgeEnabled && tab === 'CODE' ? '제출 완료! 채점 중이에요 - 아래 기록에서 결과를 확인하세요.' : '제출 완료! 아래 기록에서 확인하세요.'}
          </p>
        )}
      </div>
    </section>
  )
}
