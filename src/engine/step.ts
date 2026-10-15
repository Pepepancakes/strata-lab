// One record step, and the engine's create / snapshot / restore.
//
// Order inside a step (spike 001): append a layer -> tectonic subsidence -> transport in nSub
// substeps (with turbidites) -> compaction + pore pressure per column -> recompute surface.
// Every process uses THIS step's dt from the schedule (steps may differ in length, D12).
// Sea level comes from a SeaLevelCurve evaluated at the middle of each substep, in ELAPSED years.
// Columns are processed in index order, layers bottom to top: a fixed order, so runs reproduce.

import { MUD, SAND } from './constants'
import { cementCell } from './cement'
import { failureStep } from './failure'
import { rebuildCaches, compactColumn, recomputeH, setPor, voidRatio } from './compaction'
import { restore as restoreRecord, snapshot as snapshotRecord, type Snapshot } from './determinism'
import type { EngineParams } from './engineParams'
import { appendLayer, createRecord, markInitialLedger } from './record'
import type { Schedule } from './schedule'
import type { SeaLevelCurve } from './sealevel'
import { subside } from './subsidence'
import { cloneHistory, copyHistory, type TriggerHistory } from './triggers'
import { allocateEngine, type Diagnostics, type EngineState, type FailureEvent } from './state'
import { columnTemperatures, computeTemperatures } from './thermal'
import { transportSubstep } from './transport'

// initial surface: coastal plain, shelf, slope, basin floor (x in m, elevation in m); synthetic
const PROFILE: ReadonlyArray<readonly [number, number]> = [[0, 15], [10000, 0], [40000, -100], [65000, -1500], [150000, -1900]]

export function initialSurface(x: number): number {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [x0, z0] = PROFILE[i]
    const [x1, z1] = PROFILE[i + 1]
    if (x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
  }
  return PROFILE[PROFILE.length - 1][1]
}

/** Substrate: 200 m of compacted mixed sediment (30 % sand), maximum past stress 20 MPa. */
export const SUBSTRATE = { bulk: 200, smax: 20e6, sandShare: 0.3 }

/**
 * New engine: a record sized for the schedule (+ `extraLayers` spare), substrate in layer 0,
 * ledger initialised. Layer 0 has age schedule.startAgeMa.
 */
export function createEngine(P: EngineParams, schedule: Schedule, extraLayers = 0): EngineState {
  const nx = P.nx
  const rec = createRecord({ nx, dx: P.dx, capacity: schedule.nSteps + 1 + extraLayers, startAgeMa: schedule.startAgeMa })
  const eng = allocateEngine(rec)
  eng.lagLoads = bundlingOn(P)
  const { bulk, smax, sandShare: f } = SUBSTRATE
  const e = f * voidRatio(P, SAND, smax) + (1 - f) * voidRatio(P, MUD, smax)
  const solid = bulk / (1 + e)
  for (let j = 0; j < nx; j++) {
    rec.b[j] = initialSurface((j + 0.5) * P.dx) - bulk
    rec.sand[j] = f * solid
    rec.mud[j] = (1 - f) * solid
    rec.smax[j] = smax
    setPor(eng, P, j, smax)
  }
  markInitialLedger(rec)
  rebuildCaches(eng, P)
  recomputeH(eng, P)
  return eng
}

/** Bundled deep compaction is on (and never in the Gibson benchmark mode, which must be exact). */
export function bundlingOn(P: EngineParams): boolean {
  return P.bundleEvery > 1 && !P.linear
}

/**
 * First layer of the always-updated window, as fixed at the full solve of step `kFull`
 * (-1 = before any: the whole column is the window). Layer l >= 1 was deposited by step l-1, so
 * the window is the layers younger than P.bundleAgeYr at the end of that step. Computed from the
 * schedule alone, so it is the same after a rewind.
 */
export function windowBase(schedule: Schedule, P: EngineParams, kFull: number): number {
  if (kFull < 0) return 0
  const cutoff = schedule.tEndYr[kFull] - P.bundleAgeYr
  let l = kFull + 1 // newest layer existing at that step
  while (l > 1 && schedule.tEndYr[l - 2] > cutoff) l--
  return l
}

/** Advance one record step. Returns false when the schedule is finished. */
export function step(eng: EngineState, P: EngineParams, schedule: Schedule, seaLevel: SeaLevelCurve): boolean {
  const rec = eng.rec
  const nx = rec.nx
  const k = eng.diag.stepIndex
  if (k >= schedule.nSteps) return false
  const dtRec = schedule.stepDt[k]
  const t0 = schedule.tStartYr[k]
  const k1 = appendLayer(rec, dtRec, schedule.stepAgeMa[k], schedule.tEndYr[k])
  const thermalOn = P.thermal === 1
  if (thermalOn && !eng.tempOk) computeTemperatures(eng, P, seaLevel(t0)) // start-of-step temperatures (first step, or after a restore)
  subside(rec, P, dtRec, t0, schedule.startAgeMa * 1e6)
  const op = k1 * nx
  for (let j = 0; j < nx; j++) setPor(eng, P, op + j, 0)
  const dt = dtRec / P.nSub
  for (let s = 0; s < P.nSub; s++) transportSubstep(eng, P, seaLevel(t0 + (s + 0.5) * dt), dt)
  compactStep(eng, P, schedule, k, k1)
  if (thermalOn && ((k + 1) % P.thermalEvery === 0 || k === schedule.nSteps - 1)) thermalStep(eng, P, schedule, k, k1, seaLevel(schedule.tEndYr[k]))
  if (P.failOn === 1) failureStep(eng, P, k, schedule.tEndYr[k], schedule.stepAgeMa[k], seaLevel)
  eng.diag.stepIndex = k + 1
  return true
}

/**
 * Temperature and quartz cement (M1.4c), run every `thermalEvery` steps and at the last step (a
 * numerical saving, like the bundling: the temperature field changes slowly). New temperatures of
 * every cell come from the steady conduction of the NEW state (thermal.ts). Each sand cell then
 * cements over the whole interval since the last update, its temperature rising linearly from the
 * value at that update to the new one (exact integral, cement.ts). A cell deposited since the last
 * update has no earlier value, so it starts at its new temperature.
 * Columns and layers are visited in index order (fixed order, so runs reproduce).
 */
function thermalStep(eng: EngineState, P: EngineParams, schedule: Schedule, k: number, k1: number, sl: number): void {
  const rec = eng.rec
  const nx = rec.nx
  const col = eng.scratch.hh
  const kPrev = Math.floor(k / P.thermalEvery) * P.thermalEvery - 1 // step of the previous update (-1 = the start)
  const dtYr = schedule.tEndYr[k] - (kPrev >= 0 ? schedule.tEndYr[kPrev] : 0)
  const lastOld = kPrev + 1 // newest layer that existed at the previous update (layer 0 = substrate)
  const cementOn = P.cement === 1
  const onset = P.cemTonset
  for (let j = 0; j < nx; j++) {
    columnTemperatures(eng, P, j, k1 + 1, sl, col)
    for (let l = 0; l <= k1; l++) {
      const i = l * nx + j
      const t1 = col[l]
      if (cementOn) {
        const t0 = l <= lastOld ? eng.temp[i] : t1
        if (t1 > onset || t0 > onset) cementCell(eng, P, i, t0, t1, dtYr)
      }
      eng.temp[i] = t1
    }
  }
  eng.tempOk = true
}

/**
 * Compaction and pore pressure for step k (newest layer k1), and the surface H that follows from
 * it. Bundled deep compaction: window layers every step, deep layers once per bundleEvery steps.
 * Exported so the bundling can be tested with a prescribed deposition (no transport).
 */
export function compactStep(eng: EngineState, P: EngineParams, schedule: Schedule, k: number, k1: number): void {
  const rec = eng.rec
  const nx = rec.nx
  const dtRec = schedule.stepDt[k]
  if (bundlingOn(P)) {
    const N = P.bundleEvery
    const full = (k + 1) % N === 0 || k === schedule.nSteps - 1
    const lw = windowBase(schedule, P, Math.floor(k / N) * N - 1) // window held since the last full solve
    if (full) {
      const dtDeep = schedule.tEndYr[k] - schedule.tStartYr[Math.floor(k / N) * N]
      for (let j = 0; j < nx; j++) compactColumn(eng, P, j, k1, dtRec, 0, lw, dtDeep)
      recomputeH(eng, P) // exact sum, once per cycle: also clears rounding drift from the updates below
    } else {
      // H is kept up to date from the bulk change of the layers that were updated (the deep
      // layers did not change), which avoids summing every layer of every column every step.
      for (let j = 0; j < nx; j++) rec.H[j] += compactColumn(eng, P, j, k1, dtRec, lw)
    }
  } else {
    for (let j = 0; j < nx; j++) compactColumn(eng, P, j, k1, dtRec)
    recomputeH(eng, P)
  }
}

export interface EngineSnapshot {
  record: Snapshot
  diag: Diagnostics
  /** Cached loads, kept only when bundling is on (deep layers' loads lag and cannot be rebuilt). */
  ld?: Float64Array
  /**
   * Temperatures of the last thermal update (M1.4c). Kept whenever they exist: the next update
   * integrates cement from THESE values, and the record may have moved on since, so they cannot be
   * rebuilt from the restored record.
   */
  temp?: Float64Array
  /** Slope failures so far (M2.2). Events are never changed after they are made, so a shallow copy is exact. */
  events: FailureEvent[]
  /** Trigger history (M2.3). */
  hist: TriggerHistory
}

export function snapshotEngine(eng: EngineState): EngineSnapshot {
  const snap: EngineSnapshot = { record: snapshotRecord(eng.rec), diag: { ...eng.diag }, events: eng.events.slice(), hist: cloneHistory(eng.hist) }
  if (eng.lagLoads) snap.ld = eng.ld.slice(0, eng.rec.nLayers * eng.rec.nx)
  if (eng.tempOk) snap.temp = eng.temp.slice(0, eng.rec.nLayers * eng.rec.nx)
  return snap
}

/** Put the engine back exactly as it was; derived caches are rebuilt from the record. */
export function restoreEngine(snap: EngineSnapshot, eng: EngineState, P: EngineParams): void {
  restoreRecord(snap.record, eng.rec)
  eng.diag = { ...snap.diag }
  eng.events = snap.events.slice()
  copyHistory(eng.hist, snap.hist)
  eng.temp.fill(0)
  if (snap.temp) eng.temp.set(snap.temp)
  eng.tempOk = snap.temp !== undefined // otherwise rebuilt from the restored record at the next step
  rebuildCaches(eng, P)
  if (snap.ld) {
    eng.ld.fill(0)
    eng.ld.set(snap.ld)
  } else recomputeH(eng, P) // bundled runs keep H in the record (it may be a running value between full solves)
}

/** Totals for the checks: solid sand and mud in one column, m. */
export function columnSolids(eng: EngineState, j: number): { sand: number; mud: number } {
  const { rec } = eng
  let sand = 0, mud = 0
  for (let l = 0; l < rec.nLayers; l++) {
    sand += rec.sand[l * rec.nx + j]
    mud += rec.mud[l * rec.nx + j]
  }
  return { sand, mud }
}
