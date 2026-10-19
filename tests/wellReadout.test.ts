// Fix 03 (check 7): the pseudo-well gets a depth readout. Before it, the pore line at 500 to 2,000 ft below the
// sea floor was a 20-pixel sliver at the top of a 0 to 38,000 ft plot with 5,000 ft ticks, so John could not read
// the 10 to 12 ppg the docs quote there. The readout names the cell under the pointer and its EMWs, measured the
// same way the plot draws them (from the rig floor).
import { describe, expect, it } from 'vitest'
import { G, RHO_W } from '../src/engine/constants'
import { MTD, SALT } from '../src/engine/record'
import { densityToPpg, ftToM } from '../src/units'
import type { WellColumn } from '../src/worker/protocol'
import { wellProfile } from '../src/views/well/profile'
import { readoutAt, readoutText, svgYToFt } from '../src/views/well/readout'

const mk = (a: number[]) => Float64Array.from(a)
// 100 m of water over four 100 m cells (top first in the arrays below means layer 3 is the top cell).
function column(over: Partial<WellColumn> = {}): WellColumn {
  return {
    branchId: 'x', step: 3, ageMa: 0, column: 7, xM: 7500, seaLevelM: 0, b: -500, H: -100, nLayers: 4,
    thick: mk([100, 100, 100, 100]), sand: mk([40, 40, 0, 40]), mud: mk([20, 20, 100, 20]), u: mk([0, 4e6, 0, 1e6]),
    temp: mk([60, 50, 40, 30]), material: Uint8Array.from([0, 0, 0, 0]), cemTonsetC: 70, cementOn: false,
    ...over,
  }
}

describe('pseudo-well readout: which cell', () => {
  const prof = wellProfile(column())
  it('returns the cell whose interval holds the depth, with its depth below the sea floor', () => {
    // top cell (layer 3) spans 100 to 200 m below the sea surface = 328.08 to 656.17 ft
    const r = readoutAt(prof, 500)!
    expect(r.point.layer).toBe(3)
    // the values are the cell's, so the depths named are the cell middle's (150 m, 50 m below the sea floor)
    expect(r.belowTopFt).toBeCloseTo(50 / 0.3048, 6)
    expect(r.onLand).toBe(false)
    expect(readoutAt(prof, 700)!.point.layer).toBe(2)
  })
  it('returns null in the water and below the base of the column', () => {
    expect(readoutAt(prof, 200)).toBeNull()
    expect(readoutAt(prof, 500 / 0.3048 + 1)).toBeNull()
  })
  it('gives the same pore EMW as the plotted line, by hand: (rho_w g d + u) / (g (d + air gap))', () => {
    const r = readoutAt(prof, 500)!
    const d = 150 // middle of the top cell, m below the sea surface
    const air = ftToM(80)
    expect(r.point.poreEmw).toBeCloseTo(densityToPpg((RHO_W * G * d + 1e6) / (G * (d + air))), 9)
    expect(r.point.hydroEmw).toBeCloseTo(densityToPpg((RHO_W * G * d) / (G * (d + air))), 9)
  })
})

describe('pseudo-well readout: the words', () => {
  const prof = wellProfile(column())
  it('names TVDSS, the depth below the sea floor, the three EMWs and the excess over hydrostatic', () => {
    const r = readoutAt(prof, 500)!
    const t = readoutText(r, 80)
    const p = r.point
    expect(t).toContain(`${Math.round(p.tvdssFt).toLocaleString('en-US')} ft TVDSS`)
    expect(t).toContain(`${Math.round(r.belowTopFt).toLocaleString('en-US')} ft below the sea floor`)
    expect(t).toContain(`pore ${p.poreEmw!.toFixed(2)} ppg`)
    expect(t).toContain(`hydrostatic ${p.hydroEmw!.toFixed(2)} ppg`)
    expect(t).toContain(`overburden ${p.overburdenEmw!.toFixed(2)} ppg`)
    expect(t).toContain(`${(p.poreEmw! - p.hydroEmw!).toFixed(2)} ppg over hydrostatic`)
    expect(t).toContain('from the rig floor, 80 ft above the sea surface')
  })
  it('says salt has no pore pressure', () => {
    const sp = wellProfile(column({ material: Uint8Array.from([0, 0, SALT, 0]) }))
    const t = readoutText(readoutAt(sp, 700)!, 80)
    expect(t).toContain('salt: no pore pressure')
    expect(t).not.toMatch(/pore \d/)
  })
  it('says below the ground on land, and the rig floor is above the ground', () => {
    const land = wellProfile(column({ seaLevelM: -200, H: -100 }))
    const r = readoutAt(land, -100 / 0.3048 + 50)!
    expect(r.onLand).toBe(true)
    const t = readoutText(r, 80)
    expect(t).toContain('below the ground')
    expect(t).toContain('80 ft above the ground')
  })
  it('flags a capped cell and an MTD cell', () => {
    const capped = wellProfile(column({ u: mk([0, 0, 0, 1e9]), material: Uint8Array.from([0, 0, 0, MTD]) }))
    const t = readoutText(readoutAt(capped, 500)!, 80)
    expect(t).toContain('capped at the overburden')
    expect(t).toContain('MTD')
  })
})

describe('pseudo-well readout: pointer position to depth', () => {
  it('inverts the plot scale (viewBox y to ft) and clamps to the plot', () => {
    // plot from TOP 34 to H - BOT = 358 in a 380-unit viewBox drawn 760 px tall (scale 2)
    const ft = (clientY: number) => svgYToFt(clientY, 100, 760, 380, 34, 22, 0, 32400)
    expect(ft(100 + 34 * 2)).toBeCloseTo(0, 9)
    expect(ft(100 + 358 * 2)).toBeCloseTo(32400, 9)
    expect(ft(100 + 196 * 2)).toBeCloseTo(16200, 9)
    expect(ft(0)).toBe(0)
    expect(ft(2000)).toBe(32400)
  })
})
