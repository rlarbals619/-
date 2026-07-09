import type { NextRequest } from 'next/server'
import type { Company, PipelineConfig, StageProgress } from '@shared/types'
import { Pipeline } from '@/lib/pipeline'
import { AnthropicService } from '@/lib/services/anthropic'
import { AnthropicCompanySearch } from '@/lib/services/companySearch'
import { AnthropicInfoCollector } from '@/lib/services/infoCollector'
import { FileDedupeService } from '@/lib/services/dedupe'
import { AnthropicProposalService } from '@/lib/services/proposal'
import type { DedupeInput } from '@/lib/services/types'

// 파이프라인 실행 라우트.
// 입력: multipart FormData (industry, maxCompanies, model, 선택 dedupeFile)
// 출력: NDJSON 스트림 — 진행 이벤트를 한 줄씩 흘려보내고 마지막에 결과 한 줄.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type StreamLine =
  | { type: 'progress'; progress: StageProgress }
  | { type: 'company'; company: Company }
  | { type: 'result'; companies: Company[]; stages: StageProgress[] }
  | { type: 'error'; message: string }

export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const industry = String(form.get('industry') ?? '').trim()
  const model = String(form.get('model') ?? '').trim() || undefined
  const maxRaw = Number(form.get('maxCompanies'))
  const config: PipelineConfig = {
    industry,
    model,
    maxCompanies: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : undefined
  }

  // 중복 필터 파일(선택).
  let dedupeFile: DedupeInput | null = null
  const file = form.get('dedupeFile')
  if (file && typeof file === 'object' && 'arrayBuffer' in file) {
    const f = file as File
    dedupeFile = { buffer: Buffer.from(await f.arrayBuffer()), filename: f.name }
  }

  if (!industry) {
    return Response.json({ error: '산업군 키워드가 비어 있습니다.' }, { status: 400 })
  }

  const ai = new AnthropicService({ model })
  const pipeline = new Pipeline(
    new AnthropicCompanySearch(ai),
    new AnthropicInfoCollector(ai),
    new FileDedupeService(),
    new AnthropicProposalService(ai)
  )

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: StreamLine): void => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + '\n'))
      }
      try {
        const result = await pipeline.run(
          config,
          {
            progress: (progress) => write({ type: 'progress', progress }),
            company: (company) => write({ type: 'company', company })
          },
          dedupeFile,
          req.signal
        )
        write({ type: 'result', companies: result.companies, stages: result.stages })
      } catch (err) {
        // 클라이언트 취소면 에러 라인을 쓰지 않고 조용히 종료.
        const aborted = req.signal.aborted || (err instanceof Error && err.name === 'AbortError')
        if (!aborted) {
          write({ type: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* 이미 취소된 스트림 */
        }
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    }
  })
}
