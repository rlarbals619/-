import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// 서버 로직 유닛테스트. 노드 환경, tsconfig 경로 별칭 미러링.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src')
    }
  }
})
