import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The browser only talks to the frontend origin. Vite forwards /api requests
    // locally to FastAPI, even when a teammate uses the frontend Dev Tunnel.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
});
