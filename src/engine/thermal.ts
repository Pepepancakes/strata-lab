// Temperature: steady 1D heat conduction in every column (M1.4c).
//
// Equation: heat flow q is the same at every depth, so  dT/dz = q / k(z)  and
//   T(z) = Tsf + q * integral_0^z dz' / k(z')          (z = depth below the sediment surface).
// For a stack of cells of bulk thickness h_i and conductivity k_i this is a running sum of the
// thermal resistance h_i / k_i; a cell's temperature is taken at its middle.
// Bulk conductivity of a cell: geometric mean of grains and water (Woodside & Messmer 1961),
//   ln k = (1 - phi) ln k_grain + phi ln k_water,
// with the grain conductivity itself a geometric mean of the sand and mud grains by solid volume.
// Seafloor temperature: Tdeep + (Tshallow - Tdeep) exp(-water depth / scale); land and zero water
// depth get Tshallow. Heat flow q enters at the base of the model (basal heat flow).
// Assumptions / limits (say these in the user guide too):
//   * STEADY state only. Rapid burial cools the section (the sediment arrives cold and the heat
//     takes time to catch up), so a real fast-burial margin is colder than this at depth. The
//     Gulf of Mexico (Nagihara & Smith 2008) shows exactly this. Ignored here.
//   * Conduction only: no fluid advection, no radiogenic heat inside the sediment, no salt effect
//     (salt conducts 2-4x better than sediment; salt cells use SALT_K, a placeholder until M3).
//   * Conductivity ignores quartz cement and the temperature dependence of k.
// Benchmark: tests/burial.test.ts compares steadyConduction() with the analytic profile for a
// constant k and for two layers (< 0.01 deg C), and the engine's columns with both.
// Parameter sources: params.ts (heat flow cited; conductivities to verify; seafloor T tuned).

import { cellBulk } from './compaction'
import type { EngineParams } from './engineParams'
import { SALT as SALT_TAG } from './record'
import type { EngineState } from './state'

const SALT = SALT_TAG
/** Conductivity of salt cells, W/m/K. Placeholder (halite is roughly 6); salt does not exist before M3. */
export const SALT_K = 6.0

/** Seafloor (or land surface) temperature, deg C, for a water depth in m (<= 0 = land or at sea level). */
export function seafloorTemperature(P: EngineParams, waterDepthM: number): number {
  if (waterDepthM <= 0) return P.tSeaShallow
  return P.tSeaDeep + (P.tSeaShallow - P.tSeaDeep) * Math.exp(-waterDepthM / P.tSeaScale)
}

/**
 * Steady conduction through a stack of layers listed from the top down.
 * Writes the temperature at the middle of each layer into `out` and returns the temperature at the
 * base of the last layer. This is the textbook sum  T = Tsf + q sum(h/k).
 */
export function steadyConduction(
  tSurface: number, q: number, h: ArrayLike<number>, k: ArrayLike<number>, out: Float64Array | number[],
): number {
  let t = tSurface
  for (let m = 0; m < h.length; m++) {
    const r = h[m] / k[m]
    out[m] = t + q * 0.5 * r
    t += q * r
  }
  return t
}

/** Bulk conductivity of one cell (W/m/K): geometric mean of grains and water. phi = porosity of the cell. */
export function cellConductivity(P: EngineParams, sandSolid: number, mudSolid: number, phi: number): number {
  const s = sandSolid + mudSolid
  const fs = s > 0 ? sandSolid / s : 0
  const lnGrain = fs * Math.log(P.kGrain[0]) + (1 - fs) * Math.log(P.kGrain[1])
  return Math.exp((1 - phi) * lnGrain + phi * Math.log(P.kWater))
}

/**
 * Temperatures of column j, layers 0..layers-1, into out[l] (deg C at mid-cell). Empty cells get the
 * temperature of the surface above them. `sl` is sea level in m, which with the surface H sets the
 * water depth and so the seafloor temperature.
 */
export function columnTemperatures(
  eng: EngineState, P: EngineParams, j: number, layers: number, sl: number, out: Float64Array,
): void {
  const rec = eng.rec
  const nx = rec.nx
  let t = seafloorTemperature(P, sl - rec.H[j])
  const q = P.heatFlow
  for (let l = layers - 1; l >= 0; l--) {
    const i = l * nx + j
    const h = cellBulk(eng, P, i)
    if (h <= 0) {
      out[l] = t
      continue
    }
    const s = rec.sand[i] + rec.mud[i]
    const k = rec.material[i] === SALT ? SALT_K : cellConductivity(P, rec.sand[i], rec.mud[i], 1 - s / h)
    const r = h / k
    out[l] = t + q * 0.5 * r
    t += q * r
  }
}

/** Fill eng.temp for every cell of the current record at sea level `sl`. */
export function computeTemperatures(eng: EngineState, P: EngineParams, sl: number): void {
  const rec = eng.rec
  const nx = rec.nx
  const col = eng.scratch.hh
  for (let j = 0; j < nx; j++) {
    columnTemperatures(eng, P, j, rec.nLayers, sl, col)
    for (let l = 0; l < rec.nLayers; l++) eng.temp[l * nx + j] = col[l]
  }
  eng.tempOk = true
}
