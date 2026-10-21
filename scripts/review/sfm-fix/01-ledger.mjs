// SFM-4 check 1: the sediment ledger, per grain size, recomputed from the layer record (not through recordBalance), with the new
// "exported past the basinward edge" term (cumEdge) kept apart from turbidite run-out and slope failures.
//   expected stored = init + cumIn - cumOut      stored = dx x sum of the layer sand / mud (solid m^2)
// Also: cumEdge <= cumOut; with turbidites and failures off, cumOut = cumEdge exactly (nothing else may book an export);
// with the edge closed (closedEdge) cumEdge = 0 and the old wall holds everything.
//   node scripts/review/sfm-fix/01-ledger.mjs
import { engine, close, runCase, platform, f } from './lib.mjs'

console.log(`SFM-4 01 ledger. ${platform}`)
const { Record } = await engine()

function report(label, r) {
  const { eng, P } = r
  const rec = eng.rec, led = rec.ledger
  const out = [`== ${label}`]
  for (const k of ['sand', 'mud']) {
    let stored = 0
    for (let i = 0; i < rec.nLayers * rec.nx; i++) if (rec.material[i] !== Record.SALT) stored += rec[k][i] // salt cells keep the salt thickness in the mud array
    stored *= P.dx
    const expected = led.init[k] + led.cumIn[k] - led.cumOut[k]
    const rel = (stored - expected) / Math.max(1, led.cumIn[k] + led.init[k])
    const edge = led.cumEdge[k], other = led.cumOut[k] - led.cumEdge[k]
    out.push(`  ${k}: supplied ${f(led.cumIn[k] / 1e6)} km2, exported past the edge ${f(edge / 1e6)} km2 (${f(100 * edge / led.cumIn[k], 2)} % of supply), other exports ${f(other / 1e6)} km2 (${f(100 * other / led.cumIn[k], 2)} %), stored ${f(stored / 1e6)} vs expected ${f(expected / 1e6)} km2, closure error ${rel.toExponential(2)} of (supply + start)`)
    if (!(edge <= led.cumOut[k] + 1e-6)) out.push(`  FAIL: cumEdge > cumOut for ${k}`)
    if (Math.abs(rel) > 1e-9) out.push(`  FAIL: ${k} does not close`)
  }
  const b = Record.recordBalance(rec)
  out.push(`  recordBalance (the app's own): sand ${b.sand.relError.toExponential(2)}, mud ${b.mud.relError.toExponential(2)}, salt ${b.salt.relError.toExponential(2)}; events ${eng.events.length}`)
  console.log(out.join('\n'))
  return { led, eng }
}

const defaults = report('default run (published curve)', await runCase())
report('constant sea level', await runCase({ over: { seaLevelKind: 'sine', slAmp: 0 } }))
report('all mud (sandFrac 0)', await runCase({ over: { sandFrac: 0 } }))
report('all sand (sandFrac 1)', await runCase({ over: { sandFrac: 1 } }))
const off = report('turbidites off (tcMax 0), failure off: nothing but the edge may export', await runCase({ over: { tcMax: 0 } }))
console.log(`  check: cumOut - cumEdge sand ${off.led.cumOut.sand - off.led.cumEdge.sand}, mud ${off.led.cumOut.mud - off.led.cumEdge.mud} (must be exactly 0)`)
const closed = report('closed wall (closedEdge, tests-only switch)', await runCase({ over: { closedEdge: true } }))
console.log(`  check: cumEdge sand ${closed.led.cumEdge.sand}, mud ${closed.led.cumEdge.mud} (must be exactly 0)`)
report('turbidites with failure on (mtd preset)', await runCase({ preset: 'mtd' }))
report('Gulf preset (salt, 400 km)', await runCase({ preset: 'gulf' }))
report('short salt preset', await runCase({ preset: 'saltshort' }))
// determinism: two runs of the default case give the same ledger and surface, bit for bit
const again = await runCase()
const same = defaults.eng.rec.H.every((v, i) => v === again.eng.rec.H[i]) && defaults.led.cumEdge.mud === again.eng.rec.ledger.cumEdge.mud
console.log(`rerun bit-identical (surface and edge export): ${same}`)
await close()
