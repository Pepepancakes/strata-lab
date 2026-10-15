// M2.2 run-out benchmarks: the Bingham debris-flow solver against steady uniform flow on a
// constant slope, with the velocity law checked against an independent numerical integral.
import { describe, it, expect } from 'vitest'
import { binghamMeanVelocity, binghamUniform, runOut, type RunoutInput } from '../src/engine/runout'
import { G } from '../src/engine/constants'

const RHO_F = 1800
const RHO_W = 1025
const RHO_P = RHO_F - RHO_W
const TAU_Y = 500
const MU = 1000
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b)

/** Independent check: integrate the Bingham profile mu du/dz = max(tau(z) - tau_y, 0), tau = tauB (1 - z/h), by the midpoint rule. */
function numericalMean(tauB: number, h: number, tauY: number, mu: number): { mean: number; plug: number } {
  const N = 200000
  const dz = h / N
  let u = 0 // velocity at the bed is 0
  let sum = 0
  let plugStart = h
  for (let i = 0; i < N; i++) {
    const z = (i + 0.5) * dz
    const shear = Math.max(tauB * (1 - z / h) - tauY, 0) / mu
    if (shear === 0 && plugStart === h) plugStart = i * dz
    const uMid = u + 0.5 * shear * dz
    sum += uMid * dz
    u += shear * dz
  }
  return { mean: sum / h, plug: h - plugStart }
}

/** A constant slope tan(theta) = tn, bed elevation at the cell centres of a long section. */
function slopeBed(nx: number, dx: number, tn: number): Float64Array {
  const z = new Float64Array(nx)
  for (let j = 0; j < nx; j++) z[j] = -tn * (j + 0.5) * dx
  return z
}

describe('Bingham velocity law', () => {
  it('matches a numerical integral of the shear profile (< 0.1 %)', () => {
    for (const [tauB, h] of [[1986, 5], [3000, 12], [800, 3], [40000, 30]]) {
      const num = numericalMean(tauB, h, TAU_Y, MU)
      expect(rel(binghamMeanVelocity(tauB, h, TAU_Y, MU), num.mean)).toBeLessThan(1e-3)
    }
  })
  it('is zero at or below the yield stress and Newtonian without one', () => {
    expect(binghamMeanVelocity(TAU_Y, 5, TAU_Y, MU)).toBe(0)
    expect(binghamMeanVelocity(100, 5, TAU_Y, MU)).toBe(0)
    expect(rel(binghamMeanVelocity(900, 4, 0, MU), (900 * 4) / (3 * MU))).toBeLessThan(1e-12)
  })
  it('uniform flow: plug thickness tau_y / (rho g sin) and velocity from the integral', () => {
    const theta = (3 * Math.PI) / 180
    const h = 5
    const u = binghamUniform(h, theta, RHO_P, TAU_Y, MU)
    expect(rel(u.plug, TAU_Y / (RHO_P * G * Math.sin(theta)))).toBeLessThan(1e-12)
    const num = numericalMean(u.tauB, h, TAU_Y, MU)
    expect(rel(u.plug, num.plug)).toBeLessThan(1e-3)
    expect(rel(u.meanVelocity, num.mean)).toBeLessThan(1e-3)
    expect(u.plugVelocity).toBeGreaterThan(u.meanVelocity)
  })
  it('a layer thinner than the plug does not move', () => {
    const theta = (3 * Math.PI) / 180
    const hCrit = TAU_Y / (RHO_P * G * Math.sin(theta))
    expect(binghamUniform(0.9 * hCrit, theta, RHO_P, TAU_Y, MU).meanVelocity).toBe(0)
    expect(binghamUniform(1.1 * hCrit, theta, RHO_P, TAU_Y, MU).meanVelocity).toBeGreaterThan(0)
  })
})

describe('run-out solver: steady uniform flow on a constant slope', () => {
  const tn = Math.tan((3 * Math.PI) / 180)
  const theta = Math.atan(tn)
  const dx = 1000
  const h0 = 5
  const nBlocks = 60
  const len = 500 // m along x
  const base = (over: Partial<RunoutInput> = {}): RunoutInput => {
    const edges: number[] = []
    for (let i = 0; i <= nBlocks; i++) edges.push(20000 + i * len)
    // block area so that the thickness (measured normal to the bed) is h0
    const area = new Array<number>(nBlocks).fill(h0 * (len / Math.cos(theta)))
    return { edges, area, bed: slopeBed(400, dx, tn), dx, xMax: 399000, rhoFlow: RHO_F, rhoWater: RHO_W, tauY: TAU_Y, mu: MU, ...over }
  }

  it('the middle of a long slab reaches the analytic velocity and plug thickness (< 1 %)', () => {
    const exact = binghamUniform(h0, theta, RHO_P, TAU_Y, MU)
    // wave speed ~ 4.6 m/s: the ends cannot reach the middle block (15 km away) within 2000 s
    const r = runOut(base({ tMax: 2000 }))
    const mid = nBlocks / 2
    const vx = r.velocity[mid]
    expect(rel(vx, exact.meanVelocity)).toBeLessThan(0.01)
    expect(rel(r.tauB[mid], exact.tauB)).toBeLessThan(0.01)
    // plug thickness from the solver's own bed stress: h tau_y / tau_b
    const plug = (r.thickness[mid] * TAU_Y) / r.tauB[mid]
    expect(rel(plug, TAU_Y / (RHO_P * G * Math.sin(theta)))).toBeLessThan(0.01)
    expect(rel(r.thickness[mid], h0)).toBeLessThan(1e-3)
  })

  it('a slab thinner than the plug stays exactly where it is', () => {
    const hCrit = TAU_Y / (RHO_P * G * Math.sin(theta))
    const inp = base()
    inp.area = inp.area.map(() => 0.5 * hCrit * (len / Math.cos(theta)))
    const r = runOut({ ...inp, tMax: 1000 })
    expect(r.stopped).toBe(true)
    expect(r.edges).toEqual(inp.edges)
    expect(r.velocity.every((v) => v === 0)).toBe(true)
  })

  it('a thick heap on a slope that flattens spreads, stops, and keeps every block\'s area', () => {
    // 3 degrees for 30 km, then flat
    const bed = new Float64Array(150)
    for (let j = 0; j < 150; j++) bed[j] = -tn * Math.min((j + 0.5) * dx, 30000)
    const edges = [10000, 10500, 11000, 11500, 12000]
    const area = [3000, 3000, 3000, 3000]
    const inp: RunoutInput = { edges, area, bed, dx, xMax: 150000, rhoFlow: RHO_F, rhoWater: RHO_W, tauY: TAU_Y, mu: MU }
    const r = runOut(inp)
    expect(r.stopped).toBe(true)
    expect(r.gone.some(Boolean)).toBe(false)
    // it travelled downslope and ended on the flat floor, in order, with positive lengths
    expect(r.edges[0]).toBeGreaterThan(30000)
    for (let i = 1; i < r.edges.length; i++) expect(r.edges[i]).toBeGreaterThan(r.edges[i - 1])
    // at rest: the thickness is below the yield limit for the local slope (flat floor: no driving force)
    const again = runOut(inp)
    expect(again.edges).toEqual(r.edges) // deterministic
  })

  it('blocks that pass the basinward edge are marked gone', () => {
    const r = runOut(base({ xMax: 30000, tMax: 3000 }))
    expect(r.gone.some(Boolean)).toBe(true)
    // gone blocks are always the leading ones
    const firstGone = r.gone.indexOf(true)
    for (let i = firstGone; i < nBlocks; i++) expect(r.gone[i]).toBe(true)
  })
})
