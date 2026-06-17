import { defineConfig } from 'vite'

// During `npm run dev`, proxy the API + WebSocket to the FastAPI host (serve.py)
// so the frontend and backend share an origin from the browser's point of view.
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
