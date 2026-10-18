// AUD-6 own check: where are the capped cells on the Gulf preset at the end of the run, and do the display reads
// (TimeMachine view.clamps / maxUOverL, wellProfile cappedCells) agree with a direct count over the record.
import { join } from 'node:path'
import { createServer } from 'vite'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false }, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } })
const load = (p) => server.ssrLoadModule(p)
const TM = await load('/src/worker/timeMachine.ts')
const Pr = await load('/src/engine/presets.ts')
const Comp = await load('/src/engine/compaction.ts')
const Rec = await load('/src/engine/record.ts')
const Det = await load('/src/engine/determinism.ts')
const Prof = await load('/src/views/well/profile.ts')

const id = process.argv[2] ?? 'gulf'
const p = Pr.PRESETS.find((x) => x.id === id)
const tm = new TM.TimeMachine()
const t0 = Date.now()
tm.run({ presetId: id, segments: p.segments.map((s) => ({ ...s })), overrides: {} }, 1)
const ms = Date.now() - t0
const view = tm.seek(tm.root, tm.nSteps, ['u', 'lam', 'thick'])
const rec = tm.eng.rec
const nx = rec.nx
console.log(`${id}: ${tm.nSteps} steps in ${ms} ms, hash ${Det.stateHash(rec)}, view.clamps ${view.clamps}, view.maxUOverL ${view.maxUOverL}`)
// direct count of cells at the cap now
let capped = 0, max = 0, cells = 0
const perCol = new Int32Array(nx)
const EMPTY = 1e-9
for (let j = 0; j < nx; j++) {
  let above = 0
  for (let l = rec.nLayers - 1; l >= 0; l--) {
    const i = l * nx + j
    if (rec.material[i] === Rec.SALT) continue
    const s = rec.sand[i] + rec.mud[i]
    if (s <= EMPTY) continue
    const L = Comp.buoyantLoad(above, s)
    above += s
    if (L > 0) {
      cells++
      const r = rec.u[i] / L
      if (r > max) max = r
      if (r >= 1 - 1e-9) { capped++; perCol[j]++ }
      if (rec.u[i] > L * (1 + 1e-9)) console.log(`  u ABOVE L at col ${j} layer ${l}: ${rec.u[i] / L}`)
    }
  }
}
console.log(`  cells now at the cap (u/L >= 1 - 1e-9): ${capped} of ${cells} sediment cells; largest u/L ${max}`)
const cols = [...perCol].map((n, j) => [j, n]).filter(([, n]) => n > 0)
console.log(`  columns with capped cells: ${cols.length}; first ${cols.slice(0, 5).map(([j, n]) => `${j}:${n}`).join(' ')} ... most: ${cols.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([j, n]) => `col ${j} (x ${(j * p.params.dx / 1000).toFixed(0)} km): ${n}`).join('; ')}`)
for (const j of [cols[0]?.[0], 150, 250].filter((x) => x !== undefined)) {
  const well = tm.wellColumn(tm.root, tm.nSteps, j)
  const prof = Prof.wellProfile(well, [], 80 * 0.3048)
  const cp = prof.points.filter((q) => q.capped)
  console.log(`  pseudo-well col ${j} (x ${(j * p.params.dx / 1000).toFixed(0)} km): profile cappedCells ${prof.cappedCells}, direct ${perCol[j]}, maxUOverL ${prof.maxUOverL.toFixed(4)}; capped depths ft TVDSS ${cp.length ? `${Math.round(Math.min(...cp.map((q) => q.tvdssFt)))} to ${Math.round(Math.max(...cp.map((q) => q.tvdssFt)))}` : '-'}; trend cell ${prof.trendCell ? `${Math.round(prof.trendCell.depthBelowSeaFt)} ft, OBG ${prof.trendCell.overburdenPpg.toFixed(2)} ppg` : '-'}`)
}
await server.close()
