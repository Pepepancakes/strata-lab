import { describe, it, expect } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { defaultEngineParams } from '../src/engine/engineParams'
import { getParamDef, defaultParams } from '../src/engine/params'
import { getReference } from '../src/engine/references'
import { recordBalance } from '../src/engine/record'
import {
  BINTANJA_2008, MILLER_2020, SPLICE_END_AGE_YR, SPLICE_START_AGE_YR,
  curveCreditAtAge, interpolateAge, makeSeaLevel, publishedSeaLevel, sineSeaLevel, splicedSeaLevelAtAge,
} from '../src/engine/sealevel'
import { basinFloorSandShare, runFull } from './helpers/run'

describe('bundled data', () => {
  it('has strictly increasing ages and covers the stated spans', () => {
    for (const t of [BINTANJA_2008, MILLER_2020]) {
      expect(t.ageYr.length).toBe(t.seaLevelM.length)
      for (let i = 1; i < t.ageYr.length; i++) expect(t.ageYr[i]).toBeGreaterThan(t.ageYr[i - 1])
    }
    expect(BINTANJA_2008.ageYr[0]).toBe(0)
    expect(BINTANJA_2008.ageYr.at(-1)).toBe(3_000_000)
    expect(MILLER_2020.ageYr.at(-1)!).toBeGreaterThan(64_000_000)
    expect(MILLER_2020.ageYr[0]).toBeLessThan(SPLICE_START_AGE_YR)
  })
  it('records permissive licences and cited sources', () => {
    expect(BINTANJA_2008.licence).toBe('CC0 1.0')
    expect(MILLER_2020.licence).toBe('CC-BY 4.0')
    for (const id of ['bintanja-van-de-wal-2008', 'miller-2020']) {
      const r = getReference(id)
      expect(r?.dataset?.doi, id).toBeTruthy()
      expect(r?.dataset?.licence, id).toMatch(/CC0|CC-BY/)
      expect(r?.dataset?.accessed, id).toBeTruthy()
    }
  })
})

describe('interpolation', () => {
  it('is exact at the data points', () => {
    for (const t of [BINTANJA_2008, MILLER_2020]) {
      for (let i = 0; i < t.ageYr.length; i += 97) expect(interpolateAge(t, t.ageYr[i])).toBe(t.seaLevelM[i])
      expect(interpolateAge(t, t.ageYr.at(-1)!)).toBe(t.seaLevelM.at(-1))
    }
  })
  it('is linear between points and clamps outside the table', () => {
    const a = BINTANJA_2008
    const mid = (a.ageYr[10] + a.ageYr[11]) / 2
    expect(interpolateAge(a, mid)).toBeCloseTo((a.seaLevelM[10] + a.seaLevelM[11]) / 2, 12)
    expect(interpolateAge(a, -5)).toBe(a.seaLevelM[0])
    expect(interpolateAge(a, 9e9)).toBe(a.seaLevelM.at(-1))
  })
})

describe('spot checks against rows of the raw files', () => {
  // Raw Bintanja file column 9 is ice volume as sea-level equivalent (+122.820 m at 21.000 kyr);
  // sea level is its negative. Values below were read from the downloaded bintanja2008.txt.
  it('Bintanja & van de Wal (2008): 21 kyr (inside the last 25 kyr), 2100 kyr, 2400 kyr', () => {
    expect(interpolateAge(BINTANJA_2008, 21_000)).toBe(-122.82)
    expect(interpolateAge(BINTANJA_2008, 2_100_000)).toBe(-12.609)
    expect(interpolateAge(BINTANJA_2008, 2_400_000)).toBe(-15.401)
  })
  it('Miller et al. (2020): rows from the PANGAEA table', () => {
    expect(interpolateAge(MILLER_2020, 980_000)).toBe(-33)
    expect(interpolateAge(MILLER_2020, 3_000_000)).toBe(-4.8)
    expect(interpolateAge(MILLER_2020, 64_820_000)).toBe(59.1)
  })
  it('the last glacial maximum is about 120 m below present, not above', () => {
    expect(splicedSeaLevelAtAge(21_000)).toBeLessThan(-100)
    expect(splicedSeaLevelAtAge(21_000)).toBeGreaterThan(-140)
  })
})

describe('splice of the two records', () => {
  it('is continuous at both ends of the blend window (jump < 1 m)', () => {
    for (const age of [SPLICE_START_AGE_YR, SPLICE_END_AGE_YR]) {
      expect(Math.abs(splicedSeaLevelAtAge(age + 1) - splicedSeaLevelAtAge(age - 1))).toBeLessThan(1)
    }
    // and across a fine scan of the whole window
    let worst = 0
    for (let age = SPLICE_START_AGE_YR - 1000; age < SPLICE_END_AGE_YR + 1000; age += 100) {
      worst = Math.max(worst, Math.abs(splicedSeaLevelAtAge(age + 100) - splicedSeaLevelAtAge(age)))
    }
    console.log(`largest change over 100 yr in the splice window: ${worst.toFixed(3)} m`)
    expect(worst).toBeLessThan(1)
  })
  it('is pure Bintanja younger than the window, pure Miller older, a blend in between', () => {
    expect(splicedSeaLevelAtAge(1_000_000)).toBe(interpolateAge(BINTANJA_2008, 1_000_000))
    expect(splicedSeaLevelAtAge(10_000_000)).toBe(interpolateAge(MILLER_2020, 10_000_000))
    const mid = (SPLICE_START_AGE_YR + SPLICE_END_AGE_YR) / 2
    const lo = Math.min(interpolateAge(BINTANJA_2008, mid), interpolateAge(MILLER_2020, mid))
    const hi = Math.max(interpolateAge(BINTANJA_2008, mid), interpolateAge(MILLER_2020, mid))
    expect(splicedSeaLevelAtAge(mid)).toBeGreaterThanOrEqual(lo)
    expect(splicedSeaLevelAtAge(mid)).toBeLessThanOrEqual(hi)
    expect(splicedSeaLevelAtAge(mid)).toBeCloseTo(0.5 * (interpolateAge(BINTANJA_2008, mid) + interpolateAge(MILLER_2020, mid)), 12)
  })
  it('credit shown in the UI changes with age', () => {
    expect(curveCreditAtAge(100_000).refIds).toEqual(['bintanja-van-de-wal-2008'])
    expect(curveCreditAtAge(2_900_000).refIds).toEqual(['bintanja-van-de-wal-2008', 'miller-2020'])
    expect(curveCreditAtAge(20_000_000).refIds).toEqual(['miller-2020'])
    for (const age of [0, 2_900_000, 30e6]) for (const id of curveCreditAtAge(age).refIds) expect(getReference(id)).toBeDefined()
  })
})

describe('SeaLevelCurve over elapsed model time', () => {
  it('model time 0 is the start of the run: 3 Ma for the default run, now at the end', () => {
    const c = publishedSeaLevel({ slShift: 0 }, 3_000_000)
    expect(c(0)).toBe(splicedSeaLevelAtAge(3_000_000))
    expect(c(3_000_000 - 21_000)).toBe(-122.82)
    expect(c(3_000_000)).toBe(BINTANJA_2008.seaLevelM[0])
  })
  it('works for a long run: a 23 Myr run reads the older record at its start', () => {
    const c = publishedSeaLevel({ slShift: 0 }, 23e6)
    expect(c(0)).toBe(interpolateAge(MILLER_2020, 23e6))
    expect(c(23e6 - 21_000)).toBe(-122.82)
  })
  it('slShift adds a step offset', () => {
    const base = publishedSeaLevel({ slShift: 0 }, 3e6)
    const up = publishedSeaLevel({ slShift: -50 }, 3e6)
    for (const t of [0, 1e6, 2.9e6]) expect(up(t)).toBe(base(t) - 50)
  })
  it('is deterministic', () => {
    const a = publishedSeaLevel({ slShift: 3 }, 3e6)
    const b = publishedSeaLevel({ slShift: 3 }, 3e6)
    for (let t = 0; t <= 3e6; t += 12_345) expect(a(t)).toBe(b(t))
  })
})

describe('registry', () => {
  it("seaLevelKind defaults to 'curve', is cited, and branches may change it", () => {
    const def = getParamDef('seaLevelKind')!
    expect(def.default).toBe('curve')
    expect(def.source.kind).toBe('cited')
    expect(def.options).toEqual(['curve', 'sine'])
    expect(def.startOnly).toBe(false)
    expect(defaultParams().seaLevelKind).toBe('curve')
  })
  it('makeSeaLevel picks the sine only when asked, and the sine ignores the curve', () => {
    const P = defaultEngineParams()
    expect(makeSeaLevel(P, 3e6)(1e6)).toBe(publishedSeaLevel(P, 3e6)(1e6))
    const S = { ...P, seaLevelKind: 'sine' as const }
    expect(makeSeaLevel(S, 3e6)(1e6)).toBe(sineSeaLevel(S)(1e6))
  })
})

describe('default run with the published curve', () => {
  const curve = runFull(undefined, [], { seaLevelKind: 'curve' })
  const sine = runFull(undefined, [], { seaLevelKind: 'sine' })

  it('keeps both mass balances below 1e-9 and leaves no unfilled erosion', () => {
    const b = recordBalance(curve.eng.rec)
    const cumIn = curve.eng.rec.ledger.cumIn
    const total = (b.sand.error + b.mud.error) / (cumIn.sand + cumIn.mud)
    expect(Math.abs(total)).toBeLessThan(1e-9)
    expect(Math.abs(b.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(b.mud.relError)).toBeLessThan(1e-9)
    expect(curve.eng.diag.deficit).toBe(0)
  })

  it('is deterministic (same hash on a second run)', () => {
    expect(stateHash(runFull(undefined, [], { seaLevelKind: 'curve' }).eng.rec)).toBe(stateHash(curve.eng.rec))
  })

  it('differs from the sine run (the switch does something)', () => {
    expect(stateHash(curve.eng.rec)).not.toBe(stateHash(sine.eng.rec))
  })

  it('reports the numbers for the handoff', () => {
    const report = (name: string, r: ReturnType<typeof runFull>, minMax: [number, number]) => {
      const bf = basinFloorSandShare(r.eng, r.P.dx, 65)
      const bf80 = basinFloorSandShare(r.eng, r.P.dx, 80)
      console.log(`${name}: sea level min ${minMax[0].toFixed(1)} m, max ${minMax[1].toFixed(1)} m; farthest shoreline ${r.maxShoreKm.toFixed(1)} km; basin-floor sand share (toe 65 km) ${(100 * bf).toFixed(1)} %, (x >= 80 km) ${(100 * bf80).toFixed(1)} %`)
      return bf
    }
    const range = (f: (t: number) => number): [number, number] => {
      let lo = Infinity, hi = -Infinity
      for (let t = 0; t <= 3e6; t += 5000) { const v = f(t); lo = Math.min(lo, v); hi = Math.max(hi, v) }
      return [lo, hi]
    }
    const bfCurve = report('curve', curve, range(makeSeaLevel(curve.P, 3e6)))
    const bfSine = report('sine ', sine, range(makeSeaLevel(sine.P, 3e6)))
    for (const v of [bfCurve, bfSine]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
