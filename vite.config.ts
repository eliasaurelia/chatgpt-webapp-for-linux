import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
