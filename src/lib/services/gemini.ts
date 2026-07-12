import { GoogleGenAI, createUserContent, createPartFromBase64, type Part } from '@google/genai'

// Google Gemini 클라이언트 래퍼. 서버 환경변수의 API 키와 지정 모델을 사용하고,
// Google 검색(그라운딩)으로 구조화(JSON) 결과를 뽑아내는 헬퍼를 제공한다.
//
// 무료 티어 안정성:
// - gemini-2.5-flash류는 기본적으로 "thinking"이 켜져 출력 토큰 예산을 잠식할 수 있어
//   thinkingBudget=0으로 끈다(응답이 비지 않게 + 빠르고 저렴하게).
// - Google 검색 도구와 responseSchema(구조화 강제)는 동시에 못 쓰므로, 검색 단계는
//   프롬프트로 JSON을 요청하고 텍스트에서 파싱한다(extractJson).
// - 무료 티어는 분당/일일 요청 한도(RPM/RPD)가 낮다 → 429/503은 지수 백오프로 재시도한다.

const DEFAULT_MODEL = 'gemini-2.0-flash'

const MAX_RETRIES = 5

/** 구조화 출력용 스키마 정의(프롬프트에 삽입되는 JSON Schema). */
export interface OutputTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export interface CallOpts {
  signal?: AbortSignal
}

/** 문서 입력(base64). PDF만 지원. */
export interface DocumentInput {
  base64: string
  mediaType: 'application/pdf'
}

export class GeminiService {
  private readonly apiKey: string
  private readonly modelId: string

  /** 서버 라우트에서 env 키 + 요청 모델로 생성한다. */
  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
    this.modelId = opts.model || process.env.GEMINI_MODEL || DEFAULT_MODEL
  }

  private client(): GoogleGenAI {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY가 설정되지 않았습니다. 서버의 환경변수(.env.local 또는 배포 플랫폼)에 키를 추가해 주세요.'
      )
    }
    return new GoogleGenAI({ apiKey: this.apiKey })
  }

  /** 모델이 JSON을 순수하게 내도록 스키마 안내를 프롬프트에 덧붙인다. */
  private static jsonInstruction(schema: Record<string, unknown>): string {
    return `\n\n반드시 아래 JSON 스키마를 따르는 JSON 객체 "하나만" 출력하세요. 설명·마크다운·코드펜스 없이 순수 JSON만:\n${JSON.stringify(schema)}`
  }

  /**
   * Google 검색 그라운딩 + 구조화(JSON) 프롬프트로 실행하고, 응답 JSON을 T로 반환한다.
   */
  async searchStructured<T>(
    system: string,
    user: string,
    outputTool: OutputTool,
    maxTokens = 4096,
    opts: CallOpts = {}
  ): Promise<T> {
    const text = await this.call(
      user + GeminiService.jsonInstruction(outputTool.input_schema),
      {
        systemInstruction: system,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 }
      },
      opts.signal
    )
    return extractJson<T>(text)
  }

  /**
   * Google 검색 그라운딩을 붙여 실행하고, 응답 텍스트에서 JSON을 파싱한다(폴백 경로).
   */
  async searchJson<T>(system: string, user: string, maxTokens = 4096, opts: CallOpts = {}): Promise<T> {
    const text = await this.call(
      user,
      {
        systemInstruction: system,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 }
      },
      opts.signal
    )
    return extractJson<T>(text)
  }

  /** 검색 없이 순수 텍스트 생성(제안 문단 등). */
  async generateText(
    system: string,
    user: string,
    maxTokens = 1024,
    opts: CallOpts = {}
  ): Promise<string> {
    const text = await this.call(
      user,
      {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 }
      },
      opts.signal
    )
    return text.trim()
  }

  /**
   * 첨부 문서(PDF)를 읽어 구조화 결과를 추출한다. 검색 없이 JSON 응답(responseMimeType)을
   * 강제해 항상 구조화 결과를 받는다.
   */
  async extractFromDocuments<T>(
    system: string,
    instruction: string,
    documents: DocumentInput[],
    outputTool: OutputTool,
    maxTokens = 2048,
    opts: CallOpts = {}
  ): Promise<T> {
    const parts: Part[] = documents.map((d) => createPartFromBase64(d.base64, d.mediaType))
    parts.push({ text: instruction + GeminiService.jsonInstruction(outputTool.input_schema) })

    const text = await this.call(
      createUserContent(parts),
      {
        systemInstruction: system,
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 }
      },
      opts.signal
    )
    return extractJson<T>(text)
  }

  /** generateContent 호출 + 429/503 지수 백오프 재시도. 응답 텍스트를 반환한다. */
  private async call(
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
    config: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<string> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.client().models.generateContent({
          model: this.modelId,
          contents,
          config: { ...config, abortSignal: signal }
        })
        return res.text ?? ''
      } catch (err) {
        if (isAbort(err) || signal?.aborted) throw err
        if (!isRateLimited(err) || attempt === MAX_RETRIES) throw err
        lastErr = err
        // 지수 백오프: 대략 3s, 6s, 12s, 24s, 48s (+지터). 무료 티어 RPM 회복 대기.
        const wait = 3000 * 2 ** attempt + Math.floor(Math.random() * 1000)
        await sleep(wait, signal)
      }
    }
    throw lastErr
  }
}

/** 요청 한도 초과(429)/일시 과부하(503) 여부. */
function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  const msg = err instanceof Error ? err.message : String(err)
  return status === 429 || status === 503 || /\b429\b|\b503\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|quota/i.test(msg)
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** 취소 가능한 지연. signal이 abort되면 즉시 AbortError로 reject. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = (): void => {
      cleanup()
      reject(abortError())
    }
    const cleanup = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function abortError(): Error {
  const e = new Error('aborted')
  e.name = 'AbortError'
  return e
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
