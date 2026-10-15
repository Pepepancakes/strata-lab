// Debris-flow run-out of a slope failure (M2.2): a depth-averaged Bingham flow, solved as a
// chain of sliding blocks (Lagrangian) along the section.
//
// Model (BING-type, after Imran, Parker, Locat & Lee 2001, J. Hydraulic Eng. 127(11), 959-968):
//   The flow is a Bingham fluid: shear stress tau = tau_y + mu * du/dz above the yield strength
//   tau_y, rigid "plug" where tau < tau_y. In a layer of thickness h on a slope with bed stress
//   tau_b, the stress falls linearly from tau_b at the bed to 0 at the top, so the plug has
//   thickness h_p = h tau_y / tau_b and the depth-averaged velocity is, with r = tau_y / tau_b,
//        U = tau_b h (1 - r)^2 (2 + r) / (6 mu)                     (binghamMeanVelocity)
//   (r = 0 gives the Newtonian tau_b h / (3 mu); r = 1 gives U = 0).
//   Steady uniform flow has tau_b = rho' g h sin(theta), where rho' = rho_flow - rho_water
//   (buoyant, because the flow is under water). So the plug thickness is
//        h_p = tau_y / (rho' g sin theta)                           (binghamUniform)
//   independent of h, and a layer thinner than h_p does not move at all.
//   Momentum of a block (per metre of width, along the slope):
//        M dU/dt = rho' g A sin(theta) + pressure force - tau_b * (length along the slope)
//   with M = rho_flow A, A = the block's bulk area (m^2) and the pressure force from the
//   difference of hydrostatic thrust 1/2 rho' g h^2 cos(theta) at the two faces. The free ends
//   have zero thickness beyond them, so the chain spreads at both ends.
//   Time stepping is implicit in the bed stress (one monotone scalar equation per block, solved
//   by bisection), so the yield stress holds a block exactly at rest when the net force cannot
//   overcome it. A block slower than 1 mm/s counts as stopped (STOP_SPEED), so the flow stops
//   in finite time, at a definite place.
// Mass: every block keeps its own area A (and so its own sand and mud) for the whole run. Nothing
//   is created or lost; blocks that pass the basinward edge are removed and counted as exported.
// Assumptions: depth-averaged, one layer; no water entrainment or hydroplaning (so run-out is a
//   lower bound for mud-rich flows, see Hampton et al. 1996); bed slope from the cell-centre
//   surface heights, extended linearly beyond the two ends; the flow does not erode the bed;
//   rheology constant in time (no remoulding or dilution while moving).
// Parameters: runYield, runViscosity, runDensity (params.ts; tuned, no published defaults for
//   the section scale).
// Benchmark: tests/runout.test.ts (steady uniform flow on a constant slope: plug thickness and
//   velocity to < 1 %; the velocity law against an independent numerical integral).
// Deterministic: fixed loop order, fixed bisection counts, no clock or random numbers.

import { G } from './constants'

/** Depth-averaged velocity of a Bingham layer of thickness h with bed stress tauB (m/s). 0 when tauB <= tauY. */
export function binghamMeanVelocity(tauB: number, h: number, tauY: number, mu: number): number {
  if (!(tauB > tauY)) return 0
  const r = tauY / tauB
  const q = 1 - r
  return (tauB * h * q * q * (2 + r)) / (6 * mu)
}

export interface BinghamUniform {
  /** Bed stress, Pa. */
  tauB: number
  /** Plug thickness, m (the whole layer when it is too thin to shear). */
  plug: number
  /** Velocity of the plug (the surface velocity), m/s. */
  plugVelocity: number
  /** Depth-averaged velocity, m/s. */
  meanVelocity: number
}

/** Steady uniform flow of thickness h on a slope of angle theta (radians). rhoBuoyant = rho_flow - rho_water. */
export function binghamUniform(h: number, theta: number, rhoBuoyant: number, tauY: number, mu: number): BinghamUniform {
  const tauB = rhoBuoyant * G * h * Math.sin(theta)
  if (!(tauB > tauY)) return { tauB, plug: h, plugVelocity: 0, meanVelocity: 0 }
  const r = tauY / tauB
  const plug = h * r
  const q = 1 - r
  return { tauB, plug, plugVelocity: (tauB * h * q * q) / (2 * mu), meanVelocity: binghamMeanVelocity(tauB, h, tauY, mu) }
}

export interface RunoutInput {
  /** Block edges along x, m, increasing: n + 1 numbers for n blocks. */
  edges: number[]
  /** Bulk area of each block, m^2 (volume per metre of section). */
  area: number[]
  /** Bed elevation at the cell centres (x = (j + 0.5) dx), m. */
  bed: ArrayLike<number>
  dx: number
  /** Blocks whose left edge passes this x are taken out of the run and counted as exported. */
  xMax: number
  /** Flow bulk density, kg/m^3. */
  rhoFlow: number
  rhoWater: number
  tauY: number
  mu: number
  /** Stop after this much flow time, s (benchmarks). Default: run until everything stops. */
  tMax?: number
  /** Safety bound on the number of time steps. */
  maxSteps?: number
}

export interface RunoutResult {
  /** Final edges (n + 1). Blocks that left through xMax keep the edges they had when they left. */
  edges: number[]
  /** True for blocks that left through xMax. */
  gone: boolean[]
  /** Final along-slope velocity of each block, m/s. */
  velocity: number[]
  /** Final bed stress of each block, Pa (0 at rest). */
  tauB: number[]
  /** Final flow thickness of each block, m. */
  thickness: number[]
  time: number
  steps: number
  /** False when maxSteps or tMax ended the run before everything stopped. */
  stopped: boolean
}

const CFL = 0.2
/**
 * A Bingham block whose net force only just exceeds the yield force creeps ever more slowly
 * (velocity falls towards zero but never reaches it). Below this speed (1 mm/s = 86 m/day) a block
 * counts as stopped. A numerical choice.
 */
const STOP_SPEED = 1e-3
const BISECT = 60

/** Bed slope tan(theta), positive downhill in +x, on the segment of the cell-centre profile that holds x. */
function bedSlope(bed: ArrayLike<number>, dx: number, x: number): number {
  const n = bed.length
  if (n < 2) return 0
  let s = Math.floor(x / dx - 0.5)
  if (s < 0) s = 0
  if (s > n - 2) s = n - 2
  return -(bed[s + 1] - bed[s]) / dx
}

export function runOut(inp: RunoutInput): RunoutResult {
  const n = inp.area.length
  const e = inp.edges.slice()
  const rhoP = inp.rhoFlow - inp.rhoWater
  const gP = rhoP * G
  const minLen = 1e-3 * ((e[n] - e[0]) / n)
  const maxSteps = inp.maxSteps ?? 200000
  const tMax = inp.tMax ?? Infinity
  const U = new Array<number>(n).fill(0)
  const tauBlk = new Array<number>(n).fill(0)
  const hBlk = new Array<number>(n).fill(0)
  const gone = new Array<boolean>(n).fill(false)
  const sinT = new Array<number>(n).fill(0)
  const cosT = new Array<number>(n).fill(1)
  const ds = new Array<number>(n).fill(0)
  const F = new Array<number>(n).fill(0)
  const eNew = new Array<number>(n + 1).fill(0)
  let alive = n
  let t = 0
  let steps = 0
  let stopped = false

  while (steps < maxSteps && t < tMax) {
    // geometry of each block from its edges and the bed under it
    let dtMax = Infinity
    for (let i = 0; i < alive; i++) {
      const len = e[i + 1] - e[i]
      const tn = bedSlope(inp.bed, inp.dx, 0.5 * (e[i] + e[i + 1]))
      const c = 1 / Math.sqrt(1 + tn * tn)
      cosT[i] = c
      sinT[i] = tn * c
      ds[i] = len / c
      hBlk[i] = inp.area[i] / ds[i]
      const wave = Math.sqrt((gP / inp.rhoFlow) * hBlk[i] * c)
      const d = (CFL * len) / (Math.abs(U[i]) * c + wave)
      if (d < dtMax) dtMax = d
    }
    if (alive === 0) {
      stopped = true
      break
    }
    let dt = dtMax
    if (t + dt > tMax) dt = tMax - t
    // forces: gravity along the slope plus the difference of hydrostatic thrust at the two faces
    for (let i = 0; i < alive; i++) {
      const hL = i === 0 ? 0 : 0.5 * (hBlk[i - 1] + hBlk[i])
      const hR = i === alive - 1 ? 0 : 0.5 * (hBlk[i] + hBlk[i + 1])
      F[i] = gP * inp.area[i] * sinT[i] + 0.5 * gP * cosT[i] * (hL * hL - hR * hR)
    }
    // implicit bed stress per block
    let moving = false
    for (let i = 0; i < alive; i++) {
      const M = inp.rhoFlow * inp.area[i]
      const Gt = F[i] + (M * U[i]) / dt // force if the block had no resistance this step
      const mag = Gt < 0 ? -Gt : Gt
      if (mag <= inp.tauY * ds[i]) {
        U[i] = 0
        tauBlk[i] = 0
        continue
      }
      // find tauB in (tauY, mag/ds]:  M U(tauB)/dt + tauB ds = mag   (increasing in tauB)
      let lo = inp.tauY
      let hi = mag / ds[i]
      for (let it = 0; it < BISECT; it++) {
        const mid = 0.5 * (lo + hi)
        const f = (M * binghamMeanVelocity(mid, hBlk[i], inp.tauY, inp.mu)) / dt + mid * ds[i] - mag
        if (f < 0) lo = mid
        else hi = mid
      }
      const tb = 0.5 * (lo + hi)
      const v = binghamMeanVelocity(tb, hBlk[i], inp.tauY, inp.mu)
      if (v < STOP_SPEED) {
        U[i] = 0
        tauBlk[i] = 0
        continue
      }
      U[i] = Gt < 0 ? -v : v
      tauBlk[i] = tb
      moving = true
    }
    if (!moving) {
      stopped = true
      break
    }
    // move the edges with the mean of the neighbouring block velocities (horizontal part)
    for (let i = 0; i <= alive; i++) {
      const a = i === 0 ? 0 : i - 1
      const b = i === alive ? alive - 1 : i
      eNew[i] = e[i] + 0.5 * dt * (U[a] * cosT[a] + U[b] * cosT[b])
    }
    for (let i = 1; i <= alive; i++) if (eNew[i] < eNew[i - 1] + minLen) eNew[i] = eNew[i - 1] + minLen
    for (let i = 0; i <= alive; i++) e[i] = eNew[i]
    t += dt
    steps++
    // blocks that have passed the basinward edge leave the run (always the last ones)
    while (alive > 0 && e[alive - 1] >= inp.xMax) {
      alive--
      gone[alive] = true
      U[alive] = 0
      tauBlk[alive] = 0
    }
  }
  if (!stopped && alive === 0) stopped = true
  return { edges: e, gone, velocity: U, tauB: tauBlk, thickness: hBlk, time: t, steps, stopped }
}
