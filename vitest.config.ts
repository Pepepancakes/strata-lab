import { defineConfig } from 'vitest/config'

// Files that hold a wall-clock gate (it.skipIf(!!process.env.CI) 'runs in under N s'). They run in their
// own project, one file at a time, AFTER the main project has finished (package.json: test:gated, which
// `npm run check` uses): two projects in one vitest run do not wait for each other, so a serial project
// alone would not stop the heavy salt files from loading the machine while a gate is timing (M3.9
// finding 9). Every one of these files passes alone. Add a file here if it gains a wall-clock gate.
const WALL_CLOCK = [
  'tests/run.test.ts',
  'tests/longruns.test.ts',
  'tests/coverBending.test.ts',
  'tests/m28views.test.ts',
  'tests/gulfPreset.test.ts',
  'tests/wellTiming.test.ts',
]
const INCLUDE = ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}']
const EXCLUDE = ['spikes/**', '**/.worktrees/**', 'dist/**', 'node_modules/**']

export default defineConfig({
  test: {
    environment: 'node',
    // The heavy tests run whole engine runs (up to 23 Myr) and take 5 to 7 s on a shared CI runner,
    // so vitest's default 5 s is too short there. 30 s is a safety net, not a speed gate (D16.4).
    testTimeout: 30000,
    hookTimeout: 60000,
    projects: [
      { extends: true, test: { name: 'main', include: INCLUDE, exclude: [...EXCLUDE, ...WALL_CLOCK] } },
      { extends: true, test: { name: 'wallclock', include: WALL_CLOCK, exclude: EXCLUDE, fileParallelism: false } },
    ],
  },
})
