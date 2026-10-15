// Salt intervals and overburden, for the views (M3.3).
// One record, many views: nothing here is stored. Everything is recomputed from the layer record
// each time it is asked for, except the weld age, which is history and lives in EngineState.
//
// Overburden. Total vertical stress (Pa) at a depth is the weight of everything above it:
//     sigma_v = g [ rho_w wd + sum over cells above ( solids rho_s + pore water rho_w ) + sum over salt cells above ( rho_salt h ) ]
// wd is the water depth above the sediment surface (0 on land). A sediment cell weighs its solid
// volume at rho_s plus its pores full of water (bulk - solids) at rho_w, exactly the weight the
// salt flow uses (salt.ts saltSedimentLoads). A salt cell has no pores and weighs rho_salt h
// (rho_salt: constants.ts). This is the total stress; the effective stress that drives compaction
// is smaller by the pore pressure. Salt adds its weight to everything below it, which matters for a
// canopy (salt above sediment); for salt at the base of the section, the stress at the BASE of the
// salt is the stress on the basement.
//
// Compaction under salt. compactColumn (compaction.ts) skips salt cells, so the sediment solved
// there is the sediment ABOVE the salt (salt at the base: the usual M3 case) with the salt as a
// no-flow bottom boundary: the same boundary the solver used for the basement before salt existed,
// so nothing changes with salt on or off for the sediment column. Sediment BELOW a salt cell
// (canopies) would need salt's weight added to its load; the record allows that layout, the
// compaction solver does not yet apply it (no card creates it before M3.4 at the earliest).
//
// Depths are metres below the sediment surface of the column (rec.b + all cells), elevations are
// metres above datum, like rec.b and rec.H. Intervals are contiguous runs of salt cells.

import { G, RHO_S, RHO_SALT, RHO_W } from './constants'
import { cellBulk } from './compaction'
import type { EngineParams } from './engineParams'
import { SALT } from './record'
import { WELD_NONE, type EngineState } from './state'

export interface SaltInterval {
  column: number
  /** Depth of the top and base of the salt below the sediment surface, m. */
  topDepth: number
  baseDepth: number
  /** Elevation of the top and base, m. */
  topElev: number
  baseElev: number
  /** Salt thickness, m. */
  thickness: number
  /** True once the column's salt has first thinned below weldThick AND is below it now. */
  welded: boolean
  /** Age (Ma) of the first weld of this column, or null when it never welded. */
  weldAge: number | null
  /** Total vertical stress at the salt top and base, Pa (water column included). */
  overburdenTop: number
  overburdenBase: number
}

/** Weight (Pa) of one cell: sediment solids plus pore water, or salt. 0 for an empty cell. */
export function cellWeight(eng: EngineState, P: EngineParams, i: number): number {
  const rec = eng.rec
  const sol = rec.sand[i] + rec.mud[i]
  if (sol <= 0) return 0
  if (rec.material[i] === SALT) return RHO_SALT * G * sol
  const bulk = cellBulk(eng, P, i)
  return G * (sol * RHO_S + (bulk - sol) * RHO_W)
}

/**
 * Total vertical stress at the BASE of every layer of column j, Pa, into out[0..nLayers-1]
 * (out[0] is the stress on the basement). `sl` is sea level, m.
 */
export function columnOverburden(eng: EngineState, P: EngineParams, sl: number, j: number, out: Float64Array): void {
  const rec = eng.rec
  const nx = rec.nx
  let surface = rec.b[j]
  for (let l = 0; l < rec.nLayers; l++) surface += cellBulk(eng, P, l * nx + j)
  const wd = sl - surface
  let s = wd > 0 ? RHO_W * G * wd : 0
  for (let l = rec.nLayers - 1; l >= 0; l--) {
    s += cellWeight(eng, P, l * nx + j)
    out[l] = s
  }
}

/** Salt intervals of column j, top to bottom (see header). Welded columns with no salt left give one interval of thickness 0. */
export function saltIntervals(eng: EngineState, P: EngineParams, sl: number, j: number): SaltInterval[] {
  const rec = eng.rec
  const nx = rec.nx
  const nL = rec.nLayers
  const stress = new Float64Array(nL)
  columnOverburden(eng, P, sl, j, stress)
  const bulk = new Float64Array(nL)
  let total = 0
  for (let l = 0; l < nL; l++) {
    bulk[l] = cellBulk(eng, P, l * nx + j)
    total += bulk[l]
  }
  const surface = rec.b[j] + total
  const out: SaltInterval[] = []
  const age = eng.weldAge[j]
  let l = nL - 1
  while (l >= 0) {
    if (rec.material[l * nx + j] !== SALT) {
      l--
      continue
    }
    const top = l
    let thick = 0
    while (l >= 0 && rec.material[l * nx + j] === SALT) {
      thick += bulk[l]
      l--
    }
    const base = l + 1 // lowest layer of the run
    if (thick <= 0 && age === WELD_NONE) continue // no salt here (and none was ever lost)
    let above = 0
    for (let m = nL - 1; m > top; m--) above += bulk[m]
    const topElev = surface - above
    out.push({
      column: j,
      topDepth: above,
      baseDepth: above + thick,
      topElev,
      baseElev: topElev - thick,
      thickness: thick,
      welded: age !== WELD_NONE && thick < P.weldThick,
      weldAge: age === WELD_NONE ? null : age,
      overburdenTop: stress[top] - cellWeight(eng, P, top * nx + j), // stress at the top of the topmost salt cell
      overburdenBase: stress[base], // stress at the base of the lowest salt cell of the run
    })
  }
  return out
}

/** Salt intervals of every column, column order then top to bottom. */
export function allSaltIntervals(eng: EngineState, P: EngineParams, sl: number): SaltInterval[] {
  const all: SaltInterval[] = []
  for (let j = 0; j < eng.rec.nx; j++) all.push(...saltIntervals(eng, P, sl, j))
  return all
}
