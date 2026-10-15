import { describe, it, expect } from 'vitest'
import { allocateEngine } from '../src/engine/state'
import { compactColumn, porosity, rebuildCaches } from '../src/engine/compaction'
import { DRHO_G, MU, YR } from '../src/engine/constants'
import { defaultEngineParams } from '../src/engine/engineParams'
import { createRecord } from '../src/engine/record'

// ---- Gibson (1958) ---------------------------------------------------------------------------
// A layer grows at constant rate m on an impermeable base. With U = u/(gamma' h), X = z/h
// (z up from the base), T = m^2 t / c_v, the excess pore pressure is
//   U(X,T) = 1 - 2/sqrt(pi T) * Integral_0^inf  e tanh(sqrt(T) e) [exp(-(e-a)^2) + exp(-(e+a)^2)] de,
//   a = X sqrt(T)/2.
// Written here from the published solution, independent of the engine (trapezoid rule).
function gibsonAnalytic(X: number, T: number): number {
  const a = (X * Math.sqrt(T)) / 2
  const sT = Math.sqrt(T)
  const top = a + 12
  const N = 24000
  const h = top / N
  const f = (e: number) => e * Math.tanh(sT * e) * (Math.exp(-((e - a) ** 2)) + Math.exp(-((e + a) ** 2)))
  let sum = 0.5 * (f(0) + f(top))
  for (let i = 1; i < N; i++) sum += f(i * h)
  return 1 - (2 / Math.sqrt(Math.PI * T)) * sum * h
}

/** Single column in constant-property mode (void ratio e0, compressibility C, permeability k). */
function gibsonNumeric(T: number, nSteps = 400): { X: number[]; U: number[] } {
  const m = 1e-3 // m/yr deposition rate (bulk)
  const tEnd = 1e6
  const dt = tEnd / nSteps
  const e0 = 1
  const mv = 1e-8
  const cv = (m * m * tEnd) / T // m^2/yr, chosen so T = m^2 tEnd / cv
  const k = (cv * MU * mv) / YR
  const P = defaultEngineParams()
  P.nx = 1
  P.linear = { e0, C: mv * (1 + e0), k }
  const rec = createRecord({ nx: 1, dx: 1, capacity: nSteps + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  rebuildCaches(eng, P, rec.capacity)
  const solidPerStep = (m * dt) / (1 + e0)
  for (let s = 0; s < nSteps; s++) {
    rec.mud[s] = solidPerStep
    compactColumn(eng, P, 0, s, dt)
  }
  const h = m * tEnd
  const gp = DRHO_G / (1 + e0)
  const X: number[] = []
  const U: number[] = []
  for (let s = 0; s < nSteps; s++) {
    X.push((s + 0.5) / nSteps)
    U.push(rec.u[s] / (gp * h))
  }
  return { X, U }
}

describe('Gibson (1958) consolidation benchmark', () => {
  for (const T of [0.1, 1, 10]) {
    it(`T = ${T}: max error < 0.001 of overburden`, () => {
      const { X, U } = gibsonNumeric(T)
      let maxErr = 0
      for (let i = 0; i < X.length; i++) maxErr = Math.max(maxErr, Math.abs(U[i] - gibsonAnalytic(X[i], T)))
      console.log(`Gibson T=${T}: max |error| = ${maxErr.toExponential(3)} of overburden`)
      expect(maxErr).toBeLessThan(0.001)
    })
  }
})

// ---- Drained compaction vs Sclater & Christie (1980) -----------------------------------------
// Slow deposition into a very permeable column stays hydrostatic, so porosity follows the
// Athy depth curve phi = phi0 exp(-c z): sand 0.49 exp(-0.27 z), mud 0.63 exp(-0.51 z), z in km.
function drained(lith: 0 | 1, depthTarget: number) {
  const P = defaultEngineParams()
  P.kMudMult = 1e6
  P.kA = [-10, -10]
  P.kB = [0, 0]
  const nSteps = 600
  const dt = 5000
  const rate = (depthTarget / (nSteps * dt)) * 1.7
  const rec = createRecord({ nx: 1, dx: 1, capacity: nSteps + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  rebuildCaches(eng, P, rec.capacity)
  for (let s = 0; s < nSteps; s++) {
    const solid = rate * dt * (1 - P.phi0[lith])
    if (lith === 0) rec.sand[s] = solid
    else rec.mud[s] = solid
    compactColumn(eng, P, 0, s, dt)
  }
  const profile: { z: number; phi: number }[] = []
  let z = 0
  let maxLam = 0
  for (let s = nSteps - 1; s >= 0; s--) {
    const phi = porosity(P, lith, rec.smax[s])
    const h = (rec.sand[s] + rec.mud[s]) / (1 - phi)
    profile.push({ z: z + h / 2, phi })
    maxLam = Math.max(maxLam, rec.u[s] / eng.ld[s])
    z += h
  }
  return { profile, maxLam }
}

describe('drained compaction vs Sclater & Christie (1980)', () => {
  const cases: [string, 0 | 1, number][] = [['sand', 0, 0.286], ['mud', 1, 0.227]]
  for (const [name, lith, target] of cases) {
    it(`${name} porosity at 2 km is within 0.02 of ${target}`, () => {
      const r = drained(lith, 3000)
      const at2km = r.profile.reduce((a, b) => (Math.abs(b.z - 2000) < Math.abs(a.z - 2000) ? b : a))
      console.log(`${name}: porosity at ${at2km.z.toFixed(0)} m = ${at2km.phi.toFixed(3)} (S&C ${target}); max overpressure ratio ${r.maxLam.toExponential(2)}`)
      expect(Math.abs(at2km.phi - target)).toBeLessThan(0.02)
      expect(r.maxLam).toBeLessThan(0.01) // stayed hydrostatic, so the comparison is fair
    })
  }
})
