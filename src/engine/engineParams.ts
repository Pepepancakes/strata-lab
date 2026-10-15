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
}

/** Fresh copy of the registry defaults, typed. */
export function defaultEngineParams(): EngineParams {
  return defaultParams() as unknown as EngineParams
}

/** Deep copy (branches get their own parameter object). */
export function cloneParams(p: EngineParams): EngineParams {
  return JSON.parse(JSON.stringify(p)) as EngineParams
}
