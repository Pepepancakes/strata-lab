// The time machine (M1.5): run once, then scrub, play, branch and compare.
//
// One working engine does all the stepping. Each branch only holds KEYFRAMES (keyframes.ts), so
// the memory of a branch is its saved states, not a second copy of the engine.
//
//   seek(branch, step)   restore the nearest keyframe at or before the step, replay the steps
//                        in between (or just keep stepping when the engine is already on this
//                        timeline just before the step: that is "play").
//   branch(parent, step, edits)
//                        seek the parent to `step`, switch to the edited parameters and run to the
//                        end. The branch points to the parent's keyframes up to `step` (shared,
//                        not copied) and makes its own after that.
//
// Parameters can change along a timeline, so each branch has ERAS: [{ fromStep, P, sea }]. A step
// uses the era that contains it. Eras are shared by reference with child branches, so an era
// object identifies its whole history; that is how the engine knows whether the state it holds is
// also a state of another branch (shared history) and can keep stepping without a restore.
//
// Determinism: everything here is a fixed-order loop over the engine, which is deterministic, so a
// seek gives the same bits as a straight run (tests/timemachine.test.ts hashes both).
// Caches: porosity and permeability caches are a function of smax and the parameters (kA, kB and
// kMudMult can differ between eras). When the era changes the caches are recomputed for the new
// parameters, in the straight run and after a restore alike, so both agree.

import { cellBulk, setPor } from '../engine/compaction'
import { stateHash } from '../engine/determinism'
import { cloneParams, defaultEngineParams, type EngineParams } from '../engine/engineParams'
import type { ParamValue } from '../engine/params'
import { getPreset } from '../engine/presets'
import { recordBalance } from '../engine/record'
import { buildSchedule, type Schedule } from '../engine/schedule'
import { makeSeaLevel, type SeaLevelCurve } from '../engine/sealevel'
import { createEngine, step as engineStep } from '../engine/step'
import type { EngineState } from '../engine/state'
import { validateBranchEdits } from './edits'
import {
  isCleanStep, keyframeChunks, packKeyframe, restoreKeyframe, type Keyframe,
} from './keyframes'
import {
  DEFAULT_VIEW_FIELDS, type BranchInfo, type RunInfo, type RunSpec, type StateView, type ViewDiff, type ViewField,
} from './protocol'

/** Most branches at once, the main run included. Each costs its own saved states. */
export const MAX_BRANCHES = 8
/** Byte budget of the saved states of one branch: 25 MB for the default run, 100 MB for long runs. */
export const BUDGET_SHORT = 25e6
export const BUDGET_LONG = 100e6
const LONG_RUN_STEPS = 700

interface Era {
  fromStep: number
  P: EngineParams
  sea: SeaLevelCurve
}

interface Branch {
  id: string
  parentId: string | null
  forkStep: number
  label: string
  edits: Record<string, ParamValue>
  eras: Era[]
  keyframes: Keyframe[]
}

/** Where the working engine is: after `step` steps of a timeline whose last era is `era`. */
interface Cursor {
  valid: boolean
  step: number
  /** Era used by the last executed step (null at step 0). */
  era: Era | null
  /** Era the porosity / permeability caches were last computed for. */
  cacheEra: Era | null
}

export type ProgressFn = (branchId: string, step: number, nSteps: number) => void

/**
 * Bytes per layer of a keyframe's unshared chunks, per column: smax and u (16 B) plus, on
 * average, one quarter of the slow group (sand, mud: 16 B) that is not shared. Measured in
 * docs/handover.md (M1.5); this is only used to choose the spacing.
 */
function bytesPerLayerColumn(P: EngineParams): number {
  return 16 + 4 + (P.thermal === 1 ? 8 : 0)
}

/**
 * Keyframe spacing (in steps): the smallest multiple of the bundling cycle whose estimated bytes
 * fit the budget. Spacing is a multiple of the cycle so every keyframe sits at a clean step.
 */
export function chooseKeyframeSpacing(P: EngineParams, nSteps: number, budget: number): number {
  const cycle = P.bundleEvery > 1 && !P.linear ? P.bundleEvery : 1
  const per = bytesPerLayerColumn(P) * P.nx
  for (let s = cycle; s < nSteps; s += cycle) {
    let total = 0
    for (let k = s; k <= nSteps; k += s) total += (k + 1) * per
    total += (nSteps + 1) * per // the final keyframe
    if (total <= budget) return s
  }
  return Math.max(cycle, nSteps)
}

export class TimeMachine {
  private schedule!: Schedule
  private eng!: EngineState
  private P0!: EngineParams
  private every = 1
  private budget = BUDGET_SHORT
  private branches = new Map<string, Branch>()
  private nextBranch = 1
  private cursor: Cursor = { valid: false, step: 0, era: null, cacheEra: null }
  private rootId = ''

  /** Start a new run. Everything from an earlier run is dropped. */
  run(spec: RunSpec, seed: number, onProgress?: ProgressFn): RunInfo {
    const preset = getPreset(spec.presetId)
    const P: EngineParams = { ...defaultEngineParams(), ...preset.params, ...(spec.overrides ?? {}) }
    this.P0 = P
    this.schedule = buildSchedule(spec.segments ?? preset.segments)
    this.eng = createEngine(P, this.schedule)
    this.branches.clear()
    this.nextBranch = 1
    this.cursor = { valid: false, step: 0, era: null, cacheEra: null }
    this.budget = this.schedule.nSteps > LONG_RUN_STEPS ? BUDGET_LONG : BUDGET_SHORT
    this.every = chooseKeyframeSpacing(P, this.schedule.nSteps, this.budget)
    const sea = makeSeaLevel(P, this.schedule.startAgeMa * 1e6)
    const era: Era = { fromStep: 0, P, sea }
    const root: Branch = { id: this.newId(), parentId: null, forkStep: 0, label: 'Main run', edits: {}, eras: [era], keyframes: [] }
    this.branches.set(root.id, root)
    this.rootId = root.id
    this.cursor = { valid: true, step: 0, era: null, cacheEra: era }
    root.keyframes.push(packKeyframe(this.eng))
    this.advance(root, this.schedule.nSteps, onProgress)

    const sch = this.schedule
    const seaLevelM = new Float64Array(sch.nSteps)
    for (let k = 0; k < sch.nSteps; k++) seaLevelM[k] = sea(sch.tEndYr[k])
    return {
      rootId: root.id,
      presetId: spec.presetId,
      seed,
      nSteps: sch.nSteps,
      nx: P.nx,
      dx: P.dx,
      startAgeMa: sch.startAgeMa,
      runLengthMa: sch.runLengthMa,
      stepAgeMa: sch.stepAgeMa.slice(),
      stepDtYr: sch.stepDt.slice(),
      seaLevelM,
      keyframeEvery: this.every,
      maxBranches: MAX_BRANCHES,
    }
  }

  get nSteps(): number {
    return this.schedule.nSteps
  }

  get root(): string {
    return this.rootId
  }

  private newId(): string {
    return `b${this.nextBranch++}`
  }

  private get(id: string): Branch {
    const b = this.branches.get(id)
    if (!b) throw new Error(`There is no branch "${id}".`)
    return b
  }

  private eraAt(b: Branch, k: number): Era {
    let e = b.eras[0]
    for (const c of b.eras) if (c.fromStep <= k) e = c
    return e
  }

  /** The era whose last step brought a timeline to `step` steps (null at step 0). */
  private eraBefore(b: Branch, step: number): Era | null {
    return step === 0 ? null : this.eraAt(b, step - 1)
  }

  private checkStep(step: number): void {
    if (!Number.isInteger(step) || step < 0 || step > this.schedule.nSteps) {
      throw new Error(`Step ${step} is outside this run (0 to ${this.schedule.nSteps}).`)
    }
  }

  // ---- stepping and keyframes ---------------------------------------------------------------

  private wantKeyframe(step: number): boolean {
    return step === this.schedule.nSteps || (step % this.every === 0 && isCleanStep(this.P0, this.schedule, step))
  }

  /** Step the working engine forward on branch `b` up to `target`, saving keyframes if `save`. */
  private advance(b: Branch, target: number, onProgress?: ProgressFn, save = true): void {
    const cur = this.cursor
    const every = Math.max(1, Math.ceil(this.schedule.nSteps / 40))
    while (cur.step < target) {
      const era = this.eraAt(b, cur.step)
      if (era !== cur.cacheEra) this.refreshCaches(era)
      engineStep(this.eng, era.P, this.schedule, era.sea)
      cur.step++
      cur.era = era
      if (save && cur.step > b.forkStep && this.wantKeyframe(cur.step)) {
        b.keyframes.push(packKeyframe(this.eng, b.keyframes[b.keyframes.length - 1]))
      }
      if (onProgress && (cur.step % every === 0 || cur.step === target)) onProgress(b.id, cur.step, this.schedule.nSteps)
    }
  }

  /** Recompute porosity and permeability caches for another era's parameters (smax unchanged). */
  private refreshCaches(era: Era): void {
    const n = this.eng.rec.nLayers * this.eng.rec.nx
    for (let i = 0; i < n; i++) setPor(this.eng, era.P, i, this.eng.rec.smax[i])
    this.cursor.cacheEra = era
  }

  /** Put the working engine at `target` steps of branch `b`: restore a keyframe if needed, then step. */
  private moveTo(b: Branch, target: number): void {
    this.checkStep(target)
    const cur = this.cursor
    const onThisTimeline = cur.valid && cur.step <= target && cur.era === this.eraBefore(b, cur.step)
    // best saved state at or before the target
    let kf: Keyframe | undefined
    for (let i = b.keyframes.length - 1; i >= 0; i--) {
      if (b.keyframes[i].step <= target) {
        kf = b.keyframes[i]
        break
      }
    }
    // a restore costs about as much as a few steps, so only restore when it saves clearly more
    if (kf && (!onThisTimeline || kf.step > cur.step + RESTORE_COST_STEPS)) {
      const era = this.eraAt(b, kf.step)
      restoreKeyframe(kf, this.eng, era.P, this.schedule)
      this.cursor = { valid: true, step: kf.step, era: this.eraBefore(b, kf.step), cacheEra: era }
    } else if (!onThisTimeline) {
      throw new Error('internal: no saved state to start from')
    }
    this.advance(b, target, undefined, false)
  }

  // ---- public operations --------------------------------------------------------------------

  seek(branchId: string, step: number, fields: readonly ViewField[] = DEFAULT_VIEW_FIELDS, withHash = false): StateView {
    const b = this.get(branchId)
    this.moveTo(b, step)
    return this.makeView(b, step, fields, withHash)
  }

  /** stateHash of the record of a branch at a step (a pass over the whole record). */
  hashAt(branchId: string, step: number): string {
    this.moveTo(this.get(branchId), step)
    return stateHash(this.eng.rec)
  }

  branch(parentId: string, step: number, edits: Record<string, ParamValue>, label?: string, onProgress?: ProgressFn): BranchInfo {
    const parent = this.get(parentId)
    if (this.branches.size >= MAX_BRANCHES) {
      throw new Error(`${MAX_BRANCHES} branches is the most (each one keeps its own saved states in memory). Delete a branch first.`)
    }
    const problems = validateBranchEdits(edits)
    if (problems.length) throw new Error(problems.join(' '))
    this.checkStep(step)
    if (step >= this.schedule.nSteps) throw new Error('A branch needs at least one step left to run.')
    this.moveTo(parent, step)
    const parentEra = this.eraAt(parent, step)
    const P = cloneParams(parentEra.P)
    for (const [k, v] of Object.entries(edits)) (P as unknown as Record<string, ParamValue>)[k] = Array.isArray(v) ? v.slice() : v
    const era: Era = { fromStep: step, P, sea: makeSeaLevel(P, this.schedule.startAgeMa * 1e6) }
    const id = this.newId()
    const b: Branch = {
      id,
      parentId,
      forkStep: step,
      label: label ?? `Branch from ${this.ageLabel(step)}`,
      edits: { ...edits },
      eras: [...parent.eras.filter((e) => e.fromStep < step), era],
      keyframes: parent.keyframes.filter((k) => k.step <= step),
    }
    this.branches.set(id, b)
    try {
      this.advance(b, this.schedule.nSteps, onProgress)
    } catch (e) {
      this.branches.delete(id)
      this.cursor.valid = false
      throw e
    }
    return this.info(id)
  }

  deleteBranch(branchId: string): { freedBytes: number } {
    const b = this.get(branchId)
    if (b.id === this.rootId) throw new Error('The main run cannot be deleted. Start a new run instead.')
    const freed = this.ownBytes(b)
    this.branches.delete(branchId)
    b.keyframes = [] // drop the references; chunks nobody else points to become garbage
    return { freedBytes: freed }
  }

  compare(aId: string, bId: string, step: number, fields: readonly ViewField[] = DEFAULT_VIEW_FIELDS): { a: StateView; b: StateView; diff: ViewDiff } {
    const f = fields.includes('thick') ? fields : [...fields, 'thick' as const]
    const a = this.seek(aId, step, f)
    const b = this.seek(bId, step, f)
    return { a, b, diff: diffViews(a, b) }
  }

  // ---- views --------------------------------------------------------------------------------

  private makeView(b: Branch, step: number, fields: readonly ViewField[], withHash: boolean): StateView {
    const eng = this.eng
    const rec = eng.rec
    const sch = this.schedule
    const nx = rec.nx
    const n = rec.nLayers * nx
    const era = this.eraAt(b, Math.max(0, step - 1))
    const elapsed = step === 0 ? 0 : sch.tEndYr[step - 1]
    const view: StateView = {
      branchId: b.id,
      step,
      nSteps: sch.nSteps,
      ageMa: step === 0 ? sch.startAgeMa : sch.stepAgeMa[step - 1],
      elapsedYr: elapsed,
      seaLevelM: era.sea(elapsed),
      nx,
      dx: rec.dx,
      nLayers: rec.nLayers,
      b: rec.b.slice(),
      H: rec.H.slice(),
      material: rec.material.slice(0, n),
      layerAgeMa: rec.stepAgeMa.slice(0, rec.nLayers),
      balance: recordBalance(rec),
      shore: eng.diag.shore,
      shelfEdge: eng.diag.shelfEdge,
    }
    for (const f of fields) {
      if (f === 'thick') {
        const t = new Float64Array(n)
        for (let i = 0; i < n; i++) t[i] = cellBulk(eng, era.P, i)
        view.thick = t
      } else view[f] = rec[f].slice(0, n)
    }
    if (withHash) view.hash = stateHash(rec)
    return view
  }

  private ageLabel(step: number): string {
    const age = step === 0 ? this.schedule.startAgeMa : this.schedule.stepAgeMa[step - 1]
    return `${(Math.round(age * 1000) / 1000).toString()} Ma`
  }

  // ---- bookkeeping --------------------------------------------------------------------------

  private chunkSet(b: Branch): Set<object> {
    const s = new Set<object>()
    for (const k of b.keyframes) {
      for (const c of keyframeChunks(k)) s.add(c)
      s.add(k.b)
    }
    return s
  }

  private bytesOf(chunks: Iterable<object>, nKeyframes: number): number {
    let sum = 0
    for (const c of chunks) sum += (c as { byteLength: number }).byteLength
    return sum + nKeyframes * 256
  }

  private ownBytes(b: Branch): number {
    const mine = this.chunkSet(b)
    for (const o of this.branches.values()) {
      if (o === b) continue
      for (const c of this.chunkSet(o)) mine.delete(c)
    }
    return this.bytesOf(mine, 0)
  }

  /** Bytes of saved states over all branches (shared chunks counted once). */
  liveBytes(): number {
    const all = new Set<object>()
    let nk = 0
    for (const b of this.branches.values()) {
      for (const c of this.chunkSet(b)) all.add(c)
      nk += b.keyframes.length
    }
    return this.bytesOf(all, nk)
  }

  info(id: string): BranchInfo {
    const b = this.get(id)
    return {
      id: b.id,
      parentId: b.parentId,
      forkStep: b.forkStep,
      forkAgeMa: b.forkStep === 0 ? this.schedule.startAgeMa : this.schedule.stepAgeMa[b.forkStep - 1],
      label: b.label,
      edits: { ...b.edits },
      keyframes: b.keyframes.length,
      reachableBytes: this.bytesOf(this.chunkSet(b), b.keyframes.length),
      ownBytes: this.ownBytes(b),
    }
  }

  list(): BranchInfo[] {
    return [...this.branches.keys()].map((id) => this.info(id))
  }

  /** Bytes of the working engine (record plus caches), separate from the per-branch saved states. */
  engineBytes(): number {
    const e = this.eng
    const cells = e.rec.capacity * e.rec.nx
    return cells * (7 * 8 + 1) + cells * 6 * 8
  }

  get keyframeEvery(): number {
    return this.every
  }

  /** Drop the working engine's position so the next seek must restore a keyframe (tests, timing). */
  forgetPosition(): void {
    this.cursor.valid = false
  }
}

/** Restoring a keyframe costs about this many steps of replay (measured: 4 ms vs 2-3 ms per step on the default run). */
const RESTORE_COST_STEPS = 3

function bitsEqual(a: Float64Array | Uint8Array | undefined, b: Float64Array | Uint8Array | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  if (a.length !== b.length) return false
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
  const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false
  return true
}

/** B minus A. The views must come from the same step of runs with the same grid. */
export function diffViews(a: StateView, b: StateView): ViewDiff {
  const dH = new Float64Array(a.nx)
  let maxAbsDH = 0
  for (let j = 0; j < a.nx; j++) {
    dH[j] = b.H[j] - a.H[j]
    maxAbsDH = Math.max(maxAbsDH, Math.abs(dH[j]))
  }
  let dThick: Float64Array | undefined
  let maxAbsDThick = 0
  if (a.thick && b.thick && a.thick.length === b.thick.length) {
    dThick = new Float64Array(a.thick.length)
    for (let i = 0; i < dThick.length; i++) {
      dThick[i] = b.thick[i] - a.thick[i]
      maxAbsDThick = Math.max(maxAbsDThick, Math.abs(dThick[i]))
    }
  }
  const identical =
    a.nLayers === b.nLayers &&
    bitsEqual(a.b, b.b) && bitsEqual(a.H, b.H) && bitsEqual(a.thick, b.thick) && bitsEqual(a.sand, b.sand) &&
    bitsEqual(a.mud, b.mud) && bitsEqual(a.smax, b.smax) && bitsEqual(a.u, b.u) && bitsEqual(a.cem, b.cem) &&
    bitsEqual(a.material, b.material)
  return { dH, dThick, maxAbsDH, maxAbsDThick, identical }
}
