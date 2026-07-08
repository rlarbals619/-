'use client'

import { useMemo, useState } from 'react'
import type { Company } from '@shared/types'
import { formatBizNumber } from '@shared/bizNumber'

interface Props {
  companies: Company[]
  selectedId: string | null
  onSelect: (company: Company) => void
}

type SortKey = 'name' | 'bizNumber' | 'homepage' | 'address' | 'phone' | 'email'

const COLUMNS: { key: SortKey; label: string; get: (c: Company) => string | null }[] = [
  { key: 'name', label: '기업명', get: (c) => c.name },
  { key: 'bizNumber', label: '사업자등록번호', get: (c) => (c.bizNumber ? formatBizNumber(c.bizNumber) : null) },
  { key: 'homepage', label: '홈페이지', get: (c) => c.homepage },
  { key: 'address', label: '본사 주소', get: (c) => c.address },
  { key: 'phone', label: '전화번호', get: (c) => c.phone },
  { key: 'email', label: '이메일', get: (c) => c.email }
]

// 정렬 가능한 결과 표. "정보 없음" 셀은 색상으로 구분, 행 클릭 시 선택.
export function CompanyTable({ companies, selectedId, onSelect }: Props): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!
    return [...companies].sort((a, b) => {
      const av = col.get(a) ?? ''
      const bv = col.get(b) ?? ''
      return asc ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko')
    })
  }, [companies, sortKey, asc])

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
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
            <th className="px-3 py-2 font-semibold text-slate-600">제안</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((company) => (
            <tr
              key={company.id}
              onClick={() => onSelect(company)}
              className={`cursor-pointer border-b border-slate-100 transition ${
                selectedId === company.id ? 'bg-brand-light' : 'hover:bg-slate-50'
              }`}
            >
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
              <td className="px-3 py-2 align-top">
                {company.proposal ? (
                  <span className="text-brand" title="제안 문장 생성됨">✓</span>
                ) : (
                  <span className="text-slate-300">–</span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-slate-400">
                결과가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
