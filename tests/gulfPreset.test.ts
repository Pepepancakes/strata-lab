// M3.8: the Gulf-style preset and the short salt preset, checked with bands and summary statistics only
// (D16.4): no test here depends on a count near zero or on where one particular column sits. The
// bands were measured on Windows, Node 26, and checked under 1 ulp maths noise (withUlpNoise) and on
// Linux CI. Targets are the ones in decision D18: weld = salt thinner than 100 m, weld runs of 2 km or
// more, at least two salt crests within 2 km of the seafloor and 20 km or more from the basinward edge,
// a wedge that keeps prograding.
import { describe, expect, it } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { getPreset, presetParams, presetSchedule } from '../src/engine/presets'
import { saltVolume } from '../src/engine/salt'
import { minibasins, saltHighs, saltWavelength, weldRuns } from '../src/engine/saltStructures'
import { createEngine, step } from '../src/engine/step'
import { mToFt } from '../src/units'
import { withUlpNoise } from './helpers/ulpNoise'
import { seaLevelOf } from './helpers/run'

const MIN_PROM = 300 // m; the prominence used by every count below
const LONG = 240_000 // ms; generous so a slow CI machine does not time out

interface Summary {
  P: EngineParams
  ms: number
  hash: string
  /** Salt thickness (m) and cover over the salt (m) per column at the end. */
  h: Float64Array
  cover: Float64Array
  /** Weld runs of 2 columns or more. */
  welds: ReturnType<typeof weldRuns>
  /** Weld runs of any width (one column or more): the weld position wobbles by columns under noise, so noise tests use this. */
  weldsAny: number
  /** Salt highs with less than 2 km of cover and at least 20 km from the basinward edge. */
  crests: { xKm: number; coverM: number }[]
  wavelengthKm: number
  edge56Km: number
  edge10Km: number
  edgeEndKm: number
  volumeChange: number
  clip: number
  saltLandward: number
  saltBasinward: number
}

/** Run a preset to the end with overrides, optionally under 1 ulp maths noise, and summarise it. */
function runSummary(id: 'gulf' | 'saltshort', over: Partial<EngineParams> = {}, ulpSalt: number | null = null): Summary {
  const P = { ...presetParams(id), ...over }
  const schedule = presetSchedule(id)
  const t0 = performance.now()
  const go = () => {
    const eng = createEngine(P, schedule)
    const sl = seaLevelOf(P, schedule)
    const v0 = saltVolume(eng.rec)
    const edgeAt = new Map<number, number>()
    while (step(eng, P, schedule, sl)) {
      const age = schedule.stepAgeMa[eng.diag.stepIndex - 1]
      for (const a of [56, 10]) if (!edgeAt.has(a) && age <= a + 1e-9) edgeAt.set(a, eng.diag.shelfEdge >= 0 ? ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000 : -1)
    }
    return { eng, v0, edgeAt }
  }
  const { eng, v0, edgeAt } = ulpSalt === null ? go() : withUlpNoise(2.2e-16, ulpSalt, go)
  const nx = eng.rec.nx
  const h = Float64Array.from(eng.rec.mud.subarray(0, nx))
  const cover = Float64Array.from(eng.salt.Sb)
  const edgeKm = P.dx * nx / 1000
  const crests = saltHighs(h, P.dx, MIN_PROM)
    .filter((q) => cover[q.j] < 2000 && q.x / 1000 <= edgeKm - 20)
    .map((q) => ({ xKm: q.x / 1000, coverM: cover[q.j] }))
  const allWelds = weldRuns(eng.weldAge, h, P.weldThick, P.dx)
  const welds = allWelds.filter((r) => r.toKm - r.fromKm >= 2)
  let landward = 0
  let basinward = 0
  for (let j = 0; j < nx; j++) {
    if ((j + 0.5) * P.dx < 200_000) landward += h[j] * P.dx
    else if ((j + 0.5) * P.dx >= 250_000) basinward += h[j] * P.dx
  }
  return {
    P, ms: performance.now() - t0, hash: String(stateHash(eng.rec)), h, cover, welds, weldsAny: allWelds.length, crests,
    wavelengthKm: saltWavelength(h, P.dx, 20_000, 120_000, 4_000, 60_000) / 1000,
    edge56Km: edgeAt.get(56) ?? -1, edge10Km: edgeAt.get(10) ?? -1,
    edgeEndKm: eng.diag.shelfEdge >= 0 ? ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000 : -1,
    volumeChange: (saltVolume(eng.rec) - v0) / v0, clip: eng.diag.saltClip, saltLandward: landward, saltBasinward: basinward,
  }
}

describe('Gulf-style preset: the D18 targets (66 Myr, 400 km, dx 1,000 m)', () => {
  const main = runSummary('gulf')
  // The M3.4 draft values, to show that the bands below can fail.
  const draft = runSummary('gulf', {
    supply: 22, subsShelf: 40, subsBasin: 80, tcMax: defaultEngineParams().tcMax, saltThick: 2000, saltPinchStart: 40_000, saltPinchEnd: 120_000,
    coverThick: 1000, coverUneven: 0.2, coverSeed: 1, coverVisc: 3e20, weldThick: 10,
  })

  it('has a real note and is the registered 66 Myr preset', () => {
    const p = getPreset('gulf')
    expect(p.note).not.toBe('draft')
    expect(p.note.length).toBeGreaterThan(200)
    expect(p.runLengthMa).toBe(66)
    expect(p.params.saltVisc).toBe(1e18) // D17.5
    expect(p.params.weldThick).toBe(100) // D18
  })

  it('welds: at least one weld run of 2 km or more under the shelf or ramp the wedge crossed', () => {
    expect(main.welds.length).toBeGreaterThanOrEqual(1)
    for (const w of main.welds) {
      expect(w.fromKm).toBeGreaterThanOrEqual(10) // not landward of the pinch-out
      expect(w.toKm).toBeLessThanOrEqual(main.edgeEndKm) // landward of the final shelf edge: the wedge crossed it
      expect(w.lastMa).toBeGreaterThan(0)
      expect(w.firstMa).toBeLessThanOrEqual(66)
    }
  })

  it('crests: at least two salt highs with under 2 km of cover, 20 km or more from the basinward edge', () => {
    expect(main.crests.length).toBeGreaterThanOrEqual(2)
    for (const c of main.crests) {
      expect(c.coverM).toBeGreaterThan(500) // under the seafloor, not through it
      expect(mToFt(c.coverM)).toBeLessThan(6600)
    }
  })

  it('the wedge prograded: shelf edge km at 10 Ma at least 50 km beyond its place at 56 Ma', () => {
    expect(main.edge56Km).toBeGreaterThan(0)
    expect(main.edge10Km - main.edge56Km).toBeGreaterThanOrEqual(50)
    expect(main.edgeEndKm).toBeGreaterThanOrEqual(150)
  })

  it('salt moved basinward and is conserved with the clip off', () => {
    const initialLandward = 4000 * 200_000 // upper bound: full thickness everywhere (the ramp makes the real figure smaller)
    expect(main.saltLandward).toBeLessThan(0.3 * initialLandward)
    expect(main.saltBasinward).toBeGreaterThan(1.3 * 4000 * 150_000)
    expect(Math.abs(main.volumeChange)).toBeLessThan(1e-12)
    expect(main.clip).toBe(0)
  })

  it('dominant wavelength of the salt thickness (km 20 to 120) is 10 to 25 km', () => {
    expect(main.wavelengthKm).toBeGreaterThan(10)
    expect(main.wavelengthKm).toBeLessThan(25)
  })

  it('minibasins form (a sanity band on the count, far from zero)', () => {
    expect(minibasins(main.h, main.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
  })

  it('the M3.4 draft values fail the weld and crest bands (so the bands can fail)', () => {
    expect(draft.welds.length).toBe(0)
    expect(draft.crests.length).toBe(0)
  })

  it('a second run gives the same bits (same machine)', () => {
    expect(runSummary('gulf').hash).toBe(main.hash)
  }, LONG)
}, LONG)

describe('Gulf-style preset: grid agreement on a 200 km section', () => {
  // The record holds at most 400 columns, so dx 500 m can only cover 200 km. All three grids run the
  // same 200 km section; dx 2,000 m is information only (no band on it).
  const a = runSummary('gulf', { dx: 1000, nx: 200 })
  const b = runSummary('gulf', { dx: 500, nx: 400 })

  it('dominant wavelength at dx 1,000 and 500 m agrees within 15 %, both in the 10 to 25 km band', () => {
    for (const s of [a, b]) {
      expect(s.wavelengthKm).toBeGreaterThan(10)
      expect(s.wavelengthKm).toBeLessThan(25)
    }
    expect(Math.abs(a.wavelengthKm - b.wavelengthKm) / b.wavelengthKm).toBeLessThan(0.15)
  })

  it('a weld run of 2 km or more is present on both grids', () => {
    expect(a.welds.length).toBeGreaterThanOrEqual(1)
    expect(b.welds.length).toBeGreaterThanOrEqual(1)
  })

  it('salt is conserved on both grids', () => {
    for (const s of [a, b]) {
      expect(Math.abs(s.volumeChange)).toBeLessThan(1e-12)
      expect(s.clip).toBe(0)
    }
  })
}, LONG)

describe('Gulf-style preset: robust to 1 ulp maths noise (D16.4)', () => {
  const main = runSummary('gulf')
  const noisy = [3, 7, 11].map((salt) => runSummary('gulf', {}, salt))

  it('weld, crests and wavelength do not depend on the noise', () => {
    for (const n of noisy) {
      expect(n.weldsAny).toBeGreaterThanOrEqual(1)
      expect(n.crests.length).toBeGreaterThanOrEqual(2)
      expect(n.wavelengthKm).toBeGreaterThan(10) // measured 11 to 13.6 across noise salts: the band, not a tight match
      expect(n.wavelengthKm).toBeLessThan(25)
      // the crest depths themselves move by a few feet at most
      expect(Math.abs(n.crests[0].coverM - main.crests[0].coverM)).toBeLessThan(50)
      expect(n.edgeEndKm).toBeGreaterThanOrEqual(150)
      expect(Math.abs(n.volumeChange)).toBeLessThan(1e-12)
    }
  })
}, LONG)

describe('Salt: uneven cover (10 Myr) preset', () => {
  const s = runSummary('saltshort')

  it('is a registered 10 Myr preset with a real note', () => {
    const p = getPreset('saltshort')
    expect(p.runLengthMa).toBe(10)
    expect(p.params.saltVisc).toBe(1e17)
    expect(p.params.coverBend ?? defaultEngineParams().coverBend).toBe(1)
    expect(p.note).not.toBe('draft')
  })

  it('forms diapirs and minibasins: at least 6 of each (it makes about 13)', () => {
    expect(saltHighs(s.h, s.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
    expect(minibasins(s.h, s.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
  })

  it('conserves salt and the clip stays off', () => {
    expect(Math.abs(s.volumeChange)).toBeLessThan(1e-12)
    expect(s.clip).toBe(0)
  })

  it('still forms them under 1 ulp noise', () => {
    const n = runSummary('saltshort', {}, 5)
    expect(saltHighs(n.h, n.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
    expect(minibasins(n.h, n.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
  })

  it('a second run gives the same bits', () => {
    expect(runSummary('saltshort').hash).toBe(s.hash)
  })

  // Wall-clock: the preset is meant to be a quick teaching run (about 0.5 s measured).
  it.skipIf(!!process.env.CI)('runs in under 3 s', () => {
    expect(runSummary('saltshort').ms).toBeLessThan(3000)
  })
}, LONG)
