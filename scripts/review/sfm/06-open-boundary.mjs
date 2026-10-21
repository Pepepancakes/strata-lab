// SFM-1 report: the basinward boundary (SFM-R F2). The same script runs on the old engine
// (REVIEW_ROOT=<checkout of main>) and the new one. For the default run, the constant-sea-level run and the
// Gulf preset it prints: sea floor at the basinward end, sand beyond 100 km as % of the sand supply, shoreline,
// exported share per grain size (diffusion past the edge; turbidite run-out and other exports), cost per step.
// Then the section-length test: 150 km against 300 km at dx 1 km, comparing the SAME stretch of sea floor
// (sand between 100 and 150 km, sea floor at 150 km). The 5 % threshold is a round number (D31.5), not a cited target.
//
//   node scripts/review/sfm/06-open-boundary.mjs
import { createServer } from 'vite'
import { run, close, platform, depositByColumn, shorelineX, f, km, m_ft, sum, root } from './lib.mjs'

console.log(`SFM-1 open boundary. ${platform}`)

function summarise(label, eng, P, seaEnd, ms, nSteps) {
  const rec = eng.rec, dx = P.dx, nx = rec.nx
  const dep = depositByColumn(rec)
  const j1 = Math.round(100000 / dx)
  const sandBeyond = sum(dep.sand, j1) * dx
  const led = rec.ledger
  const xs = shorelineX(rec.H, dx, seaEnd)
  const edge = led.cumEdge || { sand: 0, mud: 0 }
  console.log(`  ${label}`)
  console.log(`    sea floor at the basinward end ${m_ft(rec.H[nx - 1])}; shoreline ${km(xs, 2)}`)
  console.log(`    sand beyond 100 km ${f(100 * sandBeyond / led.cumIn.sand, 2)} % of sand supply (${f(sandBeyond / 1e6, 3)} km2 solid)`)
  for (const k of ['sand', 'mud']) {
    const out = led.cumOut[k] - edge[k]
    console.log(`    ${k}: supplied ${f(led.cumIn[k] / 1e6, 3)} km2; exported past the edge ${f(100 * edge[k] / led.cumIn[k], 2)} %; turbidite run-out and other exports ${f(100 * out / led.cumIn[k], 2)} %`)
  }
  console.log(`    cost ${f(ms / nSteps, 2)} ms per record step (${f(ms, 0)} ms, ${nSteps} steps)`)
}

async function timed(over, segments) {
  const t0 = process.hrtime.bigint()
  const r = await run(over, segments)
  return { ...r, ms: Number(process.hrtime.bigint() - t0) / 1e6 }
}

for (const [label, over] of [['default run (published sea-level curve)', {}], ['constant sea level', { seaLevelKind: 'sine', slAmp: 0 }]]) {
  const r = await timed(over)
  summarise(label, r.eng, r.P, r.trace.sea.at(-1), r.ms, r.sched.nSteps)
}

// Gulf preset, run through the preset loader
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
  const t0 = process.hrtime.bigint()
  let k = 0
  while (S.step(eng, P, sch, sea)) k++
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  summarise('Gulf preset', eng, P, sea(sch.tEndYr[k - 1]), ms, sch.nSteps)
  const nx = eng.rec.nx
  const h = Float64Array.from(eng.rec.mud.subarray(0, nx))
  const welds = St.weldRuns(eng.weldAge, h, P.weldThick, P.dx).filter((w) => w.j1 > w.j0)
  const hi = St.saltHighs(h, P.dx, 300)
  let lastSalt = -1
  for (let j = 0; j < nx; j++) if (h[j] > 100) lastSalt = j
  console.log(`    weld runs (2 columns or more) ${welds.length}, total ${f(sum(welds.map((w) => w.toKm - w.fromKm)), 1)} km, longest ${f(Math.max(0, ...welds.map((w) => w.toKm - w.fromKm)), 1)} km; salt highs (prominence 300 m) ${hi.length}; salt wall (last column with salt over 100 m) ${lastSalt >= 0 ? km((lastSalt + 0.5) * P.dx) : '-'}; basinward surface ${m_ft(eng.rec.H[nx - 1])}`)
  await server.close()
}

// Section length: same stretch of sea floor, closed (old) or open (new) end
console.log('\n== section length 150 km against 300 km, dx 1 km: the same stretch compared ==')
for (const [label, over] of [['constant sea level', { seaLevelKind: 'sine', slAmp: 0 }], ['default run', {}]]) {
  const a = await run(over)
  const b = await run({ ...over, nx: 300 })
  const stretch = (r) => sum(depositByColumn(r.eng.rec).sand, 100, 150) * r.P.dx
  const thick = (r) => r.eng.rec.H[149] - r.eng.rec.b[149]
  const sa = stretch(a), sb = stretch(b)
  console.log(`  ${label}`)
  console.log(`    sand 100-150 km: ${f(sa / 1e6, 3)} (150 km) vs ${f(sb / 1e6, 3)} (300 km) km2 solid: ${f(100 * (sb / sa - 1), 1)} %`)
  console.log(`    sea floor at 150 km: ${m_ft(a.eng.rec.H[149])} vs ${m_ft(b.eng.rec.H[149])}: ${m_ft(b.eng.rec.H[149] - a.eng.rec.H[149])}; sediment above the basement ${f(thick(a), 1)} vs ${f(thick(b), 1)} m: ${f(100 * (thick(b) / thick(a) - 1), 1)} %`)
  const xa = shorelineX(a.eng.rec.H, a.P.dx, a.trace.sea.at(-1)), xb = shorelineX(b.eng.rec.H, b.P.dx, b.trace.sea.at(-1))
  console.log(`    shoreline: ${km(xa, 2)} vs ${km(xb, 2)}`)
}
await close()
