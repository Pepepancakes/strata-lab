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

import { buoyantLoad, cellBulk } from './compaction'
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
  const sinB = Math.sin(beta)
  const cosB = Math.cos(beta)
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

/** Factor of safety of every column from the current record (see the header). */
export function computeStability(eng: EngineState, P: EngineParams): StabilityResult {
  const rec = eng.rec
  const nx = rec.nx
  const out: StabilityResult = {
    fsMin: new Float64Array(nx).fill(Infinity),
    critDepth: new Float64Array(nx),
    critLayer: new Int32Array(nx).fill(-1),
    slope: new Float64Array(nx),
  }
  const tanS = Math.tan((P.phiFric[SAND] * Math.PI) / 180)
  const tanM = Math.tan((P.phiFric[MUD] * Math.PI) / 180)
  for (let j = 0; j < nx; j++) {
    const tanBeta = seafloorSlope(rec.H, rec.dx, j)
    out.slope[j] = tanBeta
    const beta = Math.atan(tanBeta)
    let solids = 0 // solid thickness above the current cell (same sum as loadsInto in compaction.ts)
    let depth = 0 // bulk thickness above the current cell
    for (let l = rec.nLayers - 1; l >= 0; l--) {
      const i = l * nx + j
      const bulk = cellBulk(eng, P, i)
      if (bulk <= 0) continue
      const mid = depth + 0.5 * bulk
      if (mid > P.stabMaxDepth) break
      depth += bulk
      if (rec.material[i] === SALT) continue
      const s = rec.sand[i] + rec.mud[i]
      if (s <= EMPTY) continue
      const L = buoyantLoad(solids, s)
      solids += s
      const fs = rec.sand[i] / s
      const tanPhi = fs * tanS + (1 - fs) * tanM
      const c = fs * P.cohesion[SAND] + (1 - fs) * P.cohesion[MUD]
      const f = infiniteSlopeFS(L, rec.u[i], beta, tanPhi, c)
      if (f < out.fsMin[j]) {
        out.fsMin[j] = f
        out.critDepth[j] = mid
        out.critLayer[j] = l
      }
    }
  }
  return out
}
