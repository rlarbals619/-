// 순서를 보존하면서 동시 실행 수를 제한하는 map. abort 시 새 작업 시작을 멈춘다.

/** AbortSignal이 이미 취소됐으면 AbortError를 던진다. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('작업이 취소되었습니다.', 'AbortError')
  }
}

/**
 * items를 최대 `limit`개씩 동시에 fn으로 처리한다. 결과는 입력 순서를 보존한다.
 * onSettled: 각 항목이 끝날 때(성공/실패 무관) 호출 — 진행률 보고용.
 * signal이 취소되면 진행 중 작업만 마치고 새 작업은 시작하지 않으며, 마지막에 rethrow.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  opts: { signal?: AbortSignal; onSettled?: () => void } = {}
): Promise<R[]> {
  const { signal, onSettled } = opts
  const results = new Array<R>(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))

  const worker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return
      const current = next++
      if (current >= items.length) return
      results[current] = await fn(items[current], current)
      onSettled?.()
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  throwIfAborted(signal)
  return results
}
