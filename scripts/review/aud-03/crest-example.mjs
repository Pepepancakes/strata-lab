// AUD-3: the numbers the user guide quotes in 14.7 (worked example and medians), re-measured after the Gulf mud change.
// Usage: node scripts/review/aud-03/crest-example.mjs [crestId ...]     (default crests 5 and 11)
// Prints the plain run's rows for those crests and, for the plain run plus six 1 ulp noise runs (salts 3, 5, 7, 11, 13, 17),
// the crest count, the label counts and the median near-window F, A and F - A per run and over all crests of all runs
// (D16.4, SALT-R2 N-2: the spread between seeds on one machine is not a platform difference). Name the platform when you quote it.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const TM = await server.ssrLoadModule('/src/worker/timeMachine.ts')
const Noise = await server.ssrLoadModule('/tests/helpers/ulpNoise.ts')
const ids = process.argv.slice(2).map(Number)
if (!ids.length) ids.push(5, 11)
const FT = 1 / 0.3048
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
const gulf = () => { const tm = new TM.TimeMachine(); tm.run({ presetId: 'gulf', overrides: {} }, 1); return tm.crestLog(tm.root).episodes }

const runs = [['plain', null], ...[3, 5, 7, 11, 13, 17].map((s) => [`ulp${s}`, s])]
const all = []
for (const [name, salt] of runs) {
  const E = salt === null ? gulf() : Noise.withUlpNoise(2.2e-16, salt, gulf)
  all.push(...E)
  const lab = (l) => E.filter((e) => e.label === l).length
  console.log(`${name}: ${E.length} crests, tapered ${lab('tapered')}, unresolved ${lab('unresolved')}, tabular ${lab('tabular')}; median F ${median(E.map((e) => e.near.F)).toFixed(1)} A ${median(E.map((e) => e.near.A)).toFixed(1)} F-A ${median(E.map((e) => e.near.FminusA)).toFixed(1)} m/Myr = ${(median(E.map((e) => e.near.FminusA)) * FT).toFixed(0)} ft/Myr`)
  if (salt === null) {
    for (const id of ids) {
      const e = E.find((q) => q.id === id)
      if (!e) { console.log(`  crest ${id}: none`); continue }
      console.log(`  crest ${id}: ${JSON.stringify({ id: e.id, endKm: e.endKm, firstAgeMa: e.firstAgeMa, lastAgeMa: e.lastAgeMa, endReason: e.endReason, endAgeMa: e.endAgeMa, near: e.near, burial: e.burial, label: e.label, neighbourSaltM: e.neighbourSaltM, lOverH: e.lOverH, timeAtSeafloorMyr: e.timeAtSeafloorMyr })}`)
    }
  }
}
console.log(`ALL ${all.length} crests of ${runs.length} runs: tapered ${all.filter((e) => e.label === 'tapered').length}, unresolved ${all.filter((e) => e.label === 'unresolved').length}, tabular ${all.filter((e) => e.label === 'tabular').length}; median F-A ${median(all.map((e) => e.near.FminusA)).toFixed(1)} m/Myr = ${(median(all.map((e) => e.near.FminusA)) * FT).toFixed(0)} ft/Myr; median A ${median(all.map((e) => e.near.A)).toFixed(1)} m/Myr = ${(median(all.map((e) => e.near.A)) * FT).toFixed(0)} ft/Myr`)
await server.close()
