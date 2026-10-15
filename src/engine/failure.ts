// Slope failure and deposit of the debris as an MTD (M2.2).
//
// What happens (all inside one record step, after compaction, see step.ts):
//   1. Stability (stability.ts) gives the factor of safety FS of every column. If any column has
//      FS < 1, take the weakest one and widen the failure over the contiguous neighbouring columns
//      that also have FS < 1 (retrogression), up to failMaxCells columns.
//   2. In each of those columns everything above the critical slip surface is released: whole
//      layers above it, and the upper half of the critical cell (the slip surface is at the
//      cell's mid-point, where the factor of safety is evaluated). Partial cells are cut by solid
//      volume: sand and mud (and cement) are each cut in the same proportion. Salt is left alone.
//      The released material is kept in a ReleasedPackage together with its pore-pressure and
//      stress history; the package is what is moved.
//   3. The package runs out as a Bingham debris flow (runout.ts): one chain of blocks, four per
//      source column, each carrying its own sand and mud. Blocks are laid down where they stop.
//   4. The deposit goes into the layer of THIS step (the top layer), in the cells it covers, tagged
//      MTD. Remoulded mud restarts consolidation: its starting maximum effective stress is the
//      stress that gives porosity mtdPhiMud (phi0 exp(-beta s) inverted). A cell that already held
//      sediment of this step keeps it; the tag becomes MTD when the debris is at least half of the
//      cell's solids, and the cell's smax is the solids-weighted mean of the two.
//   5. FS is checked again (the scar is a new, steeper headwall), up to failMaxIters failures per
//      step. A failure still unstable after that is counted in diag.failUnresolved and tried
//      again at the next step.
//
// Pore pressure: a failure is instantaneous, so each touched column changes its load at constant
// pore pressure: u_new = u + (L_new - L_old) for every cell (undrained loading or unloading, so
// the effective stress does not jump) and the cached load is set to L_new. That keeps the engine's
// cached loads equal to what rebuildCaches() computes from the record, so a rewind is bit-identical.
// Fresh debris starts at u = L (zero effective stress apart from the remoulded smax) and drains
// like any new sediment.
//
// Mass: nothing is created. Per event, sand and mud released = deposited + exported (checked by
// mtdBalance and the tests, to 1e-12 relative). Material that runs past the basinward edge is
// exported: it leaves the record and is added to the ledger's cumOut. Quartz cement in a released
// cell is dropped (cumOut.cement): the debris is treated as uncemented sand.
// Assumptions: see stability.ts (infinite slope, drained) and runout.ts (depth-averaged Bingham
// flow, no entrainment). The deposit is placed in the step's layer, so the record keeps one layer
// per step (keyframes, bundling and the time axis rely on that); two events in one step share it.
// Parameters: failMaxCells, failMaxIters, runYield, runViscosity, runDensity, mtdPhiMud.

import { buoyantLoad, cellBulk, recomputeH, setPor } from './compaction'
import { EMPTY, MUD, RHO_S, RHO_W } from './constants'
import type { EngineParams } from './engineParams'
import { MTD, SALT, SEDIMENT } from './record'
import { runOut } from './runout'
import { computeStability, type StabilityResult } from './stability'
import { attributeCause, recordHistory, referenceSlot } from './triggers'
import type { SeaLevelCurve } from './sealevel'
import type { EngineState, FailureEvent } from './state'

/** Blocks per source column in the run-out chain. A numerical choice. */
export const BLOCKS_PER_COLUMN = 4

/** What one source column released. Thicknesses are solid metres. */
export interface ReleasedColumn {
  column: number
  /** Layers cut, top first. */
  layers: number[]
  /** Solid sand and mud taken from each of those cells. */
  sand: number[]
  mud: number[]
  /** Past-maximum effective stress and excess pore pressure the cells had, Pa. */
  smax: number[]
  u: number[]
  /** Deposition time of each cell, elapsed yr. */
  tDep: number[]
  /** In-place bulk thickness taken, m. */
  bulk: number
  /** Depth of the slip surface below the seafloor, m. */
  depth: number
}

export interface ReleasedPackage {
  columns: ReleasedColumn[]
  /** Totals, solid m (sum over columns and layers), cement too. */
  sand: number
  mud: number
  cement: number
  bulk: number
}

/** Starting maximum effective stress (Pa) of remoulded mud with porosity P.mtdPhiMud. */
export function mtdSmax(P: EngineParams): number {
  const phi0 = P.phi0[MUD]
  if (!(P.mtdPhiMud < phi0)) return 0
  return Math.log(phi0 / P.mtdPhiMud) / P.beta[MUD]
}

/** The run of columns that fails next: the weakest column plus contiguous neighbours with FS < 1, at most maxCells. */
export function pickFailure(fsMin: ArrayLike<number>, maxCells: number): { from: number; to: number } | null {
  const nx = fsMin.length
  let seed = -1
  for (let j = 0; j < nx; j++) if (fsMin[j] < 1 && (seed < 0 || fsMin[j] < fsMin[seed])) seed = j
  if (seed < 0) return null
  let lo = seed
  let hi = seed
  while (hi - lo + 1 < maxCells) {
    const left = lo > 0 && fsMin[lo - 1] < 1
    const right = hi < nx - 1 && fsMin[hi + 1] < 1
    if (!left && !right) break
    if (left && (!right || fsMin[lo - 1] <= fsMin[hi + 1])) lo--
    else hi++
  }
  return { from: lo, to: hi }
}

/** Cut everything above the slip surface out of columns from..to. Changes the record and the caches of the cut cells. */
function release(eng: EngineState, P: EngineParams, st: StabilityResult, from: number, to: number): ReleasedPackage {
  const rec = eng.rec
  const nx = rec.nx
  const top = rec.nLayers - 1
  const pkg: ReleasedPackage = { columns: [], sand: 0, mud: 0, cement: 0, bulk: 0 }
  for (let j = from; j <= to; j++) {
    const lc = st.critLayer[j]
    const col: ReleasedColumn = { column: j, layers: [], sand: [], mud: [], smax: [], u: [], tDep: [], bulk: 0, depth: st.critDepth[j] }
    for (let l = top; l >= lc; l--) {
      const i = l * nx + j
      if (rec.material[i] === SALT) continue
      const s = rec.sand[i] + rec.mud[i]
      if (s <= EMPTY) continue
      const whole = l > lc
      const f = whole ? 1 : 0.5
      const dSand = f * rec.sand[i]
      const dMud = f * rec.mud[i]
      const dCem = f * rec.cem[i]
      col.layers.push(l)
      col.sand.push(dSand)
      col.mud.push(dMud)
      col.smax.push(rec.smax[i])
      col.u.push(rec.u[i])
      col.tDep.push(rec.tDep[i])
      col.bulk += f * cellBulk(eng, P, i)
      pkg.sand += dSand
      pkg.mud += dMud
      pkg.cement += dCem
      if (whole) {
        rec.sand[i] = 0
        rec.mud[i] = 0
        rec.cem[i] = 0
        rec.cemS[i] = 0
        rec.smax[i] = 0
        rec.u[i] = 0
        eng.ld[i] = 0
        rec.material[i] = SEDIMENT
        setPor(eng, P, i, 0)
      } else {
        rec.sand[i] -= dSand
        rec.mud[i] -= dMud
        rec.cem[i] -= dCem
      }
    }
    pkg.bulk += col.bulk
    pkg.columns.push(col)
  }
  return pkg
}

/** One failure: release, run out, deposit, fix the loads. Returns the event. */
function failOnce(eng: EngineState, P: EngineParams, st: StabilityResult, from: number, to: number, step: number, tYr: number, ageMa: number, trig: TriggerInfo): FailureEvent {
  const rec = eng.rec
  const nx = rec.nx
  const dx = rec.dx
  const top = rec.nLayers - 1
  const pkg = release(eng, P, st, from, to)
  recomputeH(eng, P) // the scar is the bed the debris runs over

  // the flow: blocks along x, each with its own sand and mud (m^2) and bulk area at flow density
  const cv = (P.runDensity - RHO_W) / (RHO_S - RHO_W)
  const edges: number[] = [from * dx]
  const area: number[] = []
  const bSand: number[] = []
  const bMud: number[] = []
  for (const col of pkg.columns) {
    let sand = 0
    let mud = 0
    for (let q = 0; q < col.layers.length; q++) {
      sand += col.sand[q]
      mud += col.mud[q]
    }
    for (let b = 0; b < BLOCKS_PER_COLUMN; b++) {
      const sa = (sand * dx) / BLOCKS_PER_COLUMN
      const mu = (mud * dx) / BLOCKS_PER_COLUMN
      bSand.push(sa)
      bMud.push(mu)
      area.push((sa + mu) / cv)
      edges.push((col.column + (b + 1) / BLOCKS_PER_COLUMN) * dx)
    }
  }
  const xMax = nx * dx
  const flow = runOut({ edges, area, bed: rec.H, dx, xMax, rhoFlow: P.runDensity, rhoWater: RHO_W, tauY: P.runYield, mu: P.runViscosity })

  // where the blocks ended up: fractions of each block by overlap with the cells (m^2 per column)
  const depSand = new Float64Array(nx)
  const depMud = new Float64Array(nx)
  let expSand = 0
  let expMud = 0
  const toCell = (c: number): number => {
    let k = c
    while (k < nx && rec.material[top * nx + k] === SALT) k++ // debris cannot enter a salt cell: it slides on to the next
    return k
  }
  for (let b = 0; b < area.length; b++) {
    if (flow.gone[b]) {
      expSand += bSand[b]
      expMud += bMud[b]
      continue
    }
    const x0 = flow.edges[b]
    const x1 = flow.edges[b + 1]
    const w = x1 - x0
    const pieces: Array<{ c: number; f: number }> = []
    let fOut = 0
    let used = 0
    if (x1 > xMax) fOut = (x1 - Math.max(x0, xMax)) / w
    if (x0 < 0) {
      const f = (Math.min(x1, 0) - x0) / w // the part behind the landward edge goes into column 0
      pieces.push({ c: 0, f })
    }
    const lo = Math.max(x0, 0)
    const hi = Math.min(x1, xMax)
    if (hi > lo) {
      const c0 = Math.min(nx - 1, Math.floor(lo / dx))
      const c1 = Math.min(nx - 1, Math.floor(hi / dx))
      for (let c = c0; c <= c1; c++) {
        const ov = Math.min(hi, (c + 1) * dx) - Math.max(lo, c * dx)
        if (ov > 0) pieces.push({ c, f: ov / w })
      }
    }
    for (let p = 0; p < pieces.length; p++) used += pieces[p].f
    // pin the pieces so that they plus the exported part add up to the whole block exactly
    if (pieces.length > 0) pieces[pieces.length - 1].f += 1 - fOut - used
    else fOut = 1
    for (const p of pieces) {
      const c = toCell(p.c)
      if (c >= nx) {
        fOut += p.f
        continue
      }
      depSand[c] += p.f * bSand[b]
      depMud[c] += p.f * bMud[b]
    }
    expSand += fOut * bSand[b]
    expMud += fOut * bMud[b]
  }

  // write the deposit into the top layer, cell by cell
  const smaxM = mtdSmax(P)
  let depositedSand = 0
  let depositedMud = 0
  let dFrom = -1
  let dTo = -1
  for (let c = 0; c < nx; c++) {
    const dS = depSand[c] / dx
    const dM = depMud[c] / dx
    const sNew = dS + dM
    if (!(sNew > 0)) continue
    const i = top * nx + c
    const sOld = rec.sand[i] + rec.mud[i]
    rec.smax[i] = (sOld * rec.smax[i] + sNew * smaxM) / (sOld + sNew)
    rec.sand[i] += dS
    rec.mud[i] += dM
    if (rec.material[i] !== MTD && sNew >= sOld) rec.material[i] = MTD
    setPor(eng, P, i, rec.smax[i])
    depositedSand += dS * dx
    depositedMud += dM * dx
    if (dFrom < 0) dFrom = c
    dTo = c
  }

  // instantaneous change of load at constant excess pore pressure, in every touched column
  const touched = new Uint8Array(nx)
  for (let j = from; j <= to; j++) touched[j] = 1
  for (let c = 0; c < nx; c++) if (depSand[c] + depMud[c] > 0) touched[c] = 1
  for (let c = 0; c < nx; c++) {
    if (!touched[c]) continue
    let above = 0
    for (let l = top; l >= 0; l--) {
      const i = l * nx + c
      if (rec.material[i] === SALT) continue
      const s = rec.sand[i] + rec.mud[i]
      if (s <= EMPTY) continue
      const L = buoyantLoad(above, s)
      above += s
      const u = rec.u[i] + (L - eng.ld[i])
      rec.u[i] = u > L ? L : u
      eng.ld[i] = L
    }
  }
  recomputeH(eng, P)

  // ledger: what ran off the section is exported; cement is dropped with the debris
  rec.ledger.cumOut.sand += expSand
  rec.ledger.cumOut.mud += expMud
  rec.ledger.cumOut.cement += pkg.cement * dx

  let scar = 0
  for (const col of pkg.columns) if (col.depth > scar) scar = col.depth
  let front = edges[edges.length - 1]
  for (let b = 0; b < area.length; b++) if (flow.edges[b + 1] > front) front = flow.edges[b + 1]
  return {
    id: eng.events.length + 1,
    step,
    tYr,
    ageMa,
    sourceFrom: from,
    sourceTo: to,
    scarDepth: scar,
    volume: pkg.bulk * dx,
    sand: pkg.sand * dx,
    mud: pkg.mud * dx,
    cement: pkg.cement * dx,
    exportedSand: expSand,
    exportedMud: expMud,
    depositedSand,
    depositedMud,
    runout: front - edges[edges.length - 1],
    flowTime: flow.time,
    layer: top,
    depositFrom: dFrom,
    depositTo: dTo,
    ...trig,
  }
}

/** The trigger fields of an event (triggers.ts), worked out from the state BEFORE the failure. */
type TriggerInfo = Pick<FailureEvent, 'cause' | 'dSlope' | 'dPress' | 'dSeaLevel' | 'loadRate' | 'seedColumn'>

/** Tag a failure of columns from..to found in `st` (rule in triggers.ts). */
function triggerOf(eng: EngineState, P: EngineParams, st: StabilityResult, from: number, to: number, step: number, tYr: number, seaLevel?: SeaLevelCurve): TriggerInfo {
  const rec = eng.rec
  const nx = rec.nx
  let seed = from
  for (let j = from; j <= to; j++) if (st.fsMin[j] < st.fsMin[seed]) seed = j
  const h = eng.hist
  const slot = referenceSlot(h, step)
  let tanThen = st.slope[seed]
  let ruThen = NaN
  let dSea = 0
  let loadRate = 0
  if (slot >= 0) {
    tanThen = h.slope[slot * nx + seed]
    ruThen = h.ru[slot * nx + seed]
    const tThen = h.tYr[slot]
    if (seaLevel) dSea = seaLevel(tYr) - seaLevel(tThen)
    // bulk gained since the reference step: layers deposited by steps ref+1 .. step (layer l comes from step l-1)
    let gained = 0
    for (let l = h.step[slot] + 2; l < rec.nLayers; l++) gained += cellBulk(eng, P, l * nx + seed)
    if (tYr > tThen) loadRate = gained / (tYr - tThen)
  }
  const r = attributeCause({
    tanNow: st.slope[seed],
    tanThen,
    ruNow: st.critLayer[seed] >= 0 ? st.ru[seed] : NaN,
    ruThen,
    dSeaLevel: dSea,
    loadRate,
    failLowstandDrop: P.failLowstandDrop,
    failRapidRate: P.failRapidRate,
  })
  return { cause: r.cause, dSlope: r.dSlope, dPress: r.dPress, dSeaLevel: dSea, loadRate, seedColumn: seed }
}

/**
 * Check every column and fail the unstable ones, as described in the header. Called by step()
 * after compaction. Appends to eng.events and returns the new events. Leaves the engine exactly
 * as if it had been rebuilt from the record (loads cached, surface recomputed). Every event is
 * tagged with its dominant trigger (triggers.ts); `seaLevel` (optional) lets it see a sea-level fall.
 * At the end the slope and pressure of every column are stored in eng.hist for later events.
 */
export function failureStep(eng: EngineState, P: EngineParams, step: number, tYr: number, ageMa: number, seaLevel?: SeaLevelCurve): FailureEvent[] {
  const out: FailureEvent[] = []
  const opt = { minSlope: Math.tan((P.failSlopeMin * Math.PI) / 180), minDepth: P.failMinDepth }
  let iter = 0
  let st = computeStability(eng, P, opt)
  for (; iter < P.failMaxIters; iter++) {
    const run = pickFailure(st.fsMin, P.failMaxCells)
    if (!run) break
    const trig = triggerOf(eng, P, st, run.from, run.to, step, tYr, seaLevel)
    const ev = failOnce(eng, P, st, run.from, run.to, step, tYr, ageMa, trig)
    eng.events.push(ev)
    out.push(ev)
    st = computeStability(eng, P, opt) // the scar is a new headwall
  }
  if (iter === P.failMaxIters && pickFailure(st.fsMin, P.failMaxCells)) eng.diag.failUnresolved++
  recordHistory(eng.hist, eng.rec.nx, step, tYr, st)
  return out
}

export interface MtdLine {
  released: number
  deposited: number
  exported: number
  /** released - deposited - exported, m^2. */
  error: number
  /** Worst relative error of any single event. */
  worstRel: number
}

/** The 'moved by MTDs' lines of the balance, per grain size, from the event list. */
export function mtdBalance(events: readonly FailureEvent[]): { sand: MtdLine; mud: MtdLine } {
  const line = (rel: (e: FailureEvent) => [number, number, number]): MtdLine => {
    const r: MtdLine = { released: 0, deposited: 0, exported: 0, error: 0, worstRel: 0 }
    for (const e of events) {
      const [rel0, dep, exp] = rel(e)
      r.released += rel0
      r.deposited += dep
      r.exported += exp
      const err = rel0 - dep - exp
      const w = rel0 > 0 ? Math.abs(err) / rel0 : 0
      if (w > r.worstRel) r.worstRel = w
    }
    r.error = r.released - r.deposited - r.exported
    return r
  }
  return {
    sand: line((e) => [e.sand, e.depositedSand, e.exportedSand]),
    mud: line((e) => [e.mud, e.depositedMud, e.exportedMud]),
  }
}
