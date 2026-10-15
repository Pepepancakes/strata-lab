import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

const eslint = new ESLint()

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath })
  return res.messages.map((m) => m.ruleId ?? 'parse-error')
}
const ENGINE = 'src/engine/fixture.ts'

describe('engine purity lint rules', () => {
  it('bans DOM globals', async () => {
    for (const code of [
      'export const a = window.innerWidth',
      'export const b = document.title',
      'export const c = (x: unknown) => x instanceof HTMLElement',
    ]) {
      expect(await ruleIds(code, ENGINE), code).toContain('no-restricted-globals')
    }
  })
  it('bans react and app/view imports', async () => {
    for (const code of [
      "import { useState } from 'react'\nexport const a = useState",
      "import ReactDOM from 'react-dom/client'\nexport const a = ReactDOM",
      "import { App } from '../app/App'\nexport const a = App",
      "import v from '../views/registry'\nexport const a = v",
    ]) {
      expect(await ruleIds(code, ENGINE), code).toContain('no-restricted-imports')
    }
  })
  it('bans Math.random, Date.now, performance.now', async () => {
    for (const code of ['export const a = Math.random()', 'export const b = Date.now()', 'export const c = performance.now()']) {
      expect(await ruleIds(code, ENGINE), code).toContain('no-restricted-properties')
    }
  })
  it('allows pure code in the engine, and the same constructs outside it', async () => {
    expect(await ruleIds('export const a = Math.sqrt(2)', ENGINE)).toEqual([])
    expect(await ruleIds('export const a = Date.now()', 'src/app/fixture.ts')).toEqual([])
  })
}, 60000)
