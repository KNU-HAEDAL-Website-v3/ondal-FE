/**
 * CSV 만들기·내려받기 - 출석부 내보내기용 (docs/attendance/fe.md).
 *
 * xlsx 대신 CSV 를 쓰는 이유: 라이브러리 0개·번들 증가 없음·서버 변경 없음이고,
 * BOM 을 붙이면 엑셀이 UTF-8 로 알아보고 한글이 깨지지 않는다.
 * 셀 병합·색칠 같은 서식이 필요해지면 그때 xlsx 로 올린다.
 */

/** 엑셀이 UTF-8 로 인식하게 하는 표식 - 없으면 한글이 깨져 열린다 */
const BOM = '﻿'

/** 한 칸 이스케이프 - 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고 안쪽 따옴표는 두 번 */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** 표(머리글 + 행들) → CSV 문자열. 줄 끝은 CRLF - 엑셀 호환 */
export function toCsv(header: readonly string[], rows: readonly (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

/** 파일명에 쓸 수 없는 글자를 _ 로 - 분반 이름에 / : 등이 들어와도 저장되게 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

/** YYYYMMDD (KST) - 파일명 접미사 */
export function todayStamp(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 9 * 60) * 60_000)
  return `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`
}

/** CSV 문자열을 파일로 내려받기 - blob URL 은 쓰고 나서 바로 해제한다 */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
