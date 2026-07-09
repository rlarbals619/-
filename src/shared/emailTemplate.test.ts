import { describe, it, expect } from 'vitest'
import {
  buildEmail,
  closingSentence,
  hasValidClosing,
  warmFallbackParagraph,
  DEFAULT_PROPOSALS_SECTION
} from './emailTemplate'

describe('emailTemplate', () => {
  it('기본 템플릿에 서명·제안서 소개가 들어간다', () => {
    const out = buildEmail('가나헬스', `좋은 기업입니다. ${closingSentence('가나헬스')}`)
    expect(out).toContain('초록우산 김규민 드림')
    expect(out).toContain('좋은 기업입니다.')
    expect(out).toContain(DEFAULT_PROPOSALS_SECTION)
    expect(out).toContain('02-398-0253')
  })

  it('사용자 지정 템플릿의 플레이스홀더를 치환한다', () => {
    const template = '[{{기업명}}] 담당자님께.\n{{맞춤문단}}\n---\n{{제안서목록}}'
    const out = buildEmail('다온푸드', '맞춤 문단 내용.', {
      template,
      proposalsSection: '■ 1. 새 제안서 - 요약'
    })
    expect(out).toBe('[다온푸드] 담당자님께.\n맞춤 문단 내용.\n---\n■ 1. 새 제안서 - 요약')
  })

  it('빈 제안 문단이면 따뜻한 기본 문단을 사용한다', () => {
    const out = buildEmail('웰니스랩', '   ', { template: '{{맞춤문단}}' })
    expect(out).toBe(warmFallbackParagraph('웰니스랩'))
  })

  it('공백을 허용하는 플레이스홀더 치환', () => {
    expect(buildEmail('A', 'p', { template: '{{ 기업명 }}' })).toBe('A')
  })

  it('closing 규칙', () => {
    const p = `설명. ${closingSentence('A')}`
    expect(hasValidClosing(p, 'A')).toBe(true)
    expect(hasValidClosing('설명.', 'A')).toBe(false)
  })
})
