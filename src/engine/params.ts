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
  { key: 'shelfBreakDepth', label: 'Minimum water depth at the shelf edge', unit: 'm', displayUnit: 'ft', default: 50, min: 0, max: 500, startOnly: false,
    source: { kind: 'tuned', note: 'SFM-2 (D31.3): a face counts as the shelf edge only where the water is at least this deep, so the steep shoreface the model builds at the coast is not mistaken for it. 50 m is 5 x the sand marine e-folding depth dm (10 m), the depth at which the marine diffusivity has fallen to its deep background value Kg (SFM-R suggestion); it is a tuned model value, not a measured shelf-break depth (real shelf breaks are commonly deeper, 100 m or more; not read for this card).' } },
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

  // ---- slope failure and debris-flow run-out (M2.2) ----
  { key: 'failOn', label: 'Slope failure on (1) / off (0)', unit: '-', displayUnit: '-', default: 0, min: 0, max: 1, startOnly: true,
    source: { kind: 'tuned', note: 'Off switch, OFF by default so the default run stays bit-identical to M1 (golden parity). When on, every column with a factor of safety below 1 fails after each step.' } },
  { key: 'failMaxCells', label: 'Most columns in one failure', unit: '-', displayUnit: '-', default: 10, min: 1, max: 100, startOnly: false,
    source: { kind: 'tuned', note: 'Caps how far a failure retrogresses sideways (contiguous columns with FS < 1). More unstable columns fail as further events in the same step.' } },
  { key: 'failMaxIters', label: 'Most failures per step (rechecks of the scar)', unit: '-', displayUnit: '-', default: 5, min: 1, max: 50, startOnly: false,
    source: { kind: 'tuned', note: 'After a failure the new headwall is checked again, up to this many times per step. Anything still unstable is counted and retried next step.' } },
  { key: 'runYield', label: 'Debris-flow yield strength', unit: 'Pa', displayUnit: 'psi', default: 5000, min: 100, max: 1e5, startOnly: false,
    source: { kind: 'tuned', refId: 'imran-2001', note: 'Bingham yield strength tau_y of the moving debris (Imran et al. 2001 model). Clay-rich debris flows use values from tens of Pa to tens of kPa; this one is picked for run-outs of tens of km. No value was checked against a paper.' } },
  { key: 'runViscosity', label: 'Debris-flow viscosity', unit: 'Pa s', displayUnit: 'Pa s', default: 1000, min: 1, max: 1e5, startOnly: false,
    source: { kind: 'tuned', refId: 'imran-2001', note: 'Bingham plastic viscosity mu of the moving debris. Sets the speed (tens of m/s for a 30 m thick flow on 3 degrees), not where the flow stops.' } },
  { key: 'runDensity', label: 'Debris-flow bulk density', unit: 'kg/m^3', displayUnit: 'kg/m^3', default: 1800, min: 1100, max: 2200, startOnly: false,
    source: { kind: 'tuned', note: 'Water plus solids while moving. Sets the flow volume (solids / concentration) and the buoyant driving force (density minus sea water).' } },
  { key: 'mtdPhiMud', label: 'Porosity of mud in a fresh debris deposit', unit: '-', displayUnit: '-', default: 0.55, min: 0.3, max: 0.8, startOnly: false,
    source: { kind: 'tuned', note: 'Remoulded mud restarts consolidation here. It is turned into a starting maximum effective stress from the porosity law; a value at or above the surface porosity gives 0 (fresh sediment). Sand in the deposit follows the same stress.' } },

  // ---- failure triggers (M2.3) ----
  { key: 'failMinDepth', label: 'Shallowest slip surface considered', unit: 'm', displayUnit: 'ft', default: 10, min: 0, max: 100, startOnly: false,
    source: { kind: 'tuned', note: 'Slip surfaces shallower than this below the seafloor are ignored. The topmost cells of a fresh layer are undrained (u = load), so on any slope they look unstable and would give metre-thick skin slides that are not MTDs. 10 m is about the thinnest MTD seismic data resolves (to verify); 0 searches every cell as M2.2 did.' } },
  { key: 'failSlopeMin', label: 'Gentlest slope checked for failure', unit: 'deg', displayUnit: 'deg', default: 0.5, min: 0, max: 5, startOnly: false,
    source: { kind: 'tuned', note: 'Columns whose seafloor slope is below this are not searched. A speed cut (the shelf and basin floor are about 80 percent of the columns) and a stated limit: failures on slopes under 0.5 deg are not modelled, although some real MTDs sit on 0.5-1 deg slopes (Hampton et al. 1996, to verify).' } },
  { key: 'failLowstandDrop', label: 'Sea-level fall that makes an event a lowstand event', unit: 'm', displayUnit: 'ft', default: 20, min: 0.1, max: 100, startOnly: false,
    source: { kind: 'tuned', note: 'Trigger tagging only (triggers.ts). The sea-level term of the tag is the fall over the lookback window divided by this number; it competes with the slope and pressure terms and the largest wins. 20 m so that only a real lowstand qualifies (the Plio-Pleistocene glacio-eustatic amplitude is about 40 m, to verify); M2.3 used 5 m and tagged 32 of 33 events lowstand. With these default thresholds the label lowstand is rarely or never reached on the MTD-prone preset (0 of 24 events), so the label is not suggestive of a reachable outcome there: the pressure term dominates. Does not change the physics.' } },
  { key: 'failRapidRate', label: 'Accumulation rate that counts as rapid loading', unit: 'm/yr', displayUnit: 'm/yr', default: 1e-3, min: 1e-5, max: 1e-1, startOnly: false,
    source: { kind: 'tuned', note: 'Trigger tagging only (triggers.ts). A pressure-driven event is tagged rapid loading when the source column gained at least this much bulk sediment per year over the lookback (1e-3 m/yr = 1 m/kyr), otherwise overpressure. Does not change the physics.' } },
  { key: 'failSlopeTerm', label: 'Slope term that counts as oversteepening', unit: '-', displayUnit: '-', default: 0.1, min: 0.001, max: 5, startOnly: false,
    source: { kind: 'tuned', note: 'Trigger tagging only (triggers.ts). The slope term dSlope = ln(tan beta now / tan beta then) over the lookback, divided by this number, competes with the pressure and sea-level terms. 0.1 = the seafloor slope steepened by about 10 percent. Does not change the physics.' } },
  { key: 'failPressTerm', label: 'Pressure term that counts as overpressure', unit: '-', displayUnit: '-', default: 0.1, min: 0.001, max: 5, startOnly: false,
    source: { kind: 'tuned', note: 'Trigger tagging only (triggers.ts). The pressure term dPress = ln((1 - ru then) / (1 - ru now)) over the lookback, divided by this number, competes with the slope and sea-level terms. 0.1 = the effective-stress share of the load fell by about 10 percent. Does not change the physics.' } },
  { key: 'failStallRunout', label: 'Run-out below which a repeat failure is not tried again', unit: 'm', displayUnit: 'km', default: 500, min: 0, max: 10000, startOnly: false,
    source: { kind: 'tuned', note: 'If a failure runs out less than this and the next recheck in the same step picks the same columns, they are not failed again that step: the event is flagged stalled and the columns are counted in failUnresolved (retried next step). Stops the engine failing the same thin cover again and again without moving it. 500 m is a tuned number; 0 turns the rule off (M2.3 behaviour).' } },

  // ---- salt flow (M3.1) ----
  { key: 'saltOn', label: 'Salt layer on (1) / off (0)', unit: '-', displayUnit: '-', default: 0, min: 0, max: 1, startOnly: true,
    source: { kind: 'tuned', note: 'Off switch, OFF by default so every earlier run stays bit-identical. When on, a mobile salt layer lies between the basement and the sediment and flows under the load of the sediment (salt.ts; spike 002).' } },
  { key: 'saltThick', label: 'Initial salt thickness', unit: 'm', displayUnit: 'ft', default: 1500, min: 100, max: 4000, startOnly: true,
    source: { kind: 'tuned', note: 'Thickness basinward of the pinch-out at the start of the run. Synthetic; real salt basins range from a few hundred metres to several kilometres.' } },
  { key: 'saltPinchStart', label: 'Salt pinch-out: no salt landward of', unit: 'm', displayUnit: 'km', default: 25000, min: 0, max: 400000, startOnly: true,
    source: { kind: 'tuned', note: 'Distance from the landward edge. Salt thickness rises smoothly from 0 here to its full value at the next parameter.' } },
  { key: 'saltPinchEnd', label: 'Salt pinch-out: full thickness basinward of', unit: 'm', displayUnit: 'km', default: 45000, min: 100, max: 400000, startOnly: true,
    source: { kind: 'tuned', note: 'Must be larger than the previous parameter.' } },
  { key: 'saltLimitStart', label: 'Salt basin limit: full thickness landward of', unit: 'm', displayUnit: 'km', default: 2000000, min: 0, max: 5000000, startOnly: true,
    source: { kind: 'tuned', refId: 'hudec-2013', note: 'Basinward end of the salt basin (M3.10). The Louann Salt basin ends near the limit of normal oceanic crust, where the salt thins seaward (Hudec et al. 2013, abstract read; the position in km is not in it). Here the position is tuned: a synthetic section is not scaled to the Gulf. Salt thickness falls smoothly from full to 0 between this and the next parameter. The default, 2000 km, is beyond any section (400 columns x 5 km), so a run that does not set it has the salt basin running to the basinward edge as before.' } },
  { key: 'saltLimitEnd', label: 'Salt basin limit: no salt basinward of', unit: 'm', displayUnit: 'km', default: 2500000, min: 100, max: 5000000, startOnly: true,
    source: { kind: 'tuned', refId: 'hudec-2013', note: 'See saltLimitStart. Must be larger than it.' } },
  { key: 'saltVisc', label: 'Salt viscosity', unit: 'Pa s', displayUnit: 'Pa s', default: 1e17, min: 1e16, max: 1e20, startOnly: false,
    source: { kind: 'tuned', refId: 'wagner-jackson-2011', note: 'Field-based estimates for natural rock salt generally 1e17 to 1e20 Pa s; creep-law estimates 1e12 to 1e20 Pa s (Wagner & Jackson 2011, pp. 311-312). The default is the fast end, tuned so that flow shows within 3 Myr.' } },
  { key: 'nSaltSub', label: 'Salt substeps per record step', unit: '-', displayUnit: '-', default: 5, min: 1, max: 50, startOnly: true,
    source: { kind: 'tuned', note: SETUP } },
  { key: 'coverUneven', label: 'Unevenness of the older cover (salt on)', unit: '-', displayUnit: '-', default: 0, min: 0, max: 0.5, startOnly: true,
    source: { kind: 'tuned', note: 'Plus or minus fraction of the older cover thickness, a seeded smooth random pattern (rng.ts). 0 = flat. Gives the salt something to start flowing from.' } },
  { key: 'coverSeed', label: 'Seed of the cover unevenness', unit: '-', displayUnit: '-', default: 1, min: 0, max: 4294967295, startOnly: true,
    source: { kind: 'tuned', note: SETUP } },
  { key: 'coverThick', label: 'Thickness of the older cover (salt on)', unit: 'm', displayUnit: 'ft', default: 200, min: 50, max: 3000, startOnly: true,
    source: { kind: 'tuned', note: 'Bulk thickness of the pre-run cover over the salt at the start (the Mesozoic cover of the Gulf-style preset). Synthetic, not a stratigraphic column. The Gulf-style preset uses 300 m (tuned, M3.8); the 10 Myr salt teaching preset uses 100 m.' } },
  // ---- cover bending stiffness (M3.2) ----
  { key: 'coverBend', label: 'Cover resists bending (1) / not (0) (salt on)', unit: '-', displayUnit: '-', default: 1, min: 0, max: 1, startOnly: false,
    source: { kind: 'tuned', refId: 'turcotte-schubert', note: 'Switch. With 0 the salt flows as in M3.1 and the narrowest bumps grow fastest (diapir width = a few grid cells). With 1 the sediment above the salt acts as a viscous plate that resists bending, so a preferred width appears (salt.ts). Only matters when salt is on.' } },
  { key: 'coverVisc', label: 'Cover effective viscosity as a plate (salt on)', unit: 'Pa s', displayUnit: 'Pa s', default: 1e19, min: 1e17, max: 1e22, startOnly: false,
    source: { kind: 'tuned', refId: 'turcotte-schubert', note: 'Effective viscosity of the sediment above the salt, treated as one viscous plate. No published value for a sediment cover is in this project\'s references (to verify). 1e19 is 100 times the default salt viscosity: tuned, it gives a preferred diapir spacing of about 10.2 km under 1 km of cover over 1.5 km of salt (physics-references, M3.2; the M3.2 note said about 8 km, corrected in M3.8).' } },
  // ---- welds and salt in the burial physics (M3.3) ----
  { key: 'weldThick', label: 'Weld: salt thinner than', unit: 'm', displayUnit: 'ft', default: 10, min: 0, max: 200, startOnly: false,
    source: { kind: 'tuned', refId: 'hudec-jackson-2007', note: 'A weld is the surface left where salt has been squeezed out (Hudec & Jackson 2007: the place where the layers above and below the salt come back together, with at most a thin remnant). A column counts as welded once its salt is thinner than this. It only labels the column and records the age; the salt limiter (never below zero) does not depend on it. The default 10 m is kept so earlier salt runs are unchanged; the Gulf-style preset uses 100 m (tuned, about seismic resolution): thin-sheet flow slows as h^3 and does not reach 10 m in 66 Myr, and Wagner & Jackson (2011, abstract only, to verify) find that up to about 50 m of salt stays in an incomplete weld under a broad prograding wedge (decision D18).' } },
  { key: 'saltK0', label: 'Salt thermal conductivity at 0 deg C', unit: 'W/m/K', displayUnit: 'W/m/K', default: 6.0, min: 4.5, max: 7, startOnly: false,
    source: { kind: 'to-verify', refId: 'clauser-huenges-1995', note: 'Halite is about 5 to 6.5 W/m/K near the surface (to verify against the paper). That is 2 to 4 times the conductivity of the sediment, so salt conducts heat well and cools what lies below it.' } },
  { key: 'saltKa', label: 'Salt conductivity falls with temperature: a', unit: '1/K', displayUnit: '1/K', default: 0.0030, min: 0, max: 0.01, startOnly: false,
    source: { kind: 'to-verify', refId: 'clauser-huenges-1995', note: 'k(T) = k0 / (0.99 + T (a - b / k0)), T in deg C: the form Clauser & Huenges (1995) quote from Sass et al. (1992). a = 0.0030 and b = 0.0042 are the crystalline-rock coefficients as remembered, NOT checked for halite (to verify).' } },
  { key: 'saltKb', label: 'Salt conductivity falls with temperature: b', unit: 'W/m/K^2', displayUnit: 'W/m/K^2', default: 0.0042, min: 0, max: 0.02, startOnly: false,
    source: { kind: 'to-verify', refId: 'clauser-huenges-1995', note: 'See saltKa. With these two numbers a salt of 6 W/m/K at 0 C is about 5.3 W/m/K at 60 C.' } },
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
