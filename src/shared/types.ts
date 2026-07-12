// 서버·클라이언트 공용 도메인 타입. 순수 TypeScript.

import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_PROPOSALS_SECTION } from './emailTemplate'

/** A single company row as it flows through the pipeline. */
export interface Company {
  /** Stable id assigned at discovery time (used as React key + selection). */
  id: string
  /** 기업명 */
  name: string
  /** 사업자등록번호 (하이픈 포함/미포함 모두 허용). 미확인이면 null. */
  bizNumber: string | null
  /** 홈페이지 URL. 미확인이면 null. */
  homepage: string | null
  /** 본사 주소. 미확인이면 null. */
  address: string | null
  /** 전화번호. 미확인이면 null. */
  phone: string | null
  /** 이메일. 미확인이면 null. */
  email: string | null
  /** 검색 단계에서 파악한 사업 특징 요약 (제안 문장 생성에 활용). */
  summary: string | null
  /** 5단계에서 생성된 맞춤 제안 문단. 아직이면 null. */
  proposal: string | null
  /** 처리 중 발생한 부분 실패 목록(번호 확인 불가, API 에러 등). 없으면 생략. */
  issues?: CompanyIssue[]
  /** 취소 시점에 아직 완료되지 않은 항목(제안 미생성 등). */
  canceled?: boolean
}

/** 기업별 처리 실패 항목. */
export interface CompanyIssue {
  stage: PipelineStage
  reason: string
}

/** 파이프라인 단계 식별자. */
export type PipelineStage =
  | 'search' // 1. 검색·수집
  | 'corpFilter' // 2. 법인 필터 (엄격)
  | 'dedupe' // 3. 중복 필터 (선택)
  | 'collect' // 4. 정보 수집
  | 'proposal' // 5. 제안 문장 생성
  | 'done' // 완료

export type StageStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error'

/** 단계별 진행 상황 (renderer 스텝퍼가 렌더). */
export interface StageProgress {
  stage: PipelineStage
  status: StageStatus
  /** 사람이 읽는 진행 메시지 (예: "3개 기업 발굴"). */
  message?: string
  /** 해당 단계에서 제거된 기업 수 (필터 단계). */
  removed?: number
  /** 진행률 0~1 (정보수집·제안생성처럼 기업 단위로 도는 단계). */
  fraction?: number
  /** 완료한 기업 수 (기업 단위 단계의 카운터 표시·부드러운 증가용). */
  done?: number
  /** 전체 대상 기업 수. */
  total?: number
  /** 실패한 기업 수. */
  failed?: number
}

/**
 * 파이프라인 입력(직렬화 가능 — 클라이언트가 FormData로 전송).
 * 중복 필터 파일은 이 타입에 담지 않고(브라우저 File → 멀티파트),
 * 서버 라우트가 별도로 파싱해 Pipeline.run에 전달한다.
 */
export interface PipelineConfig {
  /** 산업군 키워드 (예: "건강기능식품"). */
  industry: string
  /** 최대 발굴 기업 수 (API 낭비 방지). */
  maxCompanies?: number
  /** Gemini 모델 id (없으면 서버 기본값). */
  model?: string
}

/** pipeline:run 최종 결과. */
export interface PipelineResult {
  companies: Company[]
  /** 단계별 최종 상태 요약. */
  stages: StageProgress[]
}

/** 앱 설정 (API 키 제외 — 키는 별도 안전 저장). */
export interface AppSettings {
  /** Gemini 모델 id. */
  model: string
  /** 발굴 기업 수 상한 기본값. */
  maxCompanies: number
  /** 메일 전문 틀(플레이스홀더 포함). */
  emailTemplate: string
  /** 제안서 소개 블록(파일 업로드로 자동 생성하거나 직접 편집). */
  proposalsSection: string
}

/** 선택 가능한 Gemini 모델 id 목록(허용 목록). 이외 값은 기본값으로 보정한다. */
export const GEMINI_MODEL_IDS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash'
] as const

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gemini-2.0-flash',
  maxCompanies: 8,
  emailTemplate: DEFAULT_EMAIL_TEMPLATE,
  proposalsSection: DEFAULT_PROPOSALS_SECTION
}

/** 저장/전달된 모델 id가 허용 목록에 없으면(예: 예전 캐시된 값) 기본값으로 보정. */
export function sanitizeModel(model: string | undefined | null): string {
  return model && (GEMINI_MODEL_IDS as readonly string[]).includes(model)
    ? model
    : DEFAULT_SETTINGS.model
}

/** 내보내기 형식. */
export type ExportFormat = 'xlsx' | 'csv'

export interface ExportRequest {
  companies: Company[]
  format: ExportFormat
  /** 메일 전문 컬럼 포함 여부. */
  includeEmails: boolean
  /** 메일 전문 틀(없으면 기본값). */
  emailTemplate?: string
  /** 제안서 소개 블록(없으면 기본값). */
  proposalsSection?: string
}
