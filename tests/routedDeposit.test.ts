// SFM-3 (D31.3, SFM-R F5): a routed (turbidite) deposit is not caught by a one-cell flat on the slope.
// The gradient that sets the deposition length is averaged over TC_SLOPE_WINDOW (3 km, tuned), so the sand spreads over
// several columns and the thickness does not depend on dx. The thresholds below are round numbers (D31.5), not cited.
import { describe, expect, it } from 'vitest'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { routeTurbidites, TC_SLOPE_WINDOW } from '../src/engine/turbidites'

const LEN = 120000 // m of section below the shelf edge
const DT = 5000

/**
 * A slope of 1 % with ONE flat terrace 1 km wide (1 cell at dx 1000, 2 cells at dx 500) starting 5 km from the edge.
 * Routes sand (sand 1 m^2/yr bulk) over it and returns thickness of the deposit per column (m) and what is left in q.
 */
function route(dx: number, sand = 1, mud = 0) {
  const nx = LEN / dx
  const P: EngineParams = { ...defaultEngineParams(), dx, nx }
  const H = new Float64Array(nx)
  const t0 = 5000 / dx, tw = 1000 / dx
  let z = 0
  for (let j = 0; j < nx; j++) {
    H[j] = -z
    if (!(j >= t0 && j < t0 + tw)) z += 0.01 * dx
  }
  const H0 = Float64Array.from(H)
  const s = new Float64Array(nx), m = new Float64Array(nx)
  const q: [number, number] = [sand, mud]
  routeTurbidites(H, s, m, 0, nx, P, 0, q, 1, 1, DT)
  const thick = H.map((h, j) => h - H0[j])
  return { thick, s, m, q, nx, dx, t0 }
}

describe('routed deposit over a one-cell flat (F5)', () => {
  it('spreads over at least 3 columns and is not one column', () => {
    const r = route(1000)
    const tot = r.thick.reduce((a, b) => a + b, 0)
    const max = Math.max(...r.thick)
    const n10 = Array.from(r.thick).filter((t) => t > 0.1 * max).length
    expect(n10).toBeGreaterThanOrEqual(3)
    expect(max / tot).toBeLessThan(0.5) // round number
  })

  it('thickness at the terrace is the same at dx 1 km and 0.5 km within 25 %', () => {
    const a = route(1000), b = route(500)
    // peak deposit thickness over the terrace region (round-number tolerance, D31.5)
    const pa = Math.max(...a.thick), pb = Math.max(...b.thick)
    expect(Math.abs(pa / pb - 1)).toBeLessThan(0.25)
  })

  it('closes mass per grain size: deposited + leftover = routed, sand and mud', () => {
    for (const dx of [1000, 500]) {
      const r = route(dx, 1, 2)
      const dSand = r.s.reduce((a, b) => a + b, 0) * dx / DT
      const dMud = r.m.reduce((a, b) => a + b, 0) * dx / DT
      expect(dSand + r.q[0]).toBeCloseTo(1, 12)
      expect(dMud + r.q[1]).toBeCloseTo(2, 12)
    }
  })

  it('window is a fixed physical length', () => {
    expect(TC_SLOPE_WINDOW).toBe(3000)
  })
})
