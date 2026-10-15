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
// Welds and the outflow limiter (M3.3). Mobility goes as h^3, so a thinning column slows down, but
// an implicit step of finite length can still ask a cell for more salt than it holds. The flux
// across every face is a difference of the solved thickness changes: with x_j the change of column
// j, the flux (in metres of thickness, positive towards -x) is the running sum
//     phi_f = x_0 + x_1 + ... + x_f ,     x_j = phi_j - phi_(j-1)
// (zero at the ends; salt only leaves through faces). The cell that SENDS across a face is the one
// the flux leaves: column f+1 if phi_f > 0, else column f. When a substep would leave any cell
// below 0, each cell's total outgoing flux O_j = max(phi_(j-1), 0) + max(-phi_j, 0) is compared with
// the salt it holds, h_j:
//     lambda_j = min(1, h_j / O_j)        and every face flux is multiplied by lambda of its sender,
//     h_j(new) = h_j + phi'_j - phi'_(j-1) >= 0         (inflow is never negative, outflow <= h_j).
// The same face flux is used on both sides, so salt is conserved to rounding; nothing is clipped
// and diag.saltClip stays 0. When no cell would go negative the limiter does not run and the step
// is bit-identical to M3.2. diag.saltLimited, saltLimitedVol and saltLimitMaxH say how often, how
// much and at what thickness it acted (it should act only near zero thickness).
// The weld age. A column whose salt was at least weldThick thick at the start of a record step and
// is thinner at its end is welded; weldAge[j] (state.ts) keeps the age (Ma) of the first time that
// happened. Columns that were never that thick (the pinch-out edge) never count.
// Clipping. The M3.1 clip (a thickness below 0 set to 0, counted in diag.saltClip and booked as salt
// coming in) is kept as a last guard only; it must be 0 in every benchmark.
//
// Cover bending stiffness (M3.2). Thin-sheet flow alone makes the narrowest bumps grow fastest (spike
// 002: diapirs 1 to 4 grid cells wide whatever the cell size). The sediment above the salt is treated
// as ONE thin viscous plate of thickness h_c (bulk thickness of everything above the salt) and
// effective viscosity eta_c (coverVisc). A viscous plate bending at rate d(w)/dt (w = roof
// elevation) with curvature rate d2(dw/dt)/dx2 carries the moment  M = D d2(dw/dt)/dx2  with
//     D = eta_c h_c^3 / 3          (plane-strain incompressible viscous plate: the elastic
//                                   D = E h^3 / (12 (1 - nu^2)) with E -> 3 eta, nu -> 1/2;
//                                   Turcotte & Schubert, Geodynamics, plate flexure chapter)
// and the plate hands the load  d2M/dx2  to the salt, so the pressure on the roof is
//     p_b = d2/dx2 ( D d2(dw/dt)/dx2 )                                            [Pa]
// (conservative, self-adjoint form; reduces to (eta_c h_c^3 / 3) d4(dw/dt)/dx4 for constant h_c).
// It is added to the roof pressure: Phi = W + rho_w g wd + rho_salt g z_roof + p_b. Because w moves
// with the salt thickness (basement fixed), dw/dt = dh/dt, and p_b is IMPLICIT in the new thickness:
//     Phi = Phi_0 + a dh + K dh / dtS,   K = G^T diag(D) G / dx^4
// G = second difference [1 -2 1] (mirror ends: zero slope at both ends, like the zero-flux ends of
// the salt). The system becomes (I + c T (diag(a) + K/dtS)) dh = rhs, with T the flux operator of
// M3.1: seven diagonals, solved by banded LU (banded.ts). Flux form is kept (dh is a divergence of
// fluxes), so salt is conserved to rounding. With coverBend = 0 the M3.1 tridiagonal path runs and
// results are bit-identical to M3.1.
//
// Linear theory (what the dispersion test checks). Salt channel of thickness h, cover h_c, seafloor
// held level (sedimentation fills lows and erodes highs: the differential-loading setup of Gemmer
// et al. 2004), cover density rho_c > rho_salt. A roof bump w = A cos(kx) changes the load by
// -rho_c g w and the salt weight by +rho_salt g w, so the drive is -(rho_c - rho_salt) g w
// (destabilising). Thin-sheet flow dh/dt = (h^3 / 12 eta_s) d2Phi/dx2 then gives
//     sigma(k) = drho g h^3 k^2 / (12 eta_s + (eta_c h_c^3 / 3) h^3 k^6),  drho = rho_c - rho_salt
// fastest at k*^6 = 18 eta_s / (eta_c h_c^3 h^3), lambda* = 2 pi (eta_c h_c^3 h^3 / (18 eta_s))^(1/6).
// A cover that simply rides on the roof under water has drho -> -(rho_salt - rho_w): the same
// formula gives decay (stable), and with h_c = 0 it is the M3.1 decay rate.
// Elastic flexure with the whole cover as the plate (E = 10 GPa, nu = 0.25, D = E h_c^3 / (12 (1 - nu^2)))
// gives sigma = (h^3 k^2 / 12 eta_s)(drho g - D k^4): unstable only longer than 2 pi (D / (drho g))^(1/4)
// = 23 km for 1 km of cover (53 km for 3 km), fastest at 2 pi (3 D / (drho g))^(1/4) = 31 km (70 km).
// Rejected: see docs/physics-references.md.
// Approximation for a laterally varying h_c: D(x) is evaluated per column from the local bulk
// thickness (thin-plate / lubrication-style local thickness), inside the conservative operator.
// Where the cover thins to nothing, D -> 0 and the bending resistance disappears there (welds: M3.3).
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
import { bandIndex, solveBanded } from './banded'
import { WELD_NONE, type EngineState, type SaltScratch } from './state'
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
 * Plate stiffness and the bending part of the system matrix (M3.2), built once per record step.
 * D_i = eta_c h_c,i^3 / 3 at each column centre (h_c = bulk thickness of the sediment above the
 * salt, saltSedimentLoads). K = G^T diag(D) G / dx^4, G the second difference [1 -2 1] at the
 * columns, with mirror ends (zero slope at the first and last column, like the zero-flux ends of the salt). Then the pressure the
 * bending cover puts on the roof is K (dh / dt), a conservative (self-adjoint) form of
 * d2/dx2 (D d2(dw/dt)/dx2); K is symmetric, positive semi-definite, and zero for a constant or
 * tilted roof (a rigid shift costs nothing). Stored divided by the substep length `dtS` (s) as
 * three bands: s0 (K_kk), s1 (K_k,k+1), s2 (K_k,k+2), plus the water/gravity response a on the diagonal.
 */
function coverStiffness(eng: EngineState, P: EngineParams, dtS: number): void {
  const S = eng.salt
  const nx = eng.rec.nx
  const dx = eng.rec.dx
  const f = P.coverVisc / 3 / (dx * dx * dx * dx) / dtS
  S.s0.fill(0)
  S.s1.fill(0)
  S.s2.fill(0)
  for (let i = 0; i < nx; i++) {
    const hc = S.Sb[i]
    const Di = f * hc * hc * hc
    S.Dc[i] = Di
    if (i === 0) {
      // mirror end (zero slope, like the zero-flux end of the salt): curvature w_1 - w_0
      S.s0[0] += Di
      S.s0[1] += Di
      S.s1[0] += -Di
    } else if (i === nx - 1) {
      S.s0[nx - 2] += Di
      S.s0[nx - 1] += Di
      S.s1[nx - 2] += -Di
    } else {
      // G row i: columns i-1, i, i+1 with weights 1, -2, 1
      S.s0[i - 1] += Di
      S.s0[i] += 4 * Di
      S.s0[i + 1] += Di
      S.s1[i - 1] += -2 * Di
      S.s1[i] += -2 * Di
      S.s2[i - 1] += Di
    }
  }
}

/**
 * One substep with bending: solve (I + c T (diag(a) + K/dt)) u = rhs for the thickness change u,
 * where T is the (symmetric) flux operator of the existing scheme, T v_j = Mp (v_j - v_j+1) + Mm (v_j - v_j-1),
 * and rhs is the explicit part c (Mp dPhi+ - Mm dPhi-). With K = 0 this is exactly the tridiagonal
 * system of M3.1. Seven diagonals; banded LU with pivoting (banded.ts). Result in S.x.
 */
function solveBent(eng: EngineState, c: number): void {
  const S = eng.salt
  const nx = eng.rec.nx
  const M = S.M
  const a = S.aw
  const Phi = S.Phi
  const band = S.band
  band.ab.fill(0)
  // S matrix entry (k, m): diagonal a_k + s0_k, off-diagonals s1, s2 (symmetric)
  const sEntry = (k: number, m: number): number => {
    if (k < 0 || m < 0 || k >= nx || m >= nx) return 0
    const d = m - k
    if (d === 0) return a[k] + S.s0[k]
    if (d === 1) return S.s1[k]
    if (d === -1) return S.s1[m]
    if (d === 2) return S.s2[k]
    if (d === -2) return S.s2[m]
    return 0
  }
  for (let j = 0; j < nx; j++) {
    const Mm = j > 0 ? M[j - 1] : 0
    const Mp = j < nx - 1 ? M[j] : 0
    for (let m = Math.max(0, j - 3); m <= Math.min(nx - 1, j + 3); m++) {
      let v = c * ((Mp + Mm) * sEntry(j, m) - Mp * sEntry(j + 1, m) - Mm * sEntry(j - 1, m))
      if (m === j) v += 1
      band.ab[bandIndex(nx, 3, 3, j, m)] = v
    }
    S.x[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0))
  }
  solveBanded(nx, 3, 3, band, S.x)
}

/**
 * Move salt for one record step of dtYr years at sea level SL (m): `nSaltSub` substeps of the
 * semi-implicit scheme in the header. Writes the new thickness to layer 0 and the change per
 * column to eng.salt.dh (the caller adds it to the surface H). Does nothing when saltOn = 0.
 * `ageMa` is the age at the end of the step; it is written to eng.weldAge for columns that weld in it.
 */
export function saltStep(eng: EngineState, P: EngineParams, SL: number, dtYr: number, ageMa = 0): void {
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
  const hStart = S.hs
  hStart.set(h)
  saltSedimentLoads(eng, P)
  const bend = P.coverBend === 1 && P.coverVisc > 0 && nx >= 5
  if (bend) coverStiffness(eng, P, (dtYr * YR) / n)
  for (let s = 0; s < n; s++) {
    saltPotentialOf(eng, SL, h)
    const Phi = S.Phi
    faceMobility(S, h, nx, P.saltVisc)
    if (bend) {
      solveBent(eng, c)
    } else {
      for (let j = 0; j < nx; j++) {
        const Mm = j > 0 ? M[j - 1] : 0
        const Mp = j < nx - 1 ? M[j] : 0
        S.lo[j] = j > 0 ? -c * Mm * a[j - 1] : 0
        S.up[j] = j < nx - 1 ? -c * Mp * a[j + 1] : 0
        S.di[j] = 1 + c * (Mm + Mp) * a[j]
        S.rhs[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0))
      }
      thomas(nx, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp)
    }
    let low = false
    for (let j = 0; j < nx; j++) {
      if (h[j] + S.x[j] < 0) {
        low = true
        break
      }
    }
    if (low) limitOutflow(eng, h)
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
    if (eng.weldAge[j] === WELD_NONE && hStart[j] >= P.weldThick && h[j] < P.weldThick) eng.weldAge[j] = ageMa
  }
}

/**
 * The weld limiter (header). Called when the solved change S.x would leave a cell below 0: cuts each
 * cell's outgoing flux to the salt it holds and rewrites S.x so that h + x is the limited thickness.
 * Uses S.cp for the face fluxes and S.dp for the factors (free after the solve).
 */
function limitOutflow(eng: EngineState, h: Float64Array): void {
  const S = eng.salt
  const nx = eng.rec.nx
  const dx = eng.rec.dx
  const phi = S.cp
  const lam = S.dp
  const x = S.x
  let run = 0
  for (let f = 0; f < nx - 1; f++) {
    run += x[f]
    phi[f] = run
  }
  for (let j = 0; j < nx; j++) {
    const left = j > 0 ? Math.max(phi[j - 1], 0) : 0
    const right = j < nx - 1 ? Math.max(-phi[j], 0) : 0
    const out = left + right
    lam[j] = out > h[j] ? h[j] / out : 1
    if (lam[j] < 1) {
      eng.diag.saltLimited++
      eng.diag.saltLimitedVol += (out - h[j]) * dx
      if (h[j] > eng.diag.saltLimitMaxH) eng.diag.saltLimitMaxH = h[j]
    }
  }
  for (let f = 0; f < nx - 1; f++) phi[f] *= phi[f] > 0 ? lam[f + 1] : lam[f]
  for (let j = 0; j < nx; j++) {
    const t = h[j] + (j < nx - 1 ? phi[j] : 0) - (j > 0 ? phi[j - 1] : 0)
    x[j] = (t > 0 ? t : 0) - h[j]
  }
}

/** True when the record's layer 0 is a salt layer (every cell tagged SALT). */
export function hasSaltLayer(rec: LayerRecord): boolean {
  return rec.nPre === 2 && rec.material[SALT_LAYER] === SALT
}
