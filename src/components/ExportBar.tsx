'use client'

import { useState } from 'react'
import type { Company, ExportFormat } from '@shared/types'
import { runExport } from '@/platform'

interface Props {
  companies: Company[]
  emailTemplate?: string
  proposalsSection?: string
}

// 결과 내보내기 — xlsx / csv + 메일 전문 포함 옵션.
export function ExportBar({ companies, emailTemplate, proposalsSection }: Props): JSX.Element {
  const [includeEmails, setIncludeEmails] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const exportAs = async (format: ExportFormat): Promise<void> => {
    if (!companies.length || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const filename = await runExport({
        companies,
        format,
        includeEmails,
        emailTemplate,
        proposalsSection
      })
      setMsg(`다운로드: ${filename}`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">내보내기</span>
      <button
        onClick={() => exportAs('xlsx')}
        disabled={busy || !companies.length}
        className="rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark transition hover:bg-brand-light focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40 dark:text-brand dark:hover:bg-brand/15"
      >
        엑셀 (.xlsx)
      </button>
      <button
        onClick={() => exportAs('csv')}
        disabled={busy || !companies.length}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        CSV
      </button>
      <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={includeEmails}
          onChange={(e) => setIncludeEmails(e.target.checked)}
          className="accent-brand"
        />
        메일 전문 컬럼 포함
      </label>
      <span className="text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
        {msg}
      </span>
    </div>
  )
}
