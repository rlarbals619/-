// Platform adapter — the single seam that makes this app web-portable.
//
// Renderer components must NEVER touch `window.api` or any native API
// directly. They call the functions below, which transparently pick the
// Electron implementation (IPC via the preload bridge) or a web fallback.
// To add a web deployment, you only ever change this file (swap the web
// fallbacks below for calls to a backend API — e.g. Next.js route handlers).

import type {
  AppSettings,
  ExportRequest,
  PipelineConfig,
  PipelineResult,
  StageProgress
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

export const isElectron = (): boolean => typeof window !== 'undefined' && !!window.api

/** 아직 웹 백엔드가 없을 때 던지는 명확한 에러. */
function webNotImplemented(feature: string): never {
  throw new Error(`${feature} 기능은 데스크톱(Electron) 앱에서만 사용할 수 있습니다. (웹 백엔드 미구현)`)
}

/** App version. Electron: via IPC. Web: read from Vite env / fallback. */
export const getAppVersion = async (): Promise<string> => {
  if (isElectron()) return window.api!.getVersion()
  return import.meta.env.VITE_APP_VERSION ?? 'web'
}

/* ── 설정 / API 키 ─────────────────────────────────────────── */

export const getSettings = async (): Promise<AppSettings> => {
  if (isElectron()) return window.api!.settings.get()
  return DEFAULT_SETTINGS
}

export const saveSettings = async (next: AppSettings): Promise<void> => {
  if (isElectron()) return window.api!.settings.set(next)
  webNotImplemented('설정 저장')
}

export const hasApiKey = async (): Promise<boolean> => {
  if (isElectron()) return window.api!.settings.hasApiKey()
  return false
}

export const setApiKey = async (key: string): Promise<void> => {
  if (isElectron()) return window.api!.settings.setApiKey(key)
  webNotImplemented('API 키 저장')
}

export const clearApiKey = async (): Promise<void> => {
  if (isElectron()) return window.api!.settings.clearApiKey()
  webNotImplemented('API 키 삭제')
}

/* ── 파이프라인 ────────────────────────────────────────────── */

export const runPipeline = async (config: PipelineConfig): Promise<PipelineResult> => {
  if (isElectron()) return window.api!.pipeline.run(config)
  webNotImplemented('기업 검색·수집')
}

/** 진행 상황 구독. 반환 함수로 해제. 웹에서는 no-op. */
export const onPipelineProgress = (cb: (p: StageProgress) => void): (() => void) => {
  if (isElectron()) return window.api!.pipeline.onProgress(cb)
  return () => {}
}

/* ── 파일 다이얼로그 / 내보내기 ────────────────────────────── */

export const pickDedupeFile = async (): Promise<string | null> => {
  if (isElectron()) return window.api!.dialog.pickDedupeFile()
  webNotImplemented('파일 선택')
}

export const runExport = async (
  req: ExportRequest
): Promise<{ canceled: boolean; filePath?: string }> => {
  if (isElectron()) return window.api!.export.run(req)
  webNotImplemented('내보내기')
}
