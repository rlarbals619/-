/** @type {import('next').NextConfig} */
// Vercel 자동 배포 호환: output:'standalone' 등 별도 설정 없이 그대로 배포된다
// (standalone은 Docker/자체 호스팅용이라 Vercel에는 불필요). vercel.json도 필요 없음.
const nextConfig = {
  reactStrictMode: true,
  // exceljs는 서버(라우트)에서만 사용 — 서버 외부 패키지로 지정해 번들 이슈 방지.
  experimental: {
    serverComponentsExternalPackages: ['exceljs']
  }
}

module.exports = nextConfig
