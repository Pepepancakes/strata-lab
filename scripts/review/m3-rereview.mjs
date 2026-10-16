// M3.9 integrity re-review: independent checks of the Gulf-style preset (D18 targets).
// Usage: node scripts/review/m3-rereview.mjs <part> [outfile]
//   part gulf   dx 1000 m: weld runs, crests near the seafloor, minibasin widths, basinward transport,
//               conservation, saltClip, wedge progradation   (checks 1)
//   part grid   same measures at dx 1000 and dx 500 over a 200 km section (MAX_COLUMNS = 400)  (checks 2)
//   part ulp    gulf under withUlpNoise at several salts; spread of the measures  (checks 3)
//   part short  the 10 Myr salt preset: structures and run time  (checks 5)
//   part hash   stateHash and speed of last3, mtd, miocene, cenozoic (run again with REVIEW_ROOT=<main worktree>)  (checks 6)
// The feature measures below are MY OWN, written from the raw record (salt thickness in layer 0 of rec.mud,
// surface rec.H, basement rec.b). Nothing here calls src/engine/saltStructures.ts or the salt physics.
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

/** Minibasins = local minima of h (+/- 2 cols) with prominence >= prom; width = extent of the contiguous
 *  columns whose h is below (min + half the smaller bounding relief). */
function minibasins(r, prom = 300) {
  const { h, nx } = r
  const out = []
  for (let j = 1; j < nx - 1; j++) {
    let isMin = true
    for (let d = -2; d <= 2; d++) { const k = j + d; if (k >= 0 && k < nx && k !== j && (h[k] < h[j] || (h[k] === h[j] && k < j))) isMin = false }
    if (!isMin) continue
    let lmax = h[j], rmax = h[j]
    for (let k = j - 1; k >= 0; k--) { if (h[k] < h[j]) break; lmax = Math.max(lmax, h[k]) }
    for (let k = j + 1; k < nx; k++) { if (h[k] < h[j]) break; rmax = Math.max(rmax, h[k]) }
    const p = Math.min(lmax - h[j], rmax - h[j])
    if (p < prom) continue
    const lev = h[j] + 0.5 * p
    let a = j, b = j
    while (a - 1 >= 0 && h[a - 1] < lev) a--
    while (b + 1 < nx && h[b + 1] < lev) b++
    out.push({ j, x: (j + 0.5) * r.dx, h: h[j], prom: p, widthKm: ((b - a + 1) * r.dx) / 1000, a, b })
  }
  return out
}

/** Salt-weighted centroid (km) over the whole section. */
function centroid(h, dx) { let m = 0, mx = 0; for (let j = 0; j < h.length; j++) { m += h[j]; mx += h[j] * (j + 0.5) * dx } return mx / m / 1000 }

/** shoreline (first column, from land, where the surface is below sea level) and a shelf-edge proxy (steepest slope). */
function shore(H, sl, dx) {
  let s = -1
  for (let j = 0; j < H.length; j++) if (H[j] < sl) { s = j; break }
  let mx = 0, e = -1
  for (let j = Math.max(s, 0); j + 1 < H.length; j++) { const g = (H[j] - H[j + 1]) / dx; if (g > mx) { mx = g; e = j } }
  return { shoreKm: s >= 0 ? ((s + 0.5) * dx) / 1000 : null, steepKm: e >= 0 ? ((e + 0.5) * dx) / 1000 : null }
}

function measures(r, label, { thick = 100 } = {}) {
  const wr = welds(r, thick)
  const cr = crests(r)
  const mb = minibasins(r)
  const sizes = mb.map((m) => m.widthKm)
  return { label, wr, cr, mb, sizes }
}

function report(r, m) {
  console.log(`-- ${m.label}: run ${Math.round(r.ms)} ms, steps ${r.steps}, hash ${String(r.hash).slice(0, 12)}, saltClip ${r.clip}, limited ${r.limited}`)
  console.log('  welds (h0>=100 m now <100 m):', m.wr.map((w) => `${km(w.from)}-${km(w.to)} km (${w.km.toFixed(0)} km)`).join('; ') || 'none')
  for (const c of m.cr) console.log(`  crest @${km(c.x)} km  h ${Math.round(c.h)} m  prom ${Math.round(c.prom)}  top-of-salt ${Math.round(c.depthM)} m = ${Math.round(c.depthFt)} ft below seafloor  (water ${Math.round(c.wf)} m)${c.edge ? '  EDGE' : ''}`)
  for (const b of m.mb) console.log(`  minibasin @${km(b.x)} km  salt ${Math.round(b.h)} m  prom ${Math.round(b.prom)}  width ${b.widthKm.toFixed(1)} km`)
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN }

if (part === 'gulf') {
  const r = run('gulf', {}, { keepAt: [40, 20] })
  const m = measures(r, 'gulf dx1000')
  report(r, m)
  const v0 = sum(r.h0) * r.dx, v1 = sum(r.h) * r.dx
  const rel = Math.abs(v1 / v0 - 1)
  const maxWeld = Math.max(0, ...m.wr.map((w) => w.km))
  check('1a weld run >= 2 km (D18)', maxWeld >= 2, `longest ${maxWeld.toFixed(0)} km; runs ${m.wr.map((w) => `${km(w.from)}-${km(w.to)}`).join(', ')}`)
  console.log('  weld location relative to shoreline/pinch-out:', JSON.stringify(shore(r.H, r.sl, r.dx)), 'pinch ramp', r.P.saltPinchStart / 1000, '-', r.P.saltPinchEnd / 1000, 'km')
  const near = m.cr.filter((c) => c.depthM <= 2000 && !c.edge)
  check('1b >= 2 salt crests within 2 km of seafloor, not edge (D18)', near.length >= 2, `${near.length}: ${near.map((c) => `${km(c.x)} km ${Math.round(c.depthM)} m`).join('; ')}; all crests: ${m.cr.length}`)
  const near1 = m.cr.filter((c) => c.depthM <= 1000 && !c.edge)
  console.log(`  (original card target, within 1 km: ${near1.length})`)
  const wide = m.sizes.filter((w) => w >= 5 && w <= 30).length
  check('1c minibasins mostly 5-30 km wide', m.sizes.length > 0 && wide / m.sizes.length > 0.5, `${wide}/${m.sizes.length} (widths ${m.sizes.map((x) => x.toFixed(1)).join(', ')} km)`)
  const c0 = centroid(r.h0, r.dx), c1 = centroid(r.h, r.dx)
  // basinward transport: salt mass landward vs seaward of a fixed line (the pinch ramp mid-point)
  const split = Math.round(((r.P.saltPinchStart + r.P.saltPinchEnd) / 2) / r.dx)
  const mass = (h, a, b) => { let s = 0; for (let j = a; j < b; j++) s += h[j]; return s * r.dx }
  const lw0 = mass(r.h0, 0, split), lw1 = mass(r.h, 0, split)
  check('1d salt moved basinward', c1 > c0 && lw1 < lw0, `centroid ${c0.toFixed(1)} -> ${c1.toFixed(1)} km; landward of ${km(split * r.dx)} km: ${(lw0 / 1e6).toFixed(0)} -> ${(lw1 / 1e6).toFixed(0)} km^2e-3`)
  // landward edge column loss, expulsion
  check('1e salt conserved to 1e-12', rel < 1e-12, `rel ${rel.toExponential(2)}`)
  check('1f saltClip 0', r.clip === 0, `saltClip ${r.clip}`)
  // progradation: shoreline km at 40/20/0 Ma
  const prog = []
  for (const k of [40, 20]) { const s = r.snaps[k]; prog.push(`${k} Ma ${JSON.stringify(shore(s.H, 0, r.dx))}`) }
  console.log('  shoreline proxy (H<0 m, uncorrected for sea level):', prog.join(' | '), '| 0 Ma', JSON.stringify(shore(r.H, r.sl, r.dx)))
  const trk = r.shelf.filter((_, i) => i % 6 === 0).map((s) => `${s.a.toFixed(1)}Ma ${JSON.stringify(shore(s.H, s.sl, r.dx))}`)
  console.log('  shoreline/steepest-slope track:', trk.join(' | '))
  // salt-thickness profile each 10 km
  const row = []
  for (let j = 4; j < r.nx; j += 10) row.push(`${Math.round(((j + 1) * r.dx) / 1000)}:${Math.round(r.h[j])}`)
  console.log('  end salt thickness m every 10 km:', row.join(' '))
  const edge = []
  for (let j = r.nx - 40; j < r.nx; j += 4) edge.push(`${Math.round(((j + 1) * r.dx) / 1000)}km h${Math.round(r.h[j])} cover${Math.round(r.H[j] - r.b[j] - r.h[j])}`)
  console.log('  last 40 km (edge artifact look):', edge.join(' | '))
  results.gulf = { weld: m.wr, crests: m.cr, minibasins: m.mb }
}

if (part === 'grid') {
  // 200 km section so both grids fit in 400 columns; everything else the Gulf preset
  const rows = []
  for (const dx of [1000, 500]) {
    const nx = 200000 / dx
    const r = run('gulf', { dx, nx })
    const m = measures(r, `gulf 200 km @ dx ${dx}`)
    report(r, m)
    rows.push({ dx, r, m })
  }
  const [a, b] = rows
  const md = (m) => med(m.sizes), sp = (m) => { const xs = m.cr.filter((c) => !c.edge).map((c) => c.x / 1000); const d = []; for (let i = 1; i < xs.length; i++) d.push(xs[i] - xs[i - 1]); return med(d) }
  console.log(`  median minibasin width ${md(a.m).toFixed(2)} vs ${md(b.m).toFixed(2)} km; median crest spacing ${sp(a.m).toFixed(2)} vs ${sp(b.m).toFixed(2)} km`)
  const dev = (x, y) => Math.abs(x - y) / ((x + y) / 2)
  check('2a median minibasin width within 15 %', dev(md(a.m), md(b.m)) <= 0.15, `${(100 * dev(md(a.m), md(b.m))).toFixed(1)} %`)
  check('2b median crest spacing within 15 %', dev(sp(a.m), sp(b.m)) <= 0.15, `${(100 * dev(sp(a.m), sp(b.m))).toFixed(1)} %`)
  for (const q of rows) check(`2c weld run >= 2 km at dx ${q.dx}`, Math.max(0, ...q.m.wr.map((w) => w.km)) >= 2, q.m.wr.map((w) => w.km.toFixed(0)).join(',') || 'none')
  for (const q of rows) console.log(`  dx ${q.dx}: crests within 2 km of seafloor (non-edge): ${q.m.cr.filter((c) => c.depthM <= 2000 && !c.edge).length}`)
  // dx 2000 over 400 km vs dx 1000 over 400 km, as a second read
  const r2 = run('gulf', { dx: 2000, nx: 200 }); const m2 = measures(r2, 'gulf 400 km @ dx 2000'); report(r2, m2)
  const r1 = run('gulf', {}); const m1 = measures(r1, 'gulf 400 km @ dx 1000')
  const sp1 = sp(m1), sp2 = sp(m2)
  console.log(`  400 km: median width ${md(m1).toFixed(2)} (dx1000) vs ${md(m2).toFixed(2)} (dx2000); crest spacing ${sp1.toFixed(2)} vs ${sp2.toFixed(2)}`)
  console.log(`  400 km: dev width ${(100 * dev(md(m1), md(m2))).toFixed(1)} %, spacing ${(100 * dev(sp1, sp2)).toFixed(1)} %`)
}

/** Own spectral measure: dominant wavelength (km) of salt thickness between x0 and x1 (m): remove a straight line,
 *  Hann taper, direct DFT, power-weighted mean wavelength over wl in [wmin, wmax] m. */
function wavelength(r, x0, x1, wmin = 3000, wmax = 40000) {
  const j0 = Math.round(x0 / r.dx), j1 = Math.round(x1 / r.dx), n = j1 - j0
  const y = []
  for (let i = 0; i < n; i++) y.push(r.h[j0 + i])
  const m = (y[n - 1] - y[0]) / (n - 1), y0 = y[0]
  for (let i = 0; i < n; i++) y[i] = (y[i] - (y0 + m * i)) * 0.5 * (1 - Math.cos((2 * Math.PI * (i + 0.5)) / n))
  let num = 0, den = 0
  for (let k = 1; k < n / 2; k++) {
    const wl = (n * r.dx) / k
    if (wl < wmin || wl > wmax) continue
    let re = 0, im = 0
    for (let i = 0; i < n; i++) { re += y[i] * Math.cos((2 * Math.PI * k * i) / n); im += y[i] * Math.sin((2 * Math.PI * k * i) / n) }
    const pw = re * re + im * im
    num += pw * wl; den += pw
  }
  return num / den / 1000
}
function spacingMean(m, x0, x1, minProm = 300) {
  const xs = m.cr.filter((c) => c.x >= x0 && c.x <= x1 && c.prom >= minProm).map((c) => c.x / 1000)
  return xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : NaN
}

if (part === 'grid2') {
  const dev = (x, y) => Math.abs(x - y) / ((x + y) / 2)
  const pairs = [[{ dx: 1000, nx: 200 }, { dx: 500, nx: 400 }, '200 km'], [{ dx: 1000, nx: 400 }, { dx: 2000, nx: 200 }, '400 km']]
  for (const [A, B, lab] of pairs) {
    const ra = run('gulf', A), rb = run('gulf', B)
    for (const [x0, x1] of [[20000, 110000], [20000, 70000]]) {
      const wa = wavelength(ra, x0, x1), wb = wavelength(rb, x0, x1)
      const sa = spacingMean(measures(ra, ''), x0, x1), sb = spacingMean(measures(rb, ''), x0, x1)
      console.log(`  ${lab} window ${x0 / 1000}-${x1 / 1000} km: dominant wavelength ${wa.toFixed(2)} (dx${A.dx}) vs ${wb.toFixed(2)} (dx${B.dx}) km dev ${(100 * dev(wa, wb)).toFixed(1)} %; mean crest spacing ${sa.toFixed(2)} vs ${sb.toFixed(2)} dev ${(100 * dev(sa, sb)).toFixed(1)} %`)
      results[`grid2 ${lab} ${x0}-${x1}`] = { wa, wb, sa, sb }
    }
  }
}

if (part === 'seeds') {
  // Are the shallow crests a basin-floor pile effect (closed seaward edge) or independent structures?
  for (const [lab, over] of [['seed 2 (preset)', {}], ['seed 1', { coverSeed: 1 }], ['seed 3', { coverSeed: 3 }], ['seed 4', { coverSeed: 4 }], ['no unevenness', { coverUneven: 0 }], ['tcMax default 0.3?', { tcMax: undefined }]]) {
    if ('tcMax' in over) delete over.tcMax
    if (lab.startsWith('tcMax')) continue
    const r = run('gulf', over)
    const m = measures(r, lab)
    const near = m.cr.filter((c) => c.depthM <= 2000 && !c.edge)
    const pile = sum(r.h.subarray(250)) / (r.nx - 250)
    console.log(`${lab}: near-seafloor crests ${near.length} [${near.map((c) => `${km(c.x)}km ${Math.round(c.depthM)}m prom${Math.round(c.prom)}`).join('; ')}]; mean salt >250 km ${Math.round(pile)} m (initial ${r.P.saltThick}); longest weld ${Math.max(0, ...m.wr.map((w) => w.km))} km; clip ${r.clip}`)
  }
  // control: how much of the basin-floor 'crest' relief is relief of the pile at all?
  const r = run('gulf')
  const j0 = 280, j1 = 399
  let mn = 1e9, mx = 0
  for (let j = j0; j < j1; j++) { mn = Math.min(mn, r.h[j]); mx = Math.max(mx, r.h[j]) }
  console.log(`plateau 280-399 km salt ${Math.round(mn)}..${Math.round(mx)} m; relief ${Math.round(mx - mn)} m = ${(100 * (mx - mn) / mx).toFixed(1)} % of thickness`)
  const ths = []
  for (let j = 0; j < r.nx; j++) ths.push(r.H[j] - r.b[j])
  console.log('total column thickness (km) at 100/200/300/399:', [100, 200, 300, 399].map((k) => (ths[k] / 1000).toFixed(1)).join(' / '), ' surface H (m):', [100, 200, 300, 399].map((k) => Math.round(r.H[k])).join(' / '), ' basement b (m):', [100, 200, 300, 399].map((k) => Math.round(r.b[k])).join(' / '))
}

if (part === 'seek0') {
  // The browser pass showed the section at step 0 differing in 7,750 of 231,480 pixels between the first visit
  // and a visit after a branch. Test the engine: hash at step 0 (fresh engine) vs the time machine's seek to 0,
  // in several orders, with a branch in between.
  const TM = await load('/src/worker/timeMachine.ts')
  const P = Pr.presetParams('gulf'), sch = Pr.presetSchedule('gulf')
  const fresh = S.createEngine(P, sch)
  const h0 = Det.stateHash(fresh.rec)
  const tm = new TM.TimeMachine()
  tm.run({ presetId: 'gulf', overrides: {} }, 1)
  const root = tm.list()[0].id
  const n = sch.nSteps
  const seen = []
  for (const k of [0, n, 0, Math.round(n * 0.1), 0, Math.round(n * 0.6), 0]) seen.push([k, tm.hashAt(root, k)])
  check('seek0a seek to step 0 equals a fresh engine, 4 visits, scrambled', seen.filter(([k]) => k === 0).every(([, h]) => h === h0), seen.filter(([k]) => k === 0).map(([, h]) => String(h).slice(0, 8)).join(' ') + ' vs fresh ' + String(h0).slice(0, 8))
  const br = tm.branch ? tm.branch(root, Math.round(n * 0.6), {}) : null
  console.log('  branch api:', typeof tm.branch, br ? JSON.stringify(br).slice(0, 80) : '')
  const after = [0, n, 0].map((k) => [k, tm.hashAt(root, k)])
  check('seek0b step 0 of the main run after a branch equals a fresh engine', after.filter(([k]) => k === 0).every(([, h]) => h === h0), after.filter(([k]) => k === 0).map(([, h]) => String(h).slice(0, 8)).join(' '))
  // is the view the UI draws at step 0 the same? compare the StateView arrays of two visits
  const fields = ['thick', 'lam', 'fs', 'temp', 'sand', 'mud', 'smax', 'u', 'cem']
  const tm2 = new TM.TimeMachine()
  tm2.run({ presetId: 'gulf', overrides: {} }, 1)
  const r2 = tm2.list()[0].id
  const snap = (v) => { const o = {}; for (const [k, val] of Object.entries(v)) o[k] = ArrayBuffer.isView(val) ? Float64Array.from(val) : val; return o }
  const v1 = snap(tm2.seek(r2, 0, fields))
  tm2.seek(r2, n, fields)
  tm2.branch(r2, Math.round(n * 0.6), {})
  tm2.seek(r2, n, fields)
  const v2 = snap(tm2.seek(r2, 0, fields))
  const diffs = []
  for (const k of Object.keys(v1)) {
    const a = v1[k], b = v2[k]
    if (a && a.length !== undefined && typeof a !== 'string') { let c = 0; for (let i = 0; i < a.length; i++) if (!(a[i] === b[i] || (Number.isNaN(a[i]) && Number.isNaN(b[i])))) c++; if (c) diffs.push(`${k}: ${c}/${a.length}`) }
    else if (a !== b && !(typeof a === 'object')) diffs.push(`${k}: ${a} vs ${b}`)
  }
  check('seek0c StateView at step 0 identical (all fields) between first visit and after seek/branch', diffs.length === 0, diffs.join('; ') || 'identical')
  console.log('  viewAt exists:', typeof tm.viewAt)
}

if (part === 'ulp') {
  const out = []
  const base = run('gulf')
  const mb = measures(base, 'base')
  out.push({ salt: 'none', weld: Math.max(0, ...mb.wr.map((w) => w.km)), near: mb.cr.filter((c) => c.depthM <= 2000 && !c.edge).length, depths: mb.cr.filter((c) => !c.edge).map((c) => Math.round(c.depthM)), medW: med(mb.sizes), hash: String(base.hash).slice(0, 8) })
  for (const salt of [1, 2, 3, 4, 5, 6]) {
    const r = ULP.withUlpNoise(2.2e-16, salt, () => run('gulf'))
    const m = measures(r, `ulp${salt}`)
    out.push({ salt, weld: Math.max(0, ...m.wr.map((w) => w.km)), near: m.cr.filter((c) => c.depthM <= 2000 && !c.edge).length, depths: m.cr.filter((c) => !c.edge).map((c) => Math.round(c.depthM)), medW: med(m.sizes), nWelds: m.wr.filter((w) => w.km >= 2).length, hash: String(r.hash).slice(0, 8), clip: r.clip })
    console.log(JSON.stringify(out[out.length - 1]))
  }
  console.log(JSON.stringify(out[0]))
  const noisy = out.slice(1)
  check('3a weld >= 2 km under every ulp noise', noisy.every((o) => o.weld >= 2), `longest runs ${noisy.map((o) => o.weld.toFixed(0)).join(',')} km`)
  check('3b >= 2 shallow crests under every ulp noise', noisy.every((o) => o.near >= 2), `counts ${noisy.map((o) => o.near).join(',')}`)
  const ws = noisy.map((o) => o.weld), cs = noisy.map((o) => o.near), md = noisy.map((o) => o.medW)
  console.log(`  spread: weld ${Math.min(...ws)}..${Math.max(...ws)} km; shallow-crest count ${Math.min(...cs)}..${Math.max(...cs)}; median width ${Math.min(...md).toFixed(2)}..${Math.max(...md).toFixed(2)} km`)
}

if (part === 'short') {
  const r = run('saltshort')
  const m = measures(r, 'saltshort', { thick: 10 })
  report(r, m)
  const rr = run('saltshort')
  check('5a short preset deterministic', String(rr.hash) === String(r.hash), '')
  const relief = Math.max(...r.h) - Math.min(...r.h.slice(15, 120))
  const pr = m.cr.filter((c) => !c.edge)
  check('5b short preset forms visible structures (>= 3 crests with prominence >= 300 m, ex edge)', pr.length >= 3, `crests ${pr.length}, minibasins ${m.mb.length}, salt relief ${Math.round(relief)} m`)
  console.log(`  run time ${Math.round(r.ms)} ms (second run ${Math.round(rr.ms)} ms)`)
  const v0 = sum(r.h0) * r.dx, v1 = sum(r.h) * r.dx
  check('5c short preset salt conserved 1e-12', Math.abs(v1 / v0 - 1) < 1e-12, `${(v1 / v0 - 1).toExponential(2)}`)
  const row = []
  for (let j = 4; j < r.nx; j += 5) row.push(`${Math.round(((j + 1) * r.dx) / 1000)}:${Math.round(r.h[j])}`)
  console.log('  end salt thickness m every 5 km:', row.join(' '))
}

if (part === 'hash') {
  const out = {}
  for (const id of ['last3', 'mtd', 'miocene', 'cenozoic']) {
    const times = []
    let hash
    for (let i = 0; i < 3; i++) { const r = run(id); times.push(r.ms); hash = String(Det.stateHash ? r.hash : '') }
    out[id] = { hash, msMin: Math.min(...times), msAll: times.map((t) => Math.round(t)) }
    console.log(id, out[id].hash, 'min ms', Math.round(out[id].msMin), out[id].msAll.join('/'))
  }
  results.hashes = out
}

if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 1))
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed')
await server.close()
process.exit(0)
