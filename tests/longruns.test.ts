import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { cellBulk, setPor } from '../src/engine/compaction'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { PRESETS, getPreset, presetParams, presetSchedule } from '../src/engine/presets'
import { appendLayer, recordBalance, recordBytes } from '../src/engine/record'
import { buildSchedule, DEFAULT_SEGMENTS, type Segment } from '../src/engine/schedule'
import { bundlingOn, compactStep, createEngine, restoreEngine, snapshotEngine, step, windowBase } from '../src/engine/step'
import { mToFt } from '../src/units'
import { compareRuns, maxExcessPressure, runFull, runPreset, seaLevelOf, wellPorosity } from './helpers/run'

const MIO: Segment[] = [{ fromAgeMa: 23, toAgeMa: 3, dt: 50000 }, { fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]
const CEN: Segment[] = [{ fromAgeMa: 66, toAgeMa: 23, dt: 100000 }, ...MIO]

describe('schedules of the three presets', () => {
  it('last 3 Myr is the default schedule: 600 steps of 5 kyr', () => {
    const s = presetSchedule('last3')
    expect(s.nSteps).toBe(600)
    expect(presetParams('last3')).toEqual(defaultEngineParams())
    expect(getPreset('last3').segments).toEqual(DEFAULT_SEGMENTS)
  })
  it('Miocene: 50 kyr back to 3 Ma then 5 kyr = 400 + 600 steps, run length 23 Myr', () => {
    const s = presetSchedule('miocene')
    expect(s.nSteps).toBe(1000)
    expect(s.runLengthMa).toBe(23)
    expect(s.stepDt[0]).toBe(50000)
    expect(s.stepDt[399]).toBe(50000)
    expect(s.stepDt[400]).toBe(5000)
    expect(s.stepAgeMa[399]).toBe(3) // exact join
    expect(s.stepAgeMa[999]).toBe(0)
  })
  it('Cenozoic: 100 kyr to 23 Ma, then as the Miocene = 430 + 400 + 600 steps, run length 66 Myr', () => {
    const s = presetSchedule('cenozoic')
    expect(s.nSteps).toBe(1430)
    expect(s.runLengthMa).toBe(66)
    expect(s.stepDt[429]).toBe(100000)
    expect(s.stepDt[430]).toBe(50000)
    expect(s.stepAgeMa[429]).toBe(23)
    expect(s.tEndYr[1429]).toBe(66e6)
  })
  it('every preset has registry values inside the registry limits and its own run length', () => {
    for (const p of PRESETS) {
      const P = presetParams(p.id)
      expect(P.nx).toBeLessThanOrEqual(400)
      expect(P.duration).toBe(p.runLengthMa * 1e6)
      expect(presetSchedule(p.id).runLengthMa).toBe(p.runLengthMa)
    }
  })
})

describe('bundled deep compaction: switches and window', () => {
  it('is off by default and never on in the benchmark (linear) mode', () => {
    const P = defaultEngineParams()
    expect(bundlingOn(P)).toBe(false)
    expect(bundlingOn({ ...P, bundleEvery: 10 })).toBe(true)
    expect(bundlingOn({ ...P, bundleEvery: 10, linear: { e0: 1, C: 1e-8, k: 1e-14 } })).toBe(false)
  })
  it('window base: whole column before the first full solve, then the layers younger than bundleAgeYr', () => {
    const P = { ...defaultEngineParams(), bundleEvery: 10, bundleAgeYr: 100000 }
    const sch = buildSchedule(DEFAULT_SEGMENTS)
    expect(windowBase(sch, P, -1)).toBe(0)
    // step 9 ends at 50 kyr: everything is younger than 100 kyr
    expect(windowBase(sch, P, 9)).toBe(1)
    // step 99 ends at 500 kyr: layers deposited by steps 80..99 (ends 405..500 kyr) are the window = layers 81..100
    expect(windowBase(sch, P, 99)).toBe(81)
    // coarse steps: 100 kyr steps, window of 250 kyr = layers ending at 1.8, 1.9 and 2.0 Myr (18..20)
    const coarse = buildSchedule([{ fromAgeMa: 5, toAgeMa: 0, dt: 100000 }])
    expect(windowBase(coarse, { ...P, bundleAgeYr: 250000 }, 19)).toBe(18)
  })
})

/** Prescribed deposition, no transport: three columns with different, varying rates and sand shares. Isolates compaction. */
function prescribed(segments: Segment[], over: Partial<EngineParams>, rate = [30, 60, 120]) {
  const P = { ...defaultEngineParams(), nx: 3, ...over }
  const sch = buildSchedule(segments)
  const eng = createEngine(P, sch)
  for (let k = 0; k < sch.nSteps; k++) {
    const k1 = appendLayer(eng.rec, sch.stepDt[k], sch.stepAgeMa[k], sch.tEndYr[k])
    for (let j = 0; j < 3; j++) {
      const i = k1 * 3 + j
      const s = rate[j] * (sch.stepDt[k] / 1e6) * (1 + 0.6 * Math.sin((2 * Math.PI * k) / 80 + j)) // solid m
      const f = 0.3 + 0.25 * Math.sin(k / 23 + j)
      eng.rec.sand[i] = f * s
      eng.rec.mud[i] = (1 - f) * s
      setPor(eng, P, i, 0)
      eng.rec.H[j] += s * (f / (1 - P.phi0[0]) + (1 - f) / (1 - P.phi0[1])) // the surface rises by the new bulk, as transport does
    }
    compactStep(eng, P, sch, k, k1)
    eng.diag.stepIndex = k + 1
  }
  return { P, eng }
}

describe('bundled vs unbundled compaction on the same deposition (12 Myr, 5 kyr steps)', () => {
  const seg = [{ fromAgeMa: 12, toAgeMa: 0, dt: 5000 }]
  const off = prescribed(seg, {})
  const on = prescribed(seg, { bundleEvery: 10, bundleAgeYr: 100000 })

  it('surface H within 2 m, porosity within 0.005 at every depth of the pseudo-wells, max u within 2 %', () => {
    let dH = 0
    let dPhi = 0
    for (let j = 0; j < 3; j++) {
      dH = Math.max(dH, Math.abs(on.eng.rec.H[j] - off.eng.rec.H[j]))
      const a = wellPorosity(off.eng, off.P, j)
      const b = wellPorosity(on.eng, on.P, j)
      for (let q = 0; q < a.length; q++) if (!Number.isNaN(a[q])) dPhi = Math.max(dPhi, Math.abs(a[q] - b[q]))
    }
    const ua = maxExcessPressure(off.eng)
    const dU = Math.abs(maxExcessPressure(on.eng) - ua) / ua
    console.log(`bundling on (every 10, window 100 kyr) vs off, same deposition: H ${off.eng.rec.H[0].toFixed(0)}/${off.eng.rec.H[1].toFixed(0)}/${off.eng.rec.H[2].toFixed(0)} m, dH ${dH.toFixed(2)} m, dPhi ${dPhi.toFixed(5)}, dU ${(dU * 100).toFixed(2)} %`)
    expect(dH).toBeLessThan(2)
    expect(dPhi).toBeLessThan(0.005)
    expect(dU).toBeLessThan(0.02)
  })
  it('keeps the record intact: same layers, same solids, nothing merged or dropped', () => {
    expect(on.eng.rec.nLayers).toBe(off.eng.rec.nLayers)
    expect(Array.from(on.eng.rec.sand)).toEqual(Array.from(off.eng.rec.sand))
    expect(Array.from(on.eng.rec.mud)).toEqual(Array.from(off.eng.rec.mud))
  })
  it('bundleEvery 1 is the plain solve (bit-identical state)', () => {
    const one = prescribed([{ fromAgeMa: 1, toAgeMa: 0, dt: 5000 }], { bundleEvery: 1 })
    const none = prescribed([{ fromAgeMa: 1, toAgeMa: 0, dt: 5000 }], {})
    expect(stateHash(one.eng.rec)).toBe(stateHash(none.eng.rec))
  })
  it('long-step schedules: the same comparison on Miocene and Cenozoic schedules (reported, loose bound)', () => {
    for (const [name, s, bundle] of [['Miocene', MIO, 10], ['Cenozoic', CEN, 20]] as const) {
      const a = prescribed(s, {})
      const b = prescribed(s, { bundleEvery: bundle, bundleAgeYr: 100000 })
      let dH = 0
      let dPhi = 0
      for (let j = 0; j < 3; j++) {
        dH = Math.max(dH, Math.abs(b.eng.rec.H[j] - a.eng.rec.H[j]) / a.eng.rec.H[j])
        const pa = wellPorosity(a.eng, a.P, j)
        const pb = wellPorosity(b.eng, b.P, j)
        for (let q = 0; q < pa.length; q++) if (!Number.isNaN(pa[q])) dPhi = Math.max(dPhi, Math.abs(pa[q] - pb[q]))
      }
      const ua = maxExcessPressure(a.eng)
      const dU = Math.abs(maxExcessPressure(b.eng) - ua) / ua
      console.log(`${name} schedule, bundling every ${bundle}: relative dH ${(dH * 100).toFixed(2)} %, dPhi ${dPhi.toFixed(5)}, dU ${(dU * 100).toFixed(2)} %`)
      expect(dH).toBeLessThan(0.02)
      expect(dPhi).toBeLessThan(0.02)
      expect(dU).toBeLessThan(0.05)
    }
  })
})

describe('bundling inside the coupled engine (3 Myr, every 10, window 100 kyr)', () => {
  const run = runFull(undefined, [237, 300], { bundleEvery: 10, bundleAgeYr: 100000 })

  it('conserves mass per grain size, with no unfilled erosion', () => {
    const b = recordBalance(run.eng.rec)
    console.log(`bundled 3 Myr balance: sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}`)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(run.eng.diag.deficit).toBe(0)
  })
  it('the running surface H equals the exact sum of bulk thickness at the end', () => {
    const { rec } = run.eng
    for (let j = 0; j < rec.nx; j++) {
      let z = rec.b[j]
      for (let l = 0; l < rec.nLayers; l++) z += cellBulk(run.eng, run.P, l * rec.nx + j)
      expect(Math.abs(z - rec.H[j])).toBeLessThan(1e-6)
    }
  })
  for (const at of [237, 300]) {
    it(`rewinding to step ${at}${at === 237 ? ' (in the middle of a bundling cycle)' : ''} and replaying is bit-identical`, () => {
      const eng2 = createEngine(run.P, run.schedule)
      restoreEngine(run.snaps.get(at)!, eng2, run.P)
      const sl = seaLevelOf(run.P, run.schedule)
      while (step(eng2, run.P, run.schedule, sl)) { /* replay */ }
      expect(stateHash(eng2.rec)).toBe(stateHash(run.eng.rec))
      expect(Array.from(eng2.ld)).toEqual(Array.from(run.eng.ld))
    })
  }
  it('is deterministic', () => {
    const again = runFull(undefined, [], { bundleEvery: 10, bundleAgeYr: 100000 })
    expect(stateHash(again.eng.rec)).toBe(stateHash(run.eng.rec))
  })
})

// The coupled 12 Myr comparison takes about a minute (the unbundled run is the slow part), so it only
// runs on request: STRATA_SLOW=1 npm run test:run -- tests/longruns.test.ts
describe.skipIf(!process.env.STRATA_SLOW)('coupled 12 Myr, bundling on vs off, against the chaos floor', () => {
  it('differences are no larger than those from a 1e-7 change in supply', () => {
    const seg = [{ fromAgeMa: 12, toAgeMa: 0, dt: 5000 }]
    const wells = [10, 30, 60, 80, 100, 130]
    const off = runFull(seg)
    const noise = compareRuns(off, runFull(seg, [], { supply: 20.000002 }), wells)
    const c = compareRuns(off, runFull(seg, [], { bundleEvery: 10, bundleAgeYr: 100000 }), wells)
    console.log(`coupled 12 Myr: bundling dH ${c.dH.toFixed(2)} m, dPhi ${c.dPhi.toFixed(4)}, dU ${(c.dU * 100).toFixed(2)} %; chaos floor (supply +1e-7): dH ${noise.dH.toFixed(2)} m, dPhi ${noise.dPhi.toFixed(4)}, dU ${(noise.dU * 100).toFixed(2)} %`)
    expect(c.dU).toBeLessThan(0.02)
    expect(c.dH).toBeLessThan(3 * noise.dH)
  }, 600000)
})

describe('presets: speed, memory, balance, shelf edge', () => {
  const sizeFt = (r: ReturnType<typeof runPreset>): number => {
    // thickness of the deposited section (everything above the 200 m substrate), thickest column
    const { rec } = r.eng
    let m = 0
    for (let j = 0; j < rec.nx; j++) m = Math.max(m, rec.H[j] - rec.b[j] - cellBulk(r.eng, r.P, j))
    return mToFt(m)
  }
  const cases = [
    // Wall-clock gate, not physics. Measured 2.3 s in the built app and 3.0 to 3.1 s in a full test run
    // on the dev machine, so 3 s flaked (M1.9 review finding 3). 5 s still guards against real regressions.
    { id: 'miocene' as const, limitMs: 5000 },
    { id: 'cenozoic' as const, limitMs: 5000 },
  ]
  for (const { id, limitMs } of cases) {
    describe(id, () => {
      const r = runPreset(id, [])
      // skipped on CI: a shared runner is slower than the dev machine (D16.4). Strict locally.
      it.skipIf(!!process.env.CI)(`runs in under ${limitMs / 1000} s`, () => {
        console.log(`${id}: ${r.schedule.nSteps} steps, ${r.P.nx} columns, ${r.ms.toFixed(0)} ms`)
        expect(r.ms).toBeLessThan(limitMs)
      })
      it('conserves mass per grain size and has no unfilled erosion', () => {
        const b = recordBalance(r.eng.rec)
        console.log(`${id} balance: sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}, salt ${b.salt.error}`)
        expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
        expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
        expect(b.salt.error).toBe(0)
        expect(r.eng.diag.deficit).toBe(0)
      })
      it('keeps the shelf edge and the shoreline inside the section for the whole run', () => {
        const lengthKm = (r.P.nx * r.P.dx) / 1000
        console.log(`${id}: section ${lengthKm} km, farthest shoreline ${r.maxShoreKm} km, farthest shelf edge ${r.maxEdgeKm} km, thickest section ${sizeFt(r).toFixed(0)} ft`)
        expect(r.maxEdgeKm).toBeGreaterThan(0)
        expect(r.maxEdgeKm).toBeLessThan(0.75 * lengthKm)
        expect(r.maxShoreKm).toBeLessThan(0.75 * lengthKm)
      })
      it('memory per state', () => {
        const cells = r.P.nx * (r.schedule.nSteps + 1)
        const rec = recordBytes(r.P.nx, r.schedule.nSteps + 1)
        const caches = 5 * cells * 8
        const snap = snapshotEngine(r.eng)
        const ldBytes = snap.ld ? snap.ld.byteLength : 0
        console.log(`${id}: record ${(rec / 1e6).toFixed(1)} MB, engine caches ${(caches / 1e6).toFixed(1)} MB, one snapshot ${((rec + ldBytes) / 1e6).toFixed(1)} MB (loads ${(ldBytes / 1e6).toFixed(1)} MB)`)
        expect(rec).toBeLessThanOrEqual(60e6)
      })
    })
  }
})
