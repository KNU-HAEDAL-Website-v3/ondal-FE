// 만든 사람들 - 기수별 누적. 새 기수가 합류하면 CREDITS 배열에 한 항목을 추가한다.
// 실명 표기는 본인 동의가 먼저다 - 동의 전에는 GitHub 아이디만, 동의 후 name 필드를 채운다.

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
