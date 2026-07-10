import { describe, it, expect } from 'vitest'
import type { Company } from '@shared/types'
import { companyStatus, issueSummary } from '@shared/companyStatus'
import { classifyFailure } from '@/lib/services/failures'
import { GeminiInfoCollector } from '@/lib/services/infoCollector'
import { GeminiProposalService } from '@/lib/services/proposal'
import { Pipeline } from '@/lib/pipeline'
import type { GeminiService } from '@/lib/services/gemini'
import type {
  CompanySearchService,
  DedupeService,
  StageContext
} from '@/lib/services/types'

function mk(name: string, over: Partial<Company> = {}): Company {
  return {
    id: name,
    name,
    bizNumber: '123-85-67890', // 법인(4번째 자리=8)
    homepage: null,
    address: null,
    phone: null,
    email: null,
    summary: null,
    proposal: null,
    ...over
  }
}

const nameFromUser = (user: string): string => user.match(/기업명: "?([^"\n]+)"?/)?.[1]?.trim() ?? ''

// 연락처 수집 fake: 이름으로 성공/빈결과/네트워크실패 분기.
const fakeCollectAi = {
  async searchStructured(_sys: string, user: string) {
    const n = nameFromUser(user)
    if (n.includes('네트워크실패')) throw new Error('fetch failed: ECONNRESET')
    if (n.includes('정보없음')) return { homepage: null, address: null, phone: null, email: null }
    return { homepage: 'https://ex.co', address: '서울시', phone: '02-1', email: 'a@ex.co' }
  }
} as unknown as GeminiService

// 제안 생성 fake: '제안실패' 포함 시 throw.
const fakeProposalAi = {
  async generateText(_sys: string, user: string) {
    if (user.includes('제안실패')) throw new Error('overloaded 529')
    return '좋은 기업입니다.'
  }
} as unknown as GeminiService

describe('실패 분류·상태 헬퍼', () => {
  it('classifyFailure가 에러를 사유로 분류', () => {
    expect(classifyFailure(new Error('fetch failed'))).toBe('타임아웃·네트워크 오류')
    expect(classifyFailure(new Error('429 rate limit'))).toBe('요청 한도 초과')
    expect(classifyFailure(new Error('무슨 오류'))).toBe('처리 실패')
    const ab = new Error('x')
    ab.name = 'AbortError'
    expect(classifyFailure(ab)).toBe('취소됨')
  })

  it('companyStatus·issueSummary', () => {
    expect(companyStatus(mk('a'))).toBe('success')
    expect(companyStatus(mk('b', { issues: [{ stage: 'collect', reason: 'x' }] }))).toBe('issue')
    expect(companyStatus(mk('c', { canceled: true }))).toBe('canceled')
    expect(
      issueSummary(mk('b', { issues: [{ stage: 'collect', reason: 'x' }, { stage: 'proposal', reason: 'y' }] }))
    ).toBe('x, y')
  })
})

describe('collectContacts 부분 실패', () => {
  it('일부 실패해도 전체 처리, 이슈 기록, 빈 결과는 실패 아님', async () => {
    const collector = new GeminiInfoCollector(fakeCollectAi)
    const emitted: Company[] = []
    const reports: Array<Record<string, unknown>> = []
    const ctx: StageContext = {
      report: (u) => reports.push(u as Record<string, unknown>),
      onCompany: (c) => emitted.push(c)
    }
    const res = await collector.collectContacts([mk('정상'), mk('정보없음'), mk('네트워크실패')], ctx)
    const by = Object.fromEntries(res.map((c) => [c.name, c]))

    expect(res).toHaveLength(3) // 멈추지 않음
    expect(by['정상'].address).toBe('서울시')
    expect(by['정상'].issues).toBeUndefined()
    expect(by['정보없음'].address).toBeNull()
    expect(by['정보없음'].issues).toBeUndefined() // 빈 결과 ≠ 실패
    expect(by['네트워크실패'].issues?.[0]).toEqual({ stage: 'collect', reason: '타임아웃·네트워크 오류' })
    expect(emitted).toHaveLength(3) // 완료 기업 스트리밍
    expect((reports.at(-1) as { failed?: number }).failed).toBe(1)
  })

  it('취소된 signal이면 AbortError를 던진다', async () => {
    const ac = new AbortController()
    ac.abort()
    const collector = new GeminiInfoCollector(fakeCollectAi)
    let caught: unknown
    try {
      await collector.collectContacts([mk('정상')], { report: () => {}, signal: ac.signal })
    } catch (e) {
      caught = e
    }
    expect((caught as Error)?.name).toBe('AbortError')
  })

  it('내부 AbortError는 이슈로 삼키지 않고 재던짐', async () => {
    const abortingAi = {
      async searchStructured() {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }
    } as unknown as GeminiService
    const collector = new GeminiInfoCollector(abortingAi)
    let caught: unknown
    try {
      await collector.collectContacts([mk('x')], { report: () => {} })
    } catch (e) {
      caught = e
    }
    expect((caught as Error)?.name).toBe('AbortError')
  })
})

describe('proposal 부분 실패', () => {
  it('실패 시 기본 문안 + 이슈, 나머지는 정상', async () => {
    const svc = new GeminiProposalService(fakeProposalAi)
    const reports: Array<Record<string, unknown>> = []
    const res = await svc.generate([mk('제안정상'), mk('제안실패')], {
      report: (u) => reports.push(u as Record<string, unknown>)
    })
    const by = Object.fromEntries(res.map((c) => [c.name, c]))
    expect(by['제안정상'].proposal).toBeTruthy()
    expect(by['제안정상'].issues).toBeUndefined()
    expect(by['제안실패'].proposal).toBeTruthy() // 폴백 문안
    expect(by['제안실패'].issues?.[0].stage).toBe('proposal')
    expect((reports.at(-1) as { failed?: number }).failed).toBe(1)
  })
})

describe('Pipeline은 혼합 실패에도 멈추지 않는다', () => {
  it('전체 기업 처리 + 이슈 표시 + 기업 스트리밍', async () => {
    const fakeSearch: CompanySearchService = {
      async search() {
        return [mk('정상'), mk('정보없음'), mk('네트워크실패'), mk('제안실패')]
      }
    }
    const fakeDedupe: DedupeService = {
      async filter(companies) {
        return { kept: companies, removed: 0 }
      }
    }
    const pipeline = new Pipeline(
      fakeSearch,
      new GeminiInfoCollector(fakeCollectAi),
      fakeDedupe,
      new GeminiProposalService(fakeProposalAi)
    )
    const streamed: Company[] = []
    const res = await pipeline.run(
      { industry: '테스트' },
      { progress: () => {}, company: (c) => streamed.push(c) }
    )
    const by = Object.fromEntries(res.companies.map((c) => [c.name, c]))

    expect(res.companies).toHaveLength(4) // 멈추지 않고 전체 처리
    expect(by['네트워크실패'].issues?.some((i) => i.stage === 'collect')).toBe(true)
    expect(by['제안실패'].issues?.some((i) => i.stage === 'proposal')).toBe(true)
    expect(by['정상'].issues).toBeUndefined()
    // collect 4건 + proposal 4건 스트리밍
    expect(streamed).toHaveLength(8)
  })
})
