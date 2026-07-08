import { useCallback, useState } from 'react'
import type { Company, StageProgress } from '@shared/types'
import { runPipeline, type PipelineInput } from '@/platform'
import { STAGE_ORDER, initialStages } from '@/lib/stages'

// 파이프라인 실행 + 스트리밍 진행 상황을 캡슐화한 훅.

export interface PipelineState {
  running: boolean
  stages: StageProgress[]
  companies: Company[]
  error: string | null
  run: (input: PipelineInput) => Promise<void>
  reset: () => void
}

export function usePipeline(): PipelineState {
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<StageProgress[]>(initialStages)
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState<string | null>(null)

  const applyProgress = useCallback((p: StageProgress) => {
    setStages((prev) => {
      const idx = STAGE_ORDER.indexOf(p.stage)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = p
      return next
    })
  }, [])

  const run = useCallback(
    async (input: PipelineInput) => {
      setRunning(true)
      setError(null)
      setCompanies([])
      setStages(initialStages())
      try {
        const result = await runPipeline(input, applyProgress)
        setCompanies(result.companies)
        setStages(result.stages)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setRunning(false)
      }
    },
    [applyProgress]
  )

  const reset = useCallback(() => {
    setCompanies([])
    setStages(initialStages())
    setError(null)
  }, [])

  return { running, stages, companies, error, run, reset }
}
