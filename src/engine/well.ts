// Planned well (M4.1): a well path in the section plane, and what the record holds along it.
// Pure module (no DOM, no clock, no randomness): it lives in src/engine because it reads the layer
// record and runs in the worker. It changes no engine state, so a sample never moves a stateHash.
//
// 1. PATH. Vertical, or build-and-hold ("J" well) in the plane of the section:
//      vertical from the rig floor (RKB) down to the kickoff point (KOP),
//      then a circular arc that builds inclination at a constant rate (deg per 100 ft of measured depth),
//      then a straight hold at the hold inclination to total depth.
//    In a plane the minimum-curvature method is exactly a circular arc, so no integration is needed:
//      R          = 18000 / (pi * BUR)            radius of the arc, ft (BUR in deg / 100 ft)
//      build      L = hold * 100 / BUR            measured length of the arc, ft
//      on the arc TVD = KOP + R sin(a),  displacement = R (1 - cos a),  a = (MD - KOP) / R
//      on the hold TVD = KOP + R sin(h) + s cos(h),  displacement = R (1 - cos h) + s sin(h)
//    (h = hold inclination, s = measured length past the end of the build). Source: standard
//    directional-drilling geometry (e.g. Bourgoyne et al. 1986, Applied Drilling Engineering, ch. 8).
//    Checked by hand in tests/wellPath.test.ts.
//
// 2. DATUM. Depths the planner reads are TVDSS (below mean sea level). The rig floor (RKB) is the
//    air gap above the sea surface (default 80 ft, TUNED, editable). Mud weights are equivalent mud
//    weights (EMW) referenced to RKB: EMW = P / (g * depth below RKB). Where the ground is above the sea
//    the datum is the ground, as in the pseudo-well, and RKB sits the air gap above it.
//
// 3. SAMPLING. At each station the record is read in the (up to) two columns either side of the
//    station, at the SAME elevation, and linearly interpolated by distance between column centres:
//      - numbers (sand fraction, porosity, temperature, excess pore pressure) are interpolated only when
//        both columns hold the same material there; across a salt flank or an MTD edge a blended
//        "half salt" rock would be fiction, so the nearest column's value is used instead;
//      - material, layer and age come from the nearest column (ties go to the landward one);
//      - overburden is the weight of what is above in each column and is interpolated (a stress field is
//        continuous), pore pressure = hydrostatic + excess, as in the pseudo-well;
//      - if the station is above the surface of one column or below the basement of one column, the other
//        column alone is used; above the surface of both it is water or air; below the basement of both it
//        is the base of the record and the well STOPS there (flagged).
//    A well that goes out of the section (x < 0 or x > nx dx) stops too.
//    Cell properties (porosity, sand, temperature, excess pressure, material) are constant over a cell,
//    as in the pseudo-well; hydrostatic and overburden vary smoothly with depth inside it, so a vertical
//    well at a column centre equals the pseudo-well exactly at every cell middle.

import { cellBulk } from './compaction'
import { G, RHO_S, RHO_SALT, RHO_W } from './constants'
import type { EngineParams } from './engineParams'
import { MTD, SALT } from './record'
import type { EngineState } from './state'
import { columnTemperatures } from './thermal'
import { densityToPpg, ftToM, M_PER_FT, mToFt } from '../units'

export const DEFAULT_AIR_GAP_FT = 80 // tuned: a typical floating-rig air gap, editable per well
export const STATION_SPACING_FT = 10 // measured depth between stations
export const MAX_HOLD_INCLINATION_DEG = 85
export const MAX_BUILD_RATE_DEG_PER_100FT = 10

export interface WellDefinition {
  /** Surface location, km from the landward edge of the section. */
  xKm: number
  /** Rig floor above the sea surface, ft. */
  airGapFt: number
  /** Kickoff depth, ft TVDSS. */
  kickoffFt: number
  /** Build rate, deg per 100 ft of measured depth. */
  buildRateDegPer100Ft: number
  /** Inclination held after the build, deg from vertical; 0 = vertical well. */
  holdInclinationDeg: number
  /** Which way the well leans: toward the basin (+x) or toward the land (-x). */
  direction: 'basinward' | 'landward'
  /** Total depth, ft TVDSS. */
  totalDepthFt: number
}

/** A vertical well at xKm to total depth, with the default air gap. */
export function verticalWell(xKm: number, totalDepthFt: number): WellDefinition {
  return { xKm, airGapFt: DEFAULT_AIR_GAP_FT, kickoffFt: 0, buildRateDegPer100Ft: 0, holdInclinationDeg: 0, direction: 'basinward', totalDepthFt }
}

/** Plain-language problems with a definition (empty = usable). */
export function validateWell(w: WellDefinition): string[] {
  const p: string[] = []
  const finite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
  if (!finite(w.xKm) || w.xKm < 0) p.push('The well location must be a distance of 0 km or more from the landward edge.')
  if (!finite(w.airGapFt) || w.airGapFt < 0 || w.airGapFt > 300) p.push('The air gap must be between 0 and 300 ft.')
  if (!finite(w.totalDepthFt) || w.totalDepthFt <= 0) p.push('The total depth must be more than 0 ft.')
  if (!finite(w.kickoffFt) || w.kickoffFt < 0) p.push('The kickoff depth must be 0 ft TVDSS or deeper.')
  if (!finite(w.holdInclinationDeg) || w.holdInclinationDeg < 0 || w.holdInclinationDeg > MAX_HOLD_INCLINATION_DEG) {
    p.push(`The hold inclination must be between 0 (vertical) and ${MAX_HOLD_INCLINATION_DEG} degrees.`)
  }
  if (!finite(w.buildRateDegPer100Ft) || w.buildRateDegPer100Ft < 0 || w.buildRateDegPer100Ft > MAX_BUILD_RATE_DEG_PER_100FT) {
    p.push(`The build rate must be between 0 and ${MAX_BUILD_RATE_DEG_PER_100FT} deg per 100 ft.`)
  } else if (finite(w.holdInclinationDeg) && w.holdInclinationDeg > 0 && w.buildRateDegPer100Ft <= 0) {
    p.push('A well that holds an inclination needs a build rate above 0.')
  }
  if (w.direction !== 'basinward' && w.direction !== 'landward') p.push('The direction must be basinward or landward.')
  if (finite(w.kickoffFt) && finite(w.totalDepthFt) && w.holdInclinationDeg > 0 && w.kickoffFt >= w.totalDepthFt) {
    p.push('The kickoff must be shallower than the total depth.')
  }
  return p
}

// ---- path ------------------------------------------------------------------------------------

/** Stations along the well, every STATION_SPACING_FT of measured depth plus one at total depth. All lengths in ft. */
export interface WellStations {
  n: number
  /** Measured depth from RKB. */
  mdFt: Float64Array
  /** True vertical depth from RKB. */
  tvdFt: Float64Array
  /** True vertical depth below mean sea level (= tvdFt - air gap). */
  tvdssFt: Float64Array
  /** Horizontal position in the section, km from the landward edge. */
  xKm: Float64Array
  /** Inclination from vertical, deg. */
  incDeg: Float64Array
}

/** Geometry helper: TVD (from RKB), horizontal displacement (toward the lean) and inclination at a measured depth, ft / ft / deg. */
function pathAt(w: WellDefinition, md: number): { tvd: number; disp: number; inc: number } {
  const kopMd = w.kickoffFt + w.airGapFt
  const hold = w.holdInclinationDeg
  if (hold <= 0 || w.buildRateDegPer100Ft <= 0 || md <= kopMd) return { tvd: md, disp: 0, inc: 0 }
  const bur = w.buildRateDegPer100Ft
  const r = 18000 / (Math.PI * bur)
  const h = (hold * Math.PI) / 180
  const buildLen = (hold * 100) / bur
  const s = md - kopMd
  if (s <= buildLen) {
    const a = s / r
    return { tvd: kopMd + r * Math.sin(a), disp: r * (1 - Math.cos(a)), inc: (a * 180) / Math.PI }
  }
  const t = s - buildLen
  return { tvd: kopMd + r * Math.sin(h) + t * Math.cos(h), disp: r * (1 - Math.cos(h)) + t * Math.sin(h), inc: hold }
}

/** Measured depth (from RKB) at which the well reaches its total depth. */
export function totalMeasuredDepthFt(w: WellDefinition): number {
  const target = w.totalDepthFt + w.airGapFt
  const kopMd = w.kickoffFt + w.airGapFt
  if (w.holdInclinationDeg <= 0 || w.buildRateDegPer100Ft <= 0 || target <= kopMd) return target
  const r = 18000 / (Math.PI * w.buildRateDegPer100Ft)
  const h = (w.holdInclinationDeg * Math.PI) / 180
  const buildLen = (w.holdInclinationDeg * 100) / w.buildRateDegPer100Ft
  const gainEndBuild = r * Math.sin(h)
  if (target - kopMd <= gainEndBuild) return kopMd + r * Math.asin((target - kopMd) / r)
  return kopMd + buildLen + (target - kopMd - gainEndBuild) / Math.cos(h)
}

/** The stations of a well (the definition must pass validateWell). */
export function wellStations(w: WellDefinition): WellStations {
  const mdTd = totalMeasuredDepthFt(w)
  const nGrid = Math.floor(mdTd / STATION_SPACING_FT - 1e-9) + 1 // MD = 0, 10, ... below TD
  const n = nGrid + 1 // plus one at TD
  const out: WellStations = {
    n, mdFt: new Float64Array(n), tvdFt: new Float64Array(n), tvdssFt: new Float64Array(n), xKm: new Float64Array(n), incDeg: new Float64Array(n),
  }
  const sign = w.direction === 'basinward' ? 1 : -1
  for (let i = 0; i < n; i++) {
    const md = i < nGrid ? i * STATION_SPACING_FT : mdTd
    const g = pathAt(w, md)
    out.mdFt[i] = md
    out.tvdFt[i] = g.tvd
    out.tvdssFt[i] = g.tvd - w.airGapFt
    out.xKm[i] = w.xKm + (sign * g.disp * M_PER_FT) / 1000
    out.incDeg[i] = g.inc
  }
  return out
}

// ---- sampling --------------------------------------------------------------------------------

export const WELL_AIR = 0
export const WELL_WATER = 1
export const WELL_SEDIMENT = 2
export const WELL_SALT = 3
export const WELL_MTD = 4

export type WellStopReason = 'leftSection' | 'baseOfRecord'

/** What the record holds along the well at one step. Arrays have `n` entries (stations up to the stop). SI unless the name says ft/ppg. */
export interface WellSamples extends WellStations {
  /** Why the well stops before total depth, and at which station (the first station NOT sampled); null = reached TD. */
  stopped: { reason: WellStopReason; mdFt: number } | null
  seaLevelM: number
  /** Water depth at the wellhead, ft (0 on land) and the sea floor at the wellhead, ft TVDSS. */
  waterDepthFt: number
  mudlineTvdssFt: number
  /** WELL_AIR ... WELL_MTD */
  kind: Uint8Array
  /** Layer of the record at the nearest column (-1 in air and water). */
  layer: Int32Array
  /** Nearest column. */
  column: Int32Array
  /** Layer age, Ma (NaN in air and water). */
  ageMa: Float64Array
  sandFrac: Float64Array
  porosity: Float64Array
  tempC: Float64Array
  /** Hydrostatic, pore (NaN in salt and air) and overburden pressure, Pa. */
  hydroPa: Float64Array
  porePa: Float64Array
  overburdenPa: Float64Array
  /** The same as EMW, ppg, referenced to RKB (NaN where the pressure is NaN). */
  hydroEmw: Float64Array
  poreEmw: Float64Array
  overburdenEmw: Float64Array
}

/** Pressure (Pa) at a depth below RKB (m) as ppg EMW. Uses the engine's g so that pure sea water gives RHO_W. */
export function emwPpg(pa: number, depthM: number): number {
  return densityToPpg(pa / (G * depthM))
}

/** One column of the record as a list of non-empty cells, top first. */
interface ColumnCells {
  count: number
  top: Float64Array
  bot: Float64Array
  layer: Int32Array
  kind: Uint8Array
  /** Total vertical stress at the top of the cell, Pa. */
  loadTop: Float64Array
  rho: Float64Array
  sandFrac: Float64Array
  porosity: Float64Array
  tempC: Float64Array
  uPa: Float64Array
  ageMa: Float64Array
}

function buildColumn(eng: EngineState, P: EngineParams, sl: number, j: number): ColumnCells {
  const rec = eng.rec
  const nx = rec.nx
  const n = rec.nLayers
  const temp = new Float64Array(n)
  columnTemperatures(eng, P, j, n, sl, temp)
  const zb = new Float64Array(n)
  const zt = new Float64Array(n)
  const thick = new Float64Array(n)
  let z = rec.b[j]
  for (let l = 0; l < n; l++) {
    thick[l] = cellBulk(eng, P, l * nx + j)
    zb[l] = z
    z += thick[l]
    zt[l] = z
  }
  let count = 0
  for (let l = 0; l < n; l++) if (rec.sand[l * nx + j] + rec.mud[l * nx + j] > 0 && thick[l] > 0) count++
  const c: ColumnCells = {
    count, top: new Float64Array(count), bot: new Float64Array(count), layer: new Int32Array(count), kind: new Uint8Array(count),
    loadTop: new Float64Array(count), rho: new Float64Array(count), sandFrac: new Float64Array(count), porosity: new Float64Array(count),
    tempC: new Float64Array(count), uPa: new Float64Array(count), ageMa: new Float64Array(count),
  }
  let load = RHO_W * G * Math.max(0, sl - rec.H[j])
  let k = 0
  for (let l = n - 1; l >= 0; l--) {
    const i = l * nx + j
    const solid = rec.sand[i] + rec.mud[i]
    if (solid <= 0 || thick[l] <= 0) continue
    const isSalt = rec.material[i] === SALT
    const phi = isSalt ? 0 : 1 - solid / thick[l]
    const rho = isSalt ? RHO_SALT : RHO_S * (1 - phi) + RHO_W * phi // the pseudo-well's cell density
    c.top[k] = zt[l]
    c.bot[k] = zb[l]
    c.layer[k] = l
    c.kind[k] = isSalt ? WELL_SALT : rec.material[i] === MTD ? WELL_MTD : WELL_SEDIMENT
    c.loadTop[k] = load
    c.rho[k] = rho
    c.sandFrac[k] = isSalt ? 0 : rec.sand[i] / solid
    c.porosity[k] = phi
    c.tempC[k] = temp[l]
    c.uPa[k] = rec.u[i]
    c.ageMa[k] = rec.stepAgeMa[l]
    load += rho * G * thick[l]
    k++
  }
  return c
}

const ABOVE = -1
const BELOW = -2

/** Index of the cell of a column that contains elevation e, or ABOVE / BELOW. */
function findCell(c: ColumnCells, e: number): number {
  if (c.count === 0) return BELOW
  if (e > c.top[0]) return ABOVE
  if (e < c.bot[c.count - 1]) return BELOW
  let lo = 0
  let hi = c.count - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (c.bot[mid] <= e) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Sample the record at the current step along a well. `sl` is sea level, m. Does not touch `eng`.
 * (`eng` and `P` are what the time machine holds at the step; see TimeMachine.sampleWell.)
 */
export function sampleWell(eng: EngineState, P: EngineParams, sl: number, well: WellDefinition): WellSamples {
  const rec = eng.rec
  const nx = rec.nx
  const dx = rec.dx
  const st = wellStations(well)
  const cols = new Map<number, ColumnCells>()
  const column = (j: number): ColumnCells => {
    let c = cols.get(j)
    if (!c) {
      c = buildColumn(eng, P, sl, j)
      cols.set(j, c)
    }
    return c
  }
  const airGapM = ftToM(well.airGapFt)
  // interpolation of a column quantity at a horizontal position (m): columns j0, j1 and the weight of j1
  const locate = (xM: number): { j0: number; j1: number; t: number } => {
    const xm = xM / dx - 0.5
    if (xm <= 0) return { j0: 0, j1: 0, t: 0 }
    if (xm >= nx - 1) return { j0: nx - 1, j1: nx - 1, t: 0 }
    const j0 = Math.floor(xm)
    const t = xm - j0
    return { j0, j1: t === 0 ? j0 : j0 + 1, t }
  }
  const x0M = well.xKm * 1000
  const head = locate(x0M)
  const hHead = rec.H[head.j0] + head.t * (rec.H[head.j1] - rec.H[head.j0])
  const datum = Math.max(sl, hHead) // pressure datum: the sea surface, or the ground where it is above the sea
  const waterDepthM = Math.max(0, sl - hHead)
  const rkbElev = datum + airGapM // elevation of the rig floor, m (same frame as sea level and rec.H)

  const n = st.n
  const kind = new Uint8Array(n)
  const layer = new Int32Array(n).fill(-1)
  const col = new Int32Array(n)
  const nan = (): Float64Array => new Float64Array(n).fill(NaN)
  const ageMa = nan(), sandFrac = nan(), porosity = nan(), tempC = nan()
  const hydroPa = nan(), porePa = nan(), overburdenPa = nan(), hydroEmw = nan(), poreEmw = nan(), overburdenEmw = nan()
  let stopped: WellSamples['stopped'] = null
  let m = 0
  const outsideSection = (xM: number): boolean => xM < 0 || xM > nx * dx
  for (let i = 0; i < n; i++) {
    const xM = st.xKm[i] * 1000
    if (outsideSection(xM)) {
      stopped = { reason: 'leftSection', mdFt: st.mdFt[i] }
      break
    }
    const e = sl - ftToM(st.tvdssFt[i]) // elevation above datum, m
    if (e > rkbElev + 1e-9) {
      // above the real rig floor (only where the ground is above the sea): not drilled, so air
      m = i + 1
      kind[i] = WELL_AIR
      col[i] = locate(xM).j0
      continue
    }
    const { j0, j1, t } = locate(xM)
    const c0 = column(j0)
    const c1 = j1 === j0 ? c0 : column(j1)
    const k0 = findCell(c0, e)
    const k1 = j1 === j0 ? k0 : findCell(c1, e)
    const in0 = k0 >= 0
    const in1 = k1 >= 0
    const depthDatum = datum - e // below the pressure datum, m
    const pDepth = depthDatum + airGapM // below RKB, m
    if (!in0 && !in1) {
      if (k0 === BELOW || k1 === BELOW) {
        stopped = { reason: 'baseOfRecord', mdFt: st.mdFt[i] }
        break
      }
      // above the surface of both columns: water below the sea surface, air above it
      m = i + 1
      col[i] = t < 0.5 ? j0 : j1
      if (e > sl) {
        kind[i] = WELL_AIR
      } else {
        kind[i] = WELL_WATER
        const p = RHO_W * G * (sl - e)
        hydroPa[i] = p
        porePa[i] = p
        overburdenPa[i] = p
        const d = sl - e + airGapM
        hydroEmw[i] = poreEmw[i] = overburdenEmw[i] = emwPpg(p, d)
      }
      continue
    }
    // one or both columns hold rock here
    const useNear0 = in0 && (!in1 || t <= 0.5) // nearest column; a tie goes to the landward one (j0)
    const nearJ = useNear0 ? j0 : j1
    const nearC = useNear0 ? c0 : c1
    const nearK = useNear0 ? k0 : k1
    col[i] = nearJ
    kind[i] = nearC.kind[nearK]
    layer[i] = nearC.layer[nearK]
    ageMa[i] = nearC.ageMa[nearK]
    const both = in0 && in1
    const same = both && c0.kind[k0] === c1.kind[k1]
    const pick = (a0: number, a1: number): number => (same ? a0 + t * (a1 - a0) : useNear0 ? a0 : a1)
    const cellProp = (f: (c: ColumnCells, k: number) => number): number => {
      if (!both) return f(in0 ? c0 : c1, in0 ? k0 : k1)
      return pick(f(c0, k0), f(c1, k1))
    }
    sandFrac[i] = cellProp((c, k) => c.sandFrac[k])
    porosity[i] = cellProp((c, k) => c.porosity[k])
    tempC[i] = cellProp((c, k) => c.tempC[k])
    // stress: weight of what is above, in each column, interpolated by distance
    const sv = (c: ColumnCells, k: number): number => c.loadTop[k] + c.rho[k] * G * (c.top[k] - e)
    const sv0 = in0 ? sv(c0, k0) : 0
    const sv1 = in1 ? sv(c1, k1) : 0
    overburdenPa[i] = both ? sv0 + t * (sv1 - sv0) : in0 ? sv0 : sv1
    const hydro = RHO_W * G * depthDatum
    hydroPa[i] = hydro
    const isSalt = kind[i] === WELL_SALT
    if (!isSalt) {
      // excess pressure of the sediment column(s); a salt neighbour does not count
      const u = (c: ColumnCells, k: number): number => c.uPa[k]
      const sed0 = in0 && c0.kind[k0] !== WELL_SALT
      const sed1 = in1 && c1.kind[k1] !== WELL_SALT
      let ex: number
      if (sed0 && sed1) ex = same ? u(c0, k0) + t * (u(c1, k1) - u(c0, k0)) : useNear0 ? u(c0, k0) : u(c1, k1)
      else ex = sed0 ? u(c0, k0) : u(c1, k1)
      porePa[i] = hydro + ex
    }
    if (pDepth > 0) {
      hydroEmw[i] = emwPpg(hydro, pDepth)
      poreEmw[i] = Number.isNaN(porePa[i]) ? NaN : emwPpg(porePa[i], pDepth)
      overburdenEmw[i] = emwPpg(overburdenPa[i], pDepth)
    }
    m = i + 1
  }
  const sub = <T extends Float64Array | Uint8Array | Int32Array>(a: T): T => a.subarray(0, m) as T
  return {
    n: m,
    mdFt: sub(st.mdFt), tvdFt: sub(st.tvdFt), tvdssFt: sub(st.tvdssFt), xKm: sub(st.xKm), incDeg: sub(st.incDeg),
    stopped,
    seaLevelM: sl,
    waterDepthFt: mToFt(waterDepthM),
    mudlineTvdssFt: mToFt(sl - hHead),
    kind: sub(kind), layer: sub(layer), column: sub(col), ageMa: sub(ageMa), sandFrac: sub(sandFrac), porosity: sub(porosity), tempC: sub(tempC),
    hydroPa: sub(hydroPa), porePa: sub(porePa), overburdenPa: sub(overburdenPa),
    hydroEmw: sub(hydroEmw), poreEmw: sub(poreEmw), overburdenEmw: sub(overburdenEmw),
  }
}
