// 플랫폼 어댑터 — UI가 서버(API 라우트)에 접근하는 단일 지점.
//
// 컴포넌트는 fetch를 직접 부르지 않고 이 모듈의 함수를 호출한다. 전송 방식(스트리밍,
// 멀티파트, 다운로드)이 바뀌어도 이 파일만 고치면 되도록 경계를 유지한다.

import type { AppSettings, ExportRequest, PipelineResult, StageProgress } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

/** 파이프라인 실행 입력(브라우저 File 포함). */
export interface PipelineInput {
  industry: string
  maxCompanies?: number
  model?: string
  dedupeFile?: File | null
}

type StreamLine =
  | { type: 'progress'; progress: StageProgress }
  | { type: 'result'; companies: PipelineResult['companies']; stages: StageProgress[] }
  | { type: 'error'; message: string }

/**
 * 파이프라인 실행. POST /api/pipeline (multipart) 응답을 NDJSON 스트림으로 읽어
 * 진행 이벤트마다 onProgress를 호출하고, 최종 결과를 반환한다.
 */
export async function runPipeline(
  input: PipelineInput,
  onProgress: (p: StageProgress) => void,
  signal?: AbortSignal
): Promise<PipelineResult> {
  const form = new FormData()
  form.set('industry', input.industry)
  if (input.maxCompanies) form.set('maxCompanies', String(input.maxCompanies))
  if (input.model) form.set('model', input.model)
  if (input.dedupeFile) form.set('dedupeFile', input.dedupeFile)

  const res = await fetch('/api/pipeline', { method: 'POST', body: form, signal })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `요청 실패 (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: PipelineResult | null = null
  let errorMessage: string | null = null

  const handle = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed) return
    const msg = JSON.parse(trimmed) as StreamLine
    if (msg.type === 'progress') onProgress(msg.progress)
    else if (msg.type === 'result') result = { companies: msg.companies, stages: msg.stages }
    else if (msg.type === 'error') errorMessage = msg.message
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      handle(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
    }
  }
  if (buffer.trim()) handle(buffer)

  if (errorMessage) throw new Error(errorMessage)
  if (!result) throw new Error('서버에서 결과를 받지 못했습니다.')
  return result
}

/** 내보내기. POST /api/export 후 반환된 파일을 브라우저 다운로드로 저장한다. */
export async function runExport(req: ExportRequest): Promise<string> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `내보내기 실패 (${res.status})`)
  }
  const blob = await res.blob()
  const filename = parseFilename(res.headers.get('Content-Disposition')) ?? `export.${req.format}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return filename
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match ? match[1] : null
}

/* ── 클라이언트 설정(localStorage) ─────────────────────────── */
// API 키는 서버 env가 관리하므로 여기엔 없다. 모델·발굴 수만 로컬에 보관한다.

const SETTINGS_KEY = 'app:settings'

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}
