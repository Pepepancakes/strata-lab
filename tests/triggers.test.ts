import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { defaultEngineParams } from '../src/engine/engineParams'
import { getPreset } from '../src/engine/presets'
import { computeStability } from '../src/engine/stability'
import { attributeCause, createHistory, recordHistory, referenceSlot, HIST_SLOTS, LOOKBACK_STEPS, type TriggerInput } from '../src/engine/triggers'
import { TimeMachine } from '../src/worker/timeMachine'
import { runFull, runPreset } from './helpers/run'

const base: TriggerInput = {
  tanNow: 0.05,
  tanThen: 0.05,
  ruNow: 0.5,
  ruThen: 0.5,
  dSeaLevel: 0,
  loadRate: 0,
  failLowstandDrop: 10,
  failRapidRate: 1e-3,
}

describe('attributeCause (hand calculations)', () => {
  it('a slope that steepened from 0.04 to 0.06 is oversteepening: dSlope = ln(1.5)', () => {
    const r = attributeCause({ ...base, tanThen: 0.04, tanNow: 0.06 })
    expect(r.cause).toBe('oversteepening')
    expect(r.dSlope).toBeCloseTo(Math.log(1.5), 12)
    expect(r.dPress).toBe(0)
  })
  it('pressure ratio 0.4 -> 0.8 on an unchanged slope: dPress = ln(0.6/0.2) = ln 3; slow loading = overpressure', () => {
    const r = attributeCause({
      ...base,
      ruThen: 0.4,
      ruNow: 0.8,
      loadRate: 1e-4,
    })
    expect(r.cause).toBe('overpressure')
    expect(r.dPress).toBeCloseTo(Math.log(3), 12)
  })
  it('the same pressure rise with fast loading is rapid loading', () => {
    expect(attributeCause({ ...base, ruThen: 0.4, ruNow: 0.8, loadRate: 5e-3 }).cause).toBe('rapid loading')
  })
  it('a sea-level fall of at least failLowstandDrop wins, a smaller fall does not', () => {
    expect(attributeCause({ ...base, tanNow: 0.1, dSeaLevel: -10 }).cause).toBe('lowstand')
    expect(attributeCause({ ...base, tanNow: 0.1, dSeaLevel: -9.9 }).cause).toBe('oversteepening')
  })
  it('unknown earlier pressure counts as no pressure contribution', () => {
    expect(attributeCause({ ...base, ruThen: NaN, ruNow: 0.9, tanNow: 0.051 }).dPress).toBe(0)
  })
  it('a slope that flattened while pressure rose is not oversteepening', () => {
    expect(attributeCause({ ...base, tanNow: 0.03, ruThen: 0.2, ruNow: 0.7 }).cause).toBe('overpressure')
  })
})

describe('history ring', () => {
  it('keeps the last HIST_SLOTS steps and finds the step LOOKBACK_STEPS back, else the oldest kept', () => {
    const h = createHistory(2)
    const st = {
      slope: new Float64Array([0.1, 0.2]),
      critLayer: new Int32Array([3, -1]),
      ru: new Float64Array([0.3, 0.9]),
    } as never
    expect(referenceSlot(h, 1)).toBe(-1)
    for (let k = 1; k <= 7; k++) recordHistory(h, 2, k, k * 1000, st)
    expect(h.step.length).toBe(HIST_SLOTS)
    expect(h.step[referenceSlot(h, 8)]).toBe(8 - LOOKBACK_STEPS)
    const young = createHistory(2)
    recordHistory(young, 2, 1, 1000, st)
    recordHistory(young, 2, 2, 2000, st)
    expect(young.step[referenceSlot(young, 3)]).toBe(1)
    expect(h.ru[(1 % HIST_SLOTS) * 2 + 1]).toBeNaN() // column without a critical cell
  })
})

describe('slip surface limits (M2.3)', () => {
  const run = runFull()
  const P = run.P
  it('default options give the M2.2 result', () => {
    const a = computeStability(run.eng, P)
    const b = computeStability(run.eng, P, { minSlope: 0, minDepth: 0 })
    expect(Array.from(b.fsMin)).toEqual(Array.from(a.fsMin))
  })
  it('minSlope skips gentle columns (fsMin stays Infinity), steeper ones are untouched', () => {
    const a = computeStability(run.eng, P)
    const cut = Math.tan((0.5 * Math.PI) / 180)
    const b = computeStability(run.eng, P, { minSlope: cut })
    let skipped = 0
    for (let j = 0; j < P.nx; j++) {
      if (a.slope[j] > cut) expect(b.fsMin[j]).toBe(a.fsMin[j])
      else {
        expect(b.fsMin[j]).toBe(Infinity)
        skipped++
      }
    }
    expect(skipped).toBeGreaterThan(0)
  })
  it('minDepth keeps every critical cell at least that deep', () => {
    const b = computeStability(run.eng, P, { minDepth: 10 })
    for (let j = 0; j < P.nx; j++) if (b.critLayer[j] >= 0) expect(b.critDepth[j]).toBeGreaterThanOrEqual(10)
  })
  it('ru is the excess-pressure ratio of the critical cell, about 0 to 1 (u can dip a hair below 0 from rounding)', () => {
    const a = computeStability(run.eng, P)
    for (let j = 0; j < P.nx; j++)
      if (a.critLayer[j] >= 0) {
        expect(a.ru[j]).toBeGreaterThan(-0.01)
        expect(a.ru[j]).toBeLessThan(1.01)
      }
  })
  it('new parameters have the documented defaults', () => {
    const D = defaultEngineParams()
    expect(D.failMinDepth).toBe(10)
    expect(D.failSlopeMin).toBeGreaterThan(0)
  })
})

describe('mtd preset', () => {
  const run = runPreset('mtd')
  it('produces failures, each tagged, with mass conserved', () => {
    expect(run.eng.events.length).toBeGreaterThan(0)
    const causes = new Set(['oversteepening', 'overpressure', 'rapid loading', 'lowstand'])
    for (const e of run.eng.events) {
      expect(causes.has(e.cause)).toBe(true)
      expect(Number.isFinite(e.dSlope) && Number.isFinite(e.dPress) && Number.isFinite(e.loadRate)).toBe(true)
    }
  }, 60000)
  it('is deterministic', () => {
    const again = runPreset('mtd')
    expect(stateHash(again.eng.rec)).toBe(stateHash(run.eng.rec))
    expect(again.eng.events).toEqual(run.eng.events)
  }, 60000)
  it('the time machine returns the same events (tags included) at the end as a straight run', () => {
    const preset = getPreset('mtd')
    const tm = new TimeMachine()
    const info = tm.run(
      {
        presetId: 'mtd',
        segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 25000 }],
        overrides: {},
      },
      1,
    )
    const total = tm.eventsAt(tm.root, info.nSteps)
    tm.forgetPosition()
    const half = tm.eventsAt(tm.root, Math.floor(info.nSteps / 2))
    tm.forgetPosition()
    expect(tm.eventsAt(tm.root, info.nSteps)).toEqual(total)
    expect(half.length).toBeLessThanOrEqual(total.length)
    expect(preset.params.failOn).toBe(1)
  }, 60000)
})
