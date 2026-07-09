'use client'

import { useMemo, useState } from 'react'
import type { Company } from '@shared/types'
import { formatBizNumber } from '@shared/bizNumber'
import { companyStatus, issueSummary, STATUS_LABEL, type CompanyStatus } from '@shared/companyStatus'

interface Props {
  companies: Company[]
  selectedId: string | null
  onSelect: (company: Company) => void
}

type SortKey = 'name' | 'bizNumber' | 'homepage' | 'address' | 'phone' | 'email'
type Filter = 'all' | 'success' | 'issue'

const COLUMNS: { key: SortKey; label: string; get: (c: Company) => string | null }[] = [
  { key: 'name', label: '기업명', get: (c) => c.name },
  { key: 'bizNumber', label: '사업자등록번호', get: (c) => (c.bizNumber ? formatBizNumber(c.bizNumber) : null) },
  { key: 'homepage', label: '홈페이지', get: (c) => c.homepage },
  { key: 'address', label: '본사 주소', get: (c) => c.address },
  { key: 'phone', label: '전화번호', get: (c) => c.phone },
  { key: 'email', label: '이메일', get: (c) => c.email }
]

// 정렬·필터 가능한 결과 표. "정보 없음" 셀은 색상으로, 처리 상태는 배지로 구분.
export function CompanyTable({ companies, selectedId, onSelect }: Props): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [asc, setAsc] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    let success = 0
    let issue = 0
    for (const c of companies) {
      if (companyStatus(c) === 'success') success += 1
      else issue += 1 // issue + canceled
    }
    return { all: companies.length, success, issue }
  }, [companies])

  const rows = useMemo(() => {
    const filtered = companies.filter((c) => {
      if (filter === 'all') return true
      const st = companyStatus(c)
      return filter === 'success' ? st === 'success' : st !== 'success'
    })
    const col = COLUMNS.find((c) => c.key === sortKey)!
    return filtered.sort((a, b) => {
      const av = col.get(a) ?? ''
      const bv = col.get(b) ?? ''
      return asc ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko')
    })
  }, [companies, sortKey, asc, filter])

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`전체 ${counts.all}`} />
        <FilterChip active={filter === 'success'} onClick={() => setFilter('success')} label={`성공 ${counts.success}`} />
        <FilterChip active={filter === 'issue'} onClick={() => setFilter('issue')} label={`이슈·취소 ${counts.issue}`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2 font-semibold text-slate-600">상태</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold text-slate-600 hover:text-brand-dark"
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1 text-brand">{asc ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr
                key={company.id}
                onClick={() => onSelect(company)}
                className={`cursor-pointer border-b border-slate-100 transition ${
                  selectedId === company.id ? 'bg-brand-light' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-3 py-2 align-top">
                  <StatusBadge company={company} />
                </td>
                {COLUMNS.map((c) => {
                  const value = c.get(company)
                  return (
                    <td
                      key={c.key}
                      className={`max-w-[220px] truncate px-3 py-2 align-top ${
                        value == null ? 'bg-red-50 text-red-400' : 'text-slate-700'
                      }`}
                      title={value ?? '정보 없음'}
                    >
                      {value ?? '정보 없음'}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-slate-400">
                  결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const BADGE_STYLE: Record<CompanyStatus, string> = {
  success: 'bg-brand-light text-brand-dark',
  issue: 'bg-amber-50 text-amber-700',
  canceled: 'bg-slate-100 text-slate-500'
}

function StatusBadge({ company }: { company: Company }): JSX.Element {
  const st = companyStatus(company)
  const summary = issueSummary(company)
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLE[st]}`}
      title={summary || STATUS_LABEL[st]}
    >
      {STATUS_LABEL[st]}
    </span>
  )
}

function FilterChip({
  active,
  onClick,
  label
}: {
  active: boolean
  onClick: () => void
  label: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}
