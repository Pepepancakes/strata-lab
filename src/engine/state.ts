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
    diag: { stepIndex: 0, deficit: 0, clamps: 0, short: 0, shore: -1, shelfEdge: -1, tcShare: 0 },
  }
}
