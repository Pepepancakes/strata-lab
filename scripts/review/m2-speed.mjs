// M2.10: failure on vs off timing (3 runs each) plus the hashes that must not change.
// Usage: node scripts/review/m2-speed.mjs [runs] [preset ...]
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
const args = process.argv.slice(2)
const runs = Number(args[0]) || 3
const ids = args.length > 1 ? args.slice(1) : ['last3', 'miocene', 'cenozoic', 'mtd']
const ms = () => Number(process.hrtime.bigint()) / 1e6

function once(id, failOn) {
  const P = { ...Pr.presetParams(id), failOn }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const t0 = ms()
  while (S.step(eng, P, sch, sea));
  return { ms: ms() - t0, events: eng.events.length, unresolved: eng.diag.failUnresolved, hash: Det.stateHash(eng.rec) }
}
for (const id of ids) {
  const off = [], on = []
  let o
  for (let r = 0; r < runs; r++) { off.push(once(id, 0)); o = once(id, 1); on.push(o) }
  const f = (a) => a.map((x) => Math.round(x.ms)).join('/')
  const best = (a) => Math.min(...a.map((x) => x.ms))
  const pct = (a, b) => Math.round((100 * (a - b)) / b)
  const pcts = on.map((x, i) => pct(x.ms, off[i].ms)).join('/')
  console.log(`${id}: off ${f(off)} ms, on ${f(on)} ms, paired overhead % ${pcts}, best-of overhead ${pct(best(on), best(off))} %, events ${o.events}, unresolved ${o.unresolved}, hash off ${String(off[0].hash).slice(0, 16)}, hash on ${String(o.hash).slice(0, 16)}`)
}
await server.close()
