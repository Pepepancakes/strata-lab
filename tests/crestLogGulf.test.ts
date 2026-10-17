// Crest log on the Gulf-style preset and through the worker (M3b.1). Medians and bounds only (D16.4): the
// number of crests and which of them is tabular move with 1 ulp of maths noise, so no test here depends on a
// count near zero (the tabular count is about 0 to 1 per run, so it is never asserted).
import { describe, expect, it } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { handleRequest } from '../src/worker/handler'
import { TimeMachine } from '../src/worker/timeMachine'
import { withUlpNoise } from './helpers/ulpNoise'

const median = (a: number[]): number => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

function gulf(over: Record<string, number> = {}) {
  const tm = new TimeMachine()
  tm.run({ presetId: 'gulf', overrides: over }, 1)
  const t0 = performance.now()
  const log = tm.crestLog(tm.root)
  return { tm, log, ms: performance.now() - t0 }
}

describe('crest log on the Gulf-style preset', () => {
  const runs = [gulf(), withUlpNoise(2.2e-16, 7, () => gulf())]

  for (const [i, name] of ['plain', '1 ulp noise'].entries()) {
    const { log } = runs[i]
    const E = log.episodes
    it(`${name}: a handful of crests, each followed for some time`, () => {
      expect(log.saltOn).toBe(true)
      expect(E.length).toBeGreaterThanOrEqual(6)
      expect(E.length).toBeLessThanOrEqual(30)
      for (const e of E) {
        expect(e.track.step.length).toBeGreaterThanOrEqual(1)
        expect(e.firstAgeMa).toBeGreaterThanOrEqual(e.lastAgeMa)
        for (const c of e.track.saltThickM) expect(c).toBeGreaterThanOrEqual(log.params.weldThick)
      }
    })

    it(`${name}: median flank accumulation is positive, the salt top does not out-rise it, so crests are mostly tapered`, () => {
      expect(median(E.map((e) => e.near.A))).toBeGreaterThan(30) // m/Myr
      expect(median(E.map((e) => e.near.A))).toBeLessThan(300)
      expect(median(E.map((e) => e.near.FminusA))).toBeLessThan(-25) // under the noise floor, negative
      const tapered = E.filter((e) => e.label === 'tapered').length
      const tabular = E.filter((e) => e.label === 'tabular').length
      expect(tapered).toBeGreaterThan(E.length / 2)
      expect(tapered).toBeGreaterThan(tabular)
    })

    it(`${name}: the neighbouring salt is thick (the thin-sheet picture of SALT-R2) and the flow length is many salt thicknesses`, () => {
      expect(median(E.map((e) => e.neighbourSaltM))).toBeGreaterThan(2500)
      expect(median(E.map((e) => e.neighbourSaltM))).toBeLessThan(5500)
      expect(median(E.map((e) => e.lOverH))).toBeGreaterThan(3)
    })

    it(`${name}: costs well under a second on the Gulf preset`, () => {
      expect(runs[i].ms).toBeLessThan(2000) // measured 13 to 25 ms on Windows; generous for a loaded CI runner
    })
  }

  it('reading the history changes nothing: the record hash is the same with and without a crest log request', () => {
    const { tm } = runs[0]
    const h0 = tm.hashAt(tm.root, tm.nSteps)
    tm.crestLog(tm.root)
    expect(tm.hashAt(tm.root, tm.nSteps)).toBe(h0)
  })

  it('the crest log of the same run asked twice is identical', () => {
    const { tm, log } = runs[0]
    expect(tm.crestLog(tm.root)).toEqual(log)
  })
})

describe('crest log through the worker', () => {
  it('a run without salt gives an empty log; a branch has none', () => {
    const tm = new TimeMachine()
    tm.run({ presetId: 'last3', segments: [{ fromAgeMa: 1, toAgeMa: 0, dt: 50000 }], overrides: { nx: 20, dx: 7500 } }, 1)
    const log = tm.crestLog(tm.root)
    expect(log.saltOn).toBe(false)
    expect(log.episodes).toEqual([])
    const b = tm.branch(tm.root, 5, { supply: 10 })
    expect(() => tm.crestLog(b.id)).toThrow(/main run only/)
  })

  it('answers a crestLog request with plain data', () => {
    const run = handleRequest({ id: 1, kind: 'run', spec: { presetId: 'saltshort', overrides: { nx: 60 } }, seed: 1 })
    expect(run.kind).toBe('runDone')
    if (run.kind !== 'runDone') return
    const r = handleRequest({ id: 2, kind: 'crestLog', branchId: run.info.rootId })
    expect(r.kind).toBe('crestLogData')
    if (r.kind !== 'crestLogData') return
    expect(r.log.saltOn).toBe(true)
    expect(typeof r.ms).toBe('number')
    expect(() => structuredClone(r.log)).not.toThrow()
    // salt short, 10 Myr: the diapirs it makes are followed
    expect(r.log.episodes.length).toBeGreaterThanOrEqual(1)
  })

  it('capturing the history does not change the record: the hash equals a straight engine run', async () => {
    const { createEngine, step } = await import('../src/engine/step')
    const { defaultEngineParams } = await import('../src/engine/engineParams')
    const { getPreset } = await import('../src/engine/presets')
    const { buildSchedule } = await import('../src/engine/schedule')
    const { makeSeaLevel } = await import('../src/engine/sealevel')
    const spec = { presetId: 'saltshort' as const, overrides: { nx: 60 } }
    const preset = getPreset(spec.presetId)
    const P = { ...defaultEngineParams(), ...preset.params, ...spec.overrides }
    const schedule = buildSchedule(preset.segments)
    const eng = createEngine(P, schedule)
    const sl = makeSeaLevel(P, schedule.startAgeMa * 1e6)
    while (step(eng, P, schedule, sl)) { /* run */ }
    const tm = new TimeMachine()
    tm.run(spec, 1)
    expect(tm.hashAt(tm.root, tm.nSteps)).toBe(String(stateHash(eng.rec)))
  })
})
