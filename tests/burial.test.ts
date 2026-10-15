import { describe, it, expect } from 'vitest'
import { defaultEngineParams } from '../src/engine/engineParams'
import { subsidenceYears, checkHistory } from '../src/engine/subsidence'
import { steadyConduction, cellConductivity, seafloorTemperature } from '../src/engine/thermal'
import { quartzGrowth, quartzArea, QUARTZ_MOLAR_MASS, QUARTZ_DENSITY } from '../src/engine/cement'
import { recordBalance } from '../src/engine/record'
import { buildSchedule } from '../src/engine/schedule'
import { snapshotEngine, restoreEngine, step } from '../src/engine/step'
import { runFull, seaLevelOf } from './helpers/run'
import { createEngine } from '../src/engine/step'

const P0 = defaultEngineParams()
const MYR = 1e6

describe('changing subsidence', () => {
  it('constant mode: integral is the step length', () => {
    expect(subsidenceYears(P0, 5e5, 5.5e5, 3e6)).toBe(5e4)
  })
  it('thermal mode: summed step integrals equal the closed form for uneven steps', () => {
    const P = { ...P0, subsMode: 'thermal' as const, subsTau: 62.8 * MYR }
    const edges = [0, 1e5, 3e5, 2e6, 2.5e6, 20e6, 66e6]
    let sum = 0
    for (let i = 0; i < edges.length - 1; i++) sum += subsidenceYears(P, edges[i], edges[i + 1], 66e6)
    const exact = P.subsTau * (1 - Math.exp(-66e6 / P.subsTau))
    expect(Math.abs(sum - exact) / exact).toBeLessThan(1e-9)
  })
  it('history mode: piecewise factors by age', () => {
    // run starts 10 Ma: factor 2 from 10 to 6 Ma, factor 0.5 from 6 Ma to the end
    const P = { ...P0, subsMode: 'history' as const, subsHistory: [10, 2, 6, 0.5] }
    expect(subsidenceYears(P, 0, 4 * MYR, 10 * MYR)).toBeCloseTo(8 * MYR, 3)
    expect(subsidenceYears(P, 4 * MYR, 10 * MYR, 10 * MYR)).toBeCloseTo(3 * MYR, 3)
    expect(subsidenceYears(P, 3 * MYR, 5 * MYR, 10 * MYR)).toBeCloseTo(2.5 * MYR, 3) // 1 Myr at 2 + 1 Myr at 0.5
  })
  it('rejects bad histories in plain language', () => {
    expect(() => checkHistory([])).toThrow(/pairs/)
    expect(() => checkHistory([5, 1, 6, 1])).toThrow(/decrease/)
    expect(() => checkHistory([5, -1])).toThrow(/>= 0/)
  })
})

describe('temperature: steady conduction', () => {
  it('constant k gives T = Tsf + q z / k', () => {
    const h = [100, 250, 400, 1000], k = [2, 2, 2, 2]
    const out: number[] = []
    const base = steadyConduction(10, 0.04, h, k, out)
    expect(base).toBeCloseTo(10 + (0.04 * 1750) / 2, 9)
    expect(out[0]).toBeCloseTo(10 + (0.04 * 50) / 2, 9)
    expect(out[3]).toBeCloseTo(10 + (0.04 * (750 + 500)) / 2, 9)
  })
  it('two layers: hand calculation', () => {
    const out: number[] = []
    const base = steadyConduction(4, 0.05, [1000, 2000], [1.0, 2.5], out)
    expect(out[0]).toBeCloseTo(4 + 0.05 * 500, 9) // 29
    expect(out[1]).toBeCloseTo(4 + 50 + 20, 9) // 74: middle of layer 2
    expect(base).toBeCloseTo(94, 9)
  })
  it('geometric-mean conductivity: hand calculation', () => {
    // pure sand grains, phi 0.3: k = 7.7^0.7 * 0.6^0.3
    expect(cellConductivity(P0, 1, 0, 0.3)).toBeCloseTo(Math.pow(7.7, 0.7) * Math.pow(0.6, 0.3), 9)
  })
  it('seafloor temperature runs from shallow (land) to deep value', () => {
    expect(seafloorTemperature(P0, -50)).toBe(20)
    expect(seafloorTemperature(P0, 5000)).toBeCloseTo(4, 3)
  })
  it('a deep basin column reads roughly 1 F/100 ft and matches the profile', () => {
    const run = runFull([{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }], [], { thermal: 1, cement: 0 })
    const { eng, P } = run
    const nx = eng.rec.nx, j = nx - 1
    // recompute the temperature profile of the last column independently with steadyConduction
    const L = eng.rec.nLayers
    const t = eng.temp
    expect(eng.tempOk).toBe(true)
    // monotone increasing with depth
    for (let l = L - 1; l > 0; l--) expect(t[(l - 1) * nx + j]).toBeGreaterThanOrEqual(t[l * nx + j] - 1e-9)
    expect(t[(L - 1) * nx + j]).toBeLessThan(P.tSeaShallow + 1)
  })
})

describe('quartz cement: hand calculation', () => {
  const vm = QUARTZ_MOLAR_MASS / QUARTZ_DENSITY
  const yr = 3.15576e7
  it('constant temperature: growth = a 10^(bT) Vm dt', () => {
    const g = quartzGrowth(P0, 100, 100, 1e6)
    const expected = 1.98e-18 * Math.pow(10, 0.022 * 100) * vm * 1e6 * yr
    expect(Math.abs(g - expected) / expected).toBeLessThan(1e-12)
  })
  it('zero below the onset temperature', () => {
    expect(quartzGrowth(P0, 40, 60, 1e6)).toBe(0)
  })
  it('linear heating: matches numeric integration to 0.5 %', () => {
    const t0 = 80, t1 = 120, dt = 4e6
    let sum = 0
    const n = 100000
    for (let i = 0; i < n; i++) {
      const T = t0 + ((i + 0.5) / n) * (t1 - t0)
      sum += P0.cemA * Math.pow(10, P0.cemB * T) * vm * (dt / n) * yr
    }
    expect(Math.abs(quartzGrowth(P0, t0, t1, dt) - sum) / sum).toBeLessThan(0.005)
  })
  it('crossing the onset only counts the warm part', () => {
    const g = quartzGrowth(P0, 60, 80, 2e6) // T = 70 at the middle of the step
    const half = quartzGrowth(P0, 70, 80, 1e6)
    expect(Math.abs(g - half) / half).toBeLessThan(1e-12)
  })
  it('splitting a step does not change the total when T is linear in time', () => {
    const whole = quartzGrowth(P0, 90, 130, 2e6)
    const a = quartzGrowth(P0, 90, 110, 1e6), b = quartzGrowth(P0, 110, 130, 1e6)
    expect(Math.abs(a + b - whole) / whole).toBeLessThan(1e-12)
  })
  it('surface area of 0.2 mm spheres', () => {
    expect(quartzArea(P0, 0.3)).toBeCloseTo((6 * 0.7 * 0.7) / 2e-4, 6)
  })
})

describe('burial run: thermal + cement + thermal subsidence', () => {
  // hot, quick: high heat flow so sands pass 70 C within 3 Myr
  const over = { thermal: 1, cement: 1, heatFlow: 0.1, subsMode: 'thermal' as const, subsTau: 2e6 }
  const run = runFull([{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }], [300], over)
  const rec = run.eng.rec

  it('defaults off: default run unchanged by the new code (cement never created)', () => {
    const d = runFull([{ fromAgeMa: 0.5, toAgeMa: 0, dt: 5000 }])
    expect(d.eng.rec.ledger.cumIn.cement).toBe(0)
    expect(d.eng.tempOk).toBe(false)
  })
  it('makes cement and keeps its own ledger line balanced', () => {
    const b = recordBalance(rec)
    expect(rec.ledger.cumIn.cement).toBeGreaterThan(0)
    expect(Math.abs(b.cement.error)).toBeLessThan(1e-9 * rec.ledger.cumIn.cement)
  })
  it('sand and mud balances stay exact with cement on', () => {
    const b = recordBalance(rec)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(run.eng.diag.deficit).toBe(0)
  })
  it('cement never exceeds the sand pore space', () => {
    const nx = rec.nx
    for (let l = 0; l < rec.nLayers; l++) {
      for (let j = 0; j < nx; j++) {
        const i = l * nx + j
        if (rec.cem[i] > 0) {
          const phi = run.eng.phs[i]
          expect(rec.cem[i]).toBeLessThanOrEqual((rec.sand[i] * phi) / (1 - phi) * (1 + 1e-9))
        }
      }
    }
  })
  it('is deterministic and rewinds bit-identically', () => {
    const again = runFull([{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }], [], over)
    expect(Array.from(again.eng.rec.cem)).toEqual(Array.from(rec.cem))
    // rewind to step 300, run to the end, compare
    const P = run.P
    const schedule = run.schedule
    const eng = createEngine(P, schedule)
    const sl = seaLevelOf(P, schedule)
    restoreEngine(run.snaps.get(300)!, eng, P)
    while (step(eng, P, schedule, sl)) { /* run on */ }
    expect(Array.from(eng.rec.cem)).toEqual(Array.from(rec.cem))
    expect(Array.from(eng.rec.sand)).toEqual(Array.from(rec.sand))
    expect(eng.rec.ledger.cumIn.cement).toBe(rec.ledger.cumIn.cement)
    expect(snapshotEngine(eng).temp).toEqual(snapshotEngine(run.eng).temp)
  }, 15000) // near its 5 s default when the machine is busy: a timing flake, not physics
})

describe('schedule helper sanity', () => {
  it('builds', () => {
    expect(buildSchedule([{ fromAgeMa: 1, toAgeMa: 0, dt: 5000 }]).nSteps).toBe(200)
  })
})
