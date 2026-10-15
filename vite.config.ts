import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { renameSync, existsSync } from 'node:fs'

// Source code imports the worker as a normal module worker (`./engine.worker?worker`).
// That is what `npm run dev` and any future hosted build use.
// The ONE-FILE build is handled only here: this plugin rewrites `?worker` to `?worker&inline`
// so the worker code is embedded in the HTML as a Blob URL. src/ has no file:// assumptions.
// For a normal multi-file build later, run with STRATA_SINGLE_FILE=0 (outputs dist/index.html + assets).
const singleFile = process.env.STRATA_SINGLE_FILE !== '0'

function inlineWorkers(): Plugin {
  return {
    name: 'strata-inline-workers',
    apply: 'build',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('?worker')) return null
      return this.resolve(source + '&inline', importer, { ...options, skipSelf: true })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    ...(singleFile
      ? [
          inlineWorkers(),
          viteSingleFile(),
          {
            name: 'rename-to-strata-lab-html',
            apply: 'build' as const,
            closeBundle() {
              if (existsSync('dist/index.html')) renameSync('dist/index.html', 'dist/strata-lab.html')
            },
          },
        ]
      : []),
  ],
  // A Blob-URL *module* worker is refused from file:// (opaque origin), so the one-file build
  // bundles the worker as a classic (iife) script. Dev and multi-file builds keep module workers.
  worker: { format: singleFile ? 'iife' : 'es' },
  build: { target: 'es2022' },
})
