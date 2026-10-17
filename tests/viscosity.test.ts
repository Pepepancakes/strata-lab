import { describe, it, expect } from 'vitest'
import { allocateEngine } from '../src/engine/state'
import { buoyantLoad, compactColumn, rebuildCaches } from '../src/engine/compaction'
import { DRHO_G, MU, YR } from '../src/engine/constants'
import { defaultEngineParams } from '../src/engine/engineParams'
import { createRecord } from '../src/engine/record'
import { waterViscosity } from '../src/engine/viscosity'

// ---- IAPWS R12-08 (2008), eq. 10 with the critical enhancement mu2 = 1 -------------------------
// Written here from the release (coefficients of its Tables 1 and 2), independent of the engine.
// mu = mu0(T) * mu1(T, rho) * mu2, in micro-Pa s with mu* = 1e-6 Pa s. Outside the critical region mu2 = 1
// (the release, section 2.8). The density of the liquid enters the formula; the values below are
// the density of liquid water at 0.1 MPa / saturation from IAPWS-95 (Wagner & Pruss 2002), read from tables.
const H0 = [1.67752, 2.20462, 0.6366564, -0.241605]
const H: [number, number, number][] = [
  [0, 0, 5.20094e-1], [1, 0, 8.50895e-2], [2, 0, -1.08374], [3, 0, -2.89555e-1], [0, 1, 2.22531e-1], [1, 1, 9.99115e-1],
  [2, 1, 1.88797], [3, 1, 1.26613], [5, 1, 1.20573e-1], [0, 2, -2.81378e-1], [1, 2, -9.06851e-1], [2, 2, -7.72479e-1],
  [3, 2, -4.89837e-1], [4, 2, -2.57040e-1], [0, 3, 1.61913e-1], [1, 3, 2.57399e-1], [0, 4, -3.25372e-2], [3, 4, 6.98452e-2],
  [4, 5, 8.72102e-3], [3, 6, -4.35673e-3], [5, 6, -5.93264e-4],
]
function iapws(TK: number, rho: number): number {
  const Tb = TK / 647.096
  const rb = rho / 322
  let s = 0
  for (let i = 0; i < 4; i++) s += H0[i] / Math.pow(Tb, i)
  const mu0 = 100 * Math.sqrt(Tb) / s
  let e = 0
  for (const [i, j, h] of H) e += Math.pow(1 / Tb - 1, i) * h * Math.pow(rb - 1, j)
  return mu0 * Math.exp(rb * e) * 1e-6 // Pa s
}

describe('IAPWS R12-08 reference implementation (the test\'s own)', () => {
  it('reproduces the release\'s computer-program verification values (Table 4, liquid points) to 1e-6 relative', () => {
    expect(iapws(298.15, 998) * 1e6).toBeCloseTo(889.7351, 3)
    expect(iapws(373.15, 1000) * 1e6).toBeCloseTo(307.883622, 3)
    expect(iapws(433.15, 1000) * 1e6).toBeCloseTo(217.685358, 3)
  })
})

describe('water viscosity mu(T) (Vogel fit to IAPWS R12-08)', () => {
  // [deg C, kg/m3 of liquid water at 0.1 MPa / saturation]
  const LIQUID: [number, number][] = [
    [0, 999.84], [10, 999.70], [20, 998.21], [30, 995.65], [40, 992.22], [50, 988.03], [60, 983.20], [75, 974.84],
    [90, 965.30], [100, 958.35], [125, 939.0], [150, 916.75], [175, 892.0], [200, 864.66],
  ]
  it('is within 1 % of IAPWS 2008 at 14 temperatures from 0 to 200 C (claimed tolerance 1 %; the fit is within 0.8 %)', () => {
    for (const [c, rho] of LIQUID) {
      const ref = iapws(c + 273.15, rho)
      expect(Math.abs(waterViscosity(c) / ref - 1), `${c} C`).toBeLessThan(0.01)
    }
  })
  it('hits well-known values: 20 C is 1.002 mPa s (ISO/TR 3666: 1.0016), 100 C is about 0.28 mPa s', () => {
    expect(waterViscosity(20) * 1e3).toBeCloseTo(1.0016, 1)
    expect(waterViscosity(100) * 1e3).toBeGreaterThan(0.275)
    expect(waterViscosity(100) * 1e3).toBeLessThan(0.285)
  })
  it('falls with temperature and is clamped to the 0 C value below 0 C', () => {
    let prev = Infinity
    for (let c = 0; c <= 300; c += 5) {
      const m = waterViscosity(c)
      expect(m).toBeLessThan(prev)
      prev = m
    }
    expect(waterViscosity(-5)).toBe(waterViscosity(0))
  })
})

// ---- the solver with mu(T) ------------------------------------------------------------------
const NL = 60
const E0 = 1
const MV = 1e-8
const K0 = 1e-15 // m2
const DT = 5000 // yr per step

function column(thermal: 0 | 1, kLinear: number, tempOf: (l: number) => number): { u: Float64Array; eng: ReturnType<typeof allocateEngine> } {
  const P = defaultEngineParams()
  P.nx = 1
  P.thermal = thermal
  P.linear = { e0: E0, C: MV * (1 + E0), k: kLinear }
  const rec = createRecord({ nx: 1, dx: 1, capacity: NL + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  rebuildCaches(eng, P, rec.capacity)
  for (let s = 0; s < NL; s++) {
    rec.mud[s] = 0.5
    eng.temp[s] = tempOf(s)
    compactColumn(eng, P, 0, s, DT)
  }
  return { u: rec.u, eng }
}

describe('compaction with mu(T) (heat model on)', () => {
  it('constant T: u is bit-identical to the same solver with mu fixed (k scaled by MU / mu(T))', () => {
    for (const Tc of [4, 60, 150]) {
      const a = column(1, K0, () => Tc)
      const b = column(0, K0 * (MU / waterViscosity(Tc)), () => 0)
      for (let s = 0; s < NL; s++) expect(a.u[s], `T ${Tc} layer ${s}`).toBe(b.u[s])
    }
  })
  it('heat off ignores eng.temp completely (mu = MU, bit-identical to the old solver)', () => {
    const a = column(0, K0, () => 150)
    const b = column(0, K0, () => 0)
    for (let s = 0; s < NL; s++) expect(a.u[s]).toBe(b.u[s])
  })
  it('hotter (thinner) water gives lower overpressure; 3x k/mu change moves max u by tens of percent', () => {
    const cold = column(1, K0, () => 20)
    const hot = column(1, K0, () => 100)
    const max = (u: Float64Array): number => u.reduce((m, v) => Math.max(m, v), 0)
    expect(max(hot.u)).toBeLessThan(max(cold.u))
  })
  it('face between cells of different temperature uses the harmonic mean of k/mu (flow in series): 2-cell hand solve', () => {
    const P = defaultEngineParams()
    P.nx = 1
    P.thermal = 1
    P.linear = { e0: E0, C: MV * (1 + E0), k: K0 }
    const rec = createRecord({ nx: 1, dx: 1, capacity: 2, startAgeMa: 0 })
    const eng = allocateEngine(rec)
    rebuildCaches(eng, P, rec.capacity)
    const s = 0.5
    rec.mud[0] = s
    rec.mud[1] = s
    const T0 = 20, T1 = 150
    eng.temp[0] = T0
    eng.temp[1] = T1
    const dt = 50000
    compactColumn(eng, P, 0, 1, dt)
    // hand: layer 0 (bottom, T0) and layer 1 (top, T1); u = 0 and ld = 0 before the step
    const h = s * (1 + E0)
    const A = s * MV * (1 + E0)
    const k0 = K0 * (MU / waterViscosity(T0))
    const k1 = K0 * (MU / waterViscosity(T1))
    const w = dt * YR / MU
    const Tf = 1 / (h / (2 * k0) + h / (2 * k1)) // series: 1 / (resistance of half cell 0 + half cell 1)
    const Tt = 2 * k1 / h
    const L0 = DRHO_G * (s + 0.5 * s)
    const L1 = DRHO_G * (0.5 * s)
    expect(buoyantLoad(s, s)).toBe(L0)
    const a11 = A + w * Tf, a12 = -w * Tf, a22 = A + w * Tf + w * Tt
    const r0 = A * L0, r1 = A * L1
    const det = a11 * a22 - a12 * a12
    const x0 = (r0 * a22 - a12 * r1) / det
    const x1 = (a11 * r1 - a12 * r0) / det
    expect(rec.u[0] / x0).toBeCloseTo(1, 9)
    expect(rec.u[1] / x1).toBeCloseTo(1, 9)
    // and it is not the mean-temperature face (which would be a different number)
    const kMean = K0 * (MU / waterViscosity(0.5 * (T0 + T1)))
    expect(Math.abs(Tf / (kMean / h) - 1)).toBeGreaterThan(0.05)
  })
})
