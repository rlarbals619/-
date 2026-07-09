'use client'

import { useEffect, useState } from 'react'
import type { AppSettings, Company } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { loadSettings } from '@/platform'
import { usePipeline } from '@/hooks/usePipeline'
import { useTheme } from '@/hooks/useTheme'
import { STAGE_LABEL } from '@/lib/stages'
import { SearchBar } from '@/components/SearchBar'
import { PipelineStepper } from '@/components/PipelineStepper'
import { CompanyTable } from '@/components/CompanyTable'
import { DetailPanel } from '@/components/DetailPanel'
import { SettingsModal } from '@/components/SettingsModal'
import { ExportBar } from '@/components/ExportBar'

export default function Page(): JSX.Element {
  const { running, stages, companies, error, canceled, run, cancel } = usePipeline()
  const { theme, toggle } = useTheme()
  const [selected, setSelected] = useState<Company | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  // 선택된 기업이 결과 갱신으로 사라지면 선택 해제, 아니면 최신 데이터로 동기화.
  useEffect(() => {
    if (!selected) return
    const fresh = companies.find((c) => c.id === selected.id) ?? null
    setSelected(fresh)
  }, [companies]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = (industry: string, dedupeFile: File | null): void => {
    setSelected(null)
    setStarted(true)
    void run({
      industry,
      dedupeFile,
      model: settings.model,
      maxCompanies: settings.maxCompanies
    })
  }

  // 화면낭독기용 간결 상태 문자열(단계 전환마다 갱신).
  const runningStage = stages.find((s) => s.status === 'running')?.stage
  const statusText = error
    ? `오류: ${error}`
    : canceled && !running
      ? '작업이 취소되었습니다.'
      : running
        ? `${runningStage ? STAGE_LABEL[runningStage] : '파이프라인'} 진행 중`
        : started
          ? `완료: 기업 ${companies.length}곳`
          : ''

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg" aria-hidden>
            🌂
          </span>
          <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 sm:text-base">
            기업 리서치 &amp; 사회공헌 제안 자동화
          </h1>
          <span className="hidden shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark dark:bg-brand/20 dark:text-brand sm:inline-block">
            초록우산
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggle}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 transition hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand"
            aria-label={theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? '밝은 테마' : '어두운 테마'}
          >
            <span aria-hidden>{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 transition hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand"
            aria-label="설정 열기"
          >
            <span aria-hidden>⚙</span>
            <span className="ml-1 hidden sm:inline">설정</span>
          </button>
        </div>
      </header>

      {/* 화면낭독기용 실시간 상태 알림 */}
      <div className="sr-only" role="status" aria-live="polite">
        {statusText}
      </div>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5">
          <SearchBar running={running} onRun={handleRun} />

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {canceled && !running && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              작업이 취소되었습니다. 완료된 항목은 아래에 남아 있습니다.
            </div>
          )}

          {running && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent"
                  aria-hidden
                />
                파이프라인 실행 중…
              </span>
              <button
                onClick={cancel}
                className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400/50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                취소
              </button>
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 sm:p-10">
              산업군 키워드를 입력하고 검색을 시작하세요.
            </div>
          )}
        </main>

        <DetailPanel company={selected} onClose={() => setSelected(null)} />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setSettings}
      />
    </div>
  )
}
