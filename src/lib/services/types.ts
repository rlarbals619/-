// 서비스 인터페이스 — 로직 추상화 계층.
//
// 서버(Next.js API 라우트)는 이 인터페이스의 Anthropic/Node 구현(아래 파일들)을 주입해
// 쓴다. 구현을 갈아끼워도 파이프라인·라우트 코드를 손대지 않도록 경계를 유지한다.

import type { Company } from '../../shared/types'

/** 단계별 진행 상황 업데이트(구조화). */
export interface ProgressUpdate {
  message?: string
  fraction?: number
  done?: number
  total?: number
  failed?: number
}

/** 진행 상황을 UI로 흘려보내는 콜백. */
export type ProgressReporter = (update: ProgressUpdate) => void

/** 단계 실행에 필요한 컨텍스트(진행 보고 + 취소 + 완료 기업 스트리밍). */
export interface StageContext {
  report: ProgressReporter
  signal?: AbortSignal
  /** 기업 단위 단계(collect/proposal)에서 완료되는 기업을 즉시 스트리밍. */
  onCompany?: (company: Company) => void
}

/** 업로드된 중복 필터 파일(브라우저 → 서버로 전달된 버퍼). */
export interface DedupeInput {
  buffer: Buffer
  /** 확장자 판별용 원본 파일명(.xlsx / .csv). */
  filename: string
}

/** 1단계: 산업군 → 기업 후보 발굴. */
export interface CompanySearchService {
  search(industry: string, maxCompanies: number, ctx: StageContext): Promise<Company[]>
}

/** 정보 수집 서비스. 번호 해석(필터 직전)과 연락처 수집(dedupe 이후)을 분리. */
export interface InfoCollectorService {
  /** 2단계 직전: 사업자등록번호가 없는 기업만 대상으로 번호를 보강(엄격 필터 생존율 개선). */
  resolveBizNumbers(companies: Company[], ctx: StageContext): Promise<Company[]>
  /** 4단계: 남은 기업의 홈페이지·주소·전화·이메일을 보강. */
  collectContacts(companies: Company[], ctx: StageContext): Promise<Company[]>
}

/** 3단계: 업로드 파일 기반 기존 후원처 제거. */
export interface DedupeService {
  /** 반환: 남은 기업 목록 + 제거된 수. */
  filter(companies: Company[], input: DedupeInput): Promise<{ kept: Company[]; removed: number }>
}

/** 5단계: 기업별 맞춤 제안 문단 생성. */
export interface ProposalService {
  generate(companies: Company[], ctx: StageContext): Promise<Company[]>
}

/** 6단계: 표를 xlsx/csv 버퍼로 내보내기(라우트가 다운로드 응답으로 전송). */
export interface ExportService {
  export(
    companies: Company[],
    format: 'xlsx' | 'csv',
    includeEmails: boolean
  ): Promise<Buffer>
}
