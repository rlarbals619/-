import { useEffect, useState } from 'react'
import type { Company } from '@shared/types'
import { getAppVersion, hasApiKey, isElectron } from './platform'
import { usePipeline } from './lib/usePipeline'
import { SearchBar } from './components/SearchBar'
import { PipelineStepper } from './components/PipelineStepper'
import { CompanyTable } from './components/CompanyTable'
import { DetailPanel } from './components/DetailPanel'
import { SettingsModal } from './components/SettingsModal'
import { ExportBar } from './components/ExportBar'

function App(): JSX.Element {
  const { running, stages, companies, error, run } = usePipeline()
  const [selected, setSelected] = useState<Company | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keyPresent, setKeyPresent] = useState(false)
  const [version, setVersion] = useState('…')
  const [started, setStarted] = useState(false)

  const refreshKey = (): void => {
    void hasApiKey().then(setKeyPresent)
  }

  useEffect(() => {
    void getAppVersion().then(setVersion)
    refreshKey()
  }, [])

  // 선택된 기업이 결과 갱신으로 사라지면 선택 해제, 아니면 최신 데이터로 동기화.
  useEffect(() => {
    if (!selected) return
    const fresh = companies.find((c) => c.id === selected.id) ?? null
    setSelected(fresh)
  }, [companies]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = (industry: string, dedupeFilePath?: string): void => {
    if (!keyPresent) {
      setSettingsOpen(true)
      return
    }
    setSelected(null)
    setStarted(true)
    void run({ industry, dedupeFilePath })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌂</span>
          <h1 className="text-base font-semibold text-slate-800">
            기업 리서치 &amp; 사회공헌 제안 자동화
          </h1>
          <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
            초록우산
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{isElectron() ? `🖥 v${version}` : `🌐 ${version}`}</span>
          {!keyPresent && <span className="text-amber-500">API 키 미설정</span>}
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-brand hover:text-brand"
          >
            ⚙ 설정
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
          <SearchBar running={running} onRun={handleRun} />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {started && <PipelineStepper stages={stages} />}

          {companies.length > 0 && <ExportBar companies={companies} />}

          {started && (
            <CompanyTable
              companies={companies}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          )}

          {!started && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
              산업군 키워드를 입력하고 검색을 시작하세요.
            </div>
          )}
        </main>

        <DetailPanel company={selected} onClose={() => setSelected(null)} />
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={refreshKey} />
    </div>
  )
}

export default App
