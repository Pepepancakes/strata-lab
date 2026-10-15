// Engine state: the layer record (the only stored geology) plus things that are DERIVED from
// it or only needed while stepping:
//   - cached porosity / permeability per cell (phs, phm, kps, kpm), functions of smax
//   - ld: the buoyant load each cell carried at the end of the last compaction (a function of
//     the stored thicknesses)
//   - scratch arrays, so a step allocates nothing
//   - diagnostics (counters that do not affect the geology)
// None of this is hashed; restore() rebuilds it from the record (see step.ts), which is what
// makes rewind bit-identical.

import type { LayerRecord } from './record'
import { createHistory, type TriggerCause, type TriggerHistory } from './triggers'

export interface Scratch {
  F: Float64Array
  aS: Float64Array
  aT: Float64Array
  Qf: Float64Array
  iSs: Float64Array
  iMs: Float64Array
  order: number[]
  Ke: Float64Array
  Ks: Float64Array
  Km: Float64Array
  Hn: Float64Array
  cp: Float64Array
  dp: Float64Array
  idx: Int32Array
  L: Float64Array
  A: Float64Array
  hh: Float64Array
  kk: Float64Array
  T: Float64Array
  lo: Float64Array
  di: Float64Array
  up: Float64Array
  rhs: Float64Array
  x: Float64Array
}

export interface Diagnostics {
  /** Index into the schedule of the next step to run. */
  stepIndex: number
  /** Erosion that found nothing left to remove, m^2 (should stay 0). */
  deficit: number
  /** Pore pressures clipped to the load. */
  clamps: number
  /** Scratch: shortfall of the last erode() call, solid m. */
  short: number
  shore: number
  shelfEdge: number
  tcShare: number
  /** Failures that were still unstable after failMaxIters rechecks (M2.2). */
  failUnresolved: number
  /** 1 when the record may hold a cell tagged MTD (set when a deposit tags one, cleared when a scan finds none). Lets the failure step skip the full-record scan (M2.10). Copied with diag in snapshots and keyframes. */
  mtdPresent: number
}

/**
 * One slope failure and its debris deposit (M2.2). Plain numbers only, so copying the list for a
 * snapshot or keyframe is cheap and exact. Volumes are m^2 (= m^3 per metre of section); solids
 * are without pores. The deposit sits in layer `layer` (the layer of the step that failed).
 */
export interface FailureEvent {
  /** 1, 2, 3 ... in the order the failures happened. */
  id: number
  /** Index of the record step during which it happened. */
  step: number
  /** Elapsed years at the end of that step (= tDep of the deposit). */
  tYr: number
  ageMa: number
  /** First and last source column (inclusive). */
  sourceFrom: number
  sourceTo: number
  /** Deepest cut below the seafloor, m (bulk thickness). */
  scarDepth: number
  /** In-place bulk area that was removed, m^2. */
  volume: number
  /** Solids released, m^2. */
  sand: number
  mud: number
  /** Quartz cement lost with the debris (own ledger line), m^2. */
  cement: number
  /** Solids that ran off the basinward edge (counted as exported), m^2. */
  exportedSand: number
  exportedMud: number
  /** Solids that stayed in the section as the deposit, m^2 (released = deposited + exported). */
  depositedSand: number
  depositedMud: number
  /** Distance the front travelled, m. */
  runout: number
  /** Flow time, s. */
  flowTime: number
  /** Layer holding the deposit and its first and last column (-1 when nothing stayed in the section). */
  layer: number
  depositFrom: number
  depositTo: number
  /** Dominant trigger (triggers.ts). Always set. */
  cause: TriggerCause
  /** Contributions to the drop of ln FS over the lookback, from the slope and from the pore pressure. */
  dSlope: number
  dPress: number
  /** Sea-level change over the lookback, m (negative = fall). */
  dSeaLevel: number
  /** Bulk sediment gained by the weakest source column over the lookback, m/yr. */
  loadRate: number
  /** The weakest source column (lowest FS) the tag was worked out for. */
  seedColumn: number
  /** The failure moved less than failStallRunout and its columns were not failed again in this step (M2.7). */
  stalled: boolean
  /** The scar reached within 5 % of the stability search window (stabMaxDepth): the true failure may be deeper (M2.7). */
  windowLimited: boolean
}

export interface EngineState {
  rec: LayerRecord
  phs: Float64Array
  phm: Float64Array
  kps: Float64Array
  kpm: Float64Array
  ld: Float64Array
  scratch: Scratch
  diag: Diagnostics
  /** True when bundled deep compaction is on: cached loads of deep layers lag, so snapshots must store them. */
  lagLoads: boolean
  /** Temperature at the middle of each cell, deg C (M1.4c). Derived, never stored in the record. */
  temp: Float64Array
  /** True when `temp` matches the record. False at creation and after a restore; step() rebuilds it. */
  tempOk: boolean
  /** Slope failures so far, oldest first (M2.2). Snapshots and keyframes keep and restore it. */
  events: FailureEvent[]
  /** End-of-step slope and pressure of the last few steps, for trigger attribution (M2.3). Kept only when failOn = 1. */
  hist: TriggerHistory
}

function makeScratch(nx: number, nLayers: number): Scratch {
  const n = Math.max(nx, nLayers)
  const f = () => new Float64Array(n)
  return {
    F: f(), aS: f(), aT: f(), Qf: f(), iSs: f(), iMs: f(), order: new Array<number>(nx), Ke: f(), Ks: f(), Km: f(),
    Hn: f(), cp: f(), dp: f(), idx: new Int32Array(nLayers), L: f(), A: f(), hh: f(), kk: f(), T: f(),
    lo: f(), di: f(), up: f(), rhs: f(), x: f(),
  }
}

/** Wrap a record with empty caches. Call rebuildCaches (compaction.ts) before stepping. */
export function allocateEngine(rec: LayerRecord): EngineState {
  const cells = rec.nx * rec.capacity
  return {
    rec,
    phs: new Float64Array(cells),
    phm: new Float64Array(cells),
    kps: new Float64Array(cells),
    kpm: new Float64Array(cells),
    ld: new Float64Array(cells),
    scratch: makeScratch(rec.nx, rec.capacity),
    diag: { stepIndex: 0, deficit: 0, clamps: 0, short: 0, shore: -1, shelfEdge: -1, tcShare: 0, failUnresolved: 0, mtdPresent: 0 },
    lagLoads: false,
    temp: new Float64Array(cells),
    tempOk: false,
    events: [],
    hist: createHistory(rec.nx),
  }
}
