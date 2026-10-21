// Typed view of the parameter registry (params.ts) for the process modules.
// The registry stays the single source of defaults, ranges and citations; this file only gives
// the solver typed access. Array parameters are [sand, mud].

import { defaultParams } from './params'

export type Pair = [number, number]

export interface LinearMode {
  /** Constant void ratio. */
  e0: number
  /** Constant compressibility, 1/Pa. */
  C: number
  /** Constant permeability, m^2. */
  k: number
}

export interface EngineParams {
  nx: number
  dx: number
  duration: number
  dtRec: number
  nSub: number
  supply: number
  sandFrac: number
  /** 'curve' = published record (default), 'sine' = teaching sine using slAmp and slPeriod. */
  seaLevelKind: 'curve' | 'sine'
  slAmp: number
  slPeriod: number
  slShift: number
  subsShelf: number
  subsBasin: number
  Kc: Pair
  Km: Pair
  dm: Pair
  Kg: Pair
  tcMax: number
  tcLambda: number
  sBreak: number
  tcL0: Pair
  tcSref: number
  tcN: number
  phi0: Pair
  beta: Pair
  kA: Pair
  kB: Pair
  kMudMult: number
  elastic: number
  linear: LinearMode | null
  /** Tests only, not in the registry: true closes the basinward edge again (the pre-SFM-1 wall that spike 001 had). */
  closedEdge?: boolean
  /** Deep compaction is solved once per this many steps (1 = every step, the default). */
  bundleEvery: number
  /** Layers younger than this (years) are updated every step. */
  bundleAgeYr: number
  /** Subsidence history: fixed rates, McKenzie thermal decay, or user piecewise factors. */
  subsMode: 'constant' | 'thermal' | 'history'
  /** Thermal-decay time constant, yr. */
  subsTau: number
  /** Flat [ageMa, factor, ...] list for subsMode 'history'. */
  subsHistory: number[]
  /** 1 = temperature on. */
  thermal: number
  /** Temperature and cement are updated once per this many steps (and at the last step). */
  thermalEvery: number
  /** Basal heat flow, W/m^2. */
  heatFlow: number
  /** Grain conductivity [sand, mud], W/m/K. */
  kGrain: Pair
  kWater: number
  tSeaDeep: number
  tSeaShallow: number
  tSeaScale: number
  /** 1 = quartz cement on (needs thermal). */
  cement: number
  cemA: number
  cemB: number
  cemTonset: number
  cemGrain: number
  cemSurf: number
  /** Friction angle phi' [sand, mud], degrees (slope stability, M2.1). */
  phiFric: Pair
  /** Cohesion c' [sand, mud], Pa. */
  cohesion: Pair
  /** Slope-stability search depth below the seafloor, m. */
  stabMaxDepth: number
  /** 1 = slope failure on (M2.2). */
  failOn: number
  /** Most contiguous columns in one failure. */
  failMaxCells: number
  /** Most failures per step (scar rechecks). */
  failMaxIters: number
  /** Debris-flow Bingham yield strength, Pa. */
  runYield: number
  /** Debris-flow Bingham viscosity, Pa s. */
  runViscosity: number
  /** Debris-flow bulk density, kg/m^3. */
  runDensity: number
  /** Porosity of mud in a fresh debris deposit. */
  mtdPhiMud: number
  /** Slip surfaces shallower than this (m below the seafloor) are not searched (M2.3). */
  failMinDepth: number
  /** Seafloor slopes below this angle (deg) are not searched for failure (M2.3). */
  failSlopeMin: number
  /** Sea-level fall over the lookback that makes an event a lowstand event, m (M2.3). */
  failLowstandDrop: number
  /** Accumulation rate of the source column above which a pressure-driven event is 'rapid loading', m/yr (M2.3). */
  failRapidRate: number
  /** Slope term (ln units) that scores 1 in the trigger tag (M2.7). */
  failSlopeTerm: number
  /** Pressure term (ln units) that scores 1 in the trigger tag (M2.7). */
  failPressTerm: number
  /** Run-out (m) below which a repeat failure of the same columns in one step is not tried again; 0 = off (M2.7). */
  failStallRunout: number
  /** 1 = mobile salt layer (M3.1). */
  saltOn: number
  /** Initial salt thickness basinward of the pinch-out, m. */
  saltThick: number
  /** Salt pinch-out: none landward of this distance, full thickness basinward of saltPinchEnd, m. */
  saltPinchStart: number
  saltPinchEnd: number
  /** Salt basin basinward limit (M3.10): full thickness landward of saltLimitStart, none basinward of saltLimitEnd, m. Defaults lie beyond any section. */
  saltLimitStart: number
  saltLimitEnd: number
  /** Salt viscosity, Pa s. */
  saltVisc: number
  /** Salt substeps per record step. */
  nSaltSub: number
  /** +- relative thickness variation of the older cover, and its seed. */
  coverUneven: number
  coverSeed: number
  /** Bulk thickness of the pre-run cover over the salt at the start, m (M3.4). Only used when saltOn = 1. */
  coverThick: number
  /** 1 = the older cover resists bending (M3.2); 0 = thin-sheet flow alone (M3.1). Only used when saltOn = 1. */
  coverBend: number
  /** Effective viscosity of the cover as a viscous plate, Pa s (M3.2). */
  coverVisc: number
  /** A column is welded once its salt is thinner than this, m (M3.3). */
  weldThick: number
  /** Salt conductivity at 0 deg C, W/m/K, and the coefficients of its fall with temperature (M3.3). */
  saltK0: number
  saltKa: number
  saltKb: number
}

/** Fresh copy of the registry defaults, typed. */
export function defaultEngineParams(): EngineParams {
  return defaultParams() as unknown as EngineParams
}

/** Deep copy (branches get their own parameter object). */
export function cloneParams(p: EngineParams): EngineParams {
  return JSON.parse(JSON.stringify(p)) as EngineParams
}
