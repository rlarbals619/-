'use client'

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// 테마 상태 + 토글. 초기값은 layout의 no-FOUC 스크립트가 <html>에 심어둔 클래스에서 읽는다.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      try {
        localStorage.setItem('theme', next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
