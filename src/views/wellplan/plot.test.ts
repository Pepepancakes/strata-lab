import { describe, expect, it } from 'vitest'
import { WELL_SEDIMENT, WELL_SALT, WELL_WATER, type WellSamples } from '../../engine/well'
import { drawIndices, linePath, saltIntervals, stationAtTvdss, MAX_POINTS } from './plot'

function samples(kinds: number[], stepFt = 100): WellSamples {
  const n = kinds.length
  const tvdssFt = new Float64Array(n)
  const mdFt = new Float64Array(n)
  for (let i = 0; i < n; i++) { tvdssFt[i] = i * stepFt; mdFt[i] = i * stepFt }
  return { n, tvdssFt, mdFt, kind: Uint8Array.from(kinds) } as unknown as WellSamples
}

describe('well plot helpers', () => {
  it('thins long wells but keeps the last station and every break', () => {
    const idx = drawIndices(5000, (i) => (i === 2500 ? 1 : 0))
    expect(idx.length).toBeLessThan(MAX_POINTS * 2)
    expect(idx[idx.length - 1]).toBe(4999)
    expect(idx).toContain(2500)
    expect(idx).toContain(2499)
  })

  it('breaks a line at NaN instead of joining across salt', () => {
    const v = Float64Array.from([8, 9, NaN, NaN, 12, 13])
    const z = Float64Array.from([0, 1, 2, 3, 4, 5])
    const d = linePath(v, z, 6, (a) => a, (a) => a)
    expect(d.match(/M/g)?.length).toBe(2)
  })

  it('finds salt intervals as runs', () => {
    const s = samples([WELL_WATER, WELL_SEDIMENT, WELL_SALT, WELL_SALT, WELL_SEDIMENT, WELL_SALT])
    const out = saltIntervals(s)
    expect(out.map((a) => [a.topTvdssFt, a.bottomTvdssFt])).toEqual([[200, 300], [500, 500]])
  })

  it('finds the station nearest a depth', () => {
    const s = samples([1, 1, 1, 1, 1])
    expect(stationAtTvdss(s, 140)).toBe(1)
    expect(stationAtTvdss(s, 160)).toBe(2)
    expect(stationAtTvdss(s, -50)).toBe(0)
    expect(stationAtTvdss(s, 9999)).toBe(4)
  })
})
