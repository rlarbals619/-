import { Readable } from 'stream'
import ExcelJS from 'exceljs'
import type { Company } from '../../shared/types'
import { normalizeBizNumber } from '../../shared/bizNumber'
import type { DedupeInput, DedupeService } from './types'

// 업로드된 기존 후원처 파일(xlsx/csv) 버퍼에서 사업자등록번호·기업명을 긁어와,
// 이미 목록에 있는 기업을 추천에서 제거한다.
// 매칭 기준: 사업자등록번호 우선, 없으면 기업명(정규화 비교).

export class FileDedupeService implements DedupeService {
  async filter(
    companies: Company[],
    input: DedupeInput
  ): Promise<{ kept: Company[]; removed: number }> {
    const { bizNumbers, names } = await this.readExisting(input)

    const kept = companies.filter((c) => {
      const n = normalizeBizNumber(c.bizNumber)
      if (n && bizNumbers.has(n)) return false
      if (names.has(normalizeName(c.name))) return false
      return true
    })

    return { kept, removed: companies.length - kept.length }
  }

  private async readExisting(
    input: DedupeInput
  ): Promise<{ bizNumbers: Set<string>; names: Set<string> }> {
    const workbook = new ExcelJS.Workbook()
    if (input.filename.toLowerCase().endsWith('.csv')) {
      await workbook.csv.read(Readable.from(input.buffer))
    } else {
      // exceljs xlsx.load는 Buffer를 받는다. (@types/node의 Buffer 제네릭 차이로 캐스팅)
      await workbook.xlsx.load(input.buffer as unknown as ArrayBuffer)
    }

    const bizNumbers = new Set<string>()
    const names = new Set<string>()

    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const text = cellText(cell.value)
          if (!text) return
          const n = normalizeBizNumber(text)
          if (n) {
            bizNumbers.add(n)
          } else {
            const norm = normalizeName(text)
            if (norm.length >= 2) names.add(norm)
          }
        })
      })
    })

    return { bizNumbers, names }
  }
}

/** exceljs 셀 값을 문자열로 안전 변환. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    // 하이퍼링크·리치텍스트·수식 결과 등
    const anyVal = value as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (typeof anyVal.text === 'string') return anyVal.text
    if (Array.isArray(anyVal.richText)) return anyVal.richText.map((r) => r.text).join('')
    if (anyVal.result != null) return String(anyVal.result)
    return ''
  }
  return String(value)
}

/** 기업명 정규화: 법인 접미사·괄호·공백 제거 + 소문자화. */
function normalizeName(raw: string): string {
  return raw
    .replace(/주식회사|유한회사|㈜|\(주\)|\(유\)/g, '')
    .replace(/[(){}[\]]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim()
}
