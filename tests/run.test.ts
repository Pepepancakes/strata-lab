import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stateHash } from '../src/engine/determinism'
import { cloneParams } from '../src/engine/engineParams'
import { recordBalance, appendLayer, markInitialLedger, SALT } from '../src/engine/record'
import { buildSchedule } from '../src/engine/schedule'
import { createEngine, columnSolids, restoreEngine, snapshotEngine, step } from '../src/engine/step'
import { rebuildCaches, recomputeH } from '../src/engine/compaction'
import { runFull, seaLevelOf } from './helpers/run'

// One 3 Myr default run (600 steps of 5 kyr), shared by the tests below.
const full = runFull(undefined, [240, 300])

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

  it('runs in under 3 s', () => {
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
  it('matches the spike column by column', () => {
    const { rec } = full.eng
    expect(rec.nx).toBe(g.nx)
    expect(rec.nLayers - 1).toBe(g.steps)
    let dH = 0, dB = 0, dSand = 0, dMud = 0, dU = 0
    let maxU = 0
    for (let j = 0; j < g.nx; j++) {
      const c = columnSolids(full.eng, j)
      let uj = 0
      for (let l = 0; l < rec.nLayers; l++) uj = Math.max(uj, rec.u[l * rec.nx + j])
      maxU = Math.max(maxU, uj)
      dH = Math.max(dH, Math.abs(rec.H[j] - g.H[j]))
      dB = Math.max(dB, Math.abs(rec.b[j] - g.b[j]))
      dSand = Math.max(dSand, Math.abs(c.sand - g.solidSand[j]) / g.solidSand[j])
      dMud = Math.max(dMud, Math.abs(c.mud - g.solidMud[j]) / g.solidMud[j])
      dU = Math.max(dU, Math.abs(uj - g.maxExcessPorePressure[j]))
    }
    console.log(`parity max diffs: H ${dH.toExponential(2)} m, b ${dB.toExponential(2)} m, sand ${dSand.toExponential(2)} rel, mud ${dMud.toExponential(2)} rel, column max u ${dU.toExponential(2)} Pa; max u ${maxU.toExponential(4)} vs ${g.maxExcessPorePressureAll.toExponential(4)} Pa`)
    expect(dH).toBeLessThan(0.01)
    expect(dB).toBeLessThan(0.01)
    expect(dSand).toBeLessThan(1e-6)
    expect(dMud).toBeLessThan(1e-6)
    expect(Math.abs(maxU - g.maxExcessPorePressureAll) / g.maxExcessPorePressureAll).toBeLessThan(1e-6)
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

    const sl = seaLevelOf(P)
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
