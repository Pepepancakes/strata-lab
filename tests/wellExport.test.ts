// Well export (M4.4): the CSV of the stations, checked against the same hand column as M4.2 (tests/wellPressure.test.ts).
// The pressures come from wellPressures(); the CSV is written, read back as text, and the fracture gradient in it is compared
// with the hand values (5,000 ft of water, mud, 2,000 ft of salt, mud; Eaton and Matthews & Kelly).
import { describe, expect, it } from 'vitest'
import { G, RHO_SALT, RHO_W } from '../src/engine/constants'
import { WELL_SALT, WELL_SEDIMENT, WELL_WATER, verticalWell, type WellSamples } from '../src/engine/well'
import { wellPressures, type PressureInput } from '../src/engine/wellPressure'
import { defaultWellPressureParams } from '../src/engine/wellPressureParams'
import { ftToM, psiToPa } from '../src/units'
import {
  CSV_COLUMNS, csvCell, describeWell, exportFileName, parseWellCsv, titleLines, wellCsv, type ExportContext, type ExportRun,
} from '../src/views/wellplan/exportWell'

const FT = ftToM(1)
const SEA = RHO_W * G
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30)

// stations: sea water at 1,000 ft, then the three hand stations (sediment 6,500 ft, salt 9,000 ft, sediment 12,000 ft TVDSS)
const TVDSS = [1000, 6500, 9000, 12000]
const GAP = 80
/** Hand column: [overburden Pa, pore Pa] per station, plain arithmetic (as in wellPressure.test.ts). */
function handColumn(tvdss: number): { kind: number; s: number; p: number; h: number } {
  const hydro = SEA * tvdss * FT
  if (tvdss <= 5000) return { kind: WELL_WATER, s: hydro, p: hydro, h: hydro }
  let s = SEA * 5000 * FT
  const layers = [
    { top: 5000, bot: 8000, rho: 2000, excess: 500, salt: false },
    { top: 8000, bot: 10000, rho: RHO_SALT, excess: 0, salt: true },
    { top: 10000, bot: 14000, rho: 2200, excess: 2500, salt: false },
  ]
  for (const l of layers) {
    s += l.rho * G * (Math.min(Math.max(tvdss, l.top), l.bot) - l.top) * FT
    if (tvdss >= l.top && tvdss <= l.bot) return { kind: l.salt ? WELL_SALT : WELL_SEDIMENT, s, p: l.salt ? NaN : hydro + psiToPa(l.excess), h: hydro }
  }
  throw new Error('below the column')
}

function samples(): WellSamples {
  const n = TVDSS.length
  const o = {
    n, mdFt: Float64Array.from(TVDSS.map((t) => t + GAP + 40)), tvdFt: Float64Array.from(TVDSS.map((t) => t + GAP)), tvdssFt: Float64Array.from(TVDSS),
    xKm: Float64Array.from(TVDSS.map(() => 12.35)), incDeg: new Float64Array(n), kind: new Uint8Array(n), depthRkbFt: new Float64Array(n),
    hydroPa: new Float64Array(n), porePa: new Float64Array(n), overburdenPa: new Float64Array(n),
    porosity: new Float64Array(n), tempC: new Float64Array(n), uOverL: new Float64Array(n),
  }
  TVDSS.forEach((t, i) => {
    const c = handColumn(t)
    o.kind[i] = c.kind
    o.depthRkbFt[i] = t + GAP
    o.hydroPa[i] = c.h
    o.porePa[i] = c.p
    o.overburdenPa[i] = c.s
    o.porosity[i] = c.kind === WELL_SEDIMENT ? 0.2 : c.kind === WELL_SALT ? 0 : NaN
    o.tempC[i] = 20 + t / 100
  })
  return o as unknown as WellSamples
}

const ctx = (fgMethod: 'eaton' | 'matthews-kelly' = 'eaton'): ExportContext => ({
  scenario: 'Last 3 Myr', presetId: 'last3', timeMa: 1.25, well: verticalWell(12.35, 12000), fgMethod, appVersion: '9.9.9', engineVersion: 7,
})
const runFor = (label: string, hash: string, method: 'eaton' | 'matthews-kelly' = 'eaton'): ExportRun => {
  const s = samples()
  return { branchId: label, label, samples: s, pressures: wellPressures(s as PressureInput, { ...defaultWellPressureParams(), fgMethod: method }), stateHash: hash }
}

describe('well CSV export', () => {
  const text = wellCsv(ctx(), [runFor('Main run', 'abc123')])
  const csv = parseWellCsv(text)

  it('header lines start with # and give units, method, app version, ENGINE_VERSION and the scenario hash', () => {
    expect(csv.header.length).toBeGreaterThan(8)
    expect(csv.header.every((l) => l.startsWith('#'))).toBe(true)
    const all = csv.header.join('\n')
    expect(all).toContain('Eaton (1969)')
    expect(all).toContain('app_version: 9.9.9')
    expect(all).toContain('engine_version: 7')
    expect(all).toContain('abc123')
    expect(all).toMatch(/ft/)
    expect(all).toMatch(/ppg/)
    expect(all).toMatch(/psi/)
    expect(all).toMatch(/deg F/)
    expect(all).toContain('Last 3 Myr')
  })

  it('has the columns of the card, one row per station, in order', () => {
    expect(csv.columns).toEqual([...CSV_COLUMNS])
    expect(csv.columns).toEqual([
      'md_ft', 'tvd_rkb_ft', 'tvdss_ft', 'x_km', 'material', 'porosity', 'pore_pressure_psi', 'pore_pressure_ppg', 'hydrostatic_ppg',
      'overburden_ppg', 'fracture_gradient_ppg', 'window_ppg', 'temperature_f', 'capped_at_overburden', 'branch',
    ])
    expect(csv.rows).toHaveLength(4)
    expect(csv.rows.map((r) => r.material)).toEqual(['sea water', 'sediment', 'salt', 'sediment'])
    expect(csv.rows[1].md_ft).toBe('6620.00')
    expect(csv.rows[1].tvd_rkb_ft).toBe('6580.00')
    expect(csv.rows[1].tvdss_ft).toBe('6500.00')
    expect(csv.rows[1].x_km).toBe('12.3500')
    expect(Number(csv.rows[1].temperature_f)).toBeCloseTo(((20 + 65) * 9) / 5 + 32, 2)
  })

  it('fracture gradient at three depths equals the M4.2 hand values (Eaton), pore pressure and window too', () => {
    // hand table of tests/wellPressure.test.ts, 1e-9 there; the file keeps six decimals of ppg, so 1e-6 here
    const hand = [
      { row: 1, pPsi: 3389.363679, pPpg: 9.912305522, sPpg: 10.30492571, fg: 10.174052314, width: 0.261746792 },
      { row: 2, pPsi: NaN, pPpg: NaN, sPpg: 12.210209047, fg: 12.210209047, width: NaN }, // salt: fracture gradient = overburden, no window (M4.7)
      { row: 3, pPsi: 7834.209869, pPpg: 12.47988747, sPpg: 13.709813854, fg: 13.299838392, width: 0.819950922 },
    ]
    for (const h of hand) {
      const r = csv.rows[h.row]
      expect(rel(Number(r.fracture_gradient_ppg), h.fg), `FG row ${h.row}`).toBeLessThan(1e-6)
      expect(rel(Number(r.overburden_ppg), h.sPpg), `S row ${h.row}`).toBeLessThan(1e-6)
      if (Number.isFinite(h.width)) expect(rel(Number(r.window_ppg), h.width), `window row ${h.row}`).toBeLessThan(1e-6)
      else expect(r.window_ppg, `window row ${h.row} (salt)`).toBe('')
      if (Number.isFinite(h.pPsi)) {
        expect(rel(Number(r.pore_pressure_psi), h.pPsi), `pore psi row ${h.row}`).toBeLessThan(1e-6)
        expect(rel(Number(r.pore_pressure_ppg), h.pPpg), `pore ppg row ${h.row}`).toBeLessThan(1e-6)
      }
    }
  })

  it('Matthews & Kelly option gives its hand values, and the header says so', () => {
    const mk = parseWellCsv(wellCsv(ctx('matthews-kelly'), [runFor('Main run', 'abc123', 'matthews-kelly')]))
    expect(rel(Number(mk.rows[1].fracture_gradient_ppg), 10.147877635)).toBeLessThan(1e-6)
    expect(rel(Number(mk.rows[3].fracture_gradient_ppg), 13.2178433)).toBeLessThan(1e-6)
    expect(mk.header.join('\n')).toContain('Matthews & Kelly (1967)')
  })

  it('empty cells where a value does not exist: no pore pressure in salt, no porosity or window in sea water; salt FG = overburden', () => {
    const salt = csv.rows[2]
    expect(salt.pore_pressure_psi).toBe('')
    expect(salt.pore_pressure_ppg).toBe('')
    expect(salt.fracture_gradient_ppg).toBe(salt.overburden_ppg)
    const water = csv.rows[0]
    expect(water.porosity).toBe('')
    expect(water.window_ppg).toBe('')
    expect(water.fracture_gradient_ppg).toBe('')
    expect(text).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('a branch overlay writes one block per branch, each row naming its branch; commas in a name are quoted', () => {
    const two = wellCsv(ctx(), [runFor('Main run', 'h1'), runFor('Branch, from 8.75 Ma', 'h2')])
    const back = parseWellCsv(two)
    expect(back.rows).toHaveLength(8)
    expect(back.rows.slice(0, 4).every((r) => r.branch === 'Main run')).toBe(true)
    expect(back.rows.slice(4).every((r) => r.branch === 'Branch, from 8.75 Ma')).toBe(true)
    expect(back.header.filter((l) => l.startsWith('# branch:'))).toHaveLength(2)
    expect(back.header.join('\n')).toContain('h2')
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('plain')).toBe('plain')
  })

  it('is deterministic: the same inputs give the same text', () => {
    expect(wellCsv(ctx(), [runFor('Main run', 'abc123')])).toBe(text)
  })
})

describe('export names and title', () => {
  it('file names are plain and say what and when', () => {
    expect(exportFileName(ctx(), 'csv')).toBe('strata-last3-well-stations-1.25Ma.csv')
    expect(exportFileName(ctx(), 'png')).toBe('strata-last3-well-pressure-1.25Ma.png')
    expect(exportFileName({ presetId: 'a b/c', timeMa: 0 }, 'png')).toBe('strata-a-b-c-well-pressure-0.00Ma.png')
  })

  it('the title names the scenario, branches, time, well and method', () => {
    const t = titleLines(ctx(), [{ label: 'Main run' }, { label: 'Branch from 8.75 Ma' }]).join('\n')
    expect(t).toContain('Last 3 Myr')
    expect(t).toContain('1.25 Ma')
    expect(t).toContain('Main run (active), Branch from 8.75 Ma')
    expect(t).toContain('vertical well')
    expect(t).toContain('Eaton (1969)')
    expect(describeWell({ ...verticalWell(5, 10000), kickoffFt: 3000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30 })).toContain('build-and-hold')
  })
})
