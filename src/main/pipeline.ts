import type {
  Company,
  PipelineConfig,
  PipelineResult,
  PipelineStage,
  StageProgress,
  StageStatus
} from '../shared/types'
import { isCorporate } from '../shared/bizNumber'
import type {
  CompanySearchService,
  DedupeService,
  InfoCollectorService,
  ProgressReporter,
  ProposalService
} from './services/types'

// 파이프라인 오케스트레이션. 각 단계 진행 상황을 emit으로 흘려보내고,
// 최종 기업 목록 + 단계 요약을 반환한다.
//
// 순서(무거운 작업을 마지막에):
// 1 검색 → 2 법인 필터(엄격) → 3 중복 필터(선택) → 4 정보 수집 → 5 제안 문장.

export type EmitProgress = (progress: StageProgress) => void

export class Pipeline {
  constructor(
    private readonly search: CompanySearchService,
    private readonly info: InfoCollectorService,
    private readonly dedupe: DedupeService,
    private readonly proposal: ProposalService
  ) {}

  async run(config: PipelineConfig, emit: EmitProgress): Promise<PipelineResult> {
    const tracker = new StageTracker(emit)
    const max = config.maxCompanies && config.maxCompanies > 0 ? config.maxCompanies : 15

    try {
      // 1. 검색·수집
      let companies = await tracker.run('search', (report) =>
        this.search.search(config.industry, max, report)
      )
      tracker.done('search', `${companies.length}개 기업 발굴`)

      // 2. 법인 필터(엄격) — 필터 직전 사업자등록번호 보강.
      companies = await tracker.run('corpFilter', (report) =>
        this.info.resolveBizNumbers(companies, report)
      )
      const beforeCorp = companies.length
      companies = companies.filter((c) => isCorporate(c.bizNumber))
      tracker.done(
        'corpFilter',
        `법인 ${companies.length}곳 유지`,
        beforeCorp - companies.length
      )

      // 3. 중복/기존 후원처 필터(파일 있을 때만).
      if (config.dedupeFilePath) {
        const kept = await tracker.run('dedupe', async () => {
          const res = await this.dedupe.filter(companies, config.dedupeFilePath!)
          return res
        })
        companies = kept.kept
        tracker.done('dedupe', `기존 후원처 ${kept.removed}곳 제외`, kept.removed)
      } else {
        tracker.skip('dedupe', '업로드 파일 없음 — 생략')
      }

      // 4. 정보 수집(남은 기업만).
      companies = await tracker.run('collect', (report) =>
        this.info.collectContacts(companies, report)
      )
      tracker.done('collect', `${companies.length}곳 정보 수집`)

      // 5. 제안 문장 생성(최종 남은 기업만).
      companies = await tracker.run('proposal', (report) =>
        this.proposal.generate(companies, report)
      )
      tracker.done('proposal', `${companies.length}곳 제안 문장 생성`)

      tracker.done('done', '완료')
      return { companies, stages: tracker.snapshot() }
    } catch (err) {
      tracker.fail(err instanceof Error ? err.message : String(err))
      throw err
    }
  }
}

/** 단계 상태를 추적하며 live emit + 최종 snapshot을 제공. */
class StageTracker {
  private readonly order: PipelineStage[] = [
    'search',
    'corpFilter',
    'dedupe',
    'collect',
    'proposal',
    'done'
  ]
  private readonly map = new Map<PipelineStage, StageProgress>()
  private current: PipelineStage | null = null

  constructor(private readonly emit: EmitProgress) {
    for (const stage of this.order) this.map.set(stage, { stage, status: 'pending' })
  }

  private set(stage: PipelineStage, patch: Partial<StageProgress>): void {
    const next = { ...this.map.get(stage)!, ...patch, stage }
    this.map.set(stage, next)
    this.emit(next)
  }

  /** 단계를 running으로 표시하고 작업을 실행. report 콜백으로 세부 진행 전달. */
  async run<T>(stage: PipelineStage, work: (report: ProgressReporter) => Promise<T>): Promise<T> {
    this.current = stage
    this.set(stage, { status: 'running', message: undefined, fraction: undefined })
    const report: ProgressReporter = (message, fraction) =>
      this.set(stage, { status: 'running', message, fraction })
    return work(report)
  }

  done(stage: PipelineStage, message?: string, removed?: number): void {
    this.set(stage, { status: 'done', message, removed })
  }

  skip(stage: PipelineStage, message?: string): void {
    this.set(stage, { status: 'skipped', message })
  }

  fail(message: string): void {
    const stage = this.current ?? 'search'
    this.set(stage, { status: 'error', message })
  }

  snapshot(): StageProgress[] {
    return this.order.map((s) => this.map.get(s)!)
  }
}

/** UI 스텝퍼 초기 상태 헬퍼(선택 사용). */
export function initialStages(): StageProgress[] {
  const order: PipelineStage[] = ['search', 'corpFilter', 'dedupe', 'collect', 'proposal', 'done']
  const status: StageStatus = 'pending'
  return order.map((stage) => ({ stage, status }))
}

/** 파이프라인에서 사용하는 Company 타입 재노출(main 내부 편의). */
export type { Company }
