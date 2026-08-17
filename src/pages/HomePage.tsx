import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Haedal Online Judge</h1>
      <p className="text-muted-foreground">프론트엔드 스캐폴드가 준비되었습니다.</p>
      <Button>시작하기</Button>
    </main>
  )
}
