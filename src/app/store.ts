// The app's one shared state: what is being run, where in time we are, what to draw.
//
// Views read it with useAppState() and call the actions on `store`. All geology comes from the
// engine worker (src/worker); this file only asks for it and keeps the latest answers.
//
// Requests to the worker are served one at a time. The "pump" below coalesces them: if the user
// drags the slider faster than the worker answers, only the latest wanted state is fetched.

import { useSyncExternalStore } from 'react'
import { cloneParams, type EngineParams } from '../engine/engineParams'
import type { ParamValue } from '../engine/params'
import { getPreset, presetParams, type PresetId } from '../engine/presets'
import type { Segment } from '../engine/schedule'
import { validateBranchEdits } from '../worker/edits'
import { EngineClient } from '../worker/client'
import type {
  BranchInfo, CheckResult, EngineResponse, RunInfo, SeriesData, StateView, ViewField, WellColumn,
} from '../worker/protocol'
import { clipSegments, lengthOf } from './scenario'
import { Autosave, browserStorage, type KeyValueStorage } from './autosave'
import { ReplaceGuard, type PendingReplace } from './replaceGuard'
import { buildScenarioFile, compareHashes, parseScenario, serializeScenario, type ScenarioFile } from './scenarioFile'

export type ColorMode = 'grain' | 'age' | 'phi' | 'op' | 'temp'

/** Vertical range of the section drawing, m. Only grows during a run, so playing does not rescale. */
export interface Extent {
  zTop: number
  zBot: number
}

export interface DiffSummary {
  maxAbsDH: number
  maxAbsDThick: number
  identical: boolean
}

export interface ChecksState {
  running: boolean
  results: CheckResult[] | null
  allPass: boolean
  ms: number
}

/** The part of EngineClient the store uses (tests give it a fake that calls the engine directly). */
export interface ClientLike {
  request: (req: Parameters<EngineClient['request']>[0], onProgress?: Parameters<EngineClient['request']>[1]) => Promise<EngineResponse>
}

/** Things the store needs from the outside world; each has a browser default. */
export interface StoreDeps {
  client?: ClientLike
  /** Where the autosave goes; null = nowhere (storage blocked). Default: localStorage. */
  storage?: KeyValueStorage | null
  /** Hand a finished file to John (browser: a download). */
  download?: (filename: string, text: string) => void
  /** Clock for file names. */
  now?: () => Date
}

export interface AppState {
  ready: boolean
  busy: { label: string; frac: number } | null
  error: string | null
  /** A warning that is not an error (e.g. a file made by another engine version). */
  notice: string | null
  /** Work that is not saved to a file. */
  dirty: boolean
  /** Set while the app waits for John to confirm replacing unsaved work. */
  pendingReplace: PendingReplace | null
  /** Why the browser autosave is not working, if it is not. */
  autosaveProblem: string | null
  seed: number
  presetId: PresetId
  /** Run length in Myr (a preset's own length, or shorter). */
  runLengthMa: number
  /** Changes to the main run's parameters, relative to the preset (SI). */
  overrides: Record<string, ParamValue>
  segments: Segment[]
  info: RunInfo | null
  branches: BranchInfo[]
  /** Parameters in force in every branch (SI), by branch id. */
  params: Record<string, EngineParams>
  activeId: string
  compareId: string | null
  step: number
  mode: ColorMode
  wellCol: number
  view: StateView | null
  viewB: StateView | null
  diff: DiffSummary | null
  well: WellColumn | null
  series: SeriesData | null
  extent: Extent | null
  playing: boolean
  fps: number
  stepsPerFrame: number
  perf: { runMs: number; jumpMs: number; drawMs: number }
  checks: ChecksState
}

const SEED = 1
const downloadInBrowser = (filename: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const initial = (): AppState => ({
  ready: false,
  busy: null,
  error: null,
  notice: null,
  dirty: false,
  pendingReplace: null,
  autosaveProblem: null,
  seed: SEED,
  presetId: 'last3',
  runLengthMa: getPreset('last3').runLengthMa,
  overrides: {},
  segments: getPreset('last3').segments.map((s) => ({ ...s })),
  info: null,
  branches: [],
  params: {},
  activeId: '',
  compareId: null,
  step: 0,
  mode: 'grain',
  wellCol: -1,
  view: null,
  viewB: null,
  diff: null,
  well: null,
  series: null,
  extent: null,
  playing: false,
  fps: 10,
  stepsPerFrame: 2,
  perf: { runMs: 0, jumpMs: 0, drawMs: 0 },
  checks: { running: false, results: null, allPass: false, ms: 0 },
})

/** Fields of the section view each colour mode needs (the worker only sends what is asked for). */
export function fieldsForMode(mode: ColorMode): ViewField[] {
  if (mode === 'op') return ['thick', 'sand', 'mud', 'lam']
  if (mode === 'temp') return ['thick', 'sand', 'mud', 'temp']
  return ['thick', 'sand', 'mud']
}

/** Vertical range that holds a view: surface highest, basement lowest, with the spike's margins. */
export function extentOf(v: StateView): Extent {
  let zb = Infinity
  let zt = -Infinity
  for (let j = 0; j < v.nx; j++) {
    zb = Math.min(zb, v.b[j])
    zt = Math.max(zt, v.H[j])
  }
  return { zTop: Math.max(zt, 40) + 40, zBot: zb - 30 }
}

function growExtent(a: Extent | null, b: Extent): Extent {
  return a ? { zTop: Math.max(a.zTop, b.zTop), zBot: Math.min(a.zBot, b.zBot) } : b
}

type Listener = () => void

export class AppStore {
  private state: AppState = initial()
  private listeners = new Set<Listener>()
  private client: ClientLike | null = null
  private autosave: Autosave
  private guard: ReplaceGuard
  private initStarted = false

  constructor(private deps: StoreDeps = {}) {
    this.client = deps.client ?? null
    this.autosave = new Autosave(deps.storage === undefined ? browserStorage() : deps.storage)
    this.autosave.onWrite = () => {
      const problem = this.autosave.lastError
      if (problem !== this.state.autosaveProblem) this.set({ autosaveProblem: problem })
    }
    this.guard = new ReplaceGuard(() => this.set({ dirty: this.guard.isDirty, pendingReplace: this.guard.pending }))
  }
  private pumping = false
  private dirty = { view: false, series: false }
  private playHandle = 0
  private lastFrame = 0

  // ---- store plumbing ------------------------------------------------------------------------

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getState = (): AppState => this.state

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l()
  }

  fail(message: string): void {
    this.set({ error: message, busy: null })
  }

  clearError(): void {
    this.set({ error: null })
  }

  clearNotice(): void {
    this.set({ notice: null })
  }

  private async ask(
    req: Parameters<EngineClient['request']>[0],
    onProgress?: Parameters<EngineClient['request']>[1],
  ): Promise<EngineResponse | null> {
    if (!this.client) this.client = new EngineClient()
    try {
      const r = await this.client.request(req, onProgress)
      if (r.kind === 'error') {
        this.fail(r.message)
        return null
      }
      return r
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  // ---- starting a run -----------------------------------------------------------------------

  /** First run of the page: the autosaved scenario if there is one, otherwise the default. */
  init(): void {
    if (this.initStarted || this.state.ready || this.state.busy) return
    this.initStarted = true
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flushAutosave())
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushAutosave()
      })
    }
    const restored = this.autosave.load()
    if (restored) void this.applyFile(restored.file, restored.dirty, 'Restoring your last session')
    else void this.startRun({ clean: true })
  }

  /** Run again from the start with the current preset, run length and overrides. Drops all branches. */
  async startRun(opts: { clean?: boolean } = {}): Promise<void> {
    const s0 = this.state
    this.pause()
    this.set({ busy: { label: 'Running the model', frac: 0 }, error: null })
    const overrides = { ...s0.overrides, duration: Math.round(lengthOf(s0.segments) * 1e6) } as Partial<EngineParams>
    const t0 = performance.now()
    const r = await this.ask(
      { kind: 'run', spec: { presetId: s0.presetId, overrides, segments: s0.segments }, seed: s0.seed },
      (p) => this.set({ busy: { label: 'Running the model', frac: p.step / p.nSteps } }),
    )
    if (!r || r.kind !== 'runDone') return
    const ms = performance.now() - t0
    const base = { ...presetParams(s0.presetId), ...overrides } as EngineParams
    this.set({
      ready: true,
      busy: null,
      info: r.info,
      branches: r.branches,
      params: { [r.info.rootId]: base },
      activeId: r.info.rootId,
      compareId: null,
      step: r.info.nSteps,
      extent: null,
      view: null,
      viewB: null,
      diff: null,
      well: null,
      series: null,
      wellCol: s0.wellCol >= 0 && s0.wellCol < r.info.nx ? s0.wellCol : Math.min(r.info.nx - 1, Math.round(r.info.nx * 0.46)),
      perf: { ...this.state.perf, runMs: ms },
    })
    this.refresh(true)
    this.afterChange(!opts.clean)
  }

  /** True when a change that restarts the main run would throw branches away. */
  private dropsBranches(): boolean {
    return this.state.branches.length > 1
  }

  setPreset(id: PresetId): void {
    this.guard.request('Change the scenario preset', () => {
      const p = getPreset(id)
      this.set({ presetId: id, runLengthMa: p.runLengthMa, segments: p.segments.map((s) => ({ ...s })), overrides: {} })
      void this.startRun()
    }, this.guard.isDirty && this.dropsBranches())
  }

  setRunLength(lengthMa: number): void {
    this.guard.request('Change the run length', () => this.applyRunLength(lengthMa), this.guard.isDirty && this.dropsBranches())
  }

  private applyRunLength(lengthMa: number): void {
    const preset = getPreset(this.state.presetId)
    const want = Math.max(0.5, Math.min(preset.runLengthMa, lengthMa))
    try {
      const segments = clipSegments(preset.segments, want)
      this.set({ segments, runLengthMa: lengthOf(segments) })
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e))
      return
    }
    void this.startRun()
  }

  // ---- parameter edits ----------------------------------------------------------------------

  /** Change one parameter (SI value) in the active timeline: the main run restarts, a branch is rebuilt. */
  async editParam(key: string, value: ParamValue): Promise<void> {
    const s = this.state
    const active = s.branches.find((b) => b.id === s.activeId)
    if (!active) return
    if (!active.parentId) {
      const go = async () => {
        this.set({ overrides: { ...this.state.overrides, [key]: value } })
        await this.startRun()
      }
      if (this.guard.isDirty && this.dropsBranches()) this.guard.request('Change a main-run control', () => void go(), true)
      else await go()
      return
    }
    if (s.branches.some((b) => b.parentId === active.id)) {
      this.fail('Other branches were made from this one. Delete them first, or make a new branch to try different controls.')
      return
    }
    const edits = { ...active.edits, [key]: value }
    const problems = validateBranchEdits(edits)
    if (problems.length) {
      this.fail(problems.join(' '))
      return
    }
    const parentId = active.parentId
    const del = await this.ask({ kind: 'deleteBranch', branchId: active.id })
    if (!del || del.kind !== 'deleted') return
    await this.makeBranch(parentId, active.forkStep, edits, active.label, s.compareId === active.id ? null : s.compareId)
  }

  // ---- branches -----------------------------------------------------------------------------

  /** Branch from the active timeline at the current time. */
  async branchHere(): Promise<void> {
    const s = this.state
    if (!s.info) return
    if (s.step >= s.info.nSteps) {
      this.fail('Move the time slider back first: a branch needs some time left to run.')
      return
    }
    await this.makeBranch(s.activeId, s.step, {}, undefined, s.activeId)
  }

  private async makeBranch(parentId: string, step: number, edits: Record<string, ParamValue>, label: string | undefined, compareId: string | null): Promise<void> {
    this.pause()
    this.set({ busy: { label: 'Running the branch', frac: 0 }, error: null })
    const r = await this.ask({ kind: 'branch', parentId, step, edits, label }, (p) =>
      this.set({ busy: { label: 'Running the branch', frac: p.step / p.nSteps } }),
    )
    if (!r || r.kind !== 'branched') {
      await this.reloadBranches()
      return
    }
    const parentParams = this.state.params[parentId]
    const p = cloneParams(parentParams)
    for (const [k, v] of Object.entries(edits)) (p as unknown as Record<string, ParamValue>)[k] = Array.isArray(v) ? v.slice() : v
    this.set({
      busy: null,
      branches: r.branches,
      params: { ...this.state.params, [r.branch.id]: p },
      activeId: r.branch.id,
      compareId: compareId && compareId !== r.branch.id && r.branches.some((b) => b.id === compareId) ? compareId : null,
      step,
    })
    this.refresh(true)
    this.afterChange(true)
  }

  private async reloadBranches(): Promise<void> {
    const r = await this.ask({ kind: 'branches' })
    if (r && r.kind === 'branchList') {
      const s = this.state
      this.set({
        branches: r.branches,
        activeId: r.branches.some((b) => b.id === s.activeId) ? s.activeId : (s.info?.rootId ?? ''),
        compareId: r.branches.some((b) => b.id === s.compareId) ? s.compareId : null,
      })
      this.refresh(true)
    }
  }

  async deleteBranch(id: string): Promise<void> {
    const r = await this.ask({ kind: 'deleteBranch', branchId: id })
    if (!r || r.kind !== 'deleted') return
    const s = this.state
    const root = s.info?.rootId ?? ''
    this.set({
      branches: r.branches,
      activeId: s.activeId === id ? root : s.activeId,
      compareId: s.compareId === id ? null : s.compareId,
    })
    this.refresh(true)
    this.afterChange(true)
  }

  setActive(id: string): void {
    const s = this.state
    this.set({ activeId: id, compareId: s.compareId === id ? null : s.compareId })
    this.refresh(true)
  }

  setCompare(id: string | null): void {
    this.set({ compareId: id && id !== this.state.activeId ? id : null })
    this.refresh(false)
  }

  // ---- saving, opening, autosave, and replacing work -----------------------------------------

  /** What a scenario file is built from, right now. Null before the first run. */
  private scenarioSource() {
    const s = this.state
    if (!s.info) return null
    return {
      presetId: s.presetId, seed: s.seed, nx: s.info.nx, dx: s.info.dx,
      segments: s.segments, overrides: s.overrides, branches: s.branches,
    }
  }

  /** Called after every change to the scenario: mark it unsaved (or clean) and queue an autosave. */
  private afterChange(unsaved: boolean): void {
    this.guard.setDirty(unsaved)
    this.autosave.schedule(() => {
      const src = this.scenarioSource()
      if (!src) throw new Error('nothing to save yet')
      return { text: serializeScenario(buildScenarioFile(src)), dirty: this.guard.isDirty }
    })
  }

  /** Write a scenario file (all branches, with each branch's final state hash) and hand it to John. Returns true when done. */
  async saveFile(): Promise<boolean> {
    const s = this.state
    const src = this.scenarioSource()
    if (!src || s.busy) return false
    const r = await this.ask({ kind: 'hashes' })
    if (!r || r.kind !== 'hashList') return false
    const text = serializeScenario(buildScenarioFile(src, r.hashes))
    const d = (this.deps.now ?? (() => new Date()))()
    const stamp = d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
    ;(this.deps.download ?? downloadInBrowser)('strata-' + s.presetId + '-' + stamp + '.strata.json', text)
    this.set({ notice: null })
    this.afterChange(false)
    this.autosave.flush()
    return true
  }

  /** Open button: warn first if unsaved work would be replaced, then run pick (opens the file chooser). */
  requestOpen(pick: () => void): void {
    this.guard.request('Open a file', pick)
  }

  /** New: the default scenario (last 3 Myr, no changes, no branches). */
  requestNew(): void {
    this.guard.request('Start a new scenario', () => {
      const p = getPreset('last3')
      this.set({ presetId: 'last3', seed: SEED, runLengthMa: p.runLengthMa, segments: p.segments.map((x) => ({ ...x })), overrides: {}, notice: null })
      void this.startRun({ clean: true })
    })
  }

  /** Reset: this preset at its full length with all controls back at the preset's values. */
  requestReset(): void {
    this.guard.request('Reset the controls', () => {
      const p = getPreset(this.state.presetId)
      this.set({ runLengthMa: p.runLengthMa, segments: p.segments.map((x) => ({ ...x })), overrides: {}, notice: null })
      void this.startRun({ clean: true })
    })
  }

  /** Write a waiting autosave now (the page is being hidden or closed). */
  flushAutosave(): void {
    this.autosave.flush()
  }

  confirmReplace(): void {
    this.guard.confirm()
  }

  async confirmReplaceAfterSave(): Promise<void> {
    await this.guard.confirmAfterSave(() => this.saveFile())
  }

  cancelReplace(): void {
    this.guard.cancel()
  }

  /**
   * Open the text of a file John chose. It is read and checked first; a bad file is refused with a
   * plain message and nothing else changes. A good one replaces the scenario; its stored hashes are
   * compared with the recomputed ones.
   */
  async openText(text: string): Promise<boolean> {
    const parsed = parseScenario(text)
    if (!parsed.ok) {
      this.set({ error: parsed.message })
      return false
    }
    return this.applyFile(parsed.file, false, 'Opening the scenario')
  }

  private async applyFile(file: ScenarioFile, unsaved: boolean, label: string, isRollback = false): Promise<boolean> {
    const before = isRollback ? null : this.scenarioSource()
    this.pause()
    this.set({ busy: { label, frac: 0 }, error: null, notice: null })
    const r = await this.ask({ kind: 'openScenario', file }, (p) => this.set({ busy: { label, frac: p.step / p.nSteps } }))
    if (!r || r.kind !== 'scenarioOpened') {
      const message = this.state.error ?? 'The scenario could not be rebuilt.'
      if (before) {
        // the engine may hold a half-built scenario: put the previous one back
        await this.applyFile(buildScenarioFile(before), this.guard.isDirty, 'Putting your work back', true)
        this.set({ error: message + ' Your previous work was put back.' })
      } else if (!isRollback) {
        void this.startRun({ clean: true })
      }
      return false
    }
    const cmp = compareHashes(file, r.hashes, { nx: r.info.nx, dx: r.info.dx })
    // parameters of every branch: the preset, plus the main run's changes, plus each branch's edits down the tree
    const base = { ...presetParams(file.run.presetId), ...file.run.overrides, duration: file.run.durationYr } as EngineParams
    const params: Record<string, EngineParams> = { [r.info.rootId]: base }
    for (const b of r.branches) {
      if (!b.parentId) continue
      const p = cloneParams(params[b.parentId])
      for (const [k, v] of Object.entries(b.edits)) (p as unknown as Record<string, ParamValue>)[k] = Array.isArray(v) ? v.slice() : v
      params[b.id] = p
    }
    const s0 = this.state
    this.set({
      ready: true,
      busy: null,
      presetId: file.run.presetId,
      seed: file.run.seed,
      overrides: { ...file.run.overrides },
      segments: file.run.segments.map((x) => ({ ...x })),
      runLengthMa: lengthOf(file.run.segments),
      info: r.info,
      branches: r.branches,
      params,
      activeId: r.info.rootId,
      compareId: null,
      step: r.info.nSteps,
      extent: null, view: null, viewB: null, diff: null, well: null, series: null,
      wellCol: s0.wellCol >= 0 && s0.wellCol < r.info.nx ? s0.wellCol : Math.min(r.info.nx - 1, Math.round(r.info.nx * 0.46)),
      notice: cmp.message,
      perf: { ...s0.perf, runMs: r.ms },
    })
    this.refresh(true)
    this.afterChange(unsaved)
    return true
  }

  // ---- time and view settings ---------------------------------------------------------------

  goto(step: number): void {
    const n = this.state.info?.nSteps ?? 0
    const k = Math.max(0, Math.min(n, Math.round(step)))
    if (k === this.state.step) return
    this.set({ step: k })
    this.refresh(false)
  }

  setMode(mode: ColorMode): void {
    this.set({ mode })
    this.refresh(false)
  }

  setWellColumn(j: number): void {
    const nx = this.state.info?.nx ?? 0
    this.set({ wellCol: Math.max(0, Math.min(nx - 1, j)) })
    this.refresh(false)
  }

  setFps(fps: number): void {
    this.set({ fps })
  }

  setStepsPerFrame(n: number): void {
    this.set({ stepsPerFrame: n })
  }

  recordDraw(ms: number): void {
    // not a state change that should redraw anything: update in place and notify only the panels
    this.state = { ...this.state, perf: { ...this.state.perf, drawMs: ms } }
    for (const l of this.listeners) l()
  }

  // ---- play ---------------------------------------------------------------------------------

  play(): void {
    const s = this.state
    if (!s.info || s.playing) return
    if (s.step >= s.info.nSteps) this.set({ step: 0 })
    this.set({ playing: true })
    this.lastFrame = 0
    const tick = (ts: number) => {
      const st = this.state
      if (!st.playing || !st.info) return
      if (!this.pumping && ts - this.lastFrame >= 1000 / st.fps) {
        this.lastFrame = ts
        const next = Math.min(st.info.nSteps, st.step + st.stepsPerFrame)
        this.set({ step: next, playing: next < st.info.nSteps })
        this.refresh(false)
        if (next >= st.info.nSteps) return
      }
      this.playHandle = requestAnimationFrame(tick)
    }
    this.playHandle = requestAnimationFrame(tick)
  }

  pause(): void {
    if (this.playHandle) cancelAnimationFrame(this.playHandle)
    this.playHandle = 0
    if (this.state.playing) this.set({ playing: false })
  }

  // ---- checks -------------------------------------------------------------------------------

  async runChecks(): Promise<void> {
    this.set({ checks: { ...this.state.checks, running: true } })
    const r = await this.ask({ kind: 'runChecks' })
    if (r && r.kind === 'checks') this.set({ checks: { running: false, results: r.results, allPass: r.allPass, ms: r.ms } })
    else this.set({ checks: { ...this.state.checks, running: false } })
  }

  // ---- fetching what to draw ----------------------------------------------------------------

  private refresh(series: boolean): void {
    this.dirty.view = true
    if (series) this.dirty.series = true
    if (!this.pumping) void this.pump()
  }

  private async pump(): Promise<void> {
    this.pumping = true
    try {
      while (this.dirty.view || this.dirty.series) {
        const want = { ...this.dirty }
        this.dirty = { view: false, series: false }
        const s = this.state
        if (!s.info || !s.activeId) continue
        if (want.series) {
          const r = await this.ask({ kind: 'series', branchId: s.activeId })
          if (r && r.kind === 'seriesData') this.set({ series: r.series })
        }
        if (want.view) await this.fetchView(s)
      }
    } finally {
      this.pumping = false
    }
  }

  private async fetchView(s: AppState): Promise<void> {
    const fields = fieldsForMode(s.mode)
    const t0 = performance.now()
    let view: StateView
    let viewB: StateView | null = null
    let diff: DiffSummary | null = null
    if (s.compareId && s.compareId !== s.activeId) {
      const r = await this.ask({ kind: 'compare', a: s.activeId, b: s.compareId, step: s.step, fields })
      if (!r || r.kind !== 'compared') return
      view = r.a
      viewB = r.b
      diff = { maxAbsDH: r.diff.maxAbsDH, maxAbsDThick: r.diff.maxAbsDThick, identical: r.diff.identical }
    } else {
      const r = await this.ask({ kind: 'seek', branchId: s.activeId, step: s.step, fields })
      if (!r || r.kind !== 'view') return
      view = r.view
    }
    const jumpMs = performance.now() - t0
    let well: WellColumn | null = null
    if (s.wellCol >= 0) {
      const w = await this.ask({ kind: 'well', branchId: s.activeId, step: s.step, column: s.wellCol })
      if (w && w.kind === 'wellColumn') well = w.well
    }
    const cur = this.state
    this.set({
      view, viewB, diff, well,
      extent: growExtent(cur.extent, viewB ? growExtent(extentOf(view), extentOf(viewB)) : extentOf(view)),
      perf: { ...cur.perf, jumpMs },
    })
  }
}

export const store = new AppStore()

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState)
}
