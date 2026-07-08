import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types'
import type { SettingsStore } from './types'

// API 키는 safeStorage(OS 키체인)로 암호화해 파일에 저장한다.
// 렌더러에는 원문 키를 절대 반환하지 않는다(hasApiKey 여부만 노출).

interface PersistedFile {
  /** safeStorage.encryptString 결과를 base64로 저장. */
  apiKeyEnc?: string
  settings?: AppSettings
}

export class FileSettingsStore implements SettingsStore {
  private readonly filePath: string
  private cache: PersistedFile

  constructor() {
    this.filePath = join(app.getPath('userData'), 'settings.json')
    this.cache = this.load()
  }

  private load(): PersistedFile {
    try {
      if (existsSync(this.filePath)) {
        return JSON.parse(readFileSync(this.filePath, 'utf-8')) as PersistedFile
      }
    } catch (err) {
      console.error('설정 파일 읽기 실패:', err)
    }
    return {}
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }

  hasApiKey(): boolean {
    return !!this.cache.apiKeyEnc
  }

  getApiKey(): string | null {
    if (!this.cache.apiKeyEnc) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(this.cache.apiKeyEnc, 'base64'))
      }
      // 암호화 불가 환경(일부 Linux): base64 평문 보관 폴백.
      return Buffer.from(this.cache.apiKeyEnc, 'base64').toString('utf-8')
    } catch (err) {
      console.error('API 키 복호화 실패:', err)
      return null
    }
  }

  setApiKey(key: string): void {
    const trimmed = key.trim()
    if (!trimmed) {
      this.clearApiKey()
      return
    }
    const buf = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(trimmed)
      : Buffer.from(trimmed, 'utf-8')
    this.cache.apiKeyEnc = buf.toString('base64')
    this.persist()
  }

  clearApiKey(): void {
    delete this.cache.apiKeyEnc
    this.persist()
  }

  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...(this.cache.settings ?? {}) }
  }

  setSettings(settings: AppSettings): void {
    this.cache.settings = settings
    this.persist()
  }
}
