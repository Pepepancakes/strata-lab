// AUD-5: the "Deep compaction: fast (bundled) / full accuracy (slower)" switch. The pure helpers, the panel rendered
// without a browser, the store (sets and restores the parameter, scenario save -> open round trip) and the AUD-1
// well-plot note that goes away with full accuracy.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppStore, type AppState, type ClientLike } from '../src/app/store'
import { parseScenario } from '../src/app/scenarioFile'
import { presetParams, PRESETS, type PresetId } from '../src/engine/presets'
import { EngineHost } from '../src/worker/handler'
import type { EngineResponse } from '../src/worker/protocol'
import { DeepCompactionSwitch } from '../src/views/controls'
import { accuracyMode, costText, RUN_TIMES, withAccuracy } from '../src/views/controls/accuracy'
import { bundlingNote } from '../src/views/well/audit'
import { exportNotes } from '../src/views/well/notes'

function stateFor(presetId: PresetId, edit: Record<string, unknown> = {}, branch = false): AppState {
  const params = { ...presetParams(presetId), ...edit }
  return {
    presetId, activeId: branch ? 'b2' : 'main', busy: null,
    branches: branch
      ? [{ id: 'main', parentId: null, label: 'Main run' }, { id: 'b2', parentId: 'main', label: 'Branch' }]
      : [{ id: 'main', parentId: null, label: 'Main run' }],
    params: { main: params, b2: params },
  } as unknown as AppState
}
const render = (s: AppState) => renderToStaticMarkup(createElement(DeepCompactionSwitch, { state: s }))

describe('accuracy helpers', () => {
  it('reads the mode from the preset and the run', () => {
    expect(accuracyMode(20, 20)).toBe('fast')
    expect(accuracyMode(20, 1)).toBe('full')
    expect(accuracyMode(1, 1)).toBe('not-bundled')
    expect(accuracyMode(1, 10)).toBe('not-bundled') // a preset that never bundled: nothing to switch
  })

  it('full sets bundleEvery = 1 and fast removes the override, leaving other overrides alone', () => {
    const start = { supply: 25 }
    const full = withAccuracy(start, true)
    expect(full).toEqual({ supply: 25, bundleEvery: 1 })
    expect(start).toEqual({ supply: 25 }) // not changed in place
    expect(withAccuracy(full, false)).toEqual({ supply: 25 })
  })

  it('has a measured time for every preset that bundles', () => {
    for (const p of PRESETS) {
      if (presetParams(p.id).bundleEvery > 1) {
        expect(RUN_TIMES[p.id], p.id).toBeDefined()
        expect(RUN_TIMES[p.id]!.fullS).toBeGreaterThan(RUN_TIMES[p.id]!.fastS)
        expect(costText(p.id)).toMatch(/about \d+ s fast, about \d+ s full accuracy/)
      }
    }
  })
})

describe('the switch in the Scenario block', () => {
  it('shows fast selected on a bundled preset, with the measured time', () => {
    const html = render(stateFor('gulf'))
    expect(html).toContain('data-testid="deep-compaction"')
    expect(html).toMatch(/aria-label="Deep compaction: fast \(bundled\)"[^>]*checked=""|checked=""[^>]*aria-label="Deep compaction: fast \(bundled\)"/)
    expect(html).toContain('Full accuracy (slower)')
    expect(html).toContain(costText('gulf'))
  })

  it('shows full accuracy selected when bundleEvery is 1 on a bundled preset', () => {
    const html = render(stateFor('gulf', { bundleEvery: 1 }))
    expect(html).toMatch(/checked=""[^>]*aria-label="Deep compaction: full accuracy|aria-label="Deep compaction: full accuracy[^>]*checked=""/)
    expect(html).not.toMatch(/checked=""[^>]*aria-label="Deep compaction: fast/)
  })

  it('says there is nothing to switch on a preset that does not bundle', () => {
    const html = render(stateFor('last3'))
    expect(html).toContain('already solves deep compaction in full')
    expect(html).not.toContain('Fast (bundled)')
  })

  it('locks the switch on a branch', () => {
    const html = render(stateFor('gulf', {}, true))
    expect(html).toContain('a branch cannot change it')
    expect(html).toMatch(/<input type="radio"[^>]*disabled=""/)
  })
})

describe('the AUD-1 well-plot note with full accuracy', () => {
  it('is there for the bundled run and gone for full accuracy (and for the notes in the PNG and CSV)', () => {
    const segments = [...PRESETS.find((p) => p.id === 'gulf')!.segments]
    expect(bundlingNote({ presetId: 'gulf', bundleEvery: 20, edited: false })).toMatch(/Bundled deep compaction/)
    expect(bundlingNote({ presetId: 'gulf', bundleEvery: 1, edited: true })).toBeNull()
    expect(exportNotes({ presetId: 'gulf', overrides: {}, segments }).join(' ')).toMatch(/Bundled deep compaction/)
    expect(exportNotes({ presetId: 'gulf', overrides: { bundleEvery: 1 }, segments }).join(' ')).not.toMatch(/Bundled deep compaction/)
    // and the note points at this switch rather than at the raw parameter
    expect(bundlingNote({ presetId: 'gulf', bundleEvery: 20, edited: false })).toMatch(/Full accuracy/)
    expect(bundlingNote({ presetId: 'gulf', bundleEvery: 5, edited: true })).toMatch(/Full accuracy/)
  })
})

// ---- the store, with the engine host behind a fake client (no Worker) ----------------------------------------

function fakeClient(): ClientLike {
  const host = new EngineHost()
  let n = 0
  return {
    request: (req, onProgress) => {
      host.setEmitter((r: EngineResponse) => { if (r.kind === 'progress') onProgress?.(r) })
      return Promise.resolve(host.handle({ ...req, id: ++n }))
    },
  }
}
function makeStore() {
  const downloads: { name: string; text: string }[] = []
  const store = new AppStore({ client: fakeClient(), storage: null, download: (name, text) => void downloads.push({ name, text }), now: () => new Date('2026-10-17T12:00:00Z') })
  return { store, downloads }
}
async function until(cond: () => boolean, ms = 60000): Promise<void> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 10))
  }
}
const idle = (s: AppStore) => until(() => !s.getState().busy && s.getState().ready)

describe('AppStore.setDeepCompaction', () => {
  it('sets bundleEvery = 1, restores the preset value, and the scenario file round-trips both', async () => {
    const a = makeStore()
    a.store.init()
    await idle(a.store)
    a.store.setPreset('miocene')
    await until(() => a.store.getState().presetId === 'miocene')
    await idle(a.store)
    a.store.setRunLength(0.5) // a short run keeps the test quick; the switch does not depend on the length
    await new Promise((r) => setTimeout(r, 20))
    await idle(a.store)
    const active = () => a.store.getState().params[a.store.getState().activeId]
    expect(active().bundleEvery).toBe(10)

    await a.store.setDeepCompaction(true)
    await idle(a.store)
    expect(a.store.getState().overrides.bundleEvery).toBe(1)
    expect(active().bundleEvery).toBe(1)

    // save -> open in a second app: the override travels in the file and the run is full accuracy there too
    expect(await a.store.saveFile()).toBe(true)
    const parsed = parseScenario(a.downloads[0].text)
    if (!parsed.ok) throw new Error('parse')
    expect(parsed.file.run.overrides.bundleEvery).toBe(1)
    const b = makeStore()
    expect(await b.store.openText(a.downloads[0].text)).toBe(true)
    expect(b.store.getState().notice).toBeNull()
    expect(b.store.getState().overrides.bundleEvery).toBe(1)
    expect(b.store.getState().params[b.store.getState().activeId].bundleEvery).toBe(1)

    // fast restores the preset's own value and removes the override (the file then has none)
    await a.store.setDeepCompaction(false)
    await idle(a.store)
    expect('bundleEvery' in a.store.getState().overrides).toBe(false)
    expect(active().bundleEvery).toBe(10)
    expect(await a.store.saveFile()).toBe(true)
    const back = parseScenario(a.downloads[1].text)
    if (!back.ok) throw new Error('parse')
    expect('bundleEvery' in back.file.run.overrides).toBe(false)
  }, 120000)
})
