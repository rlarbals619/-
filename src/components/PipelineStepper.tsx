import type { StageProgress } from '@shared/types'
import { STAGE_LABEL } from '../lib/stages'

interface Props {
  stages: StageProgress[]
}

// 6단계 파이프라인 진행 표시 — 단계별 상태 + 로딩 인디케이터.
export function PipelineStepper({ stages }: Props): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="flex flex-col gap-2">
        {stages.map((s) => (
          <li key={s.stage} className="flex items-start gap-3">
            <StatusIcon status={s.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-medium ${
                    s.status === 'pending' ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {STAGE_LABEL[s.stage]}
                </span>
                {typeof s.removed === 'number' && s.removed > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                    {s.removed}곳 제외
                  </span>
                )}
              </div>
              {s.message && <p className="truncate text-xs text-slate-500">{s.message}</p>}
              {s.status === 'running' && typeof s.fraction === 'number' && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: `${Math.round(s.fraction * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StatusIcon({ status }: { status: StageProgress['status'] }): JSX.Element {
  const base = 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs'
  switch (status) {
    case 'running':
      return (
        <span className={`${base} bg-brand/10`}>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </span>
      )
    case 'done':
      return <span className={`${base} bg-brand text-white`}>✓</span>
    case 'skipped':
      return <span className={`${base} bg-slate-100 text-slate-400`}>–</span>
    case 'error':
      return <span className={`${base} bg-red-100 text-red-600`}>!</span>
    default:
      return <span className={`${base} border border-slate-300 text-slate-300`}>○</span>
  }
}
