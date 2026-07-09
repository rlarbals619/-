import ExcelJS from 'exceljs'
import type { Company } from '../../shared/types'
import { formatBizNumber } from '../../shared/bizNumber'
import { buildEmail } from '../../shared/emailTemplate'
import { STATUS_LABEL, companyStatus, issueSummary } from '../../shared/companyStatus'
import type { ExportService } from './types'

// 표를 xlsx/csv로 내보낸다. "정보 없음" 셀은 색상으로 구분(xlsx만).

const MISSING = '정보 없음'
const MISSING_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFCE4E4' } // 연한 빨강
}

interface Column {
  header: string
  width: number
  value: (c: Company) => string | null
}

function columns(includeEmails: boolean): Column[] {
  const base: Column[] = [
    { header: '상태', width: 10, value: (c) => STATUS_LABEL[companyStatus(c)] },
    { header: '실패 사유', width: 22, value: (c) => issueSummary(c) || '' },
    { header: '기업명', width: 24, value: (c) => c.name },
    { header: '사업자등록번호', width: 18, value: (c) => (c.bizNumber ? formatBizNumber(c.bizNumber) : null) },
    { header: '홈페이지', width: 32, value: (c) => c.homepage },
    { header: '본사 주소', width: 40, value: (c) => c.address },
    { header: '전화번호', width: 16, value: (c) => c.phone },
    { header: '이메일', width: 26, value: (c) => c.email },
    { header: '제안 문장', width: 60, value: (c) => c.proposal }
  ]
  if (includeEmails) {
    base.push({
      header: '메일 전문',
      width: 80,
      value: (c) => buildEmail(c.name, c.proposal ?? '')
    })
  }
  return base
}

export class ExcelExportService implements ExportService {
  async export(
    companies: Company[],
    format: 'xlsx' | 'csv',
    includeEmails: boolean
  ): Promise<Buffer> {
    const cols = columns(includeEmails)
    const workbook = new ExcelJS.Workbook()
    workbook.creator = '초록우산 기업 리서치 툴'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('후원 후보')

    sheet.columns = cols.map((c) => ({ header: c.header, width: c.width }))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).alignment = { vertical: 'middle' }

    for (const company of companies) {
      const values = cols.map((c) => c.value(company) ?? MISSING)
      const row = sheet.addRow(values)
      row.alignment = { vertical: 'top', wrapText: true }
      // 누락 셀 색상 표시(xlsx 전용).
      if (format === 'xlsx') {
        cols.forEach((c, idx) => {
          if (c.value(company) == null) {
            row.getCell(idx + 1).fill = MISSING_FILL
          }
        })
      }
    }

    if (format === 'csv') {
      const buf = await workbook.csv.writeBuffer()
      return Buffer.from(buf as ArrayBuffer)
    }
    const buf = await workbook.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }
}
