import type { Company } from '../../shared/types'
import { mapWithConcurrency, throwIfAborted } from '../concurrency'
import type { AnthropicService, OutputTool } from './anthropic'
import { addIssue, classifyFailure, isAbort } from './failures'
import type { InfoCollectorService, StageContext } from './types'

// 기업별 정보 보강. web_search로 한 곳씩 조회하되 동시성 제한으로 병렬 처리한다.
// - resolveBizNumbers: 사업자등록번호만 (엄격 법인 필터 직전, 번호 없는 기업 대상)
// - collectContacts: 홈페이지·주소·전화·이메일 (dedupe 이후, 최종 후보 대상)

const CONCURRENCY = 4

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
확인을 마치면 record_biz_number 도구를 호출해 결과를 전달합니다.`

const CONTACT_SYSTEM = `당신은 한국 기업 정보 수집 전문가입니다. 웹 검색으로 특정 기업의 공식 연락 정보를
수집합니다. 공식 홈페이지·공개 자료 기준으로 확인된 값만 기입하고, 없으면 null을 둡니다.
추측 금지. 수집을 마치면 record_contact 도구를 호출해 결과를 전달합니다.`

const BIZ_TOOL: OutputTool = {
  name: 'record_biz_number',
  description: '확인된 사업자등록번호를 기록한다(없으면 null).',
  input_schema: {
    type: 'object',
    properties: {
      bizNumber: { type: ['string', 'null'], description: 'XXX-XX-XXXXX 또는 확인 불가 시 null' }
    },
    required: ['bizNumber']
  }
}

const CONTACT_TOOL: OutputTool = {
  name: 'record_contact',
  description: '기업의 공식 연락 정보를 기록한다(항목별로 확인 불가 시 null).',
  input_schema: {
    type: 'object',
    properties: {
      homepage: { type: ['string', 'null'] },
      address: { type: ['string', 'null'] },
      phone: { type: ['string', 'null'] },
      email: { type: ['string', 'null'] }
    },
    required: ['homepage', 'address', 'phone', 'email']
  }
}

export class AnthropicInfoCollector implements InfoCollectorService {
  constructor(private readonly ai: AnthropicService) {}

  async resolveBizNumbers(companies: Company[], ctx: StageContext): Promise<Company[]> {
    const targets = companies.filter((c) => !c.bizNumber)
    if (targets.length === 0) return companies

    const resolved = new Map<string, string>()
    let done = 0
    let failed = 0
    await mapWithConcurrency(
      targets,
      CONCURRENCY,
      async (company) => {
        try {
          const user = `기업명: "${company.name}"${company.homepage ? `\n홈페이지: ${company.homepage}` : ''}

이 한국 법인의 사업자등록번호를 찾아 record_biz_number 도구로 기록하세요.`
          const r = await this.ai.searchStructured<BizNumberResult>(BIZ_SYSTEM, user, BIZ_TOOL, 1500, {
            signal: ctx.signal
          })
          const value = r.bizNumber ? String(r.bizNumber).trim() : ''
          if (value && value.toLowerCase() !== 'null') resolved.set(company.id, value)
          else failed += 1 // 번호 확인 불가 → 이후 corpFilter에서 제거됨
        } catch (err) {
          if (isAbort(err)) throw err
          throwIfAborted(ctx.signal)
          failed += 1
          console.error(`번호 확인 실패(${company.name}):`, err)
        }
      },
      {
        signal: ctx.signal,
        onSettled: () =>
          ctx.report({
            message: `사업자등록번호 확인 ${++done}/${targets.length}`,
            fraction: done / targets.length,
            done,
            total: targets.length,
            failed
          })
      }
    )

    return companies.map((c) => (resolved.has(c.id) ? { ...c, bizNumber: resolved.get(c.id)! } : c))
  }

  async collectContacts(companies: Company[], ctx: StageContext): Promise<Company[]> {
    if (companies.length === 0) return companies
    let done = 0
    let failed = 0
    return mapWithConcurrency(
      companies,
      CONCURRENCY,
      async (company): Promise<Company> => {
        let result: Company
        try {
          const user = `기업명: "${company.name}"${company.homepage ? `\n알려진 홈페이지: ${company.homepage}` : ''}

이 기업의 공식 정보를 웹에서 찾아 record_contact 도구로 기록하세요. 확인되지 않은 항목은 null.`
          const r = await this.ai.searchStructured<ContactResult>(
            CONTACT_SYSTEM,
            user,
            CONTACT_TOOL,
            2000,
            { signal: ctx.signal }
          )
          result = {
            ...company,
            homepage: clean(r.homepage) ?? company.homepage,
            address: clean(r.address),
            phone: clean(r.phone),
            email: clean(r.email)
          }
        } catch (err) {
          if (isAbort(err)) throw err
          throwIfAborted(ctx.signal)
          failed += 1
          console.error(`정보 수집 실패(${company.name}):`, err)
          // 호출 자체 실패 → 부분 실패로 기록(연락처가 단순히 없는 것과 구분).
          result = addIssue(company, 'collect', classifyFailure(err))
        }
        ctx.onCompany?.(result)
        return result
      },
      {
        signal: ctx.signal,
        onSettled: () =>
          ctx.report({
            message: `정보 수집 ${++done}/${companies.length}`,
            fraction: done / companies.length,
            done,
            total: companies.length,
            failed
          })
      }
    )
  }
}

/** "null"/빈 문자열을 실제 null로 정규화. */
function clean(v: string | null | undefined): string | null {
  if (!v) return null
  const t = String(v).trim()
  if (!t || t.toLowerCase() === 'null' || t === '정보 없음') return null
  return t
}
