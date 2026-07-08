import { useCallback, useEffect, useRef, useState } from 'react'
import type { Company, PipelineConfig, StageProgress } from '@shared/types'
import { onPipelineProgress, runPipeline } from '../platform'
import { STAGE_ORDER, initialStages } from './stages'

// 파이프라인 실행 + 진행 상황 구독을 캡슐화한 훅.

export interface PipelineState {
  running: boolean
  stages: StageProgress[]
  companies: Company[]
  error: string | null
  run: (config: PipelineConfig) => Promise<void>
  reset: () => void
}

export function usePipeline(): PipelineState {
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<StageProgress[]>(initialStages)
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState<string | null>(null)

  // 진행 이벤트 구독은 앱 생명주기 동안 유지.
  const stagesRef = useRef<StageProgress[]>(stages)
  stagesRef.current = stages

  useEffect(() => {
    const unsubscribe = onPipelineProgress((p) => {
      setStages((prev) => {
        const idx = STAGE_ORDER.indexOf(p.stage)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = p
        return next
      })
    })
    return unsubscribe
  }, [])

  const run = useCallback(async (config: PipelineConfig) => {
    setRunning(true)
    setError(null)
    setCompanies([])
    setStages(initialStages())
    try {
      const result = await runPipeline(config)
      setCompanies(result.companies)
      setStages(result.stages)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [])

  const reset = useCallback(() => {
    setCompanies([])
    setStages(initialStages())
    setError(null)
  }, [])

  return { running, stages, companies, error, run, reset }
}
