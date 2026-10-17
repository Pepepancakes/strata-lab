// AUD-3: what the Gulf preset's compaction coefficients move. Read-only; nothing here copies engine code.
// Usage: node scripts/review/aud-03/gulf-compaction.mjs [north|hart] [outfile.json]
//   north  mud phi0 0.63, beta 5.2e-8 (the North Sea values the preset had before AUD-3), by override
//   hart   whatever the preset now says (Hart et al. 1995 once AUD-3 is built)
// Runs the Gulf preset plain and under 1 ulp maths noise (salts 7, 11, 13; D16.4), and prints one line per
// run plus the median over the runs. Numbers are for the machine that runs it: name it when you quote them.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const which = process.argv[2] || 'hart'
const outFile = process.argv[3]
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
const SI = await load('/src/engine/saltIntervals.ts')
const SS = await load('/src/engine/saltStructures.ts')
const K = await load('/src/engine/constants.ts')
const U = await load('/src/units.ts')
const TM = await load('/src/worker/timeMachine.ts')
const Prof = await load('/src/views/well/profile.ts')
const Aud = await load('/src/views/well/audit.ts')
const Noise = await load('/tests/helpers/ulpNoise.ts')

const G = K.G, RW = K.RHO_W
const FT = 0.3048
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
const overrides = which === 'north' ? { phi0: [0.49, 0.63], beta: [2.68e-8, 5.2e-8] } : {}

function oneRun() {
  const t0 = performance.now()
  const P = { ...Pr.presetParams('gulf'), ...overrides }
  const sch = Pr.presetSchedule('gulf')
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  while (S.step(eng, P, sch, sea)) { /* run */ }
  const ms = performance.now() - t0
  const rec = eng.rec, nx = rec.nx
  const sl = sea(sch.tEndYr[sch.nSteps - 1])
  const r = { ms, hash: String(Det.stateHash(rec)), clamps: eng.diag.clamps, phi0: P.phi0, beta: P.beta }
  // largest u/L over all sediment cells
  let maxLam = 0
  for (let j = 0; j < nx; j++) {
    for (let l = 0; l < rec.nLayers; l++) {
      const i = l * nx + j
      if (rec.material[i] === 1 || rec.sand[i] + rec.mud[i] <= 1e-9) continue
      const L = eng.ld[i]
      if (L > 0 && rec.u[i] / L > maxLam) maxLam = rec.u[i] / L
    }
  }
  r.maxUOverL = maxLam
  // welds
  const h = Float64Array.from(rec.mud.subarray(0, nx))
  const runs = SS.weldRuns(eng.weldAge, h, P.weldThick, P.dx)
  r.weldTotalKm = runs.reduce((a, q) => a + (q.toKm - q.fromKm), 0)
  r.weldLongestKm = runs.reduce((a, q) => Math.max(a, q.toKm - q.fromKm), 0)
  // D18 bands, as tests/gulfPreset.test.ts defines them (prominence 300 m; 20 km from the section and salt-basin edges)
  {
    const cover = Float64Array.from(eng.salt.Sb)
    const edgeKm = P.dx * nx / 1000
    let first = 0, last = nx - 1
    while (first < nx && h[first] <= 100) first++
    while (last > 0 && h[last] <= 100) last--
    const firstKm = ((first + 0.5) * P.dx) / 1000, frontKm = ((last + 0.5) * P.dx) / 1000
    const shallow = SS.saltHighs(h, P.dx, 300).filter((q) => cover[q.j] < 2000)
    r.shallowAny = shallow.length
    r.crestsD18 = shallow.filter((q) => q.x / 1000 <= edgeKm - 20 && q.x / 1000 >= firstKm + 20 && q.x / 1000 <= frontKm - 20).length
    r.welds2km = runs.filter((q) => q.toKm - q.fromKm >= 2).length
    r.maxBeyond250 = 0
    for (let j = 0; j < nx; j++) if ((j + 0.5) * P.dx >= 250_000) r.maxBeyond250 = Math.max(r.maxBeyond250, h[j])
    r.shelfEdgeEndKm = eng.diag.shelfEdge >= 0 ? ((eng.diag.shelfEdge + 0.5) * P.dx) / 1000 : -1
  }
  // per column: porosity and pore pressure at fixed depths below the seafloor (cell containing the depth)
  r.cols = {}
  for (const j of [150, 250]) {
    const wd = Math.max(0, sl - rec.H[j])
    const c = { waterFt: wd / FT }
    let depth = 0
    for (let l = rec.nLayers - 1; l >= 0; l--) {
      const i = l * nx + j
      if (rec.sand[i] + rec.mud[i] <= 1e-9) continue
      const bulk = Comp.cellBulk(eng, P, i)
      for (const tft of [8000, 10000, 12000]) {
        const t = tft * FT
        if (depth <= t && t < depth + bulk && rec.material[i] !== 1) {
          const d = wd + t
          c[`phi${tft}`] = 1 - (rec.sand[i] + rec.mud[i]) / bulk
          c[`pore${tft}Ppg`] = U.densityToPpg((RW * G * d + rec.u[i]) / (G * d))
          c[`uol${tft}`] = eng.ld[i] > 0 ? rec.u[i] / eng.ld[i] : 0
        }
      }
      depth += bulk
    }
    r.cols[j] = c
  }
  return r
}

function appRun() {
  // the same run through the worker's time machine: crest log, and the cell the Traugott check reads
  const tm = new TM.TimeMachine()
  tm.run({ presetId: 'gulf', overrides }, 1)
  const log = tm.crestLog(tm.root)
  const E = log.episodes
  const out = {
    hash: tm.hashAt(tm.root, tm.nSteps), crests: E.length,
    tapered: E.filter((e) => e.label === 'tapered').length, tabular: E.filter((e) => e.label === 'tabular').length,
    medFminusA: median(E.map((e) => e.near.FminusA)), medA: median(E.map((e) => e.near.A)), medF: median(E.map((e) => e.near.F)),
    medNeighbourM: median(E.map((e) => e.neighbourSaltM)),
    traugott: {},
  }
  for (const j of [150, 250]) {
    const w = tm.wellColumn(tm.root, tm.nSteps, j)
    const p = Prof.wellProfile(w, [])
    const t = Aud.traugottCheck(p.trendCell)
    out.traugott[j] = t ? { modelPpg: t.modelPpg, trendPpg: t.trendPpg, gapPpg: t.gapPpg, depthFt: t.depthBelowSeaFt, waterFt: t.waterDepthFt } : null
  }
  return out
}

const variants = [['plain', null], ['ulp7', 7], ['ulp11', 11], ['ulp13', 13]]
const rows = []
for (const [name, salt] of variants) {
  const go = () => ({ name, run: oneRun(), app: appRun() })
  const row = salt === null ? go() : Noise.withUlpNoise(2.2e-16, salt, go)
  rows.push(row)
  const { run: a, app: b } = row
  console.log(`${which} ${name}: hash ${a.hash} (app ${b.hash}) ${a.ms.toFixed(0)} ms; max u/L ${a.maxUOverL.toFixed(3)}, clamps ${a.clamps}; weld total ${a.weldTotalKm.toFixed(1)} km longest ${a.weldLongestKm.toFixed(1)} km`)
  console.log(`  D18: weld runs >= 2 km ${a.welds2km}; D18 crests (<2 km cover, 20 km rule) ${a.crestsD18} (any ${a.shallowAny}); max salt beyond 250 km ${a.maxBeyond250.toFixed(0)} m; final shelf edge ${a.shelfEdgeEndKm.toFixed(0)} km`)
  for (const j of [150, 250]) {
    const c = a.cols[j], t = b.traugott[j]
    console.log(`  col ${j}: water ${c.waterFt.toFixed(0)} ft; phi 8k ${c.phi8000?.toFixed(3)} 12k ${c.phi12000?.toFixed(3)}; pore@10k ${c.pore10000Ppg?.toFixed(2)} ppg (u/L ${c.uol10000?.toFixed(2)}); Traugott cell ${t ? `${t.depthFt.toFixed(0)} ft TVDSS: model ${t.modelPpg.toFixed(2)} trend ${t.trendPpg.toFixed(2)} gap ${t.gapPpg.toFixed(2)} ppg` : 'none'}`)
  }
  console.log(`  crests ${b.crests} (tapered ${b.tapered}, tabular ${b.tabular}); median F ${b.medF.toFixed(0)} A ${b.medA.toFixed(0)} F-A ${b.medFminusA.toFixed(0)} m/Myr; neighbour salt ${b.medNeighbourM.toFixed(0)} m`)
}
const m = (f) => median(rows.map(f))
console.log(`\nD18 medians: crests ${m((r) => r.run.crestsD18)}, weld runs >= 2 km ${m((r) => r.run.welds2km)}, max salt beyond 250 km ${m((r) => r.run.maxBeyond250).toFixed(0)} m, final shelf edge ${m((r) => r.run.shelfEdgeEndKm).toFixed(0)} km`)
console.log(`\nMEDIAN over ${rows.length} runs (${which}):`)
console.log(`  ms ${m((r) => r.run.ms).toFixed(0)}; max u/L ${m((r) => r.run.maxUOverL).toFixed(3)}; clamps ${m((r) => r.run.clamps)}; weld total ${m((r) => r.run.weldTotalKm).toFixed(1)} longest ${m((r) => r.run.weldLongestKm).toFixed(1)} km; crests ${m((r) => r.app.crests)}; F-A ${m((r) => r.app.medFminusA).toFixed(0)} m/Myr`)
for (const j of [150, 250]) {
  console.log(`  col ${j}: phi8k ${m((r) => r.run.cols[j].phi8000).toFixed(3)} phi12k ${m((r) => r.run.cols[j].phi12000).toFixed(3)} pore@10k ${m((r) => r.run.cols[j].pore10000Ppg).toFixed(2)} ppg; OBG ${m((r) => r.app.traugott[j]?.modelPpg).toFixed(2)} trend ${m((r) => r.app.traugott[j]?.trendPpg).toFixed(2)} gap ${m((r) => r.app.traugott[j]?.gapPpg).toFixed(2)}`)
}
if (outFile) writeFileSync(outFile, JSON.stringify(rows, null, 1))
await server.close()
