// Tectonic subsidence: lowers the basement (and so the surface) of every column.
// Equation: drop in one step = rate-shape(j) x (integral of F(t) over that step), with
//   rate-shape(j) = subsShelf + (subsBasin - subsShelf) (j + 0.5)/nx, in m/Myr, linear across the section.
// F(t) is the time history, t = ELAPSED years since the start of the run (M1.4c):
//   constant   F = 1                                (the default scenario; drop = rate x dt exactly)
//   thermal    F = exp(-t / tau), tau = subsTau     (McKenzie 1978, EPSL 40, 25-32: post-rift thermal
//              subsidence decays exponentially, time constant about 62.8 Myr; subsShelf and
//              subsBasin are then the rates at the START of the run)
//   history    F = piecewise-constant user factors  (subsHistory = [ageMa0, f0, ageMa1, f1, ...])
// The integral over a step is exact (closed form), so coarse steps do not change the total.
// Assumptions: the rate values are tuned, not cited (params.ts); no flexure; the isostatic response
// to the sediment load is NOT modelled; the McKenzie form is the decay law only, not a stretching model.
// Benchmark: tests/burial.test.ts sums the step integrals over variable-step schedules and
// compares with the closed form, < 1e-6 relative.

import type { EngineParams } from './engineParams'
import type { LayerRecord } from './record'

/**
 * Integral of F(t) dt over [t0Yr, t1Yr] ("effective years of constant-rate subsidence").
 * `startAgeYr` is the age at the start of the run (the history mode's breakpoints are ages).
 * For 'constant' this is t1 - t0.
 */
export function subsidenceYears(P: EngineParams, t0Yr: number, t1Yr: number, startAgeYr: number): number {
  if (P.subsMode === 'thermal') {
    const tau = P.subsTau
    // integral of exp(-t/tau) = tau (exp(-t0/tau) - exp(-t1/tau)); expm1 keeps small steps accurate
    return -tau * Math.expm1(-(t1Yr - t0Yr) / tau) * Math.exp(-t0Yr / tau)
  }
  if (P.subsMode === 'history') return historyYears(P.subsHistory, t0Yr, t1Yr, startAgeYr)
  return t1Yr - t0Yr
}

/** Check a flat [ageMa, factor, ...] history; throws a plain-language error. */
export function checkHistory(h: readonly number[]): void {
  if (h.length === 0 || h.length % 2 !== 0) throw new Error('subsidence history: give pairs [ageMa, factor, ...], at least one pair')
  for (let i = 0; i < h.length; i += 2) {
    if (!(h[i + 1] >= 0)) throw new Error('subsidence history: factors must be >= 0')
    if (i > 0 && !(h[i] < h[i - 2])) throw new Error('subsidence history: ages must decrease (older first)')
  }
}

function historyYears(h: readonly number[], t0Yr: number, t1Yr: number, startAgeYr: number): number {
  checkHistory(h)
  const n = h.length / 2
  let total = 0
  for (let i = 0; i < n; i++) {
    // piece i covers elapsed time [lo, hi); the first reaches back to -infinity, the last on to +infinity
    const lo = i === 0 ? -Infinity : startAgeYr - h[2 * i] * 1e6
    const hi = i === n - 1 ? Infinity : startAgeYr - h[2 * i + 2] * 1e6
    const a = Math.max(t0Yr, lo)
    const b = Math.min(t1Yr, hi)
    if (b > a) total += h[2 * i + 1] * (b - a)
  }
  return total
}

/** Lower the basement of every column for the step [t0Yr, t0Yr + dtYr]. */
export function subside(rec: LayerRecord, P: EngineParams, dtYr: number, t0Yr = 0, startAgeYr = 0): void {
  const nx = rec.nx
  // 'constant' uses dtYr itself (not t1 - t0) so the default run stays bit-identical to spike 001
  const years = P.subsMode === 'constant' ? dtYr : subsidenceYears(P, t0Yr, t0Yr + dtYr, startAgeYr)
  for (let j = 0; j < nx; j++) {
    const rate = (P.subsShelf + (P.subsBasin - P.subsShelf) * (j + 0.5) / nx) * 1e-6
    const dz = rate * years
    rec.b[j] -= dz
    rec.H[j] -= dz
  }
}
