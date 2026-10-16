// M3.12 integrity re-review 2: independent checks of the salt basin edge fix (M3.10) and the D18/D19 docs (M3.11).
// Usage: node scripts/review/m3-rereview-2.mjs <part> [outfile]
//   part edge    Gulf run: salt every 10 km, no pile at the basinward edge, conservation, M3.9-values comparison
//   part crests  my own crest count (>= 20 km from every salt and section edge), seeds and no-unevenness controls
//   part ulp     ulp-noise runs (the test salts 3,5,7,11,13,17 and my salts 1..6): weld band, crests, edge
//   part hash    stateHash of last3, mtd, miocene, cenozoic, saltshort, gulf (run again with REVIEW_ROOT=<other worktree>)
// All feature measures are written here from the raw record (salt thickness in layer 0 of rec.mud, surface rec.H,
// basement rec.b). Nothing calls src/engine/saltStructures.ts or the salt physics.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const here = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const root = process.env.REVIEW_ROOT || here
const part = process.argv[2] || 'gulf'
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
// withUlpNoise lives in tests/helpers; load it from THIS worktree (main may not have it)
const ULP = await (async () => {
  const s2 = server
  return s2.ssrLoadModule('/tests/helpers/ulpNoise.ts').catch(async () => {
    const other = await createServer({ root: here, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { noDiscovery: true, include: [] } })
    return other.ssrLoadModule('/tests/helpers/ulpNoise.ts')
  })
})()

const results = {}
let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`)
  if (!ok) fails++
  results[name] = { ok, detail }
}
const km = (x) => (x / 1000).toFixed(1)
const FT = 3.280839895

/** Run a preset to the end; return raw arrays only. over = parameter overrides. */
function run(id, over = {}, { keepAt = [] } = {}) {
  const P = { ...Pr.presetParams(id), ...over }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const rec = eng.rec, nx = rec.nx
  const h0 = Float64Array.from(rec.mud.subarray(0, nx))
  const snaps = {}
  const shelf = []
  const t0 = process.hrtime.bigint()
  while (S.step(eng, P, sch, sea)) {
    const a = sch.stepAgeMa[eng.diag.stepIndex - 1]
    for (const k of keepAt) if (!(k in snaps) && a <= k + 1e-9) snaps[k] = { h: Float64Array.from(rec.mud.subarray(0, nx)), H: Float64Array.from(rec.H), b: Float64Array.from(rec.b) }
    if (eng.diag.stepIndex % 100 === 0) shelf.push({ a, H: Float64Array.from(rec.H), sl: sea((sch.startAgeMa - a) * 1e6) })
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  const slEnd = sea(sch.startAgeMa * 1e6)
  return { P, sch, nx, dx: P.dx, h0, h: Float64Array.from(rec.mud.subarray(0, nx)), H: Float64Array.from(rec.H), b: Float64Array.from(rec.b),
    sl: slEnd, ms, hash: Det.stateHash(rec), clip: eng.diag.saltClip, limited: eng.diag.saltLimited, snaps, shelf, steps: sch.nSteps }
}

// ---- own feature measures -------------------------------------------------------------------------
const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s }

/** Weld runs: columns that started with >= weldThick of salt and now hold less. Runs of adjacent columns. */
function welds(r, thick) {
  const runs = []
  let j = 0
  while (j < r.nx) {
    if (r.h0[j] >= thick && r.h[j] < thick) {
      let k = j
      while (k + 1 < r.nx && r.h0[k + 1] >= thick && r.h[k + 1] < thick) k++
      runs.push({ from: j * r.dx, to: (k + 1) * r.dx, km: ((k + 1 - j) * r.dx) / 1000 })
      j = k + 1
    } else j++
  }
  return runs
}

/** Local maxima of salt thickness h with prominence >= prom: highest col in +/- w columns, and the
 *  drop on each side to the lowest point before a higher point (the standard topographic prominence). */
function crests(r, prom = 300, w = 2) {
  const { h, nx } = r
  const out = []
  for (let j = 0; j < nx; j++) {
    let isMax = true
    for (let d = -w; d <= w; d++) { const k = j + d; if (k >= 0 && k < nx && k !== j && (h[k] > h[j] || (h[k] === h[j] && k < j))) isMax = false }
    if (!isMax) continue
    // prominence: walk each side until a higher column; keep the min along the way
    let lmin = h[j], rmin = h[j], lHit = false, rHit = false
    for (let k = j - 1; k >= 0; k--) { if (h[k] > h[j]) { lHit = true; break } lmin = Math.min(lmin, h[k]) }
    for (let k = j + 1; k < nx; k++) { if (h[k] > h[j]) { rHit = true; break } rmin = Math.min(rmin, h[k]) }
    const p = Math.min(lHit ? h[j] - lmin : h[j] - lmin, rHit ? h[j] - rmin : h[j] - rmin)
    if (p < prom) continue
    // depth of salt top below the seafloor = total column - salt - ... : H - (b + h)
    const depth = r.H[j] - (r.b[j] + h[j])
    out.push({ j, x: (j + 0.5) * r.dx, h: h[j], prom: p, depthM: depth, depthFt: depth * FT, wf: r.sl - r.H[j], edge: j < 10 || j >= nx - 10 })
  }
  return out
}

/** shoreline (first column, from land, where the surface is below sea level) and a shelf-edge proxy (steepest slope). */
function shore(H, sl, dx) {
  let s = -1
  for (let j = 0; j < H.length; j++) if (H[j] < sl) { s = j; break }
  let mx = 0, e = -1
  for (let j = Math.max(s, 0); j + 1 < H.length; j++) { const g = (H[j] - H[j + 1]) / dx; if (g > mx) { mx = g; e = j } }
  return { shoreKm: s >= 0 ? ((s + 0.5) * dx) / 1000 : null, steepKm: e >= 0 ? ((e + 0.5) * dx) / 1000 : null }
}


const NO_LIMIT = { saltLimitStart: 2000000, saltLimitEnd: 2500000 } // the registry defaults = the M3.9 preset

/** My edge measures from the end-of-run record. */
function edgeMeasures(r) {
  const { h, nx, dx } = r
  let first = 0, last = nx - 1
  while (first < nx && h[first] <= 100) first++
  while (last > 0 && h[last] <= 100) last--
  const L = (nx * dx) / 1000
  let mb250 = 0, ml20 = 0
  for (let j = 0; j < nx; j++) { const x = (j + 0.5) * dx; if (x >= 250000) mb250 = Math.max(mb250, h[j]); if (x > nx * dx - 20000) ml20 = Math.max(ml20, h[j]) }
  let f0 = 0, l0 = nx - 1
  while (f0 < nx && r.h0[f0] <= 100) f0++
  while (l0 > 0 && r.h0[l0] <= 100) l0--
  return { L, firstKm: ((first + 0.5) * dx) / 1000, frontKm: ((last + 0.5) * dx) / 1000, mb250, ml20, startFirstKm: ((f0 + 0.5) * dx) / 1000, startFrontKm: ((l0 + 0.5) * dx) / 1000 }
}

/** Crests (my own measure, prominence >= 300 m, +/-2 columns) with the 20 km exclusions. */
function crestTable(r) {
  const e = edgeMeasures(r)
  const all = crests(r)
  return all.map((c) => {
    const xk = c.x / 1000
    const dEdgeSec = Math.min(xk, e.L - xk)
    const dSalt = Math.min(xk - e.firstKm, e.frontKm - xk)
    const dSalt0 = Math.min(xk - e.startFirstKm, e.startFrontKm - xk)
    return { ...c, xk, shallow: c.depthM <= 2000, dEdgeSec, dSalt, dSalt0, ok20: dEdgeSec >= 20 && dSalt >= 20 }
  })
}

if (part === 'edge') {
  const r = run('gulf', {}, { keepAt: [60, 40, 20, 10] })
  const e = edgeMeasures(r)
  const v0 = sum(r.h0) * r.dx, v1 = sum(r.h) * r.dx
  console.log(`gulf: ${Math.round(r.ms)} ms, hash ${String(r.hash).slice(0, 12)}, params saltLimit ${r.P.saltLimitStart}-${r.P.saltLimitEnd}`)
  const row0 = [], row = []
  for (let j = 4; j < r.nx; j += 10) { const k = Math.round(((j + 1) * r.dx) / 1000); row0.push(`${k}:${Math.round(r.h0[j])}`); row.push(`${k}:${Math.round(r.h[j])}`) }
  console.log('START salt thickness (m) every 10 km:', row0.join(' '))
  console.log('END   salt thickness (m) every 10 km:', row.join(' '))
  console.log(`salt body: start ${e.startFirstKm.toFixed(1)}..${e.startFrontKm.toFixed(1)} km, end ${e.firstKm.toFixed(1)}..${e.frontKm.toFixed(1)} km; section ${e.L} km`)
  console.log(`max salt beyond 250 km ${Math.round(e.mb250)} m (${(e.mb250 / r.P.saltThick).toFixed(2)} x start ${r.P.saltThick}); max in last 20 km ${e.ml20.toFixed(3)} m`)
  const mass = (h, a, b) => { let s = 0; for (let j = a; j < b; j++) s += h[j]; return s * r.dx }
  console.log(`salt mass (km2 x1e-3): start ${(v0 / 1e6).toFixed(1)}, end ${(v1 / 1e6).toFixed(1)}; seaward of 240 km: ${(mass(r.h0, 240, r.nx) / 1e6).toFixed(2)} -> ${(mass(r.h, 240, r.nx) / 1e6).toFixed(1)}; seaward of 360 km: ${(mass(r.h, 360, r.nx) / 1e6).toFixed(3)}`)
  console.log('salt front (>100 m) by age:', [60, 40, 20, 10].map((k) => { const s = r.snaps[k]; let l = s.h.length - 1; while (l > 0 && s.h[l] <= 100) l--; return `${k} Ma ${l + 1} km max ${Math.round(Math.max(...s.h.subarray(240)))} m` }).join(' | '))
  const tail = []; for (let j = 340; j < 400; j += 4) tail.push(`${j + 1}:${Math.round(r.h[j])}/c${Math.round(r.H[j] - r.b[j] - r.h[j])}`)
  console.log('km:salt/cover(m) 340..400:', tail.join(' '))
  check('E1 salt conserved to 1e-12', Math.abs(v1 / v0 - 1) < 1e-12, `rel ${(v1 / v0 - 1).toExponential(2)}`)
  check('E2 saltClip 0 (limiter only at near-zero thickness)', r.clip === 0, `clip ${r.clip} limiter columns ${r.limited}`)
  check('E3 no salt over 100 m within 20 km of the edge', e.ml20 <= 100, `max ${e.ml20.toFixed(2)} m, front ${e.frontKm.toFixed(1)} km`)
  check('E4 no pile: thickest salt beyond 250 km under 1.5 x start', e.mb250 < 1.5 * r.P.saltThick, `${Math.round(e.mb250)} m = ${(e.mb250 / r.P.saltThick).toFixed(2)} x`)
  const r9 = run('gulf', NO_LIMIT)
  const e9 = edgeMeasures(r9)
  const row9 = []
  for (let j = 4; j < r9.nx; j += 10) row9.push(`${Math.round(((j + 1) * r9.dx) / 1000)}:${Math.round(r9.h[j])}`)
  console.log('M3.9 values (no limit), END salt every 10 km:', row9.join(' '))
  console.log(`M3.9 values: max beyond 250 ${Math.round(e9.mb250)} m, last 20 km ${Math.round(e9.ml20)} m, front ${e9.frontKm.toFixed(1)} km, hash ${String(r9.hash).slice(0, 12)}`)
  check('E5 the M3.9 values show the pile (so the check can fail)', e9.ml20 > 1000 && e9.mb250 > 1.5 * r9.P.saltThick, `last20 ${Math.round(e9.ml20)} m beyond250 ${Math.round(e9.mb250)} m`)
  const trk = r.shelf.filter((_, i) => i % 6 === 0).map((s) => `${s.a.toFixed(1)}Ma ${shore(s.H, s.sl, r.dx).shoreKm}`)
  console.log('shoreline km track:', trk.join(' | '))
  const wr = welds(r, 100)
  console.log('welds:', wr.map((w) => `${km(w.from)}-${km(w.to)}`).join(', '), 'total', wr.reduce((a, w) => a + w.km, 0), 'longest', Math.max(...wr.map((w) => w.km)))
  console.log('total column thickness (km) at 100/200/300/399:', [100, 200, 300, 399].map((k) => ((r.H[k] - r.b[k]) / 1000).toFixed(1)).join(' / '), ' surface H (m):', [100, 200, 300, 399].map((k) => Math.round(r.H[k])).join(' / '))
  results.edge = { row, row9, e, e9 }
}

if (part === 'crests') {
  for (const [lab, over] of [['preset (seed 2)', {}], ['seed 1', { coverSeed: 1 }], ['seed 3', { coverSeed: 3 }], ['seed 4', { coverSeed: 4 }], ['no unevenness', { coverUneven: 0 }], ['M3.9 values', NO_LIMIT]]) {
    const r = run('gulf', over)
    const t = crestTable(r)
    const e = edgeMeasures(r)
    const ok = t.filter((c) => c.shallow && c.ok20)
    const okStart = t.filter((c) => c.shallow && c.dEdgeSec >= 20 && c.dSalt0 >= 20)
    console.log(`${lab}: salt body ${e.firstKm.toFixed(0)}..${e.frontKm.toFixed(0)} km. shallow(<=2 km) crests anywhere ${t.filter((c) => c.shallow).length}; >=20 km inside end-of-run salt body and section: ${ok.length} [${ok.map((c) => `${c.xk.toFixed(1)}km cover ${Math.round(c.depthM)}m (${Math.round(c.depthFt)}ft) h${Math.round(c.h)} prom${Math.round(c.prom)}`).join('; ')}]; >=20 km inside START salt body: ${okStart.length}`)
    if (lab === 'preset (seed 2)') {
      console.log('   all crests prom>=300:', t.map((c) => `${c.xk.toFixed(1)}km h${Math.round(c.h)} cover${Math.round(c.depthM)}${c.shallow ? '*' : ''}${c.ok20 ? '' : '(<20km edge)'}`).join('; '))
      console.log(`   within 1 km of seafloor (ok20): ${ok.filter((c) => c.depthM <= 1000).length}; min cover of any crest ${Math.min(...t.map((c) => c.depthM)).toFixed(0)} m; prominence/thickness at the shallow crests:`, ok.map((c) => `${(c.h / 1000).toFixed(1)}km/${((c.prom / c.h) * 100).toFixed(0)}%`).join(' '))
      results.crests = t
    }
  }
}

if (part === 'ulp') {
  const rows = []
  const sum1 = (r, lab) => {
    const wr = welds(r, 100), t = crestTable(r), e = edgeMeasures(r)
    const o = { lab, weldTotal: wr.reduce((a, w) => a + w.km, 0), weldLongest: Math.max(0, ...wr.map((w) => w.km)), weldRuns2: wr.filter((w) => w.km >= 2).length, nRuns: wr.length,
      crests: t.filter((c) => c.shallow && c.ok20).length, shallowAny: t.filter((c) => c.shallow).length, ml20: e.ml20, mb250: Math.round(e.mb250), front: e.frontKm, clip: r.clip, rel: Math.abs(sum(r.h) / sum(r.h0) - 1), hash: String(r.hash).slice(0, 8) }
    rows.push(o)
    console.log(JSON.stringify(o))
    return o
  }
  sum1(run('gulf'), 'plain')
  for (const s of [3, 5, 7, 11, 13, 17, 1, 2, 4, 6]) sum1(ULP.withUlpNoise(2.2e-16, s, () => run('gulf')), `ulp${s}`)
  const six = rows.slice(1, 7), all = rows
  check('U1 weld band (total >= 8 km, longest >= 2 km) in plain + test six salts', [rows[0], ...six].every((o) => o.weldTotal >= 8 && o.weldLongest >= 2), `totals ${[rows[0], ...six].map((o) => o.weldTotal).join(',')} longest ${[rows[0], ...six].map((o) => o.weldLongest).join(',')}`)
  check('U2 weld band in my salts 1,2,4,6 too', rows.slice(7).every((o) => o.weldTotal >= 8 && o.weldLongest >= 2), `totals ${rows.slice(7).map((o) => o.weldTotal).join(',')} longest ${rows.slice(7).map((o) => o.weldLongest).join(',')}`)
  check('U3 no pile, no salt in last 20 km, conserved, saltClip 0 in every run', all.every((o) => o.ml20 <= 100 && o.mb250 < 6000 && o.rel < 1e-12 && o.clip === 0), `ml20 max ${Math.max(...all.map((o) => o.ml20))}, mb250 max ${Math.max(...all.map((o) => o.mb250))}, rel max ${Math.max(...all.map((o) => o.rel)).toExponential(1)}`)
  console.log(`  spread (plain + 10 salts): weld total ${Math.min(...all.map((o) => o.weldTotal))}..${Math.max(...all.map((o) => o.weldTotal))} km; longest ${Math.min(...all.map((o) => o.weldLongest))}..${Math.max(...all.map((o) => o.weldLongest))} km; crests(ok20) ${Math.min(...all.map((o) => o.crests))}..${Math.max(...all.map((o) => o.crests))}`)
}

if (part === 'hash') {
  const out = {}
  for (const id of ['last3', 'mtd', 'miocene', 'cenozoic', 'saltshort', 'gulf']) {
    const times = []
    let hash
    for (let i = 0; i < 2; i++) { let r; try { r = run(id) } catch (e) { console.log(id, 'ERR', String(e).slice(0, 80)); break } times.push(r.ms); hash = String(r.hash) }
    if (hash) { out[id] = { hash, msAll: times.map((t) => Math.round(t)) }; console.log(id, hash.slice(0, 12), 'ms', out[id].msAll.join('/')) }
  }
  results.hashes = out
}

if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 1))
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed')
await server.close()
process.exit(0)
