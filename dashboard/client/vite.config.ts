import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Output to server's public directory for production bundle
    outDir: path.resolve(__dirname, '../server/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4242',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4242',
        ws: true,
      },
    },
  },
});
