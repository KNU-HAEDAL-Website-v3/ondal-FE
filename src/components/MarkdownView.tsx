import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * 문제·과제 본문 마크다운 렌더링 (2026-09-19) - 문제 은행 100문제는 입력·출력 형식 표와 코드 블록이 필요해 일반 텍스트로는 부족했다.
 * react-markdown 은 기본으로 HTML 을 렌더하지 않는다(문자열로 표시) - 운영진이 쓰는 본문이지만 스크립트가 들어갈 길을 열지 않는다.
 * 스타일은 요소별 클래스로 준다 - 타이포그래피 플러그인 없이 토큰(index.css)만 쓴다
 */
export function MarkdownView({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-5 mb-2 text-lg font-bold tracking-tight first:mt-0">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-5 mb-2 text-base font-bold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-4 mb-1.5 text-sm font-bold first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="my-2 text-sm leading-7 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-sm leading-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-sm leading-6">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-border pl-3 text-sm text-muted-foreground">{children}</blockquote>
          ),
          code: ({ className: codeClass, children }) => {
            const block = typeof codeClass === 'string' && codeClass.startsWith('language-')
            return block ? (
              <code className="font-mono text-xs leading-5">{children}</code>
            ) : (
              <code className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs leading-5 whitespace-pre">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted text-xs text-muted-foreground">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t px-3 py-1.5 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        }}
      >
        {source}
      </Markdown>
    </div>
  )
}
