import type { NextRequest } from 'next/server'
import { AnthropicService, type DocumentInput, type OutputTool } from '@/lib/services/anthropic'

// 제안서 첨부(PDF·이미지)를 읽어 메일의 "제안서 소개" 블록을 자동 생성한다.
// 입력: multipart FormData (files[], 선택 model)
// 출력: JSON { proposalsSection, items:[{title,summary}] }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SUPPORTED: Record<string, DocumentInput['mediaType']> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

const SYSTEM = `당신은 초록우산어린이재단의 제안 담당자를 돕는 문서 요약 전문가입니다.
첨부된 제안서 문서를 읽고, 각 문서(제안서)의 제목과 한 줄 소개를 뽑아 record_proposals
도구로 반환합니다. 담백하고 사실 위주로 작성하고 과장하지 않습니다.`

const OUTPUT_TOOL: OutputTool = {
  name: 'record_proposals',
  description: '첨부 제안서 각각의 제목과 한 줄 소개를 기록한다.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '제안서 제목' },
            summary: { type: 'string', description: '핵심 내용 한 줄 소개' }
          },
          required: ['title', 'summary']
        }
      }
    },
    required: ['items']
  }
}

interface ProposalItem {
  title: string
  summary: string
}

function mediaTypeOf(file: File): DocumentInput['mediaType'] | null {
  const byType = Object.values(SUPPORTED).find((m) => m === file.type)
  if (byType) return byType
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED[ext] ?? null
}

export async function POST(req: NextRequest): Promise<Response> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: '제안서 파일을 첨부해 주세요.' }, { status: 400 })
  }
  const model = String(form.get('model') ?? '').trim() || undefined
  const files = form.getAll('files').filter((f): f is File => typeof f === 'object' && 'arrayBuffer' in f)

  if (files.length === 0) {
    return Response.json({ error: '제안서 파일을 첨부해 주세요.' }, { status: 400 })
  }

  const documents: DocumentInput[] = []
  for (const file of files) {
    const mediaType = mediaTypeOf(file)
    if (!mediaType) {
      return Response.json(
        { error: `지원하지 않는 형식입니다: ${file.name} (PDF·PNG·JPG·GIF·WEBP만 가능)` },
        { status: 400 }
      )
    }
    documents.push({ base64: Buffer.from(await file.arrayBuffer()).toString('base64'), mediaType })
  }

  try {
    const ai = new AnthropicService({ model })
    const instruction = `첨부된 ${documents.length}개의 제안서 문서를 각각 요약해 record_proposals 도구로 반환하세요.`
    const result = await ai.extractFromDocuments<{ items?: ProposalItem[] }>(
      SYSTEM,
      instruction,
      documents,
      OUTPUT_TOOL,
      2048
    )
    const items = Array.isArray(result?.items) ? result.items : []
    const proposalsSection = items
      .filter((it) => it && it.title)
      .map((it, i) => `■ ${i + 1}. ${it.title.trim()}\n${(it.summary ?? '').trim()}`)
      .join('\n\n')

    return Response.json({ proposalsSection, items })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
