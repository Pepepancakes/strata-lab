import { describe, it, expect } from 'vitest'
import {
  SALT,
  SEDIMENT,
  appendLayer,
  createRecord,
  deserialiseRecord,
  markInitialLedger,
  recordBalance,
  recordBytes,
  serialiseRecord,
  storedVolumes,
  type LayerRecord,
} from '../src/engine/record'
import { restore, snapshot, stateHash } from '../src/engine/determinism'
import { buildSchedule } from '../src/engine/schedule'

/** Hand-built column 1: sediment (layer 0), salt (layer 1), sediment (layer 2). Other columns plain. */
function saltCanopyRecord(): LayerRecord {
  const rec = createRecord({ nx: 3, dx: 1000, capacity: 6, startAgeMa: 3 })
  for (let j = 0; j < 3; j++) {
    rec.b[j] = -2000 - j
    rec.sand[j] = 1.5
    rec.mud[j] = 3.5
    rec.smax[j] = 2e7
  }
  markInitialLedger(rec)
  appendLayer(rec, 5000, 2.995, 5000)
  // salt cell in column 1, 100 m thick, stored in `mud`
  rec.material[1 * 3 + 1] = SALT
  rec.mud[1 * 3 + 1] = 100
  rec.ledger.cumIn.salt += 100 * 1000
  appendLayer(rec, 5000, 2.99, 10000)
  for (let j = 0; j < 3; j++) {
    rec.sand[2 * 3 + j] = 2
    rec.mud[2 * 3 + j] = 4
    rec.u[2 * 3 + j] = 1.25e5 + j
    rec.smax[2 * 3 + j] = 1e6
    rec.H[j] = -1500 - 0.1 * j
  }
  rec.ledger.cumIn.sand += 2 * 3 * 1000
  rec.ledger.cumIn.mud += 4 * 3 * 1000
  return rec
}

describe('record with salt above sediment', () => {
  it('reports salt separately in the balance, with sand and mud unpolluted', () => {
    const rec = saltCanopyRecord()
    const vol = storedVolumes(rec)
    expect(vol.salt).toBe(100 * 1000)
    expect(vol.sand).toBe((3 * 1.5 + 3 * 2) * 1000)
    const bal = recordBalance(rec)
    expect(bal.salt.stored).toBe(100 * 1000)
    expect(bal.salt.error).toBe(0)
    expect(bal.sand.error).toBe(0)
    expect(bal.mud.error).toBe(0)
  })
  it('detects a salt-only loss that the total would hide', () => {
    const rec = saltCanopyRecord()
    rec.mud[1 * 3 + 1] -= 10 // lose 10 m of salt, nothing else
    const bal = recordBalance(rec)
    expect(bal.salt.error).toBe(-10 * 1000)
    expect(bal.salt.relError).toBeCloseTo(-0.1, 12)
    expect(bal.sand.error).toBe(0)
  })
  it('round-trips through snapshot and restore', () => {
    const rec = saltCanopyRecord()
    const h = stateHash(rec)
    const snap = snapshot(rec)
    // scribble over everything, including a new layer, then rewind
    rec.sand.fill(9)
    rec.material.fill(0)
    rec.ledger.cumIn.salt = 5
    appendLayer(rec, 5000, 2.985, 15000)
    rec.H[0] = 42
    expect(stateHash(rec)).not.toBe(h)
    restore(snap, rec)
    expect(stateHash(rec)).toBe(h)
    expect(rec.nLayers).toBe(3)
    expect(rec.material[1 * 3 + 1]).toBe(SALT)
    expect(rec.material[0]).toBe(SEDIMENT)
    expect(rec.sand[3 * 3]).toBe(0) // beyond the snapshot is zeroed
  })
  it('round-trips through serialisation, bit for bit', () => {
    const rec = saltCanopyRecord()
    const copy = deserialiseRecord(serialiseRecord(rec), 10)
    expect(stateHash(copy)).toBe(stateHash(rec)) // capacity differs, hash does not care
    expect(copy.material[1 * 3 + 1]).toBe(SALT)
    expect(copy.material[2 * 3 + 1]).toBe(SEDIMENT)
    expect(recordBalance(copy).salt.stored).toBe(100 * 1000)
    expect(Array.from(copy.stepAgeMa.subarray(0, 3))).toEqual([3, 2.995, 2.99])
  })
})

describe('determinism harness', () => {
  it('hash changes on a one-bit change and is stable otherwise', () => {
    const a = saltCanopyRecord()
    const b = saltCanopyRecord()
    expect(stateHash(a)).toBe(stateHash(b))
    expect(stateHash(a)).toMatch(/^[0-9a-f]{16}$/)
    b.u[2 * 3 + 2] = b.u[2 * 3 + 2] + 1e-10
    expect(stateHash(a)).not.toBe(stateHash(b))
  })
  it('refuses to append past capacity', () => {
    const rec = createRecord({ nx: 2, dx: 1, capacity: 2, startAgeMa: 1 })
    appendLayer(rec, 1, 0.5, 1)
    expect(() => appendLayer(rec, 1, 0, 2)).toThrow(/capacity/)
  })
})

describe('long-run capacity and memory', () => {
  it('holds a 66 Myr schedule plus the last 3 Myr at 5 kyr within 60 MB per state', () => {
    const sched = buildSchedule([
      { fromAgeMa: 66, toAgeMa: 3, dt: 100000 },
      { fromAgeMa: 3, toAgeMa: 0, dt: 5000 },
    ])
    const capacity = sched.nSteps + 1
    const bytes = recordBytes(400, capacity)
    console.log(`66 Myr record: ${capacity} layers x 400 columns = ${(bytes / 1e6).toFixed(1)} MB`)
    expect(bytes).toBeLessThanOrEqual(60e6)
    const rec = createRecord({ nx: 400, dx: 1000, capacity, startAgeMa: sched.startAgeMa })
    for (let k = 0; k < sched.nSteps; k++) appendLayer(rec, sched.stepDt[k], sched.stepAgeMa[k], sched.tEndYr[k])
    expect(rec.nLayers).toBe(capacity)
    expect(rec.stepAgeMa[capacity - 1]).toBe(0)
    expect(rec.tDep[(capacity - 1) * 400]).toBe(66e6)
    const actual =
      rec.sand.byteLength + rec.mud.byteLength + rec.smax.byteLength + rec.u.byteLength + rec.tDep.byteLength + rec.material.byteLength +
      rec.stepDt.byteLength + rec.stepAgeMa.byteLength + rec.b.byteLength + rec.H.byteLength
    expect(actual).toBe(bytes)
  })
})
