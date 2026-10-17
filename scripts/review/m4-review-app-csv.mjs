// M4.6 integrity review, helper: writes the APP's own CSV export for the six review wells by running the app's code
// (sampleWell, wellPressures, wellCsv) in Node on the preset's final record. It exists so that m4-review.mjs can compare its
// hand calculation with the app on the SAME record: the record a browser produces differs from Node's by a few ulps and, through
// the failure thresholds, by more (D14), so the browser CSVs from m4-review-browser.mjs cannot be compared station by station.
// This file is the only review script that imports the app's well modules; m4-review.mjs imports none of them.
// Usage: node scripts/review/m4-review-app-csv.mjs <outDir>
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dir = process.argv[2] || 'm4-app-csv'
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const Step = await load('/src/engine/step.ts'), Pre = await load('/src/engine/presets.ts'), Sea = await load('/src/engine/sealevel.ts'), Det = await load('/src/engine/determinism.ts')
const Well = await load('/src/engine/well.ts'), WP = await load('/src/engine/wellPressure.ts'), WPP = await load('/src/engine/wellPressureParams.ts'), Exp = await load('/src/views/wellplan/exportWell.ts')

function runPreset(id) {
  const P = Pre.presetParams(id), sch = Pre.presetSchedule(id)
  const eng = Step.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  while (Step.step(eng, P, sch, sea)) { /* run */ }
  return { eng, P, sl: sea(sch.tEndYr[sch.nSteps - 1]), hash: String(Det.stateHash(eng.rec)) }
}

mkdirSync(dir, { recursive: true })
// the same wells the browser script plans through the panel: wellhead 69.5 km, TD = the preset's default, J wells KOP 5,000 ft, 3 deg/100 ft, hold 30 deg
const wells = { vertical: {}, 'j-basinward': { kickoffFt: 5000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30, direction: 'basinward' }, 'j-landward': { kickoffFt: 5000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30, direction: 'landward' } }
const td = { last3: 6500, gulf: 30000 }
for (const preset of ['last3', 'gulf']) {
  const run = runPreset(preset)
  console.log(`${preset} ${run.hash}`)
  for (const [tag, over] of Object.entries(wells)) {
    const well = { ...Well.verticalWell(69.5, td[preset]), ...over }
    const samples = Well.sampleWell(run.eng, run.P, run.sl, well)
    for (const m of tag === 'vertical' ? ['eaton', 'matthews-kelly'] : ['eaton']) {
      const pressures = WP.wellPressures(samples, { ...WPP.defaultWellPressureParams(), fgMethod: m })
      const ctx = { scenario: Pre.getPreset(preset).label, presetId: preset, timeMa: 0, well, fgMethod: m, appVersion: 'node', engineVersion: 1 }
      writeFileSync(join(dir, `${preset}-${tag}-${m}.csv`), Exp.wellCsv(ctx, [{ branchId: 'root', label: 'Main run', samples, pressures, stateHash: run.hash }]))
    }
  }
}
console.log(`wrote ${readdirSync(dir).filter((f) => f.endsWith('.csv')).length} CSV files to ${dir}`)
await server.close()
