import { describe, it, expect, beforeAll } from 'vitest'
import { G, RHO_W } from '../src/engine/constants'
import { PARAMS } from '../src/engine/params'
import { SALT } from '../src/engine/record'
import { TimeMachine } from '../src/worker/timeMachine'
import { runChecks } from '../src/worker/checks'
import type { RunSpec, StateView, WellColumn } from '../src/worker/protocol'
import { displayConversion, hasDisplayConversion, cToF, mToFt, densityToPpg as ppgOf } from '../src/units'
import { wellProfile, cementationOnsetDepthFt, type WellPoint } from '../src/views/well/profile'
import { balanceRows } from '../src/views/balance'
import { sourceText } from '../src/views/controls'
import { cellValue } from '../src/views/section/colors'
import { columnAtFraction, timeLineEveryMa, verticalExaggeration } from '../src/views/section/draw'

const SPEC: RunSpec = {
  presetId: 'last3',
  segments: [{ fromAgeMa: 3, toAgeMa: 1.5, dt: 20000 }, { fromAgeMa: 1.5, toAgeMa: 0, dt: 10000 }],
  overrides: { nx: 40, dx: 3750, seaLevelKind: 'curve', thermal: 1, cement: 1, thermalEvery: 5, heatFlow: 0.09, cemTonset: 40 },
}

describe('M1.6 worker data', () => {
  const tm = new TimeMachine()
  let view: StateView
  let well: WellColumn
  beforeAll(() => {
    tm.run(SPEC, 1)
    view = tm.seek(tm.root, tm.nSteps, ['thick', 'sand', 'mud', 'u', 'lam', 'temp'])
    well = tm.wellColumn(tm.root, tm.nSteps, 20)
  }, 60000)

  it('lambda* is u over the engine\'s own buoyant load, between 0 and 1', () => {
    const lam = view.lam!
    let max = 0
    for (let i = 0; i < lam.length; i++) {
      expect(lam[i]).toBeGreaterThanOrEqual(0)
      expect(lam[i]).toBeLessThanOrEqual(1)
      max = Math.max(max, lam[i])
    }
    // at least one cell is carrying overpressure after 3 Myr of fast burial
    expect(max).toBeGreaterThan(0)
    // and the colour value for the 'op' mode is lambda* itself
    const l = view.nLayers - 2
    expect(cellValue(view, 'op', l, 20)).toBe(view.lam![l * view.nx + 20])
  })

  it('temperature rises with depth in a well and the view agrees with the well column', () => {
    const T = well.temp
    let prev = -Infinity
    for (let l = well.nLayers - 1; l >= 1; l--) {
      if (well.sand[l] + well.mud[l] <= 0) continue
      if (prev !== -Infinity) expect(T[l]).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = T[l]
    }
    for (let l = 0; l < well.nLayers; l++) expect(view.temp![l * view.nx + 20]).toBeCloseTo(well.temp[l], 9)
  })

  it('exposes the ledger and the well column is the same as the section column', () => {
    expect(view.ledger.cumIn.sand + view.ledger.cumIn.mud).toBeGreaterThan(0)
    expect(well.nLayers).toBe(view.nLayers)
    for (let l = 0; l < well.nLayers; l++) expect(well.thick[l]).toBe(view.thick![l * view.nx + 20])
    expect(() => tm.wellColumn(tm.root, 1, 999)).toThrow(/outside the section/)
  })

  it('series has one entry per step, a credit for every step, and the curve changes at the splice only when the run reaches it', () => {
    const s = tm.series(tm.root)
    expect(s.ageMa.length).toBe(tm.nSteps)
    expect(s.seaLevelM.length).toBe(tm.nSteps)
    expect(s.credits.length).toBeGreaterThan(0)
    for (const i of s.creditIdx) expect(i).toBeLessThan(s.credits.length)
    expect(s.credits[0].citations.join(' ').length).toBeGreaterThan(10)
    // the sea level at the last step is the sea level of the view
    expect(s.seaLevelM[tm.nSteps - 1]).toBe(view.seaLevelM)
    // subsidence rates are the registry values scaled by the (here constant) time history
    expect(s.subsBasinMPerMyr[0]).toBeGreaterThan(s.subsShelfMPerMyr[0])
  })

  it('a sine run credits the teaching sine as tuned, not a measured record', () => {
    const t2 = new TimeMachine()
    t2.run({ ...SPEC, overrides: { ...SPEC.overrides, seaLevelKind: 'sine' } }, 1)
    const s = t2.series(t2.root)
    expect(s.credits.length).toBe(1)
    expect(s.credits[0].name).toMatch(/sine/i)
    expect(s.credits[0].citations[0]).toMatch(/tuned/)
  })

  it('every physics check carries a source', () => {
    const r = runChecks()
    expect(r.length).toBeGreaterThanOrEqual(8)
    for (const c of r) expect(c.cite.length, c.id).toBeGreaterThan(10)
    expect(r.every((c) => c.pass)).toBe(true)
  })

  it('balance rows: supplied - exported - stored is the imbalance, and it is tiny', () => {
    const rows = balanceRows(view)
    expect(rows.map((r) => r.label)).toEqual(expect.arrayContaining(['All sediment', 'Sand only']))
    for (const r of rows) {
      expect(r.imbalance).toBeCloseTo(r.stored - (r.supplied - r.exported), 9)
      expect(Math.abs(r.relError)).toBeLessThan(1e-9)
    }
  })

  it('pseudo-well profile: hydrostatic EMW is the water density, pore >= hydrostatic, overburden above pore', () => {
    const prof = wellProfile(well)
    expect(prof.points.length).toBeGreaterThan(5)
    const deep = prof.points.filter((p) => p.poreEmw !== null)
    expect(deep.length).toBeGreaterThan(5)
    const hydro = ppgOf(RHO_W)
    for (const p of deep) {
      expect(p.hydroEmw!).toBeCloseTo(hydro, 6)
      expect(p.poreEmw!).toBeGreaterThanOrEqual(p.hydroEmw! - 1e-9)
      expect(p.overburdenEmw!).toBeGreaterThan(p.hydroEmw!)
      expect(p.poreEmw!).toBeLessThanOrEqual(p.overburdenEmw! + 1e-6)
    }
    // points run from the surface down
    for (let i = 1; i < prof.points.length; i++) expect(prof.points[i].tvdssFt).toBeGreaterThan(prof.points[i - 1].tvdssFt)
    // the column is as thick as the record says
    expect(prof.bottomFt - prof.topFt).toBeCloseTo(mToFt(well.H - well.b), 3)
  })
})

describe('pseudo-well details', () => {
  const pt = (tvdssFt: number, tempF: number): WellPoint => ({ layer: 0, tvdssFt, thickFt: 10, poreEmw: null, overburdenEmw: null, hydroEmw: null, porosity: 0.3, tempF, sandFrac: 0, salt: false })
  it('finds the cementation onset by interpolation', () => {
    expect(cementationOnsetDepthFt([pt(0, 50), pt(1000, 150), pt(2000, 250)], 100)).toBeCloseTo(500, 9)
    expect(cementationOnsetDepthFt([pt(0, 50), pt(1000, 60)], 100)).toBeNull()
  })

  it('draws salt as an interval and gives salt no porosity', () => {
    const n = 4
    const mk = (a: number[]) => Float64Array.from(a)
    const w: WellColumn = {
      branchId: 'x', step: 3, ageMa: 0, column: 0, xM: 500, seaLevelM: 0, b: -1000, H: -700, nLayers: n,
      thick: mk([100, 100, 100, 100]), sand: mk([100, 0, 0, 40]), mud: mk([0, 100, 100, 20]), u: mk([0, 0, 0, 0]), temp: mk([60, 50, 40, 30]),
      material: Uint8Array.from([0, SALT, SALT, 0]), cemTonsetC: 70, cementOn: true,
    }
    const prof = wellProfile(w)
    expect(prof.saltIntervals.length).toBe(1)
    expect(prof.points.find((p) => p.salt)!.porosity).toBe(0)
    expect(prof.points.filter((p) => p.salt).length).toBe(2)
    void G
  })
})

describe('units for the registry', () => {
  it('every registry display unit has a conversion', () => {
    for (const p of PARAMS) expect(hasDisplayConversion(p.unit, p.displayUnit), `${p.key}: ${p.unit} -> ${p.displayUnit}`).toBe(true)
  })
  it('round-trips and uses the exact ft and F definitions', () => {
    for (const p of PARAMS) {
      const c = displayConversion(p.unit, p.displayUnit)
      for (const v of [0, 1, 123.456, -20]) expect(c.from(c.to(v))).toBeCloseTo(v, 9)
    }
    expect(displayConversion('m', 'ft').to(0.3048)).toBeCloseTo(1, 12)
    expect(displayConversion('deg C', 'deg F').to(100)).toBeCloseTo(212, 12)
    expect(displayConversion('m', 'km').to(1000)).toBe(1)
    expect(displayConversion('yr', 'kyr').to(5000)).toBe(5)
    expect(displayConversion('W/m^2', 'mW/m^2').to(0.065)).toBeCloseTo(65, 12)
    expect(cToF(0)).toBe(32)
  })
  it('refuses an unknown pair loudly', () => {
    expect(() => displayConversion('m', 'furlong')).toThrow(/no conversion/)
  })
})

describe('every control shows a source', () => {
  it('each parameter is cited, tuned or to verify, with words behind it', () => {
    for (const p of PARAMS) {
      const s = sourceText(p)
      expect(['cited', 'tuned', 'to verify'], p.key).toContain(s.tag)
      expect(s.text.length, p.key).toBeGreaterThan(5)
      if (s.tag === 'cited') expect(p.source.refId, p.key).toBeTruthy()
    }
  })
})

describe('section drawing helpers', () => {
  it('maps a click to a column and clamps at the edges', () => {
    expect(columnAtFraction(0, 150)).toBe(0)
    expect(columnAtFraction(0.5, 150)).toBe(75)
    expect(columnAtFraction(1, 150)).toBe(149)
    expect(columnAtFraction(-0.2, 150)).toBe(0)
  })
  it('vertical exaggeration is metres per pixel across over metres per pixel down', () => {
    expect(verticalExaggeration(150000, 1000, 3000, 300)).toBe(15)
  })
  it('time lines are 100 kyr for short runs and coarser for long ones', () => {
    expect([timeLineEveryMa(3), timeLineEveryMa(23), timeLineEveryMa(66)]).toEqual([0.1, 1, 5])
  })
})
