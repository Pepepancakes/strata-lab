// M2.1 slope stability. Hand calculations are written out here independently of stability.ts:
// they rebuild the stresses from porosity and densities, not from the engine's buoyant-load helper.
import { describe, it, expect } from 'vitest'
import { computeStability, infiniteSlopeFS, seafloorSlope } from '../src/engine/stability'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { allocateEngine, type EngineState } from '../src/engine/state'
import { appendLayer, createRecord } from '../src/engine/record'
import { rebuildCaches, cellBulk } from '../src/engine/compaction'
import { G, RHO_S, RHO_W } from '../src/engine/constants'
import { snapshotEngine, restoreEngine } from '../src/engine/step'
import { runFull } from './helpers/run'

const rad = (d: number): number => (d * Math.PI) / 180
const close = (a: number, b: number, tol = 1e-9): void => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(tol)

/** Three columns, 1 km apart; the middle one has a seafloor slope of tan(beta) = 0.05. */
function build(layers: { mud: number; sand?: number; u?: number }[], H = [0, 50, 100], P: EngineParams = defaultEngineParams()) {
  const rec = createRecord({ nx: 3, dx: 1000, capacity: layers.length + 1, startAgeMa: 1 })
  const eng = allocateEngine(rec)
  layers.forEach((ly, n) => {
    const k = appendLayer(rec, 1000, 1 - n * 0.001, (n + 1) * 1000)
    for (let j = 0; j < 3; j++) {
      rec.mud[k * 3 + j] = ly.mud
      rec.sand[k * 3 + j] = ly.sand ?? 0
      rec.u[k * 3 + j] = ly.u ?? 0
    }
  })
  rebuildCaches(eng, P) // smax = 0: surface porosity, fine for a hand check
  rec.H.set(H)
  return { eng, P }
}

describe('infinite-slope factor of safety: hand calculations (middle column, tan(beta) = 0.05)', () => {
  const phiM = rad(25)
  const tanB = 0.05

  it('drained, c = 0: FS = tan(phi)/tan(beta)', () => {
    const { eng, P } = build([{ mud: 20 }])
    const r = computeStability(eng, P)
    close(r.fsMin[1], Math.tan(phiM) / tanB)
    expect(r.critLayer[1]).toBe(1)
  })

  it('submerged hydrostatic, built from porosity and densities: same FS', () => {
    const { eng, P } = build([{ mud: 20 }])
    // gamma' z with gamma' = (rho_sat - rho_w) g and z the mid-point of the 20 m of solids' bulk thickness
    const phi = eng.phm[1 * 3 + 1]
    const rhoSat = phi * RHO_W + (1 - phi) * RHO_S
    const z = cellBulk(eng, P, 1 * 3 + 1) / 2
    const sigma = (rhoSat - RHO_W) * G * z // = effective vertical stress, hydrostatic
    const beta = Math.atan(tanB)
    const fs = (sigma * Math.cos(beta) ** 2 * Math.tan(phiM)) / (sigma * Math.sin(beta) * Math.cos(beta))
    const r = computeStability(eng, P)
    close(fs, Math.tan(phiM) / tanB)
    close(r.fsMin[1], fs)
    close(r.critDepth[1], z)
  })

  it('excess pore pressure ratio r_u = 0.5 halves the frictional FS', () => {
    const dry = build([{ mud: 20 }])
    const L = (RHO_S - RHO_W) * G * 10 // buoyant load at the mid-point of 20 m of solids
    const wet = build([{ mud: 20, u: 0.5 * L }])
    close(computeStability(wet.eng, wet.P).fsMin[1], 0.5 * computeStability(dry.eng, dry.P).fsMin[1])
    close(computeStability(wet.eng, wet.P).fsMin[1], 0.5 * Math.tan(phiM) / tanB)
  })

  it('cohesion: FS = [c + s cos^2 b tan(phi)] / [L sin b cos b]', () => {
    const P = { ...defaultEngineParams(), cohesion: [0, 4000] as [number, number] }
    const L = (RHO_S - RHO_W) * G * 10
    const u = 0.2 * L
    const { eng } = build([{ mud: 20, u }], undefined, P)
    const b = Math.atan(tanB)
    const fs = (4000 + (L - u) * Math.cos(b) ** 2 * Math.tan(phiM)) / (L * Math.sin(b) * Math.cos(b))
    close(computeStability(eng, P).fsMin[1], fs)
  })

  it('a sand/mud cell takes strength from its solid fractions', () => {
    const { eng, P } = build([{ mud: 10, sand: 10 }])
    const tanPhi = 0.5 * Math.tan(rad(P.phiFric[0])) + 0.5 * Math.tan(rad(P.phiFric[1]))
    close(computeStability(eng, P).fsMin[1], tanPhi / tanB)
  })

  it('picks the weakest layer: overpressure in the lower layer sets FS min and critical depth', () => {
    const dRhoG = (RHO_S - RHO_W) * G
    const L1 = dRhoG * (10 + 0.5 * 10) // lower layer: 10 m of solids above, half of its own 10 m
    const { eng, P } = build([{ mud: 10, u: 0.9 * L1 }, { mud: 10 }])
    const r = computeStability(eng, P)
    expect(r.critLayer[1]).toBe(1)
    close(r.fsMin[1], 0.1 * Math.tan(phiM) / tanB)
    const top = cellBulk(eng, P, 2 * 3 + 1)
    close(r.critDepth[1], top + cellBulk(eng, P, 1 * 3 + 1) / 2)
  })

  it('only searches the top stabMaxDepth', () => {
    const base = build([{ mud: 10, u: 0 }, { mud: 10 }])
    const deepBulk = cellBulk(base.eng, base.P, 2 * 3 + 1) + cellBulk(base.eng, base.P, 1 * 3 + 1) / 2
    const P = { ...defaultEngineParams(), stabMaxDepth: deepBulk * 0.99 }
    const { eng } = build([{ mud: 10, u: 1e6 }, { mud: 10 }], undefined, P) // weak lower layer is below the limit
    const r = computeStability(eng, P)
    expect(r.critLayer[1]).toBe(2)
    close(r.fsMin[1], Math.tan(phiM) / tanB)
  })

  it('uses central differences inside and one-sided differences at the edges', () => {
    const H = new Float64Array([0, 30, 100])
    expect(seafloorSlope(H, 1000, 0)).toBeCloseTo(0.03, 15)
    expect(seafloorSlope(H, 1000, 1)).toBeCloseTo(0.05, 15)
    expect(seafloorSlope(H, 1000, 2)).toBeCloseTo(0.07, 15)
    expect(seafloorSlope(new Float64Array([5]), 1000, 0)).toBe(0)
  })
})

describe('edge cases', () => {
  it('flat seafloor gives FS = Infinity and no NaN', () => {
    const { eng, P } = build([{ mud: 20, u: 1e5 }], [10, 10, 10])
    const r = computeStability(eng, P)
    for (let j = 0; j < 3; j++) {
      expect(r.fsMin[j]).toBe(Infinity)
      expect(r.critLayer[j]).toBe(-1)
      expect(Number.isNaN(r.critDepth[j])).toBe(false)
    }
    expect(infiniteSlopeFS(1e5, 0, 0, 0.5, 0)).toBe(Infinity)
    expect(infiniteSlopeFS(1e5, 0, 0, 0.5, 5000)).toBe(Infinity)
    expect(infiniteSlopeFS(0, 0, 0.1, 0.5, 0)).toBe(Infinity) // no load (zero depth) cannot fail
  })

  it('a column with no sediment above the substrate still returns a result', () => {
    const { eng, P } = build([])
    const r = computeStability(eng, P)
    expect(r.fsMin[1]).toBe(Infinity)
  })

  it('FS falls to 0 as the pore pressure reaches the load (no cohesion)', () => {
    close(infiniteSlopeFS(1e5, 0.5e5, 0.1, 0.5, 0), 0.5 * 0.5 / Math.tan(0.1))
    expect(infiniteSlopeFS(1e5, 1e5, 0.1, 0.5, 0)).toBe(0)
  })
})

describe('default 3 Myr run', () => {
  const run = runFull()
  const r = computeStability(run.eng, run.P)

  it('is stable everywhere (FS > 1); reports the minimum', () => {
    let jMin = 0
    for (let j = 0; j < run.P.nx; j++) if (r.fsMin[j] < r.fsMin[jMin]) jMin = j
    const ft = r.critDepth[jMin] / 0.3048
    console.log(`default run: FS min ${r.fsMin[jMin].toFixed(3)} at column ${jMin} (${((jMin + 0.5) * run.P.dx / 1000).toFixed(1)} km), ` +
      `${r.critDepth[jMin].toFixed(1)} m (${ft.toFixed(0)} ft) below seafloor, layer ${r.critLayer[jMin]}, slope ${(Math.atan(r.slope[jMin]) * 180 / Math.PI).toFixed(2)} deg`)
    expect(r.fsMin[jMin]).toBeGreaterThan(1)
    for (let j = 0; j < run.P.nx; j++) expect(Number.isNaN(r.fsMin[j])).toBe(false)
  })

  it('critical depths stay inside the search window', () => {
    for (let j = 0; j < run.P.nx; j++) if (r.critLayer[j] >= 0) expect(r.critDepth[j]).toBeLessThanOrEqual(run.P.stabMaxDepth)
  })

  it('is deterministic and rebuilds exactly after a restore', () => {
    const again = computeStability(run.eng, run.P)
    expect(Array.from(again.fsMin)).toEqual(Array.from(r.fsMin))
    const snap = snapshotEngine(run.eng)
    const eng2: EngineState = allocateEngine(createRecord({ nx: run.P.nx, dx: run.P.dx, capacity: run.eng.rec.capacity, startAgeMa: 0 }))
    restoreEngine(snap, eng2, run.P)
    const r2 = computeStability(eng2, run.P)
    expect(Array.from(r2.fsMin)).toEqual(Array.from(r.fsMin))
    expect(Array.from(r2.critDepth)).toEqual(Array.from(r.critDepth))
    expect(Array.from(r2.critLayer)).toEqual(Array.from(r.critLayer))
  })
})
