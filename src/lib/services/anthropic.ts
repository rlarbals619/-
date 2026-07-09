import Anthropic from '@anthropic-ai/sdk'

// Anthropic 클라이언트 래퍼. 서버 환경변수의 API 키와 지정 모델을 사용하고,
// web_search 서버 도구로 구조화(JSON) 결과를 뽑아내는 헬퍼를 제공한다.

const DEFAULT_MODEL = 'claude-sonnet-5'

/** web_search 서버 도구 정의 (Anthropic 서버에서 실행됨 → 클라이언트 루프 불필요). */
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
  max_uses: 6
}

/** 구조화 출력용 클라이언트 도구 정의. */
export interface OutputTool {
  name: string
  description?: string
  input_schema: Anthropic.Messages.Tool.InputSchema
}

export interface CallOpts {
  signal?: AbortSignal
}

export class AnthropicService {
  private readonly apiKey: string
  private readonly modelId: string

  /** 서버 라우트에서 env 키 + 요청 모델로 생성한다. */
  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
    this.modelId = opts.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
  }

  private client(): Anthropic {
    if (!this.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY가 설정되지 않았습니다. 서버의 .env.local에 키를 추가해 주세요.'
      )
    }
    return new Anthropic({ apiKey: this.apiKey })
  }

  private model(): string {
    return this.modelId
  }

  /** 응답에서 텍스트 블록만 이어 붙인다. */
  private static joinText(content: Anthropic.Messages.ContentBlock[]): string {
    return content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }

  /**
   * web_search + 구조화 출력 도구를 붙여 실행하고, 도구 호출 입력(input)을 T로 반환한다.
   * 모델이 도구를 호출하지 않으면 응답 텍스트에서 JSON을 파싱하는 폴백을 사용(이중 안전).
   */
  async searchStructured<T>(
    system: string,
    user: string,
    outputTool: OutputTool,
    maxTokens = 4096,
    opts: CallOpts = {}
  ): Promise<T> {
    const tools: Anthropic.Messages.ToolUnion[] = [
      WEB_SEARCH_TOOL,
      {
        name: outputTool.name,
        description: outputTool.description,
        input_schema: outputTool.input_schema
      }
    ]
    const message = await this.client().messages.create(
      {
        model: this.model(),
        max_tokens: maxTokens,
        system,
        tools,
        messages: [{ role: 'user', content: user }]
      },
      { signal: opts.signal }
    )
    const toolUse = message.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === 'tool_use' && b.name === outputTool.name
    )
    if (toolUse) return toolUse.input as T
    // 폴백: 텍스트에서 JSON 추출.
    return extractJson<T>(AnthropicService.joinText(message.content))
  }

  /**
   * web_search를 붙여 프롬프트를 실행하고, 응답 텍스트에서 JSON을 파싱한다(폴백 경로).
   */
  async searchJson<T>(system: string, user: string, maxTokens = 4096, opts: CallOpts = {}): Promise<T> {
    const message = await this.client().messages.create(
      {
        model: this.model(),
        max_tokens: maxTokens,
        system,
        tools: [WEB_SEARCH_TOOL],
        messages: [{ role: 'user', content: user }]
      },
      { signal: opts.signal }
    )
    return extractJson<T>(AnthropicService.joinText(message.content))
  }

  /** web_search 없이 순수 텍스트 생성(제안 문단 등). */
  async generateText(
    system: string,
    user: string,
    maxTokens = 1024,
    opts: CallOpts = {}
  ): Promise<string> {
    const message = await this.client().messages.create(
      {
        model: this.model(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }]
      },
      { signal: opts.signal }
    )
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
