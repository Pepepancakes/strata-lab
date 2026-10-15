// Shared helpers for engine tests: build and run the default scenario.
import { defaultEngineParams, type EngineParams } from '../../src/engine/engineParams'
import { buildSchedule, type Schedule, type Segment } from '../../src/engine/schedule'
import { makeSeaLevel, type SeaLevelCurve } from '../../src/engine/sealevel'
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
  const t0 = performance.now()
  while (step(eng, P, schedule, sl)) {
    if (want.has(eng.diag.stepIndex)) snaps.set(eng.diag.stepIndex, snapshotEngine(eng))
    if (eng.diag.shore >= 0) maxShoreKm = Math.max(maxShoreKm, ((eng.diag.shore + 0.5) * P.dx) / 1000)
  }
  return { P, schedule, eng, snaps, ms: performance.now() - t0, maxShoreKm }
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
