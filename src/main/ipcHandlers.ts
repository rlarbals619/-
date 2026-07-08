import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { AppSettings, ExportRequest, PipelineConfig, StageProgress } from '../shared/types'
import { AnthropicService } from './services/anthropic'
import { AnthropicCompanySearch } from './services/companySearch'
import { AnthropicInfoCollector } from './services/infoCollector'
import { FileDedupeService } from './services/dedupe'
import { AnthropicProposalService } from './services/proposal'
import { ExcelExportService } from './services/exporter'
import { FileSettingsStore } from './services/settingsStore'
import { Pipeline } from './pipeline'

// 모든 IPC 핸들러 등록 지점. 렌더러는 preload 브리지를 통해서만 이 채널들에 접근한다.
// app.whenReady() 이후(app.getPath 사용 가능 시점)에 호출해야 한다.

export function registerIpcHandlers(): void {
  const settings = new FileSettingsStore()
  const ai = new AnthropicService(settings)
  const pipeline = new Pipeline(
    new AnthropicCompanySearch(ai),
    new AnthropicInfoCollector(ai),
    new FileDedupeService(),
    new AnthropicProposalService(ai)
  )
  const exporter = new ExcelExportService()

  ipcMain.handle(IPC.appGetVersion, () => app.getVersion())

  // 설정 / API 키
  ipcMain.handle(IPC.settingsGet, () => settings.getSettings())
  ipcMain.handle(IPC.settingsSet, (_e, next: AppSettings) => settings.setSettings(next))
  ipcMain.handle(IPC.settingsHasApiKey, () => settings.hasApiKey())
  ipcMain.handle(IPC.settingsSetApiKey, (_e, key: string) => settings.setApiKey(key))
  ipcMain.handle(IPC.settingsClearApiKey, () => settings.clearApiKey())

  // 파이프라인 실행 — 진행 상황은 이벤트 sender로 stream.
  ipcMain.handle(IPC.pipelineRun, async (event, config: PipelineConfig) => {
    const emit = (progress: StageProgress): void => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.pipelineProgress, progress)
      }
    }
    return pipeline.run(config, emit)
  })

  // 중복 필터용 파일 선택 다이얼로그.
  ipcMain.handle(IPC.dialogPickDedupeFile, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '기존 후원처 파일 선택',
      properties: ['openFile'],
      filters: [{ name: '엑셀/CSV', extensions: ['xlsx', 'csv'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 내보내기 — 저장 위치 선택 후 파일 생성.
  ipcMain.handle(IPC.exportRun, async (event, req: ExportRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const ext = req.format
    const result = await dialog.showSaveDialog(win!, {
      title: '내보내기',
      defaultPath: `초록우산_후원후보.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true as const }
    await exporter.export(req.companies, req.format, req.includeEmails, result.filePath)
    return { canceled: false as const, filePath: result.filePath }
  })
}
