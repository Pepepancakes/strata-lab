// Summary statistics of a finished run, and how to compare two of them across machines (D16.4).
//
// Why. stateHash is exact: the same inputs give the same bits ON ONE MACHINE. Between Windows and
// Linux the maths library (pow, exp, log) differs in the last bit, and the threshold logic (shoreline,
// shelf edge, slope failure) amplifies that into tens of metres of surface height in single columns
// (measured: a 1 ulp change gives 30 to 75 m on the default run). So results from another machine
// cannot be compared column by column. What stays put are totals: the sediment mass, the mean
// surface height, the order of the overpressure. A real change to the physics moves those.
//
// What is compared (all from the layer record, no physics here):
//   sand, mud   total solid volume, m^2 (area of the section). Mass balance fixes it. Measured
//               spread under 1 ulp noise on the default run: sand 5e-15, mud 2e-4 (relative).
//   meanH       mean surface height over the columns, m. Spread under noise 1.8e-3 (relative).
//   maxU        largest excess pore pressure anywhere, Pa. Spread under noise up to 15 %, so it is
//               only a gross check (a 30 % band): it catches a lost or exploding overpressure.
//   events      number of slope failures. Spread under noise 24 to 34 on the MTD preset. Compared as
//               "none in both, or some in both within a factor of 3".
// Windows-vs-perturbed spreads and the effect of real changes (supply +1 %, sandFrac +0.02,
// subsidence +3 %) are in docs/handover.md (Known traps). Tolerances are about 2 times the largest
// measured noise spread and below the effect of a 1 % change in supply, so a real change still fails.
//
// Pure functions, no DOM.

import type { LayerRecord } from './record'

export interface RunSummary {
  nx: number
  nLayers: number
  /** Total solid sand and mud in the record, m^2. */
  sand: number
  mud: number
  /** Mean surface height over the columns, m. */
  meanH: number
  /** Largest excess pore pressure anywhere, Pa. */
  maxU: number
  /** Number of slope failures (0 when failure is off). */
  events: number
}

export function summarizeRecord(rec: LayerRecord, events = 0): RunSummary {
  const n = rec.nLayers * rec.nx
  let sand = 0
  let mud = 0
  let maxU = 0
  for (let i = 0; i < n; i++) {
    sand += rec.sand[i]
    mud += rec.mud[i]
    if (rec.u[i] > maxU) maxU = rec.u[i]
  }
  let sumH = 0
  for (let j = 0; j < rec.nx; j++) sumH += rec.H[j]
  return { nx: rec.nx, nLayers: rec.nLayers, sand, mud, meanH: sumH / rec.nx, maxU, events }
}

/** Relative tolerances, see the header for where each number comes from. */
export const SUMMARY_TOL = {
  sand: 1e-6,
  mud: 1e-3,
  meanH: 4e-3,
  maxU: 0.3,
  eventsFactor: 3,
}

/** Names of the statistics that differ by more than the tolerance (empty = the same run, to within noise). */
export function compareSummaries(a: RunSummary, b: RunSummary): string[] {
  const out: string[] = []
  const rel = (x: number, y: number): number => Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y), 1e-300)
  if (a.nx !== b.nx) out.push('columns')
  if (a.nLayers !== b.nLayers) out.push('layers')
  if (rel(a.sand, b.sand) > SUMMARY_TOL.sand) out.push('sand volume')
  if (rel(a.mud, b.mud) > SUMMARY_TOL.mud) out.push('mud volume')
  if (rel(a.meanH, b.meanH) > SUMMARY_TOL.meanH) out.push('mean surface height')
  if (rel(a.maxU, b.maxU) > SUMMARY_TOL.maxU) out.push('maximum overpressure')
  const lo = Math.min(a.events, b.events)
  const hi = Math.max(a.events, b.events)
  if ((lo === 0) !== (hi === 0) || (lo > 0 && hi > lo * SUMMARY_TOL.eventsFactor)) out.push('number of slope failures')
  return out
}
