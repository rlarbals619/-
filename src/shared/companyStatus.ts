import type { Company } from './types'

// 기업 처리 상태 파생(순수) — UI 배지·필터와 내보내기에서 공용.

export type CompanyStatus = 'success' | 'issue' | 'canceled'

export function companyStatus(c: Company): CompanyStatus {
  if (c.canceled) return 'canceled'
  if (c.issues && c.issues.length > 0) return 'issue'
  return 'success'
}

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  success: '성공',
  issue: '부분 실패',
  canceled: '취소됨'
}

/** 실패 사유 요약(쉼표 구분). 없으면 빈 문자열. */
export function issueSummary(c: Company): string {
  return (c.issues ?? []).map((i) => i.reason).join(', ')
}
