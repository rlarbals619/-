import type { Company } from '../../shared/types'
import type { AnthropicService } from './anthropic'
import type { InfoCollectorService, ProgressReporter } from './types'

// 기업별 정보 보강. web_search로 한 곳씩 조회한다.
// - resolveBizNumbers: 사업자등록번호만 (엄격 법인 필터 직전, 번호 없는 기업 대상)
// - collectContacts: 홈페이지·주소·전화·이메일 (dedupe 이후, 최종 후보 대상)

interface BizNumberResult {
  bizNumber?: string | null
}

interface ContactResult {
  homepage?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
}

const BIZ_SYSTEM = `당신은 한국 기업 정보 확인 전문가입니다. 웹 검색으로 특정 법인의 사업자등록번호를
찾습니다. 확실히 검증된 번호만 기입하고, 찾지 못하면 반드시 null을 반환합니다. 추측 금지.
JSON 객체 하나만 출력합니다.`

const CONTACT_SYSTEM = `당신은 한국 기업 정보 수집 전문가입니다. 웹 검색으로 특정 기업의 공식 연락 정보를
수집합니다. 공식 홈페이지·공개 자료 기준으로 확인된 값만 기입하고, 없으면 null을 둡니다.
추측 금지. JSON 객체 하나만 출력합니다.`

export class AnthropicInfoCollector implements InfoCollectorService {
  constructor(private readonly ai: AnthropicService) {}

  async resolveBizNumbers(companies: Company[], report: ProgressReporter): Promise<Company[]> {
    const targets = companies.filter((c) => !c.bizNumber)
    if (targets.length === 0) return companies
    const result = [...companies]
    let done = 0
    for (const company of targets) {
      report(`사업자등록번호 확인: ${company.name}`, done / targets.length)
      try {
        const user = `기업명: "${company.name}"${company.homepage ? `\n홈페이지: ${company.homepage}` : ''}

이 한국 법인의 사업자등록번호를 찾아 아래 형식의 JSON 객체 하나로만 출력하세요.
{ "bizNumber": "XXX-XX-XXXXX 또는 확인 불가 시 null" }`
        const r = await this.ai.searchJson<BizNumberResult>(BIZ_SYSTEM, user, 1500)
        if (r.bizNumber && String(r.bizNumber).trim().toLowerCase() !== 'null') {
          const idx = result.findIndex((c) => c.id === company.id)
          if (idx !== -1) result[idx] = { ...result[idx], bizNumber: String(r.bizNumber).trim() }
        }
      } catch (err) {
        console.error(`번호 확인 실패(${company.name}):`, err)
      }
      done += 1
    }
    report('사업자등록번호 확인 완료', 1)
    return result
  }

  async collectContacts(companies: Company[], report: ProgressReporter): Promise<Company[]> {
    const result: Company[] = []
    let done = 0
    for (const company of companies) {
      report(`정보 수집: ${company.name}`, done / Math.max(companies.length, 1))
      try {
        const user = `기업명: "${company.name}"${company.homepage ? `\n알려진 홈페이지: ${company.homepage}` : ''}

이 기업의 공식 정보를 웹에서 찾아 아래 형식의 JSON 객체 하나로만 출력하세요.
확인되지 않은 항목은 null로 두세요.
{
  "homepage": "공식 홈페이지 URL 또는 null",
  "address": "본사 주소 또는 null",
  "phone": "대표 전화번호 또는 null",
  "email": "대표/문의 이메일 또는 null"
}`
        const r = await this.ai.searchJson<ContactResult>(CONTACT_SYSTEM, user, 2000)
        result.push({
          ...company,
          homepage: clean(r.homepage) ?? company.homepage,
          address: clean(r.address),
          phone: clean(r.phone),
          email: clean(r.email)
        })
      } catch (err) {
        console.error(`정보 수집 실패(${company.name}):`, err)
        result.push(company)
      }
      done += 1
    }
    report('정보 수집 완료', 1)
    return result
  }
}

/** "null"/빈 문자열을 실제 null로 정규화. */
function clean(v: string | null | undefined): string | null {
  if (!v) return null
  const t = String(v).trim()
  if (!t || t.toLowerCase() === 'null' || t === '정보 없음') return null
  return t
}
