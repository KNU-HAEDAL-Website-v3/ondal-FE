# CLAUDE.md — haedal-online-judge-frontend

> 전체 기획·설계 맥락은 [docs 레포](https://github.com/KNU-HAEDAL-Website-v3/haedal-online-judge-docs)에 있다.
> 이 파일은 프론트 작업 시 필요한 최소 맥락 요약본이다.

## 화면 (P1)

- 학생 5: 로그인 → 홈(소속 분반 카드 / 미소속 안내) → 분반 페이지 → 차시 페이지 → 과제 페이지(제출)
- 운영진 3: 분반 관리(생성·수강생 배정) · 과제 관리(CRUD·마감 설정) · 미제출자 대시보드
- 기준본: docs 레포의 와이어프레임 v2.1. 용어: UI는 "분반"(내부 모델명 Cohort), "과제/문제"(내부 Assignment).

## 필수 동작 규칙

1. **작성 내용 유실 금지.** 제출 실패(401 세션만료 · 400 · 422) 시 코드/첨부/입력값을 보존하고 재시도 가능하게 만든다. 세션 만료가 최다 케이스다.
2. **중복 제출 방지.** 제출 버튼은 요청 중 잠금(서버도 방어하지만 프론트가 1차 방어).
3. **권한 밖 URL 직접 접근은 403 → 홈 리다이렉트** 공통 처리.
4. **마감·상태 표시는 서버 판정값 그대로.** 마감 시각은 KST 표시, 제출/미제출/지각 배지는 서버 응답을 그대로 보여준다 — 프론트에서 재계산하지 않는다.

## API

- 계약은 백엔드 springdoc(OpenAPI) 문서가 기준. 화면에서 필요한 필드가 없으면 프론트에서 조합하지 말고 백엔드에 API 변경을 요청한다.
- 백엔드 연동 전에는 스텁 로그인 기준으로 개발한다. 로컬은 실제 BE(`npm run dev`, /api 프록시), 백엔드 없이 볼 때와 Pages 미리보기는 mock(`npm run dev:mock`, MSW). **mock 데이터(`src/mocks/data.ts`)는 BE `LocalDataSeeder`와 같은 계정·분반을 유지**하고, 응답 모양은 `src/api/types.ts`(BE DTO 미러)를 따른다.
- 공통 처리 위치: 401 → `api/client.ts` + `RequireAuth` / 403 → `ApiErrorView`가 홈으로 / 404 → `ApiErrorView` 안내. 페이지는 에러를 `ApiErrorView`에 넘기기만 한다.
