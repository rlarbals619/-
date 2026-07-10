'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import {
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_PROPOSALS_SECTION,
  EMAIL_PLACEHOLDERS
} from '@shared/emailTemplate'
import { loadSettings, saveSettings, summarizeProposals } from '@/platform'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (settings: AppSettings) => void
}

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (권장 · 무료 티어)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (가장 빠름·가벼움)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (안정적)' }
]

// 설정 화면: 모델·발굴 수 + 메일 전문 틀 편집 + 제안서 소개(파일 업로드 자동 생성).
export function SettingsModal({ open, onClose, onSaved }: Props): JSX.Element | null {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const proposalFileRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const modelId = useId()
  const rangeId = useId()
  const templateId = useId()
  const proposalsId = useId()
  const firstRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (open) {
      setSettings(loadSettings())
      setUploadMsg(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const save = (): void => {
    saveSettings(settings)
    onSaved(settings)
    onClose()
  }

  const handleProposalFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const result = await summarizeProposals(Array.from(files), settings.model)
      if (result.proposalsSection.trim()) {
        setSettings((s) => ({ ...s, proposalsSection: result.proposalsSection }))
        setUploadMsg(`${result.items.length}개 제안서를 반영했습니다.`)
      } else {
        setUploadMsg('문서에서 제안서 정보를 찾지 못했습니다.')
      }
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      if (proposalFileRef.current) proposalFileRef.current.value = ''
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            설정
          </h2>
          <button
            onClick={onClose}
            aria-label="설정 닫기"
            className="rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Google Gemini API 키는 서버 환경변수(<code>.env.local</code>의{' '}
            <code>GEMINI_API_KEY</code>)로 관리됩니다. 브라우저에는 저장되지 않습니다.
          </div>

          <label htmlFor={modelId} className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            모델
          </label>
          <select
            id={modelId}
            ref={firstRef}
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            className={`mb-4 ${inputCls}`}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <label htmlFor={rangeId} className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            최대 발굴 기업 수: {settings.maxCompanies}
          </label>
          <input
            id={rangeId}
            type="range"
            min={5}
            max={40}
            step={1}
            value={settings.maxCompanies}
            onChange={(e) => setSettings((s) => ({ ...s, maxCompanies: Number(e.target.value) }))}
            className="mb-6 w-full accent-brand"
          />

          {/* 메일 전문 틀 */}
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={templateId} className="text-sm font-medium text-slate-600 dark:text-slate-300">
              메일 전문 틀
            </label>
            <button
              onClick={() => setSettings((s) => ({ ...s, emailTemplate: DEFAULT_EMAIL_TEMPLATE }))}
              className="text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              기본값으로 초기화
            </button>
          </div>
          <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">
            치환 항목: {EMAIL_PLACEHOLDERS.map((p) => <code key={p} className="mx-0.5">{p}</code>)}
          </p>
          <textarea
            id={templateId}
            value={settings.emailTemplate}
            onChange={(e) => setSettings((s) => ({ ...s, emailTemplate: e.target.value }))}
            rows={10}
            className={`mb-6 resize-y font-mono text-xs leading-relaxed ${inputCls}`}
          />

          {/* 제안서 소개 */}
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={proposalsId} className="text-sm font-medium text-slate-600 dark:text-slate-300">
              제안서 소개 (메일의 {'{{제안서목록}}'} 자리)
            </label>
            <button
              onClick={() => setSettings((s) => ({ ...s, proposalsSection: DEFAULT_PROPOSALS_SECTION }))}
              className="text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              기본값으로 초기화
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
            제안서 파일(PDF)을 올리면 내용을 읽어 자동 작성합니다. 직접 수정도 가능합니다.
          </p>
          <input
            ref={proposalFileRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            aria-label="제안서 파일 (PDF)"
            onChange={(e) => void handleProposalFiles(e.target.files)}
          />
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              onClick={() => proposalFileRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:text-brand"
            >
              {uploading ? '분석 중…' : '제안서 파일로 자동 생성'}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
              {uploadMsg}
            </span>
          </div>
          <textarea
            id={proposalsId}
            value={settings.proposalsSection}
            onChange={(e) => setSettings((s) => ({ ...s, proposalsSection: e.target.value }))}
            rows={7}
            className={`resize-y text-xs leading-relaxed ${inputCls}`}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
