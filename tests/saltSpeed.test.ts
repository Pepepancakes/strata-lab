import { describe, expect, it } from 'vitest'
import { defaultEngineParams } from '../src/engine/engineParams'
import { buildSchedule } from '../src/engine/schedule'
import { createEngine, step } from '../src/engine/step'
import { seaLevelOf } from './helpers/run'
import { getPreset } from '../src/engine/presets'

// M3.4: during a bundled-compaction cycle the weight of the old layers is kept from the cycle's first
// step. The sums must be the same bits as summing everything every step.
function run(dropCache: boolean) {
  const preset = getPreset('gulf')
  const P = { ...defaultEngineParams(), ...preset.params, duration: 0.4e6, nx: 120, bundleEvery: 5 }
  const schedule = buildSchedule([{ fromAgeMa: 0.4, toAgeMa: 0, dt: 10000 }])
  const eng = createEngine(P, schedule)
  const sl = seaLevelOf(P, schedule)
  const trace: number[] = []
  while (step(eng, P, schedule, sl)) {
    for (let j = 0; j < eng.rec.nx; j += 7) trace.push(eng.salt.W[j], eng.salt.Sb[j])
    if (dropCache) eng.salt.cacheId = -1 // forces a full rebuild at the next step
  }
  return { trace, H: Array.from(eng.rec.H), sand: Array.from(eng.rec.sand), mud: Array.from(eng.rec.mud) }
}

describe('salt sediment loads cache', () => {
  it('gives bit-identical results to a full sum every step', () => {
    const a = run(false)
    const b = run(true)
    expect(a.trace.length).toBeGreaterThan(100)
    expect(a.trace).toEqual(b.trace)
    expect(a.H).toEqual(b.H)
    expect(a.sand).toEqual(b.sand)
    expect(a.mud).toEqual(b.mud)
  })
})
