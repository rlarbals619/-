import { useCallback, useRef, useState } from 'react'
import type { Company, StageProgress } from '@shared/types'
import { runPipeline, type PipelineInput } from '@/platform'
import { STAGE_ORDER, initialStages } from '@/lib/stages'

// 파이프라인 실행 + 스트리밍 진행 상황 + 취소를 캡슐화한 훅.

export interface PipelineState {
  running: boolean
  stages: StageProgress[]
  companies: Company[]
  error: string | null
  canceled: boolean
  run: (input: PipelineInput) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function usePipeline(): PipelineState {
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<StageProgress[]>(initialStages)
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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
      const controller = new AbortController()
      abortRef.current = controller
      setRunning(true)
      setError(null)
      setCanceled(false)
      setCompanies([])
      setStages(initialStages())
      try {
        const result = await runPipeline(input, applyProgress, controller.signal)
        setCompanies(result.companies)
        setStages(result.stages)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setCanceled(true)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        setRunning(false)
        abortRef.current = null
      }
    },
    [applyProgress]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setCompanies([])
    setStages(initialStages())
    setError(null)
    setCanceled(false)
  }, [])

  return { running, stages, companies, error, canceled, run, cancel, reset }
}
