import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // Con sandbox: true el preload debe ser CommonJS; el package.json es "type": "module"
    // y sin esto se emite index.mjs, que no coincide con la ruta que carga el proceso main.
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    // El proceso main carga y valida el origen fijo http://localhost:5173; si Vite
    // saltara a otro puerto, la ventana mostraria lo que sea que ocupe el 5173.
    server: { port: 5173, strictPort: true }
  }
})
