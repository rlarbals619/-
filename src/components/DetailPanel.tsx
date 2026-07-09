'use client'

import { useEffect, useRef, useState } from 'react'
import type { Company } from '@shared/types'
import { formatBizNumber } from '@shared/bizNumber'
import { buildEmail } from '@shared/emailTemplate'
import { companyStatus, STATUS_LABEL } from '@shared/companyStatus'
import { STAGE_LABEL } from '@/lib/stages'

interface Props {
  company: Company | null
  onClose: () => void
  emailTemplate?: string
  proposalsSection?: string
}

// 행 선택 시 상세 정보 + 제안 문단 + 메일 전문을 보여주는 패널.
// 데스크톱(lg↑)에서는 오른쪽 고정 사이드바, 모바일에서는 오버레이 드로어.
export function DetailPanel({ company, onClose, emailTemplate, proposalsSection }: Props): JSX.Element | null {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!company) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [company, onClose])

  if (!company) return null
  const email = buildEmail(company.name, company.proposal ?? '', {
    template: emailTemplate,
    proposalsSection
  })

  return (
    <div className="fixed inset-0 z-40 lg:static lg:z-auto lg:h-full lg:w-[420px] lg:shrink-0">
      <div className="absolute inset-0 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={`${company.name} 상세 정보`}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:static lg:w-full lg:max-w-none"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
            {company.name}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="상세 패널 닫기"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {(company.issues?.length || company.canceled) && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <h3 className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                처리 상태: {STATUS_LABEL[companyStatus(company)]}
              </h3>
              {company.canceled && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  취소 시점에 완료되지 않은 항목입니다.
                </p>
              )}
              {company.issues?.map((issue, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                  • [{STAGE_LABEL[issue.stage]}] {issue.reason}
                </p>
              ))}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              수집 정보
            </h3>
            <dl className="space-y-1.5 text-sm">
              <Field label="사업자등록번호" value={company.bizNumber ? formatBizNumber(company.bizNumber) : null} />
              <Field label="홈페이지" value={company.homepage} isLink />
              <Field label="본사 주소" value={company.address} />
              <Field label="전화번호" value={company.phone} />
              <Field label="이메일" value={company.email} />
            </dl>
          </section>

          {company.summary && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                사업 특징
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{company.summary}</p>
            </section>
          )}

          <CopyBlock title="맞춤 제안 문단" text={company.proposal ?? '(아직 생성되지 않음)'} />
          <CopyBlock title="메일 전문" text={email} mono />
        </div>
      </aside>
    </div>
  )
}

function Field({
  label,
  value,
  isLink
}: {
  label: string
  value: string | null
  isLink?: boolean
}): JSX.Element {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-400 dark:text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 flex-1 break-words ${
          value ? 'text-slate-700 dark:text-slate-200' : 'text-red-500 dark:text-red-400'
        }`}
      >
        {value ? (
          isLink ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          '정보 없음'
        )}
      </dd>
    </div>
  )
}

function CopyBlock({ title, text, mono }: { title: string; text: string; mono?: boolean }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {title}
        </h3>
        <button
          onClick={copy}
          className="rounded text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${title} 복사됨` : ''}
      </span>
      <pre
        className={`max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {text}
      </pre>
    </section>
  )
}
