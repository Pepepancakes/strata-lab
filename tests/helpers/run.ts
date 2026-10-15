// Shared helpers for engine tests: build and run the default scenario.
import { defaultEngineParams, type EngineParams } from '../../src/engine/engineParams'
import { buildSchedule, type Schedule, type Segment } from '../../src/engine/schedule'
import { sineSeaLevel, type SeaLevelCurve } from '../../src/engine/sealevel'
import { createEngine, snapshotEngine, step, type EngineSnapshot } from '../../src/engine/step'
import type { EngineState } from '../../src/engine/state'

export const seaLevelOf = (P: EngineParams): SeaLevelCurve => sineSeaLevel(P)

export interface Run {
  P: EngineParams
  schedule: Schedule
  eng: EngineState
  snaps: Map<number, EngineSnapshot>
  ms: number
}

/** Run a whole schedule, keeping snapshots at the given step numbers. */
export function runFull(segments?: readonly Segment[], snapAt: number[] = []): Run {
  const P = defaultEngineParams()
  const schedule = buildSchedule(segments)
  const eng = createEngine(P, schedule)
  const sl = seaLevelOf(P)
  const snaps = new Map<number, EngineSnapshot>()
  const want = new Set(snapAt)
  const t0 = performance.now()
  while (step(eng, P, schedule, sl)) {
    if (want.has(eng.diag.stepIndex)) snaps.set(eng.diag.stepIndex, snapshotEngine(eng))
  }
  return { P, schedule, eng, snaps, ms: performance.now() - t0 }
}
