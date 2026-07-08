import { contextBridge, ipcRenderer } from 'electron'

// The only surface the renderer can use to reach the main process.
// Expose narrow, purpose-built methods here — never the raw ipcRenderer.
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
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
