// M3.1 salt flow: benchmarks against exact solutions or hand calculations, salt and sand/mud
// balance, determinism and rewind with salt on, salt off changes nothing, spike comparison.
// Cross-machine rule (D16.4): numbers that John's PC and Linux CI must share are compared with
// stated bands or tolerances and summary statistics; only same-machine checks use exact equality.
import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { G, RHO_S, RHO_W, RHO_SALT, YR } from '../src/engine/constants'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { createRecord, markInitialLedger, recordBalance, SALT, SEDIMENT, storedVolumes } from '../src/engine/record'
import { saltPotential, saltSedimentLoads, saltStep, saltVolume } from '../src/engine/salt'
import { allocateEngine, type EngineState } from '../src/engine/state'
import { createEngine, restoreEngine, step } from '../src/engine/step'
import { buildSchedule } from '../src/engine/schedule'
import { runFull, seaLevelOf } from './helpers/run'
import { summarizeRecord } from '../src/engine/summary'

/** A bare salt sheet under deep water: one layer (salt), basement at -3000 - h0. */
function bareSalt(P: EngineParams, nx: number, thickness: (j: number) => number): EngineState {
  const rec = createRecord({ nx, dx: P.dx, capacity: 3, startAgeMa: 0 })
  for (let j = 0; j < nx; j++) {
    const h = thickness(j)
    rec.mud[j] = h
    rec.material[j] = SALT
    rec.b[j] = -3000 - 1500
    rec.H[j] = rec.b[j] + h
  }
  markInitialLedger(rec)
  return allocateEngine(rec)
}

const baseP = (over: Partial<EngineParams>): EngineParams => ({ ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, ...over })

describe('salt: linear lubrication benchmark', () => {
  // A small cosine bump on a flat salt sheet of thickness h0 under deep water relaxes at
  // rate r = h0^3 (rho_salt - rho_w) g k^2 / (12 eta) (thin-sheet theory, wavenumber k).
  const nx = 100
  const dx = 1000
  const h0 = 1500
  const amp = 0.1
  const rows: string[] = []
  const cases: Array<[number, number]> = []
  for (const eta of [1e17, 1e18]) for (const wavelengthKm of [25, 50, 100, 200]) cases.push([wavelengthKm, eta])
  for (const [wavelengthKm, eta] of cases) {
    it(`wavelength ${wavelengthKm} km, eta ${eta.toExponential(0)} Pa s: decay rate within 1 %`, () => {
      const mode = (2 * nx * dx) / 1000 / wavelengthKm // cos(pi mode x / L) has wavelength 2L/mode
      const P = baseP({ nx, dx, saltVisc: eta, nSaltSub: 20 })
      const eng = bareSalt(P, nx, (j) => h0 + amp * Math.cos((Math.PI * mode * (j + 0.5)) / nx))
      const k = (Math.PI * mode) / (nx * dx)
      const r = ((h0 * h0 * h0) / (12 * eta)) * (RHO_SALT - RHO_W) * G * k * k // 1/s
      const efoldYr = 1 / r / YR
      const dtYr = efoldYr / 50
      const tEnd = 50 * dtYr
      for (let s = 0; s < 50; s++) saltStep(eng, P, 0, dtYr)
      let num = 0
      let den = 0
      for (let j = 0; j < nx; j++) {
        const c = Math.cos((Math.PI * mode * (j + 0.5)) / nx)
        num += (eng.rec.mud[j] - h0) * c
        den += c * c
      }
      const rNum = -Math.log(num / den / amp) / (tEnd * YR)
      const err = rNum / r - 1
      rows.push(`${wavelengthKm} km | ${eta.toExponential(0)} | analytic ${r.toExponential(4)} /s | measured ${rNum.toExponential(4)} /s | error ${(err * 100).toFixed(3)} %`)
      expect(Math.abs(err)).toBeLessThan(0.01)
      expect(eng.diag.saltClip).toBe(0)
      // salt volume is conserved by the flux form
      expect(Math.abs(saltVolume(eng.rec) / (nx * dx * h0) - 1)).toBeLessThan(1e-12)
    })
  }
  it('prints the benchmark table', () => {
    console.log('salt decay benchmark (wavelength | eta | analytic | measured | error):\n' + rows.join('\n'))
    expect(rows.length).toBe(cases.length)
  })
})

describe('salt: load-step flux against a hand calculation', () => {
  it('potential step is the buoyant weight of the load (1e-9) and the flux is Poiseuille (0.1 %)', () => {
    const nx = 40
    const h0 = 1500
    const solid = 100
    const P = baseP({ nx, saltVisc: 1e18, nSaltSub: 1, coverBend: 0 }) // thin-sheet hand calculation: no bending
    const eng = bareSalt(P, nx, () => h0)
    // 100 m of mud solids (porosity 0.4) on the left half, layer 1
    const rec = eng.rec
    rec.nLayers = 2
    for (let j = 0; j < nx / 2; j++) {
      rec.mud[nx + j] = solid
      eng.phm[nx + j] = 0.4
    }
    saltSedimentLoads(eng, P)
    const pot = saltPotential(eng, P, 0)
    const dPhi = pot.Phi[nx / 2 - 1] - pot.Phi[nx / 2]
    const dPhiHand = (RHO_S - RHO_W) * G * solid
    expect(Math.abs(dPhi / dPhiHand - 1)).toBeLessThan(1e-9)
    const qHand = ((h0 * h0 * h0) / (12 * P.saltVisc)) * (dPhiHand / P.dx) // m^2/s
    const before = Float64Array.from(rec.mud.subarray(0, nx))
    const dtYr = 1
    saltStep(eng, P, 0, dtYr)
    let moved = 0
    for (let j = nx / 2; j < nx; j++) moved += (rec.mud[j] - before[j]) * P.dx
    const qNum = moved / (dtYr * YR)
    console.log(`load step: dPhi ${(dPhi / 1e6).toFixed(6)} MPa (hand ${(dPhiHand / 1e6).toFixed(6)}), flux ${(qNum * YR).toFixed(4)} m2/yr (hand ${(qHand * YR).toFixed(4)}), error ${((qNum / qHand - 1) * 100).toFixed(4)} %`)
    expect(Math.abs(qNum / qHand - 1)).toBeLessThan(1e-3)
  })
})

// ---- full runs -------------------------------------------------------------------------------
// The spike's own control values: eta 1e17 (tuned so flow shows in 3 Myr).
const SPIKE = { saltOn: 1, saltVisc: 1e17 }
const run1 = runFull(undefined, [300], SPIKE)

describe('salt on: full 3 Myr run', () => {
  it('conserves salt, sand and mud separately, and clips nothing', () => {
    const { eng } = run1
    const b = recordBalance(eng.rec)
    const v0 = eng.rec.ledger.init.salt
    const v1 = saltVolume(eng.rec)
    const rel = Math.abs(v1 - v0) / v0
    console.log(`salt balance: start ${(v0 / 1e6).toFixed(4)} km2, end ${(v1 / 1e6).toFixed(4)} km2, rel ${rel.toExponential(2)}, clipped ${eng.diag.saltClip}; sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}`)
    expect(v0).toBeGreaterThan(0)
    expect(rel).toBeLessThan(1e-12)
    expect(eng.diag.saltClip).toBe(0)
    expect(Math.abs(b.salt.relError)).toBeLessThan(1e-12)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(eng.diag.deficit).toBe(0)
    // salt never leaks into the sand/mud totals and the stored classes agree with the tag
    expect(storedVolumes(eng.rec).salt).toBeCloseTo(v1, 3)
  })

  it('has the two pre-run layers: salt, then older cover, both with zero step length', () => {
    const rec = run1.eng.rec
    expect(rec.nPre).toBe(2)
    expect(rec.nLayers).toBe(run1.schedule.nSteps + 2)
    expect(rec.stepDt[0]).toBe(0)
    expect(rec.stepDt[1]).toBe(0)
    for (let j = 0; j < rec.nx; j++) {
      expect(rec.material[j]).toBe(SALT)
      expect(rec.material[rec.nx + j]).toBe(SEDIMENT)
      expect(rec.sand[j]).toBe(0)
    }
  })

  it('spike comparison: the wedge sinks into the salt and pushes it basinward (bands, summary statistics)', () => {
    const { eng, P } = run1
    const rec = eng.rec
    const km = (j: number): number => ((j + 0.5) * P.dx) / 1000
    let shelfMin = Infinity
    let basinMax = 0
    for (let j = 0; j < rec.nx; j++) {
      if (km(j) >= 45 && km(j) <= 90) shelfMin = Math.min(shelfMin, rec.mud[j])
      if (km(j) >= 100) basinMax = Math.max(basinMax, rec.mud[j])
    }
    console.log(`spike comparison: salt under the shelf/upper slope (45-90 km) minimum ${shelfMin.toFixed(0)} m (spike 160-280 m); basinward (>100 km) maximum ${basinMax.toFixed(0)} m (spike about 2000 m, start 1500 m)`)
    expect(shelfMin).toBeGreaterThan(100)
    expect(shelfMin).toBeLessThan(400)
    expect(basinMax).toBeGreaterThan(1700)
    expect(basinMax).toBeLessThan(2400) // SFM-1 (D31): was 2300; with the open basinward edge the measured maximum is 2325 m (Windows, node 26); band widened to the next round number, not tuned
  })
})

describe('salt on: determinism and rewind (same machine, exact)', () => {
  it('a second run gives the same stateHash', () => {
    const again = runFull(undefined, [], SPIKE)
    expect(stateHash(again.eng.rec)).toBe(stateHash(run1.eng.rec))
  })

  it('snapshot at 1.5 Ma, restore into a fresh engine, replay: same stateHash', () => {
    const eng2 = createEngine(run1.P, run1.schedule)
    restoreEngine(run1.snaps.get(300)!, eng2, run1.P)
    const sl = seaLevelOf(run1.P, run1.schedule)
    while (step(eng2, run1.P, run1.schedule, sl)) { /* replay */ }
    expect(stateHash(eng2.rec)).toBe(stateHash(run1.eng.rec))
    expect(eng2.diag.saltClip).toBe(run1.eng.diag.saltClip)
  })

  it('bundled deep compaction: rewind from the middle of a cycle stays bit-exact (H is a running value)', () => {
    const over = { saltOn: 1, saltVisc: 1e17, bundleEvery: 10, bundleAgeYr: 100000 }
    const seg = [{ fromAgeMa: 1, toAgeMa: 0, dt: 5000 }]
    const full = runFull(seg, [57], over)
    const eng2 = createEngine(full.P, full.schedule)
    restoreEngine(full.snaps.get(57)!, eng2, full.P)
    const sl = seaLevelOf(full.P, full.schedule)
    while (step(eng2, full.P, full.schedule, sl)) { /* replay */ }
    expect(stateHash(eng2.rec)).toBe(stateHash(full.eng.rec))
    expect(Array.from(eng2.rec.H)).toEqual(Array.from(full.eng.rec.H))
  })
})

describe('salt off changes nothing', () => {
  const off = runFull(undefined, [])
  it('the record has the old layout: one pre-run layer, no salt anywhere', () => {
    const rec = off.eng.rec
    expect(rec.nPre).toBe(1)
    expect(rec.nLayers).toBe(off.schedule.nSteps + 1)
    for (let i = 0; i < rec.nLayers * rec.nx; i++) expect(rec.material[i]).not.toBe(SALT)
    expect(off.eng.diag.saltClip).toBe(0)
    expect(recordBalance(rec).salt.error).toBe(0)
  })

  it('saltStep returns at once and touches nothing when saltOn = 0', () => {
    const P = defaultEngineParams()
    const sch = buildSchedule([{ fromAgeMa: 0.05, toAgeMa: 0, dt: 5000 }])
    const eng = createEngine(P, sch)
    const before = stateHash(eng.rec)
    saltStep(eng, P, 0, 5000)
    expect(stateHash(eng.rec)).toBe(before)
  })

  it('summary statistics do not count salt as mud', () => {
    const s = summarizeRecord(run1.eng.rec)
    const st = storedVolumes(run1.eng.rec)
    expect(s.mud * run1.P.dx).toBeCloseTo(st.mud, 3)
  })
})
