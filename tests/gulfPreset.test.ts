// M3.8, edge fix M3.10: the Gulf-style preset and the short salt preset, checked with bands and summary
// statistics only (D16.4): no test here depends on a count near zero or on where one particular column
// sits. The bands were measured on Windows, Node 26, and checked under 1 ulp maths noise (withUlpNoise)
// and on Linux CI. Targets are the ones in decision D18: weld = salt thinner than 100 m, weld runs of 2 km
// or more, salt crests within 2 km of the seafloor and 20 km or more from the section edge and from the
// edges of the salt basin, a wedge that keeps prograding. AUD-3 (D26.4) moved the mud to Gulf shale
// coefficients (Hart et al. 1995) and John dropped the shallow-crest target for this preset as a measured
// result: the bands below were re-measured on Windows and Linux and no test depends on a crest count. M3.10 adds the basinward salt limit: at the end
// of the run no salt has piled against the closed basinward edge (the M3.9 preset ended with 9 km of salt
// there, and its crests were ripples on that pile).
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
const LONG = 600_000 // ms; generous so a slow CI machine does not time out
// The M3.9 preset had no basinward limit to the salt basin (the registry defaults put it beyond any section).
const NO_LIMIT = { saltLimitStart: defaultEngineParams().saltLimitStart, saltLimitEnd: defaultEngineParams().saltLimitEnd }
const SALT_EDGE_M = 100 // m; a column with more salt than this is inside the salt basin
const SIX_SALTS = [3, 5, 7, 11, 13, 17]

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
  /** Total length of all weld runs and the longest run, km. */
  weldTotalKm: number
  weldLongestKm: number
  /** Salt highs with less than 2 km of cover, anywhere (km). */
  shallowKm: number[]
  /** Those that are also 20 km or more inside the salt basin's edges (end of the run) and the section's edges. */
  crests: { xKm: number; coverM: number }[]
  /** Outermost columns holding more than SALT_EDGE_M of salt at the end, km. */
  saltFirstKm: number
  saltFrontKm: number
  /** Thickest salt beyond 250 km and within 20 km of the basinward edge, m. */
  maxBeyond250: number
  maxLast20: number
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
  let first = 0
  let last = nx - 1
  while (first < nx && h[first] <= SALT_EDGE_M) first++
  while (last > 0 && h[last] <= SALT_EDGE_M) last--
  const saltFirstKm = ((first + 0.5) * P.dx) / 1000
  const saltFrontKm = ((last + 0.5) * P.dx) / 1000
  const shallow = saltHighs(h, P.dx, MIN_PROM).filter((q) => cover[q.j] < 2000)
  const crests = shallow
    .filter((q) => q.x / 1000 <= edgeKm - 20 && q.x / 1000 >= saltFirstKm + 20 && q.x / 1000 <= saltFrontKm - 20)
    .map((q) => ({ xKm: q.x / 1000, coverM: cover[q.j] }))
  const allWelds = weldRuns(eng.weldAge, h, P.weldThick, P.dx)
  const welds = allWelds.filter((r) => r.toKm - r.fromKm >= 2)
  let landward = 0
  let basinward = 0
  let maxBeyond250 = 0
  let maxLast20 = 0
  for (let j = 0; j < nx; j++) {
    const xm = (j + 0.5) * P.dx
    if (xm < 200_000) landward += h[j] * P.dx
    else if (xm >= 250_000) basinward += h[j] * P.dx
    if (xm >= 250_000) maxBeyond250 = Math.max(maxBeyond250, h[j])
    if (xm > P.dx * nx - 20_000) maxLast20 = Math.max(maxLast20, h[j])
  }
  return {
    P, ms: performance.now() - t0, hash: String(stateHash(eng.rec)), h, cover, welds, weldsAny: allWelds.length, crests,
    weldTotalKm: allWelds.reduce((a, r) => a + (r.toKm - r.fromKm), 0), weldLongestKm: allWelds.reduce((a, r) => Math.max(a, r.toKm - r.fromKm), 0),
    shallowKm: shallow.map((q) => q.x / 1000), saltFirstKm, saltFrontKm, maxBeyond250, maxLast20,
    wavelengthKm: saltWavelength(h, P.dx, 20_000, 120_000, 4_000, 60_000) / 1000,
    edge56Km: edgeAt.get(56) ?? -1, edge10Km: edgeAt.get(10) ?? -1,
    edgeEndKm: eng.diag.shelfEdge >= 0 ? ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000 : -1,
    volumeChange: (saltVolume(eng.rec) - v0) / v0, clip: eng.diag.saltClip, saltLandward: landward, saltBasinward: basinward,
  }
}

describe('Gulf-style preset: the D18 targets (66 Myr, 400 km, dx 1,000 m)', () => {
  const main = runSummary('gulf')
  // The M3.9 preset (no basinward salt limit), to show that the edge checks below can fail.
  const m39 = runSummary('gulf', NO_LIMIT)
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

  it('crests: any salt high with under 2 km of cover is under the seafloor and obeys the 20 km exclusion; none is required', () => {
    // D18 asked for two. With the Hart et al. (1995) mud (AUD-3, D26.4) the count is 0 (it was 2 to 5, ripples of
    // the cover seed over light, over-porous mud), so the target is dropped for this preset and no count is
    // asserted (D16.4: nothing is built on a count near zero). Only the sanity is asserted: never through the
    // seafloor, and the 20 km exclusion holds for any that exist.
    for (const c of main.crests) {
      expect(c.coverM).toBeGreaterThan(500) // under the seafloor, not through it
      expect(mToFt(c.coverM)).toBeLessThan(6600)
      expect(c.xKm).toBeLessThanOrEqual(main.P.nx * main.P.dx / 1000 - 20)
      expect(c.xKm).toBeLessThanOrEqual(main.saltFrontKm - 20)
      expect(c.xKm).toBeGreaterThanOrEqual(main.saltFirstKm + 20)
    }
  })

  it('edge: no salt crest, shallow or not, inside the last 20 km of the section, and the salt has not reached the edge', () => {
    const L = main.P.nx * main.P.dx / 1000
    for (const x of main.shallowKm) expect(x).toBeLessThanOrEqual(L - 20)
    for (const q of saltHighs(main.h, main.P.dx, MIN_PROM)) expect(q.x / 1000).toBeLessThanOrEqual(L - 20)
    expect(main.saltFrontKm).toBeLessThanOrEqual(L - 20)
  })

  it('no pile: under 100 m of salt within 20 km of the basinward edge, and nowhere beyond 250 km thicker than 2 times the start', () => {
    expect(main.maxLast20).toBeLessThan(100) // measured 0
    // AUD-4b: the 6.4 km beyond 250 km is the exposed toe wall, not a pile against the section edge (the original M3.9 purpose)
    // AUD-3: measured 1.6 times (6.4 to 6.6 km; Windows, 4 runs; was 1.25 times with the North Sea mud); the M3.9 preset gave 2.3 times
    expect(main.maxBeyond250).toBeLessThan(2 * main.P.saltThick)
  })

  it('the M3.9 values (no basinward limit) fail the edge and no-pile checks, so they can fail', () => {
    expect(m39.maxLast20).toBeGreaterThan(1000) // the salt had piled against the closed edge (measured about 9 km)
    expect(m39.maxBeyond250).toBeGreaterThan(2 * m39.P.saltThick)
    expect(m39.saltFrontKm).toBeGreaterThan(m39.P.nx * m39.P.dx / 1000 - 20)
  })

  it('the wedge prograded: shelf edge km at 10 Ma at least 50 km beyond its place at 56 Ma', () => {
    expect(main.edge56Km).toBeGreaterThan(0)
    expect(main.edge10Km - main.edge56Km).toBeGreaterThanOrEqual(50)
    expect(main.edgeEndKm).toBeGreaterThanOrEqual(150)
  })

  it('salt moved basinward and is conserved with the clip off', () => {
    const initialLandward = 4000 * 200_000 // upper bound: full thickness everywhere (the ramp makes the real figure smaller)
    expect(main.saltLandward).toBeLessThan(0.3 * initialLandward)
    expect(main.saltBasinward).toBeGreaterThan(4000 * 50_000) // salt beyond 250 km: none at the start (the salt basin ends at 240 km), measured about 4000 x 100 km
    expect(Math.abs(main.volumeChange)).toBeLessThan(1e-12)
    expect(main.clip).toBe(0)
  })

  it('dominant wavelength of the salt thickness (km 20 to 120) is 8 to 25 km', () => {
    expect(main.wavelengthKm).toBeGreaterThan(8) // AUD-3: measured 10.4 to 12.3 km over the plain run and six noise salts (Windows); it was 13 to 14 km, band 10 to 25
    expect(main.wavelengthKm).toBeLessThan(25)
  })

  it('minibasins form (a sanity band on the count, far from zero)', () => {
    expect(minibasins(main.h, main.P.dx, MIN_PROM).length).toBeGreaterThanOrEqual(6)
  })

  it('the M3.4 draft values fail the weld band (so the band can fail)', () => {
    expect(draft.welds.length).toBe(0)
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

  it('dominant wavelength at dx 1,000 and 500 m agrees within 15 %, both in the 10 to 45 km band', () => {
    // AUD-3: measured 38 and 34 km (Windows) with the Hart et al. mud; the band was 10 to 25 km with the North Sea mud.
    for (const s of [a, b]) {
      expect(s.wavelengthKm).toBeGreaterThan(10)
      expect(s.wavelengthKm).toBeLessThan(45)
    }
    expect(Math.abs(a.wavelengthKm - b.wavelengthKm) / b.wavelengthKm).toBeLessThan(0.15)
  })

  it('welds (runs of any width) are present on both grids', () => {
    // AUD-3: on 200 km no run reaches 2 km any more (Windows: 2 runs of 1 km at dx 1,000 m, 4 runs of 1 to 1.5 km at 500 m);
    // the 2 km band is asserted on the full 400 km section above.
    expect(a.weldsAny).toBeGreaterThanOrEqual(1)
    expect(b.weldsAny).toBeGreaterThanOrEqual(1)
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
  const noisy = SIX_SALTS.map((salt) => runSummary('gulf', {}, salt))

  it('weld band: total weld length of 5 km or more and a run of 2 km or more, in all six noise salts and the plain run', () => {
    // AUD-3 (Hart et al. mud), measured (Windows, Node 26; plain and three noise salts): total 8 to 11 km, longest
    // run 2 to 3 km, 1 to 3 runs of 2 km or more (it was 12 to 20 km, 3 to 4 km, 6 to 11 runs with the North Sea
    // mud). Only the band is asserted, not a count or a place.
    for (const n of [main, ...noisy]) {
      expect(n.weldTotalKm).toBeGreaterThanOrEqual(5)
      expect(n.weldLongestKm).toBeGreaterThanOrEqual(2)
    }
  })

  it('crests, edges and wavelength do not depend on the noise', () => {
    for (const n of noisy) {
      for (const c of n.crests) expect(c.coverM).toBeGreaterThan(500) // none required (measured 0); any that exist are under the seafloor
      expect(n.wavelengthKm).toBeGreaterThan(8) // measured 10.4 to 12.3 across noise salts (AUD-3, Windows): the band, not a tight match
      expect(n.wavelengthKm).toBeLessThan(25)
      expect(n.edgeEndKm).toBeGreaterThanOrEqual(150)
      expect(Math.abs(n.volumeChange)).toBeLessThan(1e-12)
    }
  })

  it('the edge fix holds in every noise salt: no pile, no crest in the last 20 km', () => {
    for (const n of noisy) {
      expect(n.maxLast20).toBeLessThan(100) // measured 0
      expect(n.maxBeyond250).toBeLessThan(2 * n.P.saltThick) // measured 1.6 times (AUD-3)
      expect(n.saltFrontKm).toBeLessThanOrEqual(n.P.nx * n.P.dx / 1000 - 20)
      for (const x of n.shallowKm) expect(x).toBeLessThanOrEqual(n.P.nx * n.P.dx / 1000 - 20)
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
