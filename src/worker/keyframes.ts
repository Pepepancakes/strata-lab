// Keyframes: the compact saved states the time machine seeks from (M1.5).
//
// Why not full copies: the spike kept full copies (about 75 MB of heap per branch). Measured on
// this engine (see docs/handover.md, M1.5): between two steps the grain thicknesses (sand, mud)
// and cement of an old layer almost never change (0.1-0.7 % of cells: erosion near the surface),
// while smax and u change in half of all cells in the unbundled default run. So a keyframe stores
// the record LAYER BY LAYER in two groups of chunks:
//   slow: sand, mud (+ cem, cemS when any cement exists)   per layer, nx numbers each
//   fast: smax, u     (+ temperature when it exists)       per layer, nx numbers each
// A chunk that is bit-identical to the same layer's chunk in the previous keyframe is SHARED (the
// same array object), not copied. Chunks are never modified after they are made, so a branch can
// hold its parent's chunks by reference: sharing is automatic, and dropping a branch frees only
// what no other branch still points to.
//
// What a keyframe does NOT store (it is derived, so storing it would only cost memory):
//   tDep, stepDt, stepAgeMa  from the schedule        porosity, permeability, loads  rebuilt from smax
//   H                         recomputed from the record
// Keyframes are only taken at "clean" steps: when deep compaction is bundled, the cached loads of
// deep layers lag between full solves and cannot be rebuilt (handover trap), but at the end of a
// full-solve cycle they can. See isCleanStep.

import { rebuildCaches, recomputeH } from '../engine/compaction'
import type { EngineParams } from '../engine/engineParams'
import { copyLedger, type Ledger } from '../engine/record'
import type { Schedule } from '../engine/schedule'
import { cloneHistory, copyHistory, type TriggerHistory } from '../engine/triggers'
import type { Diagnostics, EngineState, FailureEvent } from '../engine/state'

export interface Keyframe {
  /** Steps completed (0 = the pre-run layers only). The record then has step + nPre layers. */
  step: number
  nLayers: number
  /** Per layer: [sand | mud | cem | cemS] or [sand | mud]. Immutable once made. */
  slow: Float64Array[]
  /** Per layer: [smax | u | temp] or [smax | u]. Immutable once made. */
  fast: Float64Array[]
  /** Per layer material tags; null when every cell is sediment (always, in M1). */
  material: Uint8Array[] | null
  hasCem: boolean
  hasTemp: boolean
  b: Float64Array
  ledger: Ledger
  diag: Diagnostics
  /** Slope failures up to this step (M2.2). */
  events: FailureEvent[]
  /** Trigger history (M2.3). */
  hist: TriggerHistory
}

/** True when the engine can be rebuilt exactly from a keyframe taken after `step` steps. */
export function isCleanStep(P: EngineParams, schedule: Schedule, step: number): boolean {
  if (!(P.bundleEvery > 1) || P.linear) return true
  return step === 0 || step % P.bundleEvery === 0 || step === schedule.nSteps
}

const u32 = (a: Float64Array): Uint32Array => new Uint32Array(a.buffer, a.byteOffset, a.length * 2)

/** Bit-exact comparison (0 and -0 differ, as they do in stateHash). */
function sameBits(a: Uint32Array, aOff: number, b: Uint32Array, bOff: number, n: number): boolean {
  const lo = aOff * 2
  const lo2 = bOff * 2
  const m = n * 2
  for (let i = 0; i < m; i++) if (a[lo + i] !== b[lo2 + i]) return false
  return true
}

function anyNonZero(a: Float64Array, n: number): boolean {
  for (let i = 0; i < n; i++) if (a[i] !== 0) return true
  return false
}

/**
 * Pack the engine's record into a keyframe. `prev` (any earlier keyframe of the same run, usually
 * the one before) is only used to find chunks to share; the result does not depend on it.
 */
export function packKeyframe(eng: EngineState, prev?: Keyframe): Keyframe {
  const rec = eng.rec
  const nx = rec.nx
  const nL = rec.nLayers
  const nCells = nL * nx
  const hasCem = anyNonZero(rec.cem, nCells) || anyNonZero(rec.cemS, nCells)
  const hasTemp = eng.tempOk
  const slowFields = hasCem ? [rec.sand, rec.mud, rec.cem, rec.cemS] : [rec.sand, rec.mud]
  const fastFields = hasTemp ? [rec.smax, rec.u, eng.temp] : [rec.smax, rec.u]
  const slowU = slowFields.map(u32)
  const fastU = fastFields.map(u32)
  const canShareSlow = prev !== undefined && prev.hasCem === hasCem
  const canShareFast = prev !== undefined && prev.hasTemp === hasTemp

  const pack = (fields: Float64Array[], views: Uint32Array[], old: Float64Array | undefined, layer: number): Float64Array => {
    const off = layer * nx
    if (old) {
      const ou = u32(old)
      let same = true
      for (let f = 0; f < fields.length && same; f++) same = sameBits(views[f], off, ou, f * nx, nx)
      if (same) return old
    }
    const out = new Float64Array(fields.length * nx)
    for (let f = 0; f < fields.length; f++) out.set(fields[f].subarray(off, off + nx), f * nx)
    return out
  }

  const slow: Float64Array[] = new Array(nL)
  const fast: Float64Array[] = new Array(nL)
  for (let l = 0; l < nL; l++) {
    slow[l] = pack(slowFields, slowU, canShareSlow && l < prev.nLayers ? prev.slow[l] : undefined, l)
    fast[l] = pack(fastFields, fastU, canShareFast && l < prev.nLayers ? prev.fast[l] : undefined, l)
  }

  let material: Uint8Array[] | null = null
  if (anyNonZeroU8(rec.material, nCells)) {
    material = new Array(nL)
    for (let l = 0; l < nL; l++) {
      const mine = rec.material.subarray(l * nx, (l + 1) * nx)
      const old = prev?.material?.[l]
      material[l] = old && sameBytes(old, mine) ? old : mine.slice()
    }
  }

  return {
    step: eng.diag.stepIndex,
    nLayers: nL,
    slow,
    fast,
    material,
    hasCem,
    hasTemp,
    b: rec.b.slice(),
    ledger: copyLedger(rec.ledger),
    diag: { ...eng.diag },
    events: eng.events.slice(),
    hist: cloneHistory(eng.hist),
  }
}

function anyNonZeroU8(a: Uint8Array, n: number): boolean {
  for (let i = 0; i < n; i++) if (a[i] !== 0) return true
  return false
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Put the engine back exactly as it was at the keyframe. Everything beyond the keyframe's layers
 * is zeroed (later steps add into appended layers). Derived data comes from the schedule and is
 * rebuilt with the same functions the engine uses (restoreEngine in step.ts does the same).
 */
export function restoreKeyframe(kf: Keyframe, eng: EngineState, P: EngineParams, schedule: Schedule): void {
  const rec = eng.rec
  const nx = rec.nx
  const nL = kf.nLayers
  if (nL > rec.capacity) throw new Error('restore: record too small for keyframe')
  const n = nL * nx
  rec.b.set(kf.b)
  for (const f of [rec.sand, rec.mud, rec.smax, rec.u, rec.cem, rec.cemS, eng.temp]) f.fill(0, n)
  rec.material.fill(0, n)
  if (!kf.hasCem) {
    rec.cem.fill(0, 0, n)
    rec.cemS.fill(0, 0, n)
  }
  if (!kf.hasTemp) eng.temp.fill(0, 0, n)
  if (!kf.material) rec.material.fill(0, 0, n)
  for (let l = 0; l < nL; l++) {
    const off = l * nx
    const s = kf.slow[l]
    rec.sand.set(s.subarray(0, nx), off)
    rec.mud.set(s.subarray(nx, 2 * nx), off)
    if (kf.hasCem) {
      rec.cem.set(s.subarray(2 * nx, 3 * nx), off)
      rec.cemS.set(s.subarray(3 * nx, 4 * nx), off)
    }
    const q = kf.fast[l]
    rec.smax.set(q.subarray(0, nx), off)
    rec.u.set(q.subarray(nx, 2 * nx), off)
    if (kf.hasTemp) eng.temp.set(q.subarray(2 * nx, 3 * nx), off)
    if (kf.material) rec.material.set(kf.material[l], off)
  }
  // layer tables and deposition times come from the schedule (appendLayer sets exactly these)
  rec.stepDt.fill(0, 0, rec.capacity)
  rec.stepAgeMa.fill(0, 0, rec.capacity)
  rec.tDep.fill(0)
  const nPre = rec.nPre // pre-run layers (1, or 2 with salt) come before the first step's layer
  for (let l = 0; l < nPre; l++) rec.stepAgeMa[l] = schedule.startAgeMa
  for (let l = nPre; l < nL; l++) {
    rec.stepDt[l] = schedule.stepDt[l - nPre]
    rec.stepAgeMa[l] = schedule.stepAgeMa[l - nPre]
    rec.tDep.fill(schedule.tEndYr[l - nPre], l * nx, (l + 1) * nx)
  }
  rec.nLayers = nL
  rec.ledger = copyLedger(kf.ledger)
  eng.diag = { ...kf.diag }
  eng.events = kf.events.slice()
  copyHistory(eng.hist, kf.hist)
  eng.tempOk = kf.hasTemp
  rebuildCaches(eng, P)
  recomputeH(eng, P)
}

const sizeOf = (a: { byteLength: number }): number => a.byteLength

/** Bytes of a keyframe's own bookkeeping (column arrays); chunks are counted separately. */
export function keyframeFixedBytes(kf: Keyframe): number {
  return sizeOf(kf.b) + 256
}

/** Every distinct typed array the keyframe points to (for counting shared memory once). */
export function keyframeChunks(kf: Keyframe): Array<Float64Array | Uint8Array> {
  const out: Array<Float64Array | Uint8Array> = [...kf.slow, ...kf.fast]
  if (kf.material) out.push(...kf.material)
  return out
}

/** Estimated bytes of one keyframe taken at `step` with nothing shared (2 numbers per cell + 1 spare for overhead). */
export function estimateKeyframeBytes(nx: number, step: number, perCell = 4): number {
  return (step + 1) * nx * perCell * 8
}
