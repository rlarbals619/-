import Anthropic from '@anthropic-ai/sdk'
import type { SettingsStore } from './types'

// Anthropic 클라이언트 래퍼. 저장된 키·모델을 사용하고,
// web_search 서버 도구로 구조화(JSON) 결과를 뽑아내는 헬퍼를 제공한다.

/** web_search 서버 도구 정의 (Anthropic 서버에서 실행됨 → 클라이언트 루프 불필요). */
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
  max_uses: 6
}

export class AnthropicService {
  constructor(private readonly settings: SettingsStore) {}

  private client(): Anthropic {
    const apiKey = this.settings.getApiKey()
    if (!apiKey) {
      throw new Error('Anthropic API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력해 주세요.')
    }
    return new Anthropic({ apiKey })
  }

  private model(): string {
    return this.settings.getSettings().model
  }

  /** 응답에서 텍스트 블록만 이어 붙인다. */
  private static joinText(content: Anthropic.Messages.ContentBlock[]): string {
    return content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }

  /**
   * web_search를 붙여 프롬프트를 실행하고, 응답 텍스트에서 JSON을 파싱한다.
   * 모델이 코드펜스(```json)로 감싸거나 앞뒤 설명을 붙여도 견디도록 관대하게 추출.
   */
  async searchJson<T>(system: string, user: string, maxTokens = 4096): Promise<T> {
    const message = await this.client().messages.create({
      model: this.model(),
      max_tokens: maxTokens,
      system,
      tools: [WEB_SEARCH_TOOL],
      messages: [{ role: 'user', content: user }]
    })
    const text = AnthropicService.joinText(message.content)
    return extractJson<T>(text)
  }

  /** web_search 없이 순수 텍스트 생성(제안 문단 등). */
  async generateText(system: string, user: string, maxTokens = 1024): Promise<string> {
    const message = await this.client().messages.create({
      model: this.model(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
    return AnthropicService.joinText(message.content).trim()
  }
}

/** 텍스트에서 첫 번째 JSON 객체/배열을 관대하게 추출·파싱. */
export function extractJson<T>(text: string): T {
  // 1) ```json ... ``` 코드펜스 우선
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : text
  // 2) 첫 { 또는 [ 부터 마지막 } 또는 ] 까지 잘라 파싱 시도
  const start = candidate.search(/[[{]/)
  if (start === -1) {
    throw new Error('모델 응답에서 JSON을 찾지 못했습니다.')
  }
  const lastCurly = candidate.lastIndexOf('}')
  const lastSquare = candidate.lastIndexOf(']')
  const end = Math.max(lastCurly, lastSquare)
  const slice = candidate.slice(start, end + 1)
  try {
    return JSON.parse(slice) as T
  } catch {
    // 마지막 시도: 원문 전체 파싱
    return JSON.parse(candidate.trim()) as T
  }
}
