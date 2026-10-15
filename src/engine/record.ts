// The stratigraphic record: the ONLY source of truth for geology. Every view, solver and well
// reads from this; nothing else stores rock.
//
// Shape (SI, flat typed arrays, index = layer * nx + column, as in spike 001):
//   sand, mud   solid thickness of each grain size in the cell, m (no pores)
//   smax        past maximum effective stress, Pa
//   u           excess pore pressure state, Pa (spike's `u`)
//   tDep        deposition time, ELAPSED years since the run started (end of the record step)
//   material    Uint8 tag per cell: SEDIMENT (0) or SALT (1)
// Per column: b = basement elevation, H = surface elevation (m).
// Per layer:  stepDt = duration of that record step (yr), stepAgeMa = age at its END (Ma).
//
// Layer 0 is the pre-existing substrate (stepDt 0, stepAgeMa = age at run start). Each record
// step then appends one layer to every column with appendLayer(). Steps may differ in length
// (see schedule.ts); nothing here assumes a fixed dtRec.
//
// Salt rule (spike 002): salt is a material tag on cells, NOT a special bottom layer, so a column
// may hold salt above sediment (a canopy). A salt cell stores its thickness in `mud`, with
// `sand` = 0 (salt has no pores and no grain size). Balance is reported per class
// (sand, mud, salt) using the tag, so salt never leaks into the sand or mud totals.
// M1 creates no salt, but record, serialisation and balance handle it.
//
// Cached porosities and permeabilities from the spike are NOT stored here; they are derived
// from smax and recomputed on restore.
//
// Memory: 5 Float64 arrays + 1 Uint8 array of capacity * nx cells. 400 columns x 1,300 layers
// is about 21 MB (tests report this).

export const SEDIMENT = 0
export const SALT = 1

/** Volumes per class in m^2 (2D section: thickness x column width, per metre of margin). */
export interface ClassVolumes {
  sand: number
  mud: number
  salt: number
}

/** Running totals the solvers update. The balance compares them with what is stored. */
export interface Ledger {
  cumIn: ClassVolumes
  cumOut: ClassVolumes
  /** Stored at the moment the run began (set by markInitialLedger). */
  init: ClassVolumes
}

export interface LayerRecord {
  nx: number
  dx: number
  capacity: number
  /** Layers in use, including layer 0 (the substrate). */
  nLayers: number
  b: Float64Array
  H: Float64Array
  sand: Float64Array
  mud: Float64Array
  smax: Float64Array
  u: Float64Array
  tDep: Float64Array
  material: Uint8Array
  stepDt: Float64Array
  stepAgeMa: Float64Array
  ledger: Ledger
}

/** Field names, in the fixed order used by hash, snapshot and serialisation. */
export const COLUMN_FIELDS = ['b', 'H'] as const
export const CELL_FLOAT_FIELDS = ['sand', 'mud', 'smax', 'u', 'tDep'] as const
export const LAYER_FIELDS = ['stepDt', 'stepAgeMa'] as const

export const MAX_COLUMNS = 400

export interface RecordOptions {
  nx: number
  dx: number
  /** Maximum number of layers, including the substrate layer 0. */
  capacity: number
  /** Age at run start, Ma. */
  startAgeMa: number
}

export const zeroVolumes = (): ClassVolumes => ({ sand: 0, mud: 0, salt: 0 })
export const copyVolumes = (v: ClassVolumes): ClassVolumes => ({ sand: v.sand, mud: v.mud, salt: v.salt })
export const copyLedger = (l: Ledger): Ledger => ({
  cumIn: copyVolumes(l.cumIn),
  cumOut: copyVolumes(l.cumOut),
  init: copyVolumes(l.init),
})

/** Bytes used by a record of this size (typed arrays only). */
export function recordBytes(nx: number, capacity: number): number {
  const cells = nx * capacity
  return cells * (5 * 8 + 1) + capacity * 2 * 8 + nx * 2 * 8
}

export function createRecord(opts: RecordOptions): LayerRecord {
  const { nx, dx, capacity, startAgeMa } = opts
  if (!Number.isInteger(nx) || nx < 1 || nx > MAX_COLUMNS) throw new Error(`record: nx must be 1..${MAX_COLUMNS}`)
  if (!(dx > 0)) throw new Error('record: dx must be positive')
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('record: capacity must be >= 1')
  const cells = nx * capacity
  const rec: LayerRecord = {
    nx,
    dx,
    capacity,
    nLayers: 1,
    b: new Float64Array(nx),
    H: new Float64Array(nx),
    sand: new Float64Array(cells),
    mud: new Float64Array(cells),
    smax: new Float64Array(cells),
    u: new Float64Array(cells),
    tDep: new Float64Array(cells),
    material: new Uint8Array(cells),
    stepDt: new Float64Array(capacity),
    stepAgeMa: new Float64Array(capacity),
    ledger: { cumIn: zeroVolumes(), cumOut: zeroVolumes(), init: zeroVolumes() },
  }
  rec.stepAgeMa[0] = startAgeMa
  return rec
}

/**
 * Append one layer (one record step) to every column. The new layer starts empty
 * (material SEDIMENT, zero thickness); the caller fills it. Returns the new layer index.
 */
export function appendLayer(rec: LayerRecord, dtYr: number, ageMa: number, tEndYr: number): number {
  if (rec.nLayers >= rec.capacity) throw new Error('record: capacity exceeded')
  const k = rec.nLayers++
  rec.stepDt[k] = dtYr
  rec.stepAgeMa[k] = ageMa
  rec.tDep.fill(tEndYr, k * rec.nx, (k + 1) * rec.nx)
  return k
}

/** Solid volume stored right now, per class, in m^2 (thickness summed over cells x dx). */
export function storedVolumes(rec: LayerRecord): ClassVolumes {
  const out = zeroVolumes()
  const n = rec.nLayers * rec.nx
  // fixed order: cell index ascending, so the sums are reproducible
  for (let i = 0; i < n; i++) {
    if (rec.material[i] === SALT) out.salt += rec.mud[i] + rec.sand[i]
    else {
      out.sand += rec.sand[i]
      out.mud += rec.mud[i]
    }
  }
  out.sand *= rec.dx
  out.mud *= rec.dx
  out.salt *= rec.dx
  return out
}

/** Call once after building the starting substrate: what is stored now is the "initial" amount. */
export function markInitialLedger(rec: LayerRecord): void {
  rec.ledger.init = storedVolumes(rec)
}

export interface ClassBalance {
  stored: number // stored - init
  expected: number // cumIn - cumOut
  error: number
  /** error / cumIn (or / init when nothing has come in yet); 0 when both are zero. */
  relError: number
}
export type RecordBalance = Record<keyof ClassVolumes, ClassBalance>

/** Mass balance per class (sand, mud, salt), as the Known Traps in handover.md require. */
export function recordBalance(rec: LayerRecord): RecordBalance {
  const now = storedVolumes(rec)
  const { cumIn, cumOut, init } = rec.ledger
  const one = (key: keyof ClassVolumes): ClassBalance => {
    const stored = now[key] - init[key]
    const expected = cumIn[key] - cumOut[key]
    const error = stored - expected
    const scale = cumIn[key] > 0 ? cumIn[key] : init[key]
    return { stored, expected, error, relError: scale > 0 ? error / scale : 0 }
  }
  return { sand: one('sand'), mud: one('mud'), salt: one('salt') }
}

// ---- serialisation -------------------------------------------------------
// Binary: 4-byte little-endian header length, UTF-8 JSON header, then the used part of each
// array in the fixed order above. Only layers 0..nLayers-1 are written.

const FORMAT = 'strata-record'
const VERSION = 1

export function serialiseRecord(rec: LayerRecord): Uint8Array {
  const header = new TextEncoder().encode(
    JSON.stringify({ format: FORMAT, version: VERSION, nx: rec.nx, dx: rec.dx, nLayers: rec.nLayers, ledger: rec.ledger }),
  )
  const cells = rec.nLayers * rec.nx
  const parts: Uint8Array[] = []
  const f64 = (a: Float64Array, n: number) => parts.push(new Uint8Array(a.buffer, a.byteOffset, n * 8))
  for (const f of COLUMN_FIELDS) f64(rec[f], rec.nx)
  for (const f of CELL_FLOAT_FIELDS) f64(rec[f], cells)
  parts.push(new Uint8Array(rec.material.buffer, rec.material.byteOffset, cells))
  for (const f of LAYER_FIELDS) f64(rec[f], rec.nLayers)
  let total = 4 + header.length
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  new DataView(out.buffer).setUint32(0, header.length, true)
  out.set(header, 4)
  let off = 4 + header.length
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

export function deserialiseRecord(bytes: Uint8Array, capacity?: number): LayerRecord {
  const hlen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true)
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + hlen)))
  if (head.format !== FORMAT || head.version !== VERSION) throw new Error('record: unknown file format')
  const rec = createRecord({ nx: head.nx, dx: head.dx, capacity: capacity ?? head.nLayers, startAgeMa: 0 })
  if (rec.capacity < head.nLayers) throw new Error('record: capacity smaller than stored layers')
  rec.nLayers = head.nLayers
  rec.ledger = head.ledger
  const cells = head.nLayers * head.nx
  let off = 4 + hlen
  const read = (target: Float64Array | Uint8Array, count: number, size: number) => {
    const dst = new Uint8Array(target.buffer, target.byteOffset, count * size)
    dst.set(bytes.subarray(off, off + count * size))
    off += count * size
  }
  for (const f of COLUMN_FIELDS) read(rec[f], rec.nx, 8)
  for (const f of CELL_FLOAT_FIELDS) read(rec[f], cells, 8)
  read(rec.material, cells, 1)
  for (const f of LAYER_FIELDS) read(rec[f], head.nLayers, 8)
  return rec
}
