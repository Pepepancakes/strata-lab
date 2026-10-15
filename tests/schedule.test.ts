import { describe, it, expect } from 'vitest'
import { buildSchedule, DEFAULT_SEGMENTS } from '../src/engine/schedule'
import { createRng } from '../src/engine/rng'

describe('schedule', () => {
  it('default is 600 steps of 5 kyr over 3 Myr, as in the spike', () => {
    const s = buildSchedule()
    expect(DEFAULT_SEGMENTS).toHaveLength(1)
    expect(s.nSteps).toBe(600)
    expect(s.runLengthMa).toBe(3)
    expect(s.stepDt.every((d) => d === 5000)).toBe(true)
    expect(s.tStartYr[7]).toBe(7 * 5000) // spike: t0 = k * dtRec
    expect(s.stepAgeMa[599]).toBe(0)
    expect(s.tEndYr[599]).toBe(3e6)
  })
  const long = [
    { fromAgeMa: 66, toAgeMa: 23, dt: 200000 },
    { fromAgeMa: 23, toAgeMa: 3, dt: 50000 },
    { fromAgeMa: 3, toAgeMa: 0, dt: 5000 },
  ]
  it('tiles a 66 Myr run with no gaps or overlaps', () => {
    const s = buildSchedule(long)
    expect(s.nSteps).toBe(215 + 400 + 600)
    expect(s.runLengthMa).toBe(66)
    let sumDt = 0
    for (let k = 0; k < s.nSteps; k++) {
      sumDt += s.stepDt[k]
      expect(s.tEndYr[k] - s.tStartYr[k]).toBe(s.stepDt[k])
      if (k > 0) expect(s.tStartYr[k]).toBe(s.tEndYr[k - 1])
      // age falls monotonically and agrees with elapsed time
      expect(s.stepAgeMa[k]).toBeCloseTo(66 - s.tEndYr[k] / 1e6, 9)
      if (k > 0) expect(s.stepAgeMa[k]).toBeLessThan(s.stepAgeMa[k - 1])
    }
    expect(sumDt).toBe(66e6)
    expect(s.tStartYr[0]).toBe(0)
  })
  it('ages are exact at segment joins', () => {
    const s = buildSchedule(long)
    expect(s.stepAgeMa[214]).toBe(23)
    expect(s.stepAgeMa[214 + 400]).toBe(3)
    expect(s.stepAgeMa[s.nSteps - 1]).toBe(0)
  })
  it('rejects gaps, overlaps and part-steps', () => {
    expect(() => buildSchedule([{ fromAgeMa: 3, toAgeMa: 1, dt: 5000 }, { fromAgeMa: 0.9, toAgeMa: 0, dt: 5000 }])).toThrow(/gap/)
    expect(() => buildSchedule([{ fromAgeMa: 3, toAgeMa: 1, dt: 5000 }, { fromAgeMa: 1.1, toAgeMa: 0, dt: 5000 }])).toThrow(/gap/)
    expect(() => buildSchedule([{ fromAgeMa: 3, toAgeMa: 0, dt: 7000 }])).toThrow(/whole number/)
    expect(() => buildSchedule([{ fromAgeMa: 0, toAgeMa: 3, dt: 5000 }])).toThrow(/older to younger/)
  })
})

describe('rng', () => {
  it('is reproducible from a seed and restorable', () => {
    const a = createRng(42)
    const b = createRng(42)
    const xs = Array.from({ length: 5 }, () => a.next())
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs)
    const s = a.getState()
    const next = a.next()
    a.setState(s)
    expect(a.next()).toBe(next)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})
