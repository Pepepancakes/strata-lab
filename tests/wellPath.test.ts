// M4.1: the geometry of a planned well, checked against a hand calculation.
// In the plane of the section minimum curvature is a circular arc:  R = 18000 / (pi * BUR) ft.
// Hand numbers for KOP 5,000 ft TVDSS, BUR 3 deg/100 ft, hold 30 deg, air gap 80 ft:
//   R = 18000 / (pi * 3) = 1,909.86 ft;  build length = 30 / 3 * 100 = 1,000 ft MD;
//   TVD gained over the build = R sin 30 = 954.93 ft;  displacement = R (1 - cos 30) = 255.87 ft (255.8726).
import { describe, expect, it } from 'vitest'
import { DEFAULT_AIR_GAP_FT, totalMeasuredDepthFt, validateWell, verticalWell, wellStations, type WellDefinition } from '../src/engine/well'
import { M_PER_FT } from '../src/units'

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b)

const J: WellDefinition = {
  xKm: 40, airGapFt: 80, kickoffFt: 5000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30, direction: 'basinward', totalDepthFt: 9000,
}

describe('well path geometry', () => {
  const st = wellStations(J)
  const at = (md: number): number => {
    const i = Array.from(st.mdFt).indexOf(md)
    expect(i, `a station at MD ${md}`).toBeGreaterThanOrEqual(0)
    return i
  }

  it('the hand numbers: radius, end-of-build TVD gain and displacement match to 1e-9', () => {
    const R = 18000 / (Math.PI * 3)
    expect(R).toBeCloseTo(1909.86, 2) // the card's figure
    const i0 = at(5080) // KOP: 5,000 ft TVDSS = 5,080 ft below the rig floor
    const i1 = at(6080) // the build is 1,000 ft of MD
    expect(st.tvdssFt[i0]).toBe(5000)
    expect(st.xKm[i0]).toBe(40)
    const gain = st.tvdFt[i1] - st.tvdFt[i0]
    const disp = ((st.xKm[i1] - st.xKm[i0]) * 1000) / M_PER_FT // ft
    expect(rel(gain, R * Math.sin(Math.PI / 6))).toBeLessThan(1e-9)
    expect(rel(disp, R * (1 - Math.cos(Math.PI / 6)))).toBeLessThan(1e-9)
    expect(gain).toBeCloseTo(954.93, 2)
    expect(disp).toBeCloseTo(255.87, 2) // the card quotes 255.88; R (1 - cos 30) = 255.8726
    expect(st.incDeg[i1]).toBeCloseTo(30, 12)
  })

  it('the arc is circular: halfway up the build the inclination is 15 deg and the point is on the circle', () => {
    const R = 18000 / (Math.PI * 3)
    const i0 = at(5080)
    const i = at(5580)
    expect(rel(st.incDeg[i], 15)).toBeLessThan(1e-12)
    const dTvd = st.tvdFt[i] - st.tvdFt[i0]
    const dX = ((st.xKm[i] - st.xKm[i0]) * 1000) / M_PER_FT
    expect(rel(dTvd, R * Math.sin(Math.PI / 12))).toBeLessThan(1e-9)
    expect(rel(Math.hypot(dTvd, R - dX), R)).toBeLessThan(1e-12) // distance from the arc's centre is R
  })

  it('on the hold, 1,000 ft of MD gives 1,000 cos 30 of depth and 1,000 sin 30 of displacement', () => {
    const iEnd = at(6080)
    const i = at(7080)
    const dTvd = st.tvdFt[i] - st.tvdFt[iEnd]
    const dX = ((st.xKm[i] - st.xKm[iEnd]) * 1000) / M_PER_FT
    expect(rel(dTvd, 1000 * Math.cos(Math.PI / 6))).toBeLessThan(1e-9)
    expect(rel(dX, 500)).toBeLessThan(1e-9)
  })

  it('stations are 10 ft of MD apart, then one at total depth exactly', () => {
    for (let i = 1; i < st.n - 1; i++) expect(st.mdFt[i] - st.mdFt[i - 1]).toBe(10)
    expect(st.tvdssFt[st.n - 1]).toBeCloseTo(9000, 9)
    expect(st.mdFt[st.n - 1]).toBeLessThanOrEqual(st.mdFt[st.n - 2] + 10)
    expect(st.mdFt[st.n - 1]).toBeGreaterThan(st.mdFt[st.n - 2])
    expect(st.mdFt[st.n - 1]).toBeCloseTo(totalMeasuredDepthFt(J), 9)
    // hand: MD at TD = KOP MD + build + (TD TVD - KOP TVD - R sin 30) / cos 30
    const R = 18000 / (Math.PI * 3)
    expect(rel(st.mdFt[st.n - 1], 5080 + 1000 + (9080 - 5080 - R * 0.5) / Math.cos(Math.PI / 6))).toBeLessThan(1e-12)
    expect(st.tvdFt.every((v, i) => i === 0 || v > st.tvdFt[i - 1])).toBe(true)
    expect(st.tvdssFt[0]).toBe(-80) // the rig floor is the air gap above the sea surface
  })

  it('landward mirrors basinward about the wellhead', () => {
    const l = wellStations({ ...J, direction: 'landward' })
    expect(l.n).toBe(st.n)
    for (let i = 0; i < st.n; i++) {
      expect(l.tvdssFt[i]).toBe(st.tvdssFt[i])
      expect(rel(l.xKm[i] - 40, -(st.xKm[i] - 40)) < 1e-12 || st.xKm[i] === 40).toBe(true)
    }
  })

  it('a total depth inside the build ends exactly there', () => {
    const short = wellStations({ ...J, totalDepthFt: 5500 })
    const last = short.n - 1
    expect(short.tvdssFt[last]).toBeCloseTo(5500, 9)
    expect(short.incDeg[last]).toBeLessThan(30)
    expect(short.incDeg[last]).toBeGreaterThan(0)
  })

  it('a vertical well is vertical: TVD = MD, no displacement, TD station on the 10 ft grid', () => {
    const v = wellStations(verticalWell(25.5, 12000))
    expect(v.n).toBe((12000 + DEFAULT_AIR_GAP_FT) / 10 + 1)
    for (let i = 0; i < v.n; i++) {
      expect(v.tvdFt[i]).toBe(v.mdFt[i])
      expect(v.xKm[i]).toBe(25.5)
      expect(v.incDeg[i]).toBe(0)
    }
    expect(v.tvdssFt[v.n - 1]).toBe(12000)
    // zero hold inclination with a build rate is also vertical
    const v2 = wellStations({ ...J, holdInclinationDeg: 0 })
    expect(v2.xKm.every((x) => x === 40)).toBe(true)
    expect(v2.tvdFt[v2.n - 1]).toBe(9080)
  })

  it('is deterministic: the same definition gives the same stations', () => {
    const a = wellStations(J)
    const b = wellStations({ ...J })
    expect(Array.from(b.xKm)).toEqual(Array.from(a.xKm))
    expect(Array.from(b.mdFt)).toEqual(Array.from(a.mdFt))
  })

  it('a 30,000 ft MD well has 3,001 stations', () => {
    const long = wellStations(verticalWell(10, 29920))
    expect(long.mdFt[long.n - 1]).toBe(30000)
    expect(long.n).toBe(3001)
  })
})

describe('well definition checks', () => {
  it('accepts the example and a vertical well', () => {
    expect(validateWell(J)).toEqual([])
    expect(validateWell(verticalWell(30, 20000))).toEqual([])
  })
  it('refuses nonsense in plain words', () => {
    expect(validateWell({ ...J, xKm: -1 })[0]).toMatch(/location/)
    expect(validateWell({ ...J, totalDepthFt: 0 })[0]).toMatch(/total depth/)
    expect(validateWell({ ...J, holdInclinationDeg: 95 })[0]).toMatch(/hold inclination/)
    expect(validateWell({ ...J, buildRateDegPer100Ft: 0 })[0]).toMatch(/build rate/)
    expect(validateWell({ ...J, kickoffFt: 9000 })[0]).toMatch(/kickoff/)
    expect(validateWell({ ...J, airGapFt: Number.NaN })[0]).toMatch(/air gap/)
    expect(validateWell({ ...J, direction: 'up' as 'basinward' })[0]).toMatch(/direction/)
  })
})
