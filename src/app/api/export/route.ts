import type { NextRequest } from 'next/server'
import type { ExportRequest } from '@shared/types'
import { ExcelExportService } from '@/lib/services/exporter'

// 내보내기 라우트. 입력: JSON(ExportRequest). 출력: xlsx/csv 파일 다운로드.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTENT_TYPE: Record<'xlsx' | 'csv', string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8'
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: ExportRequest
  try {
    body = (await req.json()) as ExportRequest
  } catch {
    return Response.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 })
  }

  const { companies, format, includeEmails } = body
  if (!Array.isArray(companies) || (format !== 'xlsx' && format !== 'csv')) {
    return Response.json({ error: '내보내기 파라미터가 올바르지 않습니다.' }, { status: 400 })
  }

  const buffer = await new ExcelExportService().export(companies, format, !!includeEmails)
  const filename = `chorogusan_prospects.${format}`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': CONTENT_TYPE[format],
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length)
    }
  })
}
