// AUD-5 measurement, node side: run time of the long presets bundled (preset value) and full (bundleEvery = 1), and the pore
// pressure at about 10,000 ft below the sea floor in a few columns, fast vs full. Read-only; nothing here copies engine code.
// Usage: node scripts/review/aud-05-cost.mjs [presetId ...]     (default: miocene cenozoic gulf; the full Gulf and Cenozoic runs take minutes)
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const S = await load('/src/engine/step.ts')
const Pr = await load('/src/engine/presets.ts')
const Sea = await load('/src/engine/sealevel.ts')
const Comp = await load('/src/engine/compaction.ts')
const K = await load('/src/engine/constants.ts')
const U = await load('/src/units.ts')

const FT = 0.3048
const COLS = { miocene: [80, 100], cenozoic: [80, 100], gulf: [80, 100, 250] }
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['miocene', 'cenozoic', 'gulf']

function run(id, bundleEvery) {
  const P = { ...Pr.presetParams(id), bundleEvery }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const heap0 = process.memoryUsage().heapUsed
  const t0 = process.hrtime.bigint()
  while (S.step(eng, P, sch, sea)) { /* run */ }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  if (global.gc) global.gc()
  return { P, eng, sch, sea, ms, heapMB: (process.memoryUsage().heapUsed - heap0) / 1e6 }
}

// Pore pressure (ppg EMW) of the cell nearest 10,000 ft below the sea floor in column j (deepest sediment cell if the column is thinner).
function pore10k(r, j) {
  const rec = r.eng.rec, nx = rec.nx
  const sl = r.sea(r.sch.tEndYr[r.sch.nSteps - 1])
  const wd = Math.max(0, sl - rec.H[j])
  let depth = wd, best = null
  for (let l = rec.nLayers - 1; l >= 0; l--) {
    const i = l * nx + j
    if (rec.sand[i] + rec.mud[i] <= 1e-9) continue
    const h = Comp.cellBulk(r.eng, r.P, i)
    const mid = depth + 0.5 * h
    depth += h
    if (rec.material[i] === 1) continue
    best = { ftBsf: (mid - wd) / FT, ppg: U.densityToPpg((K.RHO_W * K.G * mid + rec.u[i]) / (K.G * mid)) }
    if (mid - wd > 10000 * FT) break
  }
  return best
}

console.log(`node ${process.version} ${process.platform}`)
for (const id of ids) {
  const fast = run(id, Pr.presetParams(id).bundleEvery)
  const full = run(id, 1)
  console.log(`${id}: steps ${fast.sch.nSteps}, bundleEvery ${fast.P.bundleEvery}; fast ${(fast.ms / 1000).toFixed(1)} s, full ${(full.ms / 1000).toFixed(1)} s, ratio ${(full.ms / fast.ms).toFixed(2)}; heap growth fast ${fast.heapMB.toFixed(0)} MB, full ${full.heapMB.toFixed(0)} MB`)
  for (const j of COLS[id] ?? []) {
    const a = pore10k(fast, j), b = pore10k(full, j)
    console.log(`  col ${j}: fast ${a ? a.ppg.toFixed(2) + ' ppg at ' + a.ftBsf.toFixed(0) + ' ft' : 'n/a'} | full ${b ? b.ppg.toFixed(2) + ' ppg at ' + b.ftBsf.toFixed(0) + ' ft' : 'n/a'}`)
  }
}
await server.close()
