// Tectonic subsidence: lowers the basement (and so the surface) of every column.
// Equation: rate(j) = subsShelf + (subsBasin - subsShelf) (j + 0.5)/nx, in m/Myr, linear across
// the section; drop in one step = rate x dt (dt is that step's own length).
// Assumptions: rate fixed in time (no flexure, no thermal decay); the values are tuned, not cited
// (params.ts). Isostatic response to sediment load is NOT modelled.

import type { EngineParams } from './engineParams'
import type { LayerRecord } from './record'

export function subside(rec: LayerRecord, P: EngineParams, dtYr: number): void {
  const nx = rec.nx
  for (let j = 0; j < nx; j++) {
    const rate = (P.subsShelf + (P.subsBasin - P.subsShelf) * (j + 0.5) / nx) * 1e-6
    const dz = rate * dtYr
    rec.b[j] -= dz
    rec.H[j] -= dz
  }
}
