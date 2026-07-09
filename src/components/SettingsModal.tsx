'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { loadSettings, saveSettings } from '@/platform'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (settings: AppSettings) => void
}

const MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (권장 · 빠름)' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (고품질)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (경제적)' }
]

// 모델·발굴 수 설정 화면. (API 키는 서버 .env.local이 관리 — 여기서 다루지 않음)
export function SettingsModal({ open, onClose, onSaved }: Props): JSX.Element | null {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const titleId = useId()
  const modelId = useId()
  const rangeId = useId()
  const firstRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (open) setSettings(loadSettings())
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          설정
        </h2>

        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Anthropic API 키는 서버 환경변수(<code>.env.local</code>의{' '}
          <code>ANTHROPIC_API_KEY</code>)로 관리됩니다. 브라우저에는 저장되지 않습니다.
        </div>

        <label
          htmlFor={modelId}
          className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          모델
        </label>
        <select
          id={modelId}
          ref={firstRef}
          value={settings.model}
          onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <label
          htmlFor={rangeId}
          className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
        >
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

        <div className="flex justify-end gap-2">
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
