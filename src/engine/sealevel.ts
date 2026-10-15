// Sea-level interface. The engine asks a SeaLevelCurve for sea level (m, relative to present)
// at tYr, the ELAPSED model time in years since the start of the run (not an age).
// Why an interface: M1 ships the spike's teaching sine; M1.4 adds a published curve behind the
// same type without touching the solver.

import bintanjaJson from './data/sealevel-bintanja2008.json'
import millerJson from './data/sealevel-miller2020.json'

export type SeaLevelCurve = (tYr: number) => number

export interface SineSeaLevelParams {
  slAmp: number
  slPeriod: number
  slShift: number
}

/** Exactly the spike's seaLevel(): slAmp * sin(2 pi t / slPeriod) + slShift. */
export function sineSeaLevel(p: SineSeaLevelParams): SeaLevelCurve {
  const { slAmp, slPeriod, slShift } = p
  return (tYr) => slAmp * Math.sin((2 * Math.PI * tYr) / slPeriod) + slShift
}

// ---------------------------------------------------------------------------------------------
// Published curve (M1.4). Two bundled records, spliced:
//   0 to 2.8 Ma     Bintanja & van de Wal (2008), 300 yr rows (high resolution)
//   2.8 to 3.0 Ma   linear blend from Bintanja to Miller over SPLICE_OVERLAP_YR
//   older than 3.0  Miller et al. (2020), 20 kyr, smoothed
// The overlap sits at the OLD end of the high-resolution record, so the detailed glacial cycles
// are untouched and there is no jump at the join. Data files come from scripts/fetch-sealevel.mjs.

export interface SeaLevelTable {
  id: string
  citation: string
  licence: string
  /** Age before present, years, strictly increasing. */
  ageYr: number[]
  /** Sea level relative to present, m. */
  seaLevelM: number[]
}

export const BINTANJA_2008: SeaLevelTable = bintanjaJson as SeaLevelTable
export const MILLER_2020: SeaLevelTable = millerJson as SeaLevelTable

/** The high-resolution record ends here; the blend finishes at this age. */
export const SPLICE_END_AGE_YR = 3_000_000
/** Blend window (200 kyr, D12 recommendation). The blend starts at SPLICE_END_AGE_YR minus this. */
export const SPLICE_OVERLAP_YR = 200_000
export const SPLICE_START_AGE_YR = SPLICE_END_AGE_YR - SPLICE_OVERLAP_YR

/** Linear interpolation in a table, by age. Clamps to the first / last row outside the table. */
export function interpolateAge(table: SeaLevelTable, ageYr: number): number {
  const a = table.ageYr
  const v = table.seaLevelM
  const n = a.length
  if (ageYr <= a[0]) return v[0]
  if (ageYr >= a[n - 1]) return v[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (a[mid] <= ageYr) lo = mid
    else hi = mid
  }
  if (a[lo] === ageYr) return v[lo]
  const f = (ageYr - a[lo]) / (a[hi] - a[lo])
  return v[lo] + f * (v[hi] - v[lo])
}

/** Spliced global sea level (m, relative to present) at an AGE in years before present. */
export function splicedSeaLevelAtAge(ageYr: number): number {
  if (ageYr <= SPLICE_START_AGE_YR) return interpolateAge(BINTANJA_2008, ageYr)
  if (ageYr >= SPLICE_END_AGE_YR) return interpolateAge(MILLER_2020, ageYr)
  const w = (ageYr - SPLICE_START_AGE_YR) / SPLICE_OVERLAP_YR // 0 = all Bintanja, 1 = all Miller
  return (1 - w) * interpolateAge(BINTANJA_2008, ageYr) + w * interpolateAge(MILLER_2020, ageYr)
}

export interface CurveParams {
  /** Offset added to the curve, m. Branch what-ifs use it as a step. */
  slShift: number
}

/**
 * The published curve as a SeaLevelCurve. The engine passes ELAPSED time, so
 * age = startAgeYr - tYr. startAgeYr is the age at the start of the run (the schedule's
 * startAgeMa * 1e6; for the default run this equals `duration`, 3 Myr).
 */
export function publishedSeaLevel(p: CurveParams, startAgeYr: number): SeaLevelCurve {
  const { slShift } = p
  return (tYr) => splicedSeaLevelAtAge(startAgeYr - tYr) + slShift
}

export interface CurveCredit {
  /** Reference ids in references.ts that apply at this age. */
  refIds: string[]
  /** Short name for the UI. */
  name: string
}

/** Which record(s) the curve is drawn from at an age, for the UI label. Changes with age. */
export function curveCreditAtAge(ageYr: number): CurveCredit {
  if (ageYr <= SPLICE_START_AGE_YR) return { refIds: ['bintanja-van-de-wal-2008'], name: 'Bintanja & van de Wal (2008)' }
  if (ageYr >= SPLICE_END_AGE_YR) return { refIds: ['miller-2020'], name: 'Miller et al. (2020)' }
  return { refIds: ['bintanja-van-de-wal-2008', 'miller-2020'], name: 'Blend: Bintanja & van de Wal (2008) to Miller et al. (2020)' }
}

export type SeaLevelKind = 'curve' | 'sine'

export interface SeaLevelParams extends SineSeaLevelParams {
  seaLevelKind: SeaLevelKind
}

/** Sea level for a run: the published curve by default, the teaching sine when asked. */
export function makeSeaLevel(p: SeaLevelParams, startAgeYr: number): SeaLevelCurve {
  return p.seaLevelKind === 'sine' ? sineSeaLevel(p) : publishedSeaLevel(p, startAgeYr)
}
