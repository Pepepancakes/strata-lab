// SFM-2 report: the shelf edge that cannot see the shoreface (SFM-R F1, F4; D31.3).
// Runs the default run (published sea-level curve), constant sea level, sine 40 m / 80 m (100 kyr), the slow
// 1 Myr sine (40 m) and the Gulf preset. For each: turbidite share (mean, at sea-level lowstands = lowest
// 20 % of steps), sand beyond 100 km as % of sand supply, shoreline, foreset angle, correlation(sea level, share).
// Same script runs on an old checkout (REVIEW_ROOT=<checkout>) and the new one. All thresholds quoted
// elsewhere are round numbers (D31.5), not cited targets.
//
//   node scripts/review/sfm/07-shelf-edge.mjs
import { createServer } from 'vite'
import { run, close, platform, depositByColumn, shorelineX, f, km, m_ft, deg, sum, root } from './lib.mjs'

console.log(`SFM-2 shelf edge. ${platform}`)

function corr(a, b) {
  const n = a.length, ma = sum(a) / n, mb = sum(b) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN
}

/** Steepest gradient of the foreset in the seaward half of the section (centred), as an angle. */
function foreset(H, dx, xs) {
  let best = 0
  for (let j = Math.max(1, Math.floor(xs / dx)); j < H.length - 1; j++) best = Math.max(best, (H[j - 1] - H[j + 1]) / (2 * dx))
  return best
}

function summarise(label, eng, P, trace) {
  const rec = eng.rec, dx = P.dx
  const dep = depositByColumn(rec)
  const j1 = Math.round(100000 / dx)
  const led = rec.ledger
  const n = trace.share.length
  const sea = trace.sea
  const sorted = [...sea].sort((x, y) => x - y)
  const cut = sorted[Math.floor(0.2 * n)]
  const low = trace.share.filter((_, i) => sea[i] <= cut)
  const high = trace.share.filter((_, i) => sea[i] >= sorted[Math.floor(0.8 * n)])
  const xs = shorelineX(rec.H, dx, sea.at(-1))
  const dist = trace.edge.map((e, i) => (e - trace.shore[i]) * dx / 1000).filter((v, i) => trace.edge[i] >= 0)
  dist.sort((a, b) => a - b)
  console.log(`  ${label}`)
  console.log(`    turbidite share: mean ${f(sum(trace.share) / n, 3)}, at lowstands (lowest 20 % of sea level) ${f(sum(low) / low.length, 3)}, at highstands (highest 20 %) ${f(sum(high) / high.length, 3)}; corr(sea level, share) ${f(corr(sea, trace.share), 3)}; median shelf edge - shoreline ${f(dist[Math.floor(dist.length / 2)], 1)} km`)
  console.log(`    sand beyond 100 km ${f(100 * sum(dep.sand, j1) * dx / led.cumIn.sand, 2)} % of sand supply; shoreline ${km(xs, 2)}; foreset (steepest seaward gradient) ${deg(foreset(rec.H, dx, xs))}; sea floor at the basinward end ${m_ft(rec.H[rec.nx - 1])}`)
}

for (const [label, over] of [
  ['default run (published sea-level curve)', {}],
  ['constant sea level', { seaLevelKind: 'sine', slAmp: 0 }],
  ['sine 40 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 40 }],
  ['sine 80 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 80 }],
  ['sine 40 m / 1 Myr', { seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e6 }],
]) {
  const r = await run({ ...over, ...JSON.parse(process.env.SFM_OVER || '{}') })
  summarise(label, r.eng, r.P, r.trace)
}

{
  const server = await createServer({
    root, configFile: false, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const load = (p) => server.ssrLoadModule(p)
  const S = await load('/src/engine/step.ts'), Pr = await load('/src/engine/presets.ts'), Sea = await load('/src/engine/sealevel.ts')
  const St = await load('/src/engine/saltStructures.ts')
  const P = Pr.presetParams('gulf'), sch = Pr.presetSchedule('gulf')
  const eng = S.createEngine(P, sch), sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const trace = { sea: [], shore: [], edge: [], share: [] }
  let k = 0
  while (S.step(eng, P, sch, sea)) {
    trace.sea.push(sea(sch.tEndYr[k])); trace.shore.push(eng.diag.shore); trace.edge.push(eng.diag.shelfEdge); trace.share.push(eng.diag.tcShare)
    k++
  }
  summarise('Gulf preset (tcMax 0.1)', eng, P, trace)
  const nx = eng.rec.nx
  const h = Float64Array.from(eng.rec.mud.subarray(0, nx))
  const welds = St.weldRuns(eng.weldAge, h, P.weldThick, P.dx).filter((w) => w.j1 > w.j0)
  const hi = St.saltHighs(h, P.dx, 300)
  let lastSalt = -1
  for (let j = 0; j < nx; j++) if (h[j] > 100) lastSalt = j
  console.log(`    weld runs ${welds.length}, total ${f(sum(welds.map((w) => w.toKm - w.fromKm)), 1)} km, longest ${f(Math.max(0, ...welds.map((w) => w.toKm - w.fromKm)), 1)} km; salt highs (prominence 300 m) ${hi.length}; salt wall ${lastSalt >= 0 ? km((lastSalt + 0.5) * P.dx) : '-'}`)
  await server.close()
}
await close()
