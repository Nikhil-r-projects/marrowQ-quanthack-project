import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js (~650 kB) is isolated in the lazily loaded OrganViewer3D chunk.
    chunkSizeWarningLimit: 700
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8010',
        changeOrigin: true
      }
    }
  }
})
