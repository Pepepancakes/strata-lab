// Rebuilds a scenario file's runs on a time machine: the main run, then each branch in file order.
// Used by the worker (request 'openScenario') and by the tests, so the same code is tested.
import type { EngineParams } from '../engine/engineParams'
import type { ScenarioFile } from '../app/scenarioFile'
import type { BranchInfo, RunInfo } from './protocol'
import type { ProgressFn, TimeMachine } from './timeMachine'

export interface ReplayResult {
  info: RunInfo
  branches: BranchInfo[]
  /** File branch id -> id in this time machine. */
  idMap: Record<string, string>
  /** Recomputed stateHash at the last step, by FILE branch id. */
  hashes: Record<string, string>
}

export function replayScenario(tm: TimeMachine, file: ScenarioFile, onProgress?: ProgressFn): ReplayResult {
  const run = file.run
  const overrides = { ...run.overrides, duration: run.durationYr } as Partial<EngineParams>
  const info = tm.run({ presetId: run.presetId, overrides, segments: run.segments }, run.seed, onProgress)
  const idMap: Record<string, string> = { [file.branches[0].id]: info.rootId }
  for (const b of file.branches.slice(1)) {
    const made = tm.branch(idMap[b.parent as string], b.startStep, b.edits, b.name, onProgress)
    idMap[b.id] = made.id
  }
  const hashes: Record<string, string> = {}
  for (const b of file.branches) hashes[b.id] = tm.hashAt(idMap[b.id], info.nSteps)
  return { info, branches: tm.list(), idMap, hashes }
}
