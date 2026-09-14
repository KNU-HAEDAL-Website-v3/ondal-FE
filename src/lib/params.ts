/** 경로 변수(:cohortId 등)를 양의 정수로 - 아니면 NaN (React Query enabled=false + 404 안내용) */
export function parseId(value: string | undefined): number {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : NaN
}
