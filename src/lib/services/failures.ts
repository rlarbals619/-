import type { Company, CompanyIssue, PipelineStage } from '../../shared/types'

// 부분 실패 분류·기록 유틸.

export function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** 에러를 사람이 읽는 실패 사유로 분류. */
export function classifyFailure(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  if (name === 'AbortError') return '취소됨'
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (/timeout|etimedout|econnreset|enotfound|eai_again|network|fetch failed|socket|econnrefused/.test(msg)) {
    return '타임아웃·네트워크 오류'
  }
  if (/rate limit|429|overloaded|529/.test(msg)) return '요청 한도 초과'
  if (/401|403|invalid.*key|api key|authentication/.test(msg)) return '인증 오류'
  return '처리 실패'
}

/** 기업에 실패 항목을 덧붙인 새 객체 반환. */
export function addIssue(company: Company, stage: PipelineStage, reason: string): Company {
  return { ...company, issues: [...(company.issues ?? []), { stage, reason }] }
}

/** 기업의 이슈 목록(없으면 빈 배열). */
export function issuesOf(company: Company): CompanyIssue[] {
  return company.issues ?? []
}
