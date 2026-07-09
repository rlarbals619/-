import { useEffect, useRef, useState } from 'react'

// 목표값으로 부드럽게(짧은 easing) 증가하는 정수 카운터.
// 병렬 처리로 완료가 몰려 값이 튀어도(3→7) 화면에서는 매끄럽게 오른다.

export function useCountUp(target: number, durationMs = 400): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    // 모션 최소화 선호 시 애니메이션 없이 즉시 목표값으로.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      fromRef.current = target
      setValue(target)
      return
    }
    startRef.current = performance.now()

    const tick = (now: number): void => {
      const t = Math.min(1, (now - startRef.current) / durationMs)
      const eased = 1 - (1 - t) * (1 - t) // easeOutQuad
      const current = Math.round(from + (target - from) * eased)
      setValue(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [target, durationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}
