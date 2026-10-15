// M3.3 welds and salt in the burial physics: the outflow limiter (salt never below zero, nothing
// clipped), the weld age as state, overburden through salt, temperature through salt, pore pressure
// above salt, and salt off changing nothing.
// Cross-machine rule (D16.4): numbers that John's PC and Linux CI must share are compared with bands
// or summary statistics; hand calculations of closed-form quantities use 1e-9; same-machine
// checks (rewind, second run) are exact.
import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { G, RHO_S, RHO_SALT, RHO_W } from '../src/engine/constants'
import { cellBulk, compactColumn, rebuildCaches, recomputeH, setPor } from '../src/engine/compaction'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { appendLayer, createRecord, markInitialLedger, recordBalance, SALT } from '../src/engine/record'
import { saltStep, saltVolume } from '../src/engine/salt'
import { allSaltIntervals, columnOverburden, saltIntervals } from '../src/engine/saltIntervals'
import { allocateEngine, WELD_NONE, type EngineState } from '../src/engine/state'
import { createEngine, restoreEngine, snapshotEngine, step } from '../src/engine/step'
import { cellConductivity, columnTemperatures, saltConductivity, saltTemperatureAt } from '../src/engine/thermal'
import { packKeyframe, restoreKeyframe } from '../src/worker/keyframes'
import { buildSchedule } from '../src/engine/schedule'
import { runFull, seaLevelOf } from './helpers/run'
import { withUlpNoise } from './helpers/ulpNoise'

const baseP = (over: Partial<EngineParams>): EngineParams => ({ ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, ...over })

const WELDING = { saltOn: 1, saltVisc: 1e17, saltThick: 200 }

/** A salt sheet (layer 0) under deep water with a heavy mud load on the left half (layer 1, 0.4 porosity). */
function loadedSalt(P: EngineParams, nx: number, h0: number, solid: number): EngineState {
  const rec = createRecord({ nx, dx: P.dx, capacity: 3, startAgeMa: 0, preLayers: 2 })
  for (let j = 0; j < nx; j++) {
    rec.mud[j] = h0
    rec.material[j] = SALT
    rec.b[j] = -4500
    if (j < nx / 2) rec.mud[nx + j] = solid
  }
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  eng.phm.fill(0.4)
  eng.phs.fill(0.3)
  return eng
}

// ---- forced loading: a heavy cover on four columns expels the salt below it ---------------------
// Salt viscosity 1e15 Pa s (100 times faster than the registry minimum) so that a few Myr are
// enough to squeeze 150 m of salt out from under 2.4 km of extra cover; this is a mechanics test,
// not a calibrated scenario. Columns 100 to 103 (x = 100 to 104 km) carry the load.
const FORCED_ETA = 1e15
const PATCH = [100, 101, 102, 103]

interface Forced {
  P: EngineParams
  schedule: ReturnType<typeof buildSchedule>
  eng: EngineState
  /** Salt thickness of every column after each step (steps x nx). */
  thick: Float64Array[]
  /** Weld ages after each step. */
  ages: Float64Array[]
  snaps: Map<number, ReturnType<typeof snapshotEngine>>
  kfs: Map<number, ReturnType<typeof packKeyframe>>
  v0: number
}

function forcedRun(over: Partial<EngineParams> = {}, load = 12, dt = 20000, snapAt: number[] = []): Forced {
  const P: EngineParams = { ...defaultEngineParams(), saltOn: 1, saltVisc: FORCED_ETA, saltThick: 150, ...over }
  const schedule = buildSchedule([{ fromAgeMa: 3, toAgeMa: 0, dt }])
  const eng = createEngine(P, schedule)
  const rec = eng.rec
  const nx = rec.nx
  for (const j of PATCH) {
    const before = cellBulk(eng, P, nx + j)
    rec.sand[nx + j] *= load
    rec.mud[nx + j] *= load
    rec.smax[nx + j] = 20e6
    rebuildCaches(eng, P)
    rec.b[j] -= cellBulk(eng, P, nx + j) - before // the seafloor stays where it was
  }
  markInitialLedger(rec)
  rebuildCaches(eng, P)
  recomputeH(eng, P)
  const v0 = saltVolume(rec)
  const sl = seaLevelOf(P, schedule)
  const thick: Float64Array[] = []
  const ages: Float64Array[] = []
  const snaps = new Map<number, ReturnType<typeof snapshotEngine>>()
  const kfs = new Map<number, ReturnType<typeof packKeyframe>>()
  while (step(eng, P, schedule, sl)) {
    thick.push(Float64Array.from(rec.mud.subarray(0, nx)))
    ages.push(eng.weldAge.slice())
    if (snapAt.includes(eng.diag.stepIndex)) {
      snaps.set(eng.diag.stepIndex, snapshotEngine(eng))
      kfs.set(eng.diag.stepIndex, packKeyframe(eng))
    }
  }
  return { P, schedule, eng, thick, ages, snaps, kfs, v0 }
}

/** The facts the benchmark checks, so a run under ulp noise can be judged by the same function. */
function forcedFacts(f: Forced): { minH: number; clip: number; saltErr: number; welded: number; limited: number; limMaxH: number; deepest: number } {
  let minH = Infinity
  for (const t of f.thick) for (const v of t) minH = Math.min(minH, v)
  let welded = 0
  for (const j of PATCH) if (f.eng.weldAge[j] !== WELD_NONE) welded++
  let deepest = Infinity
  for (const j of PATCH) deepest = Math.min(deepest, f.eng.rec.mud[j])
  return {
    minH, clip: f.eng.diag.saltClip, saltErr: Math.abs(saltVolume(f.eng.rec) - f.v0) / f.v0, welded,
    limited: f.eng.diag.saltLimited, limMaxH: f.eng.diag.saltLimitMaxH, deepest,
  }
}

describe('weld limiter: forced loading expels all the salt from a region', () => {
  const f = forcedRun()
  const facts = forcedFacts(f)
  it('salt never goes negative, nothing is clipped, salt is conserved to 1e-12', () => {
    console.log(`forced loading (eta ${FORCED_ETA.toExponential(0)}, 150 steps of 20 kyr): min thickness ${facts.minH.toExponential(3)} m, thinnest loaded column ${facts.deepest.toExponential(2)} m, clipped ${facts.clip}, limiter acted ${facts.limited} times (volume withheld ${f.eng.diag.saltLimitedVol.toExponential(2)} m2, largest thickness it acted at ${facts.limMaxH.toExponential(2)} m), welded loaded columns ${facts.welded} of ${PATCH.length}, salt volume error ${facts.saltErr.toExponential(2)}`)
    expect(facts.minH).toBeGreaterThanOrEqual(0)
    expect(facts.clip).toBe(0)
    expect(facts.saltErr).toBeLessThan(1e-12)
    const b = recordBalance(f.eng.rec)
    expect(Math.abs(b.salt.relError)).toBeLessThan(1e-12)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
  })
  it('the limiter acts (many cell-substeps), and only on cells with almost no salt left (< 1 m)', () => {
    expect(facts.limited).toBeGreaterThan(20)
    expect(facts.limMaxH).toBeLessThan(1)
  })
  it('the loaded columns are welded: some salt thinner than weldThick, the pinch-out edge never counts', () => {
    expect(facts.welded).toBeGreaterThanOrEqual(1)
    expect(facts.deepest).toBeLessThan(f.P.weldThick)
    expect(f.eng.weldAge[0]).toBe(WELD_NONE) // landward of the pinch-out: no salt, no weld
  })
  it('weld age = age at the end of the first step in which the column fell below weldThick, recorded once, never changed', () => {
    const nx = f.eng.rec.nx
    let checked = 0
    for (let j = 0; j < nx; j++) {
      const finalAge = f.eng.weldAge[j]
      let first = -1
      for (let s = 1; s < f.thick.length; s++) {
        if (f.thick[s - 1][j] >= f.P.weldThick && f.thick[s][j] < f.P.weldThick) {
          first = s
          break
        }
      }
      if (first < 0) {
        expect(finalAge).toBe(WELD_NONE)
        continue
      }
      checked++
      expect(finalAge).toBe(f.schedule.stepAgeMa[first])
      for (let s = first; s < f.ages.length; s++) expect(f.ages[s][j]).toBe(finalAge)
      for (let s = 0; s < first; s++) expect(f.ages[s][j]).toBe(WELD_NONE)
    }
    expect(checked).toBeGreaterThanOrEqual(1)
  })
})

describe('weld limiter: the checks fail when the physics is really different', () => {
  it('without the extra load nothing welds and the limiter never acts', () => {
    const calm = forcedFacts(forcedRun({}, 1))
    expect(calm.welded).toBe(0)
    expect(calm.limited).toBe(0)
  })
  it('same facts hold on a machine whose Math.exp/pow/log differ by one ulp (D16.4)', () => {
    for (const salt of [1, 7, 12345]) {
      const noisy = withUlpNoise(2.2e-16, salt, () => forcedFacts(forcedRun()))
      expect(noisy.minH).toBeGreaterThanOrEqual(0)
      expect(noisy.clip).toBe(0)
      expect(noisy.saltErr).toBeLessThan(1e-12)
      expect(noisy.welded).toBeGreaterThanOrEqual(1)
      expect(noisy.limited).toBeGreaterThan(20)
      expect(noisy.limMaxH).toBeLessThan(1)
    }
  })
})

describe('weld limiter: a step much longer than the drain time', () => {
  it('cuts the outflow of thick cells too (it is a step-size guard, not a thin-salt effect); still conserved, nothing clipped', () => {
    const f = forcedRun({}, 12, 100000)
    const x = forcedFacts(f)
    console.log(`coarse steps (30 steps of 100 kyr): limiter acted ${x.limited} times, largest thickness it acted at ${x.limMaxH.toFixed(1)} m, min thickness ${x.minH.toExponential(2)} m, clipped ${x.clip}, salt volume error ${x.saltErr.toExponential(2)}`)
    expect(x.minH).toBeGreaterThanOrEqual(0)
    expect(x.clip).toBe(0)
    expect(x.saltErr).toBeLessThan(1e-12)
    expect(x.limited).toBeGreaterThan(0)
  })
  it('a direct call: one very long step on a hand-made sheet, 1e-12 conservation and no negative thickness', () => {
    const nx = 40
    const P = baseP({ nx, dx: 1000, saltVisc: 1e17, nSaltSub: 1, coverBend: 0, weldThick: 10 })
    const eng = loadedSalt(P, nx, 100, 3000)
    const rec = eng.rec
    for (let j = 0; j < nx; j++) rec.mud[nx + j] = j >= 18 && j < 22 ? 3000 : 0
    const v0 = saltVolume(rec)
    saltStep(eng, P, 0, 1e6, 5)
    let minH = Infinity
    for (let j = 0; j < nx; j++) minH = Math.min(minH, rec.mud[j])
    expect(minH).toBeGreaterThanOrEqual(0)
    expect(Math.abs(saltVolume(rec) / v0 - 1)).toBeLessThan(1e-12)
    expect(eng.diag.saltClip).toBe(0)
    expect(eng.diag.saltLimited).toBeGreaterThan(0)
    expect(eng.weldAge[19]).toBe(5) // the loaded columns welded in this step, age as given
    expect(eng.weldAge[2]).toBe(WELD_NONE)
  })
  it('a gentle load leaves the limiter off (counters 0), so the step is the M3.2 step', () => {
    const P = baseP({ nx: 40, dx: 1000, saltVisc: 1e18, nSaltSub: 5, coverBend: 0 })
    const eng = loadedSalt(P, 40, 1500, 20)
    for (let s = 0; s < 20; s++) saltStep(eng, P, 0, 1000)
    expect(eng.diag.saltLimited).toBe(0)
    expect(eng.diag.saltLimitedVol).toBe(0)
    expect(eng.diag.saltLimitMaxH).toBe(0)
  })
})

// ---- weld age through snapshots and keyframes ----------------------------------------------------
describe('weld age after rewind (same machine, exact)', () => {
  const probe = forcedRun()
  // first step (1-based count of completed steps) at which any loaded column has welded
  const firstWeld = probe.ages.findIndex((a) => PATCH.some((j) => a[j] !== WELD_NONE)) + 1
  const before = Math.max(1, firstWeld - 3)
  const after = Math.min(probe.ages.length - 1, firstWeld + 20)
  const f = forcedRun({}, 12, 20000, [before, after])
  it('the snapshot points straddle the first weld', () => {
    expect(firstWeld).toBeGreaterThan(5)
    expect(before).toBeLessThan(firstWeld)
    expect(after).toBeGreaterThan(firstWeld)
    expect(f.snaps.get(before)!.weldAge.every((a) => a === WELD_NONE)).toBe(true)
    expect(f.snaps.get(after)!.weldAge.some((a) => a !== WELD_NONE)).toBe(true)
  })
  for (const route of ['snapshot', 'keyframe'] as const) {
    for (const at of ['before', 'after'] as const) {
      it(`${route} taken ${at} the first weld, restored into a fresh engine and replayed: ages and hash identical`, () => {
        const n = at === 'before' ? before : after
        const eng2 = createEngine(f.P, f.schedule)
        // damage the fresh engine's history first, so a restore that forgot weldAge would show
        eng2.weldAge.fill(99)
        if (route === 'snapshot') restoreEngine(f.snaps.get(n)!, eng2, f.P)
        else restoreKeyframe(f.kfs.get(n)!, eng2, f.P, f.schedule)
        expect(Array.from(eng2.weldAge)).toEqual(Array.from(f.ages[n - 1]))
        const sl = seaLevelOf(f.P, f.schedule)
        while (step(eng2, f.P, f.schedule, sl)) { /* replay */ }
        expect(Array.from(eng2.weldAge)).toEqual(Array.from(f.eng.weldAge))
        expect(stateHash(eng2.rec)).toBe(stateHash(f.eng.rec))
      })
    }
  }
  it('a snapshot holds its own copy of the ages', () => {
    const eng = createEngine(f.P, f.schedule)
    eng.weldAge[7] = 1.25
    const snap = snapshotEngine(eng)
    eng.weldAge[7] = WELD_NONE
    expect(snap.weldAge[7]).toBe(1.25)
  })
  it('a second run gives the same ages and hash', () => {
    const again = forcedRun()
    expect(Array.from(again.eng.weldAge)).toEqual(Array.from(probe.eng.weldAge))
    expect(stateHash(again.eng.rec)).toBe(stateHash(probe.eng.rec))
  })
})

// ---- overburden through salt vs hand calculation -----------------------------------------------
/** Column with a sediment layer, a salt layer, and two sediment layers above (a canopy-like layout), 600 m of water. */
function stackColumn(): { eng: EngineState; P: EngineParams; hand: { top: number; base: number; seabed: number; topDepth: number; thick: number } } {
  const P = baseP({ nx: 3, dx: 1000 })
  const rec = createRecord({ nx: 3, dx: 1000, capacity: 5, startAgeMa: 0, preLayers: 1 })
  rec.nLayers = 4
  const col = 1
  const nx = 3
  // layer 0: sediment (basement side), layer 1: salt 1000 m, layers 2 and 3: sediment
  rec.sand[0 * nx + col] = 40
  rec.mud[0 * nx + col] = 160
  rec.mud[1 * nx + col] = 1000
  rec.material[1 * nx + col] = SALT
  rec.sand[2 * nx + col] = 100
  rec.mud[2 * nx + col] = 300
  rec.sand[3 * nx + col] = 20
  rec.mud[3 * nx + col] = 80
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  eng.phs.fill(0.3)
  eng.phm.fill(0.4)
  const bulk = (s: number, m: number): number => s / (1 - 0.3) + m / (1 - 0.4)
  const w = (s: number, m: number): number => G * ((s + m) * RHO_S + (bulk(s, m) - s - m) * RHO_W)
  const b2 = bulk(100, 300), b3 = bulk(20, 80), b0 = bulk(40, 160)
  rec.b[col] = -2000 - (b0 + 1000 + b2 + b3) // seabed at -2000 m, so 600 m of water at sea level -1400
  const sl = -1400
  const water = RHO_W * G * (sl - -2000)
  const top = water + w(20, 80) + w(100, 300)
  const base = top + RHO_SALT * G * 1000
  return { eng, P, hand: { top, base, seabed: -2000, topDepth: b2 + b3, thick: 1000 } }
}

describe('overburden through a salt interval', () => {
  const { eng, P, hand } = stackColumn()
  const sl = -1400
  it('stress at salt top and base equal the hand calculation (1e-9 relative)', () => {
    const iv = saltIntervals(eng, P, sl, 1)
    expect(iv.length).toBe(1)
    const rt = Math.abs(iv[0].overburdenTop / hand.top - 1)
    const rb = Math.abs(iv[0].overburdenBase / hand.base - 1)
    console.log(`overburden: top ${(iv[0].overburdenTop / 1e6).toFixed(6)} MPa (hand ${(hand.top / 1e6).toFixed(6)}, rel ${rt.toExponential(2)}), base ${(iv[0].overburdenBase / 1e6).toFixed(6)} MPa (hand ${(hand.base / 1e6).toFixed(6)}, rel ${rb.toExponential(2)}); salt adds ${((iv[0].overburdenBase - iv[0].overburdenTop) / 1e6).toFixed(4)} MPa`)
    expect(rt).toBeLessThan(1e-9)
    expect(rb).toBeLessThan(1e-9)
  })
  it('depth and thickness fields', () => {
    const iv = saltIntervals(eng, P, sl, 1)[0]
    expect(Math.abs(iv.topDepth / hand.topDepth - 1)).toBeLessThan(1e-12)
    expect(iv.thickness).toBe(1000)
    expect(iv.baseDepth - iv.topDepth).toBeCloseTo(1000, 9)
    expect(iv.topElev - iv.baseElev).toBeCloseTo(1000, 9)
    expect(iv.welded).toBe(false)
    expect(iv.weldAge).toBeNull()
  })
  it('stress on the basement is the whole column; columns without salt have no interval', () => {
    const out = new Float64Array(eng.rec.nLayers)
    columnOverburden(eng, P, sl, 1, out)
    expect(out[0]).toBeGreaterThan(out[1])
    expect(out[1]).toBeCloseTo(saltIntervals(eng, P, sl, 1)[0].overburdenBase, 3)
    expect(saltIntervals(eng, P, sl, 0)).toEqual([])
    expect(allSaltIntervals(eng, P, sl).map((i) => i.column)).toEqual([1])
  })
  it('on land (sea level below the surface) there is no water load', () => {
    const land = saltIntervals(eng, P, -5000, 1)[0]
    expect(Math.abs(land.overburdenTop / (hand.top - RHO_W * G * 600) - 1)).toBeLessThan(1e-9)
  })
})

describe('salt intervals after welding', () => {
  it('a welded column lists a zero-thickness interval with its age; a thin column that never welded does not claim a weld', () => {
    const P = baseP({ nx: 3, dx: 1000, weldThick: 10 })
    const rec = createRecord({ nx: 3, dx: 1000, capacity: 4, startAgeMa: 0, preLayers: 2 })
    for (let j = 0; j < 3; j++) {
      rec.material[j] = SALT
      rec.mud[3 + j] = 100
    }
    rec.mud[0] = 0 // welded: salt gone
    rec.mud[1] = 5 // thin from the start, never welded
    rec.mud[2] = 500
    markInitialLedger(rec)
    const eng = allocateEngine(rec)
    eng.phm.fill(0.4)
    eng.weldAge[0] = 1.5
    const a = saltIntervals(eng, P, 0, 0)
    expect(a.length).toBe(1)
    expect(a[0].thickness).toBe(0)
    expect(a[0].welded).toBe(true)
    expect(a[0].weldAge).toBe(1.5)
    const b = saltIntervals(eng, P, 0, 1)[0]
    expect(b.welded).toBe(false)
    expect(b.weldAge).toBeNull()
    expect(saltIntervals(eng, P, 0, 2)[0].welded).toBe(false)
  })
})

// ---- temperature through salt vs hand calculation ------------------------------------------------
describe('temperature through 1,000 m of salt', () => {
  const P = baseP({ nx: 1, dx: 1000, thermal: 1 })
  const q = P.heatFlow
  /** Column: sediment layer (mud, 0.4 porosity) under 500 m of sediment, then `mid` = salt or mud, then 500 m of mud on top. */
  function column(saltCol: boolean): EngineState {
    const rec = createRecord({ nx: 1, dx: 1000, capacity: 5, startAgeMa: 0, preLayers: 1 })
    rec.nLayers = 3
    rec.mud[0] = 300 // bottom: mud solids, bulk 500
    if (saltCol) {
      rec.mud[1] = 1000
      rec.material[1] = SALT
    } else rec.mud[1] = 600 // bulk 1000
    rec.mud[2] = 300 // top: bulk 500
    markInitialLedger(rec)
    const eng = allocateEngine(rec)
    eng.phm.fill(0.4)
    rec.b[0] = -3500
    recomputeH(eng, P)
    return eng
  }
  const kMud = cellConductivity(P, 0, 300, 0.4)
  const tSf = P.tSeaShallow // zero water depth: land / sea level
  it('matches a hand calculation of steady conduction with k(T) (RK4 integration, 1e-9)', () => {
    const eng = column(true)
    const sl = eng.rec.H[0] // sea level at the surface: water depth 0, surface at tSeaShallow
    const out = new Float64Array(3)
    columnTemperatures(eng, P, 0, 3, sl, out)
    // hand: top cell (bulk 500, k = kMud), then the salt by integrating dT/dz = q / k(T)
    const tSaltTop = tSf + (q * 500) / kMud
    let T = tSaltTop
    const n = 4000
    const dz = 1000 / n
    const f = (t: number): number => q / saltConductivity(P, t)
    for (let s = 0; s < n; s++) {
      const k1 = f(T), k2 = f(T + 0.5 * dz * k1), k3 = f(T + 0.5 * dz * k2), k4 = f(T + dz * k3)
      T += (dz / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
    }
    const tSaltBase = T
    // model: mid of the salt cell, and the base from the exact formula
    const model = saltTemperatureAt(P, tSaltTop, q, 1000)
    expect(Math.abs(model / tSaltBase - 1)).toBeLessThan(1e-9)
    // the temperature at the middle of the bottom mud cell is the base of the salt + q * 250 / kMud
    expect(Math.abs(out[0] / (tSaltBase + (q * 250) / kMud) - 1)).toBeLessThan(1e-9)
    expect(Math.abs(out[2] / (tSf + (q * 250) / kMud) - 1)).toBeLessThan(1e-9)
  })
  it('the sediment above the salt is unchanged, everything below is cooler; report the difference at the base of the salt', () => {
    const withSalt = column(true)
    const without = column(false)
    const a = new Float64Array(3)
    const b = new Float64Array(3)
    columnTemperatures(withSalt, P, 0, 3, withSalt.rec.H[0], a)
    columnTemperatures(without, P, 0, 3, without.rec.H[0], b)
    const tTop = tSf + (q * 500) / kMud
    const baseSalt = saltTemperatureAt(P, tTop, q, 1000)
    const baseMud = tTop + (q * 1000) / kMud
    console.log(`temperature at the base of 1,000 m of salt: ${baseSalt.toFixed(3)} C; same column with 1,000 m of mud instead: ${baseMud.toFixed(3)} C; difference ${(baseSalt - baseMud).toFixed(3)} C. Salt conductivity at 0 C ${saltConductivity(P, 0).toFixed(3)}, at 60 C ${saltConductivity(P, 60).toFixed(3)} W/m/K; mud ${kMud.toFixed(3)} W/m/K. Mid-cell of the bottom mud cell: ${a[0].toFixed(3)} C with salt, ${b[0].toFixed(3)} C without.`)
    expect(a[2]).toBe(b[2]) // above the salt: identical
    expect(a[0]).toBeLessThan(b[0] - 5) // below: cooler
    expect(baseSalt).toBeLessThan(baseMud - 5)
  })
  it('conductivity of salt is 5 to 6.5 W/m/K near the surface and falls with temperature', () => {
    expect(saltConductivity(P, 20)).toBeGreaterThan(5)
    expect(saltConductivity(P, 20)).toBeLessThan(6.5)
    expect(saltConductivity(P, 100)).toBeLessThan(saltConductivity(P, 20))
  })
  it('c = 0 (no temperature dependence) is plain conduction: T = Tsf + 0.99 q z / k0', () => {
    const P0 = { ...P, saltKa: 0, saltKb: 0 }
    expect(saltTemperatureAt(P0, 20, q, 1000)).toBeCloseTo(20 + (0.99 * q * 1000) / P.saltK0, 12)
  })
})

// ---- pore pressure above salt ---------------------------------------------------------------------
describe('pore pressure in the sediment above salt', () => {
  /** Same sediment with and without a salt layer under it, loaded by four new layers; compaction solved after each. */
  function load(withSalt: boolean): { rec: EngineState['rec']; off: number } {
    const P = baseP({ nx: 2, dx: 1000 })
    const off = withSalt ? 1 : 0
    const rec = createRecord({ nx: 2, dx: 1000, capacity: 8, startAgeMa: 1, preLayers: withSalt ? 2 : 1 })
    const eng = allocateEngine(rec)
    if (withSalt) {
      for (let j = 0; j < 2; j++) {
        rec.mud[j] = 800
        rec.material[j] = SALT
      }
    }
    for (let j = 0; j < 2; j++) {
      rec.sand[off * 2 + j] = 30
      rec.mud[off * 2 + j] = 120
    }
    rebuildCaches(eng, P) // older cover in equilibrium with its own load: no excess pressure yet
    for (let n = 0; n < 4; n++) {
      const k = appendLayer(rec, 20000, 1 - n * 0.02, (n + 1) * 20000)
      for (let j = 0; j < 2; j++) {
        rec.sand[k * 2 + j] = 25 + 5 * n
        rec.mud[k * 2 + j] = 75 + 10 * n
        setPor(eng, P, k * 2 + j, 0)
      }
      for (let j = 0; j < 2; j++) compactColumn(eng, P, j, k, 20000)
    }
    markInitialLedger(rec)
    return { rec, off }
  }
  it('salt as a no-flow base gives exactly the salt-free solution (same machine)', () => {
    const A = load(true)
    const B = load(false)
    expect(A.rec.nLayers).toBe(B.rec.nLayers + 1)
    let maxU = 0
    for (let l = 0; l < B.rec.nLayers; l++) {
      for (let j = 0; j < 2; j++) {
        const iB = l * 2 + j
        const iA = (l + 1) * 2 + j
        expect(A.rec.u[iA]).toBe(B.rec.u[iB])
        expect(A.rec.smax[iA]).toBe(B.rec.smax[iB])
        maxU = Math.max(maxU, B.rec.u[iB])
      }
    }
    console.log(`pore pressure above salt: largest excess pressure ${(maxU / 1e3).toFixed(2)} kPa, identical with and without the salt layer`)
    expect(maxU).toBeGreaterThan(0) // the comparison is not of zeros
    // the salt itself is untouched: no pores, no excess pressure, no change of thickness
    for (let j = 0; j < 2; j++) {
      expect(A.rec.u[j]).toBe(0)
      expect(A.rec.smax[j]).toBe(0)
      expect(A.rec.mud[j]).toBe(800)
    }
  })
})

// ---- slope failure over salt ----------------------------------------------------------------------
describe('slope failure over salt', () => {
  const run = runFull(undefined, [], { ...WELDING, failOn: 1, phiFric: [16, 9] })
  it('failures happen, move no salt, and sand, mud and salt each balance', () => {
    const { eng } = run
    const b = recordBalance(eng.rec)
    console.log(`MTD over salt: ${eng.events.length} failures, clipped ${eng.diag.saltClip}; salt ${b.salt.relError.toExponential(2)}, sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}`)
    expect(eng.events.length).toBeGreaterThan(0)
    expect(Math.abs(b.salt.relError)).toBeLessThan(1e-12)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(eng.diag.saltClip).toBe(0)
  })
})

// ---- salt off ---------------------------------------------------------------------------------------
describe('salt off changes nothing', () => {
  const off = runFull(undefined, [])
  it('no weld ages, no limiter activity, no salt', () => {
    expect(off.eng.weldAge.every((a) => a === WELD_NONE)).toBe(true)
    expect(off.eng.diag.saltLimited).toBe(0)
    expect(off.eng.diag.saltLimitedVol).toBe(0)
    expect(allSaltIntervals(off.eng, off.P, 0)).toEqual([])
  })
  it('the new parameters do not enter a salt-off run: changing them gives the same record', () => {
    const other = runFull(undefined, [], { weldThick: 150, saltK0: 5, saltKa: 0.006, saltKb: 0.01, thermal: 1 })
    const same = runFull(undefined, [], { thermal: 1 })
    expect(stateHash(other.eng.rec)).toBe(stateHash(same.eng.rec))
  })
})

