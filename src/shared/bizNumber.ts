// 사업자등록번호(10자리) 유틸. 순수 함수 — 메인·렌더러 공용.
//
// 형식: XXX-YY-ZZZZZ (총 10자리). 가운데 두 자리(YY)가 사업자 유형을 나타내며,
// 그 첫 자리(전체의 4번째 자리)가 8이면 법인(비영리·영리 법인 등)으로 본다.
// 이 앱은 "4번째 자리 === 8"만 법인으로 간주해 엄격 필터링한다(사용자 확정 규칙).

/** 숫자만 남긴 10자리 문자열을 반환. 10자리가 아니면 null. */
export function normalizeBizNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length === 10 ? digits : null
}

/**
 * 법인 여부. 정규화된 10자리에서 4번째 자리(index 3)가 '8'이어야 한다.
 * 번호가 없거나 형식이 잘못되면 false → 엄격 필터에서 제거 대상.
 */
export function isCorporate(raw: string | null | undefined): boolean {
  const n = normalizeBizNumber(raw)
  return n !== null && n[3] === '8'
}

/** 표시용 하이픈 포맷 XXX-YY-ZZZZZ. 정규화 실패 시 원본 반환. */
export function formatBizNumber(raw: string | null | undefined): string {
  const n = normalizeBizNumber(raw)
  if (!n) return raw ?? ''
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`
}
