// Turbidity-current routing (a transport-length rule, NOT flow physics).
//
// Share of supply sent down the slope:   Ftc = tcMax exp(-(shelf edge - shoreline) / tcLambda)
//   so it is largest when the shoreline sits at the shelf edge (lowstand) and fades as the shelf
//   floods. Shoreline = first column whose surface is below sea level; shelf edge = first column
//   at or beyond it where the surface gradient exceeds sBreak AND the water is at least
//   shelfBreakDepth deep (SFM-2, D31.3: without the depth test the model's own shoreface, steeper
//   than sBreak, was read as the shelf edge). Ftc is applied to the flux that arrives at the shelf
//   edge face (transport.ts), not to the supply at the source.
// Down the slope each grain size loses  q (1 - exp(-dx/L))  per column, with deposition length
//   L = tcL0 (slope / tcSref)^tcN, slope floored at 1e-5. Sand (short L) stops near the slope
//   foot, mud (long L) travels to the basin floor. Flow that leaves the model is counted as
//   exported (ledger.cumOut), so mass still balances.
// The gradient is averaged over TC_SLOPE_WINDOW (SFM-3) so a one-cell flat cannot catch all the sand.
// All parameters are tuned (params.ts). Benchmark: mass balance per grain size.

import type { EngineParams } from './engineParams'

export interface ShoreInfo {
  shore: number
  shelfEdge: number
  share: number
}

export function turbiditeShare(H: Float64Array, nx: number, P: EngineParams, sl: number): ShoreInfo {
  const dx = P.dx
  let js = -1, je = -1, share = 0
  for (let j = 0; j < nx; j++) if (H[j] < sl) { js = j; break }
  if (js >= 0) {
    for (let j = js; j < nx - 1; j++) {
      if ((P.legacyShelfEdge || sl - H[j] >= P.shelfBreakDepth) && (H[j] - H[j + 1]) / dx > P.sBreak) { je = j; break }
    }
    if (je >= 0) share = P.tcMax * Math.exp(-(je - js) * dx / P.tcLambda)
  }
  return { shore: js, shelfEdge: je, share }
}

/**
 * Length over which the surface gradient is averaged when setting the deposition length (SFM-3, F5,
 * D31.3). TUNED: 3 km is about three columns at the default dx = 1 km, and it is a fixed physical
 * length so the result does not depend on the grid. Not cited; no source gives a value for this rule.
 */
export const TC_SLOPE_WINDOW = 3000

/**
 * Deposit the routed flux in the open layer (index offset `open` = layer * nx).
 * q = bulk m^2/yr per grain size [sand, mud], modified in place to the leftover (exported) flux.
 * pS, pM = solid fraction at the surface (1 - phi0), turning bulk into solids.
 * Updates H and the open layer's sand/mud.
 */
export function routeTurbidites(
  H: Float64Array,
  sand: Float64Array,
  mud: Float64Array,
  open: number,
  nx: number,
  P: EngineParams,
  je: number,
  q: [number, number],
  pS: number,
  pM: number,
  dt: number,
): void {
  const dx = P.dx
  const n = Math.max(1, Math.round(TC_SLOPE_WINDOW / dx))
  for (let j = je; j < nx; j++) {
    // Gradient averaged over the next TC_SLOPE_WINDOW metres (at least one column), so a one-cell flat
    // on the slope (an MTD top, a withdrawal low) does not read as a basin floor and catch the sand.
    const jn = Math.min(nx - 1, j + n)
    let sl = j < nx - 1 ? (H[j] - H[jn]) / ((jn - j) * dx) : (H[j - 1] - H[j]) / dx
    if (sl < 1e-5) sl = 1e-5
    for (let lith = 0; lith < 2; lith++) {
      const L = P.tcL0[lith] * Math.pow(sl / P.tcSref, P.tcN)
      const dep = q[lith] * (1 - Math.exp(-dx / L))
      q[lith] -= dep
      const dB = dep * dt / dx
      if (lith === 0) sand[open + j] += dB * pS
      else mud[open + j] += dB * pM
      H[j] += dB
    }
  }
}
