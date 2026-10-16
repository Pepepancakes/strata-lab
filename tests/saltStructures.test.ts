import { describe, expect, it } from 'vitest'
import { minibasins, saltHighs, saltWavelength, spacings, weldRuns } from '../src/engine/saltStructures'
import { WELD_NONE } from '../src/engine/state'

// A hand-made thickness profile, dx = 1000 m: two highs (1500, 1200) with a 300 m sag between them.
const H = [0, 500, 1500, 900, 300, 800, 1200, 600, 0]

describe('salt structures', () => {
  it('finds the two highs with hand-calculated prominence', () => {
    const f = saltHighs(H, 1000, 100)
    expect(f.map((q) => q.j)).toEqual([2, 6])
    // high at 2 is the tallest: both walks run to the edges, saddles 0 and 0, prominence 1500.
    // high at 6: left walk stops at 1500 with lowest point 300, right runs to the edge (0); the
    // higher saddle is 300, prominence 900
    expect(f[0].prominence).toBe(1500)
    expect(f[1].prominence).toBe(900)
  })

  it('finds the sag between them, and ignores the pinch-out at the edge', () => {
    const m = minibasins(H, 1000, 100)
    expect(m.map((q) => q.j)).toEqual([4])
    // rims 1500 and 1200: measured from the lower rim, 1200 - 300 = 900
    expect(m[0].prominence).toBe(900)
  })

  it('a minimum prominence filters small bumps', () => {
    expect(saltHighs(H, 1000, 1000).map((q) => q.j)).toEqual([2])
  })

  it('width at half prominence of a symmetric triangle is its full base at half height', () => {
    const tri = [0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0].map((v) => v * 100)
    const f = saltHighs(tri, 1000, 100)
    expect(f).toHaveLength(1)
    expect(f[0].prominence).toBe(400)
    expect(f[0].width).toBeCloseTo(4000, 6) // half height 200 m is reached at columns 3 and 7
  })

  it('spacings are centre to centre', () => {
    expect(spacings(saltHighs(H, 1000, 100))).toEqual([4000])
  })

  it('weld runs join neighbouring welded columns', () => {
    const age = [WELD_NONE, 5, 5, 4, WELD_NONE, 3, WELD_NONE]
    const h = [900, 5, 5, 5, 700, 5, 900]
    const r = weldRuns(age, h, 10, 1000)
    expect(r.map((q) => [q.j0, q.j1, q.fromKm, q.toKm])).toEqual([[1, 3, 1, 4], [5, 5, 5, 6]])
    expect(r[0].firstMa).toBe(5)
    expect(r[0].lastMa).toBe(4)
  })

  // Hand calculation: h = 1000 + 4 j + 300 sin(2 pi x / 20 km) over a 100 km window is exactly 5 periods;
  // after the straight-line trend is removed, the (Hann-windowed) spectrum has its weight at the 20 km line.
  it('wavelength of a sine is its period, and it ignores the mean and a linear trend', () => {
    const dx = 1000
    const h = Array.from({ length: 140 }, (_, j) => 1000 + 4 * j + 300 * Math.sin((2 * Math.PI * (j + 0.5) * dx) / 20000))
    const wl = saltWavelength(h, dx, 20000, 120000, 4000, 60000)
    expect(wl / 20000).toBeGreaterThan(0.9)
    expect(wl / 20000).toBeLessThan(1.1)
  })

  it('returns NaN for a flat profile (no wavelength to speak of)', () => {
    expect(Number.isNaN(saltWavelength(new Array(100).fill(500), 1000, 0, 100000, 4000, 60000))).toBe(true)
  })
})
