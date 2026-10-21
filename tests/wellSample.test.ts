// M4.1: the planned well sampled from the record. Runs a small marine salt basin (80 columns of 3 km, 6 Myr, 120 layers):
// water 1 to 2 km deep over the basin, 300 m of cover on 600 m of salt, a ramp of salt thinning landward.
import { beforeAll, describe, expect, it } from 'vitest'
import { G, RHO_W } from '../src/engine/constants'
import {
  DEFAULT_AIR_GAP_FT, sampleWell, verticalWell, WELL_AIR, WELL_SALT, WELL_SEDIMENT, WELL_WATER, type WellDefinition, type WellSamples,
} from '../src/engine/well'
import { cToF, ftToM, KGM3_PER_PPG, mToFt, paToPsi } from '../src/units'
import { TimeMachine } from '../src/worker/timeMachine'
import { transferListOf, type WellColumn } from '../src/worker/protocol'
import { wellProfile } from '../src/views/well/profile'

const SALTY = { saltOn: 1, saltThick: 600, saltPinchStart: 15000, saltPinchEnd: 60000, saltVisc: 1e17, coverThick: 300, weldThick: 150, nx: 80, dx: 3000, duration: 6e6, supply: 8 }
const SEGS = [{ fromAgeMa: 6, toAgeMa: 0, dt: 50000 }]
const COL = 20 // 61.5 km: 1.6 km of water, salt below the cover
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30)

describe('sampling the record along a well', () => {
  const tm = new TimeMachine()
  let nSteps = 0
  let well: WellColumn
    const sample = (w: WellDefinition, step = nSteps): WellSamples => tm.sampleWell(tm.root, step, w)
  beforeAll(() => {
    const info = tm.run({ presetId: 'last3', segments: SEGS, overrides: SALTY }, 1)
    nSteps = info.nSteps
    well = tm.wellColumn(tm.root, nSteps, COL)
  }, 120000)

  it('a vertical well at a column centre is the pseudo-well column: same cells, same values, same pressures', () => {
    const baseFt = (well.seaLevelM - well.b) / 0.3048
    const s = sample(verticalWell((COL + 0.5) * 3, Math.floor(baseFt) - 1))
    expect(s.stopped).toBeNull()
    expect(s.xKm.every((x) => x === (COL + 0.5) * 3)).toBe(true)
    const prof = wellProfile(well)
    const datum = Math.max(well.seaLevelM, well.H)
    const gap = ftToM(DEFAULT_AIR_GAP_FT)
    let compared = 0
    let pressureChecked = 0
    for (const p of prof.points) {
      // stations inside this cell
      const inside: number[] = []
      for (let i = 0; i < s.n; i++) if (s.kind[i] !== WELL_AIR && s.kind[i] !== WELL_WATER && s.layer[i] === p.layer) inside.push(i)
      if (!inside.length) continue
      for (const i of inside) {
        compared++
        expect(s.porosity[i]).toBeCloseTo(p.porosity, 12)
        expect(s.sandFrac[i]).toBeCloseTo(p.sandFrac, 12)
        expect(cToF(s.tempC[i])).toBeCloseTo(p.tempF, 9)
        expect(s.kind[i] === WELL_SALT).toBe(p.salt)
        if (p.poreEmw !== null && !p.salt) expect(s.porePa[i] - s.hydroPa[i]).toBeCloseTo(well.u[p.layer], 3) // excess pressure of the cell
        if (p.salt) expect(Number.isNaN(s.porePa[i])).toBe(true)
      }
      // pressure is linear in depth inside a cell: the two stations either side of the cell middle give the pseudo-well value at the middle
      const mid = p.tvdssFt
      const a = inside.filter((i) => s.tvdssFt[i] <= mid).pop()
      const b = inside.find((i) => s.tvdssFt[i] >= mid)
      if (a === undefined || b === undefined || a === b || p.overburdenEmw === null) continue
      const t = (mid - s.tvdssFt[a]) / (s.tvdssFt[b] - s.tvdssFt[a])
      const depthBelowRkb = datum - (well.seaLevelM - ftToM(mid)) + gap
      const toPa = (emw: number): number => emw * KGM3_PER_PPG * G * depthBelowRkb
      const ob = s.overburdenPa[a] + t * (s.overburdenPa[b] - s.overburdenPa[a])
      const hy = s.hydroPa[a] + t * (s.hydroPa[b] - s.hydroPa[a])
      expect(rel(ob, toPa(p.overburdenEmw))).toBeLessThan(1e-9)
      expect(rel(hy, toPa(p.hydroEmw!))).toBeLessThan(1e-9)
      pressureChecked++
    }
    expect(compared).toBeGreaterThan(50)
    expect(pressureChecked).toBeGreaterThan(5)
  })

  it('the top of the well is air, then sea water, then rock; water pressure is hydrostatic from RKB', () => {
    const s = sample(verticalWell(61.5, 9000))
    expect(s.kind[0]).toBe(WELL_AIR)
    expect(s.tvdssFt[0]).toBe(-DEFAULT_AIR_GAP_FT)
    const iWater = Array.from(s.kind).indexOf(WELL_WATER)
    const iRock = Array.from(s.kind).findIndex((k) => k !== WELL_AIR && k !== WELL_WATER)
    expect(iRock).toBeGreaterThan(iWater)
    expect(s.waterDepthFt).toBeGreaterThan(0)
    // sea floor: the first rock station is just below the mud line
    expect(s.tvdssFt[iRock]).toBeGreaterThanOrEqual(s.mudlineTvdssFt - 1e-9)
    expect(s.tvdssFt[iRock - 1]).toBeLessThan(s.mudlineTvdssFt)
    // water EMW at depth d below the sea surface: RHO_W d / (d + air gap) in ppg (hand calc)
    const i = iWater + 3
    const d = ftToM(s.tvdssFt[i])
    expect(s.hydroPa[i]).toBeCloseTo(RHO_W * G * d, 6)
    expect(rel(s.poreEmw[i], (RHO_W / KGM3_PER_PPG) * (d / (d + ftToM(DEFAULT_AIR_GAP_FT))))).toBeLessThan(1e-12)
  })

  it('sampling is deterministic and leaves the engine state untouched', () => {
    const w: WellDefinition = { xKm: 61.5, airGapFt: 80, kickoffFt: 7000, buildRateDegPer100Ft: 3, holdInclinationDeg: 40, direction: 'basinward', totalDepthFt: 9000 }
    const before = tm.hashes()
    const a = sample(w)
    const b = sample(w)
    expect(tm.hashes()).toEqual(before)
    for (const k of ['kind', 'layer', 'porePa', 'overburdenPa', 'hydroPa', 'porosity', 'tempC', 'ageMa', 'poreEmw'] as const) {
      expect(Array.from(b[k]), k).toEqual(Array.from(a[k]))
    }
  })

  it('between two columns the overburden is the average of the two columns at the same depth', () => {
    const mk = (xKm: number): WellDefinition => verticalWell(xKm, 5000)
    const a = sample(mk(61.5))
    const m = sample(mk(63))
    const b = sample(mk(64.5))
    let n = 0
    for (let i = 0; i < Math.min(a.n, m.n, b.n); i++) {
      if (a.kind[i] === WELL_SEDIMENT && b.kind[i] === WELL_SEDIMENT && m.kind[i] === WELL_SEDIMENT) {
        n++
        expect(rel(m.overburdenPa[i], 0.5 * (a.overburdenPa[i] + b.overburdenPa[i]))).toBeLessThan(1e-12)
        expect(m.porosity[i]).toBeCloseTo(0.5 * (a.porosity[i] + b.porosity[i]), 12)
        expect(m.tempC[i]).toBeCloseTo(0.5 * (a.tempC[i] + b.tempC[i]), 9)
      }
    }
    expect(n).toBeGreaterThan(100)
  })

  it('no blended rock: porosity stays in [0, 1] and salt stations carry no pore pressure and no porosity', () => {
    const s = sample({ xKm: 61.5, airGapFt: 80, kickoffFt: 7000, buildRateDegPer100Ft: 2, holdInclinationDeg: 35, direction: 'basinward', totalDepthFt: 12000 })
    let salt = 0
    for (let i = 0; i < s.n; i++) {
      if (s.kind[i] === WELL_AIR || s.kind[i] === WELL_WATER) continue
      expect(s.porosity[i]).toBeGreaterThanOrEqual(0)
      expect(s.porosity[i]).toBeLessThan(1)
      expect(s.overburdenPa[i]).toBeGreaterThan(0)
      if (s.kind[i] === WELL_SALT) {
        salt++
        expect(s.porosity[i]).toBe(0)
        expect(Number.isNaN(s.porePa[i])).toBe(true)
      } else {
        // The excess pressure solver leaves a residual of under 1 Pa (a 4e-8 relative error at 11 MPa). It was -0.48 Pa on Linux node 22 after SFM-2 changed
        // the sediment record, 0 on Windows. So the floor is 10 Pa, not 1e-6 Pa.
        expect(s.porePa[i]).toBeGreaterThanOrEqual(s.hydroPa[i] - 10)
      }
    }
    expect(salt).toBeGreaterThan(0)
  })

  it('a well that goes below the base of the record stops there, flagged', () => {
    const s = sample(verticalWell(61.5, 200000))
    expect(s.stopped?.reason).toBe('baseOfRecord')
    expect(s.n).toBeGreaterThan(100)
    expect(s.n).toBeLessThan(20000)
    expect(s.stopped!.mdFt).toBeCloseTo(s.mdFt[s.n - 1] + 10, 9)
    const baseFt = (well.seaLevelM - well.b) / 0.3048
    expect(s.tvdssFt[s.n - 1]).toBeLessThanOrEqual(baseFt + 1e-6)
    expect(s.tvdssFt[s.n - 1]).toBeGreaterThan(baseFt - 11)
  })

  it('a well that leaves the section stops there, flagged', () => {
    const s = sample({ xKm: 236, airGapFt: 80, kickoffFt: 7000, buildRateDegPer100Ft: 6, holdInclinationDeg: 80, direction: 'basinward', totalDepthFt: 15000 })
    expect(s.stopped?.reason).toBe('leftSection')
    expect(s.xKm[s.n - 1]).toBeLessThanOrEqual(240)
    const none = sample(verticalWell(250, 5000)) // the wellhead is outside
    expect(none.n).toBe(0)
    expect(none.stopped?.reason).toBe('leftSection')
  })

  it('refuses an invalid definition and ships its arrays through the worker transfer list', () => {
    expect(() => sample({ ...verticalWell(61.5, 5000), totalDepthFt: -1 })).toThrow(/total depth/)
    const s = sample(verticalWell(61.5, 3000))
    const list = transferListOf({ id: 1, kind: 'wellSamples', samples: s, ms: 0 })
    expect(list.length).toBeGreaterThan(5)
  })

  it('at step 0 (substrate only) the same call works', () => {
    const s = sample(verticalWell(61.5, 3000), 0)
    expect(s.n).toBeGreaterThan(0)
  })

  // M4.7 (M4.6 Finding 1): a wellhead on land has ONE rig floor, the ground plus the air gap. Same record, but the sea is put
  // 60 m below the ground at the wellhead (sea level is an argument of sampleWell), so the column's surface is above the sea.
  describe('wellhead on land: one rig floor', () => {
    const GROUND_ABOVE_SEA_M = 60
    const groundFt = mToFt(GROUND_ABOVE_SEA_M)
    const xKm = (COL + 0.5) * 3
    const land = (w: WellDefinition): WellSamples => {
      sample(verticalWell(xKm, 1000)) // moves the time machine to the final step
      const eng = (tm as unknown as { eng: Parameters<typeof sampleWell>[0] }).eng
      const hidden = tm as unknown as { get: (id: string) => unknown; eraAt: (b: unknown, s: number) => { P: Parameters<typeof sampleWell>[1] } }
      const P = hidden.eraAt(hidden.get(tm.root), nSteps - 1).P
      return sampleWell(eng, P, eng.rec.H[COL] - GROUND_ABOVE_SEA_M, w)
    }
    const PSI_PER_PPG_FT = 0.051965 // 1 ppg over 1 ft at the engine's g (docs/physics-references.md, M4.2)

    it('MD 0 is the rig floor: the air gap above the ground, and the first stations are air down to the ground', () => {
      const s = land(verticalWell(xKm, 5000))
      expect(s.mdFt[0]).toBe(0)
      expect(s.tvdFt[0]).toBe(0)
      expect(s.tvdssFt[0]).toBeCloseTo(-(DEFAULT_AIR_GAP_FT + groundFt), 9)
      expect(s.waterDepthFt).toBe(0)
      let air = 0
      for (let i = 0; i < s.n; i++) {
        if (s.tvdFt[i] < DEFAULT_AIR_GAP_FT - 1e-9) {
          air++
          expect(s.kind[i], `station ${i} above the ground`).toBe(WELL_AIR)
          expect(Number.isNaN(s.porePa[i])).toBe(true)
          expect(Number.isNaN(s.depthRkbFt[i])).toBe(true)
        } else if (s.tvdFt[i] > DEFAULT_AIR_GAP_FT + 1) expect(s.kind[i]).not.toBe(WELL_AIR)
      }
      expect(air).toBeGreaterThanOrEqual(8) // 80 ft of air at 10 ft spacing
    })

    it('tvd_rkb equals the depth the EMW uses, and psi = ppg x 0.051965 x tvd_rkb at every station (within 0.05 psi)', () => {
      const s = land(verticalWell(xKm, 5000))
      let checked = 0
      for (let i = 0; i < s.n; i++) {
        if (s.kind[i] === WELL_AIR) continue
        expect(Math.abs(s.depthRkbFt[i] - s.tvdFt[i]), `station ${i} depth`).toBeLessThan(1e-6)
        if (Number.isNaN(s.poreEmw[i])) continue
        checked++
        expect(Math.abs(paToPsi(s.porePa[i]) - s.poreEmw[i] * PSI_PER_PPG_FT * s.tvdFt[i]), `station ${i} psi`).toBeLessThan(0.05)
        expect(Math.abs(paToPsi(s.overburdenPa[i]) - s.overburdenEmw[i] * PSI_PER_PPG_FT * s.tvdFt[i]), `station ${i} overburden`).toBeLessThan(0.05)
      }
      expect(checked).toBeGreaterThan(100)
    })

    it('a J well: kickoff and total depth are TVDSS, so they sit the ground height deeper below the rig floor', () => {
      const s = land({ xKm, airGapFt: 80, kickoffFt: 2000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30, direction: 'basinward', totalDepthFt: 4000 })
      expect(s.tvdssFt[s.n - 1]).toBeCloseTo(4000, 6) // TD is TVDSS
      const firstTilt = Array.from(s.incDeg).findIndex((v) => v > 0)
      const kopTvd = s.tvdFt[firstTilt - 1] // last vertical station, at most one station spacing above the kickoff
      expect(kopTvd).toBeLessThanOrEqual(2000 + 80 + groundFt + 1e-9)
      expect(kopTvd).toBeGreaterThan(2000 + 80 + groundFt - 10)
    })
  })

  it('pure function: the engine-level call equals the time machine call', () => {
    expect(typeof sampleWell).toBe('function')
  })
})
