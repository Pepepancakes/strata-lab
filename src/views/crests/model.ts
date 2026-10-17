// View model of the crest log (M3b.2): the rows of the crest table, the sort, and the section markers.
// Pure functions of a CrestLog (src/engine/crestLog.ts); no DOM, so the table, the markers and the CSV
// (exportCrests.ts) all start from the same rows and cannot disagree.
//
// Units are the ones John reads: rates in ft/Myr, lengths in ft, positions in km, ages in Ma. The one place
// that turns metres into feet is mToFt in src/units.ts (1 ft = 0.3048 m exactly).
//
// Which numbers: F, A, F - A, A/F and the label are those of the NEAR window (the last 1 Myr while the cover is
// under 500 m, see crestLog.ts). The burial-window numbers are in the CSV only.

import type { CrestEpisode, CrestLog, SequenceLabel } from '../../engine/crestLog'
import { mToFt } from '../../units'

/** Text of each label, as shown (the engine word, with its meaning). */
export const LABEL_TEXT: Record<SequenceLabel, string> = {
  tabular: 'tabular',
  tapered: 'tapered',
  unresolved: 'unresolved',
}

/** What each label means, one line (Giles and Rowan 2012: A < F tabular, A > F tapered). */
export const LABEL_MEANING: Record<SequenceLabel, string> = {
  tabular: 'tabular: the salt top rose faster than the seafloor beside it (F > A)',
  tapered: 'tapered: the seafloor beside it built up faster than the salt top rose (A > F)',
  unresolved: 'unresolved: F and A differ by less than the noise floor, or there are too few records',
}

/** The marker is drawn by shape AND a letter, so the label never rests on colour alone. */
export const LABEL_SHAPE: Record<SequenceLabel, { shape: 'triangle-up' | 'triangle-down' | 'diamond'; letter: string; colour: string }> = {
  tabular: { shape: 'triangle-up', letter: 'T', colour: '#1b7f3b' },
  tapered: { shape: 'triangle-down', letter: 'P', colour: '#b3261e' },
  unresolved: { shape: 'diamond', letter: '?', colour: '#5b6573' },
}

export interface CrestRow {
  id: number
  /** Position of the crest at its last record, km from the landward edge. */
  xKm: number
  /** Position where it first appeared, km. */
  startKm: number
  firstAgeMa: number
  lastAgeMa: number
  /** View step that shows the crest at its last record (record step k is seen at view step k + 1). */
  lastViewStep: number
  firstViewStep: number
  atSeafloorMyr: number
  /** Near-window rates, ft/Myr; NaN when the window has fewer than two records. */
  fFtPerMyr: number
  aFtPerMyr: number
  fMinusAFtPerMyr: number
  ratioAF: number
  label: SequenceLabel
  neighbourSaltFt: number
  neighbourKm: number
  lOverH: number
  endReason: CrestEpisode['endReason']
  /** Text for the "how it ended" cell, e.g. "buried at 12.40 Ma". */
  endText: string
}

export function endText(ep: Pick<CrestEpisode, 'endReason' | 'endAgeMa'>): string {
  if (ep.endReason === 'run end') return 'still near the surface at the end of the run'
  const at = ep.endAgeMa === null ? '' : ` at ${ep.endAgeMa.toFixed(2)} Ma`
  return `${ep.endReason}${at}`
}

export function crestRows(log: CrestLog): CrestRow[] {
  return log.episodes.map((e) => {
    const n = e.track.step.length
    return {
      id: e.id,
      xKm: e.endKm,
      startKm: e.startKm,
      firstAgeMa: e.firstAgeMa,
      lastAgeMa: e.lastAgeMa,
      firstViewStep: e.track.step[0] + 1,
      lastViewStep: e.track.step[n - 1] + 1,
      atSeafloorMyr: e.atSeafloorMyr,
      fFtPerMyr: mToFt(e.near.F),
      aFtPerMyr: mToFt(e.near.A),
      fMinusAFtPerMyr: mToFt(e.near.FminusA),
      ratioAF: e.near.ratioAF,
      label: e.label,
      neighbourSaltFt: mToFt(e.neighbourSaltM),
      neighbourKm: e.neighbourKm,
      lOverH: e.lOverH,
      endReason: e.endReason,
      endText: endText(e),
    }
  })
}

export type SortKey =
  | 'id' | 'xKm' | 'firstAgeMa' | 'lastAgeMa' | 'atSeafloorMyr' | 'fFtPerMyr' | 'aFtPerMyr' | 'fMinusAFtPerMyr'
  | 'ratioAF' | 'label' | 'neighbourSaltFt' | 'lOverH' | 'endText'
export type SortDir = 'asc' | 'desc'

/** Rows sorted by one column. Missing numbers (NaN) go last in either direction; ties keep the crest id order. */
export function sortRows(rows: readonly CrestRow[], key: SortKey, dir: SortDir): CrestRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    const xBad = typeof x === 'number' && Number.isNaN(x)
    const yBad = typeof y === 'number' && Number.isNaN(y)
    if (xBad !== yBad) return xBad ? 1 : -1
    let c = 0
    if (!xBad) c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)
    return c !== 0 ? sign * c : a.id - b.id
  })
}

export interface CrestMarker {
  id: number
  /** Column of the crest at this time. */
  col: number
  label: SequenceLabel
}

/**
 * The crests active at a view step: those with a record at record step viewStep - 1. Crests are followed
 * step by step with no gaps (crestLog.ts), so a crest is active between its first and last record.
 */
export function markersAt(log: CrestLog, viewStep: number): CrestMarker[] {
  const k = viewStep - 1
  const out: CrestMarker[] = []
  for (const e of log.episodes) {
    const s = e.track.step
    if (s.length === 0 || k < s[0] || k > s[s.length - 1]) continue
    out.push({ id: e.id, col: e.track.col[k - s[0]], label: e.label })
  }
  return out
}

/** The view step that shows a crest at its last record, capped to the run. */
export function lastViewStepOf(row: Pick<CrestRow, 'lastViewStep'>, nSteps: number): number {
  return Math.max(0, Math.min(nSteps, row.lastViewStep))
}

const num0 = (v: number): string => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '\u2013')
const signed0 = (v: number): string => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}` : '\u2013')

/** The numbers of a row as one line, for the marker hover text. */
export function rowTip(r: CrestRow): string {
  return [
    `Crest ${r.id}, ${r.label}, x ${r.xKm.toFixed(1)} km`,
    `${r.firstAgeMa.toFixed(2)} to ${r.lastAgeMa.toFixed(2)} Ma`,
    `F ${signed0(r.fFtPerMyr)}, A ${signed0(r.aFtPerMyr)}, F - A ${signed0(r.fMinusAFtPerMyr)} ft/Myr`,
    `salt beside it ${num0(r.neighbourSaltFt)} ft`,
    r.endText,
  ].join('; ')
}

export const fmt = {
  num0,
  signed0,
  ratio: (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : '\u2013'),
  one: (v: number): string => (Number.isFinite(v) ? v.toFixed(1) : '\u2013'),
  two: (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : '\u2013'),
}
