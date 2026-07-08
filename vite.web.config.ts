import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web-only build: bundles just the renderer as a plain web app.
// The renderer uses the platform adapter (src/renderer/src/platform),
// so native Electron APIs are never referenced directly here.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true
  }
})
