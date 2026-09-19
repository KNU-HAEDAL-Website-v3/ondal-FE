import { Link } from 'react-router'
import { CircleHelp, GraduationCap, ShieldCheck, UserCog } from 'lucide-react'
import { useMe } from '@/api/auth'

/**
 * 도움말 - 역할별 "여기서 무엇을 할 수 있나"와 문제 보고 방법. 테스트 주간(9/19~25)·부트캠프 첫 주에 처음 들어온 사람이 읽는 한 장.
 * 기능 목록은 운영 반영된 것만 적는다 - 준비 중인 것은 마지막 절에 따로.
 */
export default function HelpPage() {
  const { data: me } = useMe()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CircleHelp className="size-6 text-primary" />
          도움말
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ondal 은 해달 부트캠프의 과제 제출·출석·공지·Q&A 를 한곳에서 다루는 곳이에요.
          {me?.name ? ` ${me.name} 님은 ` : ' 지금은 '}
          {me?.globalRole === 'ADMIN' ? '해구르르(관리자)' : '부원'} 계정으로 로그인해 있어요. 분반 안에서의 역할(교육운영진 / 수강생)은 분반마다 달라요.
        </p>
      </header>

      <Section icon={GraduationCap} title="수강생">
        <li>
          <Link to="/assignments" className="font-semibold text-primary hover:underline">과제</Link>에서 마감과 상태 배지(미제출 · 제출 · 제출(추가) · 지각)를 확인하고, 코드 붙여넣기 · zip 업로드(10MB) · 링크 중 하나로 제출해요.
          마감 뒤에도 제출은 되지만 지각으로 기록돼요.
        </li>
        <li>다시 제출하면 기록이 쌓여요. 내 제출 기록에서 행을 펼치면 코드 전문과 운영진 코멘트를 볼 수 있어요. 코멘트가 달린 행에는 "코멘트" 배지가 붙어요.</li>
        <li>
          자동 채점이 걸린 과제는 상세 위쪽에 "자동 채점" 배지와 공개 예시가 보여요. 제출하면 "채점 결과" 열에 판정이 뜨고, 채점 중이면 자동으로 갱신돼요.
          공개 케이스는 행을 펼쳐 입력 · 기대 출력 · 실제 출력을 나란히 볼 수 있어요. 점수는 없어요.
        </li>
        <li>
          사이드바 맨 아래 "HOJ로 이동하기" 는 문제 은행이에요. 과제와 별개로 문제를 골라 풀어 보고, 태그로 찾을 수 있어요.
        </li>
        <li>
          <Link to="/attendance" className="font-semibold text-primary hover:underline">출석</Link>은 운영진이 표시하고, 나는 내 기록과 출석률만 봐요.
        </li>
        <li>
          <Link to="/notices" className="font-semibold text-primary hover:underline">공지사항</Link>은 전체 공지와 내 분반 공지만 보여요. 필독은 맨 위에 고정돼요.
        </li>
        <li>
          분반 페이지의 Q&A 에서 질문을 올리고 누구나 답변할 수 있어요. 내 글만 수정할 수 있고, 삭제는 내 글 또는 운영진이 해요.
        </li>
      </Section>

      <Section icon={UserCog} title="교육운영진">
        <li>
          과제 등록은 "이미 있는 문제를 내 분반에 배정"하는 일이에요 - 문제를 고르고 차시와 마감만 정해요.
          수정 · 삭제도 여기서 해요(삭제하면 제출물이 함께 지워지니 경고를 확인해요). 새 문제가 필요하면 HOJ 출제 화면에서 먼저 만들어요.
        </li>
        <li>
          HOJ 에서 문제를 출제할 때 테스트케이스를 넣으면 자동 채점이 켜져요. 정답 코드로 기대 출력을 채우고 "출제 검증"으로 케이스가 맞는지 먼저 확인해요.
          같은 문제를 여러 분반에 배정해도 테스트케이스는 하나를 같이 써요.
        </li>
        <li>과제 상세의 제출 현황판에서 수강생 전원의 상태와 "코멘트" 열(남김 / 아직)을 보고, 열람(눈 아이콘)으로 최신 제출을 펼쳐 코드 확인 · 파일 다운로드 · 코멘트 남기기를 해요. 점수는 없어요.</li>
        <li>출석에서 차시를 등록하고 명부에 출석 · 지각 · 결석을 표시해요. 출석률은 서버가 계산해요.</li>
        <li>내 분반 공지를 쓰고 관리해요. 전체 공지는 해구르르만 써요.</li>
        <li>수강생 배정(명단 붙여넣기) · 제외는 내 분반의 명부에서 해요.</li>
      </Section>

      <Section icon={ShieldCheck} title="해구르르 (관리자)">
        <li>
          <Link to="/admin/cohorts" className="font-semibold text-primary hover:underline">분반 관리</Link>에서 분반 생성 · 수정 · 보관 · 복원과 운영진 지정을 해요. 보관된 분반은 열람만 되고 새 글 · 제출이 막혀요.
        </li>
        <li>전체 공지(필독 포함)를 쓰고, 모든 분반의 운영진 화면에 들어갈 수 있어요.</li>
      </Section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-bold">문제가 생기면</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
          <li>로그인이 풀려 로그인 화면으로 갔다면, 다시 로그인하면 원래 화면으로 돌아오고 쓰던 내용이 남아 있어요.</li>
          <li>화면이 이상하거나 값이 틀리면 운영진 채널에 알려 주세요. 역할 · 화면 주소 · 한 일 순서 · 기대한 것과 실제 · 시각을 함께 적어 주면 바로 찾을 수 있어요.</li>
          <li>준비 중: 알림(디스코드 · 이메일)은 두지 않기로 했어요. 점수도 두지 않고 코멘트만 남겨요.</li>
        </ul>
      </section>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof GraduationCap; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{children}</ul>
    </section>
  )
}
