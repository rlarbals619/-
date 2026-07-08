import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '초록우산 기업 리서치 & 사회공헌 제안 자동화',
  description:
    '산업군 키워드로 법인기업을 발굴해 후원 제안 정보와 맞춤 제안 문장을 자동 생성하는 웹앱.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
