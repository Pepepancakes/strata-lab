// Slope stability: infinite-slope factor of safety (FS) in every column (M2.1).
//
// Equation (submarine infinite slope, slip surface parallel to the seafloor at depth z):
//
//   FS = [ c' + (sigma_v' cos^2 beta) tan(phi') ] / ( gamma' z sin beta cos beta )
//
//   beta      seafloor slope angle (atan of |dH/dx|)
//   gamma' z  buoyant (submerged) weight of the sediment above the slip surface = the buoyant load L
//             of the consolidation solver (solids above + half the cell) x (rho_s - rho_w) g.
//             This is total vertical stress minus the hydrostatic pressure.
//   sigma_v'  effective vertical stress = L - u, with u the EXCESS pore pressure stored in the
//             record. The consolidation solver's overpressure therefore lowers FS directly.
//   c', phi'  cohesion and friction angle (registry: cohesion, phiFric).
//
// Check: u = 0, c' = 0 gives FS = tan(phi')/tan(beta). With u = r_u L it gives (1 - r_u) tan(phi')/tan(beta).
// Sources: the infinite-slope form for submarine slopes with excess pore pressure is in Hampton,
// Lee & Locat (1996), Rev. Geophys. 34(1), 33-59 (Morgenstern 1967 is the classic origin); the form
// above is the standard soil-mechanics infinite-slope equation (e.g. Lambe & Whitman 1969) written
// with excess pore pressure. The form was written from those standard texts, not checked against
// the paper's own notation (to verify).
//
// Assumptions: planar slip surface parallel to the local seafloor; failure depth much smaller than
// the slope length; drained strength (effective-stress c', phi'), so no undrained or cyclic
// loading and no earthquake term (M2.3 adds triggers); the slope seen is the seafloor slope between
// neighbouring columns (central difference inside, one-sided at the two edges), so slopes steeper
// than the column spacing resolves are not seen. Strength of a mixed sand/mud cell is the
// solid-fraction average of tan(phi') and of c'. Salt cells are skipped (they add no load in M1/M2,
// see compaction.ts). Cement does not add strength. A column whose seafloor is above sea level is
// treated the same way; its slopes are tiny, so its FS is huge.
//
// Where it is evaluated: the middle of every sediment cell in the top stabMaxDepth of the column
// (that is where the record stores u). Depth is measured below the seafloor along the bulk
// thickness of the cells, salt included.
//
// Nothing here is stored: the results are recomputed from the record every call, so there is
// nothing to rebuild after a restore.
// Parameters: phiFric, cohesion, stabMaxDepth (params.ts, with their sources).

import { buoyantLoad } from './compaction'
import { EMPTY, MUD, SAND } from './constants'
import type { EngineParams } from './engineParams'
import { SALT } from './record'
import type { EngineState } from './state'

export interface StabilityResult {
  /** Lowest FS found in the search window, per column. Infinity when the column cannot fail (flat, or no load). */
  fsMin: Float64Array
  /** Depth below the seafloor (m) of the cell mid-point where FS is lowest. 0 when critLayer is -1. */
  critDepth: Float64Array
  /** Layer index of that cell, or -1 when no finite FS was found. */
  critLayer: Int32Array
  /** Seafloor slope used, tan(beta) (always >= 0). */
  slope: Float64Array
  /** Excess-pressure ratio u / L of the critical cell (0 when there is none). */
  ru: Float64Array
}

/** Optional limits on the search (M2.3). Defaults search everything, as in M2.1. */
export interface StabilityOptions {
  /** Columns with a seafloor slope tan(beta) at or below this are not searched (FS stays Infinity). A speed cut and a stated limit. */
  minSlope?: number
  /** Cells whose mid-point is shallower than this (m below the seafloor) are not candidates for the slip surface. */
  minDepth?: number
}

/**
 * Infinite-slope factor of safety.
 * @param L buoyant load (gamma' z), Pa
 * @param u excess pore pressure, Pa (clipped to the load)
 * @param beta slope angle, radians
 * @param tanPhi tan of the friction angle
 * @param c cohesion, Pa
 * Returns Infinity when nothing drives sliding (flat seafloor or no load).
 */
export function infiniteSlopeFS(L: number, u: number, beta: number, tanPhi: number, c: number): number {
  return infiniteSlopeFSsc(L, u, Math.sin(beta), Math.cos(beta), tanPhi, c)
}

/** Same as infiniteSlopeFS with sin(beta) and cos(beta) given (computed once per column in computeStability). */
function infiniteSlopeFSsc(L: number, u: number, sinB: number, cosB: number, tanPhi: number, c: number): number {
  const drive = L * sinB * cosB
  if (!(drive > 0)) return Infinity
  const eff = L - u > 0 ? L - u : 0
  return (c + eff * cosB * cosB * tanPhi) / drive
}

/** Seafloor slope tan(beta) >= 0 at column j: central difference inside, one-sided at the edges. */
export function seafloorSlope(H: ArrayLike<number>, dx: number, j: number): number {
  const nx = H.length
  if (nx < 2) return 0
  const a = j > 0 ? j - 1 : j
  const b = j < nx - 1 ? j + 1 : j
  const s = (H[b] - H[a]) / ((b - a) * dx)
  return s < 0 ? -s : s
}

/**
 * Factor of safety of every column from the current record (see the header).
 * Layer-major loop: the record is stored layer by layer, so one pass down the layers with a small
 * per-column state reads memory in order. Per column the arithmetic and its order (top cell
 * first) are exactly those of a column-by-column loop, so the numbers are bit-identical.
 */
export function computeStability(eng: EngineState, P: EngineParams, opt: StabilityOptions = {}): StabilityResult {
  const minSlope = opt.minSlope ?? 0
  const minDepth = opt.minDepth ?? 0
  const rec = eng.rec
  const nx = rec.nx
  const out: StabilityResult = {
    fsMin: new Float64Array(nx).fill(Infinity),
    critDepth: new Float64Array(nx),
    critLayer: new Int32Array(nx).fill(-1),
    slope: new Float64Array(nx),
    ru: new Float64Array(nx),
  }
  const tanS = Math.tan((P.phiFric[SAND] * Math.PI) / 180)
  const tanM = Math.tan((P.phiFric[MUD] * Math.PI) / 180)
  const sinBeta = new Float64Array(nx)
  const cosBeta = new Float64Array(nx)
  const solids = new Float64Array(nx) // solid thickness above the current cell (same sum as loadsInto in compaction.ts)
  const depth = new Float64Array(nx) // bulk thickness above the current cell
  const live: number[] = [] // columns still searched, in index order
  for (let j = 0; j < nx; j++) {
    const tanBeta = seafloorSlope(rec.H, rec.dx, j)
    out.slope[j] = tanBeta
    if (!(tanBeta > minSlope)) continue
    const beta = Math.atan(tanBeta)
    sinBeta[j] = Math.sin(beta)
    cosBeta[j] = Math.cos(beta)
    live.push(j)
  }
  let nLive = live.length
  const sandA = rec.sand
  const mudA = rec.mud
  const matA = rec.material
  const uA = rec.u
  const phs = eng.phs
  const phm = eng.phm
  const lin = P.linear
  const maxDepth = P.stabMaxDepth
  const cohS = P.cohesion[SAND]
  const cohM = P.cohesion[MUD]
  for (let l = rec.nLayers - 1; l >= 0 && nLive > 0; l--) {
    const row = l * nx
    let w = 0
    for (let q = 0; q < nLive; q++) {
      const j = live[q]
      const i = row + j
      const s = sandA[i] + mudA[i]
      if (s <= 0) {
        live[w++] = j // empty cell: no thickness, nothing to do
        continue
      }
      const bulk = matA[i] === SALT ? s : lin ? s * (1 + lin.e0) : sandA[i] / (1 - phs[i]) + mudA[i] / (1 - phm[i]) // = cellBulk, with the parameter reads hoisted (a hot loop)
      if (bulk <= 0) {
        live[w++] = j
        continue
      }
      const mid = depth[j] + 0.5 * bulk
      if (mid > maxDepth) continue // this column is done: dropped from the live list
      live[w++] = j
      depth[j] += bulk
      if (matA[i] === SALT) continue

      if (s <= EMPTY) continue
      const L = buoyantLoad(solids[j], s)
      solids[j] += s
      if (mid < minDepth) continue
      const fs = sandA[i] / s
      const tanPhi = fs * tanS + (1 - fs) * tanM
      const c = fs * cohS + (1 - fs) * cohM
      const f = infiniteSlopeFSsc(L, uA[i], sinBeta[j], cosBeta[j], tanPhi, c)
      if (f < out.fsMin[j]) {
        out.fsMin[j] = f
        out.critDepth[j] = mid
        out.critLayer[j] = l
        out.ru[j] = L > 0 ? uA[i] / L : 0
      }
    }
    nLive = w
  }
  return out
}
