import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['spikes/**', '**/.worktrees/**', 'dist/**', 'node_modules/**'],
  },
})
