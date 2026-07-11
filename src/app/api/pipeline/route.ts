import type { NextRequest } from 'next/server'
import type { Company, PipelineConfig, StageProgress } from '@shared/types'
import { sanitizeModel } from '@shared/types'
import { Pipeline } from '@/lib/pipeline'
import { GeminiService } from '@/lib/services/gemini'
import { GeminiCompanySearch } from '@/lib/services/companySearch'
import { GeminiInfoCollector } from '@/lib/services/infoCollector'
import { FileDedupeService } from '@/lib/services/dedupe'
import { GeminiProposalService } from '@/lib/services/proposal'
import type { DedupeInput } from '@/lib/services/types'

// 파이프라인 실행 라우트.
// 입력: multipart FormData (industry, maxCompanies, model, 선택 dedupeFile)
// 출력: NDJSON 스트림 — 진행 이벤트를 한 줄씩 흘려보내고 마지막에 결과 한 줄.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 함수 실행시간 상한. Vercel Fluid Compute(신규 프로젝트 기본값): Hobby 최대 300초,
// Pro/Enterprise 800초 → 이 값(300)이 유효. 단, Fluid를 끈 레거시 Hobby는 60초가
// 상한이라 배포가 거부되므로 그 경우 60으로 낮추고 설정에서 maxCompanies를 줄여야 한다.
// 초과 시 504(FUNCTION_INVOCATION_TIMEOUT). 자세한 안내는 README "배포 (Vercel)" 참고.
export const maxDuration = 300

type StreamLine =
  | { type: 'progress'; progress: StageProgress }
  | { type: 'company'; company: Company }
  | { type: 'result'; companies: Company[]; stages: StageProgress[] }
  | { type: 'error'; message: string }

export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const industry = String(form.get('industry') ?? '').trim()
  // 클라이언트가 보낸 모델이 허용 목록에 없으면(예: 브라우저에 캐시된 옛 모델명) 기본값으로 보정.
  const model = sanitizeModel(String(form.get('model') ?? '').trim() || undefined)
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

  const ai = new GeminiService({ model })
  const pipeline = new Pipeline(
    new GeminiCompanySearch(ai),
    new GeminiInfoCollector(ai),
    new FileDedupeService(),
    new GeminiProposalService(ai)
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
