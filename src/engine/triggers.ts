// What triggered a slope failure (M2.3): a documented, deterministic tag for every event.
//
// The engine has no trigger button. A failure happens when the factor of safety (stability.ts)
// drops below 1, and the factor of safety falls for physical reasons only: the seafloor gets
// steeper, the excess pore pressure rises, or sea level falls (more supply and erosion on the
// shelf, fast sediment arrival on the slope). This module says which one did most of the work.
//
// Rule. For the weakest column of the failure (the column with the lowest FS) compare its state
// NOW with its state LOOKBACK_STEPS record steps earlier (the end-of-step values kept in
// EngineState.hist; if the run is younger than that, the earliest values kept). Drop cohesion and
// the cos^2 beta term (small for slopes of a few degrees): infinite-slope FS is then proportional to
// (1 - ru) / tan(beta), with ru = u / load the excess-pressure ratio at the critical cell. So
//
//   ln FS_then - ln FS_now  =  dSlope + dPress
//   dSlope = ln( tanBeta_now / tanBeta_then )              steepening of the seafloor
//   dPress = ln( (1 - ru_then) / (1 - ru_now) )            rise of excess pore pressure
//
// both counted positive when they LOWER the factor of safety. A term whose earlier value is
// unknown (the column was below the slope cut then, so no ru was found) counts as 0.
//
// Tag. Each term is turned into a score by dividing it by its own threshold (a score of 1 just
// qualifies), and the label is the term with the LARGEST score, not the first test that passes:
//   oversteepening  dSlope / failSlopeTerm
//   overpressure    dPress / failPressTerm; it reads 'rapid loading' instead when the source column
//                   gained bulk sediment at failRapidRate or faster over the window (the
//                   pressure is being made now), else the pressure was built earlier and is held
//   lowstand        (sea level fall over the window) / failLowstandDrop
//   mixed           no score reaches 1: no single cause stands out
// Ties go to the earlier line above. Only rises count (a term that would raise FS scores 0).
//
// The numbers behind the tag (dSlope, dPress, sea-level change, loading rate) are stored in the
// event so a reader can see all the terms and how close the call was. The thresholds are 'tuned'
// (params.ts) and only change the TAG, never the physics. The history is kept only when failOn = 1.
// M2.3 tested sea level first with a 5 m threshold and tagged 32 of 33 events 'lowstand'
// (M2.6 review finding 1); M2.7 replaced that with this rule and a 20 m default.

import type { StabilityResult } from './stability'

/** Record steps looked back for the attribution. At 5 kyr steps this is 20 kyr. */
export const LOOKBACK_STEPS = 4
/** Ring slots: the lookback plus the current step. */
export const HIST_SLOTS = LOOKBACK_STEPS + 1

export type TriggerCause = 'oversteepening' | 'overpressure' | 'rapid loading' | 'lowstand' | 'mixed'

/** End-of-step slope and pressure ratio of every column, for the last HIST_SLOTS steps (ring buffer). */
export interface TriggerHistory {
  /** Record step stored in each slot, -1 when empty. */
  step: Int32Array
  /** Elapsed years at the end of that step. */
  tYr: Float64Array
  /** tan(beta) per column, slot-major (slot * nx + j). */
  slope: Float64Array
  /** u / load at the critical cell per column; NaN when the column was not searched. */
  ru: Float64Array
}

export function createHistory(nx: number): TriggerHistory {
  return {
    step: new Int32Array(HIST_SLOTS).fill(-1),
    tYr: new Float64Array(HIST_SLOTS),
    slope: new Float64Array(HIST_SLOTS * nx),
    ru: new Float64Array(HIST_SLOTS * nx).fill(NaN),
  }
}

export function cloneHistory(h: TriggerHistory): TriggerHistory {
  return {
    step: h.step.slice(),
    tYr: h.tYr.slice(),
    slope: h.slope.slice(),
    ru: h.ru.slice(),
  }
}

/** Copy `src` into `dst` in place (same nx). */
export function copyHistory(dst: TriggerHistory, src: TriggerHistory): void {
  dst.step.set(src.step)
  dst.tYr.set(src.tYr)
  dst.slope.set(src.slope)
  dst.ru.set(src.ru)
}

/** Store the end-of-step state of record step `step` (in the slot step % HIST_SLOTS). */
export function recordHistory(h: TriggerHistory, nx: number, step: number, tYr: number, st: StabilityResult): void {
  const slot = step % HIST_SLOTS
  h.step[slot] = step
  h.tYr[slot] = tYr
  for (let j = 0; j < nx; j++) {
    h.slope[slot * nx + j] = st.slope[j]
    h.ru[slot * nx + j] = st.critLayer[j] >= 0 ? st.ru[j] : NaN
  }
}

/** Slot of the reference state for an event in record step `step`: step - LOOKBACK_STEPS, or the oldest kept step before `step`. -1 when none. */
export function referenceSlot(h: TriggerHistory, step: number): number {
  let best = -1
  let bestStep = Infinity
  for (let s = 0; s < HIST_SLOTS; s++) {
    const st = h.step[s]
    if (st < 0 || st >= step) continue
    if (st < step - LOOKBACK_STEPS) continue // stale (cannot happen with the ring, kept for safety)
    if (st < bestStep) {
      bestStep = st
      best = s
    }
  }
  return best
}

export interface TriggerInput {
  tanNow: number
  tanThen: number
  /** Pressure ratios u / load at the critical cell, now and then (NaN = unknown). */
  ruNow: number
  ruThen: number
  /** Sea level now minus then, m (negative = falling). */
  dSeaLevel: number
  /** Bulk sediment gained by the source column over the window, m/yr. */
  loadRate: number
  failLowstandDrop: number
  failRapidRate: number
  /** Slope and pressure terms (ln units) that score 1; see the rule in the header. */
  failSlopeTerm: number
  failPressTerm: number
}

export interface TriggerResult {
  cause: TriggerCause
  /** Contribution of the slope change to ln(FS_then / FS_now). */
  dSlope: number
  /** Contribution of the pore-pressure rise. */
  dPress: number
}

const TAN_FLOOR = 1e-4 // about 0.006 deg: keeps ln finite for a column that was flat
const RU_CAP = 0.999

export function attributeCause(t: TriggerInput): TriggerResult {
  const dSlope = Math.log(Math.max(t.tanNow, TAN_FLOOR) / Math.max(t.tanThen, TAN_FLOOR))
  let dPress = 0
  if (!Number.isNaN(t.ruThen) && !Number.isNaN(t.ruNow)) {
    const now = Math.min(Math.max(t.ruNow, 0), RU_CAP)
    const then = Math.min(Math.max(t.ruThen, 0), RU_CAP)
    dPress = Math.log((1 - then) / (1 - now))
  }
  // each term divided by its own threshold: 1 = just qualifies. Ties go to slope, then pressure, then sea level.
  const sSlope = dSlope > 0 ? dSlope / t.failSlopeTerm : 0
  const sPress = dPress > 0 ? dPress / t.failPressTerm : 0
  const sSea = t.dSeaLevel < 0 ? -t.dSeaLevel / t.failLowstandDrop : 0
  let cause: TriggerCause = 'mixed'
  let best = 0
  const pressLabel: TriggerCause = t.loadRate >= t.failRapidRate ? 'rapid loading' : 'overpressure'
  const scores: Array<[number, TriggerCause]> = [[sSlope, 'oversteepening'], [sPress, pressLabel], [sSea, 'lowstand']]
  for (const [s, label] of scores) {
    if (s >= 1 && s > best) {
      best = s
      cause = label
    }
  }
  return { cause, dSlope, dPress }
}
