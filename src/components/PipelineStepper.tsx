'use client'

import type { StageProgress } from '@shared/types'
import { STAGE_LABEL } from '@/lib/stages'
import { useCountUp } from '@/hooks/useCountUp'

interface Props {
  stages: StageProgress[]
}

// 6단계 파이프라인 진행 표시 — 단계별 상태 + 로딩 인디케이터 + 부드러운 카운터.
export function PipelineStepper({ stages }: Props): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="flex flex-col gap-2">
        {stages.map((s) => (
          <li key={s.stage} className="flex items-start gap-3">
            <StatusIcon status={s.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-medium ${
                    s.status === 'pending' ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {STAGE_LABEL[s.stage]}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {typeof s.failed === 'number' && s.failed > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                      실패 {s.failed}
                    </span>
                  )}
                  {typeof s.removed === 'number' && s.removed > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                      {s.removed}곳 제외
                    </span>
                  )}
                </div>
              </div>
              <StageDetail progress={s} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StageDetail({ progress: s }: { progress: StageProgress }): JSX.Element | null {
  const hasCounter = typeof s.done === 'number' && typeof s.total === 'number'
  const animatedDone = useCountUp(hasCounter ? s.done! : 0)

  if (!s.message && !hasCounter) return null

  return (
    <>
      {hasCounter ? (
        <p className="truncate text-xs text-slate-500">
          {stageVerb(s)} {animatedDone}/{s.total}
          {typeof s.failed === 'number' && s.failed > 0 ? ` (실패 ${s.failed})` : ''}
        </p>
      ) : (
        s.message && <p className="truncate text-xs text-slate-500">{s.message}</p>
      )}
      {s.status === 'running' && typeof s.fraction === 'number' && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${Math.round(s.fraction * 100)}%` }}
          />
        </div>
      )}
    </>
  )
}

/** 카운터 앞에 붙는 동사(메시지에서 카운터 숫자 부분 제거). */
function stageVerb(s: StageProgress): string {
  if (s.message) return s.message.replace(/\s*\d+\/\d+.*$/, '')
  return ''
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
