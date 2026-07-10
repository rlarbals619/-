import { randomUUID } from 'crypto'
import type { Company } from '../../shared/types'
import type { GeminiService, OutputTool } from './gemini'
import type { CompanySearchService, StageContext } from './types'

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
- 수집을 마치면 반드시 record_companies 도구를 호출해 결과를 전달합니다.`

const OUTPUT_TOOL: OutputTool = {
  name: 'record_companies',
  description: '발굴한 한국 법인기업 목록을 구조화해 기록한다.',
  input_schema: {
    type: 'object',
    properties: {
      companies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '정식 기업명(법인명)' },
            bizNumber: {
              type: ['string', 'null'],
              description: '사업자등록번호(검증 가능하면 XXX-XX-XXXXX, 모르면 null)'
            },
            homepage: { type: ['string', 'null'], description: '공식 홈페이지 URL(모르면 null)' },
            summary: { type: ['string', 'null'], description: '사업 특징·핵심 가치 한두 문장' }
          },
          required: ['name']
        }
      }
    },
    required: ['companies']
  }
}

export class GeminiCompanySearch implements CompanySearchService {
  constructor(private readonly ai: GeminiService) {}

  async search(industry: string, maxCompanies: number, ctx: StageContext): Promise<Company[]> {
    ctx.report({ message: `"${industry}" 산업군 기업을 검색하는 중…` })

    const user = `산업군: "${industry}"

이 산업군에 해당하는 한국 법인기업을 최대 ${maxCompanies}곳 찾아 record_companies 도구로 기록하세요.
존재하지 않는 기업이나 추측성 사업자등록번호를 만들지 마세요.`

    const result = await this.ai.searchStructured<{ companies?: RawCompany[] }>(
      SYSTEM,
      user,
      OUTPUT_TOOL,
      6000,
      { signal: ctx.signal }
    )
    const list = Array.isArray(result?.companies) ? result.companies : []

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

    ctx.report({ message: `${companies.length}개 기업 발굴` })
    return companies
  }
}
