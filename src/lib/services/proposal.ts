import type { Company } from '../../shared/types'
import { closingSentence, hasValidClosing, warmFallbackParagraph } from '../../shared/emailTemplate'
import { mapWithConcurrency, throwIfAborted } from '../concurrency'
import type { AnthropicService } from './anthropic'
import type { ProgressReporter, ProposalService } from './types'

// 최종 후보 기업별 맞춤 제안 문단 생성(가장 무거운 단계 → 파이프라인 마지막 직전).

const CONCURRENCY = 4

const SYSTEM = `당신은 초록우산어린이재단 사회공헌협력본부의 제안 담당자입니다.
기업에 보낼 후원 제안 메일에 들어갈 "맞춤 문단"을 작성합니다. 규칙:
- 기업의 사업 특징·가치 중 초록우산어린이재단(아동복지)과의 공통점을 찾아 공감대를 형성하는 2~3문장.
- 반드시 지정된 마무리 문장으로 끝맺습니다.
- AI 티 나는 표현("실질적인" 등)과 억지 연결을 피하고, 담백하고 진심 어린 어조를 유지합니다.
- 정보가 부족한 기업은 무난하고 따뜻한 톤으로 작성합니다.
- 다른 설명 없이 문단 본문만 출력합니다.`

export class AnthropicProposalService implements ProposalService {
  constructor(private readonly ai: AnthropicService) {}

  async generate(
    companies: Company[],
    report: ProgressReporter,
    signal?: AbortSignal
  ): Promise<Company[]> {
    if (companies.length === 0) return companies
    let done = 0
    return mapWithConcurrency(
      companies,
      CONCURRENCY,
      async (company) => ({ ...company, proposal: await this.one(company, signal) }),
      {
        signal,
        onSettled: () =>
          report(`제안 문장 생성 ${++done}/${companies.length}`, done / companies.length)
      }
    )
  }

  private async one(company: Company, signal?: AbortSignal): Promise<string> {
    const closing = closingSentence(company.name)
    const context = [
      `기업명: ${company.name}`,
      company.summary ? `사업 특징: ${company.summary}` : null,
      company.homepage ? `홈페이지: ${company.homepage}` : null,
      company.address ? `주소: ${company.address}` : null
    ]
      .filter(Boolean)
      .join('\n')

    const user = `${context}

위 기업에 보낼 맞춤 문단을 작성하세요.
- 2~3문장으로 초록우산어린이재단과의 공감대를 형성합니다.
- 마지막 문장은 반드시 아래와 정확히 동일해야 합니다.
"${closing}"`

    try {
      const text = await this.ai.generateText(SYSTEM, user, 600, { signal })
      const cleaned = text.trim()
      if (!cleaned) return warmFallbackParagraph(company.name)
      // 마무리 문장이 규정과 다르면 보정.
      if (!hasValidClosing(cleaned, company.name)) {
        const withoutTrailing = cleaned.replace(/[.\s]*$/, '')
        return `${withoutTrailing} ${closing}`.replace(/\s+/g, ' ').trim()
      }
      return cleaned
    } catch (err) {
      throwIfAborted(signal)
      console.error(`제안 문장 생성 실패(${company.name}):`, err)
      return warmFallbackParagraph(company.name)
    }
  }
}
