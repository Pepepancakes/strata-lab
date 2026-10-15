// Shared helpers for engine tests: build and run the default scenario.
import { defaultEngineParams, type EngineParams } from '../../src/engine/engineParams'
import { buildSchedule, type Schedule, type Segment } from '../../src/engine/schedule'
import { makeSeaLevel, type SeaLevelCurve } from '../../src/engine/sealevel'
import { getPreset, type PresetId } from '../../src/engine/presets'
import { cellBulk } from '../../src/engine/compaction'
import { createEngine, snapshotEngine, step, type EngineSnapshot } from '../../src/engine/step'
import type { EngineState } from '../../src/engine/state'

/** Sea level for a parameter set and schedule: the registry's seaLevelKind decides (default: published curve). */
export const seaLevelOf = (P: EngineParams, schedule?: Schedule): SeaLevelCurve =>
  makeSeaLevel(P, schedule ? schedule.startAgeMa * 1e6 : P.duration)

export interface Run {
  P: EngineParams
  schedule: Schedule
  eng: EngineState
  snaps: Map<number, EngineSnapshot>
  ms: number
  /** Farthest basinward shoreline over the run, km (centre of the first submerged column). */
  maxShoreKm: number
  /** Farthest basinward shelf edge over the run, km (centre of the column), or 0 if none was found. */
  maxEdgeKm: number
}

/** Run a whole schedule, keeping snapshots at the given step numbers. `overrides` changes parameters (e.g. seaLevelKind: 'sine'). */
export function runFull(segments?: readonly Segment[], snapAt: number[] = [], overrides: Partial<EngineParams> = {}): Run {
  const P = { ...defaultEngineParams(), ...overrides }
  const schedule = buildSchedule(segments)
  const eng = createEngine(P, schedule)
  const sl = seaLevelOf(P, schedule)
  const snaps = new Map<number, EngineSnapshot>()
  const want = new Set(snapAt)
  let maxShoreKm = 0
  let maxEdgeKm = 0
  const t0 = performance.now()
  while (step(eng, P, schedule, sl)) {
    if (want.has(eng.diag.stepIndex)) snaps.set(eng.diag.stepIndex, snapshotEngine(eng))
    if (eng.diag.shore >= 0) maxShoreKm = Math.max(maxShoreKm, ((eng.diag.shore + 0.5) * P.dx) / 1000)
    if (eng.diag.shelfEdge >= 0) maxEdgeKm = Math.max(maxEdgeKm, ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000)
  }
  return { P, schedule, eng, snaps, ms: performance.now() - t0, maxShoreKm, maxEdgeKm }
}

/** Run one of the standard presets (presets.ts). `overrides` changes parameters, e.g. bundleEvery: 1 for the unbundled twin. */
export function runPreset(id: PresetId, snapAt: number[] = [], overrides: Partial<EngineParams> = {}): Run {
  const preset = getPreset(id)
  return runFull(preset.segments, snapAt, { ...preset.params, ...overrides })
}

/**
 * Basin-floor sand share at the end of a run: solid sand in deposited layers (not the substrate)
 * in columns whose centre is basinward of the slope toe, as a share of all solid sand stored in
 * those layers. The toe is the foot of the slope in the initial profile (65 km), a fixed
 * geometric choice so every run is measured the same way. (Spike 001's tune.js used 80 km and
 * divided by sand + mud; both are reported in the M1.4 handoff.)
 */
export function basinFloorSandShare(eng: EngineState, dx: number, toeKm = 65): number {
  const { rec } = eng
  let basin = 0
  let all = 0
  for (let l = 1; l < rec.nLayers; l++) {
    for (let j = 0; j < rec.nx; j++) {
      const s = rec.sand[l * rec.nx + j]
      all += s
      if (((j + 0.5) * dx) / 1000 >= toeKm) basin += s
    }
  }
  return basin / all
}

/**
 * Pseudo-well porosity log: porosity (1 - solids/bulk) in depth bins below the surface of column j.
 * A layer straddling a bin edge is split by thickness. Bins the column does not fill completely are
 * NaN. (Compared by DEPTH, not by layer number: layers thin out or vanish differently in two runs
 * whose surfaces differ by a metre, but the porosity-depth curve is what a well would show.)
 */
export function wellPorosity(eng: EngineState, P: EngineParams, j: number, binM = 100, nBins = 30): number[] {
  const { rec } = eng
  const solid = new Array<number>(nBins).fill(0)
  const bulk = new Array<number>(nBins).fill(0)
  let z = 0 // depth of the top of the cell being read
  for (let l = rec.nLayers - 1; l >= 0 && z < binM * nBins; l--) {
    const i = l * rec.nx + j
    const b = cellBulk(eng, P, i)
    if (b <= 0) continue
    const s = rec.sand[i] + rec.mud[i] + rec.cem[i] // cement fills pores: it counts as solid for total porosity
    const z1 = z + b
    for (let k = Math.floor(z / binM); k < nBins && k * binM < z1; k++) {
      const frac = (Math.min(z1, (k + 1) * binM) - Math.max(z, k * binM)) / b
      bulk[k] += frac * b
      solid[k] += frac * s
    }
    z = z1
  }
  return bulk.map((b, k) => (b >= binM * 0.999 ? 1 - solid[k] / b : NaN))
}

/** Largest excess pore pressure anywhere in the record, Pa. */
export function maxExcessPressure(eng: EngineState): number {
  const { rec } = eng
  let m = 0
  const n = rec.nLayers * rec.nx
  for (let i = 0; i < n; i++) if (rec.u[i] > m) m = rec.u[i]
  return m
}

/** Differences between two runs of the same schedule: max |dH|, max porosity difference over the pseudo-wells, relative max-u difference. */
export function compareRuns(a: Run, b: Run, wells: number[]): { dH: number; dPhi: number; dU: number } {
  let dH = 0
  for (let j = 0; j < a.P.nx; j++) dH = Math.max(dH, Math.abs(a.eng.rec.H[j] - b.eng.rec.H[j]))
  let dPhi = 0
  for (const j of wells) {
    const pa = wellPorosity(a.eng, a.P, j)
    const pb = wellPorosity(b.eng, b.P, j)
    for (let l = 0; l < pa.length; l++) if (!Number.isNaN(pa[l]) && !Number.isNaN(pb[l])) dPhi = Math.max(dPhi, Math.abs(pa[l] - pb[l]))
  }
  const ua = maxExcessPressure(a.eng)
  const ub = maxExcessPressure(b.eng)
  return { dH, dPhi, dU: Math.abs(ua - ub) / ua }
}

/**
 * Schedule for tests on the MTD-prone preset: the preset's own 5 kyr steps. Tests used to run it at
 * 25 kyr to save time, but there it makes only about 2 events (0 to 4 when libm results change by
 * one ulp, as they do between Windows and Linux), so "the preset makes events" failed on the Linux
 * CI runner. At 5 kyr it makes 24 events (24 to 34 under the same ulp noise, never 0). See D16.4.
 */
export const MTD_SEGMENTS = getPreset('mtd').segments
