// 서비스 인터페이스 — 웹 포팅용 추상화 계층.
//
// 메인 프로세스는 이 인터페이스의 Anthropic/Node 구현(아래 파일들)을 주입해 쓴다.
// 추후 웹 백엔드(Next.js API 등)로 옮길 때 같은 인터페이스의 서버 구현으로 교체하면
// 렌더러·파이프라인 코드를 손대지 않아도 된다.

import type { Company } from '../../shared/types'

/** 단계별 진행 상황을 UI로 흘려보내는 콜백. */
export type ProgressReporter = (message: string, fraction?: number) => void

/** 1단계: 산업군 → 기업 후보 발굴. */
export interface CompanySearchService {
  search(industry: string, maxCompanies: number, report: ProgressReporter): Promise<Company[]>
}

/** 정보 수집 서비스. 번호 해석(필터 직전)과 연락처 수집(dedupe 이후)을 분리. */
export interface InfoCollectorService {
  /** 2단계 직전: 사업자등록번호가 없는 기업만 대상으로 번호를 보강(엄격 필터 생존율 개선). */
  resolveBizNumbers(companies: Company[], report: ProgressReporter): Promise<Company[]>
  /** 4단계: 남은 기업의 홈페이지·주소·전화·이메일을 보강. */
  collectContacts(companies: Company[], report: ProgressReporter): Promise<Company[]>
}

/** 3단계: 업로드 파일 기반 기존 후원처 제거. */
export interface DedupeService {
  /** 반환: 남은 기업 목록 + 제거된 수. */
  filter(
    companies: Company[],
    dedupeFilePath: string
  ): Promise<{ kept: Company[]; removed: number }>
}

/** 5단계: 기업별 맞춤 제안 문단 생성. */
export interface ProposalService {
  generate(companies: Company[], report: ProgressReporter): Promise<Company[]>
}

/** 6단계: 표를 xlsx/csv로 내보내기. */
export interface ExportService {
  export(
    companies: Company[],
    format: 'xlsx' | 'csv',
    includeEmails: boolean,
    filePath: string
  ): Promise<void>
}

/** API 키 + 앱 설정의 안전 저장소. */
export interface SettingsStore {
  hasApiKey(): boolean
  getApiKey(): string | null
  setApiKey(key: string): void
  clearApiKey(): void
  getSettings(): import('../../shared/types').AppSettings
  setSettings(settings: import('../../shared/types').AppSettings): void
}
