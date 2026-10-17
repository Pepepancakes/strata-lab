// Message protocol between the app and the engine worker (typed; typed arrays are TRANSFERRED).
//
// Vocabulary
//   step      number of record steps completed: 0 = the substrate only, nSteps = the end of the run.
//   branch    one timeline. 'b1' is the main run; later ids come from branch(). A branch shares its
//             parent's history up to its start step.
//   view      a copy of the stored record at one step, ready to draw (StateView). The views do not
//             hold geology of their own: everything in them is read from the layer record.
// All numbers in views are SI (m, Pa). Conversion to ft / ppg / km belongs to src/units.ts.

import type { CrestLog } from '../engine/crestLog'
import type { EngineParams } from '../engine/engineParams'
import type { ParamValue } from '../engine/params'
import type { PresetId } from '../engine/presets'
import type { Ledger, RecordBalance } from '../engine/record'
import type { Segment } from '../engine/schedule'
import type { RunSummary } from '../engine/summary'
import type { FailureEvent } from '../engine/state'
import type { ScenarioFile } from '../app/scenarioFile'
import type { WellDefinition, WellSamples } from '../engine/well'

/** What to run. `segments` replaces the preset's time steps (used by tests and later by the UI). */
export interface RunSpec {
  presetId: PresetId
  /** Registry parameters changed from the preset. All keys allowed here: this is a new run. */
  overrides?: Partial<EngineParams>
  segments?: readonly Segment[]
}

/** Columns of a StateView that are large (nLayers x nx) and optional. `thick` is bulk thickness, m. */
export type ViewField = 'thick' | 'sand' | 'mud' | 'smax' | 'u' | 'cem' | 'lam' | 'temp' | 'fs'
export const DEFAULT_VIEW_FIELDS: readonly ViewField[] = ['thick', 'sand', 'mud', 'u']

export interface StateView {
  branchId: string
  step: number
  nSteps: number
  /** Age at the end of this step, Ma. */
  ageMa: number
  /** Years since the run started. */
  elapsedYr: number
  /** Sea level at this step, m (the branch's own curve). */
  seaLevelM: number
  nx: number
  dx: number
  /** step + 1 (layer 0 is the substrate). */
  nLayers: number
  /** Basement and surface elevation per column, m. */
  b: Float64Array
  H: Float64Array
  /** Cell arrays, index = layer * nx + column. Only the requested fields are present. */
  thick?: Float64Array
  sand?: Float64Array
  mud?: Float64Array
  smax?: Float64Array
  u?: Float64Array
  cem?: Float64Array
  /** Derived (not stored): overpressure ratio lambda* = u / buoyant load, 0..1. Needs the field 'lam'. */
  lam?: Float64Array
  /** Derived (not stored): temperature at the middle of each cell, deg C. Needs the field 'temp'. */
  temp?: Float64Array
  /** Derived (not stored): infinite-slope factor of safety of each cell (Infinity where the column is flat). Needs the field 'fs'. */
  fsCell?: Float64Array
  /** Derived, with 'fs': lowest factor of safety per column, its depth below the seafloor (m), and the layer it is in (-1 = none). */
  fsMin?: Float64Array
  fsDepth?: Float64Array
  fsLayer?: Int32Array
  material: Uint8Array
  /** Age at the end of each layer's step, Ma (layer 0 = start of the run). */
  layerAgeMa: Float64Array
  balance: RecordBalance
  /** Running totals behind `balance`: supplied (cumIn), exported (cumOut), and the amount at the start. m^2. */
  ledger: Ledger
  /** Column index of the shoreline / shelf edge after the last step (-1 = none). */
  shore: number
  shelfEdge: number
  /** Pre-run layers: 1 (substrate) or 2 with salt (layer 0 salt, layer 1 older cover) (M3.5). */
  nPre?: number
  /** Salt welds (M3.5): age (Ma) of each column's first weld, -1 = never (state.ts WELD_NONE), and the thickness below which a column counts as welded, m. */
  weldAge?: Float64Array
  weldThick?: number
  /** Present only when asked for (it costs a pass over the whole record). */
  hash?: string
}

export interface BranchInfo {
  id: string
  parentId: string | null
  /** Step where this branch left its parent (0 for the main run). */
  forkStep: number
  forkAgeMa: number
  label: string
  /** Parameter edits relative to the parent. */
  edits: Record<string, ParamValue>
  keyframes: number
  /** Bytes of saved states this branch points to (what it would cost alone). */
  reachableBytes: number
  /** Bytes only this branch points to (freed if it is deleted). */
  ownBytes: number
}

/** Per-step facts about the run for axes and charts. */
export interface RunInfo {
  rootId: string
  presetId: PresetId
  seed: number
  nSteps: number
  nx: number
  dx: number
  startAgeMa: number
  runLengthMa: number
  /** Age at the end of step k (index k), Ma. */
  stepAgeMa: Float64Array
  stepDtYr: Float64Array
  /** Sea level at the end of step k for the main run, m. */
  seaLevelM: Float64Array
  keyframeEvery: number
  /** Most branches allowed at once. */
  maxBranches: number
}

export interface ViewDiff {
  /** B minus A surface elevation, m. */
  dH: Float64Array
  /** B minus A bulk thickness per cell, m (only if both views have `thick`). */
  dThick?: Float64Array
  maxAbsDH: number
  maxAbsDThick: number
  /** True when every number in the two views is bit-identical. */
  identical: boolean
}

export interface CheckResult {
  id: string
  label: string
  pass: boolean
  /** The measured number and the limit it is judged against, in `unit`. */
  value: number
  limit: number
  unit: string
  /** One plain sentence: what was compared with what. */
  detail: string
  /** Where the benchmark comes from (a citation, or the project rule it enforces). */
  cite: string
}

/** One column of the record at one step, for the pseudo-well. Arrays are per layer, index 0 = substrate. SI. */
export interface WellColumn {
  branchId: string
  step: number
  ageMa: number
  column: number
  /** Distance of the column centre from the landward edge, m. */
  xM: number
  seaLevelM: number
  /** Basement and surface elevation, m. */
  b: number
  H: number
  nLayers: number
  thick: Float64Array
  sand: Float64Array
  mud: Float64Array
  /** Excess pore pressure, Pa. */
  u: Float64Array
  /** Temperature at the middle of each cell, deg C. */
  temp: Float64Array
  material: Uint8Array
  /** Temperature where quartz cementation starts (cemTonset), deg C. */
  cemTonsetC: number
  cementOn: boolean
  /** Salt (M3.5): age (Ma) of the first weld of this column (null = never) and the weld thickness, m. */
  weldAge?: number | null
  weldThick?: number
}

export interface CurveCreditInfo {
  name: string
  /** Full citations that apply. */
  citations: string[]
}

/** Per-step series of one branch for the charts. Index k = the end of step k. */
export interface SeriesData {
  branchId: string
  ageMa: Float64Array
  seaLevelM: Float64Array
  /** Subsidence rate at the landward / basinward edge, m/Myr (the time history applied). */
  subsShelfMPerMyr: Float64Array
  subsBasinMPerMyr: Float64Array
  /** Index into `credits` of the sea-level record used at each step. */
  creditIdx: Uint8Array
  credits: CurveCreditInfo[]
}

export type EngineRequest =
  | { id: number; kind: 'ping'; payload: string }
  | { id: number; kind: 'sum'; values: Float64Array }
  | { id: number; kind: 'run'; spec: RunSpec; seed: number }
  | { id: number; kind: 'seek'; branchId: string; step: number; fields?: readonly ViewField[]; withHash?: boolean }
  | { id: number; kind: 'branch'; parentId: string; step: number; edits: Record<string, ParamValue>; label?: string }
  | { id: number; kind: 'deleteBranch'; branchId: string }
  | { id: number; kind: 'compare'; a: string; b: string; step: number; fields?: readonly ViewField[] }
  | { id: number; kind: 'branches' }
  | { id: number; kind: 'runChecks' }
  | { id: number; kind: 'well'; branchId: string; step: number; column: number }
  /** The planned well sampled from the record at one step (M4.1). */
  | { id: number; kind: 'sampleWell'; branchId: string; step: number; well: WellDefinition }
  | { id: number; kind: 'series'; branchId: string }
  /** Per-crest rise-to-accumulation log of the main run (M3b.1). */
  | { id: number; kind: 'crestLog'; branchId: string }
  /** The slope failures of a branch over the whole run, oldest first (M2.4). */
  | { id: number; kind: 'events'; branchId: string }
  /** stateHash of every branch at its last step, by branch id (for saving a scenario file). */
  | { id: number; kind: 'hashes' }
  /** Rebuild a checked scenario file: run, branches, then hashes. Replaces the current run. */
  | { id: number; kind: 'openScenario'; file: ScenarioFile }

export type EngineResponse =
  | { id: number; kind: 'pong'; payload: string }
  | { id: number; kind: 'sum'; total: number }
  | { id: number; kind: 'error'; message: string }
  /** Not final: the request is still running. */
  | { id: number; kind: 'progress'; branchId: string; step: number; nSteps: number }
  | { id: number; kind: 'runDone'; info: RunInfo; branches: BranchInfo[]; ms: number }
  | { id: number; kind: 'view'; view: StateView; ms: number }
  | { id: number; kind: 'branched'; branch: BranchInfo; branches: BranchInfo[]; ms: number }
  | { id: number; kind: 'deleted'; branchId: string; freedBytes: number; branches: BranchInfo[] }
  | { id: number; kind: 'compared'; a: StateView; b: StateView; diff: ViewDiff; ms: number }
  | { id: number; kind: 'branchList'; branches: BranchInfo[]; liveBytes: number }
  | { id: number; kind: 'checks'; results: CheckResult[]; allPass: boolean; ms: number }
  | { id: number; kind: 'wellColumn'; well: WellColumn; ms: number }
  | { id: number; kind: 'wellSamples'; samples: WellSamples; ms: number }
  | { id: number; kind: 'seriesData'; series: SeriesData; ms: number }
  | { id: number; kind: 'crestLogData'; log: CrestLog; ms: number }
  | { id: number; kind: 'eventList'; branchId: string; events: FailureEvent[]; ms: number }
  | { id: number; kind: 'hashList'; hashes: Record<string, string>; summaries: Record<string, RunSummary>; ms: number }
  | { id: number; kind: 'scenarioOpened'; info: RunInfo; branches: BranchInfo[]; idMap: Record<string, string>; hashes: Record<string, string>; summaries: Record<string, RunSummary>; ms: number }

/** The buffers of a response that should be transferred, not cloned. */
export function transferListOf(resp: EngineResponse): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  const add = (o: object) => {
    for (const v of Object.values(o)) {
      if (ArrayBuffer.isView(v) && v.buffer instanceof ArrayBuffer && !out.includes(v.buffer)) out.push(v.buffer)
    }
  }
  if (resp.kind === 'view') add(resp.view)
  else if (resp.kind === 'compared') {
    add(resp.a)
    add(resp.b)
    add(resp.diff)
  } else if (resp.kind === 'runDone' || resp.kind === 'scenarioOpened') add(resp.info)
  else if (resp.kind === 'wellColumn') add(resp.well)
  else if (resp.kind === 'wellSamples') add(resp.samples)
  else if (resp.kind === 'seriesData') add(resp.series)
  return out
}
