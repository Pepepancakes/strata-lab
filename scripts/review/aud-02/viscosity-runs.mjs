// AUD-2 report runs: heat-on presets, max overpressure, slides, pore pressure at 10,000 ft below the sea floor.
// Read-only: runs the engine as it is in this checkout. To get the "before" numbers, run it on the parent commit
// (git stash the compaction change, or check out the parent's src/engine/compaction.ts) and compare.
// Usage: node scripts/review/aud-02/viscosity-runs.mjs <case> [<case> ...]
//   cases: last3 mtd miocene cenozoic gulf   (each run with thermal = 1; mtd keeps its failOn = 1, kMudMult 0.1)
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
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
const Comp = await load('/src/engine/compaction.ts')
const K = await load('/src/engine/constants.ts')
const U = await load('/src/units.ts')

const PPG = 119.8264 // kg/m3 per ppg
for (const id of process.argv.slice(2)) {
  const P = { ...Pr.presetParams(id), thermal: 1 }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const t0 = Date.now()
  while (S.step(eng, P, sch, sea)) { /* run */ }
  const rec = eng.rec
  const nx = rec.nx
  let maxU = 0, maxLam = 0
  for (let l = 0; l < rec.nLayers; l++) for (let j = 0; j < nx; j++) {
    const i = l * nx + j
    if (rec.sand[i] + rec.mud[i] <= 1e-9) continue
    if (rec.u[i] > maxU) maxU = rec.u[i]
    if (eng.ld[i] > 0) maxLam = Math.max(maxLam, rec.u[i] / eng.ld[i])
  }
  const lines = [`${id} thermal=1  hash ${Det.stateHash(rec)}  steps ${eng.diag.stepIndex}  ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    `  max u ${U.paToPsi(maxU).toFixed(0)} psi, max u/L ${maxLam.toFixed(3)}, slides ${eng.events.length}, clamps ${eng.diag.clamps}`]
  // pore pressure 10,000 ft (3048 m) below the sea floor in a few columns
  const sl = sea(sch.tEndYr[sch.nSteps - 1])
  for (const j of [Math.floor(nx * 0.25), Math.floor(nx * 0.375), Math.floor(nx * 0.5), Math.floor(nx * 0.625)]) {
    const water = Math.max(0, sl - rec.H[j])
    let z = 0, hit = -1
    for (let l = rec.nLayers - 1; l >= 0; l--) {
      const i = l * nx + j
      const th = Comp.cellBulk(eng, P, i)
      if (th <= 0) continue
      if (z + 0.5 * th >= 3048) { hit = i; break }
      z += th
    }
    if (hit < 0) { lines.push(`  col ${j}: column thinner than 10,000 ft`); continue }
    const zt = water + z
    const ppg = (K.RHO_W + rec.u[hit] / (K.G * zt)) / PPG
    lines.push(`  col ${j}: water ${U.mToFt ? U.mToFt(water).toFixed(0) : (water / 0.3048).toFixed(0)} ft, u ${U.paToPsi(rec.u[hit]).toFixed(0)} psi, u/L ${(rec.u[hit] / eng.ld[hit]).toFixed(3)}, pore pressure ${ppg.toFixed(2)} ppg EMW at ${(zt / 0.3048).toFixed(0)} ft below sea surface`)
  }
  console.log(lines.join('\n'))
}
await server.close()
