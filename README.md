# ondal-FE

Ondal(온달, 해달 온라인 저지) 프론트엔드 - 학생·운영진 웹 화면.

> 📚 **기획·설계 문서: [ondal-docs](https://github.com/KNU-HAEDAL-Website-v3/ondal-docs)에 집약. 화면 기준본: 와이어프레임 v2.1.**

## 실행법

```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (http://localhost:5173) - /api 는 로컬 백엔드(:8080)로 프록시. BE 레포의 `docker compose up -d && ./gradlew bootRun` 먼저
npm run dev:mock   # 백엔드 없이 화면만 볼 때 - MSW mock 서버 (계정: admin / operator1 / student1~3, 또는 아무 아이디)
npm run build      # 타입 체크 + 프로덕션 빌드
npm run lint       # 린트 (oxlint)
```

환경변수: [`.env.example`](.env.example) 참고 (`VITE_API_BASE_URL`, `VITE_API_MOCK`, `VITE_AUTH_MODE`).

## 로그인 방식 (`VITE_AUTH_MODE`)

| 값 | 로그인 화면 | 짝이 되는 BE | 쓰는 곳 |
|---|---|---|---|
| `stub` (기본) | 아이디 폼 - 아이디만 입력하면 통과 | `ondal.auth.mode=stub` (local) / mock | `npm run dev`, `npm run dev:mock`, PR 미리보기 |
| `oidc` | "홈페이지 계정으로 로그인" 버튼 → 해달 홈페이지(Keycloak) → 복귀 | `ondal.auth.mode=oidc` (prod) | `main` 프로덕션 빌드 |

- `oidc` 는 `VITE_API_BASE_URL` **절대 주소 필수** - 로그인이 fetch 가 아니라 브라우저 이동(`GET /api/auth/login`)이라 vite 프록시(상대 경로)로는 동작하지 않음. 빌드가 검사해 막음 (`vite.config.ts`)
- 실패 시 BE 가 `/login?error=<코드>` 로 돌려보냄 - 안내 문구 매핑은 `src/pages/LoginPage.tsx`, 코드 원본은 BE `OidcLoginError`(6종). "다시 로그인" 으로 처음부터 재시작
- 로그아웃: `POST /api/auth/logout` 응답의 `logoutUrl` 이 있으면 그 주소(Keycloak)로 이동해 홈페이지 세션까지 종료 → Keycloak 이 `/login` 으로 되돌림. null 이면 `/login` 으로만 이동
- mock 모드는 값과 무관하게 `stub` 폼 (MSW 가 스텁 흐름만 흉내 냄)

## 배포 (Cloudflare)

| 무엇 | 주소 | 배포 경로 | 빌드 값 |
|---|---|---|---|
| **프로덕션** (사용자 진입) | https://ondal.haedal-sos-man-in-the-mirror.com | Cloudflare Worker `ondal-fe` - Git 연동(Workers Builds): `main` push 마다 `npm run build` → 정적 자산 배포. 설정은 Cloudflare 대시보드(레포에 wrangler 설정 없음) | [`.env.production`](.env.production) - 실 BE(`https://ondal-api.haedal-sos-man-in-the-mirror.com`) + 홈페이지 로그인(`oidc`) |
| Pages `main` 배포 | https://haedal-online-judge-fe.pages.dev | GitHub Actions [`deploy.yml`](.github/workflows/deploy.yml) (wrangler Direct Upload) | `.env.production` 과 동일 - 단 pages.dev 는 BE 와 다른 사이트라 세션 쿠키(lax)·CORS 대상이 아니어서 **로그인 불가**. 반드시 커스텀 도메인으로 접속 |
| **PR 미리보기** | `https://<브랜치명>.haedal-online-judge-fe.pages.dev` (PR 코멘트에 링크) | 같은 deploy.yml - PR 생성·갱신 시 | `VITE_API_MOCK=true`(MSW, 로그인은 stub 폼) - 화면 클릭 가능, 데이터는 가짜(시드와 동일) |

- `.env.production` 은 비밀값 아님(공개 주소·모드 스위치)이라 커밋 - Workers Builds 와 Actions 가 같은 값으로 빌드되는 단일 출처. 값 변경은 이 파일 한 곳에서
- Workers Builds 는 PR 브랜치도 빌드해 PR 체크 `Workers Builds: ondal-fe` 로 표시됨 - 미리보기는 pages.dev 링크를 쓰면 됨
- deploy.yml 은 레포 시크릿 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 필요

## 기술 스택

- **프레임워크**: React 19 + TypeScript (Vite 8, SPA)
- **라우팅**: React Router 8 (선언형 `<BrowserRouter>`)
- **서버 상태**: TanStack Query 5
- **스타일**: Tailwind CSS 4 + shadcn/ui (Radix)
- **패키지 매니저**: npm / **린터**: oxlint
- **경로 별칭**: `@/*` → `src/*`
- **mock**: MSW 2 (`src/mocks/`, `VITE_API_MOCK=true` 일 때만 로드)

## 코드 구조

```
src/
  api/          서버 통신 - client.ts(fetch 래퍼·ApiError), types.ts(BE DTO 미러), auth.ts·cohorts.ts·members.ts·assignments.ts·submissions.ts·questions.ts·notices.ts·sessions.ts·attendances.ts(요청 함수 + React Query 훅)
  components/   RequireAuth(로그인 울타리) · RequireAdmin(관리자 울타리) · ApiErrorView(403→홈, 404 안내, 재시도) · layout/AppShell(사이드바·상단 바) · cohorts/(분반 카드·섹션·운영진 팝업) · ui/(shadcn)
  pages/        LoginPage · HomePage(역할별 대시보드 - dashboard/) · CohortPage · CohortMembersPage(명부·배정) · AdminCohortsPage·CohortFormPage(관리자 분반 관리) · Assignments*(목록·상세·폼) · AttendancePage(attendance/) · Questions*(Q&A 목록·상세·폼) · Notice*(공지 목록·상세·폼) · ProblemsPage(P3 안내) · NotFoundPage
  lib/          datetime(KST 표시) · draft(폼 임시 저장 - 세션 만료 대비) · loginIds(명단 붙여넣기 파싱) · params(경로 변수 검증)
  routes.tsx    라우트 한눈에 보기
  mocks/        MSW 핸들러 + 시드 데이터 (BE LocalDataSeeder 와 동일하게 유지)
```

공통 규칙 구현 위치:

- 401 → `api/client.ts`(setUnauthenticatedHandler) + `RequireAuth`
- 403·404 → `ApiErrorView`
- 중복 제출 방지 → 각 폼의 `isPending` 잠금

## 규칙

- `main` 직접 push 금지 - 모든 변경은 PR로 (승인 1명 필수, 팀원 합류 후 적용)
- 화면·용어: docs 레포의 화면 정의 문서 기준 (내부 모델 "Cohort" → UI에서는 "분반")
- API 계약: 백엔드 springdoc(OpenAPI) 문서가 기준
