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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        role="group"
        aria-label="상태 필터"
        className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800"
      >
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`전체 ${counts.all}`} />
        <FilterChip active={filter === 'success'} onClick={() => setFilter('success')} label={`성공 ${counts.success}`} />
        <FilterChip active={filter === 'issue'} onClick={() => setFilter('issue')} label={`이슈·취소 ${counts.issue}`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <caption className="sr-only">발굴된 기업 목록. 열 제목을 눌러 정렬할 수 있습니다.</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
              <th scope="col" className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">
                상태
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? (asc ? 'ascending' : 'descending') : 'none'}
                  className="px-0 py-0 font-semibold text-slate-600 dark:text-slate-300"
                >
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="flex w-full items-center gap-1 whitespace-nowrap px-3 py-2 text-left hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40 dark:hover:text-brand"
                  >
                    {c.label}
                    <span className="text-brand" aria-hidden>
                      {sortKey === c.key ? (asc ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr
                key={company.id}
                onClick={() => onSelect(company)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(company)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${company.name} 상세 보기`}
                aria-current={selectedId === company.id ? true : undefined}
                className={`cursor-pointer border-b border-slate-100 transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50 dark:border-slate-800 ${
                  selectedId === company.id
                    ? 'bg-brand-light dark:bg-brand/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
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
                        value == null
                          ? 'bg-red-50 text-red-400 dark:bg-red-950/40 dark:text-red-400'
                          : 'text-slate-700 dark:text-slate-200'
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
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-3 py-8 text-center text-slate-400 dark:text-slate-500"
                >
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
  success: 'bg-brand-light text-brand-dark dark:bg-brand/20 dark:text-brand',
  issue: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  canceled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
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
      {summary ? <span className="sr-only">: {summary}</span> : null}
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
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-brand/40 ${
        active
          ? 'bg-brand text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}
