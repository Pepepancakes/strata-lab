// AUD-4 probe: the salt toe of the Gulf preset. Prints the end-of-run geometry around the salt front (basement b,
// salt, cover, seafloor H, sea level) and follows the toe through time: the front column, the salt thickness and
// cover there, and whether the salt top is at the seafloor. Also prints the crest-log episode that ends at the toe.
// Usage: node scripts/review/aud-04-front.mjs
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
const CL = await load('/src/engine/crestLog.ts')

const P = Pr.presetParams('gulf')
const sch = Pr.presetSchedule('gulf')
const eng = S.createEngine(P, sch)
const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
const rec = eng.rec, nx = rec.nx, dx = P.dx
const hist = CL.createCrestHistory(nx, dx, sch.nSteps)
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN')

console.log('toe through time (plain run): age Ma | front col (last col with salt > 100 m) | salt there m | cover there m | seafloor there m | seafloor 1 col beyond m | max salt beyond 250 km m | its cover m | first age the toe cover < 50 m')
let firstExposed = null
let lastPrint = Infinity
while (S.step(eng, P, sch, sea)) {
  const k = eng.diag.stepIndex - 1
  CL.pushCrestFrame(hist, sch.tEndYr[k], sch.stepAgeMa[k], rec.mud.subarray(0, nx), rec.b, rec.H)
  const age = sch.stepAgeMa[k]
  const h = rec.mud.subarray(0, nx)
  let last = nx - 1
  while (last > 0 && h[last] <= 100) last--
  const cov = rec.H[last] - rec.b[last] - h[last]
  let mx = 0, jm = -1
  for (let j = 0; j < nx; j++) if ((j + 0.5) * dx >= 250_000 && h[j] > mx) { mx = h[j]; jm = j }
  const covMax = jm >= 0 ? rec.H[jm] - rec.b[jm] - h[jm] : NaN
  if (firstExposed === null && covMax < 50 && mx > P.saltThick) firstExposed = age
  if (lastPrint - age >= 4 - 1e-9 || k === sch.nSteps - 1) {
    lastPrint = age
    console.log(`  ${f(age, 1).padStart(5)} | ${last} (${f((last + 0.5) * dx / 1000, 1)} km) | ${f(h[last])} | ${f(cov)} | ${f(rec.H[last])} | ${f(rec.H[Math.min(nx - 1, last + 1)])} | ${f(mx)} at ${f((jm + 0.5) * dx / 1000, 1)} km | ${f(covMax)} | ${firstExposed === null ? '-' : f(firstExposed, 1)}`)
  }
}
const sl = sea(sch.tEndYr[sch.nSteps - 1])
console.log(`\nend of run, sea level ${f(sl)} m. Columns 300 to 360 km: km | basement b | salt | cover | seafloor H | water depth`)
const h = rec.mud.subarray(0, nx)
for (let j = 299; j < 360; j += 2) {
  const cov = rec.H[j] - rec.b[j] - h[j]
  console.log(`  ${f((j + 0.5) * dx / 1000, 1)} | ${f(rec.b[j])} | ${f(h[j])} | ${f(cov)} | ${f(rec.H[j])} | ${f(sl - rec.H[j])}`)
}
// the salt-top step at the front
let last = nx - 1
while (last > 0 && h[last] <= 100) last--
console.log(`\nfront column ${last} (${f((last + 0.5) * dx / 1000, 1)} km): salt ${f(h[last])} m, cover ${f(rec.H[last] - rec.b[last] - h[last])} m, seafloor ${f(rec.H[last])} m; next column: salt ${f(h[last + 1])} m, seafloor ${f(rec.H[last + 1])} m; step in the seafloor ${f(rec.H[last] - rec.H[last + 1])} m (${f((rec.H[last] - rec.H[last + 1]) / 0.3048)} ft) over one column of ${dx} m`)

const log = CL.buildCrestLog(hist, CL.crestParams(P.weldThick), true)
for (const e of log.episodes) {
  if (e.endKm < 250) continue
  const tr = e.track
  console.log(`\ncrest-log episode #${e.id} ending at ${e.endKm} km, ${e.firstAgeMa} to ${e.lastAgeMa} Ma, end ${e.endReason}, label ${e.label}, at the seafloor ${f(e.atSeafloorMyr, 1)} Myr, near ${f(e.nearMyr, 1)} Myr, L/h ${f(e.lOverH, 1)}, neighbour salt ${f(e.neighbourSaltM)} m`)
  console.log('  age Ma | col (km) | salt m | cover m | salt top depth m | flank seafloor depth m')
  for (let i = 0; i < tr.ageMa.length; i += Math.max(1, Math.floor(tr.ageMa.length / 16))) console.log(`  ${f(tr.ageMa[i], 2)} | ${tr.col[i]} (${f((tr.col[i] + 0.5) * dx / 1000, 1)}) | ${f(tr.saltThickM[i])} | ${f(tr.coverM[i])} | ${f(tr.saltTopDepthM[i])} | ${f(tr.flankSeafloorDepthM[i])}`)
  const i = tr.ageMa.length - 1
  console.log(`  ${f(tr.ageMa[i], 2)} | ${tr.col[i]} (${f((tr.col[i] + 0.5) * dx / 1000, 1)}) | ${f(tr.saltThickM[i])} | ${f(tr.coverM[i])} | ${f(tr.saltTopDepthM[i])} | ${f(tr.flankSeafloorDepthM[i])}  (last record)`)
}
await server.close()
