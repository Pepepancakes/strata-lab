// Salt flow (M3.1): thin-sheet (lubrication) viscous flow of the salt layer under the sediment.
// Ported from spike 002 (spikes/002-salt/engine.js: saltPotential, saltStep, sedimentLoads).
// Off by default (saltOn = 0): then nothing in this file runs and the record is the M1/M2 record.
//
// What is modelled. The salt is one layer (record layer 0, every cell tagged SALT, thickness h in
// `mud`) on the basement. It flows sideways as a thin viscous sheet squeezed between the basement
// (no slip) and the sediment above (no slip), driven by differences in the pressure the cover
// puts on it. Columns do not move sideways (D10): they ride up and down on the salt, so a change
// of salt thickness lifts or lowers everything above it by the same amount (basement b is fixed).
//
// Equations (SI). Channel flow between two no-slip plates a distance h apart, pressure gradient
// dp/dx, Newtonian viscosity eta (Poiseuille flow; Turcotte & Schubert, Geodynamics, channel-flow
// chapter; a "thin-sheet" or lubrication approximation, valid when h is much smaller than the
// horizontal length scale):
//     depth-integrated flux      q = -(h^3 / (12 eta)) dPhi/dx                      [m^2/s]
// Phi is the driving potential: the pressure in the salt at a fixed elevation, i.e. the vertical
// load on the salt roof plus the weight of salt up to the roof elevation (horizontal pressure
// gradient in the salt at a fixed level; the hydrostatic part in the salt itself cancels):
//     Phi = W + rho_w g wd + rho_salt g z_roof
//     W        weight of the sediment above the salt = g sum( solids rho_s + pore water rho_w )   [Pa]
//     wd       water depth above the seafloor where the column is submerged, else the term is 0   [m]
//     z_roof   salt roof elevation = b + h                                                        [m]
// Mass: dh/dt = -dq/dx (salt volume per metre of margin is conserved).
//
// Numerics. Cells of width dx. Flux between columns f and f+1 in conservative (flux) form, so the
// salt volume is conserved to rounding error:
//     q_f = -M_f (Phi_{f+1} - Phi_f) / dx,    M_f = h_up^3 / (12 eta)
// The face mobility uses the thickness of the UPSTREAM cell (the one with higher Phi): an empty
// cell cannot send salt, and a cell pinched to zero cannot choke the flow it receives.
// The response of the water load to a thickness change is implicit: a column that thickens by dh
// raises its roof, so Phi changes by a dh with a = (rho_salt - rho_w) g where the roof is under
// water and a = rho_salt g where it is not (the seafloor then rises with the roof and the water
// term does not change). The tridiagonal system for the thickness change dh over a substep dt is
//     dh_j - (dt/dx^2) [ M_j ((Phi_{j+1} + a_{j+1} dh_{j+1}) - (Phi_j + a_j dh_j))
//                      - M_{j-1} ((Phi_j + a_j dh_j) - (Phi_{j-1} + a_{j-1} dh_{j-1})) ] = 0
// solved with thomas.ts. The sediment load W and the sediment thickness are taken once per record
// step from the compacted record (the spike did the same); the potential is rebuilt in each of
// `nSaltSub` substeps because the roof moves. The scheme is first order in time (backward Euler in
// the water-load response), second order in space.
//
// Where it runs inside step() (step.ts): last of the physical processes of the record step, after
// compaction and pore pressure (spike 002 order), before the thermal and failure steps; sea level
// is taken at the middle of the step. The new thickness is written back to layer 0 and the
// surface H is updated to match (step.ts).
//
// Clipping. A thickness that would go below 0 is set to 0 and the missing volume is counted in
// diag.saltClip (and booked as salt coming in, so the ledger still closes). It must be 0 in every
// benchmark of this card. Welds and their limiter come in M3.3.
//
// Cover bending stiffness (M3.2) is NOT here: thin-sheet flow alone makes the narrowest bumps grow
// fastest, so diapirs collapse to a few grid cells (handover trap). Do not read widths off this yet.
//
// References: Turcotte & Schubert, Geodynamics (channel flow); Hudec & Jackson (2007), Earth-Sci.
// Rev. 82 (halite density 2,160 kg/m^3, viscosity range); Ge, Jackson & Vendeville (1997) for the
// expulsion ahead of a prograding wedge (to verify). Benchmarks: tests/salt.test.ts (decay of a
// thickness bump against linear theory, load-step flux against a hand calculation).

import { G, RHO_S, RHO_SALT, RHO_W, YR } from './constants'
import { cellBulk } from './compaction'
import type { EngineParams } from './engineParams'
import { createRng } from './rng'
import { SALT, type LayerRecord } from './record'
import type { EngineState, SaltScratch } from './state'
import { thomas } from './thomas'

/** Record layer that holds the salt (M3.1: only layer 0). */
export const SALT_LAYER = 0

/** Smooth start-up thickness: 0 landward of the first pinch-out edge, full basinward of the second (smoothstep). */
export function initialSaltThickness(P: EngineParams, x: number): number {
  const x0 = P.saltPinchStart
  const x1 = P.saltPinchEnd
  let f = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)))
  f = f * f * (3 - 2 * f)
  return P.saltThick * f
}

/**
 * Relative thickness variation of the older cover, one value per column, max |value| = coverUneven.
 * Seeded white noise (rng.ts) smoothed over +-3 columns, as in spike 002. All zeros when coverUneven is 0.
 */
export function coverUnevenness(P: EngineParams): Float64Array {
  const nx = P.nx
  const out = new Float64Array(nx)
  if (!(P.coverUneven > 0)) return out
  const rng = createRng(P.coverSeed)
  const raw = new Float64Array(nx)
  for (let j = 0; j < nx; j++) raw[j] = rng.next() - 0.5
  const R = 3
  let mx = 0
  for (let j = 0; j < nx; j++) {
    let a = 0
    let c = 0
    for (let d = -R; d <= R; d++) {
      const q = j + d
      if (q >= 0 && q < nx) {
        a += raw[q]
        c++
      }
    }
    out[j] = a / c
    mx = Math.max(mx, Math.abs(out[j]))
  }
  if (mx > 0) for (let j = 0; j < nx; j++) out[j] *= P.coverUneven / mx
  return out
}

/** Salt volume stored in the salt layer, m^2 (thickness summed over columns x dx). */
export function saltVolume(rec: LayerRecord): number {
  let v = 0
  for (let j = 0; j < rec.nx; j++) v += rec.mud[SALT_LAYER * rec.nx + j] + rec.sand[SALT_LAYER * rec.nx + j]
  return v * rec.dx
}

/**
 * Weight of the sediment above the salt (W, Pa) and its bulk thickness (Sb, m), per column, from the
 * record as it is now: every non-salt cell above the salt layer counts solids at rho_s and pore
 * water at rho_w. Salt cells have no pores and are not counted here.
 */
export function saltSedimentLoads(eng: EngineState, P: EngineParams): void {
  const rec = eng.rec
  const nx = rec.nx
  const S = eng.salt
  for (let j = 0; j < nx; j++) {
    let w = 0
    let sb = 0
    for (let l = SALT_LAYER + 1; l < rec.nLayers; l++) {
      const i = l * nx + j
      if (rec.material[i] === SALT) continue
      const sol = rec.sand[i] + rec.mud[i]
      if (sol <= 0) continue
      const bulk = cellBulk(eng, P, i)
      w += sol * RHO_S + (bulk - sol) * RHO_W
      sb += bulk
    }
    S.W[j] = w * G
    S.Sb[j] = sb
  }
}

/**
 * Driving potential at the salt roof, Phi = W + rho_w g wd + rho_salt g z_roof, and its response
 * a = dPhi/dh to a thickness change (see header). `h` is the salt thickness per column (the working
 * array during a step); sea level `SL` in m. Needs saltSedimentLoads() first. Returns the scratch.
 */
export function saltPotentialOf(eng: EngineState, SL: number, h: Float64Array): SaltScratch {
  const rec = eng.rec
  const S = eng.salt
  for (let j = 0; j < rec.nx; j++) {
    const zr = rec.b[j] + h[j]
    const wd = SL - (zr + S.Sb[j])
    S.Phi[j] = S.W[j] + (wd > 0 ? RHO_W * G * wd : 0) + RHO_SALT * G * zr
    S.aw[j] = (wd > 0 ? RHO_SALT - RHO_W : RHO_SALT) * G
  }
  return S
}

/** Same, using the thickness stored in the record. */
export function saltPotential(eng: EngineState, _P: EngineParams, SL: number): SaltScratch {
  const rec = eng.rec
  const S = eng.salt
  for (let j = 0; j < rec.nx; j++) S.h[j] = rec.mud[SALT_LAYER * rec.nx + j]
  return saltPotentialOf(eng, SL, S.h)
}

/**
 * Face mobility M_f = h_up^3 / (12 eta) from the upstream (higher-potential) column, f = 0..nx-2.
 * Units m^3/(Pa s) -> multiplied by dPhi/dx (Pa/m) gives m^2/s.
 */
function faceMobility(S: SaltScratch, h: Float64Array, nx: number, eta: number): void {
  const e12 = 12 * eta
  for (let f = 0; f < nx - 1; f++) {
    const hu = h[S.Phi[f] >= S.Phi[f + 1] ? f : f + 1]
    S.M[f] = (hu * hu * hu) / e12
  }
}

/**
 * Flux across each face, m^2/s, positive towards +x (basinward): q_f = -M_f (Phi_{f+1} - Phi_f) / dx.
 * Uses the potential last computed by saltPotential() and the thickness in the record. `out` has nx - 1 entries.
 */
export function saltFluxes(eng: EngineState, P: EngineParams, out: Float64Array): void {
  const rec = eng.rec
  const S = eng.salt
  for (let j = 0; j < rec.nx; j++) S.h[j] = rec.mud[SALT_LAYER * rec.nx + j]
  faceMobility(S, S.h, rec.nx, P.saltVisc)
  for (let f = 0; f < rec.nx - 1; f++) out[f] = (-S.M[f] * (S.Phi[f + 1] - S.Phi[f])) / rec.dx
}

/**
 * Move salt for one record step of dtYr years at sea level SL (m): `nSaltSub` substeps of the
 * semi-implicit scheme in the header. Writes the new thickness to layer 0 and the change per
 * column to eng.salt.dh (the caller adds it to the surface H). Does nothing when saltOn = 0.
 */
export function saltStep(eng: EngineState, P: EngineParams, SL: number, dtYr: number): void {
  const S = eng.salt
  if (P.saltOn !== 1) {
    S.dh.fill(0)
    return
  }
  const rec = eng.rec
  const nx = rec.nx
  const dx = rec.dx
  const h = S.h
  const a = S.aw
  const M = S.M
  const n = P.nSaltSub
  const c = (dtYr * YR) / n / (dx * dx)
  const base = SALT_LAYER * nx
  for (let j = 0; j < nx; j++) h[j] = rec.mud[base + j]
  saltSedimentLoads(eng, P)
  for (let s = 0; s < n; s++) {
    saltPotentialOf(eng, SL, h)
    const Phi = S.Phi
    faceMobility(S, h, nx, P.saltVisc)
    for (let j = 0; j < nx; j++) {
      const Mm = j > 0 ? M[j - 1] : 0
      const Mp = j < nx - 1 ? M[j] : 0
      S.lo[j] = j > 0 ? -c * Mm * a[j - 1] : 0
      S.up[j] = j < nx - 1 ? -c * Mp * a[j + 1] : 0
      S.di[j] = 1 + c * (Mm + Mp) * a[j]
      S.rhs[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0))
    }
    thomas(nx, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp)
    for (let j = 0; j < nx; j++) {
      let t = h[j] + S.x[j]
      if (t < 0) {
        eng.diag.saltClip += -t * dx
        rec.ledger.cumIn.salt += -t * dx // the clip adds salt: book it so the ledger closes (and diag shows it)
        t = 0
      }
      h[j] = t
    }
  }
  for (let j = 0; j < nx; j++) {
    S.dh[j] = h[j] - rec.mud[base + j]
    rec.mud[base + j] = h[j]
  }
}

/** True when the record's layer 0 is a salt layer (every cell tagged SALT). */
export function hasSaltLayer(rec: LayerRecord): boolean {
  return rec.nPre === 2 && rec.material[SALT_LAYER] === SALT
}
