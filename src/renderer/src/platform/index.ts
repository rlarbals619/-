// Platform adapter — the single seam that makes this app web-portable.
//
// Renderer components must NEVER touch `window.api` or any native API
// directly. They call the functions below, which transparently pick the
// Electron implementation (IPC via the preload bridge) or a web fallback.
// To add a web deployment, you only ever change this file.

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.api

/** App version. Electron: via IPC. Web: read from Vite env / fallback. */
export const getAppVersion = async (): Promise<string> => {
  if (isElectron()) {
    return window.api!.getVersion()
  }
  return import.meta.env.VITE_APP_VERSION ?? 'web'
}

/**
 * Simple key/value storage.
 * Electron could route this to a JSON file over IPC later; for now both
 * platforms use localStorage so the skeleton works identically everywhere.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  }
}
