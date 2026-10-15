import { describe, it, expect } from 'vitest'
import { mToFt, ftToM, mToKm, kmToM, paToPsi, psiToPa, gradientToPpg, densityToPpg, pressureToEmwPpg } from '../src/units'

describe('units', () => {
  it('converts length exactly', () => {
    expect(mToFt(0.3048)).toBe(1)
    expect(ftToM(1000)).toBeCloseTo(304.8, 10)
    expect(mToKm(2500)).toBe(2.5)
    expect(kmToM(2.5)).toBe(2500)
    expect(ftToM(mToFt(1234.5))).toBeCloseTo(1234.5, 9)
  })
  it('converts pressure (1 psi = 6894.757 Pa)', () => {
    expect(paToPsi(6894.757293168)).toBeCloseTo(1, 12)
    expect(psiToPa(paToPsi(1e7))).toBeCloseTo(1e7, 4)
  })
  it('gives fresh water 8.345 ppg and seawater ~8.55 ppg', () => {
    expect(densityToPpg(1000)).toBeCloseTo(8.3454, 3)
    expect(gradientToPpg(1000 * 9.80665)).toBeCloseTo(8.3454, 3)
    expect(densityToPpg(1025)).toBeCloseTo(8.554, 2)
  })
  it('matches the oilfield rule of thumb: 0.052 psi/ft per ppg', () => {
    // 10 ppg at 10,000 ft is about 5,200 psi
    expect(pressureToEmwPpg(psiToPa(5200), ftToM(10000))).toBeCloseTo(10, 1)
  })
})
