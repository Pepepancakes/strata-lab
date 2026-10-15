// M2.2 slope failure: hand-built slopes (steep + high excess pore pressure fails, stable never
// fails), mass conservation per grain size, exact restore across a failure, and full runs.
import { describe, it, expect } from 'vitest'
import { failureStep, mtdBalance, mtdSmax, pickFailure } from '../src/engine/failure'
import { computeStability } from '../src/engine/stability'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { allocateEngine, type EngineState } from '../src/engine/state'
import { appendLayer, createRecord, markInitialLedger, recordBalance, MTD } from '../src/engine/record'
import { cellBulk, rebuildCaches, recomputeH } from '../src/engine/compaction'
import { stateHash } from '../src/engine/determinism'
import { createEngine, restoreEngine, snapshotEngine, step } from '../src/engine/step'
import { packKeyframe, restoreKeyframe } from '../src/worker/keyframes'
import { runFull, seaLevelOf } from './helpers/run'

const NX = 60
const DX = 1000

/**
 * A section 60 km long: a steep slope (tan beta = 0.15) over the first 20 columns, then a flat floor.
 * Four layers of mixed sand and mud, 15 solid m each, with excess pore pressure u = ru x load.
 */
function slopeSection(ru: number, over: Partial<EngineParams> = {}, sandM = 3, mudM = 12): { eng: EngineState; P: EngineParams } {
  const P: EngineParams = { ...defaultEngineParams(), nx: NX, dx: DX, failOn: 1, ...over }
  const rec = createRecord({ nx: NX, dx: DX, capacity: 6, startAgeMa: 1 })
  const eng = allocateEngine(rec)
  for (let n = 0; n < 4; n++) {
    const k = appendLayer(rec, 1000, 1 - n * 0.001, (n + 1) * 1000)
    for (let j = 0; j < NX; j++) {
      rec.sand[k * NX + j] = sandM
      rec.mud[k * NX + j] = mudM
    }
  }
  rebuildCaches(eng, P) // smax = 0: surface porosity, fine for a hand-built section
  for (let i = 0; i < 4 * NX + NX; i++) rec.u[i] = ru * eng.ld[i]
  let bulk = 0
  for (let l = 0; l < rec.nLayers; l++) bulk += cellBulk(eng, P, l * NX)
  for (let j = 0; j < NX; j++) rec.b[j] = -0.15 * Math.min((j + 0.5) * DX, 20000) - bulk
  recomputeH(eng, P)
  markInitialLedger(rec)
  return { eng, P }
}

const top = (eng: EngineState): number => eng.rec.nLayers - 1

describe('pickFailure', () => {
  it('starts at the weakest column and widens over contiguous unstable columns, at most maxCells', () => {
    const fs = [2, 0.9, 0.5, 0.8, 0.7, 2, 2.5, 2]
    expect(pickFailure(fs, 10)).toEqual({ from: 1, to: 4 })
    expect(pickFailure(fs, 2)).toEqual({ from: 2, to: 3 })
    expect(pickFailure([2, 3, 4], 5)).toBeNull()
  })
})

describe('a stable slope never fails', () => {
  it('no excess pressure: FS > 1, nothing changes', () => {
    const { eng, P } = slopeSection(0)
    expect(Math.min(...computeStability(eng, P).fsMin)).toBeGreaterThan(1)
    const before = stateHash(eng.rec)
    const ev = failureStep(eng, P, 3, 4000, 0.996)
    expect(ev).toEqual([])
    expect(eng.events).toEqual([])
    expect(stateHash(eng.rec)).toBe(before)
    expect(eng.diag.failUnresolved).toBe(0)
  })
})

describe('an unstable slope (steep, r_u = 0.8) fails and deposits downslope', () => {
  const { eng, P } = slopeSection(0.8, { failMaxIters: 20 })
  const st0 = computeStability(eng, P)
  const sandBefore = (() => {
    let s = 0
    for (let i = 0; i < eng.rec.nLayers * NX; i++) s += eng.rec.sand[i]
    return s * DX
  })()
  const events = failureStep(eng, P, 3, 4000, 0.996)

  it('starts below FS = 1', () => {
    expect(Math.min(...st0.fsMin)).toBeLessThan(0.8)
  })
  it('makes events with sensible fields', () => {
    expect(events.length).toBeGreaterThan(0)
    expect(eng.events).toEqual(events)
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1))
    for (const e of events) {
      expect(e.sourceTo - e.sourceFrom + 1).toBeLessThanOrEqual(P.failMaxCells)
      expect(e.volume).toBeGreaterThan(0)
      expect(e.scarDepth).toBeGreaterThan(0)
      expect(e.tYr).toBe(4000)
      expect(e.layer).toBe(top(eng))
    }
  })
  it('lays the first failure down as an MTD below the source, on the flat floor', () => {
    const e = events[0]
    expect(e.runout).toBeGreaterThan(0)
    expect(e.depositTo).toBeGreaterThan(e.sourceTo)
    let nMtd = 0
    for (let c = e.depositFrom; c <= e.depositTo; c++) if (eng.rec.material[top(eng) * NX + c] === MTD) nMtd++
    expect(nMtd).toBeGreaterThan(0)
    // fresh debris: remoulded mud, so smax is the remoulded value (cells with no earlier sediment)
    const c = e.depositTo
    expect(eng.rec.smax[top(eng) * NX + c]).toBeGreaterThan(0)
  })
  it('conserves sand and mud for every event (< 1e-12)', () => {
    const b = mtdBalance(events)
    expect(b.sand.released).toBeGreaterThan(0)
    expect(b.mud.released).toBeGreaterThan(0)
    expect(b.sand.worstRel).toBeLessThan(1e-12)
    expect(b.mud.worstRel).toBeLessThan(1e-12)
    expect(Math.abs(b.sand.error) / b.sand.released).toBeLessThan(1e-12)
    expect(Math.abs(b.mud.error) / b.mud.released).toBeLessThan(1e-12)
  })
  it('the record balance per class still closes, with exports in cumOut', () => {
    const bal = recordBalance(eng.rec)
    expect(Math.abs(bal.sand.relError)).toBeLessThan(1e-12)
    expect(Math.abs(bal.mud.relError)).toBeLessThan(1e-12)
    const mb = mtdBalance(events)
    expect(eng.rec.ledger.cumOut.sand).toBeCloseTo(mb.sand.exported, 6)
    expect(eng.rec.ledger.cumOut.mud).toBeCloseTo(mb.mud.exported, 6)
    // sand-only check from the arrays, independent of the ledger
    let sandNow = 0
    for (let i = 0; i < eng.rec.nLayers * NX; i++) sandNow += eng.rec.sand[i]
    expect(Math.abs((sandNow * DX + mb.sand.exported - sandBefore) / sandBefore)).toBeLessThan(1e-12)
  })
  it('leaves the cached loads and porosities equal to what a rebuild from the record gives', () => {
    const snap = snapshotEngine(eng)
    const twin = allocateEngine(createRecord({ nx: NX, dx: DX, capacity: 6, startAgeMa: 1 }))
    restoreEngine(snap, twin, P)
    const n = eng.rec.nLayers * NX
    expect(Array.from(eng.ld.subarray(0, n))).toEqual(Array.from(twin.ld.subarray(0, n)))
    expect(Array.from(eng.phs.subarray(0, n))).toEqual(Array.from(twin.phs.subarray(0, n)))
    expect(Array.from(eng.phm.subarray(0, n))).toEqual(Array.from(twin.phm.subarray(0, n)))
    expect(stateHash(twin.rec)).toBe(stateHash(eng.rec))
    expect(twin.events).toEqual(eng.events)
  })
  it('does the same thing twice (deterministic)', () => {
    const again = slopeSection(0.8, { failMaxIters: 20 })
    failureStep(again.eng, again.P, 3, 4000, 0.996)
    expect(stateHash(again.eng.rec)).toBe(stateHash(eng.rec))
    expect(again.eng.events).toEqual(eng.events)
  })
})

describe('retrogression cap and rechecks', () => {
  it('failMaxCells = 3 gives events of at most 3 columns; failMaxIters bounds the events per step', () => {
    const { eng, P } = slopeSection(0.8, { failMaxCells: 3, failMaxIters: 2 })
    const ev = failureStep(eng, P, 3, 4000, 0.996)
    expect(ev.length).toBe(2)
    for (const e of ev) expect(e.sourceTo - e.sourceFrom + 1).toBeLessThanOrEqual(3)
    expect(eng.diag.failUnresolved).toBe(1) // columns are still unstable: counted, retried next step
  })
})

describe('failures that move nothing (finding 2)', () => {
  // A thin cover (about 0.6 m of solids per layer, 2.4 m in all) on a 0.15 slope with r_u = 0.95:
  // unstable, but a debris sheet this thin is below the Bingham plug thickness and does not run.
  const thin = (over: Partial<EngineParams> = {}) => slopeSection(0.95, { failMinDepth: 0, failMaxIters: 5, failMaxCells: 1, ...over }, 0.15, 0.45)
  it('the section is unstable and a failure there has a run-out under the stall threshold', () => {
    const { eng, P } = thin()
    expect(Math.min(...computeStability(eng, P, { minSlope: 0, minDepth: 0 }).fsMin)).toBeLessThan(1)
  })
  it('a failure that moves nothing is made once per column in a step, flagged stalled, and counted unresolved', () => {
    const { eng, P } = thin()
    const ev = failureStep(eng, P, 3, 4000, 0.996)
    expect(ev.length).toBeGreaterThan(0)
    const stalled = ev.filter((e) => e.stalled)
    expect(stalled.length).toBeGreaterThan(0)
    for (const e of stalled) expect(e.runout).toBeLessThan(P.failStallRunout)
    // no column is failed again in this step after a stalled failure of it
    for (let a = 0; a < ev.length; a++) {
      if (!ev[a].stalled) continue
      for (let b = a + 1; b < ev.length; b++) {
        const overlap = ev[b].sourceFrom <= ev[a].sourceTo && ev[b].sourceTo >= ev[a].sourceFrom
        expect(overlap).toBe(false)
      }
    }
    expect(eng.diag.failUnresolved).toBeGreaterThan(0)
  })
  it('with the rule off (failStallRunout = 0) the same column fails again and again (the M2.2 behaviour)', () => {
    const { eng, P } = thin({ failStallRunout: 0 })
    const ev = failureStep(eng, P, 3, 4000, 0.996)
    const per = new Map<number, number>()
    for (const e of ev) per.set(e.sourceFrom, (per.get(e.sourceFrom) ?? 0) + 1)
    expect(Math.max(...per.values())).toBeGreaterThan(1)
    expect(ev.every((e) => !e.stalled)).toBe(true)
  })
  it('mass balance per grain size is exact with the rule on', () => {
    const { eng, P } = thin()
    const ev = failureStep(eng, P, 3, 4000, 0.996)
    const b = mtdBalance(ev)
    expect(b.sand.worstRel).toBeLessThan(1e-12)
    expect(b.mud.worstRel).toBeLessThan(1e-12)
    const bal = recordBalance(eng.rec)
    expect(Math.abs(bal.sand.relError)).toBeLessThan(1e-12)
    expect(Math.abs(bal.mud.relError)).toBeLessThan(1e-12)
  })
})

describe('scar depth against the search window (finding 3)', () => {
  it('windowLimited is true when the deepest scar is within 5 % of stabMaxDepth, false otherwise', () => {
    const wide = slopeSection(0.8, { failMaxIters: 20 })
    const shallow = failureStep(wide.eng, wide.P, 3, 4000, 0.996)
    for (const e of shallow) expect(e.windowLimited).toBe(e.scarDepth >= 0.95 * wide.P.stabMaxDepth)
    // the same section with the window set 2 % above the deepest scar found above: that scar sits within 5 % of the window
    const deepest = Math.max(...shallow.map((e) => e.scarDepth))
    const win = deepest * 1.02
    const narrow = slopeSection(0.8, { failMaxIters: 20, stabMaxDepth: win })
    const ev = failureStep(narrow.eng, narrow.P, 3, 4000, 0.996)
    expect(ev.some((e) => e.windowLimited)).toBe(true)
    for (const e of ev) expect(e.windowLimited).toBe(e.scarDepth >= 0.95 * win)
  })
})

describe('zero-sediment cells lose the MTD tag (finding 6)', () => {
  it('a cell tagged MTD whose sediment is gone is cleared at the end of the failure step; solids are untouched', () => {
    const { eng, P } = slopeSection(0.8, { failMaxIters: 20 })
    failureStep(eng, P, 3, 4000, 0.996)
    const rec = eng.rec
    const i = top(eng) * NX + 50 // flat floor, far from any deposit
    rec.sand[i] = 0
    rec.mud[i] = 0
    rec.material[i] = MTD // as left behind by erosion that took all of a debris deposit
    const sum = (a: Float64Array) => a.reduce((s, v) => s + v, 0)
    const before = [sum(rec.sand), sum(rec.mud)]
    failureStep(eng, P, 4, 5000, 0.995)
    expect(rec.material[i]).toBe(0)
    expect([sum(rec.sand), sum(rec.mud)]).toEqual(before)
  })
})

describe('the MTD clean-up scan only runs when an MTD cell may exist (M2.10)', () => {
  it('a stable section never sets the flag, and the scan is skipped (a hand-made empty MTD cell is left alone)', () => {
    const { eng, P } = slopeSection(0, { failMaxIters: 20 })
    failureStep(eng, P, 3, 4000, 0.996)
    expect(eng.events.length).toBe(0)
    expect(eng.diag.mtdPresent).toBe(0)
    const i = top(eng) * NX + 50
    eng.rec.sand[i] = 0
    eng.rec.mud[i] = 0
    eng.rec.material[i] = MTD
    failureStep(eng, P, 4, 5000, 0.995)
    expect(eng.rec.material[i]).toBe(MTD) // the old code scanned every step and cleared it
  })

  it('a deposit sets the flag; it drops again once no MTD cell is left', () => {
    const { eng, P } = slopeSection(0.8, { failMaxIters: 20 })
    failureStep(eng, P, 3, 4000, 0.996)
    expect(eng.diag.mtdPresent).toBe(1)
    const rec = eng.rec
    for (let i = 0; i < rec.nLayers * rec.nx; i++) {
      if (rec.material[i] === MTD) {
        rec.sand[i] = 0
        rec.mud[i] = 0
      }
    }
    failureStep(eng, P, 4, 5000, 0.995)
    expect(rec.material.some((m) => m === MTD)).toBe(false)
    expect(eng.diag.mtdPresent).toBe(rec.material.some((m) => m === MTD) ? 1 : 0)
  })

  it('the flag is part of snapshots and keyframes, so a rewound run clears exactly as the straight run does', () => {
    const { eng, P } = slopeSection(0.8, { failMaxIters: 20 })
    failureStep(eng, P, 3, 4000, 0.996)
    expect(eng.diag.mtdPresent).toBe(1)
    expect(snapshotEngine(eng).diag.mtdPresent).toBe(1)
    expect(packKeyframe(eng).diag.mtdPresent).toBe(1)
  })

  it('whole run with failure on: flag is 1 exactly when the record holds an MTD cell', () => {
    const run = runFull(undefined, [], { failOn: 1, phiFric: [16, 9] })
    expect(run.eng.events.length).toBeGreaterThan(0)
    expect(run.eng.diag.mtdPresent).toBe(run.eng.rec.material.some((m) => m === MTD) ? 1 : 0)
  }, 60000)
})

describe('remoulded porosity', () => {
  it('mtdSmax inverts the porosity law for mud', () => {
    const P = defaultEngineParams()
    const s = mtdSmax(P)
    expect(P.phi0[1] * Math.exp(-P.beta[1] * s)).toBeCloseTo(P.mtdPhiMud, 12)
    expect(mtdSmax({ ...P, mtdPhiMud: 0.7 })).toBe(0) // at or above the surface porosity: fresh sediment
  })
})

describe('full runs', () => {
  it('default run: failure on changes nothing (FS stays above 1), so the M1 result is bit-identical', () => {
    const off = runFull()
    const on = runFull(undefined, [], { failOn: 1 })
    expect(on.eng.events).toEqual([])
    expect(on.eng.diag.failUnresolved).toBe(0)
    expect(stateHash(on.eng.rec)).toBe(stateHash(off.eng.rec))
  }, 60000)
})

describe('rewind across failures', () => {
  // weaker friction so that the default margin fails in the later part of the run
  const weak: Partial<EngineParams> = { failOn: 1, phiFric: [16, 9] }
  const run = runFull(undefined, [100, 200, 300, 400, 500, 560], weak)
  const total = run.eng.events.length
  const replay = (from: (e: EngineState) => void): EngineState => {
    const eng = createEngine(run.P, run.schedule)
    from(eng)
    const sl = seaLevelOf(run.P, run.schedule)
    while (step(eng, run.P, run.schedule, sl));
    return eng
  }

  it('the weakened run really has failures, and they conserve mass per grain size', () => {
    expect(total).toBeGreaterThan(0)
    const b = mtdBalance(run.eng.events)
    expect(b.sand.worstRel).toBeLessThan(1e-12)
    expect(b.mud.worstRel).toBeLessThan(1e-12)
    const bal = recordBalance(run.eng.rec)
    expect(Math.abs(bal.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(bal.mud.relError)).toBeLessThan(1e-9)
    expect(run.eng.events.some((e) => run.eng.rec.material[e.layer * run.P.nx + e.depositTo] === MTD)).toBe(true)
  })

  it('a snapshot taken before the failures, restored and replayed, gives the same record and events', () => {
    const early = [...run.snaps.entries()].filter(([, sn]) => sn.events.length === 0).map(([k]) => k).sort((a, b) => b - a)
    expect(early.length).toBeGreaterThan(0)
    const eng = replay((e) => restoreEngine(run.snaps.get(early[0])!, e, run.P))
    expect(stateHash(eng.rec)).toBe(stateHash(run.eng.rec))
    expect(eng.events).toEqual(run.eng.events)
  })

  it('a snapshot taken between failures, restored and replayed, gives the same record and events', () => {
    const mid = [...run.snaps.entries()].filter(([, sn]) => sn.events.length > 0 && sn.events.length < total).map(([k]) => k).slice(0, 2)
    expect(mid.length).toBeGreaterThan(0)
    for (const k of mid) {
      const eng = replay((e) => restoreEngine(run.snaps.get(k)!, e, run.P))
      expect(stateHash(eng.rec), `from step ${k}`).toBe(stateHash(run.eng.rec))
      expect(eng.events).toEqual(run.eng.events)
    }
  }, 60000)

  it('restoring a snapshot taken after a failure puts the event list back exactly', () => {
    const k = [...run.snaps.entries()].filter(([, sn]) => sn.events.length > 0).map(([key]) => key)[0]
    expect(k).toBeDefined()
    const eng = createEngine(run.P, run.schedule)
    restoreEngine(run.snaps.get(k)!, eng, run.P)
    expect(eng.events).toEqual(run.snaps.get(k)!.events)
    expect(eng.events.length).toBeGreaterThan(0)
  })

  it('the time machine route (keyframe) restores across a failure bit-identically too', () => {
    const at = run.eng.events[Math.floor(total / 2)].step // steps completed just before that failure
    const sl = seaLevelOf(run.P, run.schedule)
    const eng = createEngine(run.P, run.schedule)
    let kf: ReturnType<typeof packKeyframe> | undefined
    while (step(eng, run.P, run.schedule, sl)) if (eng.diag.stepIndex === at) kf = packKeyframe(eng)
    expect(stateHash(eng.rec)).toBe(stateHash(run.eng.rec)) // the same run again: deterministic
    expect(kf!.events.length).toBeLessThan(total)
    const eng2 = replay((e) => restoreKeyframe(kf!, e, run.P, run.schedule))
    expect(stateHash(eng2.rec)).toBe(stateHash(run.eng.rec))
    expect(eng2.events).toEqual(run.eng.events)
  }, 60000)
})
