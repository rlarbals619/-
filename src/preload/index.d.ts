import type { ElectronApi } from './index'

declare global {
  interface Window {
    // Present only when running inside Electron (injected by the preload bridge).
    // In the browser build this is undefined — the platform adapter checks for it.
    api?: ElectronApi
  }
}

export {}
