import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ApiErrorView'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <EmptyState icon={<SearchX className="size-8" />} title="페이지를 찾을 수 없어요" description="주소를 다시 확인해 주세요.">
        <Button variant="outline" size="sm" asChild>
          <Link to="/">홈으로</Link>
        </Button>
      </EmptyState>
    </main>
  )
}
