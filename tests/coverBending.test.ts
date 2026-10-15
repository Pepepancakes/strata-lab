// M3.2 cover bending stiffness: dispersion benchmark against linear theory, grid convergence of the
// diapir width (with and without bending), coverBend = 0 is M3.1 exactly, salt conserved, determinism.
// Cross-machine rule (D16.4): numbers that John's PC and Linux CI must share are compared with
// stated tolerances and summary statistics; only same-machine checks use exact equality.
//
// THE PROBLEM THE DISPERSION TEST SOLVES (the engine case and the analytic case are the same problem)
// A flat salt channel of thickness h under a cover of thickness h_c and density rho_c (dry solids,
// no pores, so rho_c = RHO_S), the seafloor held level by sedimentation filling lows and eroding
// highs (the differential-loading setup of Gemmer et al. 2004). A small roof bump w = A cos(kx) then
// changes the load on the salt by -rho_c g w while the salt weight in the channel rises by rho_s g w,
// so the net drive is -(rho_c - rho_s) g w (dense cover over lighter salt: unstable). The cover
// resists bending as a viscous plate, D = eta_c h_c^3 / 3 (Turcotte & Schubert), which adds the
// pressure D d^4(dw/dt)/dx^4 on the roof. Thin-sheet flow, dh/dt = (h^3 / 12 eta_s) d2(Phi)/dx2, then
// gives  sigma(k) = drho g h^3 k^2 / (12 eta_s + D h^3 k^6)  (see salt.ts, derivation in the header).
// In the test the level surface is imposed by resetting the cover thickness before every salt step.
import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { G, RHO_S, RHO_SALT, RHO_W, YR } from '../src/engine/constants'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { createRecord, markInitialLedger, recordBalance, SALT } from '../src/engine/record'
import { saltStep, saltVolume } from '../src/engine/salt'
import { allocateEngine, type EngineState } from '../src/engine/state'
import { createEngine, restoreEngine, step } from '../src/engine/step'
import { runFull, seaLevelOf } from './helpers/run'

const NX = 200
const DX = 250
const H0 = 1500 // salt thickness
const HC = 1000 // cover thickness
const ETA_S = 1e17
const ETA_C = 1e19
const AMP = 0.1

const baseP = (over: Partial<EngineParams>): EngineParams => ({ ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, nx: NX, dx: DX, saltVisc: ETA_S, coverVisc: ETA_C, nSaltSub: 1, ...over })

/** Salt layer 0 (cosine bump of amplitude AMP, mode m) under a one-layer cover (layer 1, no pores). */
function channel(m: number, hc: number): EngineState {
  const rec = createRecord({ nx: NX, dx: DX, capacity: 4, startAgeMa: 0, preLayers: 2 })
  for (let j = 0; j < NX; j++) {
    rec.mud[j] = H0 + AMP * Math.cos((Math.PI * m * (j + 0.5)) / NX)
    rec.material[j] = SALT
    rec.b[j] = -4500
    rec.mud[NX + j] = hc
    rec.H[j] = rec.b[j] + rec.mud[j] + hc
  }
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  eng.phm.fill(0)
  eng.phs.fill(0)
  return eng
}

/** Amplitude of the cosine mode m in the salt thickness. */
function modeAmp(eng: EngineState, m: number): number {
  let num = 0
  let den = 0
  for (let j = 0; j < NX; j++) {
    const c = Math.cos((Math.PI * m * (j + 0.5)) / NX)
    num += (eng.rec.mud[j] - H0) * c
    den += c * c
  }
  return num / den
}

/** Measured growth rate (1/s) of mode m over about one e-fold (decay: a fraction of one). `levelSurface`: reset the cover so the seafloor stays level. */
function measure(P: EngineParams, m: number, sigma: number, levelSurface: boolean, nSteps = 1600): number {
  const eng = channel(m, HC)
  const dtYr = 1 / Math.abs(sigma) / YR / nSteps
  const top = eng.rec.b[0] + H0 + HC
  for (let s = 0; s < nSteps; s++) {
    if (levelSurface) for (let j = 0; j < NX; j++) eng.rec.mud[NX + j] = top - (eng.rec.b[j] + eng.rec.mud[j])
    saltStep(eng, P, levelSurface ? -1e6 : 0, dtYr)
  }
  expect(eng.diag.saltClip).toBe(0)
  expect(Math.abs(saltVolume(eng.rec) / (NX * DX * H0) - 1)).toBeLessThan(1e-12)
  return Math.log(modeAmp(eng, m) / AMP) / (nSteps * dtYr * YR)
}

const D = (ETA_C * HC ** 3) / 3
const sigmaDense = (k: number): number => ((RHO_S - RHO_SALT) * G * H0 ** 3 * k * k) / (12 * ETA_S + D * H0 ** 3 * k ** 6)
const sigmaWater = (k: number): number => (-(RHO_SALT - RHO_W) * G * H0 ** 3 * k * k) / (12 * ETA_S + D * H0 ** 3 * k ** 6)
const kOf = (m: number): number => (Math.PI * m) / (NX * DX)
const lambdaStar = 2 * Math.PI * Math.pow((ETA_C * HC ** 3 * H0 ** 3) / (18 * ETA_S), 1 / 6)

describe('cover bending: dispersion relation (dense cover, level seafloor)', () => {
  const modes = [2, 4, 7, 10, 14, 18, 22] // wavelengths 50, 25, 14.3, 10, 7.1, 5.6, 4.5 km (the 3 shortest are still 18 cells or more per wavelength)
  const rows: string[] = []
  let peakM = 0
  let peakRate = -Infinity
  for (const m of modes) {
    it(`mode ${m} (wavelength ${((2 * NX * DX) / m / 1000).toFixed(1)} km): growth rate within 2 % of sigma(k)`, () => {
      const k = kOf(m)
      const sa = sigmaDense(k)
      const sm = measure(baseP({ coverBend: 1 }), m, sa, true)
      const err = sm / sa - 1
      rows.push(`${((2 * NX * DX) / m / 1000).toFixed(1)} km | k ${k.toExponential(3)} /m | analytic ${(sa * YR).toExponential(4)} /yr | measured ${(sm * YR).toExponential(4)} /yr | error ${(err * 100).toFixed(3)} %`)
      if (sm > peakRate) {
        peakRate = sm
        peakM = m
      }
      expect(Math.abs(err)).toBeLessThan(0.02)
    })
  }
  it('prints the dispersion table and the fastest-growing wavelength is within 5 % of lambda*', () => {
    console.log(`dispersion (wavelength | k | analytic | measured | error), lambda* = ${(lambdaStar / 1000).toFixed(2)} km:\n` + rows.join('\n'))
    // fit a parabola through the three highest measured points in 1/log-wavelength to find the peak
    const ks = modes.map(kOf)
    const meas = modes.map((m) => {
      const r = rows.find((x) => x.startsWith(`${((2 * NX * DX) / m / 1000).toFixed(1)} km`))!
      return +r.split('measured ')[1].split(' /yr')[0] / YR
    })
    const i = meas.indexOf(Math.max(...meas))
    const x = [Math.log(ks[i - 1]), Math.log(ks[i]), Math.log(ks[i + 1])]
    const y = [meas[i - 1], meas[i], meas[i + 1]]
    // vertex of the parabola through three points
    const d1 = (y[1] - y[0]) / (x[1] - x[0])
    const d2 = (y[2] - y[1]) / (x[2] - x[1])
    const a = (d2 - d1) / (x[2] - x[0])
    const b = d1 - a * (x[0] + x[1])
    const xPeak = -b / (2 * a)
    const lamMeasured = (2 * Math.PI) / Math.exp(xPeak)
    console.log(`fastest-growing wavelength: measured ${(lamMeasured / 1000).toFixed(2)} km (parabola through the 3 highest points), analytic ${(lambdaStar / 1000).toFixed(2)} km, grid-mode maximum at ${((2 * NX * DX) / peakM / 1000).toFixed(1)} km`)
    expect(Math.abs(lamMeasured / lambdaStar - 1)).toBeLessThan(0.05)
  })
})

describe('cover bending: stable case (roof under water, cover rides on the roof)', () => {
  for (const m of [4, 10, 20]) {
    it(`mode ${m}: decay rate within 2 % of the bending-modified thin-sheet theory`, () => {
      const k = kOf(m)
      const sa = sigmaWater(k)
      // submerged cover riding on the roof: sea level well above the surface
      const sm = measure(baseP({ coverBend: 1 }), m, sa, false)
      expect(Math.abs(sm / sa - 1)).toBeLessThan(0.02)
    })
  }
  it('no cover, bending on: the M3.1 decay rate (bare sheet, nothing to bend)', () => {
    const m = 10
    const P = baseP({ coverBend: 1 })
    const eng = channel(m, 0)
    const r = ((H0 ** 3 * (RHO_SALT - RHO_W) * G * kOf(m) ** 2) / (12 * ETA_S))
    const dtYr = 1 / r / YR / 50
    for (let s = 0; s < 50; s++) saltStep(eng, P, 0, dtYr)
    const rNum = -Math.log(modeAmp(eng, m) / AMP) / (50 * dtYr * YR)
    expect(Math.abs(rNum / r - 1)).toBeLessThan(0.02)
  })
})

describe('cover bending: coverBend = 0 is the M3.1 scheme, and the bending matrix reduces to it', () => {
  it('coverBend = 0 ignores coverVisc: runs with different coverVisc are bit-identical', () => {
    const a = runFull(undefined, [], { saltOn: 1, coverBend: 0, coverVisc: 1e19, bundleEvery: 1 })
    const b = runFull(undefined, [], { saltOn: 1, coverBend: 0, coverVisc: 3e21 })
    expect(stateHash(a.eng.rec)).toBe(stateHash(b.eng.rec))
  }, 60000)

  it('a cover with no stiffness (coverVisc ~ 0) gives the M3.1 answer: the 7-band system reduces to the tridiagonal one (1e-9)', () => {
    const run = (over: Partial<EngineParams>): Float64Array => {
      const P = baseP({ saltVisc: 1e18, ...over })
      const eng = channel(7, 1000)
      for (let s = 0; s < 20; s++) saltStep(eng, P, 0, 2000)
      return Float64Array.from(eng.rec.mud.subarray(0, NX))
    }
    const off = run({ coverBend: 0 })
    const tiny = run({ coverBend: 1, coverVisc: 1e-30 })
    let d = 0
    let m = 0
    for (let j = 0; j < NX; j++) {
      d = Math.max(d, Math.abs(off[j] - tiny[j]))
      m = Math.max(m, Math.abs(off[j] - H0))
    }
    expect(m).toBeGreaterThan(0) // something moved
    expect(d / m).toBeLessThan(1e-9)
  })
})

describe('cover bending on, 3 Myr full run (default coverVisc)', () => {
  const SPIKE = { saltOn: 1, saltVisc: 1e17, coverBend: 1 }
  const run1 = runFull(undefined, [300], SPIKE)
  const off = runFull(undefined, [], { ...SPIKE, coverBend: 0 })

  it('conserves salt (1e-12), sand and mud separately, and clips nothing', () => {
    const { eng } = run1
    const b = recordBalance(eng.rec)
    const v0 = eng.rec.ledger.init.salt
    const rel = Math.abs(saltVolume(eng.rec) - v0) / v0
    console.log(`bending on, 3 Myr: salt rel ${rel.toExponential(2)}, clipped ${eng.diag.saltClip}, sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}`)
    expect(rel).toBeLessThan(1e-12)
    expect(eng.diag.saltClip).toBe(0)
    expect(Math.abs(b.salt.relError)).toBeLessThan(1e-12)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
  })

  it('bending changes the answer (the term is live) but keeps the M3.1 summary: shelf salt thin, basinward salt thicker (bands)', () => {
    const rec = run1.eng.rec
    const km = (j: number): number => ((j + 0.5) * run1.P.dx) / 1000
    let shelfMin = Infinity
    let basinMax = 0
    let diff = 0
    for (let j = 0; j < rec.nx; j++) {
      if (km(j) >= 45 && km(j) <= 90) shelfMin = Math.min(shelfMin, rec.mud[j])
      if (km(j) >= 100) basinMax = Math.max(basinMax, rec.mud[j])
      diff = Math.max(diff, Math.abs(rec.mud[j] - off.eng.rec.mud[j]))
    }
    console.log(`bending on: shelf minimum ${shelfMin.toFixed(0)} m, basinward maximum ${basinMax.toFixed(0)} m, largest difference from bending off ${diff.toFixed(1)} m`)
    expect(shelfMin).toBeGreaterThan(100)
    expect(shelfMin).toBeLessThan(400)
    expect(basinMax).toBeGreaterThan(1700)
    expect(basinMax).toBeLessThan(2300)
    expect(diff).toBeGreaterThan(0)
  })

  it('a second run gives the same stateHash; snapshot at 1.5 Ma, restore, replay: same stateHash (same machine, exact)', () => {
    const again = runFull(undefined, [], SPIKE)
    expect(stateHash(again.eng.rec)).toBe(stateHash(run1.eng.rec))
    const eng2 = createEngine(run1.P, run1.schedule)
    restoreEngine(run1.snaps.get(300)!, eng2, run1.P)
    const sl = seaLevelOf(run1.P, run1.schedule)
    while (step(eng2, run1.P, run1.schedule, sl)) { /* replay */ }
    expect(stateHash(eng2.rec)).toBe(stateHash(run1.eng.rec))
  })

  it.skipIf(!!process.env.CI)('costs less than 1.5x the run without bending (same machine, wall clock)', () => {
    console.log(`3 Myr salt-on run: bending off ${off.ms.toFixed(0)} ms, bending on ${run1.ms.toFixed(0)} ms (ratio ${(run1.ms / off.ms).toFixed(2)})`)
    expect(run1.ms).toBeLessThan(1.5 * off.ms + 200)
  })
})

describe('salt off: the new parameters change nothing', () => {
  it('coverBend and coverVisc do not touch a salt-off run', () => {
    const a = runFull([{ fromAgeMa: 0.3, toAgeMa: 0, dt: 5000 }], [])
    const b = runFull([{ fromAgeMa: 0.3, toAgeMa: 0, dt: 5000 }], [], { coverBend: 0, coverVisc: 1e22 })
    expect(stateHash(a.eng.rec)).toBe(stateHash(b.eng.rec))
    expect(a.eng.rec.nPre).toBe(1)
  })
})
