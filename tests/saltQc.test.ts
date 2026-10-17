// SALT-1: salt QC checks 4, 5, 19 and 20 of docs/salt-literature.md section 11, as permanent tests.
// Tests only: nothing in src/engine changes. Each check calls src/engine/salt.ts directly.
//   QC 4   flux goes as h^3 (HJ07 p. 11; WJ11 Eq. 7)
//   QC 5a  uniform cover on a flat layer of uneven salt thickness: no flow (HJ07 Fig. 7c, p. 8)
//   QC 5b  cover density equal to salt density, uneven cover: no flow (GL24 Fig. 5a, p. 626)
//   QC 20  time to thin 100 m to 50 m against the lubrication solution (WJ11 Eq. 9, p. 313)
//   QC 19  Gulf preset end state: columns with thin salt (reported, not tested)
// Cross-machine rule (D16.4): the checks are ratios with stated tolerances. Nothing here counts
// columns near a threshold in a test; the QC 19 counts are printed only.
import { describe, expect, it } from 'vitest'
import { G, RHO_SALT, RHO_W, YR } from '../src/engine/constants'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { presetParams, presetSchedule } from '../src/engine/presets'
import { createRecord, markInitialLedger, SALT } from '../src/engine/record'
import { saltFluxes, saltPotential, saltPotentialOf, saltSedimentLoads, saltStep } from '../src/engine/salt'
import { allocateEngine, WELD_NONE, type EngineState } from '../src/engine/state'
import { createEngine, step } from '../src/engine/step'
import { seaLevelOf } from './helpers/run'

const baseP = (over: Partial<EngineParams>): EngineParams => ({ ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, ...over })

/**
 * A salt layer (record layer 0) on a basement `base(j)` with thickness `thick(j)`, and one cover layer
 * of `solid(j)` metres of mud solids (porosity 0.4) above it. Sea level is passed to the salt functions,
 * not stored, so each test picks its own.
 */
function build(P: EngineParams, nx: number, base: (j: number) => number, thick: (j: number) => number, solid: (j: number) => number): EngineState {
  const rec = createRecord({ nx, dx: P.dx, capacity: 3, startAgeMa: 0 })
  rec.nLayers = 2
  for (let j = 0; j < nx; j++) {
    rec.mud[j] = thick(j)
    rec.material[j] = SALT
    rec.b[j] = base(j)
    rec.H[j] = rec.b[j] + thick(j)
  }
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  for (let j = 0; j < nx; j++) {
    rec.mud[nx + j] = solid(j)
    eng.phm[nx + j] = 0.4
  }
  return eng
}

const maxAbs = (a: ArrayLike<number>): number => {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]))
  return m
}

/** Face fluxes (m^2/s) from the engine's own potential, for the record as it stands. */
function faceFluxes(eng: EngineState, P: EngineParams, SL: number): Float64Array {
  saltSedimentLoads(eng, P)
  saltPotential(eng, P, SL)
  const q = new Float64Array(eng.rec.nx - 1)
  saltFluxes(eng, P, q)
  return q
}

// ---- QC 4: flux goes as h^3 -------------------------------------------------------------------
// A flat salt sheet under deep water, cover load stepping by a fixed amount at the middle face: the
// same head difference for every thickness (the salt-weight term is the same on both sides because
// the salt thickness is uniform). Flux at that face should be 8 times larger for each doubling.
describe('QC 4: salt flux scales with thickness cubed (HJ07 p. 11; WJ11 Eq. 7)', () => {
  const nx = 40
  const mid = nx / 2 - 1
  const thick = [500, 1000, 2000] // h/2, h, 2h
  const results: Record<string, { face: number[]; step: number[] }> = {}
  for (const bend of [0, 1]) {
    const face: number[] = []
    const stepFlux: number[] = []
    for (const h of thick) {
      const P = baseP({ nx, saltVisc: 1e18, nSaltSub: 1, coverBend: bend })
      const eng = build(P, nx, () => -4500, () => h, (j) => (j < nx / 2 ? 100 : 0))
      face.push(faceFluxes(eng, P, 0)[mid])
      // the same set-up through one real salt step of 1 yr: salt that arrives in the right half
      const before = Float64Array.from(eng.rec.mud.subarray(0, nx))
      saltStep(eng, P, 0, 1)
      let moved = 0
      for (let j = nx / 2; j < nx; j++) moved += (eng.rec.mud[j] - before[j]) * P.dx
      stepFlux.push(moved / YR)
    }
    results[`bend${bend}`] = { face, step: stepFlux }
  }

  for (const bend of [0, 1]) {
    // Tolerance 1e-9: the face flux is an explicit formula, M = h_up^3 / (12 eta), times the same head difference.
    // The ratio is exact up to rounding of the head difference (a few ulp of 1e8 Pa on a difference of 1e6 Pa).
    it(`face flux ratio is 8 per doubling, cover bending ${bend ? 'on' : 'off'} (1e-9)`, () => {
      const { face } = results[`bend${bend}`]
      expect(Math.abs(face[1] / face[0] / 8 - 1)).toBeLessThan(1e-9)
      expect(Math.abs(face[2] / face[1] / 8 - 1)).toBeLessThan(1e-9)
      expect(Math.abs(face[2] / face[0] / 64 - 1)).toBeLessThan(1e-9)
    })
  }

  // Tolerance 0.5 %: the real step is backward Euler in the roof response, so it carries a relative error of
  // about c M a (c = dt / dx^2, a = drho g). Here that is 3e-5 at h = 1000 m and 2.4e-4 at 2000 m. 0.5 % is
  // about 20 times that; a wrong exponent (h^2 or h^4) would be off by 100 %.
  it('one real step, bending off: moved volume ratio is 8 per doubling (0.5 %)', () => {
    const { step: s } = results.bend0
    console.log(`QC 4 step ratios, bending off: ${(s[1] / s[0]).toFixed(5)}, ${(s[2] / s[1]).toFixed(5)} (expected 8)`)
    expect(Math.abs(s[1] / s[0] / 8 - 1)).toBeLessThan(0.005)
    expect(Math.abs(s[2] / s[1] / 8 - 1)).toBeLessThan(0.005)
  })

  // With bending on, the cover (a viscous plate) resists the change at once, and its resistance does not scale
  // with h^3, so the moved volume is NOT expected to scale as h^3. Only the direction is tested: the plate
  // can slow the flow, never speed it up. The ratios are printed.
  it('one real step, bending on: the plate only slows flow (ratios reported)', () => {
    const on = results.bend1.step
    const off = results.bend0.step
    console.log(`QC 4 step ratios, bending on: ${(on[1] / on[0]).toFixed(4)}, ${(on[2] / on[1]).toFixed(4)} (bending off: ${(off[1] / off[0]).toFixed(4)}, ${(off[2] / off[1]).toFixed(4)}); moved volume on/off at h = 500, 1000, 2000 m: ${on.map((v, i) => (v / off[i]).toFixed(4)).join(', ')}`)
    for (let i = 0; i < thick.length; i++) {
      expect(on[i]).toBeGreaterThan(0)
      expect(on[i]).toBeLessThanOrEqual(off[i] * (1 + 1e-9))
    }
  })
})

// ---- QC 5: null cases give no flow ------------------------------------------------------------
describe('QC 5a: uniform cover on a flat layer gives no flow where salt thickness varies (HJ07 Fig. 7c, p. 8)', () => {
  // HJ07 Fig. 7c: the salt layer's top is flat (head is uniform), the cover is uniform, and the salt
  // thickness varies because the base is uneven. Here: base = -4500 + 300 sin(...) m, roof flat at -3400 m,
  // cover of 100 m of mud solids everywhere. The reference has the SAME salt thickness field and the SAME
  // base, but the cover is 100 m on the left half only (an uneven load).
  const nx = 40
  const zRoof = -3400
  const base = (j: number) => -4500 + 300 * Math.sin((2 * Math.PI * (j + 0.5)) / 17)
  const thick = (j: number) => zRoof - base(j)
  for (const bend of [0, 1]) {
    it(`flux is below 1e-9 of the uneven-load reference, cover bending ${bend ? 'on' : 'off'}`, () => {
      const P = baseP({ nx, saltVisc: 1e18, nSaltSub: 5, coverBend: bend })
      const nullEng = build(P, nx, base, thick, () => 100)
      const refEng = build(P, nx, base, thick, (j) => (j < nx / 2 ? 100 : 0))
      const qNull = maxAbs(faceFluxes(nullEng, P, 0))
      const qRef = maxAbs(faceFluxes(refEng, P, 0))
      // one real 0.1 Myr step in both, so the bent path is exercised too
      const h0 = Float64Array.from(nullEng.rec.mud.subarray(0, nx))
      const r0 = Float64Array.from(refEng.rec.mud.subarray(0, nx))
      saltStep(nullEng, P, 0, 1e5)
      saltStep(refEng, P, 0, 1e5)
      const dNull = maxAbs(nullEng.rec.mud.subarray(0, nx).map((v, j) => v - h0[j]))
      const dRef = maxAbs(refEng.rec.mud.subarray(0, nx).map((v, j) => v - r0[j]))
      console.log(`QC 5a bend ${bend}: max face flux ${qNull.toExponential(2)} vs reference ${qRef.toExponential(2)} m2/s (ratio ${(qNull / qRef).toExponential(2)}); max |dh| in 0.1 Myr ${dNull.toExponential(2)} vs ${dRef.toExponential(2)} m`)
      expect(qRef).toBeGreaterThan(1e-8) // the reference really flows
      expect(dRef).toBeGreaterThan(0.01) // m: and really moves salt
      expect(qNull).toBeLessThan(1e-9 * qRef)
      expect(dNull).toBeLessThan(1e-9 * dRef)
    })
  }
})

describe('QC 5b: cover density equal to salt density gives no flow under uneven cover (GL24 Fig. 5a, p. 626)', () => {
  // The engine's cover density comes from the record (grain density 2650 kg/m3 and sea water in the pores),
  // so equal densities cannot be set up through the record without a code change. As the card allows, the
  // loads are prescribed instead: eng.salt.W (weight of the cover, Pa) and eng.salt.Sb (its thickness) are
  // written directly and the engine's own potential (saltPotentialOf) and flux (saltFluxes) are called.
  // Geometry: flat top surface at zs, cover thickness c(j) varying 800 to 1200 m, so the salt roof is at
  // zs - c(j) and the salt thickness varies with it. Sea level is far below the surface, so there is no water
  // term. With cover density = salt density, Phi = rho g c + rho g (zs - c) = rho g zs: uniform, so no flow.
  // The reference is the same geometry with a cover of 2400 kg/m3 (a normal sediment), which must flow.
  const nx = 40
  const zs = -3000
  const cover = (j: number) => 1000 + 200 * Math.sin((2 * Math.PI * (j + 0.5)) / 13)
  const flux = (rhoCover: number): Float64Array => {
    const P = baseP({ nx, saltVisc: 1e18, coverBend: 0 })
    const eng = build(P, nx, () => -6000, (j) => zs - cover(j) + 6000, () => 0)
    const S = eng.salt
    for (let j = 0; j < nx; j++) {
      S.Sb[j] = cover(j)
      S.W[j] = rhoCover * G * cover(j)
    }
    for (let j = 0; j < nx; j++) S.h[j] = eng.rec.mud[j]
    saltPotentialOf(eng, -1e5, S.h) // sea level far below: no water term
    const q = new Float64Array(nx - 1)
    saltFluxes(eng, P, q)
    return q
  }
  it('flux is below 1e-9 of the reference with a 2,400 kg/m3 cover', () => {
    const qEqual = maxAbs(flux(RHO_SALT))
    const qRef = maxAbs(flux(2400))
    console.log(`QC 5b: max face flux ${qEqual.toExponential(2)} (equal densities) vs ${qRef.toExponential(2)} m2/s (2,400 kg/m3 cover); ratio ${(qEqual / qRef).toExponential(2)}`)
    expect(qRef).toBeGreaterThan(1e-8)
    expect(qEqual).toBeLessThan(1e-9 * qRef)
  })
})

// ---- QC 20: weld thinning time ----------------------------------------------------------------
// WJ11 Eq. 9 (zero roof speed), as read in docs/salt-notes (checked against their 9.7 m at 200 Myr):
//     1/h^2 = 1/h0^2 + t P' / (6 mu L^2)      P' = pressure difference driving the flow, L = flow length.
// Engine set-up: column 0 holds the 100 m salt layer under a heavy cover; columns 1..nSink are a thick salt
// reservoir under no cover, which receives the salt. Face 0 is the only face with a head difference
// (the reservoir is level), the flow length is L = dx, and P' is the head difference the engine itself
// computes. Thinning column 0 loses a little head (the roof drops, a dh = (rho_salt - rho_w) g dh), so P'
// is not quite constant; with P' about 95 MPa and 50 m of thinning, the loss is about 0.3 % of P', which
// is why the tolerance is not tighter than 1 %. Cover bending is off (WJ11 has a rigid roof).
describe('QC 20: time to thin from 100 m to 50 m against WJ11 Eq. 9 (p. 313)', () => {
  const nSink = 60
  const nx = nSink + 1
  const mu = 1e17
  const h0 = 100
  const h1 = 50
  const dx = defaultEngineParams().dx

  interface Thin {
    tYr: number
    pPrime: number
    limited: number
    limitedVol: number
    steps: number
    clip: number
  }

  /** Step until column 0 is thinner than h1; time of crossing by linear interpolation inside the step. */
  function thin(solid: number, dtYr: number, maxSteps: number): Thin {
    const P = baseP({ nx, saltVisc: mu, coverBend: 0, nSaltSub: 5 })
    const eng = build(P, nx, () => -4500, (j) => (j === 0 ? h0 : 1500), (j) => (j === 0 ? solid : 0))
    const SL = 1e5 // m, far above: every column is under water (a = (rho_salt - rho_w) g everywhere)
    saltSedimentLoads(eng, P)
    const pot = saltPotential(eng, P, SL)
    const pPrime = pot.Phi[0] - pot.Phi[1]
    let t = 0
    let prev = h0
    let steps = 0
    while (steps < maxSteps) {
      saltStep(eng, P, SL, dtYr)
      steps++
      const h = eng.rec.mud[0]
      if (h <= h1) {
        t += ((prev - h1) / (prev - h)) * dtYr
        break
      }
      t += dtYr
      prev = h
    }
    return { tYr: t, pPrime, limited: eng.diag.saltLimited, limitedVol: eng.diag.saltLimitedVol, steps, clip: eng.diag.saltClip }
  }
  /** WJ11 Eq. 9 solved for t, in years. */
  const eq9Yr = (pPrime: number): number => (6 * mu * dx * dx * (1 / (h1 * h1) - 1 / (h0 * h0))) / pPrime / YR

  const solid = 6000 // m of mud solids on column 0: P' about 95 MPa, measured below
  const tEq = eq9Yr(thin(solid, 1, 0).pPrime)

  it('limiter never acts at fine steps, and the thinning time is within 1 % of Eq. 9', () => {
    const r = thin(solid, tEq / 400, 1000)
    const err = r.tYr / tEq - 1
    console.log(`QC 20 (P' ${(r.pPrime / 1e6).toFixed(2)} MPa, L ${dx} m, mu ${mu.toExponential(0)}): Eq. 9 ${tEq.toFixed(1)} yr, engine ${r.tYr.toFixed(1)} yr, error ${(err * 100).toFixed(3)} %, limiter fired ${r.limited} times, clip ${r.clip}, ${r.steps} steps`)
    expect(r.limited).toBe(0) // so "limiter off" and "limiter on" are the same run here
    expect(r.clip).toBe(0)
    expect(Math.abs(err)).toBeLessThan(0.01)
  })

  it('halving the step size moves the answer by less than 0.5 % (time-step error is small)', () => {
    const a = thin(solid, tEq / 400, 1000).tYr
    const b = thin(solid, tEq / 800, 2000).tYr
    expect(Math.abs(a / b - 1)).toBeLessThan(0.005)
  })

  // Report only: coarse steps where the weld limiter does fire, and the WJ11 Fig. 7a parameters.
  it('reports the limiter-on ratios and the WJ11 Fig. 7a case (no assertions on the ratios)', () => {
    const rows: string[] = []
    // The limiter only acts when a step would leave a column with less than 0 m, never at a fixed thickness, so
    // it cannot change the 100 to 50 m time unless one step asks for more salt than the column holds. Coarse
    // steps below show the time-step error (limiter silent); the last row (one step of 20 Eq. 9 times) is a
    // step so long that the limiter must fire.
    for (const div of [4, 2, 1]) {
      const r = thin(solid, tEq / div, 50)
      rows.push(`step = Eq. 9 time / ${div}: engine ${r.tYr.toFixed(0)} yr, ratio to Eq. 9 ${(r.tYr / tEq).toFixed(3)}, limiter fired ${r.limited} times (volume ${r.limitedVol.toFixed(2)} m2), clip ${r.clip}`)
    }
    const big = thin(solid, tEq * 20, 1)
    rows.push(`one step of 20 Eq. 9 times: crossed 50 m at ${big.tYr.toFixed(0)} yr (interpolated, ratio ${(big.tYr / tEq).toFixed(2)}), limiter fired ${big.limited} times (volume ${big.limitedVol.toFixed(2)} m2), clip ${big.clip}`)
    // WJ11 Fig. 7a: P' 1 MPa, L 1000 m, mu 1e17 Pa s: Eq. 9 gives about 5.7 Myr. Scale the cover to get P' = 1 MPa.
    // P' is linear in the cover (the salt-thickness difference adds a constant), so use two measurements.
    const pA = thin(0, 1, 0).pPrime
    const pB = thin(solid, 1, 0).pPrime
    const solid1 = (solid * (1e6 - pA)) / (pB - pA)
    const tWj = eq9Yr(1e6)
    const w = thin(solid1, 20000, 2000)
    rows.push(`WJ11 Fig. 7a values (P' ${(w.pPrime / 1e6).toFixed(3)} MPa): Eq. 9 ${(tWj / 1e6).toFixed(2)} Myr, engine ${(w.tYr / 1e6).toFixed(2)} Myr, ratio ${(w.tYr / tWj).toFixed(3)} (the roof drops as the layer thins, which costs ${(((RHO_SALT - RHO_W) * G * 50) / 1e6).toFixed(2)} MPa of the 1 MPa), limiter fired ${w.limited} times`)
    console.log('QC 20 report:\n' + rows.join('\n'))
    expect(rows.length).toBe(5)
  })
})

// ---- QC 19: thin salt in the Gulf preset (report only) ----------------------------------------
describe('QC 19: columns with thin salt at the end of the Gulf preset (reported, not tested)', () => {
  it('prints the counts at 100 m and 50 m', () => {
    const P = presetParams('gulf')
    const schedule = presetSchedule('gulf')
    const eng = createEngine(P, schedule)
    const sl = seaLevelOf(P, schedule)
    while (step(eng, P, schedule, sl)) {
      /* run to the end */
    }
    const nx = eng.rec.nx
    const h = eng.rec.mud.subarray(0, nx)
    let under100 = 0
    let under50 = 0
    let zero = 0
    let weldCols = 0
    let weld50to100 = 0
    let weldUnder50 = 0
    let weldMin = Infinity
    for (let j = 0; j < nx; j++) {
      const isWeld = eng.weldAge[j] !== WELD_NONE // was at least weldThick thick, now thinner
      if (h[j] <= 0) zero++
      else {
        if (h[j] < 100) under100++
        if (h[j] < 50) under50++
      }
      if (isWeld) {
        weldCols++
        weldMin = Math.min(weldMin, h[j])
        if (h[j] < 50) weldUnder50++
        else if (h[j] < 100) weld50to100++
      }
    }
    console.log(
      `QC 19, Gulf preset end state (${nx} columns, dx ${P.dx} m, weldThick ${P.weldThick} m): ` +
        `columns with 0 < salt < 100 m: ${under100}; with 0 < salt < 50 m: ${under50}; with no salt: ${zero}. ` +
        `Of the columns that were ever thicker than weldThick and are now thinner (${weldCols}): ${weldUnder50} under 50 m, ${weld50to100} from 50 to 100 m; thinnest ${weldMin === Infinity ? 'n/a' : weldMin.toFixed(2) + ' m'}. ` +
        `diag: saltClip ${eng.diag.saltClip}, saltLimited ${eng.diag.saltLimited} (cell-substeps), saltLimitedVol ${eng.diag.saltLimitedVol.toExponential(2)} m2, saltLimitMaxH ${eng.diag.saltLimitMaxH.toFixed(2)} m.`,
    )
    // Only checks that the run finished and nothing was clipped; the counts sit near thresholds (D16.4).
    expect(nx).toBeGreaterThan(0)
    expect(eng.diag.saltClip).toBe(0)
  }, 120_000)
})
