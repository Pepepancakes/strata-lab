// AUD-1: the labels and checks that make the audit findings visible (F-1 bundling, F-2 viscosity, F-3 cap at the overburden,
// F-4a Gulf overburden against the Traugott regional trend). No physics change: these read the engine, they do not alter it.
import { describe, expect, it, beforeAll } from 'vitest'
import { presetParams, PRESETS } from '../src/engine/presets'
import { WELL_SEDIMENT, WELL_WATER, verticalWell, type WellSamples } from '../src/engine/well'
import { wellPressures, type PressureInput } from '../src/engine/wellPressure'
import { defaultWellPressureParams } from '../src/engine/wellPressureParams'
import { TimeMachine } from '../src/worker/timeMachine'
import type { RunSpec, StateView, WellColumn } from '../src/worker/protocol'
import { BUNDLE_TABLE, BUNDLE_TABLE_PROVENANCE } from '../src/views/well/bundleTable'
import {
  bundlingNote, CAP_TOL, GULF_NOT_CALIBRATED, TRAUGOTT_REF_BELOW_SEAFLOOR_FT, isCapped, LIMITS_PARAGRAPH, runIsEdited, showsGulfNote, traugottCheck, traugottOverburdenPpg,
  traugottSedimentDensityPpg, VISCOSITY_LINE, limitsParagraph, thermalIsOn, viscosityLine,
} from '../src/views/well/audit'
import { currentBundleEvery, exportNotes } from '../src/views/well/notes'
import { wellProfile } from '../src/views/well/profile'
import { cappedStations } from '../src/views/wellplan/plot'
import { csvHeaderLines, parseWellCsv, titleLines, wellCsv, type ExportContext, type ExportRun } from '../src/views/wellplan/exportWell'

describe('F-3 cap at the overburden', () => {
  it('counts u / L >= 1 - 1e-9 as capped and nothing below it', () => {
    expect(isCapped(1)).toBe(true)
    expect(isCapped(1 - 0.5 * CAP_TOL)).toBe(true)
    expect(isCapped(1 - 2 * CAP_TOL)).toBe(false)
    expect(isCapped(0.999)).toBe(false)
    expect(isCapped(NaN)).toBe(false)
    expect(isCapped(null)).toBe(false)
    expect(isCapped(undefined)).toBe(false)
  })
})

describe('F-4a Traugott (1997) regional trend', () => {
  it('sediment density: 16.3 ppg for no sediment, 17.3 ppg at 3,125 ft (hand values of the formula)', () => {
    expect(traugottSedimentDensityPpg(0)).toBeCloseTo(16.3, 12)
    expect(traugottSedimentDensityPpg(3125)).toBeCloseTo(17.3, 12)
    expect(traugottSedimentDensityPpg(3125 * 32)).toBeCloseTo(24.3, 9) // 32^0.6 = 2^3 = 8 exactly
  })

  it('reproduces the audit worked value: 2,000 ft of water and 12,300 ft TVD give 16.7 ppg', () => {
    expect(traugottOverburdenPpg(2000, 12300)).toBeCloseTo(16.7, 1)
    expect(Math.abs(traugottOverburdenPpg(2000, 12300) - 16.7)).toBeLessThan(0.05)
  })

  it('reproduces the audit Gulf col 150 trend value of 18.3 ppg (252 ft of water, 12,174 ft TVDSS)', () => {
    expect(Math.abs(traugottOverburdenPpg(252, 12174) - 18.3)).toBeLessThan(0.05)
  })

  it('is just the water gradient with no sediment, and undefined at the surface', () => {
    expect(traugottOverburdenPpg(1000, 1000)).toBeCloseTo(8.5, 12)
    expect(Number.isNaN(traugottOverburdenPpg(0, 0))).toBe(true)
  })

  it('check: gap = trend minus model; null without sediment', () => {
    const c = traugottCheck({ depthBelowSeaFt: 12174, waterDepthFt: 252, overburdenPpg: 16.59 })!
    expect(c.trendPpg).toBeCloseTo(traugottOverburdenPpg(252, 12174), 12)
    expect(c.gapPpg).toBeCloseTo(c.trendPpg - 16.59, 12)
    expect(c.gapPpg).toBeGreaterThan(1.5) // the audit's finding: about 1.7 ppg light
    expect(traugottCheck(null)).toBeNull()
    expect(traugottCheck({ depthBelowSeaFt: 100, waterDepthFt: 200, overburdenPpg: 8.5 })).toBeNull()
  })
})

describe('F-1 bundling note', () => {
  it('has no note when deep compaction is solved in full', () => {
    expect(bundlingNote({ presetId: 'last3', bundleEvery: 1, edited: false })).toBeNull()
  })

  it('quotes the measured table for an unedited bundled preset', () => {
    const note = bundlingNote({ presetId: 'gulf', bundleEvery: 20, edited: false })!
    expect(note).toContain('Bundled deep compaction (speed-up)')
    expect(note).toContain('below about 5,000 ft')
    expect(note).toContain(`up to ${BUNDLE_TABLE.gulf.maxPpg.toFixed(1)} ppg`)
    expect(note).toContain('measured, AUDIT-1')
    expect(note).toContain('99 % of cells within')
  })

  it('says "not measured" and names bundleEvery = 1 for an edited or custom run', () => {
    for (const note of [bundlingNote({ presetId: 'gulf', bundleEvery: 20, edited: true })!, bundlingNote({ presetId: 'gulf', bundleEvery: 5, edited: false })!, bundlingNote({ presetId: 'last3', bundleEvery: 10, edited: false })!]) {
      expect(note).toContain('not measured')
      expect(note).toContain('bundleEvery = 1')
    }
  })

  it('the table is generated: every bundled preset has an entry made at its own bundleEvery, and the provenance names the script', () => {
    expect(BUNDLE_TABLE_PROVENANCE).toContain('scripts/gen-bundle-table.mjs')
    for (const p of PRESETS) {
      const be = presetParams(p.id).bundleEvery
      if (be > 1) {
        expect(BUNDLE_TABLE[p.id], p.id).toBeDefined()
        expect(BUNDLE_TABLE[p.id].bundleEvery, p.id).toBe(be)
        expect(BUNDLE_TABLE[p.id].maxPpg).toBeGreaterThanOrEqual(BUNDLE_TABLE[p.id].rawPpg)
        expect(BUNDLE_TABLE[p.id].maxPpg - BUNDLE_TABLE[p.id].rawPpg).toBeLessThan(0.1 + 1e-9)
      } else expect(BUNDLE_TABLE[p.id], p.id).toBeUndefined()
    }
  })

  it('short run: bundled and full solves differ in pore pressure, so the note has something to measure (and are equal when bundling is off)', () => {
    const spec = (bundleEvery: number): RunSpec => ({
      presetId: 'last3', segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 50000 }], overrides: { nx: 30, dx: 5000, bundleEvery, bundleAgeYr: 100000 },
    })
    const u = (be: number): Float64Array => {
      const tm = new TimeMachine()
      tm.run(spec(be), 1)
      return tm.seek(tm.root, tm.nSteps, ['u']).u!
    }
    const a = u(1), b = u(10), c = u(1)
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(c[i]) // deterministic
      diff = Math.max(diff, Math.abs(a[i] - b[i]))
    }
    expect(diff).toBeGreaterThan(0)
  }, 60000)

  it('edited = any override or a changed time step list', () => {
    const p = PRESETS.find((x) => x.id === 'gulf')!
    expect(runIsEdited('gulf', {}, p.segments)).toBe(false)
    expect(runIsEdited('gulf', { supply: 30 }, p.segments)).toBe(true)
    expect(runIsEdited('gulf', {}, p.segments.map((s) => ({ ...s, dt: s.dt * 2 })))).toBe(true)
  })

  it('reads bundleEvery from an override before the preset', () => {
    const p = PRESETS.find((x) => x.id === 'gulf')!
    expect(currentBundleEvery({ presetId: 'gulf', overrides: {} })).toBe(20)
    expect(currentBundleEvery({ presetId: 'gulf', overrides: { bundleEvery: 1 } })).toBe(1)
    expect(exportNotes({ presetId: 'gulf', overrides: {}, segments: p.segments.map((s) => ({ ...s })) }).length).toBe(2) // bundling + Gulf
    expect(exportNotes({ presetId: 'gulf', overrides: { bundleEvery: 1 }, segments: p.segments.map((s) => ({ ...s })) }).length).toBe(1) // Gulf only
    expect(exportNotes({ presetId: 'last3', overrides: {}, segments: PRESETS[0].segments.map((s) => ({ ...s })) })).toEqual([])
    expect(showsGulfNote('gulf')).toBe(true)
    expect(GULF_NOT_CALIBRATED.startsWith('Not calibrated to the Gulf:')).toBe(true) // AUD-6 B-2
    expect(GULF_NOT_CALIBRATED).toContain('mud permeability is tuned')
    expect(GULF_NOT_CALIBRATED).toContain('shallow section reads over hydrostatic')
    expect(GULF_NOT_CALIBRATED).not.toContain('partly')
    expect(showsGulfNote('miocene')).toBe(false)
  })
})

describe('F-2 and F-9 limits text', () => {
  it('names the 68 F (20 C) viscosity and the structural limits', () => {
    expect(VISCOSITY_LINE).toContain('68 F (20 C)')
    expect(LIMITS_PARAGRAPH).toContain('68 F (20 C)')
    for (const w of ['1D', 'leak-off', 'tuned', 'centroid', 'capped at the overburden']) expect(LIMITS_PARAGRAPH).toContain(w)
  })
})

// ---- engine and worker: the new diagnostic reads --------------------------------------------------

const SPEC: RunSpec = {
  presetId: 'last3',
  segments: [{ fromAgeMa: 3, toAgeMa: 1.5, dt: 20000 }, { fromAgeMa: 1.5, toAgeMa: 0, dt: 10000 }],
  overrides: { nx: 40, dx: 3750, seaLevelKind: 'curve' },
}

describe('u / L diagnostics', () => {
  const tm = new TimeMachine()
  let view: StateView
  let well: WellColumn
  let samples: WellSamples
  beforeAll(() => {
    tm.run(SPEC, 1)
    view = tm.seek(tm.root, tm.nSteps, ['thick', 'sand', 'mud', 'u', 'lam'])
    well = tm.wellColumn(tm.root, tm.nSteps, 20)
    samples = tm.sampleWell(tm.root, tm.nSteps, verticalWell(20 * 3.75 + 1, 6000))
  }, 60000)

  it('the view carries diag.clamps and the largest u / L, equal to the lambda* field before its cap at 1', () => {
    expect(Number.isInteger(view.clamps)).toBe(true)
    let max = 0
    for (let i = 0; i < view.lam!.length; i++) max = Math.max(max, view.lam![i])
    expect(view.maxUOverL!).toBeGreaterThanOrEqual(max - 1e-12)
    expect(view.maxUOverL!).toBeGreaterThan(0)
  })

  it('AUD-7 N-6: a run that caps counts clamps > 0 and no cell goes past the overburden (u / L <= 1)', () => {
    // 60 m^2/yr supply and mud permeability x0.01 on the 40-column 3 Myr run: the pore pressure reaches the overburden.
    const capSpec: RunSpec = { ...SPEC, overrides: { ...SPEC.overrides, supply: 60, kMudMult: 0.01 } }
    const tmc = new TimeMachine()
    tmc.run(capSpec, 1)
    const v = tmc.seek(tmc.root, tmc.nSteps, ['u', 'lam'])
    expect(v.clamps!).toBeGreaterThan(0)
    expect(v.maxUOverL!).toBeLessThanOrEqual(1 + 1e-12) // largest u / L over the record, not clamped by the view
    expect(v.maxUOverL!).toBeGreaterThan(1 - 1e-9) // and it sits on the cap
    for (let i = 0; i < v.lam!.length; i++) expect(v.lam![i]).toBeLessThanOrEqual(1 + 1e-12)
  }, 60000)

  it('the pseudo-well profile u / L agrees with the lambda* field of the same column, cell by cell', () => {
    const prof = wellProfile(well)
    let seen = 0
    for (const p of prof.points) {
      if (p.salt) {
        expect(p.uOverL).toBeNull()
        continue
      }
      expect(p.uOverL!).toBeCloseTo(view.lam![p.layer * view.nx + 20], 9)
      seen++
    }
    expect(seen).toBeGreaterThan(5)
    expect(prof.maxUOverL).toBeLessThanOrEqual(view.maxUOverL! + 1e-12)
    expect(prof.cappedCells).toBe(prof.points.filter((p) => p.capped).length)
  })

  it('the trend cell is the sediment cell nearest 12,000 ft below the sea floor, or the deepest when the column is thinner', () => {
    const prof = wellProfile(well)
    const d = prof.trendCell!
    const deepest = prof.points[prof.points.length - 1]
    // this short column is much thinner than 12,000 ft, so the deepest cell is the nearest one
    expect(deepest.tvdssFt - d.waterDepthFt).toBeLessThan(TRAUGOTT_REF_BELOW_SEAFLOOR_FT)
    expect(d.depthBelowSeaFt).toBeCloseTo(deepest.tvdssFt, 6)
    // the profile's own overburden EMW is taken from the rig floor; with the air gap removed it is the same stress
    expect(d.overburdenPpg).toBeGreaterThan(8.5)
    expect(d.overburdenPpg).toBeLessThan(25)
  })

  it('well samples carry u / L per station: NaN in water, a number in sediment', () => {
    let sed = 0
    for (let i = 0; i < samples.n; i++) {
      if (samples.kind[i] === WELL_WATER) expect(Number.isNaN(samples.uOverL[i])).toBe(true)
      if (samples.kind[i] === WELL_SEDIMENT) {
        expect(Number.isFinite(samples.uOverL[i])).toBe(true)
        expect(samples.uOverL[i]).toBeGreaterThanOrEqual(0)
        sed++
      }
    }
    expect(sed).toBeGreaterThan(5)
  })
})

// ---- plot markers and exports ----------------------------------------------------------------------

function fakeSamples(uOverL: number[], kind: number[]): WellSamples {
  const n = uOverL.length
  const tvdss = Float64Array.from(uOverL.map((_, i) => 6000 + i * 100))
  return {
    n, mdFt: Float64Array.from(tvdss, (t) => t + 80), tvdFt: Float64Array.from(tvdss, (t) => t + 80), tvdssFt: tvdss, xKm: new Float64Array(n).fill(12),
    incDeg: new Float64Array(n), kind: Uint8Array.from(kind), depthRkbFt: Float64Array.from(tvdss, (t) => t + 80),
    hydroPa: Float64Array.from(tvdss, (t) => 1025 * 9.81 * t * 0.3048), porePa: Float64Array.from(tvdss, (t) => 1.1 * 1025 * 9.81 * t * 0.3048),
    overburdenPa: Float64Array.from(tvdss, (t) => 2 * 1025 * 9.81 * t * 0.3048), porosity: new Float64Array(n).fill(0.2), tempC: new Float64Array(n).fill(50),
    uOverL: Float64Array.from(uOverL),
  } as unknown as WellSamples
}

describe('capped stations on the planned well', () => {
  const s = fakeSamples([0.2, 1, 1 - 1e-12, 0.99, NaN], [WELL_SEDIMENT, WELL_SEDIMENT, WELL_SEDIMENT, WELL_SEDIMENT, WELL_WATER])
  const lines = { hydro: new Float64Array(5).fill(9), pore: Float64Array.from([10, 12, 13, 14, NaN]), overburden: new Float64Array(5).fill(16), fg: new Float64Array(5).fill(15) }

  it('lists the stations with u / L >= 1 - 1e-9 that have a pore line', () => {
    expect(cappedStations({ samples: s, lines })).toEqual([1, 2])
  })

  it('thins a long capped stretch to at most max markers, keeping the first', () => {
    const n = 500
    const big = fakeSamples(new Array(n).fill(1), new Array(n).fill(WELL_SEDIMENT))
    const l = { hydro: new Float64Array(n), pore: new Float64Array(n).fill(12), overburden: new Float64Array(n), fg: new Float64Array(n) }
    const out = cappedStations({ samples: big, lines: l }, 40)
    expect(out.length).toBe(40)
    expect(out[0]).toBe(0)
  })

  const ctx: ExportContext = {
    scenario: 'Gulf-style', presetId: 'gulf', timeMa: 0, well: verticalWell(12.35, 12000), fgMethod: 'eaton', appVersion: '9.9.9', engineVersion: 7,
    notes: ['Bundled deep compaction (speed-up): test note'],
  }
  const run: ExportRun = {
    branchId: 'main', label: 'Main run', samples: s,
    pressures: wellPressures(s as PressureInput, defaultWellPressureParams()), stateHash: 'h1',
  }

  it('CSV: a capped_at_overburden flag per row (1/0, empty in water), the notes and the viscosity line in the header', () => {
    const csv = parseWellCsv(wellCsv(ctx, [run]))
    expect(csv.rows.map((r) => r.capped_at_overburden)).toEqual(['0', '1', '1', '0', ''])
    const head = csv.header.join('\n')
    expect(head).toContain('# note: Bundled deep compaction (speed-up): test note')
    expect(head).toContain('68 F (20 C)')
    expect(head).toContain('capped_at_overburden')
    expect(csvHeaderLines(ctx, [run]).every((l) => l.startsWith('#'))).toBe(true)
  })

  it('PNG title block carries the notes and the viscosity line', () => {
    const lines2 = titleLines(ctx, [run])
    expect(lines2.some((l) => l.startsWith('Note: Bundled deep compaction'))).toBe(true)
    expect(lines2.some((l) => l.includes('68 F (20 C)'))).toBe(true)
  })
})

describe('AUD-2 viscosity label follows the heat model', () => {
  it('says 68 F only with the heat model off, and names IAPWS 2008 with it on', () => {
    expect(viscosityLine(false)).toContain('68 F (20 C)')
    expect(viscosityLine(true)).toContain('follows temperature (IAPWS 2008)')
    expect(viscosityLine(true)).not.toContain('68 F')
    expect(limitsParagraph(true)).not.toContain('68 F')
    expect(limitsParagraph(false)).toBe(LIMITS_PARAGRAPH)
  })
  it('reads the heat switch from the override first, then the preset', () => {
    expect(thermalIsOn(0, {})).toBe(false)
    expect(thermalIsOn(0, { thermal: 1 })).toBe(true)
    expect(thermalIsOn(1, { thermal: 0 })).toBe(false)
  })
})
