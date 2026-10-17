// Crest log (M3b.1): hand-made histories with known rates, so every number is a hand calculation.
import { describe, expect, it } from 'vitest'
import { buildCrestLog, createCrestHistory, crestParams, emptyCrestLog, labelOf, pushCrestFrame, slope, type CrestHistory } from '../src/engine/crestLog'

const NX = 30
const DX = 1000
const DT_YR = 1e5 // 0.1 Myr per frame
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b)

interface Cell { zt: number; H: number; hs: number }

/** A history of n frames; cell(j, k) gives the salt top, seafloor and salt thickness (m) of column j at frame k. */
function hand(n: number, cell: (j: number, k: number) => Cell, nx = NX): CrestHistory {
  const h = createCrestHistory(nx, DX, n)
  for (let k = 0; k < n; k++) {
    const hs = new Float64Array(nx)
    const b = new Float64Array(nx)
    const H = new Float64Array(nx)
    for (let j = 0; j < nx; j++) {
      const c = cell(j, k)
      hs[j] = c.hs
      b[j] = c.zt - c.hs
      H[j] = c.H
    }
    pushCrestFrame(h, (k + 1) * DT_YR, 60 - 0.1 * (k + 1), hs, b, H)
  }
  return h
}

// Flat salt at -2,000 m, 1,000 m thick. Flank seafloor starts at -1,850 m and builds 4 m a frame (A = 40 m/Myr).
// The crest at column 10 starts 100 m above the flat and its salt top rises 10 m a frame (F = 100 m/Myr) with 100 m of cover.
const FLANK_A_PER_FRAME = 4
const CREST_F_PER_FRAME = 10
const steady = (j: number, k: number): Cell =>
  j === 10
    ? { zt: -1900 + CREST_F_PER_FRAME * k, H: -1800 + CREST_F_PER_FRAME * k, hs: 1100 + CREST_F_PER_FRAME * k }
    : { zt: -2000, H: -1850 + FLANK_A_PER_FRAME * k, hs: 1000 }
const P = crestParams(100)

describe('crest log: rates from a hand-made record', () => {
  const log = buildCrestLog(hand(30, steady), P)

  it('finds the one crest and follows it to the end of the run', () => {
    expect(log.episodes).toHaveLength(1)
    const e = log.episodes[0]
    expect(e.endReason).toBe('run end')
    expect(e.endAgeMa).toBeNull()
    expect(e.startCol).toBe(10)
    expect(e.track.step).toHaveLength(30)
    expect(e.firstAgeMa).toBeCloseTo(59.9, 9)
    expect(e.lastAgeMa).toBeCloseTo(57, 9)
  })

  it('F, A, F - A, A/F and the label match the hand values (1e-9 relative)', () => {
    const e = log.episodes[0]
    // F = 10 m per 0.1 Myr = 100 m/Myr, A = 40 m/Myr, F - A = 60, A/F = 0.4
    for (const w of [e.near, e.burial]) {
      expect(rel(w.F, 100)).toBeLessThan(1e-9)
      expect(rel(w.A, 40)).toBeLessThan(1e-9)
      expect(rel(w.FminusA, 60)).toBeLessThan(1e-9)
      expect(rel(w.ratioAF, 0.4)).toBeLessThan(1e-9)
      expect(w.label).toBe('tabular')
    }
    expect(e.label).toBe('tabular')
    // the 1 Myr window holds 11 records (t, t - 0.1 ... t - 1.0): both ends included
    expect(e.near.n).toBe(11)
    expect(e.near.toMyr).toBeCloseTo(3, 9)
    expect(e.near.fromMyr).toBeCloseTo(2, 9)
  })

  it('records depth below sea level, thickness and cover per record', () => {
    const e = log.episodes[0]
    expect(e.track.saltTopDepthM[0]).toBe(1900) // salt top at -1,900 m
    expect(e.track.seafloorDepthM[0]).toBe(1800)
    expect(e.track.coverM[0]).toBe(100)
    expect(e.track.saltThickM[0]).toBe(1100)
    expect(e.track.flankSeafloorDepthM[0]).toBe(1850)
    expect(e.track.saltTopDepthM[29]).toBe(1900 - 290)
    expect(e.track.flankSeafloorDepthM[29]).toBe(1850 - 4 * 29)
  })

  it('neighbour salt, flow length and L/h at the last record', () => {
    const e = log.episodes[0]
    // neighbours at +-10 km: 1,000 m of salt; the section holds salt everywhere, so the nearest salt-free column is past the edge
    expect(e.neighbourKm).toBe(10)
    expect(e.neighbourSaltM).toBe(1000)
    expect(e.flowLengthM).toBe((10 + 0.5) * DX) // to the left edge (column 0 is 10 columns away), half a cell past it
    // mean salt over columns 0 to 20: one crest of 1,100 + 290 = 1,390 and 20 columns of 1,000
    const hbar = (1390 + 20 * 1000) / 21
    expect(rel(e.meanSaltM, hbar)).toBeLessThan(1e-12)
    expect(rel(e.lOverH, (10.5 * DX) / hbar)).toBeLessThan(1e-12)
  })

  it('time at the seafloor is zero with 100 m of cover and the near time is the whole episode', () => {
    expect(log.episodes[0].atSeafloorMyr).toBe(0)
    expect(log.episodes[0].nearMyr).toBeCloseTo(3, 9)
  })

  it('a flank that builds faster than the crest rises is tapered; equal rates are unresolved', () => {
    const fast = buildCrestLog(hand(30, (j, k) => (j === 10 ? steady(j, k) : { zt: -2000, H: -1850 + 15 * k, hs: 1000 })), P)
    expect(fast.episodes[0].near.FminusA).toBeCloseTo(-50, 9)
    expect(fast.episodes[0].label).toBe('tapered')
    const same = buildCrestLog(hand(30, (j, k) => (j === 10 ? steady(j, k) : { zt: -2000, H: -1850 + 10 * k, hs: 1000 })), P)
    expect(same.episodes[0].label).toBe('unresolved')
    expect(labelOf(100, 95, 10)).toBe('unresolved')
    expect(labelOf(100, 80, 10)).toBe('tabular')
    expect(labelOf(80, 100, 10)).toBe('tapered')
    expect(labelOf(NaN, 100, 10)).toBe('unresolved')
  })
})

describe('crest log: following, burial, welds', () => {
  it('follows a crest that moves one column per step', () => {
    const log = buildCrestLog(hand(10, (j, k) => (j === 5 + k ? { zt: -1900, H: -1800, hs: 1100 } : { zt: -2000, H: -1500, hs: 1000 })), P)
    expect(log.episodes).toHaveLength(1)
    expect(log.episodes[0].track.col).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(log.episodes[0].startCol).toBe(5)
    expect(log.episodes[0].endCol).toBe(14)
  })

  it('a crest that sinks below NEAR ends its episode at the first record over it, after GAP steps', () => {
    // cover 100 m for frames 0 to 9, then 600 m (over 500 m): burial from frame 10
    const buried = (j: number, k: number): Cell =>
      j === 10 ? { zt: -1900, H: k < 10 ? -1800 : -1300, hs: 1100 } : { zt: -2000, H: -1000, hs: 1000 }
    const log = buildCrestLog(hand(20, buried), P)
    expect(log.episodes).toHaveLength(1)
    const e = log.episodes[0]
    expect(e.endReason).toBe('buried')
    // end = the first record over NEAR = frame 10 = 1.1 Myr elapsed = age 59.9 - 1.0 = 58.9 Ma
    expect(e.endAgeMa).toBeCloseTo(60 - 0.1 * 11, 9)
    // records: frames 0 to 11 (the third record over NEAR, frame 12, closes the episode and is not recorded)
    expect(e.track.step).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    // near time: the 10 records under NEAR
    expect(e.nearMyr).toBeCloseTo(1.0, 9)
    // the near window stops at frame 9; the burial window runs to frame 11
    expect(e.near.toMyr).toBeCloseTo(1.0, 9)
    expect(e.burial.toMyr).toBeCloseTo(1.2, 9)
  })

  it('a crest buried for fewer than GAP steps and back under NEAR keeps its episode', () => {
    const blip = (j: number, k: number): Cell =>
      j === 10 ? { zt: -1900, H: k === 5 || k === 6 ? -1300 : -1800, hs: 1100 } : { zt: -2000, H: -1000, hs: 1000 }
    const log = buildCrestLog(hand(15, blip), P)
    expect(log.episodes).toHaveLength(1)
    expect(log.episodes[0].endReason).toBe('run end')
    expect(log.episodes[0].track.step).toHaveLength(15)
  })

  it('a crest whose salt falls under the weld thickness ends as welded', () => {
    const welded = (j: number, k: number): Cell =>
      j === 10 ? { zt: -1900, H: -1800, hs: k < 8 ? 1100 : 50 } : { zt: -2000, H: -1500, hs: k < 8 ? 1000 : 50 }
    // after frame 8 the whole section is under the weld thickness: no column within reach holds salt
    const log = buildCrestLog(hand(15, welded), P)
    expect(log.episodes).toHaveLength(1)
    expect(log.episodes[0].endReason).toBe('welded')
    expect(log.episodes[0].track.step).toHaveLength(8)
    expect(log.episodes[0].endAgeMa).toBeCloseTo(60 - 0.1 * 9, 9)
  })

  it('exposed time counts records with cover under the exposure limit', () => {
    const exp = (j: number, k: number): Cell => (j === 10 ? { zt: -1900, H: k < 4 ? -1900 + 1 : -1800, hs: 1100 } : { zt: -2000, H: -1500, hs: 1000 })
    const log = buildCrestLog(hand(10, exp), P)
    expect(log.episodes[0].atSeafloorMyr).toBeCloseTo(0.4, 9)
  })
})

describe('crest log: determinism and salt off', () => {
  it('gives identical output for the same input', () => {
    const a = buildCrestLog(hand(30, steady), P)
    const b = buildCrestLog(hand(30, steady), P)
    expect(b).toEqual(a)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('salt off gives an empty log', () => {
    const log = emptyCrestLog(100)
    expect(log.saltOn).toBe(false)
    expect(log.episodes).toEqual([])
    expect(buildCrestLog(hand(0, steady), P).episodes).toEqual([])
    expect(buildCrestLog(hand(30, steady), P, false).episodes).toEqual([])
  })

  it('slope is exact on a straight line and NaN with fewer than 2 points', () => {
    expect(slope([0, 1, 2, 3], [5, 7, 9, 11])).toBe(2)
    expect(slope([1], [5])).toBeNaN()
    expect(slope([1, 1], [5, 6])).toBeNaN()
  })
})
