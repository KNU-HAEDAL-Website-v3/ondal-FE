# CLAUDE.md - ondal-FE

> 전체 기획·설계 맥락: [docs 레포](https://github.com/KNU-HAEDAL-Website-v3/ondal-docs)
> 이 파일: 프론트 작업 시 필요한 최소 맥락 요약본

## 화면 (P1)

- 학생 5: 로그인 → 홈(소속 분반 카드 / 미소속 안내) → 분반 페이지 → 차시 페이지 → 과제 페이지(제출)
- 운영진 3: 분반 관리(생성·수강생 배정) · 과제 관리(CRUD·마감 설정) · 미제출자 대시보드
  - 분반 관리 구현 위치: 관리자 `/admin/cohorts`(목록·생성·수정·보관, `RequireAdmin`) + 운영진 이상 `/cohorts/:id/members`(명부·수강생 추가·제외, 관리자는 운영진 지정·해제까지). 추가·지정은 `MemberPickerDialog`(2026-09-19) - 부원 목록(`GET /api/users`)에서 **체크박스로 선택**, 보조 탭 "명단 붙여넣기"(`lib/loginIds`, 아이디 = Keycloak username = 구글 로그인이면 이메일). 이미 이 반에 있는 사람은 잠금, 승인 대기 계정은 배정과 함께 승인됨
- Q&A(P1 편입, docs decisions/6): 분반 페이지 → 질문 목록·상세·작성·수정 - 소속 누구나 조회·등록, 수정은 작성자, 삭제는 작성자·운영진. 버튼 분기는 서버 `canEdit`·`canDelete` 값만. 답변(P2, 2026-09-14): 상세 하단 `AnswerSection` - 소속 누구나 답변, 인라인 수정·삭제 같은 규칙, 목록 행 "답변 N"(`answerCount`)
- 공지사항(P2, docs notice/): `/notices` 역할 통합 한 화면 - 목록은 서버 가시성(전체 + 소속 분반) 그대로, 작성은 관리자(전체·분반)·운영진(자기 반), 수정·삭제 버튼은 `canEdit`·`canDelete`. 견본 데이터 화면(Student/OperatorNoticesView)은 제거됨
- 출석부(P2, docs attendance/): `/attendance` - 학생 뷰(내 출석·출석률 링, `GET /attendances/me`) / 운영진 뷰(분반 → 차시 선택·추가·수정·삭제 → 명부 셀렉트로 즉시 표시, 일괄 출석). 출석률·요약·상태는 서버 값, 미확인 = `status: null`, 요일만 FE 계산
- 홈 대시보드는 전부 실데이터(2026-09-14): 학생 = 진행 중 과제·가까운 마감·제출 수·출석률 + 마감 임박 과제·공지 / 운영진 = 수강생 수·최근 차시 출석률·마감 임박·미제출 + 과제별 제출 현황판·빠른 이동·공지. **견본(SAMPLE_) 데이터 화면은 더 두지 않는다** - 문제 페이지(P3)는 "준비 중" 안내만
- 제출 코멘트(P2, 2026-09-14, docs submission/design.md 결정 18): 제출 단건 펼침 뷰(`SubmissionDetailView`) 하단 `운영진 코멘트` 상자 - 운영진(`canManage`)만 남기기·수정·지우기(PUT/DELETE `.../submissions/{id}/comment`), 학생은 읽기 + 내 기록 행 배지(`hasComment`), 현황판 `코멘트` 열(`latestCommented`). **점수 없음** - 결과는 채점 엔진이 말한다
- 자동 채점(P2, 2026-09-14, docs judge/): 출제 = 과제 폼 아래 `JudgeConfigSection`(테스트케이스 표·제한·정답 코드로 기대 출력 채우기·출제 검증·예시 미리보기, 저장은 과제 → `PUT .../judge` 순서, 기존 제출 있으면 재채점 확인) / 학생 = 상세 헤더 "자동 채점" 배지 + `JudgeSamplesSection`(공개 케이스 예시) / 결과 = `VerdictBadge`(내 기록 "채점 결과" 열·현황판 "판정" 열) + 펼침 뷰 `JudgeResultView`. **판정·통과 수는 서버 값 그대로**, 채점 중(PENDING/RUNNING)이면 2초 폴링(`api/submissions.ts`). mock 가짜 엔진(`mocks/judge.ts`) = BE FakeJudgeEngine 규칙(지시 주석·echo)
- HOJ(문제 은행)는 같은 앱 안의 **모드**(2026-09-19 PM, docs 결정 9 - 별도 앱 분리(결정 8)는 철회): `/problems/*`·`/admin/tags` 는 `HojShell`(상단 가로 메뉴: 문제 · 태그 관리(관리자)), 나머지는 `AppShell`(사이드바). 서로 오가는 버튼은 `AppSwitchButton` - "~로 이동할까요?" 확인 뒤 이동, 돌아올 때는 그 모드에서 마지막에 보던 화면(`lib/appSwitch`). 별도 빌드·도메인·환경 변수 없음
- 승인 게이트(2026-09-19, docs 결정 10): 첫 홈페이지 로그인 계정은 `me.status === 'PENDING'` - `RequireAuth` 가 어느 주소에서든 `PendingApprovalPage`(사이드바 없음)만 그린다. 어느 API 에서든 403 `USER_PENDING` 을 받으면 `api/client.ts` 의 pending 핸들러가 me.status 를 PENDING 으로 바꿔 같은 화면으로. 승인은 `/members`(부원 관리, `RequireOperator`)의 승인 버튼 또는 분반 배정(자동 승인). 운영진 대시보드 상단 `PendingApprovalBanner`. mock 은 `newbie` 가 승인 대기
- 문제 은행 지원(2026-09-19, BE V9): 문제에 **난이도**(`difficulty` 1~25, 표기 "대분류-소분류" `lib/difficulty` · `DifficultyBadge`)와 **허용 언어**(`allowedLanguages`, `lib/languages`)가 있다. 목록은 난이도 열·대분류 필터, 출제 폼은 대분류/소분류 셀렉트 + 언어 칩, 제출 폼(HOJ 연습·과제 `SubmissionForm`)은 허용 언어로 선택지를 좁힌다(서버도 400). 본문은 **마크다운**(`MarkdownView`, react-markdown + remark-gfm, HTML 미렌더). 관리자 "문제 가져오기"(`ImportProblemsDialog` → `POST /api/problems/import`)는 문제 은행 레포 ondal-problems 의 번들 JSON. 번들이 10MB 안팎이라 `api/problemImport` 가 번호순 **10문제씩 나눠 순차 전송**(묶음마다 서버 트랜잭션, 도중 실패는 `ImportChunkError` 로 어디까지 저장됐는지 안내 - 같은 파일 재업로드로 이어짐). 과제 상세의 자동 채점 안내(`JudgeSamplesSection`)도 허용 언어만 표시
- 마이페이지(2026-09-19 신설, 원안에 없던 화면): `/me` - 상단 바의 내 이름(`AppShell`)에서 진입. 내 정보(`/api/auth/me`)·활동(`GET /api/me/stats` - 과제 제출·연습 제출·맞힌 문제)·소속 분반(`/api/me/cohorts`)·코드 에디터 테마(`lib/editorTheme`, 브라우저 저장)·로그아웃. 이름·아이디 수정 없음(홈페이지가 원본)
- 기준본: docs 레포의 와이어프레임 v2.1
- 용어: UI는 "분반"(내부 모델명 Cohort), "과제/문제"(내부 Assignment)

## 필수 동작 규칙

1. **작성 내용 유실 금지**
   - 제출 실패(401 세션만료 · 400 · 422) 시 코드/첨부/입력값 보존 + 재시도 가능 상태 유지
   - 세션 만료가 최다 케이스
2. **중복 제출 방지**: 제출 버튼은 요청 중 잠금 (서버도 방어하나 프론트가 1차 방어)
3. **권한 밖 URL 직접 접근**: 403 → 홈 리다이렉트 공통 처리
4. **마감·상태 표시는 서버 판정값 그대로**
   - 마감 시각: KST 표시
   - 제출/미제출/지각 배지: 서버 응답 그대로 표시 - 프론트 재계산 금지

## 디자인 규칙 (2026-09-19 경계 정리)

- **표면 3단계** - 토큰 정의는 `src/index.css` 주석: 캔버스(`bg-background`, 연한 보라 회색) < 패널(`bg-card` + `border`, 흰색 - 카드·표·폼 상자·사이드바·상단 바) < 팝업(`bg-popover` + 그림자)
  - 반투명 표면 금지(`bg-card/40`, `bg-muted/50` ...) - 바닥에 따라 색이 달라져 경계가 흐려짐. 강조 바닥은 `bg-muted` 불투명
  - 색은 토큰만(`text-muted-foreground`, `bg-primary`, 상태색 `success/warning/caution/danger/info/neutral`) - `text-[#464555]` 같은 hex 직접 지정 금지
- **모서리는 `--radius` 스케일만**: 버튼·입력·패널·표 = 컴포넌트 기본값(`rounded-lg`) / 상태 칩·작은 토글·로고 = `rounded-md` / 아바타 = `rounded-full`. `rounded-[Npx]` 직접 지정 금지, `Button` 에 모서리 오버라이드 금지
- **제목 2단**: 페이지 제목 `h1 text-2xl font-bold tracking-tight` / 섹션 제목 `h2 text-lg font-bold tracking-tight` / 패널 안 제목 `h2 text-base font-bold` / 소제목(eyebrow) `text-xs font-bold tracking-[0.55px] text-muted-foreground`. 그 밖의 조합을 새로 만들지 않는다

## 문서 작성 규칙

- 모든 문서·PR 본문·이슈는 **개조식**으로 작성 (3개 레포 공통 - 상세: docs 레포 CONTRIBUTING.md)
  - 종결: 명사형·체언 종결("~함", "~됨", 명사구) - 서술형("~한다", "~입니다") 지양
  - 산문 문단 금지: 목록·표로 분해, 한 항목 = 한 정보
- 문단 부호 적극 사용: `-`, `1.`, `**강조**`, 표, `→`, `:`, `※`
- 키보드 밖 특수 부호 금지: em dash·en dash·말줄임표(한 글자)·절 기호(section sign) → `-`, `...`, `N절`

## API

- 계약 기준: 백엔드 springdoc(OpenAPI) 문서
  - 화면에 필요한 필드 부재 시: 프론트에서 조합 금지 → 백엔드에 API 변경 요청
- 로그인 방식은 빌드 변수 `VITE_AUTH_MODE` 로 고정 (README "로그인 방식" 절)
  - 개발은 `stub`(아이디 폼) - 로컬: 실제 BE (`npm run dev`, /api 프록시) / 백엔드 없이 볼 때·Pages 미리보기: mock (`npm run dev:mock`, MSW)
  - 운영(`main` 빌드)은 `oidc` - "홈페이지 계정으로 로그인" 버튼 → Keycloak → 복귀. `VITE_API_BASE_URL` 절대 주소 필수
  - **mock 데이터(`src/mocks/data.ts`)는 BE `LocalDataSeeder`와 같은 계정·분반 유지**, 응답 모양은 `src/api/types.ts`(BE DTO 미러) 준수
- 공통 처리 위치: 401 → `api/client.ts` + `RequireAuth` / 403 → `ApiErrorView`가 홈으로 / 404 → `ApiErrorView` 안내
  - 페이지는 에러를 `ApiErrorView`에 전달만 담당
