// Pseudo-well: turn one column of the record into the curves John reads.
// Pure function (tested in tests/well.test.ts). Pressures are in ppg equivalent mud weight (EMW).
//
// Definitions (all SI inside, converted at the end through src/units.ts):
//   datum        the sea surface at this time, or the ground where the column is on land (water table at the
//                surface). Hydrostatic pressure is measured from the datum. M4.1: the EMW is referenced to the
//                rig floor (RKB), the air gap (80 ft default) above the datum: EMW = P / (g (depth + air gap)),
//                so hydrostatic sea water reads a little under 8.55 ppg.
//   hydrostatic  RHO_W * g * (datum - z)
//   pore         hydrostatic + u (the engine's excess pore pressure)
//   overburden   weight of water above the surface plus the bulk weight of the cells above,
//                to the middle of the cell. Bulk density = RHO_S (1 - phi) + RHO_W phi; salt has
//                no pores and uses RHO_SALT.
//   TVDSS        depth below the sea surface at this time (negative = above it), ft.

import { buoyantLoad } from '../../engine/compaction'
import { G, RHO_S, RHO_SALT, RHO_W } from '../../engine/constants'
import { MTD, SALT } from '../../engine/record'
import type { FailureEvent } from '../../engine/state'
import { eventsAtCell } from '../events/format'
import { DEFAULT_AIR_GAP_FT } from '../../engine/well'
import { cToF, densityToPpg, ftToM, mToFt } from '../../units'
import { isCapped, TRAUGOTT_REF_BELOW_SEAFLOOR_FT } from './audit'
import type { WellColumn } from '../../worker/protocol'

/** Cells shallower than this below the datum are left out of the ppg curves (EMW blows up at zero depth), m. */
const MIN_PRESSURE_DEPTH_M = 30

export interface WellPoint {
  layer: number
  /** Depth below the sea surface at the middle of the cell, ft. */
  tvdssFt: number
  thickFt: number
  /** Null where the cell is too close to the datum for an EMW. */
  poreEmw: number | null
  overburdenEmw: number | null
  hydroEmw: number | null
  porosity: number
  tempF: number
  sandFrac: number
  salt: boolean
  /** The cell is a debris-flow deposit (MTD). */
  mtd: boolean
  /** u / L of the cell (share of the buoyant load carried by excess pressure); null in salt. */
  uOverL: number | null
  /** F-3: pore pressure is capped at the overburden in this cell (u / L >= 1 - 1e-9), so its effective stress is zero. */
  capped: boolean
  /** Age of the layer, Ma (filled by the caller from the view when wanted). */
}

export interface WellProfile {
  points: WellPoint[]
  /** Top and bottom of the filled column, ft below the sea surface. */
  topFt: number
  bottomFt: number
  /** Depth where temperature first reaches the cementation onset, ft; null if it never does. */
  cemOnsetFt: number | null
  cemOnsetF: number
  /** Salt intervals as [top ft, bottom ft]. */
  saltIntervals: [number, number][]
  /**
   * Salt weld at this column (M3.5): the salt that was once at least weldThick thick is now thinner than it, so the
   * cover rests (almost) directly on the basement. `depthFt` is the base of the sediment column (the weld surface),
   * ft below the sea surface; `ageMa` is when the column first welded. Null when the column never welded.
   */
  weld: { ageMa: number; depthFt: number; remnantFt: number } | null
  /** Salt density used in the overburden, ppg (RHO_SALT; salt has no pores). */
  saltDensityPpg: number
  /** Runs of adjacent MTD cells: top and bottom depth (ft below the sea surface) and the layers in them (top first). */
  mtdIntervals: { topFt: number; botFt: number; layers: number[] }[]
  /** Largest u / L among the cells of this column (0 if none) and how many cells are capped at the overburden (F-3). */
  maxUOverL: number
  cappedCells: number
  /**
   * The sediment cell that the regional-trend check reads (F-4a): the one whose middle is nearest TRAUGOTT_REF_BELOW_SEAFLOOR_FT
   * below the sea floor, or the deepest sediment cell if the column is thinner. Its depth below the SEA SURFACE, the water
   * depth, and the weight above its middle as ppg from the sea surface (no air gap). Null without sediment.
   */
  trendCell: { depthBelowSeaFt: number; waterDepthFt: number; overburdenPpg: number } | null
}

export function wellProfile(w: WellColumn, events: readonly FailureEvent[] = [], airGapM: number = ftToM(DEFAULT_AIR_GAP_FT)): WellProfile {
  const n = w.nLayers
  const datum = Math.max(w.seaLevelM, w.H)
  const waterDepth = Math.max(0, w.seaLevelM - w.H)
  let zBottom = w.b
  // cell bottoms and tops from the basement up
  const zb = new Float64Array(n)
  const zt = new Float64Array(n)
  for (let l = 0; l < n; l++) {
    zb[l] = zBottom
    zBottom += w.thick[l]
    zt[l] = zBottom
  }
  // overburden to the middle of each cell, from the top down
  const sv = new Float64Array(n)
  const uol = new Float64Array(n).fill(NaN) // u / L per cell; the load rule is the compaction solver's (salt skipped)
  let aboveSolid = 0
  let load = RHO_W * G * waterDepth
  for (let l = n - 1; l >= 0; l--) {
    const solid = w.sand[l] + w.mud[l]
    if (solid <= 0 || w.thick[l] <= 0) continue
    const rho = cellDensity(w, l)
    sv[l] = load + 0.5 * rho * G * w.thick[l]
    if (w.material[l] !== SALT) {
      const L = buoyantLoad(aboveSolid, solid)
      uol[l] = L > 0 ? w.u[l] / L : 0
      aboveSolid += solid
    }
    load += rho * G * w.thick[l]
  }
  const points: WellPoint[] = []
  const saltIntervals: [number, number][] = []
  const mtdIntervals: WellProfile['mtdIntervals'] = []
  for (let l = n - 1; l >= 0; l--) {
    const solid = w.sand[l] + w.mud[l]
    if (solid <= 0 || w.thick[l] <= 0) continue
    const zMid = 0.5 * (zb[l] + zt[l])
    const depthBelowDatum = datum - zMid
    const ok = depthBelowDatum >= MIN_PRESSURE_DEPTH_M
    const hydro = RHO_W * G * depthBelowDatum
    const isSalt = w.material[l] === SALT
    const p: WellPoint = {
      layer: l,
      tvdssFt: mToFt(w.seaLevelM - zMid),
      thickFt: mToFt(w.thick[l]),
      poreEmw: ok && !isSalt ? emw(hydro + w.u[l], depthBelowDatum + airGapM) : null, // salt has no pore fluid: no pore pressure (M3.5)
      overburdenEmw: ok ? emw(sv[l], depthBelowDatum + airGapM) : null,
      hydroEmw: ok ? emw(hydro, depthBelowDatum + airGapM) : null,
      porosity: isSalt ? 0 : 1 - solid / w.thick[l],
      tempF: cToF(w.temp[l]),
      sandFrac: solid > 0 ? w.sand[l] / solid : 0,
      salt: isSalt,
      mtd: w.material[l] === MTD || eventsAtCell(events, l, w.column).length > 0,
      uOverL: isSalt ? null : uol[l],
      capped: !isSalt && isCapped(uol[l]),
    }
    points.push(p)
    if (p.mtd) {
      const top = p.tvdssFt - p.thickFt / 2
      const bot = p.tvdssFt + p.thickFt / 2
      const lastM = mtdIntervals[mtdIntervals.length - 1]
      if (lastM && Math.abs(lastM.botFt - top) < 1e-6) {
        lastM.botFt = bot
        lastM.layers.push(l)
      } else mtdIntervals.push({ topFt: top, botFt: bot, layers: [l] })
    }
    if (isSalt) {
      const top = mToFt(w.seaLevelM - zt[l])
      const bot = mToFt(w.seaLevelM - zb[l])
      const last = saltIntervals[saltIntervals.length - 1]
      if (last && Math.abs(last[1] - top) < 1e-6) last[1] = bot
      else saltIntervals.push([top, bot])
    }
  }
  const topFt = points.length ? points[0].tvdssFt - points[0].thickFt / 2 : 0
  const last = points[points.length - 1]
  const bottomFt = last ? last.tvdssFt + last.thickFt / 2 : 0
  let saltBulk = 0
  for (let l = 0; l < n; l++) if (w.material[l] === SALT && w.sand[l] + w.mud[l] > 0) saltBulk += w.thick[l]
  const weld = w.weldAge != null && w.weldAge >= 0 && saltBulk < (w.weldThick ?? 10)
    ? { ageMa: w.weldAge, depthFt: mToFt(w.seaLevelM - w.b), remnantFt: mToFt(saltBulk) }
    : null
  let maxUOverL = 0
  let cappedCells = 0
  for (const p of points) {
    if (p.uOverL !== null && p.uOverL > maxUOverL) maxUOverL = p.uOverL
    if (p.capped) cappedCells++
  }
  // the cell for the regional-trend check: sediment cell nearest the reference depth below the sea floor (points run top to bottom)
  let trend: WellProfile['trendCell'] = null
  let best = Infinity
  for (const p of points) {
    if (p.salt) continue
    const depthM = datum - 0.5 * (zb[p.layer] + zt[p.layer])
    const belowFloor = mToFt(depthM - waterDepth)
    if (!(depthM > 0) || !(belowFloor > 0)) continue
    const d = Math.abs(belowFloor - TRAUGOTT_REF_BELOW_SEAFLOOR_FT)
    if (d < best) {
      best = d
      trend = { depthBelowSeaFt: mToFt(depthM), waterDepthFt: mToFt(waterDepth), overburdenPpg: densityToPpg(sv[p.layer] / (G * depthM)) }
    }
  }
  return { points, topFt, bottomFt, cemOnsetFt: cementationOnsetDepthFt(points, cToF(w.cemTonsetC)), cemOnsetF: cToF(w.cemTonsetC), saltIntervals, weld, saltDensityPpg: densityToPpg(RHO_SALT), mtdIntervals, maxUOverL, cappedCells, trendCell: trend }
}

function cellDensity(w: WellColumn, l: number): number {
  const solid = w.sand[l] + w.mud[l]
  if (w.material[l] === SALT) return RHO_SALT
  const phi = 1 - solid / w.thick[l]
  return RHO_S * (1 - phi) + RHO_W * phi
}

/** First depth (from the top) where temperature reaches `onsetF`, by linear interpolation between cells. */
export function cementationOnsetDepthFt(points: WellPoint[], onsetF: number): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a.tempF < onsetF && b.tempF >= onsetF) {
      const t = (onsetF - a.tempF) / (b.tempF - a.tempF)
      return a.tvdssFt + t * (b.tvdssFt - a.tvdssFt)
    }
  }
  return null
}

/**
 * Pressure (Pa) at a depth (m) as an equivalent mud weight in ppg. Uses the engine's own g so that
 * pure water gives exactly RHO_W (8.554 ppg for sea water), not 0.03 % off from a different g.
 */
function emw(pa: number, depthM: number): number {
  return densityToPpg(pa / (G * depthM))
}
