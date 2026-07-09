import { useCallback, useRef, useState } from 'react'
import type { Company, StageProgress } from '@shared/types'
import { runPipeline, type PipelineInput } from '@/platform'
import { STAGE_ORDER, initialStages } from '@/lib/stages'

// 파이프라인 실행 + 스트리밍 진행 상황 + 완료 기업 누적 + 취소를 캡슐화한 훅.

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
  // 스트리밍으로 도착한 기업을 id로 누적(취소 시에도 완료분 보존).
  const mapRef = useRef<Map<string, Company>>(new Map())

  const applyProgress = useCallback((p: StageProgress) => {
    setStages((prev) => {
      const idx = STAGE_ORDER.indexOf(p.stage)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = p
      return next
    })
  }, [])

  const upsertCompany = useCallback((c: Company) => {
    mapRef.current.set(c.id, c)
    setCompanies(Array.from(mapRef.current.values()))
  }, [])

  const run = useCallback(
    async (input: PipelineInput) => {
      const controller = new AbortController()
      abortRef.current = controller
      mapRef.current = new Map()
      setRunning(true)
      setError(null)
      setCanceled(false)
      setCompanies([])
      setStages(initialStages())
      try {
        const result = await runPipeline(
          input,
          { onProgress: applyProgress, onCompany: upsertCompany },
          controller.signal
        )
        // 성공: 최종 authoritative 스냅샷으로 교체.
        mapRef.current = new Map(result.companies.map((c) => [c.id, c]))
        setCompanies(result.companies)
        setStages(result.stages)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 취소: 누적된 완료분 유지, 미완료(제안 없음)는 취소됨으로 마킹.
          setCanceled(true)
          const marked = Array.from(mapRef.current.values()).map((c) =>
            c.proposal ? c : { ...c, canceled: true }
          )
          setCompanies(marked)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        setRunning(false)
        abortRef.current = null
      }
    },
    [applyProgress, upsertCompany]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    mapRef.current = new Map()
    setCompanies([])
    setStages(initialStages())
    setError(null)
    setCanceled(false)
  }, [])

  return { running, stages, companies, error, canceled, run, cancel, reset }
}
