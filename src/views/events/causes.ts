// M2.8: the three cause terms of a slope failure in words, and the stalled / window-limited flags.
// The stored numbers are natural-log contributions to the fall of the factor of safety (triggers.ts):
// exp(dSlope) is how many times steeper the sea floor got, exp(-dPress) is the share of effective
// stress left after the pressure rise. Pure functions, no React.

import type { FailureEvent } from '../../engine/state'

/** Thresholds that turn a term into a score (params.ts, all tuned). */
export interface CauseThresholds {
  failSlopeTerm: number
  failPressTerm: number
  failLowstandDrop: number
  stabMaxDepth: number
}

export const DEFAULT_THRESHOLDS: CauseThresholds = { failSlopeTerm: 0.1, failPressTerm: 0.1, failLowstandDrop: 20, stabMaxDepth: 300 }

export interface CauseTerm {
  /** Plain words for the term, with its value. */
  text: string
  /** The term divided by its own threshold (1 = just qualifies); 0 when it did not push towards failure. */
  score: number
}

export function causeTerms(e: FailureEvent, th: CauseThresholds = DEFAULT_THRESHOLDS): { slope: CauseTerm; pressure: CauseTerm; seaLevel: CauseTerm } {
  const steeper = Math.exp(e.dSlope)
  const effLeft = Math.exp(-e.dPress)
  const fall = -e.dSeaLevel
  return {
    slope: {
      text: e.dSlope > 0 ? `steepening \u00d7${steeper.toFixed(2)} in the last 4 steps` : 'no steepening',
      score: e.dSlope > 0 ? e.dSlope / th.failSlopeTerm : 0,
    },
    pressure: {
      text: e.dPress > 0 ? `pressure rise: effective stress fell to ${effLeft < 0.005 ? 'under 1' : (effLeft * 100).toFixed(0)}% of its earlier value` : 'no pressure rise',
      score: e.dPress > 0 ? e.dPress / th.failPressTerm : 0,
    },
    seaLevel: {
      text: fall > 0 ? `sea-level fall ${fall.toFixed(1)} m` : e.dSeaLevel > 0 ? `sea level rose ${e.dSeaLevel.toFixed(1)} m` : 'no sea-level change',
      score: fall > 0 ? fall / th.failLowstandDrop : 0,
    },
  }
}

export const CAUSE_RULE_HELP =
  'How the cause label is chosen: each of the three terms (steeper sea floor, rising pore pressure, falling sea level) is divided by its own threshold. ' +
  'The thresholds are tuned values under Controls. The term with the largest ratio wins, but only if its ratio is at least 1; if none reaches 1 the label is \u201cmixed\u201d. ' +
  'The pressure term reads \u201crapid loading\u201d when the column was gaining sediment quickly, otherwise \u201coverpressure\u201d. ' +
  'The label only describes the failure; it never changes the physics.'

export const STALLED_HELP =
  'Stalled: the slope failed, but the debris stayed within about 0.5 km of where it started (failStallRunout, tuned), so the column is still unstable. ' +
  'The model does not fail the same columns again in the same step, so they are counted as unresolved rather than hidden.'

export const WINDOW_LIMITED_HELP =
  'Window-limited: the scar cut as deep as the search window allows (stabMaxDepth, tuned). The true failure surface may be deeper, so scar depth and volume are lower bounds.'

export interface EventFlags {
  stalled: boolean
  windowLimited: boolean
  stalledNote: string | null
  windowNote: string | null
}

export function eventFlags(e: FailureEvent, th: CauseThresholds = DEFAULT_THRESHOLDS): EventFlags {
  return {
    stalled: e.stalled,
    windowLimited: e.windowLimited,
    stalledNote: e.stalled ? 'failed but debris stayed: column unresolved' : null,
    windowNote: e.windowLimited ? `scar depth equals the search window (${th.stabMaxDepth.toFixed(0)} m, tuned)` : null,
  }
}

/** Columns that sit in stalled events: the engine counts each as unresolved (diag.failUnresolved). */
export function unresolvedColumns(events: readonly FailureEvent[]): number {
  let n = 0
  for (const e of events) if (e.stalled) n += e.sourceTo - e.sourceFrom + 1
  return n
}
