// Sediment transport: two-grain-size diffusion, solved implicitly, mass conserving.
//
// Equation (Rivenaes 1992 style, Kaufman et al. 1991 diffusivity):
//   dH/dt = d/dx( K_eff dH/dx ) + supply at x = 0          (H = surface elevation)
//   K_eff at a face = K_sand F + K_mud (1 - F), F = sand share of the active layer upwind.
//   K by environment, d = sea level - mean surface at the face:
//     subaerial (d <= 0):  Kc                      (fluvial)
//     marine (d > 0):      Km exp(-d/dm) + Kg      (Km at the shoreline, Kg deep-marine creep)
//   The implicit solve gives the new surface; the face fluxes it implies are then routed cell by
//   cell from high to low surface, carrying grain size with the flux. A cell in net deposition
//   passes on a mobility-weighted mix of inflow and active layer (top ACTIVE_SOLID m of solids);
//   a cell in net erosion passes on everything arriving plus bed material in its real mix.
// Sorting scheme matters: the first version swapped 27 % of supply between grain sizes and only
//   the sand-only balance showed it (handover trap). Always check both.
// Turbidity currents (turbidites.ts) take a share of the supply before diffusion.
// Open basinward boundary (SFM-1, D31.3): the last column drains into a ghost cell one column beyond
//   it, held at a fixed elevation Hg = the pre-run surface of the last column (basement plus the
//   pre-run layers), which subsides with the basement. Sediment piles on the last column until it
//   stands above Hg; the face flux K (H[nx-1] - Hg) / dx then carries the rest out of the section, and
//   it is booked in the ledger (cumOut and cumEdge) per grain size. A fixed value keeps the implicit
//   solve a plain tridiagonal system (the ghost value moves to the right-hand side) and the flux exact
//   for a linear slope. If the solve would draw sediment IN across the edge (last column eroded below
//   Hg) the substep is solved again with the edge closed. Tried first and dropped: a ghost that follows
//   the slope above the edge; it feeds on its own erosion (the last column kept falling).
//   Before SFM-1 this face was a closed wall and mud ponded against it (SFM-R F2). `closedEdge` (not in
//   the registry, tests only) brings the wall back: the spike 001 golden parity test needs it.
// Salt (material = SALT) is never moved: it stops the active layer and erosion, so nothing below
//   or in it is touched. Salt flow is M3.
// Parameters are tuned (params.ts). Benchmark: mass balance per grain size over the full run.

import { cellBulk } from './compaction'
import * as K from './constants'
import type { EngineParams } from './engineParams'
import { SALT as SALT_TAG, type LayerRecord } from './record'
import type { EngineState } from './state'
import { thomas } from './thomas'
import { routeTurbidites, turbiditeShare } from './turbidites'

// Local copies of imported constants: reading an imported binding inside a hot loop is several
// times slower under the test runner's module transform (measured: 3 Myr run 5 s vs 2 s).
const { ACTIVE_SOLID, MUD, SAND } = K
const SALT = SALT_TAG

/** Solid sand and total solid in the top ACTIVE_SOLID of a column (stops at salt). */
function surfComp(eng: EngineState, j: number, top: number): void {
  const { sand, mud, material, nx } = eng.rec
  const S = eng.scratch
  let s = 0, m = 0
  for (let l = top; l >= 0; l--) {
    const i = l * nx + j
    if (material[i] === SALT) break
    s += sand[i]
    m += mud[i]
    if (s + m >= ACTIVE_SOLID) break
  }
  S.aS[j] = s
  S.aT[j] = s + m
}

/** Eroded sand takes its share of quartz cement with it (leaves the model, M1.4c). */
function shedCement(rec: LayerRecord, i: number, fraction: number): void {
  const c = rec.cem[i] * fraction
  rec.cem[i] -= c
  rec.ledger.cumOut.cement += c * rec.dx
  if (fraction >= 1) rec.cemS[i] = 0
}

/** Remove `amount` of solid of one grain size from the top of a column; returns bulk removed. */
function erode(eng: EngineState, j: number, lith: number, amount: number, top: number): number {
  const rec = eng.rec
  const nx = rec.nx
  const arr = lith === SAND ? rec.sand : rec.mud
  const low = eng.salt.low
  let need = amount
  let bulk = 0
  for (let l = top; l >= 0 && need > 1e-12; l--) {
    const i = l * nx + j
    if (rec.material[i] === SALT) break
    const a = arr[i]
    if (a <= 0) continue
    const take = a < need ? a : need
    if (l < low[j]) low[j] = l // an old layer changed: the salt load cache of this column is stale (salt.ts)
    arr[i] = a - take
    if (lith === SAND && rec.cem[i] > 0) shedCement(rec, i, take / a)
    need -= take
    bulk += take / (1 - (lith === SAND ? eng.phs[i] : eng.phm[i]))
  }
  eng.diag.short = need > 1e-12 ? need : 0
  if (eng.diag.short > 0) eng.diag.deficit += eng.diag.short * rec.dx
  return bulk
}

/** One transport substep of length dt (years) at sea level sl (m). */
export function transportSubstep(eng: EngineState, P: EngineParams, sl: number, dt: number): void {
  const rec = eng.rec
  const nx = rec.nx
  const dx = P.dx
  const top = rec.nLayers - 1 // the open layer, filled by this step
  const H = rec.H
  const S = eng.scratch
  const F = S.F, Ke = S.Ke, Ks = S.Ks, Km = S.Km, Hn = S.Hn

  // shoreline and shelf edge -> share of supply that goes to turbidity currents
  const tc = turbiditeShare(H, nx, P, sl)
  const je = tc.shelfEdge
  const Ftc = tc.share
  eng.diag.shore = tc.shore
  eng.diag.shelfEdge = je
  eng.diag.tcShare = Ftc
  const qS = P.supply * P.sandFrac, qM = P.supply * (1 - P.sandFrac) // solid m^2/yr
  const pS = 1 - P.phi0[SAND], pM = 1 - P.phi0[MUD]
  // SFM-2 (D31.3): the whole supply enters the diffusion step; the turbidite share is taken from what
  // arrives at the shelf-edge face (see the cascade below), so a shelf that stores sediment sheds less.
  // (legacyShelfEdge, tests only: the pre-SFM-2 rule, share taken from the supply at the source, for spike parity.)
  const legacy = !!P.legacyShelfEdge
  const inS = qS * (legacy ? 1 - Ftc : 1) / pS, inM = qM * (legacy ? 1 - Ftc : 1) / pM // bulk m^2/yr
  let tcS = 0, tcM = 0 // solid m taken off the shelf-edge face this substep

  const r = dt / (dx * dx)
  // ghost cell beyond the last column (open basinward boundary)
  let Hg = rec.b[nx - 1]
  for (let l = 0; l < rec.nPre; l++) Hg += cellBulk(eng, P, l * nx + nx - 1)
  const solve = (edgeOpen: boolean) => {
    // face diffusivities, composition from the upwind cell; face nx - 1 is the open edge
    for (let f = 0; f < (edgeOpen ? nx : nx - 1); f++) {
      const hR = f < nx - 1 ? H[f + 1] : Hg
      const jU = f === nx - 1 || H[f] >= hR ? f : f + 1
      const d = sl - 0.5 * (H[f] + hR)
      let k0: number, k1: number
      if (d <= 0) {
        k0 = P.Kc[0]
        k1 = P.Kc[1]
      } else {
        k0 = P.Km[0] * Math.exp(-d / P.dm[0]) + P.Kg[0]
        k1 = P.Km[1] * Math.exp(-d / P.dm[1]) + P.Kg[1]
      }
      Ks[f] = k0 * F[jU]
      Km[f] = k1 * (1 - F[jU])
      Ke[f] = Ks[f] + Km[f]
    }
    // implicit solve for the new surface
    for (let j = 0; j < nx; j++) {
      const a = j > 0 ? -r * Ke[j - 1] : 0
      const edge = edgeOpen && j === nx - 1
      const c = j < nx - 1 ? -r * Ke[j] : 0
      S.lo[j] = a
      S.up[j] = c
      S.di[j] = 1 - a - c + (edge ? r * Ke[j] : 0)
      S.rhs[j] = H[j] + (j === 0 ? dt * (inS + inM) / dx : 0) + (edge ? r * Ke[j] * Hg : 0)
    }
    thomas(nx, S.lo, S.di, S.up, S.rhs, Hn, S.cp, S.dp)
  }

  // total face fluxes from the implicit solve (diffusivity from the active-layer mix)
  for (let j = 0; j < nx; j++) {
    surfComp(eng, j, top)
    F[j] = S.aT[j] > 0 ? S.aS[j] / S.aT[j] : 0.5
  }
  let edgeOpen = !P.closedEdge
  solve(edgeOpen)
  if (edgeOpen && Hn[nx - 1] < Hg) {
    edgeOpen = false // would pull sediment in across the edge: close it for this substep
    solve(false)
  }
  const c = dt / dx
  const Qf = S.Qf, iSs = S.iSs, iMs = S.iMs, order = S.order
  for (let f = 0; f < nx - 1; f++) Qf[f] = Ke[f] * (Hn[f] - Hn[f + 1]) / dx * c // bulk m over the substep
  Qf[nx - 1] = edgeOpen ? Ke[nx - 1] * (Hn[nx - 1] - Hg) / dx * c : 0
  for (let j = 0; j < nx; j++) {
    iSs[j] = 0
    iMs[j] = 0
    order[j] = j
  }
  iSs[0] = inS * c * pS
  iMs[0] = inM * c * pM // solid m
  // flux always runs from higher to lower surface, so processing cells from high to low means
  // every cell's inflow (amount and grain size) is known before it is used. Array.sort is
  // stable, so ties keep column order: deterministic.
  order.sort((a, b) => Hn[b] - Hn[a])
  const open = top * nx
  const { sand, mud } = rec
  const led = rec.ledger
  for (let o = 0; o < nx; o++) {
    const j = order[o]
    const qL = j > 0 ? Qf[j - 1] : 0
    const qR = Qf[j] // j = nx - 1: flux out across the open edge (0 when closed)
    const outL = qL < 0 ? -qL : 0
    const outR = qR > 0 ? qR : 0
    const Qout = outL + outR
    const iS = iSs[j], iM = iMs[j]
    let oS: number, oM: number
    if (Qout > 0) {
      const Qin = iS / pS + iM / pM
      if (Qout <= Qin) {
        // net deposition: pass on a mobility-weighted mix of inflow + active layer
        const poolS = iS + S.aS[j]
        const poolM = iM + (S.aT[j] - S.aS[j])
        const d = sl - Hn[j]
        let kS: number, kM: number
        if (d <= 0) {
          kS = P.Kc[0]
          kM = P.Kc[1]
        } else {
          kS = P.Km[0] * Math.exp(-d / P.dm[0]) + P.Kg[0]
          kM = P.Km[1] * Math.exp(-d / P.dm[1]) + P.Kg[1]
        }
        const wS = kS * poolS, wM = kM * poolM
        const f = wS + wM > 0 ? wS / (wS + wM) : 0
        const solid = Qout / (f / pS + (1 - f) / pM)
        oS = f * solid
        oM = solid - oS
        if (oS > poolS) {
          oS = poolS
          oM = Math.min(poolM, (Qout - oS / pS) * pM)
        } else if (oM > poolM) {
          oM = poolM
          oS = Math.min(poolS, (Qout - oM / pM) * pS)
        }
        const dS = iS - oS, dM = iM - oM
        if (dS > 0) {
          sand[open + j] += dS
          H[j] += dS / pS
        } else if (dS < 0) H[j] -= erode(eng, j, SAND, -dS, top)
        if (dM > 0) {
          mud[open + j] += dM
          H[j] += dM / pM
        } else if (dM < 0) H[j] -= erode(eng, j, MUD, -dM, top)
      } else {
        // net erosion: everything arriving passes on, plus bed material in its real mix
        oS = iS
        oM = iM
        let need = Qout - Qin
        for (let l = top; l >= 0 && need > 1e-12; l--) {
          const i = l * nx + j
          if (rec.material[i] === SALT) break
          const s = sand[i], m = mud[i]
          if (s + m <= 0) continue
          const b = s / pS + m / pM
          const fr = b <= need ? 1 : need / b
          if (l < eng.salt.low[j]) eng.salt.low[j] = l // see erode()
          const ts = s * fr, tm = m * fr
          sand[i] = s - ts
          mud[i] = m - tm
          if (rec.cem[i] > 0) shedCement(rec, i, fr)
          H[j] -= ts / (1 - eng.phs[i]) + tm / (1 - eng.phm[i])
          oS += ts
          oM += tm
          need -= b * fr
        }
      }
      if (outR > 0) {
        const sh = outR / Qout
        if (j < nx - 1) {
          let toS = oS * sh, toM = oM * sh
          if (!legacy && j === je && Ftc > 0) {
            // SFM-2: this face is the shelf edge; the turbidity current takes the share Ftc of what crosses it
            tcS = toS * Ftc
            tcM = toM * Ftc
            toS -= tcS
            toM -= tcM
          }
          iSs[j + 1] += toS
          iMs[j + 1] += toM
        } else {
          // leaves the section past the basinward edge (solid m x dx = m^2)
          led.cumOut.sand += oS * sh * dx
          led.cumOut.mud += oM * sh * dx
          led.cumEdge.sand += oS * sh * dx
          led.cumEdge.mud += oM * sh * dx
        }
      }
      if (outL > 0) {
        const sh = outL / Qout
        iSs[j - 1] += oS * sh
        iMs[j - 1] += oM * sh
      }
    } else {
      if (iS > 0) {
        sand[open + j] += iS
        H[j] += iS / pS
      }
      if (iM > 0) {
        mud[open + j] += iM
        H[j] += iM / pM
      }
    }
  }
  led.cumIn.sand += qS * dt
  led.cumIn.mud += qM * dt

  // turbidity currents: bypass steep slope, deposit where gradient decreases
  if (legacy ? Ftc > 0 : tcS > 0 || tcM > 0) {
    const toRate = dx / dt // solid m over the substep -> solid m^2/yr
    const q: [number, number] = legacy ? [qS * Ftc / pS, qM * Ftc / pM] : [tcS * toRate / pS, tcM * toRate / pM]
    routeTurbidites(H, sand, mud, open, nx, P, je, q, pS, pM, dt)
    led.cumOut.sand += q[0] * pS * dt
    led.cumOut.mud += q[1] * pM * dt
  }
}
