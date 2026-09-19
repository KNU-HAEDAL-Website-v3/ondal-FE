import { Suspense, lazy } from 'react'

/**
 * 코드 편집기·열람 뷰의 지연 로딩 껍데기.
 *
 * CodeMirror 본체 + 언어 5종 + 테마 4종은 번들에서 가장 무거운 덩어리인데, 정작 쓰는 화면은
 * 과제 상세·출제 폼·마이페이지(테마 미리보기)뿐이다. 홈·출석·공지처럼 에디터가 없는 화면의 첫 로딩까지 그 값을 치르지 않도록
 * 실제 구현(CodeMirrorPane)은 필요할 때 받아 온다.
 *
 * props 는 구현과 같은 모양을 유지한다 - 화면 코드는 이 파일만 알면 된다.
 */

const CodeEditorImpl = lazy(() => import('./CodeMirrorPane').then((m) => ({ default: m.CodeEditorImpl })))
const CodeViewerImpl = lazy(() => import('./CodeMirrorPane').then((m) => ({ default: m.CodeViewerImpl })))
const EditorThemeGalleryImpl = lazy(() => import('./CodeMirrorPane').then((m) => ({ default: m.EditorThemeGalleryImpl })))

/** 받아 오는 동안 자리를 잡아 둔다 - 높이가 같아야 폼이 덜컹거리지 않는다 */
function EditorSkeleton({ height, label }: { height: string; label: string }) {
  return (
    <div
      role="status"
      style={{ height }}
      className="flex items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground"
    >
      {label}
    </div>
  )
}

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string | null
  /** 편집기 높이(CSS 길이) - 기본 224px. 분할 화면은 clamp(), 전체 화면은 svh 기준 */
  height?: string
  /** 초기화 버튼 - 주면 도구 줄에 생긴다 */
  onReset?: () => void
  fullscreen?: boolean
  /** 전체 화면 토글 버튼 - 주면 도구 줄에 생긴다. 실제 덮개는 호출자가 그린다 (FullscreenPane) */
  onToggleFullscreen?: () => void
}

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton height={props.height ?? '248px'} label="편집기 불러오는 중..." />}>
      <CodeEditorImpl {...props} />
    </Suspense>
  )
}

export function CodeViewer(props: { value: string; language: string | null }) {
  return (
    <Suspense fallback={<EditorSkeleton height="160px" label="코드 불러오는 중..." />}>
      <CodeViewerImpl {...props} />
    </Suspense>
  )
}

/** 마이페이지 테마 고르기 - 테마별 미리보기 카드 (lib/editorTheme 에 저장) */
export function EditorThemeGallery() {
  return (
    <Suspense fallback={<EditorSkeleton height="248px" label="테마 미리보기 불러오는 중..." />}>
      <EditorThemeGalleryImpl />
    </Suspense>
  )
}
