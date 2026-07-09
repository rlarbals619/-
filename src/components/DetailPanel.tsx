'use client'

import { useState } from 'react'
import type { Company } from '@shared/types'
import { formatBizNumber } from '@shared/bizNumber'
import { buildEmail } from '@shared/emailTemplate'
import { companyStatus, STATUS_LABEL } from '@shared/companyStatus'
import { STAGE_LABEL } from '@/lib/stages'

interface Props {
  company: Company | null
  onClose: () => void
}

// 행 선택 시 상세 정보 + 제안 문단 + 메일 전문을 보여주는 사이드 패널.
export function DetailPanel({ company, onClose }: Props): JSX.Element | null {
  if (!company) return null
  const email = buildEmail(company.name, company.proposal ?? '')

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="truncate text-base font-semibold text-slate-800">{company.name}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {(company.issues?.length || company.canceled) && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h3 className="mb-1 text-xs font-semibold text-amber-700">
              처리 상태: {STATUS_LABEL[companyStatus(company)]}
            </h3>
            {company.canceled && (
              <p className="text-xs text-amber-700">취소 시점에 완료되지 않은 항목입니다.</p>
            )}
            {company.issues?.map((issue, i) => (
              <p key={i} className="text-xs text-amber-700">
                • [{STAGE_LABEL[issue.stage]}] {issue.reason}
              </p>
            ))}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              사업 특징
            </h3>
            <p className="text-sm text-slate-600">{company.summary}</p>
          </section>
        )}

        <CopyBlock title="맞춤 제안 문단" text={company.proposal ?? '(아직 생성되지 않음)'} />
        <CopyBlock title="메일 전문" text={email} mono />
      </div>
    </aside>
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
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words ${value ? 'text-slate-700' : 'text-red-400'}`}>
        {value ? (
          isLink ? (
            <a href={value} target="_blank" rel="noreferrer" className="text-brand hover:underline">
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <button onClick={copy} className="text-xs text-brand hover:underline">
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <pre
        className={`max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {text}
      </pre>
    </section>
  )
}
