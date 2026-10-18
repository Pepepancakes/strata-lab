// AUD-6 own check: what the Hart et al. (1995) mud did to the SHALLOW section of the Gulf preset.
// Hart's fit comes from the hydrostatic part of Eugene Island 330 (under about 1,500 m), so the model's
// shallow pore pressure is where the coefficients should be most at home. Prints pore pressure (ppg EMW,
// sea-surface datum) and u / L at 500, 1,000, 2,000 and 5,000 ft below the sea floor at several columns,
// for the preset as it is (Hart mud) and with the North Sea mud put back by override (the main 9e51c12 values).
//   node scripts/review/aud-06/shallow.mjs
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { noDiscovery: true, include: [] } })
const load = (p) => server.ssrLoadModule(p)
const S = await load('/src/engine/step.ts')
const Pr = await load('/src/engine/presets.ts')
const Sea = await load('/src/engine/sealevel.ts')
const Comp = await load('/src/engine/compaction.ts')
const K = await load('/src/engine/constants.ts')
const U = await load('/src/units.ts')
const Det = await load('/src/engine/determinism.ts')

const G = K.G, RW = K.RHO_W
const emw = (pa, depth) => U.densityToPpg(pa / (G * depth))
const FT = 0.3048
const COLS = [100, 150, 200, 250, 300]
const TARGETS = [500, 1000, 2000, 5000]

function run(over) {
  const P = { ...Pr.presetParams('gulf'), ...over }
  const sch = Pr.presetSchedule('gulf')
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const t0 = Date.now()
  while (S.step(eng, P, sch, sea)) { /* run */ }
  const sl = sea(sch.tEndYr[sch.nSteps - 1])
  return { P, eng, sl, ms: Date.now() - t0 }
}

function table(name, r) {
  const { eng, P, sl } = r
  const rec = eng.rec, nx = rec.nx
  console.log(`\n${name}: hash ${Det.stateHash(rec)}, clamps ${eng.diag.clamps}, ${r.ms} ms, phi0 mud ${P.phi0[1]}, beta mud ${P.beta[1]}`)
  console.log('  col | water ft | ' + TARGETS.map((t) => `${t} ft: pore ppg (u/L, phi)`).join(' | '))
  for (const j of COLS) {
    const wd = Math.max(0, sl - rec.H[j])
    const out = []
    for (const t of TARGETS) {
      let depth = 0, found = null
      for (let l = rec.nLayers - 1; l >= 0; l--) {
        const i = l * nx + j
        const s = rec.sand[i] + rec.mud[i]
        if (s <= 1e-9) continue
        const h = Comp.cellBulk(eng, P, i)
        const mid = depth + 0.5 * h
        depth += h
        if (rec.material[i] === 1) { if (mid > t * FT) { found = 'salt'; break } else continue }
        if (Math.abs(mid - t * FT) <= 0.5 * h + 1e-9 || mid > t * FT) {
          const d = wd + mid
          found = `${emw(RW * G * d + rec.u[i], d).toFixed(2)} (${(eng.ld[i] > 0 ? rec.u[i] / eng.ld[i] : 0).toFixed(2)}, ${(1 - s / h).toFixed(2)})`
          break
        }
      }
      out.push(found ?? 'thin')
    }
    console.log(`  ${String(j).padStart(3)} | ${(wd / FT).toFixed(0).padStart(6)} | ${out.join(' | ')}`)
  }
}

table('Gulf preset as on this branch (Hart mud)', run({}))
table('Gulf preset with the North Sea mud put back (phi0 0.63, beta 5.2e-8)', run({ phi0: [0.49, 0.63], beta: [2.68e-8, 5.2e-8] }))
await server.close()
