// 만든 사람들 - 기수별 누적. 새 기수가 합류하면 CREDITS 배열 **맨 앞**에 항목을 추가한다 (최신 기수가 팝업 위에 - PM 결정 2026-08-25).
// 실명 표기는 본인 동의가 먼저다 - 동의 전에는 GitHub 아이디만, 동의 후 name 필드를 채운다.
// 기수가 4~5개로 쌓여 팝업이 길어지면 별도 페이지(/credits)로 승격 - 이 데이터는 그대로 재사용.

export interface CreditMember {
  github: string
  role: string
  /** 본인 동의 후에만 채운다 */
  name?: string
}

export interface CreditGeneration {
  generation: number
  members: CreditMember[]
}

export const CREDITS: CreditGeneration[] = [
  {
    generation: 1,
    members: [
      { github: 'pigmal24', role: '디자인' },
      { github: 'hak-fe', role: 'FE · BE' },
      { github: 'jungminmobile', role: 'BE' },
    ],
  },
]
