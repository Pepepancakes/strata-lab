import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['spikes/**', '**/.worktrees/**', 'dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // The engine is pure and deterministic: no DOM, no React, no app/view code,
    // and no clock or unseeded randomness. It runs inside a Web Worker.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'HTMLElement', 'navigator', 'localStorage', 'requestAnimationFrame'].map((name) => ({
          name,
          message: 'src/engine must not touch the DOM (it runs in a worker).',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react-dom/*', 'react/*'], message: 'No React in src/engine.' },
            { group: ['**/app', '**/app/**', '**/views', '**/views/**'], message: 'src/engine must not import app or view code.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine must be deterministic: no unseeded randomness.' },
        { object: 'Date', property: 'now', message: 'Engine must be deterministic: no clock reads.' },
        { object: 'performance', property: 'now', message: 'Engine must be deterministic: no clock reads.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.{mjs,ts}', '*.config.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
)
