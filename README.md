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

환경변수: [`.env.example`](.env.example) 참고 (`VITE_API_BASE_URL`, `VITE_API_MOCK`).

## 배포 (Cloudflare Pages)

- **프로덕션**: https://haedal-online-judge-fe.pages.dev - `main` 머지 시 자동 갱신
- **PR 미리보기**: PR 생성 시 GitHub Actions가 빌드·배포 후 미리보기 URL을 PR 코멘트로 남김 (`https://<브랜치명>.haedal-online-judge-fe.pages.dev`)
  - 리뷰어는 클론 없이 링크로 화면 확인 가능
- 설정: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) - 레포 시크릿 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 필요
- **Pages 빌드는 mock 모드**(`VITE_API_MOCK=true`, MSW) - 백엔드 미배포 상태이기 때문
  - 로그인·홈·분반 화면 클릭 가능 - 단, 데이터는 가짜(시드와 동일)
  - 백엔드 배포 후: 워크플로에서 mock 해제 + `VITE_API_BASE_URL` 설정

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
  api/          서버 통신 - client.ts(fetch 래퍼·ApiError), types.ts(BE DTO 미러), auth.ts·cohorts.ts(요청 함수 + React Query 훅)
  components/   RequireAuth(로그인 울타리) · ApiErrorView(403→홈, 404 안내, 재시도) · layout/AppShell(상단 바) · cohorts/(분반 카드·섹션·운영진 팝업) · ui/(shadcn)
  pages/        LoginPage · HomePage · CohortPage · NotFoundPage
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
