// Parameter registry: one entry per engine parameter.
//
// Why: John must be able to see, next to every control, where a number came from (cited, tuned
// or to-verify), and branches must know which parameters they may change (startOnly = false).
// Defaults are EXACTLY defaultParams() of spike 001 (spikes/001-shelf-to-basin/engine.js); a test
// loads the spike and compares. Engine values are SI. displayUnit is only a label for the UI;
// the conversion itself belongs in src/units.ts.
//
// Array parameters are [sand, mud] (see `components`). Min/max have the same shape as default.
// Min/max are guard rails for the UI, not published limits.

export type ParamValue = number | number[] | null

export interface ParamSource {
  kind: 'cited' | 'tuned' | 'to-verify'
  /** Reference id from references.ts. Required when kind is 'cited'; optional context otherwise. */
  refId?: string
  note: string
}

export interface ParamDef {
  key: string
  label: string
  /** SI unit used by the engine. */
  unit: string
  /** Unit John sees (label only). */
  displayUnit: string
  default: ParamValue
  min: ParamValue
  max: ParamValue
  /** True when the parameter only sets the start of the run, so a branch cannot change it. */
  startOnly: boolean
  /** Names of the array entries, e.g. ['sand', 'mud']. Absent for scalars. */
  components?: string[]
  source: ParamSource
}

const SM = ['sand', 'mud']
const SETUP = 'Numerical or set-up choice, not a measured quantity.'

export const PARAMS: readonly ParamDef[] = [
  // ---- grid and time (fixed for a run) ----
  { key: 'nx', label: 'Columns', unit: '-', displayUnit: '-', default: 150, min: 10, max: 400, startOnly: true,
    source: { kind: 'tuned', note: SETUP } },
  { key: 'dx', label: 'Column width', unit: 'm', displayUnit: 'km', default: 1000, min: 100, max: 5000, startOnly: true,
    source: { kind: 'tuned', note: SETUP } },
  { key: 'duration', label: 'Run length', unit: 'yr', displayUnit: 'Myr', default: 3.0e6, min: 1e5, max: 66e6, startOnly: true,
    source: { kind: 'tuned', note: 'Default last 3 Myr; up to 66 Myr (D12). The time-step schedule (schedule.ts) sets the actual steps.' } },
  { key: 'dtRec', label: 'Record step', unit: 'yr', displayUnit: 'kyr', default: 5000, min: 1000, max: 1e6, startOnly: true,
    source: { kind: 'tuned', note: 'Default step of the 3 Myr scenario. Longer runs use variable steps from schedule.ts.' } },
  { key: 'nSub', label: 'Transport substeps per record step', unit: '-', displayUnit: '-', default: 5, min: 1, max: 50, startOnly: true,
    source: { kind: 'tuned', note: SETUP } },

  // ---- boundary conditions (editable) ----
  { key: 'supply', label: 'Sediment supply', unit: 'm^2/yr', displayUnit: 'ft^2/yr', default: 20, min: 0, max: 200, startOnly: false,
    source: { kind: 'tuned', note: 'Solid volume per metre of margin. Order of magnitude for a large-river margin; needs a source.' } },
  { key: 'sandFrac', label: 'Sand share of supply', unit: '-', displayUnit: '-', default: 0.35, min: 0, max: 1, startOnly: false,
    source: { kind: 'tuned', note: 'Solid-volume share.' } },
  { key: 'slAmp', label: 'Sea-level amplitude', unit: 'm', displayUnit: 'ft', default: 40, min: 0, max: 150, startOnly: false,
    source: { kind: 'tuned', note: 'Teaching sine only; M1.4 replaces it with a published curve.' } },
  { key: 'slPeriod', label: 'Sea-level period', unit: 'yr', displayUnit: 'kyr', default: 100000, min: 10000, max: 1e6, startOnly: false,
    source: { kind: 'tuned', note: 'Teaching sine only; M1.4 replaces it with a published curve.' } },
  { key: 'slShift', label: 'Sea-level offset', unit: 'm', displayUnit: 'ft', default: 0, min: -200, max: 200, startOnly: false,
    source: { kind: 'tuned', note: 'Step offset of the teaching sine.' } },
  { key: 'subsShelf', label: 'Subsidence, landward edge', unit: 'm/Myr', displayUnit: 'ft/Myr', default: 40, min: 0, max: 500, startOnly: false,
    source: { kind: 'tuned', note: 'Range 40-150 m/Myr chosen by eye.' } },
  { key: 'subsBasin', label: 'Subsidence, basinward edge', unit: 'm/Myr', displayUnit: 'ft/Myr', default: 150, min: 0, max: 500, startOnly: false,
    source: { kind: 'tuned', note: 'Range 40-150 m/Myr chosen by eye.' } },

  // ---- transport diffusivities ----
  { key: 'Kc', label: 'Subaerial diffusivity', unit: 'm^2/yr', displayUnit: 'm^2/yr', default: [5.0e4, 1.0e5], min: [1e3, 1e3], max: [1e6, 1e6], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'rivenaes-1992', note: 'Fluvial. Gives about a 0.3 m/km coastal-plain gradient. Two-lithology form from Rivenaes (1992); values tuned.' } },
  { key: 'Km', label: 'Marine diffusivity at shoreline', unit: 'm^2/yr', displayUnit: 'm^2/yr', default: [400, 2500], min: [10, 10], max: [1e5, 1e5], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'kaufman-1991', note: 'Form K = Km exp(-d/dm) + Kg from Kaufman et al. (1991); values tuned.' } },
  { key: 'dm', label: 'Marine diffusivity e-folding depth', unit: 'm', displayUnit: 'ft', default: [10, 40], min: [1, 1], max: [500, 500], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'kaufman-1991', note: 'Form from Kaufman et al. (1991); values tuned.' } },
  { key: 'Kg', label: 'Deep-marine background diffusivity', unit: 'm^2/yr', displayUnit: 'm^2/yr', default: [100, 1000], min: [0, 0], max: [1e4, 1e4], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'kaufman-1991', note: 'Gravity creep. Picked for about 5-7 degree muddy slopes.' } },

  // ---- turbidity-current routing ----
  { key: 'tcMax', label: 'Max share routed as turbidity currents', unit: '-', displayUnit: '-', default: 0.6, min: 0, max: 1, startOnly: false,
    source: { kind: 'tuned', note: 'A transport-length rule, not flow physics.' } },
  { key: 'tcLambda', label: 'Shoreline-to-shelf-edge distance scale', unit: 'm', displayUnit: 'km', default: 8000, min: 500, max: 100000, startOnly: false,
    source: { kind: 'tuned', note: 'A transport-length rule, not flow physics.' } },
  { key: 'sBreak', label: 'Gradient defining the shelf edge', unit: 'm/m', displayUnit: 'm/m', default: 0.01, min: 0.001, max: 0.1, startOnly: false,
    source: { kind: 'tuned', note: 'Shelf-edge definition.' } },
  { key: 'tcL0', label: 'Turbidite deposition length at reference gradient', unit: 'm', displayUnit: 'km', default: [20000, 400000], min: [1000, 1000], max: [1e6, 1e6], startOnly: false, components: SM,
    source: { kind: 'tuned', note: 'A transport-length rule, not flow physics.' } },
  { key: 'tcSref', label: 'Reference gradient for turbidite length', unit: 'm/m', displayUnit: 'm/m', default: 0.005, min: 0.0005, max: 0.1, startOnly: false,
    source: { kind: 'tuned', note: 'A transport-length rule, not flow physics.' } },
  { key: 'tcN', label: 'Turbidite gradient exponent', unit: '-', displayUnit: '-', default: 2, min: 0.5, max: 4, startOnly: false,
    source: { kind: 'tuned', note: 'A transport-length rule, not flow physics.' } },

  // ---- compaction and pore pressure ----
  { key: 'phi0', label: 'Surface porosity', unit: '-', displayUnit: '-', default: [0.49, 0.63], min: [0.2, 0.2], max: [0.8, 0.8], startOnly: true, components: SM,
    source: { kind: 'cited', refId: 'sclater-christie-1980', note: 'Sand 0.49, mud 0.63. Start-only because stored layers depend on it.' } },
  { key: 'beta', label: 'Compaction coefficient (effective stress)', unit: '1/Pa', displayUnit: '1/psi', default: [2.68e-8, 5.2e-8], min: [1e-9, 1e-9], max: [5e-7, 5e-7], startOnly: true, components: SM,
    source: { kind: 'cited', refId: 'sclater-christie-1980', note: 'Converted from S&C depth coefficients 0.27 and 0.51 per km to effective stress so they match at 2 km under hydrostatic pressure. Exponential (Athy 1930) form.' } },
  { key: 'kA', label: 'Permeability intercept (log10 m^2)', unit: 'log10 m^2', displayUnit: 'log10 m^2', default: [-14.5, -22.0], min: [-20, -28], max: [-10, -16], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'yang-aplin-2010', note: 'log10 k = kA + kB*phi. Sand needs a source. Mud: Yang & Aplin (2010) is the candidate to adopt in M1.' } },
  { key: 'kB', label: 'Permeability slope vs porosity', unit: '-', displayUnit: '-', default: [7.0, 8.0], min: [1, 1], max: [20, 20], startOnly: false, components: SM,
    source: { kind: 'tuned', refId: 'yang-aplin-2010', note: 'See kA.' } },
  { key: 'kMudMult', label: 'Mud permeability multiplier', unit: '-', displayUnit: '-', default: 1, min: 0.01, max: 100, startOnly: false,
    source: { kind: 'tuned', note: 'Scales mud permeability; a what-if knob.' } },
  { key: 'elastic', label: 'Unloading stiffness (share of loading compressibility)', unit: '-', displayUnit: '-', default: 0.05, min: 0, max: 1, startOnly: true,
    source: { kind: 'tuned', note: 'Start-only because stored layers depend on it.' } },
  { key: 'linear', label: 'Benchmark mode (constant properties)', unit: '-', displayUnit: '-', default: null, min: null, max: null, startOnly: true,
    source: { kind: 'tuned', note: 'Switch for the Gibson (1958) benchmark: {e0, C, k}. Never set in the app.' } },
]

const BY_KEY = new Map(PARAMS.map((p) => [p.key, p]))

export function getParamDef(key: string): ParamDef | undefined {
  return BY_KEY.get(key)
}

export function paramKeys(): string[] {
  return PARAMS.map((p) => p.key)
}

/** Deep copy of one default so callers can never mutate the registry. */
function copyValue(v: ParamValue): ParamValue {
  return Array.isArray(v) ? v.slice() : v
}

/** Same shape as defaultParams() in spike 001. Fresh copy on every call. */
export function defaultParams(): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const p of PARAMS) out[p.key] = copyValue(p.default)
  return out
}

/** Keys a branch may change (startOnly false). */
export function branchEditableKeys(): string[] {
  return PARAMS.filter((p) => !p.startOnly).map((p) => p.key)
}
