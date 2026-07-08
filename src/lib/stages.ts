import type { PipelineStage, StageProgress } from '@shared/types'

// 스텝퍼용 단계 메타데이터(순서 + 한글 라벨).

export const STAGE_ORDER: PipelineStage[] = [
  'search',
  'corpFilter',
  'dedupe',
  'collect',
  'proposal',
  'done'
]

export const STAGE_LABEL: Record<PipelineStage, string> = {
  search: '1. 검색·수집',
  corpFilter: '2. 법인 필터',
  dedupe: '3. 중복 제거',
  collect: '4. 정보 수집',
  proposal: '5. 제안 문장',
  done: '6. 완료'
}

export function initialStages(): StageProgress[] {
  return STAGE_ORDER.map((stage) => ({ stage, status: 'pending' }))
}
