// CSV export of the crest log (M3b.2). Pure functions of a CrestLog, so they are tested without a browser.
// Same layout rules as the well export (../wellplan/exportWell.ts):
//   - lines that start with '#' are header lines (units, windows, thresholds, versions, scenario);
//   - one column-name row, then one row per crest episode (or per record in the series file);
//   - a number that does not exist (a window with fewer than 2 records, A/F with F <= 0) is an empty cell.
// The columns F, A, F - A, A/F and label of the table are the near window; the burial window is added after them.

import type { CrestLog } from '../../engine/crestLog'
import { mToFt } from '../../units'
import { csvCell } from '../wellplan/exportWell'
import { crestRows } from './model'

export interface CrestExportContext {
  scenario: string
  presetId: string
  /** Column width of the section, m (x of a record = (column + 0.5) * dx). */
  dxM: number
  appVersion: string
  engineVersion: number
}

export const CREST_COLUMNS = [
  'crest_id', 'x_first_km', 'x_last_km', 'first_age_ma', 'last_age_ma', 'end_reason', 'end_age_ma',
  'time_at_seafloor_myr', 'time_near_myr',
  'F_near_ft_per_myr', 'A_near_ft_per_myr', 'F_minus_A_near_ft_per_myr', 'A_over_F_near', 'label',
  'F_burial_ft_per_myr', 'A_burial_ft_per_myr', 'F_minus_A_burial_ft_per_myr', 'label_burial',
  'neighbour_salt_ft', 'flow_length_ft', 'mean_salt_ft', 'L_over_h',
] as const

export const RECORD_COLUMNS = [
  'crest_id', 'record_step', 'age_ma', 'time_myr', 'x_km', 'salt_top_depth_ft', 'salt_thickness_ft',
  'cover_ft', 'seafloor_depth_ft', 'flank_seafloor_depth_ft',
] as const

const num = (v: number, decimals: number): string => (Number.isFinite(v) ? v.toFixed(decimals) : '')

const ft = (m: number, decimals: number): string => num(mToFt(m), decimals)

function headerLines(ctx: CrestExportContext, log: CrestLog, what: string): string[] {
  const P = log.params
  const w = (m: number): string => `${Math.round(mToFt(m)).toLocaleString('en-US')} ft`
  return [
    `# Strata Lab crest log: ${what}`,
    `# scenario: ${ctx.scenario}`,
    '# run: main run only (the crest log is not kept for branches)',
    '# units: rates in ft/Myr (elevation, up positive), lengths and depths in ft (depths below sea level, positive down), x in km from the landward edge, ages in Ma, times in Myr',
    '# F: rise rate of the salt top; A: rise rate of the seafloor beside it (mean of columns 3 to 5 either side); F - A > 0 = tabular, < 0 = tapered, within the noise floor = unresolved (floor in the thresholds line below), both least-squares slopes over the window',
    `# near window: the last ${P.windowMyr} Myr of the records whose cover (seafloor minus salt top) is under ${w(P.nearM)}; burial window: the last ${P.windowMyr} Myr up to the last record`,
    `# thresholds: label noise floor ${Math.round(mToFt(P.noiseFloor))} ft/Myr (tuned), crest prominence ${w(P.minProm)} (tuned), near ${w(P.nearM)} (tuned), gap ${P.gapSteps} steps, track +-${P.trackCols} columns, at the seafloor = cover under ${ft(P.exposedM, 1)} ft, neighbour distance ${w(P.neighbourM)}, weld thickness ${w(P.weldThick)}`,
    '# hooks and wedges (fold zones of 50 to 1,000 m) are not resolved at the grid size: the label comes from the rates only',
    `# app_version: ${ctx.appVersion}`,
    `# engine_version: ${ctx.engineVersion}`,
    `# crests: ${log.episodes.length}, candidates merged into an older crest (not listed): ${log.merged}`,
  ]
}

export function crestFileName(ctx: Pick<CrestExportContext, 'presetId'>, kind: 'table' | 'records'): string {
  const slug = ctx.presetId.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
  return `strata-${slug}-crest-${kind}.csv`
}

/** One row per crest episode. */
export function crestCsv(ctx: CrestExportContext, log: CrestLog): string {
  const out = headerLines(ctx, log, 'one row per crest episode')
  out.push(CREST_COLUMNS.join(','))
  const rows = crestRows(log)
  log.episodes.forEach((e, i) => {
    const r = rows[i]
    out.push([
      String(e.id), num(e.startKm, 2), num(e.endKm, 2), num(e.firstAgeMa, 3), num(e.lastAgeMa, 3), csvCell(e.endReason), e.endAgeMa === null ? '' : num(e.endAgeMa, 3),
      num(e.atSeafloorMyr, 3), num(e.nearMyr, 3),
      num(r.fFtPerMyr, 1), num(r.aFtPerMyr, 1), num(r.fMinusAFtPerMyr, 1), num(e.near.ratioAF, 3), e.label,
      ft(e.burial.F, 1), ft(e.burial.A, 1), ft(e.burial.FminusA, 1), e.burial.label,
      num(r.neighbourSaltFt, 0), ft(e.flowLengthM, 0), ft(e.meanSaltM, 0), num(e.lOverH, 2),
    ].join(','))
  })
  return out.join('\n') + '\n'
}

/** One row per record (step) of every crest: the series the fits are made from. */
export function crestRecordsCsv(ctx: CrestExportContext, log: CrestLog): string {
  const out = headerLines(ctx, log, 'one row per record of each crest')
  out.push(RECORD_COLUMNS.join(','))
  for (const e of log.episodes) {
    const t = e.track
    for (let i = 0; i < t.step.length; i++) {
      out.push([
        String(e.id), String(t.step[i]), num(t.ageMa[i], 3), num(t.tMyr[i], 3), num(((t.col[i] + 0.5) * ctx.dxM) / 1000, 2),
        ft(t.saltTopDepthM[i], 1), ft(t.saltThickM[i], 1), ft(t.coverM[i], 1), ft(t.seafloorDepthM[i], 1), ft(t.flankSeafloorDepthM[i], 1),
      ].join(','))
    }
  }
  return out.join('\n') + '\n'
}
