// M3.10: the basinward limit of the salt basin (saltLimitStart / saltLimitEnd). Hand calculations of the
// start-up thickness, defaults that change nothing, and a short run that keeps salt out of the last columns
// and still conserves it. Closed-form numbers use 1e-9; no cross-machine number is compared here.
import { describe, expect, it } from 'vitest'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { PARAMS } from '../src/engine/params'
import { initialSaltThickness, saltVolume } from '../src/engine/salt'
import { buildSchedule } from '../src/engine/schedule'
import { createEngine, step } from '../src/engine/step'
import { seaLevelOf } from './helpers/run'

const base = (over: Partial<EngineParams> = {}): EngineParams => ({
  ...defaultEngineParams(), saltOn: 1, saltThick: 2000, saltPinchStart: 10_000, saltPinchEnd: 30_000, ...over,
})

describe('initialSaltThickness with a basinward limit', () => {
  it('the defaults lie beyond any section, so nothing changes', () => {
    const d = defaultEngineParams()
    const maxSection = 400 * 5000 // 400 columns x the widest dx the registry allows
    expect(d.saltLimitStart).toBeGreaterThanOrEqual(maxSection)
    expect(d.saltLimitEnd).toBeGreaterThan(d.saltLimitStart)
    const P = base()
    const noLimit = { ...P, saltLimitStart: 1e12, saltLimitEnd: 2e12 }
    for (let x = 500; x < maxSection; x += 1000) expect(initialSaltThickness(P, x)).toBe(initialSaltThickness(noLimit, x))
  })

  it('is full thickness landward of the start, half at the middle of the ramp, zero from the end (smoothstep)', () => {
    const P = base({ saltLimitStart: 100_000, saltLimitEnd: 140_000 })
    expect(initialSaltThickness(P, 60_000)).toBe(2000)
    expect(initialSaltThickness(P, 100_000)).toBe(2000)
    // smoothstep(0.5) = 0.5; smoothstep(0.25) = 0.15625
    expect(initialSaltThickness(P, 120_000)).toBeCloseTo(1000, 9)
    expect(initialSaltThickness(P, 110_000)).toBeCloseTo(2000 * (1 - 0.15625), 9)
    expect(initialSaltThickness(P, 140_000)).toBe(0)
    expect(initialSaltThickness(P, 250_000)).toBe(0)
  })

  it('the limit and the landward pinch-out do not interfere', () => {
    const P = base({ saltLimitStart: 100_000, saltLimitEnd: 140_000 })
    expect(initialSaltThickness(P, 5_000)).toBe(0)
    expect(initialSaltThickness(P, 20_000)).toBeCloseTo(1000, 9) // middle of the 10 to 30 km ramp
  })

  it('the registry lists both as start-only, tuned, with a reference', () => {
    for (const k of ['saltLimitStart', 'saltLimitEnd']) {
      const p = PARAMS.find((q) => q.key === k)!
      expect(p.startOnly).toBe(true)
      expect(p.source.kind).toBe('tuned')
      expect(p.source.refId).toBe('hudec-2013')
    }
  })
})

describe('a short run with the limit', () => {
  const run = (over: Partial<EngineParams>) => {
    const P = base({ nx: 60, dx: 1000, duration: 2e6, saltVisc: 1e17, coverThick: 300, ...over })
    const schedule = buildSchedule([{ fromAgeMa: 2, toAgeMa: 0, dt: 50_000 }])
    const eng = createEngine(P, schedule)
    const v0 = saltVolume(eng.rec)
    const sl = seaLevelOf(P, schedule)
    while (step(eng, P, schedule, sl)) { /* run to the end */ }
    return { eng, v0, rel: (saltVolume(eng.rec) - v0) / v0 }
  }

  it('starts with no salt basinward of the end of the limit, conserves salt, clips nothing', () => {
    const P = base({ nx: 60, dx: 1000, saltLimitStart: 30_000, saltLimitEnd: 40_000 })
    const e0 = createEngine(P, buildSchedule([{ fromAgeMa: 2, toAgeMa: 0, dt: 50_000 }]))
    for (let j = 40; j < 60; j++) expect(e0.rec.mud[j]).toBe(0)
    expect(e0.rec.mud[34]).toBeCloseTo(2000 * (1 - 0.42525), 6) // x = 34.5 km is 0.45 of the way down the limit ramp: smoothstep(0.45) = 0.42525
    const lim = run({ saltLimitStart: 30_000, saltLimitEnd: 40_000 })
    expect(Math.abs(lim.rel)).toBeLessThan(1e-12)
    expect(lim.eng.diag.saltClip).toBe(0)
  })

  it('explicit far-away limits give the same bits as the defaults (same machine)', () => {
    const a = run({})
    const b = run({ saltLimitStart: 9e6, saltLimitEnd: 9.5e6 })
    expect(Array.from(b.eng.rec.mud.subarray(0, 60))).toEqual(Array.from(a.eng.rec.mud.subarray(0, 60)))
    expect(Array.from(b.eng.rec.H)).toEqual(Array.from(a.eng.rec.H))
  })
})
