import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The heavy tests run whole engine runs (up to 23 Myr) and take 5 to 7 s on a shared CI runner,
    // so vitest's default 5 s is too short there. 30 s is a safety net, not a speed gate (D16.4).
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['spikes/**', '**/.worktrees/**', 'dist/**', 'node_modules/**'],
  },
})
