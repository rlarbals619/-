import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  ExportRequest,
  PipelineConfig,
  PipelineResult,
  StageProgress
} from '../shared/types'

// 렌더러가 메인 프로세스에 접근하는 유일한 통로.
// 좁고 목적이 분명한 메서드만 노출한다 — 절대 raw ipcRenderer를 넘기지 않는다.

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.appGetVersion),

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
    set: (next: AppSettings): Promise<void> => ipcRenderer.invoke(IPC.settingsSet, next),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.settingsHasApiKey),
    setApiKey: (key: string): Promise<void> => ipcRenderer.invoke(IPC.settingsSetApiKey, key),
    clearApiKey: (): Promise<void> => ipcRenderer.invoke(IPC.settingsClearApiKey)
  },

  pipeline: {
    run: (config: PipelineConfig): Promise<PipelineResult> =>
      ipcRenderer.invoke(IPC.pipelineRun, config),
    /** 진행 상황 구독. 반환 함수를 호출하면 구독 해제. */
    onProgress: (cb: (progress: StageProgress) => void): (() => void) => {
      const listener = (_e: unknown, progress: StageProgress): void => cb(progress)
      ipcRenderer.on(IPC.pipelineProgress, listener)
      return () => ipcRenderer.removeListener(IPC.pipelineProgress, listener)
    }
  },

  dialog: {
    pickDedupeFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.dialogPickDedupeFile)
  },

  export: {
    run: (req: ExportRequest): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke(IPC.exportRun, req)
  }
}

export type ElectronApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore — fallback when context isolation is disabled
  window.api = api
}
