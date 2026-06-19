import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: [
      'src/**/*.{test,spec}.ts',
      'src/**/__tests__/**/*.{test,spec}.ts',
      'scripts/**/__tests__/**/*.{test,spec}.ts',
    ],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // Pin the host zone so Intl.DateTimeFormat output is deterministic in
      // the locale-sensitive tests under src/shared/time/__tests__.
      TZ: 'America/Argentina/Buenos_Aires',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
