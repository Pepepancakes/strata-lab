// SFM-1 (D31.3, SFM-R F2): the open basinward boundary of the transport step.
// Exact case: a straight slope that carries a constant flux to a fixed-elevation outflow is a steady state of the
// discrete implicit scheme (to round-off), and a bumpy start relaxes onto it. Mass: supply = stored + exported per
// grain size on the default, Gulf and an all-mud run. Section length: with the open edge a longer section gives the
// same sea floor; with the closed wall it does not. The 5 % threshold is a round number (D31.5), not a cited target.
import { describe, expect, it } from 'vitest'
import { cellBulk, rebuildCaches } from '../src/engine/compaction'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { getPreset, presetParams, presetSchedule } from '../src/engine/presets'
import { appendLayer, markInitialLedger, recordBalance } from '../src/engine/record'
import { buildSchedule } from '../src/engine/schedule'
import { createEngine, step } from '../src/engine/step'
import { transportSubstep } from '../src/engine/transport'
import { seaLevelOf, runFull } from './helpers/run'

const K = 1e5 // m^2/yr, the same for sand and mud so the mix does not matter
const NX = 20

/**
 * A section of NX columns on an all-sand bed (so the mix that leaves a cell is the mix that arrived), one grain size
 * supplied, K the same everywhere. `startSlope` is the slope the surface starts with; the ghost level is a round number.
 */
function slopeCase(startSlope: number) {
  const P: EngineParams = { ...defaultEngineParams(), nx: NX, dx: 1000, tcMax: 0, sandFrac: 1, Kc: [K, K], supply: 1 }
  const sched = buildSchedule([{ fromAgeMa: 0.1, toAgeMa: 0, dt: 5000 }])
  const eng = createEngine(P, sched)
  const rec = eng.rec
  rec.mud.fill(0) // all-sand bed
  rebuildCaches(eng, P)
  appendLayer(rec, 5000, 0, 5000)
  // the ghost cell sits at the pre-run surface of the last column; move it to a round level and build the slope above it
  const Hg = -105
  rec.b[NX - 1] = Hg - cellBulk(eng, P, NX - 1)
  for (let j = 0; j < NX; j++) rec.H[j] = Hg + startSlope * P.dx * (NX - j)
  const slope = 0.01 // the slope that carries the supply: flux = K x slope (bulk m^2/yr)
  P.supply = (K * slope) * (1 - P.phi0[0])
  markInitialLedger(rec)
  return { P, eng, rec, Hg, slope }
}

describe('open basinward boundary: exact steady slope', () => {
  const SL = -1e5 // far below the surface: every face is subaerial, K constant, no turbidites

  it('a straight slope carrying the supplied flux to the fixed outflow level does not change (1e-10 relative)', () => {
    const { P, eng, rec } = slopeCase(0.01)
    const before = Float64Array.from(rec.H)
    for (let n = 0; n < 5; n++) transportSubstep(eng, P, SL, 1000)
    let worst = 0
    for (let j = 0; j < NX; j++) worst = Math.max(worst, Math.abs(rec.H[j] - before[j]) / Math.abs(before[j]))
    expect(worst).toBeLessThan(1e-10)
    // and the supplied sediment all left past the edge
    const led = rec.ledger
    expect(Math.abs(led.cumIn.sand - led.cumEdge.sand) / led.cumIn.sand).toBeLessThan(1e-9)
  })

  it('a flat start at the outflow level builds up to the same straight slope (steady state, 1e-6 relative)', () => {
    const { P, eng, rec, Hg, slope } = slopeCase(0)
    for (let n = 0; n < 1000; n++) transportSubstep(eng, P, SL, 20000) // K dt / dx^2 = 2: implicit, no CFL limit
    let worst = 0
    for (let j = 0; j < NX; j++) {
      const exact = Hg + slope * P.dx * (NX - j)
      worst = Math.max(worst, Math.abs(rec.H[j] - exact) / Math.abs(exact))
    }
    expect(worst).toBeLessThan(1e-6)
    const b = recordBalance(rec)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(rec.ledger.cumEdge.sand).toBeGreaterThan(0)
  })

  it('a last column below the outflow level is never fed from outside: the edge is closed for that substep', () => {
    const { P, eng, rec, Hg } = slopeCase(0)
    rec.H[NX - 1] = Hg - 5
    transportSubstep(eng, P, SL, 1) // one year: the supply raises the section by about a metre in all, far less than the 5 m deficit
    expect(rec.ledger.cumEdge.sand).toBe(0)
    expect(Math.abs(recordBalance(rec).sand.relError)).toBeLessThan(1e-9)
  })

  it('the closed wall (closedEdge) keeps everything: nothing is exported and the last column rises', () => {
    const { P, eng, rec } = slopeCase(0.01)
    const closed = { ...P, closedEdge: true }
    const h0 = rec.H[NX - 1]
    for (let n = 0; n < 5; n++) transportSubstep(eng, closed, SL, 1000)
    expect(rec.ledger.cumEdge.sand).toBe(0)
    expect(rec.H[NX - 1]).toBeGreaterThan(h0)
  })
})

describe('open basinward boundary: mass per grain size (supply = stored + exported)', () => {
  const check = (rec: ReturnType<typeof runFull>['eng']['rec']) => {
    const b = recordBalance(rec)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    const { cumOut, cumEdge } = rec.ledger
    // the edge export is part of cumOut (turbidite run-out is the rest): no double counting
    expect(cumEdge.sand).toBeLessThanOrEqual(cumOut.sand)
    expect(cumEdge.mud).toBeLessThanOrEqual(cumOut.mud)
  }

  it('default run: balances; some mud and sand leave past the edge', () => {
    const r = runFull()
    check(r.eng.rec)
    expect(r.eng.rec.ledger.cumEdge.mud).toBeGreaterThan(0)
    expect(r.eng.diag.deficit).toBe(0)
  })

  it('all-mud run (sandFrac 0): nothing is supplied as sand, both grain sizes still balance (reworked pre-run sand is booked too)', () => {
    const r = runFull(undefined, [], { sandFrac: 0 })
    check(r.eng.rec)
    expect(r.eng.rec.ledger.cumIn.sand).toBe(0)
    expect(r.eng.rec.ledger.cumEdge.mud).toBeGreaterThan(0)
  })

  it('Gulf preset (400 km, 66 Myr): balances per grain size, salt untouched', () => {
    const P = presetParams('gulf')
    const sched = presetSchedule('gulf')
    const eng = createEngine(P, sched)
    const sl = seaLevelOf(P, sched)
    while (step(eng, P, sched, sl)) { /* run */ }
    check(eng.rec)
    expect(getPreset('gulf').id).toBe('gulf')
    expect(Math.abs(recordBalance(eng.rec).salt.relError)).toBeLessThan(1e-12)
  }, 120000)
})

describe('open basinward boundary: a longer section gives the same sea floor (SFM-R F2, round-number threshold D31.5)', () => {
  // Constant sea level, dx 1 km. The same stretch (100 to 150 km) is compared, not "everything beyond 100 km",
  // because a longer section has more sea floor beyond 100 km by construction. A 150 km section is too short to
  // converge (the sediment piles up to 650 m at 150 km only when the section continues; measured, see the handoff),
  // so the open-edge test goes from 300 km to the longest section the record allows, 400 km.
  const base = { seaLevelKind: 'sine' as const, slAmp: 0 }
  const measure = (nx: number, closed: boolean) => {
    const r = runFull(undefined, [], { ...base, nx, closedEdge: closed })
    const { rec } = r.eng
    let sand = 0
    for (let l = rec.nPre; l < rec.nLayers; l++) for (let j = 100; j < 150; j++) sand += rec.sand[l * rec.nx + j]
    return { sand, depth: -rec.H[149] }
  }
  it('open edge: 300 km against 400 km changes the sand at 100 to 150 km and the sea-floor depth at 150 km by less than 5 %', () => {
    const a = measure(300, false), b = measure(400, false)
    expect(Math.abs(b.sand / a.sand - 1)).toBeLessThan(0.05)
    expect(Math.abs(b.depth / a.depth - 1)).toBeLessThan(0.05)
  }, 120000)
  it('closed wall (the old condition): going from 150 km to 300 km changes them by far more than 5 %, so the test can fail', () => {
    const a = measure(150, true), b = measure(300, true)
    const worst = Math.max(Math.abs(b.sand / a.sand - 1), Math.abs(b.depth / a.depth - 1))
    expect(worst).toBeGreaterThan(0.1)
  }, 120000)
})
