# haedal-online-judge-frontend

HOJ(Haedal Online Judge) 프론트엔드 — 학생·운영진 웹 화면.

> 📚 **기획·설계 문서는 [haedal-online-judge-docs](https://github.com/KNU-HAEDAL-Website-v3/haedal-online-judge-docs)에 모여 있습니다. 화면 기준본은 와이어프레임 v2.1.**

## 실행법

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 타입 체크 + 프로덕션 빌드
npm run lint     # 린트 (oxlint)
```

## 배포 (Cloudflare Pages)

- **프로덕션**: https://haedal-online-judge-fe.pages.dev — `main`에 머지되면 자동 갱신
- **PR 미리보기**: PR을 올리면 GitHub Actions가 빌드·배포하고 PR에 미리보기 URL을 코멘트로 남김 (`https://<브랜치명>.haedal-online-judge-fe.pages.dev`). 리뷰어는 클론 없이 링크로 화면 확인.
- 설정: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). 레포 시크릿 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 필요.
- 지금은 백엔드 미연동 상태(스텁 로그인·UI만). 백엔드 배포 후 `VITE_API_BASE_URL` 환경변수 추가 예정.

## 기술 스택

- **프레임워크**: React 19 + TypeScript (Vite 8, SPA)
- **라우팅**: React Router 8 (선언형 `<BrowserRouter>`)
- **서버 상태**: TanStack Query 5
- **스타일**: Tailwind CSS 4 + shadcn/ui (Radix)
- **패키지 매니저**: npm / **린터**: oxlint
- **경로 별칭**: `@/*` → `src/*`

## 규칙

- `main` 직접 push 금지 — 모든 변경은 PR로 (승인 1명 필수, 팀원 합류 후 적용)
- 화면·용어는 docs 레포의 화면 정의 문서 기준 (내부 모델 "Cohort" → UI에서는 "분반")
- API 계약은 백엔드 springdoc(OpenAPI) 문서가 기준
