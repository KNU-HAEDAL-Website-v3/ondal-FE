import { Suspense, lazy } from 'react'

/**
 * 코드 편집기·열람 뷰의 지연 로딩 껍데기.
 *
 * CodeMirror 본체 + 언어 5종 + 테마 4종은 번들에서 가장 무거운 덩어리인데, 정작 쓰는 화면은
 * 과제 상세·출제 폼뿐이다. 홈·출석·공지처럼 에디터가 없는 화면의 첫 로딩까지 그 값을 치르지 않도록
 * 실제 구현(CodeMirrorPane)은 필요할 때 받아 온다.
 *
 * props 는 구현과 같은 모양을 유지한다 - 화면 코드는 이 파일만 알면 된다.
 */

const CodeEditorImpl = lazy(() => import('./CodeMirrorPane').then((m) => ({ default: m.CodeEditorImpl })))
const CodeViewerImpl = lazy(() => import('./CodeMirrorPane').then((m) => ({ default: m.CodeViewerImpl })))

/** 받아 오는 동안 자리를 잡아 둔다 - 높이가 같아야 폼이 덜컹거리지 않는다 */
function EditorSkeleton({ height, label }: { height: string; label: string }) {
  return (
    <div
      role="status"
      style={{ height }}
      className="flex items-center justify-center rounded-[2px] border bg-muted/40 text-sm text-muted-foreground"
    >
      {label}
    </div>
  )
}

export function CodeEditor(props: { value: string; onChange: (value: string) => void; language: string | null }) {
  return (
    <Suspense fallback={<EditorSkeleton height="248px" label="편집기 불러오는 중..." />}>
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
