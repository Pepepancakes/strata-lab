// Compaction and pore pressure: 1D consolidation of each column, in solid coordinates.
//
// Equations (spike 001 / Gibson 1958 / Athy 1930 / Sclater & Christie 1980):
//   porosity from past-maximum effective stress s':   phi = phi0 exp(-beta s')   (Athy form)
//   buoyant load at a layer mid-point:                L = (rho_s - rho_w) g (solids above + half own)
//   excess pore pressure u obeys  A du/dt = d/dz( k/mu du/dz ) + A dL/dt  per layer, with
//   A = solid thickness x compressibility C, C = fs beta phi/(1-phi)^2 + (1-fs) (same, mud),
//   vertical flow across interbeds k = harmonic mix of sand and mud permeability,
//   permeability law log10 k = kA + kB phi (mud scaled by kMudMult),
//   unloading (effective stress below its past maximum) uses C x `elastic`.
//   Solved implicitly (backward Euler, tridiagonal), free drainage at the top, no flow at the base.
// Assumptions: 1D vertical flow; sand and mud share one cell as an effective mix; load is
//   buoyant (hydrostatic removed); no chemical compaction.
// Salt (material = SALT) is skipped: it neither compacts nor adds load in M1 (salt flow is M3).
// Benchmarks: Gibson (1958) for u; drained porosity vs Sclater & Christie (1980) at 2 km.
// Parameter sources: see params.ts (phi0, beta cited; permeability and elastic tuned).

import * as K from './constants'
import type { EngineParams } from './engineParams'
import { SALT as SALT_TAG } from './record'
import type { EngineState } from './state'
import { thomas } from './thomas'

// Local copies of imported constants: reading an imported binding inside a hot loop is several
// times slower under the test runner's module transform (measured: 3 Myr run 5 s vs 2 s).
const { DRHO_G, EMPTY, MU, MUD, SAND, YR } = K
const SALT = SALT_TAG

export function porosity(P: EngineParams, lith: number, s: number): number {
  return P.phi0[lith] * Math.exp(-P.beta[lith] * (s > 0 ? s : 0))
}

export function voidRatio(P: EngineParams, lith: number, s: number): number {
  const p = porosity(P, lith, s)
  return p / (1 - p)
}

export function perm(P: EngineParams, lith: number, phi: number): number {
  let lk = P.kA[lith] + P.kB[lith] * phi
  if (lith === MUD && P.kMudMult !== 1) lk += Math.log10(P.kMudMult) // log10(1) = 0 exactly, so skipping it changes nothing
  return Math.pow(10, lk)
}

/** Set cached porosity and permeability of cell i from effective stress sig. */
export function setPor(eng: EngineState, P: EngineParams, i: number, sig: number): void {
  // Inlined copy of porosity() and perm() (same arithmetic, so same bits): this runs ~14 million
  // times in a 3 Myr run and the function calls were the largest avoidable cost.
  const s = sig > 0 ? sig : 0
  const a = P.phi0[SAND] * Math.exp(-P.beta[SAND] * s)
  const b = P.phi0[MUD] * Math.exp(-P.beta[MUD] * s)
  eng.phs[i] = a
  eng.phm[i] = b
  eng.kps[i] = Math.pow(10, P.kA[SAND] + P.kB[SAND] * a)
  let lk = P.kA[MUD] + P.kB[MUD] * b
  if (P.kMudMult !== 1) lk += Math.log10(P.kMudMult)
  eng.kpm[i] = Math.pow(10, lk)
}

/**
 * Buoyant load at a cell mid-point. The ONE expression used by compactColumn and loadsInto, so
 * restore() reproduces the cached load bit for bit (handover trap). Do not inline or reorder.
 */
export function buoyantLoad(above: number, solid: number): number {
  return DRHO_G * (above + 0.5 * solid)
}

/** Bulk thickness of a cell (solids plus pores). Salt has no pores. */
export function cellBulk(eng: EngineState, P: EngineParams, i: number): number {
  const rec = eng.rec
  const s = rec.sand[i]
  const m = rec.mud[i]
  if (s + m <= 0) return 0
  if (rec.material[i] === SALT) return s + m
  if (P.linear) return (s + m) * (1 + P.linear.e0)
  return s / (1 - eng.phs[i]) + m / (1 - eng.phm[i])
}

/** Surface elevation of every column = basement + all layers. */
export function recomputeH(eng: EngineState, P: EngineParams): void {
  const rec = eng.rec
  const nx = rec.nx
  for (let j = 0; j < nx; j++) {
    let z = rec.b[j]
    for (let l = 0; l < rec.nLayers; l++) z += cellBulk(eng, P, l * nx + j)
    rec.H[j] = z
  }
}

/** Cached loads of column j, layers top..0 (used after restore). */
export function loadsInto(eng: EngineState, j: number, top: number): void {
  const rec = eng.rec
  const nx = rec.nx
  let above = 0
  for (let l = top; l >= 0; l--) {
    const i = l * nx + j
    if (rec.material[i] === SALT) continue
    const s = rec.sand[i] + rec.mud[i]
    if (s <= EMPTY) continue
    eng.ld[i] = buoyantLoad(above, s)
    above += s
  }
}

/** Rebuild everything derived from the record: porosity, permeability, loads. */
export function rebuildCaches(eng: EngineState, P: EngineParams, layers: number = eng.rec.nLayers): void {
  const rec = eng.rec
  const n = layers * rec.nx
  eng.ld.fill(0)
  for (let i = 0; i < n; i++) setPor(eng, P, i, rec.smax[i])
  for (let j = 0; j < rec.nx; j++) loadsInto(eng, j, layers - 1)
}

/** 1D consolidation of column j over layers 0..top for a step of dtYr years. */
export function compactColumn(eng: EngineState, P: EngineParams, j: number, top: number, dtYr: number): void {
  const rec = eng.rec
  const nx = rec.nx
  const S = eng.scratch
  const idx = S.idx
  const { sand, mud, smax, u, material } = rec
  const { phs, phm, kps, kpm, ld } = eng
  let n = 0
  for (let l = 0; l <= top; l++) {
    const i = l * nx + j
    if (material[i] !== SALT && sand[i] + mud[i] > EMPTY) idx[n++] = i
  }
  if (n === 0) return
  const L = S.L, A = S.A, hh = S.hh, kk = S.kk, T = S.T
  let above = 0
  for (let m = n - 1; m >= 0; m--) {
    const i = idx[m]
    const s = sand[i] + mud[i]
    L[m] = buoyantLoad(above, s)
    above += s
  }
  for (let m = 0; m < n; m++) {
    const i = idx[m]
    const s = sand[i] + mud[i]
    let C: number, k: number, h: number
    if (P.linear) {
      C = P.linear.C
      k = P.linear.k
      h = s * (1 + P.linear.e0)
    } else {
      const fs = sand[i] / s
      const sm = smax[i]
      const phS = phs[i], phM = phm[i]
      const kS = kps[i], kM = kpm[i]
      h = sand[i] / (1 - phS) + mud[i] / (1 - phM)
      k = 1 / (fs / kS + (1 - fs) / kM) // vertical flow across interbeds
      const Cl = fs * P.beta[SAND] * phS / ((1 - phS) * (1 - phS)) + (1 - fs) * P.beta[MUD] * phM / ((1 - phM) * (1 - phM))
      C = L[m] - u[i] >= sm ? Cl : P.elastic * Cl
    }
    A[m] = s * C
    hh[m] = h
    kk[m] = k
  }
  for (let m = 0; m < n - 1; m++) T[m] = 1 / (hh[m] / (2 * kk[m]) + hh[m + 1] / (2 * kk[m + 1]))
  const Ttop = 2 * kk[n - 1] / hh[n - 1]
  const w = dtYr * YR / MU
  for (let m = 0; m < n; m++) {
    const i = idx[m]
    const lo = m > 0 ? -w * T[m - 1] : 0
    const up = m < n - 1 ? -w * T[m] : 0
    S.lo[m] = lo
    S.up[m] = up
    S.di[m] = A[m] - lo - up + (m === n - 1 ? w * Ttop : 0)
    S.rhs[m] = A[m] * (u[i] + (L[m] - ld[i]))
  }
  thomas(n, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp)
  for (let m = 0; m < n; m++) {
    const i = idx[m]
    let uu = S.x[m]
    if (uu > L[m]) {
      uu = L[m]
      eng.diag.clamps++
    }
    u[i] = uu
    const sig = L[m] - uu
    if (sig > smax[i]) {
      smax[i] = sig
      setPor(eng, P, i, sig)
    }
    ld[i] = L[m]
  }
}
