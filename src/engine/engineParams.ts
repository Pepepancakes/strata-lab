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
}

/** Fresh copy of the registry defaults, typed. */
export function defaultEngineParams(): EngineParams {
  return defaultParams() as unknown as EngineParams
}

/** Deep copy (branches get their own parameter object). */
export function cloneParams(p: EngineParams): EngineParams {
  return JSON.parse(JSON.stringify(p)) as EngineParams
}
