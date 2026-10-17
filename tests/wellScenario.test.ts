// M4.1: the planned well is part of the scenario file (one well for all branches), and old files open unchanged.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildScenarioFile, compareHashes, parseScenario, serializeScenario, type ScenarioFile } from '../src/app/scenarioFile'
import { AppStore, type ClientLike } from '../src/app/store'
import type { WellDefinition } from '../src/engine/well'
import { defaultWellPressureParams } from '../src/engine/wellPressureParams'
import { EngineHost } from '../src/worker/handler'
import type { EngineResponse } from '../src/worker/protocol'
import { replayScenario } from '../src/worker/scenarioReplay'
import { TimeMachine } from '../src/worker/timeMachine'

const FIXTURE = readFileSync('tests/fixtures/scenario-v1.strata.json', 'utf8')
const WELL: WellDefinition = { xKm: 70, airGapFt: 80, kickoffFt: 9000, buildRateDegPer100Ft: 2.5, holdInclinationDeg: 35, direction: 'landward', totalDepthFt: 20000 }

function parsed(text: string): ScenarioFile {
  const p = parseScenario(text)
  if (!p.ok) throw new Error(p.message)
  return p.file
}

describe('the well in the scenario file', () => {
  it('an old file (committed fixture, no well) opens with no well and is written back byte for byte the same', () => {
    const f = parsed(FIXTURE)
    expect('well' in f).toBe(false)
    expect(serializeScenario(f)).toBe(FIXTURE.replace(/\r\n/g, '\n')) // parse then serialise changes nothing
  })

  it('a file with a well round-trips it, and the well does not change any hash of the run', () => {
    const f = { ...parsed(FIXTURE), well: WELL }
    const again = parsed(serializeScenario(f))
    expect(again.well).toEqual(WELL)
    const r = replayScenario(new TimeMachine(), again)
    const base = replayScenario(new TimeMachine(), parsed(FIXTURE))
    expect(r.hashes).toEqual(base.hashes) // the well is not an engine input
    expect(compareHashes(again, r.hashes, { nx: r.info.nx, dx: r.info.dx }, r.summaries).same).toBe(true)
  })

  it('buildScenarioFile leaves the key out without a well and puts it in with one', () => {
    const f = parsed(FIXTURE)
    const src = {
      presetId: f.run.presetId, seed: f.run.seed, nx: f.run.grid.nx, dx: f.run.grid.dx, segments: f.run.segments, overrides: f.run.overrides,
      branches: f.branches.map((b) => ({ id: b.id, parentId: b.parent, forkStep: b.startStep, label: b.name, edits: b.edits })),
    }
    expect('well' in buildScenarioFile(src)).toBe(false)
    expect('well' in buildScenarioFile({ ...src, well: null })).toBe(false)
    expect(buildScenarioFile({ ...src, well: WELL }).well).toEqual(WELL)
  })

  it('a damaged or impossible well is refused in plain words', () => {
    const f = JSON.parse(FIXTURE) as Record<string, unknown>
    const bad = (w: unknown): string => {
      const r = parseScenario(JSON.stringify({ ...f, well: w }))
      return r.ok ? 'OK' : r.message
    }
    expect(bad(WELL)).toBe('OK')
    expect(bad('a well')).toMatch(/planned well/)
    expect(bad({ ...WELL, xKm: 'far' })).toMatch(/planned well/)
    expect(bad({ ...WELL, direction: 'up' })).toMatch(/planned well/)
    expect(bad({ ...WELL, holdInclinationDeg: 120 })).toMatch(/hold inclination/)
  })
})

describe('the well in the app store', () => {
  function makeStore() {
    const host = new EngineHost()
    let n = 0
    const client: ClientLike = {
      request: (req, onProgress) => {
        host.setEmitter((r: EngineResponse) => {
          if (r.kind === 'progress') onProgress?.(r)
        })
        return Promise.resolve(host.handle({ ...req, id: ++n }))
      },
    }
    const downloads: string[] = []
    const store = new AppStore({ client, storage: null, download: (_name, text) => void downloads.push(text), now: () => new Date('2026-10-16T12:00:00Z') })
    return { store, downloads }
  }

  it('is saved with the scenario, restored on open, and an old file clears it', async () => {
    const { store, downloads } = makeStore()
    expect(store.getState().wellPlan).toBeNull()
    expect(await store.openText(serializeScenario({ ...parsed(FIXTURE), well: WELL }))).toBe(true)
    expect(store.getState().wellPlan).toEqual(WELL)
    expect(await store.saveFile()).toBe(true)
    expect(parsed(downloads[0]).well).toEqual(WELL)
    store.setWellPlan({ ...WELL, totalDepthFt: 22000 })
    expect(store.getState().wellPlan!.totalDepthFt).toBe(22000)
    expect(await store.openText(FIXTURE)).toBe(true)
    expect(store.getState().wellPlan).toBeNull()
  }, 60000)
})

describe('the pressure settings in the scenario file', () => {
  const PRESSURE = { ...defaultWellPressureParams(), fgMethod: 'matthews-kelly' as const, upperMarginPpg: 0.3 }

  it('round-trip with the well, and an old file or a well-only file opens with the defaults', () => {
    const again = parsed(serializeScenario({ ...parsed(FIXTURE), well: WELL, wellPressure: PRESSURE }))
    expect(again.wellPressure).toEqual(PRESSURE)
    expect('wellPressure' in parsed(FIXTURE)).toBe(false)
    expect(parsed(serializeScenario({ ...parsed(FIXTURE), well: WELL })).wellPressure).toBeUndefined()
    const r = replayScenario(new TimeMachine(), again)
    expect(r.hashes).toEqual(replayScenario(new TimeMachine(), parsed(FIXTURE)).hashes) // not an engine input
  })

  it('a damaged value is refused', () => {
    const f = JSON.parse(serializeScenario({ ...parsed(FIXTURE), well: WELL, wellPressure: PRESSURE })) as Record<string, unknown>
    expect(parseScenario(JSON.stringify({ ...f, wellPressure: { ...PRESSURE, fgMethod: 'guess' } })).ok).toBe(false)
    expect(parseScenario(JSON.stringify({ ...f, wellPressure: { ...PRESSURE, poissonRatio: 5 } })).ok).toBe(false)
  })

  it('the store saves, restores and resets them', async () => {
    const host = new EngineHost()
    let n = 0
    const client: ClientLike = {
      request: (req, onProgress) => {
        host.setEmitter((r: EngineResponse) => {
          if (r.kind === 'progress') onProgress?.(r)
        })
        return Promise.resolve(host.handle({ ...req, id: ++n }))
      },
    }
    const downloads: string[] = []
    const store = new AppStore({ client, storage: null, download: (_name, text) => void downloads.push(text), now: () => new Date('2026-10-16T12:00:00Z') })
    expect(await store.openText(serializeScenario({ ...parsed(FIXTURE), well: WELL, wellPressure: PRESSURE }))).toBe(true)
    expect(store.getState().wellPressure).toEqual(PRESSURE)
    expect(await store.saveFile()).toBe(true)
    expect(parsed(downloads[0]).wellPressure).toEqual(PRESSURE)
    expect(await store.openText(FIXTURE)).toBe(true)
    expect(store.getState().wellPressure).toEqual(defaultWellPressureParams())
  }, 60000)
})
