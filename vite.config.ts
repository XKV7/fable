import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, host: true, hmr: process.env.NOHMR ? false : undefined, watch: process.env.NOHMR ? null : undefined },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
