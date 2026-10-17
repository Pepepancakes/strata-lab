// Crest log in the views (M3b.2): the table rows, sort, section markers and the CSV, against hand values.
// The history is the steady hand-made one of crestLog.test.ts: flat salt at -2,000 m, 1,000 m thick; flank seafloor
// building 4 m per frame (A = 40 m/Myr); one crest at column 10 whose salt top rises 10 m per frame (F = 100 m/Myr)
// under 100 m of cover. 20 frames of 0.1 Myr, so the crest is followed through the whole run.
import { describe, expect, it } from 'vitest'
import { buildCrestLog, createCrestHistory, crestParams, emptyCrestLog, pushCrestFrame, type CrestLog } from '../src/engine/crestLog'
import { M_PER_FT, mToFt } from '../src/units'
import { crestCsv, crestRecordsCsv, CREST_COLUMNS, RECORD_COLUMNS } from '../src/views/crests/exportCrests'
import { cardFields, CREST_LIST_COLUMNS, crestRows, endText, LABEL_SHAPE, LABEL_TEXT, listCells, markersAt, rowTip, sortRows, type CrestRow } from '../src/views/crests/model'
import { AppStore } from '../src/app/store'
import { allViews, viewsForRegion } from '../src/views/registry'
import { parseWellCsv } from '../src/views/wellplan/exportWell'

const NX = 30
const DX = 1000
const N = 20

function steadyLog(): CrestLog {
  const h = createCrestHistory(NX, DX, N)
  for (let k = 0; k < N; k++) {
    const hs = new Float64Array(NX)
    const b = new Float64Array(NX)
    const H = new Float64Array(NX)
    for (let j = 0; j < NX; j++) {
      const crest = j === 10
      const zt = crest ? -1900 + 10 * k : -2000
      hs[j] = crest ? 1100 + 10 * k : 1000
      b[j] = zt - hs[j]
      H[j] = crest ? -1800 + 10 * k : -1850 + 4 * k
    }
    pushCrestFrame(h, (k + 1) * 1e5, 60 - 0.1 * (k + 1), hs, b, H)
  }
  return buildCrestLog(h, crestParams(100))
}

const ctx = { scenario: 'Hand test', presetId: 'hand-test', dxM: DX, appVersion: '9.9.9', engineVersion: 7 }
const log = steadyLog()

describe('crest rows (view model)', () => {
  it('has one row for the hand-made crest, with rates in ft/Myr converted by 0.3048 exactly', () => {
    expect(M_PER_FT).toBe(0.3048)
    expect(mToFt(304.8)).toBeCloseTo(1000, 9)
    const rows = crestRows(log)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.id).toBe(1)
    expect(r.xKm).toBeCloseTo(10.5, 9) // column 10, (10 + 0.5) * 1,000 m
    expect(r.firstAgeMa).toBeCloseTo(59.9, 9)
    expect(r.lastAgeMa).toBeCloseTo(58.0, 9)
    expect(r.fFtPerMyr).toBeCloseTo(100 / 0.3048, 6) // 328.084
    expect(r.aFtPerMyr).toBeCloseTo(40 / 0.3048, 6) // 131.234
    expect(r.fMinusAFtPerMyr).toBeCloseTo(60 / 0.3048, 6) // 196.850
    expect(r.ratioAF).toBeCloseTo(0.4, 9)
    expect(r.label).toBe('tabular')
    expect(r.neighbourSaltFt).toBeCloseTo(1000 / 0.3048, 6) // columns 0 and 20 both hold 1,000 m
    expect(r.atSeafloorMyr).toBe(0) // cover is 100 m, never under 2 m
    expect(r.endReason).toBe('run end')
    expect(r.endText).toBe('still near the surface at the end of the run')
  })

  it('shows each label as words and as a distinct shape with a letter (not colour alone)', () => {
    expect(LABEL_TEXT).toEqual({ tabular: 'tabular', tapered: 'tapered', unresolved: 'unresolved' })
    const shapes = Object.values(LABEL_SHAPE).map((s) => s.shape)
    expect(new Set(shapes).size).toBe(3)
    const letters = Object.values(LABEL_SHAPE).map((s) => s.letter)
    expect(letters).toEqual(['T', 'P', '?'])
  })

  it('writes how a crest ended', () => {
    expect(endText({ endReason: 'buried', endAgeMa: 12.345 })).toBe('buried at 12.35 Ma')
    expect(endText({ endReason: 'welded', endAgeMa: 3 })).toBe('welded at 3.00 Ma')
    expect(endText({ endReason: 'run end', endAgeMa: null })).toBe('still near the surface at the end of the run')
  })

  it('hover text carries the row numbers', () => {
    const t = rowTip(crestRows(log)[0])
    expect(t).toContain('Crest 1, tabular, x 10.5 km')
    expect(t).toContain('F +328, A +131, F - A +197 ft/Myr')
    expect(t).toContain('salt beside it 3,281 ft')
  })

  it('an empty log gives no rows', () => {
    expect(crestRows(emptyCrestLog(100))).toEqual([])
  })
})

describe('sorting', () => {
  const base = crestRows(log)[0]
  const mk = (id: number, over: Partial<CrestRow>): CrestRow => ({ ...base, id, ...over })
  const rows = [mk(1, { fFtPerMyr: 50, label: 'tapered' }), mk(2, { fFtPerMyr: NaN, label: 'tabular' }), mk(3, { fFtPerMyr: 200, label: 'unresolved' }), mk(4, { fFtPerMyr: 50, label: 'tabular' })]
  it('sorts numbers both ways, NaN last, ties by id', () => {
    expect(sortRows(rows, 'fFtPerMyr', 'asc').map((r) => r.id)).toEqual([1, 4, 3, 2])
    expect(sortRows(rows, 'fFtPerMyr', 'desc').map((r) => r.id)).toEqual([3, 1, 4, 2])
  })
  it('sorts text and does not change the input', () => {
    expect(sortRows(rows, 'label', 'asc').map((r) => r.id)).toEqual([2, 4, 1, 3])
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4])
  })
})

describe('section markers', () => {
  it('marks a crest at the view steps between its first and last record, at its column', () => {
    // record step k is seen at view step k + 1
    expect(markersAt(log, 0)).toEqual([])
    expect(markersAt(log, 1)).toEqual([{ id: 1, col: 10, label: 'tabular' }])
    expect(markersAt(log, N)).toEqual([{ id: 1, col: 10, label: 'tabular' }])
    expect(markersAt(log, N + 1)).toEqual([])
  })
  it('the table row says which view step to go to for the last age', () => {
    expect(crestRows(log)[0].lastViewStep).toBe(N)
    expect(crestRows(log)[0].firstViewStep).toBe(1)
  })
})

describe('CSV export', () => {
  const parsed = parseWellCsv(crestCsv(ctx, log))
  it('names units, windows, thresholds and versions in the header', () => {
    const head = parsed.header.join('\n')
    expect(head).toContain('rates in ft/Myr')
    expect(head).toContain('near window: the last 1 Myr of the records whose cover')
    expect(head).toContain('under 1,640 ft')
    expect(head).toContain('burial window')
    expect(head).toContain('label noise floor 82 ft/Myr (tuned)')
    expect(head).toContain('hooks and wedges')
    expect(head).toContain('# app_version: 9.9.9')
    expect(head).toContain('# engine_version: 7')
    expect(head).toContain('# scenario: Hand test')
    expect(parsed.columns).toEqual([...CREST_COLUMNS])
  })
  it('has one row that agrees with the table row and the hand values', () => {
    expect(parsed.rows).toHaveLength(1)
    const r = parsed.rows[0]
    expect(r.crest_id).toBe('1')
    expect(r.x_first_km).toBe('10.50')
    expect(r.x_last_km).toBe('10.50')
    expect(r.first_age_ma).toBe('59.900')
    expect(r.last_age_ma).toBe('58.000')
    expect(r.end_reason).toBe('run end')
    expect(r.end_age_ma).toBe('')
    expect(r.time_at_seafloor_myr).toBe('0.000')
    expect(r.time_near_myr).toBe('2.000')
    expect(r.F_near_ft_per_myr).toBe('328.1') // 100 / 0.3048 = 328.084
    expect(r.A_near_ft_per_myr).toBe('131.2') // 40 / 0.3048 = 131.234
    expect(r.F_minus_A_near_ft_per_myr).toBe('196.9') // 60 / 0.3048 = 196.850
    expect(r.A_over_F_near).toBe('0.400')
    expect(r.label).toBe('tabular')
    expect(r.F_burial_ft_per_myr).toBe('328.1')
    expect(r.label_burial).toBe('tabular')
    expect(r.neighbour_salt_ft).toBe('3281') // 1,000 m / 0.3048 = 3,280.8
    expect(r.flow_length_ft).toBe('34449') // 10,500 m to the left edge / 0.3048
    // the table and the CSV come from the same numbers
    const row = crestRows(log)[0]
    expect(Number(r.F_near_ft_per_myr)).toBeCloseTo(row.fFtPerMyr, 1)
    expect(Number(r.F_minus_A_near_ft_per_myr)).toBeCloseTo(row.fMinusAFtPerMyr, 1)
    expect(Number(r.neighbour_salt_ft)).toBeCloseTo(row.neighbourSaltFt, 0)
  })
  it('the record file has one row per record with depths in ft', () => {
    const rec = parseWellCsv(crestRecordsCsv(ctx, log))
    expect(rec.columns).toEqual([...RECORD_COLUMNS])
    expect(rec.rows).toHaveLength(N)
    const r0 = rec.rows[0]
    expect(r0.record_step).toBe('0')
    expect(r0.age_ma).toBe('59.900')
    expect(r0.x_km).toBe('10.50')
    expect(r0.salt_top_depth_ft).toBe('6233.6') // 1,900 m / 0.3048
    expect(r0.salt_thickness_ft).toBe('3608.9') // 1,100 m
    expect(r0.cover_ft).toBe('328.1') // 100 m
    expect(r0.seafloor_depth_ft).toBe('5905.5') // 1,800 m
    expect(r0.flank_seafloor_depth_ft).toBe('6069.6') // 1,850 m
  })
  it('an empty log still writes the header and column names', () => {
    const p = parseWellCsv(crestCsv(ctx, emptyCrestLog(100)))
    expect(p.rows).toEqual([])
    expect(p.columns.length).toBe(CREST_COLUMNS.length)
  })
})

describe('crest list and selected-crest card (UI-2, D25)', () => {
  const row = crestRows(log)[0]
  it('the list has four columns, in the units John reads, and keeps the testid', () => {
    expect(CREST_LIST_COLUMNS.map((c) => c.head)).toEqual(['Crest', 'Label', 'F \u2212 A', 'Last record'])
    expect(CREST_LIST_COLUMNS.map((c) => c.unit)).toEqual(['', '', 'ft/Myr', 'Ma'])
    expect(listCells(row)).toEqual(['1', 'tabular', '+197', '58.00']) // 60 / 0.3048 = 196.85
  })
  it('the card gives position, ages, rates, label, salt beside, L/h and how it ended', () => {
    const f = Object.fromEntries(cardFields(row))
    expect(f['Position (last record)']).toBe('10.5 km')
    expect(f['Followed from / to']).toBe('59.90 / 58.00 Ma')
    expect(f['Time at the seafloor']).toBe('0.00 Myr')
    expect(f['F (salt top rise)']).toBe('+328 ft/Myr')
    expect(f['A (seafloor beside it)']).toBe('+131 ft/Myr')
    expect(f['A/F']).toBe('0.40')
    expect(f['Label']).toBe('tabular')
    expect(f['Salt beside']).toBe('3,281 ft')
    expect(f['How it ended']).toBe('still near the surface at the end of the run')
    expect(Object.keys(f)).toContain('L/h')
  })
  it('the crest view is in the right-hand column before Branches and the slope-failure list', () => {
    const right = viewsForRegion(allViews, 'right').map((v) => v.id)
    expect(right[0]).toBe('crests')
    expect(right.indexOf('crests')).toBeLessThan(right.indexOf('branches'))
    expect(viewsForRegion(allViews, 'well').map((v) => v.id)).not.toContain('crests')
  })
  it('the CSV header says what the floor does to the label (N-8)', () => {
    expect(parsed0().header.join('\n')).toContain('within the noise floor = unresolved')
  })
})

function parsed0() {
  return parseWellCsv(crestCsv(ctx, log))
}

describe('store: selecting a crest moves the pseudo-well, not the planned well', () => {
  function storeWith(plan: unknown): AppStore {
    const s = new AppStore()
    ;(s as unknown as { state: Record<string, unknown> }).state = {
      ...s.getState(), crestLog: log, info: { nx: NX, nSteps: N, dx: DX }, step: 3, wellCol: 22, wellPlan: plan,
    }
    ;(s as unknown as { refresh: () => void }).refresh = () => {}
    return s
  }
  it('sets the step, the selected crest and wellCol to the crest column at its last record', () => {
    const s = storeWith(null)
    s.selectCrest(1)
    expect(s.getState().selectedCrest).toBe(1)
    expect(s.getState().step).toBe(N) // last record step 19, seen at view step 20
    expect(s.getState().wellCol).toBe(10)
  })
  it('leaves a planned well exactly as it was', () => {
    const plan = { xKm: 22.5, marker: 'planned' }
    const s = storeWith(plan)
    s.selectCrest(1)
    expect(s.getState().wellCol).toBe(10)
    expect(s.getState().wellPlan).toBe(plan) // same object, not moved
  })
  it('clearing the pick keeps the pseudo-well where it is', () => {
    const s = storeWith(null)
    s.selectCrest(1)
    s.selectCrest(null)
    expect(s.getState().selectedCrest).toBeNull()
    expect(s.getState().wellCol).toBe(10)
  })
})
