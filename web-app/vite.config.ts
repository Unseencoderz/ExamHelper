import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  // Build output goes into web-app/dist, which the backend serves as WEB_DIR
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Proxy all API calls and socket.io to the running backend server
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/screenshots': { target: 'http://localhost:3000', changeOrigin: true },
      '/archive': { target: 'http://localhost:3000', changeOrigin: true },
      '/snippets': { target: 'http://localhost:3000', changeOrigin: true },
      '/clipboard': { target: 'http://localhost:3000', changeOrigin: true },
      '/config': { target: 'http://localhost:3000', changeOrigin: true },
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/stats': { target: 'http://localhost:3000', changeOrigin: true },
      '/desktop-status': { target: 'http://localhost:3000', changeOrigin: true },
      '/client-state': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
