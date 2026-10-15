// Determinism harness: state hash, snapshot and restore of the layer record.
// Why: rewind and branching depend on bit-identical results, so we need a cheap way to say
// "these two states are identical" (stateHash) and to go back to an earlier state.
// Snapshots are full copies of the used layers for now; M1.5 optimises them.
//
// stateHash is FNV-1a over the raw bytes, in the fixed field order from record.ts, using two
// 32-bit lanes with different offset bases (16 hex digits). It is not cryptographic.
// Bit patterns are hashed, so 0 and -0 differ, as they should for a bit-identical check.

import {
  CELL_FLOAT_FIELDS,
  COLUMN_FIELDS,
  LAYER_FIELDS,
  copyLedger,
  type Ledger,
  type LayerRecord,
} from './record'

export class Fnv1a {
  private a = 0x811c9dc5
  private b = 0x9747b28c
  private readonly scratch = new DataView(new ArrayBuffer(8))

  bytes(data: Uint8Array): this {
    let a = this.a
    let b = this.b
    for (let i = 0; i < data.length; i++) {
      const c = data[i]
      a = Math.imul(a ^ c, 0x01000193)
      b = Math.imul(b ^ c, 0x01000193)
    }
    this.a = a
    this.b = b
    return this
  }

  f64(a: Float64Array, count = a.length): this {
    return this.bytes(new Uint8Array(a.buffer, a.byteOffset, count * 8))
  }

  number(x: number): this {
    this.scratch.setFloat64(0, x, true)
    return this.bytes(new Uint8Array(this.scratch.buffer))
  }

  hex(): string {
    return (this.a >>> 0).toString(16).padStart(8, '0') + (this.b >>> 0).toString(16).padStart(8, '0')
  }
}

function hashLedger(h: Fnv1a, l: Ledger): void {
  for (const v of [l.cumIn, l.cumOut, l.init]) h.number(v.sand).number(v.mud).number(v.salt)
}

/** Hash of the whole record (used layers only, so capacity does not matter). */
export function stateHash(rec: LayerRecord): string {
  const h = new Fnv1a()
  const cells = rec.nLayers * rec.nx
  h.number(rec.nx).number(rec.dx).number(rec.nLayers)
  for (const f of COLUMN_FIELDS) h.f64(rec[f], rec.nx)
  for (const f of CELL_FLOAT_FIELDS) h.f64(rec[f], cells)
  h.bytes(rec.material.subarray(0, cells))
  for (const f of LAYER_FIELDS) h.f64(rec[f], rec.nLayers)
  hashLedger(h, rec.ledger)
  return h.hex()
}

export interface Snapshot {
  nx: number
  dx: number
  nLayers: number
  columns: Float64Array[]
  cells: Float64Array[]
  material: Uint8Array
  layers: Float64Array[]
  ledger: Ledger
}

export function snapshot(rec: LayerRecord): Snapshot {
  const n = rec.nLayers * rec.nx
  return {
    nx: rec.nx,
    dx: rec.dx,
    nLayers: rec.nLayers,
    columns: COLUMN_FIELDS.map((f) => rec[f].slice()),
    cells: CELL_FLOAT_FIELDS.map((f) => rec[f].slice(0, n)),
    material: rec.material.slice(0, n),
    layers: LAYER_FIELDS.map((f) => rec[f].slice(0, rec.nLayers)),
    ledger: copyLedger(rec.ledger),
  }
}

/** Put the record back exactly as it was. Everything beyond the snapshot's layers is zeroed. */
export function restore(snap: Snapshot, rec: LayerRecord): void {
  if (snap.nx !== rec.nx || snap.dx !== rec.dx) throw new Error('restore: grid mismatch')
  if (snap.nLayers > rec.capacity) throw new Error('restore: record too small for snapshot')
  const n = snap.nLayers * rec.nx
  COLUMN_FIELDS.forEach((f, i) => rec[f].set(snap.columns[i]))
  CELL_FLOAT_FIELDS.forEach((f, i) => {
    rec[f].fill(0, n)
    rec[f].set(snap.cells[i])
  })
  rec.material.fill(0, n)
  rec.material.set(snap.material)
  LAYER_FIELDS.forEach((f, i) => {
    rec[f].fill(0, snap.nLayers)
    rec[f].set(snap.layers[i])
  })
  rec.nLayers = snap.nLayers
  rec.ledger = copyLedger(snap.ledger)
}
