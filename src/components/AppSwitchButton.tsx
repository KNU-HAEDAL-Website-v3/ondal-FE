import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { lastPath, MODE_LABEL, type AppMode } from '@/lib/appSwitch'

const DESCRIPTION: Record<AppMode, string> = {
  hoj: '문제 은행에서는 분반·과제와 무관하게 문제를 골라 풀고 바로 채점받을 수 있어요. 돌아올 때는 지금 보던 화면으로 돌아와요.',
  ondal: '과제 플랫폼으로 돌아가요. 분반·과제·출석·공지·Q&A 는 그쪽에 있어요. 다시 오면 지금 보던 화면으로 돌아와요.',
}

/**
 * 다른 모드(Ondal ↔ HOJ)로 건너가는 버튼 - 누르면 "~로 이동할까요?" 확인을 받고 이동한다.
 * 2026-09-19 PM: 두 모드의 메뉴가 서로 다르니 실수로 넘어가면 "화면이 바뀌었다"고 느낀다 - 한 번 묻는다.
 * 생김새(className·children)는 부르는 셸이 정한다: 사이드바에서는 메뉴 한 줄, HOJ 상단 바에서는 작은 버튼.
 * 이동 후 목적지는 그 모드에서 마지막에 보던 화면 (lib/appSwitch).
 */
export function AppSwitchButton({ to, className, children }: { to: AppMode; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MODE_LABEL[to]}로 이동할까요?</AlertDialogTitle>
            <AlertDialogDescription>{DESCRIPTION[to]}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니요</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(lastPath(to))}>네, 이동할게요</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
