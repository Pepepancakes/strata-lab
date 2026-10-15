// The scenario store (M1.7): save, open, a refused file, autosave and restore, and the replace warning.
// The store talks to a fake client that calls the engine host directly (no Worker), and to an
// in-memory storage, so no browser is needed.
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { Autosave, AUTOSAVE_KEY, type KeyValueStorage, type TimerApi } from '../src/app/autosave'
import { ReplaceGuard } from '../src/app/replaceGuard'
import { parseScenario } from '../src/app/scenarioFile'
import { AppStore, type ClientLike } from '../src/app/store'
import { EngineHost } from '../src/worker/handler'
import type { EngineResponse } from '../src/worker/protocol'

const FIXTURE = readFileSync('tests/fixtures/scenario-v1.strata.json', 'utf8')

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}

function fakeClient(): ClientLike {
  const host = new EngineHost()
  let n = 0
  return {
    request: (req, onProgress) => {
      host.setEmitter((r: EngineResponse) => {
        if (r.kind === 'progress') onProgress?.(r)
      })
      return Promise.resolve(host.handle({ ...req, id: ++n }))
    },
  }
}

function makeStore(storage: KeyValueStorage | null = new MemoryStorage()) {
  const downloads: { name: string; text: string }[] = []
  const store = new AppStore({
    client: fakeClient(), storage, download: (name, text) => void downloads.push({ name, text }),
    now: () => new Date('2026-10-14T23:30:00Z'),
  })
  return { store, downloads, storage }
}

const settle = () => new Promise((r) => setTimeout(r, 30))
async function until(cond: () => boolean, ms = 20000): Promise<void> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('Autosave', () => {
  function fakeTimers() {
    const queue: { fn: () => void; ms: number; id: number }[] = []
    let id = 0
    const api: TimerApi = {
      set: (fn, ms) => { queue.push({ fn, ms, id: ++id }); return id },
      clear: (h) => { const i = queue.findIndex((q) => q.id === h); if (i >= 0) queue.splice(i, 1) },
    }
    return { api, queue }
  }

  it('debounces: many changes make one write, after the delay', () => {
    const st = new MemoryStorage()
    const { api, queue } = fakeTimers()
    const a = new Autosave(st, api, 800)
    let text = 'one'
    a.schedule(() => ({ text, dirty: true }))
    text = 'two'
    a.schedule(() => ({ text, dirty: true }))
    expect(queue.length).toBe(1)
    expect(queue[0].ms).toBe(800)
    expect(st.data.size).toBe(0) // nothing written yet
    queue[0].fn()
    expect(JSON.parse(st.data.get(AUTOSAVE_KEY)!).scenario).toBe('two')
  })

  it('restores what was saved, with the unsaved flag', () => {
    const st = new MemoryStorage()
    const a = new Autosave(st)
    a.schedule(() => ({ text: FIXTURE, dirty: true }))
    a.flush()
    const back = new Autosave(st).load()
    expect(back?.dirty).toBe(true)
    expect(back?.file.branches.length).toBe(3)
  })

  it('shows nothing (the default scenario) when there is no autosave, or it is damaged', () => {
    const st = new MemoryStorage()
    expect(new Autosave(st).load()).toBeNull()
    st.setItem(AUTOSAVE_KEY, 'not json')
    expect(new Autosave(st).load()).toBeNull()
    st.setItem(AUTOSAVE_KEY, JSON.stringify({ v: 1, dirty: false, scenario: '{"format":"x"}' }))
    expect(new Autosave(st).load()).toBeNull()
    expect(new Autosave(null).load()).toBeNull()
  })

  it('reports a full or blocked storage instead of failing silently', () => {
    const st = new MemoryStorage()
    st.setItem = () => { throw new Error('quota') }
    const a = new Autosave(st)
    a.schedule(() => ({ text: FIXTURE, dirty: false }))
    a.flush()
    expect(a.lastError).toMatch(/Autosave could not write/)
  })
})

describe('ReplaceGuard', () => {
  it('runs at once when nothing is unsaved', () => {
    const g = new ReplaceGuard()
    const act = vi.fn()
    expect(g.request('Open a file', act)).toBe(true)
    expect(act).toHaveBeenCalledTimes(1)
    expect(g.pending).toBeNull()
  })

  it('warns, and runs only after Replace', () => {
    const g = new ReplaceGuard()
    g.setDirty(true)
    const act = vi.fn()
    expect(g.request('Open a file', act)).toBe(false)
    expect(g.pending).toEqual({ what: 'Open a file' })
    expect(act).not.toHaveBeenCalled()
    g.confirm()
    expect(act).toHaveBeenCalledTimes(1)
    expect(g.pending).toBeNull()
  })

  it('Cancel keeps the work and drops the action', () => {
    const g = new ReplaceGuard()
    g.setDirty(true)
    const act = vi.fn()
    g.request('Start a new scenario', act)
    g.cancel()
    g.confirm()
    expect(act).not.toHaveBeenCalled()
    expect(g.isDirty).toBe(true)
  })

  it('Save first: replaces only if the save worked', async () => {
    const g = new ReplaceGuard()
    g.setDirty(true)
    const act = vi.fn()
    g.request('Open a file', act)
    await g.confirmAfterSave(() => Promise.resolve(false))
    expect(act).not.toHaveBeenCalled()
    expect(g.pending).not.toBeNull()
    await g.confirmAfterSave(() => Promise.resolve(true))
    expect(act).toHaveBeenCalledTimes(1)
  })
})

describe('AppStore scenario files', () => {
  it('first start with no autosave shows the default scenario', async () => {
    const { store } = makeStore()
    store.init()
    await until(() => store.getState().ready)
    const s = store.getState()
    expect(s.presetId).toBe('last3')
    expect(s.branches.length).toBe(1)
    expect(s.info?.nSteps).toBe(600)
    expect(s.dirty).toBe(false)
    await settle()
  }, 60000)

  it('opens a v1 file, then saves a file whose hashes match (round trip through the app)', async () => {
    const a = makeStore()
    expect(await a.store.openText(FIXTURE)).toBe(true)
    let s = a.store.getState()
    expect(s.branches.map((b) => b.label)).toEqual(['Main run', 'More supply', 'Sandier'])
    expect(s.notice).toBeNull()
    expect(s.dirty).toBe(false)
    expect(s.params['b3'].supply).toBe(30) // edits chain down the tree
    expect(s.params['b3'].sandFrac).toBe(0.5)
    expect(await a.store.saveFile()).toBe(true)
    expect(a.downloads.length).toBe(1)
    expect(a.downloads[0].name).toBe('strata-last3-20261014-2330.strata.json')
    const saved = parseScenario(a.downloads[0].text)
    const orig = parseScenario(FIXTURE)
    if (!saved.ok || !orig.ok) throw new Error('parse')
    expect(saved.file.branches.map((b) => b.stateHash)).toEqual(orig.file.branches.map((b) => b.stateHash))
    await settle()

    // and a second app opens that saved file
    const b = makeStore()
    expect(await b.store.openText(a.downloads[0].text)).toBe(true)
    s = b.store.getState()
    expect(s.notice).toBeNull()
    expect(s.branches.length).toBe(3)
    await settle()
  })

  it('warns when the file hashes differ from the recomputed ones', async () => {
    const a = makeStore()
    const tampered = FIXTURE.replace('4ae5129e360641df', '0000000000000000')
    expect(await a.store.openText(tampered)).toBe(true)
    expect(a.store.getState().notice).toMatch(/different engine version; results differ/)
    await settle()
  })

  it('refuses a malformed file and leaves the current work exactly as it was', async () => {
    const a = makeStore()
    await a.store.openText(FIXTURE)
    await settle()
    const before = a.store.getState()
    expect(await a.store.openText('{ this is not a scenario')).toBe(false)
    const after = a.store.getState()
    expect(after.error).toMatch(/not a usable Strata Lab scenario file/)
    expect(after.info).toBe(before.info)
    expect(after.branches).toBe(before.branches)
    expect(after.params).toBe(before.params)
    expect(after.segments).toBe(before.segments)
    expect(after.activeId).toBe(before.activeId)
    expect(after.busy).toBeNull()
  })

  it('autosaves a change and restores it on the next start', async () => {
    const st = new MemoryStorage()
    const a = makeStore(st)
    await a.store.openText(FIXTURE)
    a.store.goto(30)
    await a.store.branchHere() // a fourth branch, from step 30
    await settle()
    expect(a.store.getState().branches.length).toBe(4)
    expect(a.store.getState().dirty).toBe(true)
    a.store.flushAutosave() // what happens when the page is hidden

    const b = makeStore(st)
    b.store.init()
    await until(() => b.store.getState().ready)
    const s = b.store.getState()
    expect(s.branches.length).toBe(4)
    expect(s.branches[3].forkStep).toBe(30)
    expect(s.dirty).toBe(true) // still not saved to a file
    expect(s.info?.nSteps).toBe(100)
    await settle()
  })

  it('shows the replace warning before Open, New or Reset replaces unsaved work', async () => {
    const a = makeStore()
    await a.store.openText(FIXTURE)
    await settle()
    const pick = vi.fn()
    a.store.requestOpen(pick)
    expect(pick).toHaveBeenCalledTimes(1) // nothing unsaved: no warning
    expect(a.store.getState().pendingReplace).toBeNull()

    a.store.goto(30)
    await a.store.branchHere()
    await settle()
    expect(a.store.getState().dirty).toBe(true)

    a.store.requestOpen(pick)
    expect(pick).toHaveBeenCalledTimes(1) // held back
    expect(a.store.getState().pendingReplace?.what).toBe('Open a file')
    a.store.cancelReplace()
    expect(a.store.getState().pendingReplace).toBeNull()
    expect(a.store.getState().branches.length).toBe(4) // work untouched

    a.store.requestNew()
    expect(a.store.getState().pendingReplace?.what).toBe('Start a new scenario')
    a.store.cancelReplace()
    a.store.requestReset()
    expect(a.store.getState().pendingReplace?.what).toBe('Reset the controls')
    a.store.cancelReplace()

    a.store.requestOpen(pick)
    a.store.confirmReplace()
    expect(pick).toHaveBeenCalledTimes(2)
    await settle()
  })

  it('Save first writes the file and then goes on', async () => {
    const a = makeStore()
    await a.store.openText(FIXTURE)
    a.store.goto(30)
    await a.store.branchHere()
    await settle()
    const pick = vi.fn()
    a.store.requestOpen(pick)
    await a.store.confirmReplaceAfterSave()
    expect(a.downloads.length).toBe(1)
    expect(pick).toHaveBeenCalledTimes(1)
    expect(a.store.getState().dirty).toBe(false)
    expect(parseScenario(a.downloads[0].text)).toMatchObject({ ok: true })
    await settle()
  })
})
