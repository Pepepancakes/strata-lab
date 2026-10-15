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

export type ParamValue = number | number[] | string | null

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
  /** Allowed values of a choice parameter (string default). Absent for numbers. */
  options?: string[]
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
  { key: 'seaLevelKind', label: 'Sea-level source', unit: '-', displayUnit: '-', default: 'curve', min: null, max: null, startOnly: false, options: ['curve', 'sine'],
    source: { kind: 'cited', refId: 'bintanja-van-de-wal-2008', note: "'curve' is the published global record: Bintanja & van de Wal (2008) for the last 3 Myr, Miller et al. (2020) before that, blended over 200 kyr at 2.8-3.0 Ma. 'sine' is the teaching sine (slAmp, slPeriod)." } },
  { key: 'slAmp', label: 'Sea-level amplitude (sine only)', unit: 'm', displayUnit: 'ft', default: 40, min: 0, max: 150, startOnly: false,
    source: { kind: 'tuned', note: "Teaching sine only; used when seaLevelKind is 'sine'." } },
  { key: 'slPeriod', label: 'Sea-level period (sine only)', unit: 'yr', displayUnit: 'kyr', default: 100000, min: 10000, max: 1e6, startOnly: false,
    source: { kind: 'tuned', note: "Teaching sine only; used when seaLevelKind is 'sine'." } },
  { key: 'slShift', label: 'Sea-level offset', unit: 'm', displayUnit: 'ft', default: 0, min: -200, max: 200, startOnly: false,
    source: { kind: 'tuned', note: 'Step offset added to either sea-level source (branch what-ifs).' } },
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
  { key: 'bundleEvery', label: 'Deep compaction: full solve every N steps (1 = off)', unit: 'steps', displayUnit: 'steps', default: 1, min: 1, max: 50, startOnly: true,
    source: { kind: 'tuned', note: 'Numerical speed-up (M1.4b, not physics). Layers older than bundleAgeYr are consolidated once per N steps with the summed time. 1 = every layer every step. Always off in benchmark (linear) mode.' } },
  { key: 'bundleAgeYr', label: 'Deep compaction: age of the always-updated window', unit: 'yr', displayUnit: 'kyr', default: 500000, min: 50000, max: 5e6, startOnly: true,
    source: { kind: 'tuned', note: 'Numerical speed-up (M1.4b). Layers younger than this are updated every step. Only used when bundleEvery > 1.' } },

  // ---- changing subsidence (M1.4c) ----
  { key: 'subsMode', label: 'Subsidence history', unit: '-', displayUnit: '-', default: 'constant', min: null, max: null, startOnly: true, options: ['constant', 'thermal', 'history'],
    source: { kind: 'cited', refId: 'mckenzie-1978', note: "'constant' = fixed rates (the default scenario; the rate values are tuned). 'thermal' = rate x exp(-t/tau), the McKenzie (1978) post-rift decay, t counted from the start of the run. 'history' = user piecewise factors (subsHistory)." } },
  { key: 'subsTau', label: 'Thermal subsidence decay time', unit: 'yr', displayUnit: 'Myr', default: 62.8e6, min: 1e6, max: 500e6, startOnly: false,
    source: { kind: 'cited', refId: 'mckenzie-1978', note: 'tau about 62.8 Myr (lithosphere thermal time constant). Only used when subsMode is thermal.' } },
  { key: 'subsHistory', label: 'Subsidence history (piecewise factors)', unit: 'Ma, -', displayUnit: 'Ma, -', default: [], min: [], max: [], startOnly: true, components: [],
    source: { kind: 'tuned', note: 'Flat list [ageMa0, factor0, ageMa1, factor1, ...], ages strictly decreasing. Factor i multiplies the subsidence rates from age i until age i+1 (the first factor also applies before age 0, the last until the present). Only used when subsMode is history. User-supplied, so tuned.' } },

  // ---- temperature (M1.4c) ----
  { key: 'thermal', label: 'Temperature on (1) / off (0)', unit: '-', displayUnit: '-', default: 0, min: 0, max: 1, startOnly: true,
    source: { kind: 'tuned', note: 'Off switch, OFF by default so the default run stays bit-identical to M1.4b (golden parity). Steady conduction only: transient cooling by rapid burial is ignored.' } },
  { key: 'thermalEvery', label: 'Temperature and cement: update every N steps', unit: 'steps', displayUnit: 'steps', default: 5, min: 1, max: 50, startOnly: true,
    source: { kind: 'tuned', note: 'Numerical saving (M1.4c, not physics). The temperature field changes slowly, so it is recomputed every N steps and at the last step; cement integrates over the whole interval with temperature linear in time. Presets with bundled compaction use the same N.' } },
  { key: 'heatFlow', label: 'Basal heat flow', unit: 'W/m^2', displayUnit: 'mW/m^2', default: 0.040, min: 0.02, max: 0.12, startOnly: false,
    source: { kind: 'cited', refId: 'jones-2003-gom-heatflow', note: 'About 40 mW/m^2 is the regional background of the north-central Gulf slope; the Gulf ranges from <20 to ~100 mW/m^2. Quoted from an abstract, not checked against the thesis (to verify).' } },
  { key: 'kGrain', label: 'Grain thermal conductivity', unit: 'W/m/K', displayUnit: 'W/m/K', default: [7.7, 2.5], min: [5, 1.5], max: [9, 4], startOnly: false, components: SM,
    source: { kind: 'to-verify', refId: 'clauser-huenges-1995', note: 'Sand: quartz, about 7.7 (to verify). Mud: 2.5 is a clay-mineral mix chosen so that deep mud gives about 1 F/100 ft at 40 mW/m^2 (tuned).' } },
  { key: 'kWater', label: 'Pore-water thermal conductivity', unit: 'W/m/K', displayUnit: 'W/m/K', default: 0.6, min: 0.55, max: 0.75, startOnly: false,
    source: { kind: 'to-verify', refId: 'woodside-messmer-1961', note: 'About 0.6 at 20 C; its temperature dependence is ignored. Bulk conductivity is the geometric mean of grains and water (Woodside & Messmer 1961).' } },
  { key: 'tSeaDeep', label: 'Deep-water seafloor temperature', unit: 'deg C', displayUnit: 'deg F', default: 4, min: 0, max: 10, startOnly: false,
    source: { kind: 'to-verify', note: 'Bottom water below about 1000 m in the Gulf is near 4 C. Not checked against a source.' } },
  { key: 'tSeaShallow', label: 'Shelf / land surface temperature', unit: 'deg C', displayUnit: 'deg F', default: 20, min: 0, max: 30, startOnly: false,
    source: { kind: 'tuned', note: 'Surface temperature at zero water depth (shelf bottom water and coastal plain).' } },
  { key: 'tSeaScale', label: 'Seafloor temperature e-folding depth', unit: 'm', displayUnit: 'ft', default: 300, min: 50, max: 2000, startOnly: false,
    source: { kind: 'tuned', note: 'Seafloor T = tSeaDeep + (tSeaShallow - tSeaDeep) exp(-water depth / this). A smooth stand-in for the thermocline.' } },

  // ---- quartz cement in sands (M1.4c) ----
  { key: 'cement', label: 'Quartz cement on (1) / off (0)', unit: '-', displayUnit: '-', default: 0, min: 0, max: 1, startOnly: true,
    source: { kind: 'tuned', note: 'Off switch. Needs temperature on. Cement is silica from outside the model (own mass-balance line).' } },
  { key: 'cemA', label: 'Quartz precipitation rate prefactor', unit: 'mol/m^2/s', displayUnit: 'mol/m^2/s', default: 1.98e-18, min: 1e-19, max: 5e-18, startOnly: false,
    source: { kind: 'cited', refId: 'walderhaug-1994', note: 'r = a 10^(b T): a = 1.98e-22 mol/cm^2/s = 1.98e-18 mol/m^2/s (Walderhaug 1994; Walderhaug 1996 uses about 2e-22).' } },
  { key: 'cemB', label: 'Quartz precipitation temperature coefficient', unit: '1/deg C', displayUnit: '1/deg C', default: 0.022, min: 0.018, max: 0.023, startOnly: false,
    source: { kind: 'cited', refId: 'walderhaug-1994', note: 'b = 0.022 per deg C; Walderhaug (1996) varied it from 0.018 to 0.023.' } },
  { key: 'cemTonset', label: 'Temperature where cementation starts', unit: 'deg C', displayUnit: 'deg F', default: 70, min: 60, max: 90, startOnly: false,
    source: { kind: 'cited', refId: 'walderhaug-1996', note: 'Quartz cementation is significant from about 70-80 C (card brief, Walderhaug 1996). Below this the rate is set to zero.' } },
  { key: 'cemGrain', label: 'Sand grain diameter (cement surface area)', unit: 'm', displayUnit: 'mm', default: 2e-4, min: 5e-5, max: 1e-3, startOnly: false,
    source: { kind: 'tuned', note: 'Fine sand, 0.2 mm. Sets the quartz surface area A = 6 (1 - phi) f / d; synthetic.' } },
  { key: 'cemSurf', label: 'Share of grain surface that is clean quartz', unit: '-', displayUnit: '-', default: 0.7, min: 0.05, max: 1, startOnly: false,
    source: { kind: 'tuned', refId: 'walderhaug-1996', note: 'Detrital quartz share times the share not covered by clay or mica coats (Walderhaug 1996 treats these as inputs). Synthetic.' } },

  // ---- slope stability (M2.1) ----
  { key: 'phiFric', label: "Friction angle phi' (effective stress)", unit: 'deg', displayUnit: 'deg', default: [33, 25], min: [15, 15], max: [45, 45], startOnly: false, components: SM,
    source: { kind: 'to-verify', refId: 'hampton-1996', note: 'Typical drained values: marine muds about 20-30 deg, sands about 30-38 deg (soil-mechanics ranges as summarised for submarine slopes by Hampton et al. 1996; not checked against the paper). Defaults 33 and 25 are mid-range picks.' } },
  { key: 'cohesion', label: "Cohesion c' (effective stress)", unit: 'Pa', displayUnit: 'psi', default: [0, 0], min: [0, 0], max: [1e5, 1e5], startOnly: false, components: SM,
    source: { kind: 'to-verify', refId: 'hampton-1996', note: "Clean sand has c' = 0; normally consolidated marine clay has c' near 0 (Hampton et al. 1996; not checked against the paper). Raise the mud value to test cemented or overconsolidated muds." } },
  { key: 'stabMaxDepth', label: 'Stability search depth below the seafloor', unit: 'm', displayUnit: 'ft', default: 300, min: 10, max: 2000, startOnly: false,
    source: { kind: 'tuned', note: 'Search window for the lowest factor of safety (about 1,000 ft). A set-up choice.' } },
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
