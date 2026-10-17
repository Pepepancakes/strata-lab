// The scenario file (*.strata.json), version 1: what is saved, how it is checked on open.
//
// A file holds the RECIPE of a scenario, not its result: preset, seed, grid, duration, time steps,
// changed parameters, and the branch tree (id, name, parent, start step, parameter edits). Opening
// recomputes the record. That gives the same numbers because the engine is deterministic. To
// prove it, each branch carries the stateHash of its record at the last step; after recomputing,
// the hashes are compared (see compareHashes).
//
// Pure functions, no DOM: unit-tested in tests/scenarioFile.test.ts. All numbers are SI, like the
// engine. Nothing here is physics.

import type { ParamValue } from '../engine/params'
import { PRESETS, type PresetId } from '../engine/presets'
import { compareSummaries, type RunSummary } from '../engine/summary'
import { buildSchedule, type Segment } from '../engine/schedule'
import { getParamDef } from '../engine/params'
import { validateBranchEdits, validateParamValues } from '../worker/edits'
import { validateWell, type WellDefinition } from '../engine/well'
import { APP_VERSION, ENGINE_VERSION } from '../version'

export const SCENARIO_FORMAT = 'strata-lab-scenario'
export const SCENARIO_VERSION = 1
/** A scenario file is a few kB. Anything far bigger is not one. */
export const MAX_FILE_BYTES = 2_000_000

export interface ScenarioBranch {
  /** Id inside the file. A reopened scenario may get other ids; the file's ids only link parents. */
  id: string
  name: string
  /** Parent branch id; null for the main run (exactly one). */
  parent: string | null
  /** Step where the branch leaves its parent (0 for the main run). */
  startStep: number
  /** Parameter edits relative to the parent (SI values). */
  edits: Record<string, ParamValue>
  /** stateHash of the record at the last step. Absent in autosaves. */
  stateHash?: string
  /**
   * Summary statistics of the record at the last step (summary.ts). When the recomputed hash differs
   * (another machine's maths library), these are compared within tolerances before any warning.
   * Absent in autosaves and in files written before D16.4.
   */
  summary?: RunSummary
}

export interface ScenarioFile {
  format: typeof SCENARIO_FORMAT
  version: 1
  /** Which build wrote it (information only). */
  app: { version: string; engine: number }
  run: {
    presetId: PresetId
    seed: number
    grid: { nx: number; dx: number }
    /** Run length, years. */
    durationYr: number
    segments: Segment[]
    /** Changes to the main run's parameters relative to the preset (SI). */
    overrides: Record<string, ParamValue>
  }
  /** The planned well (M4.1), one for all branches. Absent in files written before M4.1: they open unchanged. */
  well?: WellDefinition
  /** Parents come before their children. */
  branches: ScenarioBranch[]
}

/** The pieces of the app state a scenario is built from (a subset of AppState). */
export interface ScenarioSource {
  presetId: PresetId
  seed: number
  nx: number
  dx: number
  segments: readonly Segment[]
  overrides: Record<string, ParamValue>
  branches: readonly { id: string; parentId: string | null; forkStep: number; label: string; edits: Record<string, ParamValue> }[]
  well?: WellDefinition | null
}

function copyValue(v: ParamValue): ParamValue {
  return Array.isArray(v) ? v.slice() : v
}

function copyEdits(e: Record<string, ParamValue>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const k of Object.keys(e).sort()) out[k] = copyValue(e[k]) // sorted: the same scenario gives the same text
  return out
}

/** Build the file contents. `hashes` maps branch id to its final stateHash, `summaries` to its summary (leave both out for an autosave). */
export function buildScenarioFile(src: ScenarioSource, hashes?: Record<string, string>, summaries?: Record<string, RunSummary>): ScenarioFile {
  const segments = src.segments.map((s) => ({ ...s }))
  const lengthMa = segments[0].fromAgeMa - segments[segments.length - 1].toAgeMa
  const file: ScenarioFile = {
    format: SCENARIO_FORMAT,
    version: 1,
    app: { version: APP_VERSION, engine: ENGINE_VERSION },
    run: {
      presetId: src.presetId,
      seed: src.seed,
      grid: { nx: src.nx, dx: src.dx },
      durationYr: Math.round(lengthMa * 1e6),
      segments,
      overrides: copyEdits(src.overrides),
    },
    branches: src.branches.map((b) => {
      const out: ScenarioBranch = { id: b.id, name: b.label, parent: b.parentId, startStep: b.forkStep, edits: copyEdits(b.edits) }
      if (hashes && hashes[b.id]) out.stateHash = hashes[b.id]
      if (hashes && hashes[b.id] && summaries && summaries[b.id]) out.summary = roundSummary(summaries[b.id])
      return out
    }),
  }
  if (src.well) file.well = copyWell(src.well)
  return file
}

function copyWell(w: WellDefinition): WellDefinition {
  return {
    xKm: w.xKm, airGapFt: w.airGapFt, kickoffFt: w.kickoffFt, buildRateDegPer100Ft: w.buildRateDegPer100Ft,
    holdInclinationDeg: w.holdInclinationDeg, direction: w.direction, totalDepthFt: w.totalDepthFt,
  }
}

/** Read the optional well of a file; undefined = no well, a string = the problem. */
function readWell(raw: unknown): WellDefinition | undefined | string {
  if (raw === undefined) return undefined
  const bad = 'The planned well is incomplete or wrong.'
  if (!isObj(raw)) return bad
  const keys = ['xKm', 'airGapFt', 'kickoffFt', 'buildRateDegPer100Ft', 'holdInclinationDeg', 'totalDepthFt'] as const
  for (const k of keys) if (!isNum(raw[k])) return bad
  if (raw.direction !== 'basinward' && raw.direction !== 'landward') return bad
  const w = copyWell(raw as unknown as WellDefinition)
  const problems = validateWell(w)
  return problems.length ? `The planned well: ${problems.join(' ')}` : w
}

export function serializeScenario(file: ScenarioFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

export type ParseResult = { ok: true; file: ScenarioFile } | { ok: false; message: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v)

function readValue(key: string, v: unknown): ParamValue | undefined {
  const def = getParamDef(key)
  if (!def) return undefined
  if (typeof v === 'string') return v
  if (isNum(v)) return v
  if (Array.isArray(v) && v.every(isNum)) return v.slice()
  return undefined
}

function readEdits(where: string, raw: unknown): { edits: Record<string, ParamValue> } | { error: string } {
  if (!isObj(raw)) return { error: `${where}: the parameter changes are missing.` }
  const edits: Record<string, ParamValue> = {}
  for (const k of Object.keys(raw)) {
    if (!getParamDef(k)) return { error: `${where}: unknown parameter "${k}".` }
    const v = readValue(k, raw[k])
    if (v === undefined) return { error: `${where}: the value of "${k}" is not a number, a list of numbers or a choice.` }
    edits[k] = v
  }
  return { edits }
}

const fail = (message: string): ParseResult => ({ ok: false, message: `This is not a usable Strata Lab scenario file. ${message}` })

const SUMMARY_KEYS = ['nx', 'nLayers', 'sand', 'mud', 'meanH', 'maxU', 'events'] as const

function readSummary(raw: unknown): RunSummary | undefined {
  if (!isObj(raw)) return undefined
  for (const k of SUMMARY_KEYS) if (!isNum(raw[k])) return undefined
  return raw as unknown as RunSummary
}

/** Keep 12 significant digits in the file: far finer than any tolerance, and the text stays short. */
function roundSummary(s: RunSummary): RunSummary {
  const r = (x: number): number => Number(x.toPrecision(12))
  return { nx: s.nx, nLayers: s.nLayers, sand: r(s.sand), mud: r(s.mud), meanH: r(s.meanH), maxU: r(s.maxU), events: s.events }
}

/** Read and check the text of a file. Nothing is changed anywhere; the caller decides what to do with the result. */
export function parseScenario(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return fail('It is far larger than a scenario file should be.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('It is not valid JSON, so it may be damaged or a different kind of file.')
  }
  if (!isObj(raw) || raw.format !== SCENARIO_FORMAT) return fail('It does not say it is a Strata Lab scenario.')
  if (raw.version !== SCENARIO_VERSION) {
    return fail(`It is file version ${String(raw.version)}; this app opens version ${SCENARIO_VERSION}. Open it in the app that made it.`)
  }
  const app = raw.app
  if (!isObj(app) || typeof app.version !== 'string' || !isInt(app.engine)) return fail('The app and engine version are missing.')

  const run = raw.run
  if (!isObj(run)) return fail('The run settings are missing.')
  const preset = PRESETS.find((p) => p.id === run.presetId)
  if (!preset) return fail(`The scenario preset "${String(run.presetId)}" is not one this app has.`)
  if (!isInt(run.seed)) return fail('The seed is missing or not a whole number.')
  const grid = run.grid
  if (!isObj(grid) || !isInt(grid.nx) || !isNum(grid.dx) || grid.nx < 2 || grid.dx <= 0) return fail('The grid (columns and column width) is missing or wrong.')
  if (!isNum(run.durationYr) || run.durationYr <= 0) return fail('The duration is missing or wrong.')
  if (!Array.isArray(run.segments) || run.segments.length === 0) return fail('The time steps are missing.')
  const segments: Segment[] = []
  for (const s of run.segments) {
    if (!isObj(s) || !isNum(s.fromAgeMa) || !isNum(s.toAgeMa) || !isNum(s.dt)) return fail('A time-step segment is incomplete.')
    segments.push({ fromAgeMa: s.fromAgeMa, toAgeMa: s.toAgeMa, dt: s.dt })
  }
  let nSteps: number
  try {
    nSteps = buildSchedule(segments).nSteps
  } catch (e) {
    return fail(`The time steps do not make a valid schedule (${e instanceof Error ? e.message : String(e)}).`)
  }
  const lengthYr = Math.round((segments[0].fromAgeMa - segments[segments.length - 1].toAgeMa) * 1e6)
  if (Math.abs(lengthYr - (run.durationYr as number)) > 1) return fail('The duration does not match the time steps.')

  const ov = readEdits('Main run', run.overrides)
  if ('error' in ov) return fail(ov.error)
  if ('duration' in ov.edits) return fail('Main run: the duration comes from the time steps and must not be listed as a parameter change.')
  const ovProblems = validateParamValues(ov.edits, true)
  if (ovProblems.length) return fail(`Main run: ${ovProblems.join(' ')}`)

  if (!Array.isArray(raw.branches) || raw.branches.length === 0) return fail('There are no branches (the main run is missing).')
  const branches: ScenarioBranch[] = []
  const seen = new Set<string>()
  for (const b of raw.branches) {
    if (!isObj(b) || typeof b.id !== 'string' || b.id === '' || typeof b.name !== 'string') return fail('A branch is missing its id or name.')
    const where = `Branch "${b.name}"`
    if (seen.has(b.id)) return fail(`${where}: the id "${b.id}" is used twice.`)
    const parent = b.parent
    if (parent !== null && typeof parent !== 'string') return fail(`${where}: the parent is wrong.`)
    if (!isInt(b.startStep)) return fail(`${where}: the start step is not a whole number.`)
    const e = readEdits(where, b.edits)
    if ('error' in e) return fail(e.error)
    if (b.stateHash !== undefined && (typeof b.stateHash !== 'string' || b.stateHash === '')) return fail(`${where}: the state hash is wrong.`)
    let summary: RunSummary | undefined
    if (b.summary !== undefined) {
      summary = readSummary(b.summary)
      if (!summary) return fail(`${where}: the summary statistics are wrong.`)
    }
    if (branches.length === 0) {
      if (parent !== null || b.startStep !== 0 || Object.keys(e.edits).length) return fail('The first branch must be the main run: no parent, start step 0, no parameter changes.')
    } else {
      if (parent === null) return fail(`${where}: only the main run may have no parent.`)
      if (!seen.has(parent)) return fail(`${where}: its parent "${parent}" is not listed before it.`)
      if (b.startStep < 0 || b.startStep >= nSteps) return fail(`${where}: it starts at step ${b.startStep}, but a branch must start between step 0 and step ${nSteps - 1}.`)
      const problems = validateBranchEdits(e.edits)
      if (problems.length) return fail(`${where}: ${problems.join(' ')}`)
    }
    seen.add(b.id)
    const out: ScenarioBranch = { id: b.id, name: b.name, parent: parent as string | null, startStep: b.startStep, edits: e.edits }
    if (typeof b.stateHash === 'string') out.stateHash = b.stateHash
    if (summary) out.summary = summary
    branches.push(out)
  }

  const well = readWell(raw.well)
  if (typeof well === 'string') return fail(well)

  const result: ScenarioFile = {
    format: SCENARIO_FORMAT,
    version: 1,
    app: { version: app.version as string, engine: app.engine as number },
    run: { presetId: preset.id, seed: run.seed as number, grid: { nx: grid.nx as number, dx: grid.dx as number }, durationYr: run.durationYr as number, segments, overrides: ov.edits },
    branches,
  }
  if (well) result.well = well
  return { ok: true, file: result }
}

export interface HashComparison {
  /** True when every branch matches (exact hash, or hash different but summary statistics within tolerance) and the grid is the same. */
  same: boolean
  /** Names of the branches whose results differ (hash differs and the summary statistics differ or are missing). */
  differing: string[]
  /** Names of the branches whose hash differs but whose summary statistics agree: another machine's maths, not a different engine. No warning. */
  closeOnly: string[]
  /** Shown to John when `same` is false. */
  message: string | null
}

/**
 * Compare the file's hashes with the recomputed ones. `recomputed` is keyed by FILE branch id.
 * Branches without a stored hash (autosave) are skipped. The exact hash is the quick path; when it
 * differs and both sides have summary statistics, those are compared within tolerances
 * (summary.ts, D16.4): the hash differs between operating systems for a harmless reason (last-bit
 * differences in the maths library), the totals do not.
 */
export function compareHashes(
  file: ScenarioFile,
  recomputed: Record<string, string>,
  grid: { nx: number; dx: number },
  summaries?: Record<string, RunSummary>,
): HashComparison {
  const differing: string[] = []
  const closeOnly: string[] = []
  for (const b of file.branches) {
    if (!b.stateHash || recomputed[b.id] === b.stateHash) continue
    const now = summaries?.[b.id]
    if (b.summary && now && compareSummaries(b.summary, now).length === 0) closeOnly.push(b.name)
    else differing.push(b.name)
  }
  const gridSame = grid.nx === file.run.grid.nx && grid.dx === file.run.grid.dx
  const same = differing.length === 0 && gridSame
  if (same) return { same, differing, closeOnly, message: null }
  const which = differing.length ? ` Branches that differ: ${differing.join(', ')}.` : ''
  const made = `${file.app.version}, engine ${file.app.engine}`
  const here = `${APP_VERSION}, engine ${ENGINE_VERSION}`
  return {
    same,
    differing,
    closeOnly,
    message: `This file was made with a different engine version; results differ.${made === here ? '' : ` It was written by app ${made} and this is app ${here}.`}${gridSame ? '' : ' The grid is different too.'}${which}`,
  }
}
