import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Aturan bisnis wajib tertutup penuh. UI sengaja tidak dipaksa 100%
      // karena lapisan itu memang dirancang untuk diganti template.
      include: ['src/server/**/*.ts'],
      exclude: ['src/server/**/*.test.ts', 'src/server/**/index.ts'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
})
