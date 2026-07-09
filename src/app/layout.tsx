import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '초록우산 기업 리서치 & 사회공헌 제안 자동화',
  description:
    '산업군 키워드로 법인기업을 발굴해 후원 제안 정보와 맞춤 제안 문장을 자동 생성하는 웹앱.'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' }
  ]
}

// 하이드레이션 전에 테마 클래스를 먼저 적용해 FOUC(깜빡임)를 방지한다.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
