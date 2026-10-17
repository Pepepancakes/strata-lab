// Pressures along a well (M4.2): overburden, pore pressure, fracture gradient and the mud-weight window.
// Pure module (no DOM, clock or randomness). It reads a WellSamples (well.ts) and changes nothing.
//
// 1. UNITS. Pressures in psi (paToPsi) and as equivalent mud weight (EMW, ppg) referenced to the rig
//    floor (RKB): EMW = P / (g D), D = depth below RKB, g = the engine's 9.81 m/s^2 (constants.ts), the same
//    as the samples. 1 ppg is 119.826 kg/m^3, so 1 ppg at 1 ft of depth is 0.05197 psi at this g
//    (0.05195 at standard gravity; the field rule is 0.052). Conversions live in src/units.ts.
//
// 2. FRACTURE GRADIENT. With S the total vertical stress (overburden, which includes the weight of the
//    water column in deep water), P the pore pressure and D the depth below RKB, the pressure that opens
//    a fracture is
//      Eaton (1969):             Pf = (nu / (1 - nu)) (S - P) + P      FG = Pf / D
//      Matthews & Kelly (1967):  Pf = Ki (S - P) + P                   FG = Pf / D
//    i.e. the pore pressure plus a share K of the effective stress. For Eaton K = nu / (1 - nu) (the
//    horizontal stress of an elastic rock held from spreading sideways); for Matthews & Kelly K = Ki, read
//    from a chart in the paper. Both are applied here with a CONSTANT K (see wellPressureParams.ts: the
//    depth curves of the papers were not read, so they are not tabulated). The equations are written from
//    the commonly quoted form (to verify against the papers).
//    In SALT the fracture gradient is the overburden: salt is impermeable, flows until the stress is
//    nearly equal in all directions, and has no pore pressure to add. Industry practice; no source is in
//    this project (to verify). The pore pressure of salt is not modelled (NaN in the samples); for the
//    window the lower limit in salt is the hydrostatic pressure (what the surrounding formation water would
//    hold), a labelled choice, not a measurement.
//
// 3. WINDOW. lower = pore pressure EMW + lower margin; upper = fracture-gradient EMW - upper margin
//    (margins default to 0). width = upper - lower. A station is
//      'ok'        width >= tight threshold (0.5 ppg, tuned),
//      'tight'     0 < width < threshold,
//      'noWindow'  width <= 0: the pore pressure has reached the fracture gradient (with the margins).
//    No wellbore-stability (collapse) limit is used (D21): the lower limit is pore pressure only.
//    Water and air stations have no window.
// Hand calculation: tests/wellPressure.test.ts.

import { ftToM, paToPsi } from '../units'
import { emwPpg, WELL_AIR, WELL_SALT, WELL_WATER, type WellSamples } from './well'
import { defaultWellPressureParams, type WellPressureParams } from './wellPressureParams'

/** The part of a WellSamples that the pressure calculation reads. */
export type PressureInput = Pick<WellSamples, 'n' | 'mdFt' | 'tvdssFt' | 'kind' | 'depthRkbFt' | 'hydroPa' | 'porePa' | 'overburdenPa'>

export const WINDOW_NONE = 0 // water or air: no window
export const WINDOW_OK = 1
export const WINDOW_TIGHT = 2
export const WINDOW_NO_WINDOW = 3

export type WindowState = typeof WINDOW_NONE | typeof WINDOW_OK | typeof WINDOW_TIGHT | typeof WINDOW_NO_WINDOW

/** A run of neighbouring stations in the same window state. */
export interface WindowInterval {
  topTvdssFt: number
  bottomTvdssFt: number
  topMdFt: number
  bottomMdFt: number
  /** Narrowest width inside the run, ppg (negative = pore pressure above the fracture gradient). */
  minWidthPpg: number
}

export interface WellPressureSummary {
  /** The narrowest window of the well (null if no station has one). */
  narrowest: { widthPpg: number; tvdssFt: number; mdFt: number; station: number } | null
  /** Runs with 0 < width < the tight threshold. */
  tight: WindowInterval[]
  /** Runs where the pore pressure has reached the fracture gradient. */
  noWindow: WindowInterval[]
}

/** Per station, aligned with the samples. psi arrays are pressures; Emw arrays are ppg from RKB. NaN = not defined there. */
export interface WellPressures {
  n: number
  params: WellPressureParams
  hydroPsi: Float64Array
  porePsi: Float64Array
  overburdenPsi: Float64Array
  /** Fracture pressure of the chosen method, psi. */
  fracturePsi: Float64Array
  hydroEmw: Float64Array
  poreEmw: Float64Array
  overburdenEmw: Float64Array
  /** Fracture gradient of each method and of the chosen one, ppg. Both equal the overburden in salt. */
  fgEatonEmw: Float64Array
  fgMatthewsKellyEmw: Float64Array
  fgEmw: Float64Array
  /** Window limits (margins applied) and width, ppg. */
  lowerEmw: Float64Array
  upperEmw: Float64Array
  widthPpg: Float64Array
  /** WINDOW_NONE ... WINDOW_NO_WINDOW */
  state: Uint8Array
  summary: WellPressureSummary
}

/** Pressure that opens a fracture: pore pressure plus a share k of the effective stress, Pa. */
export function fracturePressurePa(overburdenPa: number, porePa: number, k: number): number {
  return k * (overburdenPa - porePa) + porePa
}

/** Eaton's share of the effective stress, nu / (1 - nu). */
export function eatonK(poissonRatio: number): number {
  return poissonRatio / (1 - poissonRatio)
}

export function wellPressures(s: PressureInput, params: WellPressureParams = defaultWellPressureParams()): WellPressures {
  const n = s.n
  const nan = (): Float64Array => new Float64Array(n).fill(NaN)
  const hydroPsi = nan(), porePsi = nan(), overburdenPsi = nan(), fracturePsi = nan()
  const hydroEmw = nan(), poreEmw = nan(), overburdenEmw = nan()
  const fgEatonEmw = nan(), fgMatthewsKellyEmw = nan(), fgEmw = nan()
  const lowerEmw = nan(), upperEmw = nan(), widthPpg = nan()
  const state = new Uint8Array(n)
  const kEaton = eatonK(params.poissonRatio)
  const kMk = params.matthewsKellyKi
  for (let i = 0; i < n; i++) {
    const kind = s.kind[i]
    const depthM = ftToM(s.depthRkbFt[i])
    if (kind === WELL_AIR || !(depthM > 0)) continue
    const sv = s.overburdenPa[i]
    const hy = s.hydroPa[i]
    hydroPsi[i] = paToPsi(hy)
    overburdenPsi[i] = paToPsi(sv)
    hydroEmw[i] = emwPpg(hy, depthM)
    overburdenEmw[i] = emwPpg(sv, depthM)
    if (kind === WELL_WATER) {
      // sea water: pore pressure = hydrostatic = overburden, no rock to fracture
      porePsi[i] = hydroPsi[i]
      poreEmw[i] = hydroEmw[i]
      continue
    }
    const salt = kind === WELL_SALT
    // pore pressure of the window's lower limit: sediment pore pressure; in salt the hydrostatic pressure
    const p = salt ? hy : s.porePa[i]
    if (!salt) {
      porePsi[i] = paToPsi(p)
      poreEmw[i] = emwPpg(p, depthM)
    }
    const pfEaton = salt ? sv : fracturePressurePa(sv, p, kEaton)
    const pfMk = salt ? sv : fracturePressurePa(sv, p, kMk)
    fgEatonEmw[i] = emwPpg(pfEaton, depthM)
    fgMatthewsKellyEmw[i] = emwPpg(pfMk, depthM)
    const eaton = params.fgMethod === 'eaton'
    fracturePsi[i] = paToPsi(eaton ? pfEaton : pfMk)
    fgEmw[i] = eaton ? fgEatonEmw[i] : fgMatthewsKellyEmw[i]
    lowerEmw[i] = emwPpg(p, depthM) + params.lowerMarginPpg
    upperEmw[i] = fgEmw[i] - params.upperMarginPpg
    widthPpg[i] = upperEmw[i] - lowerEmw[i]
    state[i] = widthPpg[i] <= 0 ? WINDOW_NO_WINDOW : widthPpg[i] < params.tightWindowPpg ? WINDOW_TIGHT : WINDOW_OK
  }
  return {
    n, params, hydroPsi, porePsi, overburdenPsi, fracturePsi, hydroEmw, poreEmw, overburdenEmw,
    fgEatonEmw, fgMatthewsKellyEmw, fgEmw, lowerEmw, upperEmw, widthPpg, state,
    summary: summarise(s, widthPpg, state),
  }
}

function summarise(s: PressureInput, width: Float64Array, state: Uint8Array): WellPressureSummary {
  let narrowest: WellPressureSummary['narrowest'] = null
  for (let i = 0; i < s.n; i++) {
    if (state[i] === WINDOW_NONE) continue
    if (narrowest === null || width[i] < narrowest.widthPpg) narrowest = { widthPpg: width[i], tvdssFt: s.tvdssFt[i], mdFt: s.mdFt[i], station: i }
  }
  const runs = (want: WindowState): WindowInterval[] => {
    const out: WindowInterval[] = []
    let start = -1
    for (let i = 0; i <= s.n; i++) {
      const hit = i < s.n && state[i] === want
      if (hit && start < 0) start = i
      if (!hit && start >= 0) {
        let min = Infinity
        for (let k = start; k < i; k++) min = Math.min(min, width[k])
        out.push({ topTvdssFt: s.tvdssFt[start], bottomTvdssFt: s.tvdssFt[i - 1], topMdFt: s.mdFt[start], bottomMdFt: s.mdFt[i - 1], minWidthPpg: min })
        start = -1
      }
    }
    return out
  }
  return { narrowest, tight: runs(WINDOW_TIGHT), noWindow: runs(WINDOW_NO_WINDOW) }
}
