// Export of a planned well (M4.4): the CSV of the stations and the names and title text for the PNG.
// Pure functions of WellSamples + WellPressures (no DOM), so they are tested without a browser.
// Units are the ones John reads: ft, ppg, psi, deg F, km. Conversions come from src/units.ts.
//
// CSV layout
//   - Lines that start with '#' are header lines: units, method, app version, ENGINE_VERSION, the scenario.
//   - One column-name row, then one row per station. A branch overlay writes one block per branch, one
//     after the other, each block led by a '# branch ...' line; the 'branch' column repeats the name on every row.
//   - A value that does not exist at a station (pore pressure in salt, porosity in sea water) is an empty cell.

import { WELL_AIR, WELL_MTD, WELL_SALT, WELL_SEDIMENT, WELL_WATER, type WellDefinition, type WellSamples } from '../../engine/well'
import type { FractureMethod } from '../../engine/wellPressureParams'
import type { WellPressures } from '../../engine/wellPressure'
import { cToF } from '../../units'

export interface ExportRun {
  branchId: string
  /** Name shown to John ("Main run" or the branch label). */
  label: string
  samples: WellSamples
  pressures: WellPressures
  /** The branch's final state hash, as written in a scenario file (empty if unknown). */
  stateHash: string
}

export interface ExportContext {
  /** Name of the scenario (the preset's label). */
  scenario: string
  presetId: string
  /** Time of the section the well was sampled at, Ma. */
  timeMa: number
  well: WellDefinition
  fgMethod: FractureMethod
  appVersion: string
  engineVersion: number
}

export const CSV_COLUMNS = [
  'md_ft', 'tvd_rkb_ft', 'tvdss_ft', 'x_km', 'material', 'porosity', 'pore_pressure_psi', 'pore_pressure_ppg',
  'hydrostatic_ppg', 'overburden_ppg', 'fracture_gradient_ppg', 'window_ppg', 'temperature_f', 'branch',
] as const

const MATERIAL: Record<number, string> = {
  [WELL_AIR]: 'air', [WELL_WATER]: 'sea water', [WELL_SEDIMENT]: 'sediment', [WELL_SALT]: 'salt', [WELL_MTD]: 'MTD',
}

export const FG_METHOD_NAME: Record<FractureMethod, string> = {
  eaton: 'Eaton (1969)',
  'matthews-kelly': 'Matthews & Kelly (1967)',
}

/** A number as text with a fixed number of decimals; empty when the value is not defined. */
function num(v: number, decimals: number): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : ''
}

/** A text cell, quoted when it holds a comma, a quote or a line break. */
export function csvCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One line of text for a well definition, e.g. "vertical, surface 12.35 km, TD 20,000 ft TVDSS, air gap 80 ft". */
export function describeWell(w: WellDefinition): string {
  const ft = (v: number): string => Math.round(v).toLocaleString('en-US')
  const base = `surface ${w.xKm} km, TD ${ft(w.totalDepthFt)} ft TVDSS, air gap ${w.airGapFt} ft`
  if (!(w.holdInclinationDeg > 0)) return `vertical well, ${base}`
  return `build-and-hold well (kickoff ${ft(w.kickoffFt)} ft TVDSS, build ${w.buildRateDegPer100Ft} deg/100 ft, hold ${w.holdInclinationDeg} deg, ${w.direction === 'landward' ? 'toward the land' : 'toward the basin'}), ${base}`
}

/** The title block of the PNG, one string per line. */
export function titleLines(ctx: ExportContext, runs: readonly Pick<ExportRun, 'label'>[]): string[] {
  return [
    `Scenario: ${ctx.scenario}   |   Time: ${ctx.timeMa.toFixed(2)} Ma`,
    `Branches: ${runs.map((r, i) => r.label + (i === 0 && runs.length > 1 ? ' (active)' : '')).join(', ')}`,
    `Well: ${describeWell(ctx.well)}`,
    `Fracture-gradient method: ${FG_METHOD_NAME[ctx.fgMethod]}   |   Depths ft TVDSS, mud weights ppg EMW from the rig floor`,
  ]
}

/** Safe file-name piece: letters, digits, dot, dash. */
function slug(text: string): string {
  return text.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function exportFileName(ctx: Pick<ExportContext, 'presetId' | 'timeMa'>, kind: 'csv' | 'png'): string {
  const what = kind === 'csv' ? 'well-stations' : 'well-pressure'
  return `strata-${slug(ctx.presetId)}-${what}-${ctx.timeMa.toFixed(2)}Ma.${kind}`
}

/** The header lines (each starts with '#'). */
export function csvHeaderLines(ctx: ExportContext, runs: readonly ExportRun[]): string[] {
  const rows = runs.reduce((a, r) => a + r.samples.n, 0)
  return [
    '# Strata Lab planned well: one row per station',
    `# scenario: ${ctx.scenario}`,
    `# time_ma: ${ctx.timeMa.toFixed(2)}`,
    `# well: ${describeWell(ctx.well)}`,
    `# fracture_gradient_method: ${FG_METHOD_NAME[ctx.fgMethod]} (in salt the fracture gradient is the overburden)`,
    '# units: depths in ft (md_ft and tvd_rkb_ft from the rig floor RKB, tvdss_ft below mean sea level), x_km from the landward edge of the section,',
    '# units: pressures in psi, mud weights in ppg EMW from the rig floor, porosity as a fraction, temperature in deg F',
    '# window_ppg: fracture gradient minus pore pressure (hydrostatic in salt); negative = no window; empty in sea water',
    `# app_version: ${ctx.appVersion}`,
    `# engine_version: ${ctx.engineVersion}`,
    `# scenario_hash: ${runs.map((r) => `${r.label}=${r.stateHash || 'n/a'}`).join('; ')} (state hash of each branch at the end of its run, as in the scenario file)`,
    `# branches: ${runs.length}, rows: ${rows}`,
  ]
}

export function wellCsv(ctx: ExportContext, runs: readonly ExportRun[]): string {
  const out: string[] = csvHeaderLines(ctx, runs)
  out.push(CSV_COLUMNS.join(','))
  for (const r of runs) {
    const s = r.samples
    const p = r.pressures
    out.push(`# branch: ${r.label}${r.stateHash ? ` (state hash ${r.stateHash})` : ''}`)
    const name = csvCell(r.label)
    for (let i = 0; i < s.n; i++) {
      out.push([
        num(s.mdFt[i], 2), num(s.tvdFt[i], 2), num(s.tvdssFt[i], 2), num(s.xKm[i], 4),
        MATERIAL[s.kind[i]] ?? '', num(s.porosity[i], 4),
        num(p.porePsi[i], 3), num(p.poreEmw[i], 6), num(p.hydroEmw[i], 6), num(p.overburdenEmw[i], 6),
        num(p.fgEmw[i], 6), num(p.widthPpg[i], 6), num(cToF(s.tempC[i]), 2), name,
      ].join(','))
    }
  }
  return out.join('\n') + '\n'
}

/** Read an exported CSV back: header lines, the column names and the rows as text by column name. */
export function parseWellCsv(text: string): { header: string[]; columns: string[]; rows: Record<string, string>[] } {
  const header: string[] = []
  let columns: string[] = []
  const rows: Record<string, string>[] = []
  for (const line of text.split(/\r?\n/)) {
    if (line === '') continue
    if (line.startsWith('#')) {
      header.push(line)
      continue
    }
    const cells = splitCsvLine(line)
    if (columns.length === 0) {
      columns = cells
      continue
    }
    const row: Record<string, string> = {}
    columns.forEach((c, i) => { row[c] = cells[i] ?? '' })
    rows.push(row)
  }
  return { header, columns, rows }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}
