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
//   * Conduction only: no fluid advection, no radiogenic heat inside the sediment.
//   * Sediment conductivity ignores quartz cement and the temperature dependence of k.
// Salt (M3.3). Salt cells have no pores and conduct 2-4x better than sediment (halite about
// 5 to 6.5 W/m/K near the surface), falling with temperature (Clauser & Huenges 1995, to verify):
//     k(T) = k0 / (0.99 + c T),   c = a - b / k0,   T in deg C     (saltK0, saltKa, saltKb)
// With the heat flow q the same at every depth, dT/dz = q / k(T) = q (0.99 + c T) / k0 integrates
// exactly (g = 0.99 + c T obeys dg/dz = (c q / k0) g):
//     T(z) = T_top + g_top expm1(c q z / k0) / c        (c = 0: T_top + 0.99 q z / k0)
// so the temperature across a salt cell needs no iteration. The effect in this 1D model: with the
// same heat flow and surface temperature, the sediment ABOVE a salt body is unchanged; the
// temperature rises more slowly through the salt, so everything BELOW the salt is cooler than in a
// column where the salt is replaced by sediment. A warm roof above a salt body
// comes from heat being drawn sideways into the salt (2D), which this model does not have.
// Benchmark: tests/burial.test.ts compares steadyConduction() with the analytic profile for a
// constant k and for two layers (< 0.01 deg C), and the engine's columns with both.
// Parameter sources: params.ts (heat flow cited; conductivities to verify; seafloor T tuned).

import { cellBulk } from './compaction'
import type { EngineParams } from './engineParams'
import { SALT as SALT_TAG } from './record'
import type { EngineState } from './state'

const SALT = SALT_TAG
/** Salt conductivity at temperature tC (deg C), W/m/K: k0 / (0.99 + (a - b / k0) T). */
export function saltConductivity(P: EngineParams, tC: number): number {
  return P.saltK0 / (0.99 + (P.saltKa - P.saltKb / P.saltK0) * tC)
}

/**
 * Temperature at depth z (m) below the top of a salt body whose top is at tTop (deg C), for the
 * heat flow q (W/m^2): the exact solution of dT/dz = q / k(T) given in the header.
 */
export function saltTemperatureAt(P: EngineParams, tTop: number, q: number, z: number): number {
  const c = P.saltKa - P.saltKb / P.saltK0
  const gTop = 0.99 + c * tTop
  if (c === 0) return tTop + (gTop * q * z) / P.saltK0
  return tTop + (gTop * Math.expm1((c * q * z) / P.saltK0)) / c
}

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
    if (rec.material[i] === SALT) {
      out[l] = saltTemperatureAt(P, t, q, 0.5 * h)
      t = saltTemperatureAt(P, t, q, h)
      continue
    }
    const s = rec.sand[i] + rec.mud[i]
    const k = cellConductivity(P, rec.sand[i], rec.mud[i], 1 - s / h)
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
