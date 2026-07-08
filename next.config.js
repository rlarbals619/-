/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs는 서버(라우트)에서만 사용 — 서버 외부 패키지로 지정해 번들 이슈 방지.
  experimental: {
    serverComponentsExternalPackages: ['exceljs']
  }
}

module.exports = nextConfig
