import { randomUUID } from 'crypto'
import type { Company } from '../../shared/types'
import type { AnthropicService } from './anthropic'
import type { CompanySearchService, ProgressReporter } from './types'

interface RawCompany {
  name?: string
  bizNumber?: string | null
  homepage?: string | null
  summary?: string | null
}

const SYSTEM = `당신은 한국 기업 리서치 전문가입니다. 웹 검색으로 특정 산업군의 실제 법인기업을 찾아
정확한 정보를 수집합니다. 다음 원칙을 지키세요.
- 실재하는 한국 법인기업만 포함합니다(개인사업자·폐업기업 제외).
- 사업자등록번호는 검증 가능한 경우에만 기입하고, 확실치 않으면 null로 둡니다(추측 금지).
- 공식 홈페이지·공공 자료를 우선합니다. 유료 DB의 무단 전재는 하지 않습니다.
- 반드시 JSON 배열만 출력합니다(설명 문장 금지).`

export class AnthropicCompanySearch implements CompanySearchService {
  constructor(private readonly ai: AnthropicService) {}

  async search(
    industry: string,
    maxCompanies: number,
    report: ProgressReporter
  ): Promise<Company[]> {
    report(`"${industry}" 산업군 기업을 검색하는 중…`)

    const user = `산업군: "${industry}"

이 산업군에 해당하는 한국 법인기업을 최대 ${maxCompanies}곳 찾아 주세요.
각 기업마다 아래 필드를 가진 JSON 객체로, 전체를 JSON 배열로 출력하세요.

[
  {
    "name": "정식 기업명(법인명)",
    "bizNumber": "사업자등록번호(검증 가능하면 XXX-XX-XXXXX, 모르면 null)",
    "homepage": "공식 홈페이지 URL(모르면 null)",
    "summary": "사업 특징·핵심 가치 한두 문장 요약"
  }
]

주의: 존재하지 않는 기업이나 추측성 사업자등록번호를 만들지 마세요.`

    const raw = await this.ai.searchJson<RawCompany[]>(SYSTEM, user, 6000)
    const list = Array.isArray(raw) ? raw : []

    const companies: Company[] = list
      .filter((r) => r && typeof r.name === 'string' && r.name.trim())
      .slice(0, maxCompanies)
      .map((r) => ({
        id: randomUUID(),
        name: r.name!.trim(),
        bizNumber: r.bizNumber?.trim() || null,
        homepage: r.homepage?.trim() || null,
        address: null,
        phone: null,
        email: null,
        summary: r.summary?.trim() || null,
        proposal: null
      }))

    report(`${companies.length}개 기업 발굴`)
    return companies
  }
}
