import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { clearApiKey, getSettings, hasApiKey, saveSettings, setApiKey } from '../platform'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (권장 · 빠름)' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (고품질)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (경제적)' }
]

// API 키 입력·데이터 소스(모델·발굴 수) 설정 화면.
export function SettingsModal({ open, onClose, onSaved }: Props): JSX.Element | null {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [keyInput, setKeyInput] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKeyInput('')
    void getSettings().then(setSettings)
    void hasApiKey().then(setKeySaved)
  }, [open])

  if (!open) return null

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      if (keyInput.trim()) await setApiKey(keyInput.trim())
      await saveSettings(settings)
      onSaved()
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const removeKey = async (): Promise<void> => {
    await clearApiKey()
    setKeySaved(false)
    setKeyInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">설정</h2>

        <label className="mb-1 block text-sm font-medium text-slate-600">Anthropic API 키</label>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={keySaved ? '저장됨 (변경하려면 새 키 입력)' : 'sk-ant-...'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="mb-4 mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">키는 OS 보안 저장소(safeStorage)에 암호화되어 저장됩니다.</span>
          {keySaved && (
            <button onClick={removeKey} className="text-red-500 hover:underline">
              키 삭제
            </button>
          )}
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-600">모델</label>
        <select
          value={settings.model}
          onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium text-slate-600">
          최대 발굴 기업 수: {settings.maxCompanies}
        </label>
        <input
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
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
