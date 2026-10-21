// SFM-4 check 3: where the Gulf-style and short salt presets sit now, against the bands in tests/gulfPreset.test.ts.
// Each preset is run plain and under 1 ulp maths noise in six salts (D16.4: the same six the Gulf tests use), and the summary
// numbers the tests read are printed per run plus min / median / max. Nothing is asserted here and no band is changed (SFM-4 only
// recommends). The metrics copy runSummary() in tests/gulfPreset.test.ts.
//   node scripts/review/sfm-fix/03-gulf-bands.mjs
// REVIEW_ROOT=<checkout> runs the same script on another checkout (the "before" numbers).
import { engine, close, platform, median, f } from './lib.mjs'

console.log(`SFM-4 03 Gulf and short-salt bands. ${platform}`)
const { Step, Presets, SaltS, Noise, Sea, Sched } = await engine()
const MIN_PROM = 300
const SALT_EDGE_M = 100
const SIX = [3, 5, 7, 11, 13, 17]

function summary(id, over, ulpSalt) {
  const P = { ...Presets.presetParams(id), ...over }
  const schedule = Presets.presetSchedule(id)
  const go = () => {
    const eng = Step.createEngine(P, schedule)
    const sl = Sea.makeSeaLevel(P, schedule.startAgeMa * 1e6)
    const edgeAt = new Map()
    while (Step.step(eng, P, schedule, sl)) {
      const age = schedule.stepAgeMa[eng.diag.stepIndex - 1]
      for (const a of [56, 10]) if (!edgeAt.has(a) && age <= a + 1e-9) edgeAt.set(a, eng.diag.shelfEdge >= 0 ? ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000 : -1)
    }
    return { eng, edgeAt }
  }
  const { eng, edgeAt } = ulpSalt === null ? go() : Noise.withUlpNoise(2.2e-16, ulpSalt, go)
  const nx = eng.rec.nx
  const h = Float64Array.from(eng.rec.mud.subarray(0, nx))
  const cover = Float64Array.from(eng.salt.Sb)
  const edgeKm = P.dx * nx / 1000
  let first = 0, last = nx - 1
  while (first < nx && h[first] <= SALT_EDGE_M) first++
  while (last > 0 && h[last] <= SALT_EDGE_M) last--
  const saltFirstKm = ((first + 0.5) * P.dx) / 1000, saltFrontKm = ((last + 0.5) * P.dx) / 1000
  const shallow = SaltS.saltHighs(h, P.dx, MIN_PROM).filter((q) => cover[q.j] < 2000)
  const crests = shallow.filter((q) => q.x / 1000 <= edgeKm - 20 && q.x / 1000 >= saltFirstKm + 20 && q.x / 1000 <= saltFrontKm - 20).map((q) => cover[q.j])
  const allWelds = SaltS.weldRuns(eng.weldAge, h, P.weldThick, P.dx)
  let maxBeyond250 = 0, maxLast20 = 0
  for (let j = 0; j < nx; j++) {
    const xm = (j + 0.5) * P.dx
    if (xm >= 250000) maxBeyond250 = Math.max(maxBeyond250, h[j])
    if (xm > P.dx * nx - 20000) maxLast20 = Math.max(maxLast20, h[j])
  }
  return {
    weldTotalKm: allWelds.reduce((a, r) => a + (r.toKm - r.fromKm), 0),
    weldLongestKm: allWelds.reduce((a, r) => Math.max(a, r.toKm - r.fromKm), 0),
    welds2: allWelds.filter((r) => r.toKm - r.fromKm >= 2).length,
    highs: SaltS.saltHighs(h, P.dx, MIN_PROM).length, basins: SaltS.minibasins(h, P.dx, MIN_PROM).length,
    shallow: shallow.length, crestsN: crests.length, crestMinCoverM: crests.length ? Math.min(...crests) : NaN,
    saltFrontKm, saltFirstKm, maxLast20, maxBeyond250, maxBeyond250x: maxBeyond250 / P.saltThick,
    wavelengthKm: SaltS.saltWavelength(h, P.dx, 20000, 120000, 4000, 60000) / 1000,
    edge56: edgeAt.get(56) ?? -1, edge10: edgeAt.get(10) ?? -1, progradeKm: (edgeAt.get(10) ?? -1) - (edgeAt.get(56) ?? -1),
    seaFloorEndM: eng.rec.H[nx - 1],
  }
}

function block(id, over = {}) {
  console.log(`== ${id}${Object.keys(over).length ? ' ' + JSON.stringify(over) : ''}`)
  const runs = [['plain', summary(id, over, null)], ...SIX.map((s) => [`noise ${s}`, summary(id, over, s)])]
  const keys = Object.keys(runs[0][1])
  for (const [name, r] of runs) console.log(`  ${name.padEnd(9)} ` + keys.map((k) => `${k} ${f(r[k], 1)}`).join(', '))
  console.log('  -- min / median / max over the 7 runs (plain + six noise salts)')
  for (const k of keys) {
    const v = runs.map(([, r]) => r[k]).filter(Number.isFinite)
    console.log(`  ${k.padEnd(16)} ${f(Math.min(...v), 2)} / ${f(median(v), 2)} / ${f(Math.max(...v), 2)}`)
  }
  return runs
}

block('gulf')
block('saltshort')
// grid agreement on a 200 km section (dx 1000 against dx 500), plain and three noise salts: the test compares the dominant wavelength
console.log('== Gulf grid agreement: dx 1000 nx 200 against dx 500 nx 400 (wavelength km, relative difference to the finer grid; band 0.15)')
for (const s of [null, 3, 5, 7]) {
  const a = summary('gulf', { dx: 1000, nx: 200 }, s), b = summary('gulf', { dx: 500, nx: 400 }, s)
  console.log(`  ${s === null ? 'plain' : 'noise ' + s}: ${f(a.wavelengthKm, 1)} vs ${f(b.wavelengthKm, 1)} km, difference ${f(Math.abs(a.wavelengthKm - b.wavelengthKm) / b.wavelengthKm, 2)}`)
}
await close()
