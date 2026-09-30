import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    // Entorno por defecto: node (para src/main y src/preload).
    // Los tests de src/renderer declaran `// @vitest-environment jsdom`
    // como primera línea del archivo.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: false
  }
})
