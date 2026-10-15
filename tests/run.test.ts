import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stateHash } from '../src/engine/determinism'
import { cloneParams } from '../src/engine/engineParams'
import { recordBalance, appendLayer, markInitialLedger, SALT } from '../src/engine/record'
import { buildSchedule } from '../src/engine/schedule'
import { createEngine, columnSolids, restoreEngine, snapshotEngine, step } from '../src/engine/step'
import { rebuildCaches, recomputeH } from '../src/engine/compaction'
import { runFull, seaLevelOf } from './helpers/run'
import { withUlpNoise } from './helpers/ulpNoise'
import { SUMMARY_TOL, summarizeRecord } from '../src/engine/summary'

// One 3 Myr default run (600 steps of 5 kyr), shared by the tests below.
const full = runFull(undefined, [240, 300])
// Golden parity is with spike 001, which used the sine, so that comparison runs on the sine.
const fullSine = runFull(undefined, [], { seaLevelKind: 'sine' })

describe('default 3 Myr run', () => {
  it('conserves mass: total, sand only, mud only, and no salt appears', () => {
    const b = recordBalance(full.eng.rec)
    const cumIn = full.eng.rec.ledger.cumIn
    const total = (b.sand.error + b.mud.error) / (cumIn.sand + cumIn.mud)
    console.log(`balance: total ${total.toExponential(2)}, sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}, unfilled erosion ${full.eng.diag.deficit}`)
    expect(Math.abs(total)).toBeLessThan(1e-9)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(b.salt.error).toBe(0)
    expect(full.eng.diag.deficit).toBe(0)
    expect(cumIn.sand).toBeGreaterThan(0)
  })

  // Wall-clock gate: strict on the dev machine, skipped on CI (a shared runner is slower; D16.4).
  it.skipIf(!!process.env.CI)('runs in under 3 s', () => {
    // timed on a fresh run so snapshots do not count
    const t = runFull()
    console.log(`3 Myr default run: ${t.ms.toFixed(0)} ms (shared run with snapshots: ${full.ms.toFixed(0)} ms)`)
    expect(t.ms).toBeLessThan(3000)
  })
})

describe('determinism', () => {
  it('replay from a snapshot at 1.5 Ma (step 300) is bit-identical to the direct run', () => {
    const eng2 = createEngine(full.P, full.schedule)
    restoreEngine(full.snaps.get(300)!, eng2, full.P)
    const sl = seaLevelOf(full.P)
    while (step(eng2, full.P, full.schedule, sl)) { /* replay */ }
    expect(stateHash(eng2.rec)).toBe(stateHash(full.eng.rec))
  })

  it('a branch with unchanged (cloned) parameters reproduces the parent exactly', () => {
    const P2 = cloneParams(full.P)
    const eng3 = createEngine(P2, full.schedule)
    restoreEngine(full.snaps.get(240)!, eng3, P2)
    const sl = seaLevelOf(P2)
    while (step(eng3, P2, full.schedule, sl)) { /* branch */ }
    expect(stateHash(eng3.rec)).toBe(stateHash(full.eng.rec))
  })

  it('a branch with a changed parameter does differ (the check can fail)', () => {
    const P2 = cloneParams(full.P)
    P2.supply = 25
    const eng3 = createEngine(P2, full.schedule)
    restoreEngine(full.snaps.get(240)!, eng3, P2)
    const sl = seaLevelOf(P2)
    while (step(eng3, P2, full.schedule, sl)) { /* branch */ }
    expect(stateHash(eng3.rec)).not.toBe(stateHash(full.eng.rec))
  })
})

describe('golden parity with spike 001', () => {
  const g = JSON.parse(readFileSync(new URL('./golden/spike001-default.json', import.meta.url), 'utf8'))
  const sum = (a: ArrayLike<number>): number => Array.from(a).reduce((x, y) => x + y, 0)

  // Tolerances (D14, D16.4). The golden file is the spike's output; this engine matches it to 0.01 m
  // on the machine it was written on, but not on another operating system: the maths library
  // differs in the last bit, the shoreline and shelf-edge logic amplifies it, and single columns
  // move by tens of metres. MEASURED with 1 ulp to 1e-12 noise on pow/exp/log (withUlpNoise):
  //   per-column surface height   mean |dH| 2 to 4.6 m, max 29 to 74 m
  //   per-column sand / mud       up to 16 % / 14 % of the column
  //   total sand                  5e-15 relative       total mud     2e-4
  //   mean surface height         1.8e-3 relative      max pore pressure   up to 15 %
  //   shoreline / shelf edge      68.5 km, or 67.5 km (one column, dx = 1 km)
  // A REAL change moves the totals by more than the noise: supply +1 % gives sand 7.5e-3, mud 6.5e-3,
  // mean height 1e-2; sandFrac +0.02 gives sand 6.5e-2; subsidence +3 % gives mean height 9.5e-3.
  // Per-column and max-pressure limits are therefore only a net for gross damage; the totals and the
  // mean height (summary.ts SUMMARY_TOL) are what catch a physics change.
  const COLUMN = { meanDH: 8, maxDH: 150, maxRelSolid: 0.35, dB: 0.01 }
  const SHORE_KM = { value: 68.5, tol: 1.5 }

  function checkAgainstGolden(run: typeof fullSine): void {
    const { rec } = run.eng
    expect(rec.nx).toBe(g.nx)
    expect(rec.nLayers - 1).toBe(g.steps)
    let sumDH = 0, maxDH = 0, dB = 0, relSand = 0, relMud = 0, maxU = 0
    for (let j = 0; j < g.nx; j++) {
      const c = columnSolids(run.eng, j)
      for (let l = 0; l < rec.nLayers; l++) maxU = Math.max(maxU, rec.u[l * rec.nx + j])
      const dH = Math.abs(rec.H[j] - g.H[j])
      sumDH += dH
      maxDH = Math.max(maxDH, dH)
      dB = Math.max(dB, Math.abs(rec.b[j] - g.b[j]))
      relSand = Math.max(relSand, Math.abs(c.sand - g.solidSand[j]) / g.solidSand[j])
      relMud = Math.max(relMud, Math.abs(c.mud - g.solidMud[j]) / g.solidMud[j])
    }
    const s = summarizeRecord(rec)
    const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b)
    const dSand = rel(s.sand, sum(g.solidSand))
    const dMud = rel(s.mud, sum(g.solidMud))
    const dMeanH = rel(s.meanH, sum(g.H) / g.nx)
    const dMaxU = rel(maxU, g.maxExcessPorePressureAll)
    console.log(`parity: mean dH ${(sumDH / g.nx).toFixed(2)} m, max dH ${maxDH.toFixed(1)} m, b ${dB.toExponential(1)} m, column sand ${relSand.toFixed(3)}, mud ${relMud.toFixed(3)}; totals: sand ${dSand.toExponential(1)}, mud ${dMud.toExponential(1)}, mean H ${dMeanH.toExponential(1)}, max u ${dMaxU.toFixed(3)}; shoreline ${run.maxShoreKm} km, shelf edge ${run.maxEdgeKm} km`)
    // per-column net
    expect(sumDH / g.nx).toBeLessThan(COLUMN.meanDH)
    expect(maxDH).toBeLessThan(COLUMN.maxDH)
    expect(dB).toBeLessThan(COLUMN.dB) // basement subsidence involves no threshold: stays tight
    expect(relSand).toBeLessThan(COLUMN.maxRelSolid)
    expect(relMud).toBeLessThan(COLUMN.maxRelSolid)
    // summary statistics: these catch a real physics change
    expect(dSand).toBeLessThan(SUMMARY_TOL.sand)
    expect(dMud).toBeLessThan(SUMMARY_TOL.mud)
    expect(dMeanH).toBeLessThan(SUMMARY_TOL.meanH)
    expect(dMaxU).toBeLessThan(SUMMARY_TOL.maxU)
    expect(Math.abs(run.maxShoreKm - SHORE_KM.value)).toBeLessThanOrEqual(SHORE_KM.tol)
    expect(Math.abs(run.maxEdgeKm - SHORE_KM.value)).toBeLessThanOrEqual(SHORE_KM.tol)
  }

  it('matches the spike within stated tolerances (per column and in the summary statistics)', () => {
    checkAgainstGolden(fullSine)
  })

  it('still matches when the maths library differs in the last bit, as on the Linux runner', () => {
    for (const [amp, salt] of [[2.2e-16, 1], [2.2e-16, 2], [1e-13, 3]]) {
      checkAgainstGolden(withUlpNoise(amp, salt, () => runFull(undefined, [], { seaLevelKind: 'sine' })))
    }
  }, 60000)

  it('fails for a real change: supply +1 % moves the totals outside the tolerances', () => {
    const run = runFull(undefined, [], { seaLevelKind: 'sine', supply: 20.2 })
    expect(() => checkAgainstGolden(run)).toThrow()
  })
})

describe('variable step length', () => {
  const segments = [
    { fromAgeMa: 3, toAgeMa: 1, dt: 10000 },
    { fromAgeMa: 1, toAgeMa: 0, dt: 5000 },
  ]
  const a = runFull(segments)
  it('2 Myr at 10 kyr then 1 Myr at 5 kyr: both balances < 1e-9, no unfilled erosion', () => {
    const b = recordBalance(a.eng.rec)
    expect(a.schedule.nSteps).toBe(400)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(a.eng.diag.deficit).toBe(0)
    // each layer remembers its own step length
    expect(a.eng.rec.stepDt[1]).toBe(10000)
    expect(a.eng.rec.stepDt[400]).toBe(5000)
  })
  it('is deterministic', () => {
    expect(stateHash(runFull(segments).eng.rec)).toBe(stateHash(a.eng.rec))
  })
})

describe('salt is skipped by transport and compaction', () => {
  it('a hand-built salt unit is untouched; the sediment under it is not eroded', () => {
    const sched = buildSchedule([{ fromAgeMa: 0.1, toAgeMa: 0, dt: 5000 }])
    const P = full.P
    const eng = createEngine(P, sched, 1)
    const { rec } = eng
    const nx = rec.nx
    const salt = appendLayer(rec, 0, rec.stepAgeMa[0], 0)
    for (let j = 0; j < nx; j++) {
      rec.material[salt * nx + j] = SALT
      rec.mud[salt * nx + j] = 100 // salt thickness lives in `mud`, no pores
    }
    markInitialLedger(rec)
    rebuildCaches(eng, P)
    recomputeH(eng, P)
    const cells = (arr: Float64Array, layer: number) => Array.from(arr.slice(layer * nx, (layer + 1) * nx))
    const before = {
      saltMud: cells(rec.mud, salt), saltSand: cells(rec.sand, salt),
      sub: cells(rec.sand, 0), subMud: cells(rec.mud, 0), H: Array.from(rec.H),
    }
    // surface includes the salt: b + sediment bulk + 100 m
    expect(before.H[0]).toBeGreaterThan(rec.b[0] + 100)

    const sl = seaLevelOf(P, sched)
    while (step(eng, P, sched, sl)) { /* 20 steps */ }

    expect(cells(rec.mud, salt)).toEqual(before.saltMud)
    expect(cells(rec.sand, salt)).toEqual(before.saltSand)
    expect(cells(rec.u, salt).every((v) => v === 0)).toBe(true)
    expect(cells(rec.smax, salt).every((v) => v === 0)).toBe(true)
    expect(cells(eng.ld, salt).every((v) => v === 0)).toBe(true)
    expect(Array.from(rec.material.slice(salt * nx, (salt + 1) * nx)).every((m) => m === SALT)).toBe(true)
    // transport never reached below the salt
    expect(cells(rec.sand, 0)).toEqual(before.sub)
    expect(cells(rec.mud, 0)).toEqual(before.subMud)
    const b = recordBalance(rec)
    expect(b.salt.error).toBe(0)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(eng.diag.deficit).toBe(0)
    // snapshot/restore still round-trips with salt present
    const snap = snapshotEngine(eng)
    const h = stateHash(rec)
    restoreEngine(snap, eng, P)
    expect(stateHash(rec)).toBe(h)
  })
})
