'use client'

import { useRef, useState } from 'react'

interface Props {
  running: boolean
  onRun: (industry: string, dedupeFile: File | null) => void
}

// 산업군 입력 + (선택) 기존 후원처 파일 업로드 + 실행.
export function SearchBar({ running, onRun }: Props): JSX.Element {
  const [industry, setIndustry] = useState('')
  const [dedupeFile, setDedupeFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const submit = (): void => {
    const value = industry.trim()
    if (!value || running) return
    onRun(value, dedupeFile)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="mb-1 block text-sm font-medium text-slate-600">산업군 키워드</label>
      <div className="flex gap-2">
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="예: 건강기능식품, 아동 도서 출판, 패션 유통"
          disabled={running}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100"
        />
        <button
          onClick={submit}
          disabled={running || !industry.trim()}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {running ? '진행 중…' : '검색 시작'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => setDedupeFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={running}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
        >
          기존 후원처 파일 선택
        </button>
        {dedupeFile ? (
          <span className="flex items-center gap-1 text-slate-600">
            <span className="font-medium text-brand-dark">{dedupeFile.name}</span>
            <button
              onClick={() => {
                setDedupeFile(null)
                if (fileInput.current) fileInput.current.value = ''
              }}
              className="text-slate-400 hover:text-slate-600"
              aria-label="파일 선택 해제"
            >
              ✕
            </button>
          </span>
        ) : (
          <span className="text-slate-400">
            선택 시 중복/기존 후원처를 자동 제외합니다 (선택 사항, xlsx/csv)
          </span>
        )}
      </div>
    </div>
  )
}
