// Parameters of the pressures along a well (M4.2): fracture gradient and the mud-weight window.
//
// These are NOT engine parameters. They only read a sample of the record (well.ts), never change it,
// and never enter a stateHash, so they live in their own small registry (same ParamDef shape as
// params.ts, so the controls and the docs can list them the same way) and are passed to
// wellPressures() as an argument. M4.3 saves them with the well plan.
// Every entry is cited, to-verify, or tuned, and docs/physics-references.md "M4 well pressures" says which.

import type { ParamDef } from './params'

export type FractureMethod = 'eaton' | 'matthews-kelly'

export interface WellPressureParams {
  /** Which fracture-gradient method the window uses. */
  fgMethod: FractureMethod
  /** Poisson's ratio in Eaton's equation (constant with depth). */
  poissonRatio: number
  /** Matrix-stress coefficient Ki in Matthews & Kelly's equation (constant with depth). */
  matthewsKellyKi: number
  /** Margin added above pore pressure for the lower limit of the window, ppg. */
  lowerMarginPpg: number
  /** Margin taken off the fracture gradient for the upper limit of the window, ppg. */
  upperMarginPpg: number
  /** A window narrower than this (ppg) is called tight. */
  tightWindowPpg: number
}

export const WELL_PRESSURE_PARAMS: readonly ParamDef[] = [
  { key: 'fgMethod', label: 'Fracture-gradient method', unit: '-', displayUnit: '-', default: 'eaton', min: null, max: null, startOnly: false, options: ['eaton', 'matthews-kelly'],
    source: { kind: 'cited', refId: 'eaton-1969', note: "'eaton' = Eaton (1969), FG = (nu / (1 - nu)) (S - P) / D + P / D. 'matthews-kelly' = Matthews & Kelly (1967), FG = Ki (S - P) / D + P / D. Both are written from the equations as commonly quoted; neither paper was read in this project (to verify against the papers). In salt both give way to FG = overburden." } },
  { key: 'poissonRatio', label: "Poisson's ratio (Eaton)", unit: '-', displayUnit: '-', default: 0.4, min: 0.2, max: 0.49, startOnly: false,
    source: { kind: 'tuned', refId: 'eaton-1969', note: "One constant for all depths. Eaton's own ratio rises with depth along a Gulf Coast curve; its points are NOT tabulated here because the paper was not read (to verify). 0.40 is a mid-range pick for compacted Gulf mud; it is the main lever on the fracture gradient (nu / (1 - nu) = 0.667)." } },
  { key: 'matthewsKellyKi', label: 'Matrix-stress coefficient Ki (Matthews & Kelly)', unit: '-', displayUnit: '-', default: 0.6, min: 0.3, max: 1, startOnly: false,
    source: { kind: 'tuned', refId: 'matthews-kelly-1967', note: "One constant for all depths. Matthews & Kelly read Ki from a chart against the depth where the matrix stress would be normal (Gulf Coast curve); its points are NOT tabulated here because the paper was not read (to verify). With a constant Ki the equation has the same form as Eaton's with nu / (1 - nu) = Ki, so the two methods differ only through the number chosen." } },
  { key: 'lowerMarginPpg', label: 'Margin above pore pressure', unit: 'ppg', displayUnit: 'ppg', default: 0, min: 0, max: 2, startOnly: false,
    source: { kind: 'tuned', note: 'Safety margin (for example a trip margin) added to the pore-pressure EMW to give the lowest mud weight. 0 = the window starts at pore pressure.' } },
  { key: 'upperMarginPpg', label: 'Margin below fracture gradient', unit: 'ppg', displayUnit: 'ppg', default: 0, min: 0, max: 2, startOnly: false,
    source: { kind: 'tuned', note: 'Safety margin taken off the fracture-gradient EMW to give the highest mud weight. 0 = the window ends at the fracture gradient.' } },
  { key: 'tightWindowPpg', label: 'Window called tight when narrower than', unit: 'ppg', displayUnit: 'ppg', default: 0.5, min: 0.1, max: 2, startOnly: false,
    source: { kind: 'tuned', note: 'A labelling threshold for the plot and the summary, not physics. 0.5 ppg is a common rule of thumb for a narrow deepwater window (no source; to verify).' } },
]

/** The defaults, as the typed object wellPressures() takes. Fresh copy on every call. */
export function defaultWellPressureParams(): WellPressureParams {
  const out: Record<string, unknown> = {}
  for (const p of WELL_PRESSURE_PARAMS) out[p.key] = p.default
  return out as unknown as WellPressureParams
}

/** Plain-language problems with a set of values (empty = usable). */
export function validateWellPressureParams(p: WellPressureParams): string[] {
  const out: string[] = []
  for (const d of WELL_PRESSURE_PARAMS) {
    const v = (p as unknown as Record<string, unknown>)[d.key]
    if (d.options) {
      if (typeof v !== 'string' || !d.options.includes(v)) out.push(`${d.label} must be one of: ${d.options.join(', ')}.`)
    } else if (typeof v !== 'number' || !Number.isFinite(v) || v < (d.min as number) || v > (d.max as number)) {
      out.push(`${d.label} must be a number from ${d.min} to ${d.max}.`)
    }
  }
  return out
}
