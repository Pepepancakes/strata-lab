// M3.8 exploration: run the gulf preset with a list of overrides and print one summary line each.
// Usage: node scripts/review/m3-sweep.mjs [presetId] '[{"supply":22},{"subsBasin":40}]'
// Each line: weld runs (km, age), highs with cover under 1 km (crest depth in ft), minibasin widths and
// median spacing (km), salt volume change, run time. Exploration only; the test file is the check.
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
const St = await load('/src/engine/saltStructures.ts')
const Salt = await load('/src/engine/salt.ts')
const U = await load('/src/units.ts')
const id = process.argv[2] || 'gulf'
// Argument 3: a JSON list of override objects, or {"base":{...},"grid":{"key":[v1,v2],...}} (all combinations).
const arg3 = JSON.parse(process.argv[3] || '[{}]')
let list = arg3
if (!Array.isArray(arg3)) {
  list = [arg3.base || {}]
  for (const [k, vals] of Object.entries(arg3.grid || {})) list = list.flatMap((o) => vals.map((v) => ({ ...o, [k]: v })))
}
const tag = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !(arg3.base && k in arg3.base) || (arg3.grid && k in arg3.grid))))
const minProm = Number(process.env.MINPROM || 300)
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
for (const over of list) {
  const P = { ...Pr.presetParams(id), ...over }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const rec = eng.rec
  const nx = rec.nx
  const v0 = Salt.saltVolume(rec)
  const t0 = Date.now()
  while (S.step(eng, P, sch, sea));
  const ms = Date.now() - t0
  const h = Float64Array.from(rec.mud.subarray(0, nx))
  const mb = St.minibasins(h, P.dx, minProm), hi = St.saltHighs(h, P.dx, minProm)
  const welds = St.weldRuns(eng.weldAge, h, P.weldThick, P.dx).filter((r) => r.toKm - r.fromKm >= 2).map((r) => `${r.fromKm}-${r.toKm}km@${r.firstMa.toFixed(0)}Ma`)
  const shallow = hi.filter((q) => eng.salt.Sb[q.j] < Number(process.env.SHALLOW || 1000)).map((q) => `${(q.x / 1000).toFixed(0)}km:${Math.round(U.mToFt(eng.salt.Sb[q.j]))}ft`)
  const minCover = hi.length ? Math.round(Math.min(...hi.map((q) => eng.salt.Sb[q.j]))) : -1
  let mnS = 1e9
  for (let j = 60; j < nx; j++) if (h[j] < mnS && h[j] > 0) mnS = h[j]
  console.log(tag(over), `| shore ${eng.diag.shore} ${ms}ms vol ${((Salt.saltVolume(rec) - v0) / v0).toExponential(1)} clip ${eng.diag.saltClip}`)
  console.log(`   welds>=2km [${welds}] shallow highs [${shallow}] minCover ${minCover} m; min salt (km 60+, >0) ${Math.round(mnS)} m; highs ${hi.length}; minibasins ${mb.length} widths ${mb.map((q) => (q.width / 1000).toFixed(0))} spacing med ${(med(St.spacings(mb)) / 1000).toFixed(1)}`)
}
await server.close()
