// M3.4 report and exploration: run a preset (with overrides) and print the salt history.
// Usage: node scripts/review/m3-gulf.mjs [presetId] ['{"saltThick":2000,...}'] [--table]
// Prints the shelf-edge track, salt structures at the end (minibasins, salt highs, welds, expulsion)
// and, with --table, salt thickness (m) and seafloor depth (ft) every 10 km at 66, 40, 20, 0 Ma.
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
const Det = await load('/src/engine/determinism.ts')
const St = await load('/src/engine/saltStructures.ts')
const Salt = await load('/src/engine/salt.ts')
const U = await load('/src/units.ts')
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const table = process.argv.includes('--table')
const id = args[0] || 'gulf'
const over = JSON.parse(args[1] || '{}')
const minProm = Number(process.env.MINPROM || 300)
const P = { ...Pr.presetParams(id), ...over }
const sch = Pr.presetSchedule(id)
const eng = S.createEngine(P, sch)
const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
const rec = eng.rec, nx = rec.nx
const km = (x) => (x / 1000).toFixed(1)
const saltH = () => Float64Array.from(rec.mud.subarray(0, nx))
const vol0 = Salt.saltVolume(rec)
const snaps = new Map()
const want = [66, 40, 20, 0]
const grab = (age) => {
  const t = (sch.startAgeMa - age) * 1e6
  snaps.set(age, { h: saltH(), H: Float64Array.from(rec.H), sl: sea(t) })
}
grab(66)
let w = 0
const edgeTrack = []
const t0 = Date.now()
while (S.step(eng, P, sch, sea)) {
  const a = sch.stepAgeMa[eng.diag.stepIndex - 1]
  while (w < want.length - 1 && a <= want[w + 1] + 1e-9) { w++; grab(want[w]) }
  if (eng.diag.stepIndex % 100 === 0) edgeTrack.push(`${a.toFixed(1)}Ma:shore ${eng.diag.shore >= 0 ? km((eng.diag.shore + 0.5) * P.dx) : '-'} edge ${eng.diag.shelfEdge >= 0 ? km((eng.diag.shelfEdge + 0.5) * P.dx) : '-'}`)
}
const ms = Date.now() - t0
console.log(`run ${ms} ms, steps ${sch.nSteps}, nx ${nx}, dx ${P.dx}, hash ${String(Det.stateHash(rec)).slice(0, 12)}, clip ${eng.diag.saltClip}, limited ${eng.diag.saltLimited}`)
console.log('shelf track (km):', edgeTrack.join(' | '))
const h = saltH()
const vol1 = Salt.saltVolume(rec)
console.log(`salt volume change ${((vol1 - vol0) / vol0).toExponential(2)}`)
const show = (label, f) => console.log(label, f.map((q) => `${km(q.x)}km w${km(q.width)} t${Math.round(q.thick)} p${Math.round(q.prominence)}`).join('; ') || 'none')
const mb = St.minibasins(h, P.dx, minProm), hi = St.saltHighs(h, P.dx, minProm)
console.log(`minProm ${minProm} m`)
show(`minibasins (${mb.length}):`, mb)
console.log('minibasin spacing km:', St.spacings(mb).map((s) => km(s)).join(' '))
show(`salt highs (${hi.length}):`, hi)
const cover = Float64Array.from(eng.salt.Sb)
for (const q of hi) console.log(`  high ${km(q.x)} km: cover over roof ${Math.round(cover[q.j])} m (${Math.round(U.mToFt(cover[q.j]))} ft), seafloor ${Math.round(U.mToFt(snaps.get(0).sl - snaps.get(0).H[q.j]))} ft`)
for (const r of St.weldRuns(eng.weldAge, h, P.weldThick, P.dx)) console.log(`weld run ${r.fromKm}-${r.toKm} km, formed ${r.firstMa.toFixed(2)} to ${r.lastMa.toFixed(2)} Ma`)
let mxSalt = 0, mxj = 0
for (let j = 0; j < nx; j++) if (h[j] > mxSalt) { mxSalt = h[j]; mxj = j }
console.log(`thickest salt ${Math.round(mxSalt)} m at ${km((mxj + 0.5) * P.dx)} km; initial thickest ${P.saltThick}`)
if (process.env.PROFILE) {
  const s = snaps.get(0)
  for (let j = 0; j < nx; j += Number(process.env.PROFILE)) console.log(`${km((j + 0.5) * P.dx)} km  salt ${Math.round(h[j])} m  cover ${Math.round(cover[j])} m  seafloor ${Math.round(U.mToFt(s.sl - s.H[j]))} ft`)
}
if (table) {
  for (const age of want) {
    const s = snaps.get(age)
    const row = []
    for (let j = 9; j < nx; j += 10) row.push(`${((j + 1) * P.dx / 1000).toFixed(0)}:${Math.round(s.h[j])}/${Math.round(U.mToFt(s.sl - s.H[j]))}`)
    console.log(`${age} Ma  km:saltM/seafloorFt  ${row.join(' ')}`)
  }
}
await server.close()
