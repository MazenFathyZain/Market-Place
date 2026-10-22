import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    port: 5188,
    strictPort: true,
    proxy: {
      '/api': process.env.API_TARGET || 'http://localhost:4000',
      '/uploads': process.env.API_TARGET || 'http://localhost:4000',
    },
  },
});
