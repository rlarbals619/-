// Central registry of IPC channel names. Shared so main + preload never drift.

export const IPC = {
  appGetVersion: 'app:getVersion',

  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsHasApiKey: 'settings:hasApiKey',
  settingsSetApiKey: 'settings:setApiKey',
  settingsClearApiKey: 'settings:clearApiKey',

  pipelineRun: 'pipeline:run',
  pipelineProgress: 'pipeline:progress',

  dialogPickDedupeFile: 'dialog:pickDedupeFile',
  exportRun: 'export:run'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
