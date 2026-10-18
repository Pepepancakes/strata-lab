// AUD-4: salt re-check of the Gulf preset after the AUD-3 compaction change (D26.4). Review script: read-only.
// The engine is run through its public entry points (createEngine / step), but every quantity this review
// judges is recomputed here with its own code: salt thickness profile statistics, weld runs, salt highs and
// their prominence, crests under 2 km of cover with the 20 km rule, the dominant wavelength (own DFT), salt
// front and pile, mass balance per material (own sums), the largest u/L, and the crest-log rates F and A
// (own least squares over the near window from each episode's track). The app's values are printed beside
// them where they exist, so a disagreement shows.
// Usage: node scripts/review/aud-04.mjs [outfile.json] [salts...]      (default salts: plain 3 5 7 11 13 17)
// Numbers are for the machine that runs it: name the platform when you quote them (D16.4).
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outFile = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : null
const saltArgs = process.argv.slice(outFile ? 3 : 2).map(Number).filter(Number.isFinite)
const SALTS = saltArgs.length ? saltArgs : [3, 5, 7, 11, 13, 17]

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
const CL = await load('/src/engine/crestLog.ts')
const SS = await load('/src/engine/saltStructures.ts')
const Rec = await load('/src/engine/record.ts')
const Noise = await load('/tests/helpers/ulpNoise.ts')

const FT = 0.3048
const SALT_TAG = Rec.SALT
const WELD_NONE = -1
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN')

// ---- own measures ---------------------------------------------------------------------------------------

/** Topographic prominence of a local maximum of v at j (walk each way to something taller; higher saddle). */
function ownProminence(v, j) {
  const a = v[j]
  let l = a, r = a
  for (let q = j - 1; q >= 0 && v[q] <= a; q--) l = Math.min(l, v[q])
  for (let q = j + 1; q < v.length && v[q] <= a; q++) r = Math.min(r, v[q])
  return a - Math.max(l, r)
}
/** Local maxima of v with prominence >= minProm (first column of a plateau counts). */
function ownHighs(v, minProm) {
  const out = []
  for (let j = 0; j < v.length; j++) {
    if (j > 0 && v[j - 1] > v[j]) continue
    if (j < v.length - 1 && v[j + 1] >= v[j]) continue
    const p = ownProminence(v, j)
    if (p >= minProm) out.push({ j, prom: p, thick: v[j] })
  }
  return out
}
/** Runs of neighbouring welded columns (weldAge set, salt now under weldThick). */
function ownWeldRuns(weldAge, h, weldThick) {
  const runs = []
  let j = 0
  while (j < h.length) {
    if (weldAge[j] !== WELD_NONE && h[j] < weldThick) {
      let k = j
      while (k + 1 < h.length && weldAge[k + 1] !== WELD_NONE && h[k + 1] < weldThick) k++
      runs.push({ j0: j, j1: k, km: k - j + 1 })
      j = k + 1
    } else j++
  }
  return runs
}
/** Power-weighted mean wavelength (m) of h between fromM and toM: linear detrend, Hann taper, direct DFT. */
function ownWavelength(h, dx, fromM, toM, minWl, maxWl) {
  const idx = []
  for (let j = 0; j < h.length; j++) { const x = (j + 0.5) * dx; if (x >= fromM && x < toM) idx.push(j) }
  const N = idx.length
  const y = idx.map((j) => h[j])
  // detrend
  const mx = (N - 1) / 2
  let sxy = 0, sxx = 0, my = y.reduce((a, b) => a + b, 0) / N
  for (let i = 0; i < N; i++) { sxy += (i - mx) * (y[i] - my); sxx += (i - mx) * (i - mx) }
  const b = sxy / sxx
  const w = y.map((v, i) => (v - my - b * (i - mx)) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))))
  let num = 0, den = 0
  for (let k = 1; k <= N / 2; k++) {
    const wl = (N * dx) / k
    if (wl < minWl || wl > maxWl) continue
    let re = 0, im = 0
    for (let i = 0; i < N; i++) { const ph = (2 * Math.PI * k * i) / N; re += w[i] * Math.cos(ph); im -= w[i] * Math.sin(ph) }
    const p = re * re + im * im
    num += p * wl; den += p
  }
  return den > 0 ? num / den : NaN
}
/** Least-squares slope of y against t. */
function ownSlope(t, y) {
  const n = t.length
  if (n < 2) return NaN
  const mt = t.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) { sxy += (t[i] - mt) * (y[i] - my); sxx += (t[i] - mt) * (t[i] - mt) }
  return sxx > 0 ? sxy / sxx : NaN
}
/** Own near-window rates for an episode: last 1 Myr of the records whose cover is under 500 m. Depths are positive down, so rise = -d(depth)/dt. */
function ownNearRates(ep) {
  const tr = ep.track
  const near = []
  for (let i = 0; i < tr.tMyr.length; i++) if (tr.coverM[i] < 500) near.push(i)
  if (!near.length) return { F: NaN, A: NaN }
  const tEnd = tr.tMyr[near[near.length - 1]]
  const win = near.filter((i) => tr.tMyr[i] >= tEnd - 1 - 1e-9)
  const t = win.map((i) => tr.tMyr[i])
  const F = -ownSlope(t, win.map((i) => tr.saltTopDepthM[i]))
  const A = -ownSlope(t, win.map((i) => tr.flankSeafloorDepthM[i]))
  return { F, A, n: win.length }
}
const ownLabel = (F, A, floor) => (!Number.isFinite(F) || !Number.isFinite(A) ? 'none' : Math.abs(F - A) < floor ? 'unresolved' : A < F ? 'tabular' : 'tapered')

// ---- one run -------------------------------------------------------------------------------------------

function oneRun(name) {
  const P = Pr.presetParams('gulf')
  const sch = Pr.presetSchedule('gulf')
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const rec = eng.rec, nx = rec.nx, dx = P.dx
  // own initial sums per material (before any step)
  const sums = () => {
    let salt = 0, sand = 0, mud = 0
    for (let l = 0; l < rec.nLayers; l++) for (let j = 0; j < nx; j++) {
      const i = l * nx + j
      if (rec.material[i] === SALT_TAG) salt += rec.mud[i] + rec.sand[i]
      else { sand += rec.sand[i]; mud += rec.mud[i] }
    }
    return { salt: salt * dx, sand: sand * dx, mud: mud * dx }
  }
  const init = sums()
  const hist = CL.createCrestHistory(nx, dx, sch.nSteps)
  const edgeAt = {}
  const t0 = performance.now()
  while (S.step(eng, P, sch, sea)) {
    const k = eng.diag.stepIndex - 1
    CL.pushCrestFrame(hist, sch.tEndYr[k], sch.stepAgeMa[k], rec.mud.subarray(0, nx), rec.b, rec.H)
    const age = sch.stepAgeMa[k]
    for (const a of [56, 40, 20, 10]) if (edgeAt[a] === undefined && age <= a + 1e-9) edgeAt[a] = eng.diag.shelfEdge >= 0 ? (eng.diag.shelfEdge + 0.5) * dx / 1000 : -1
  }
  const ms = performance.now() - t0
  const sl = sea(sch.tEndYr[sch.nSteps - 1])
  const r = { name, ms, hash: String(Det.stateHash(rec)) }

  // mass balance per material: own stored sums against the ledger's in/out, and the ledger's "in" against supply x time
  const end = sums()
  const L = rec.ledger
  const bal = (key) => { const stored = end[key] - init[key], exp = L.cumIn[key] - L.cumOut[key]; const scale = L.cumIn[key] > 0 ? L.cumIn[key] : init[key]; return { stored, expected: exp, rel: (stored - exp) / scale } }
  r.balance = { salt: bal('salt'), sand: bal('sand'), mud: bal('mud'), saltRelToInit: (end.salt - init.salt) / init.salt, initSaltKm2: init.salt / 1e6, endSaltKm2: end.salt / 1e6 }
  r.supplyHand = { cumInTotal: L.cumIn.sand + L.cumIn.mud, handTotal: P.supply * P.duration, sandShare: L.cumIn.sand / (L.cumIn.sand + L.cumIn.mud), sandFrac: P.sandFrac, cumOut: L.cumOut.sand + L.cumOut.mud }
  r.diag = { clamps: eng.diag.clamps, saltClip: eng.diag.saltClip, saltLimited: eng.diag.saltLimited, saltLimitedVol: eng.diag.saltLimitedVol, saltLimitMaxH: eng.diag.saltLimitMaxH, deficit: eng.diag.deficit, failUnresolved: eng.diag.failUnresolved }
  // largest u/L over sediment cells, and how many cells sit at the cap
  let maxUL = 0, atCap = 0, sedCells = 0
  for (let l = 0; l < rec.nLayers; l++) for (let j = 0; j < nx; j++) {
    const i = l * nx + j
    if (rec.material[i] === SALT_TAG || rec.sand[i] + rec.mud[i] <= 1e-9) continue
    sedCells++
    const Ld = eng.ld[i]
    if (Ld > 0) { const q = rec.u[i] / Ld; if (q > maxUL) maxUL = q; if (q >= 1 - 1e-9) atCap++ }
  }
  r.pressure = { maxUOverL: maxUL, cellsAtCap: atCap, sedCells }

  // salt profile at the end
  const h = Float64Array.from(rec.mud.subarray(0, nx))
  const cover = new Float64Array(nx)
  for (let j = 0; j < nx; j++) cover[j] = rec.H[j] - rec.b[j] - h[j] // bulk cover over the salt (own; the app keeps eng.salt.Sb)
  let first = 0, last = nx - 1
  while (first < nx && h[first] <= 100) first++
  while (last > 0 && h[last] <= 100) last--
  const firstKm = (first + 0.5) * dx / 1000, frontKm = (last + 0.5) * dx / 1000
  let maxBeyond250 = 0, jMax = -1, maxLast20 = 0, maxAll = 0, jMaxAll = -1, volBeyond250 = 0, volLandward200 = 0, volBeyondLimitEnd = 0
  for (let j = 0; j < nx; j++) {
    const x = (j + 0.5) * dx
    if (x >= 250_000 && h[j] > maxBeyond250) { maxBeyond250 = h[j]; jMax = j }
    if (x >= 250_000) volBeyond250 += h[j] * dx
    if (x < 200_000) volLandward200 += h[j] * dx
    if (x >= P.saltLimitEnd) volBeyondLimitEnd += h[j] * dx
    if (x > nx * dx - 20_000) maxLast20 = Math.max(maxLast20, h[j])
    if (h[j] > maxAll) { maxAll = h[j]; jMaxAll = j }
  }
  r.salt = {
    firstKm, frontKm, limitStartKm: P.saltLimitStart / 1000, limitEndKm: P.saltLimitEnd / 1000,
    pastLimitEndKm: frontKm - P.saltLimitEnd / 1000, shortOfEdgeKm: nx * dx / 1000 - frontKm,
    maxBeyond250, maxBeyond250Km: (jMax + 0.5) * dx / 1000, pileRatio: maxBeyond250 / P.saltThick, maxLast20, maxAll, maxAllKm: (jMaxAll + 0.5) * dx / 1000,
    volBeyond250Km2: volBeyond250 / 1e6, volLandward200Km2: volLandward200 / 1e6, volBeyondLimitEndKm2: volBeyondLimitEnd / 1e6,
    every10km: Array.from({ length: nx / 10 }, (_, q) => ({ km: (q * 10 + 5), h: Math.round(h[q * 10 + 4]), cover: Math.round(cover[q * 10 + 4]) })),
  }
  // welds: own runs vs the app's
  const own = ownWeldRuns(eng.weldAge, h, P.weldThick)
  const app = SS.weldRuns(eng.weldAge, h, P.weldThick, dx)
  let under50 = 0, under100 = 0, between = 0, minRemnant = Infinity
  for (let j = first; j <= last; j++) { if (h[j] < 50) under50++; if (h[j] < 100) under100++; if (h[j] >= 50 && h[j] < 100) between++; if (eng.weldAge[j] !== WELD_NONE && h[j] < minRemnant) minRemnant = h[j] }
  r.welds = {
    totalKm: own.reduce((a, q) => a + q.km, 0), longestKm: own.reduce((a, q) => Math.max(a, q.km), 0), runs2km: own.filter((q) => q.km >= 2).length, count: own.length,
    appTotalKm: app.reduce((a, q) => a + (q.toKm - q.fromKm), 0), appLongestKm: app.reduce((a, q) => Math.max(a, q.toKm - q.fromKm), 0),
    positionsKm: own.map((q) => `${q.j0}-${q.j1 + 1}`), colsUnder50: under50, colsUnder100: under100, cols50to100: between, minWeldRemnantM: minRemnant,
    shelfEdgeEndKm: eng.diag.shelfEdge >= 0 ? (eng.diag.shelfEdge + 0.5) * dx / 1000 : -1,
  }
  // crests (D18 letter): highs of the salt thickness with prominence >= 300 m, cover < 2 km, 20 km from the section edge and the salt edges
  const highs = ownHighs(h, 300)
  const appHighs = SS.saltHighs(h, dx, 300)
  const edgeKm = nx * dx / 1000
  const shallow = highs.filter((q) => cover[q.j] < 2000)
  const d18 = shallow.filter((q) => { const x = (q.j + 0.5) * dx / 1000; return x <= edgeKm - 20 && x >= firstKm + 20 && x <= frontKm - 20 })
  const shallowest = highs.filter((q) => { const x = (q.j + 0.5) * dx / 1000; return x <= edgeKm - 20 && x >= firstKm + 20 && x <= frontKm - 20 }).sort((a, b) => cover[a.j] - cover[b.j])[0]
  r.crests = {
    highs300: highs.length, appHighs300: appHighs.length, shallowAny: shallow.length, d18: d18.length,
    shallowestInsideKm: shallowest ? (shallowest.j + 0.5) * dx / 1000 : NaN, shallowestCoverM: shallowest ? cover[shallowest.j] : NaN, shallowestProm: shallowest ? shallowest.prom : NaN, shallowestThick: shallowest ? shallowest.thick : NaN,
    // character of the highs beyond 250 km: relief against slab thickness
    beyond250: highs.filter((q) => (q.j + 0.5) * dx >= 250_000).map((q) => ({ km: (q.j + 0.5) * dx / 1000, prom: Math.round(q.prom), thick: Math.round(q.thick), cover: Math.round(cover[q.j]) })),
    minibasins: ownHighs(Float64Array.from(h, (v) => -v), 300).length,
  }
  // wavelength: own DFT vs the app's
  r.wavelength = { ownKm: ownWavelength(h, dx, 20_000, 120_000, 4_000, 60_000) / 1000, appKm: SS.saltWavelength(h, dx, 20_000, 120_000, 4_000, 60_000) / 1000 }
  // wedge: shelf edge through time, own shoreline at the end
  let shore = -1
  for (let j = 0; j < nx; j++) if (rec.H[j] < sl) { shore = j; break }
  r.wedge = { edge56: edgeAt[56], edge40: edgeAt[40], edge20: edgeAt[20], edge10: edgeAt[10], edgeEnd: r.welds.shelfEdgeEndKm, ownShoreKm: shore >= 0 ? (shore + 0.5) * dx / 1000 : -1, appShoreKm: eng.diag.shore >= 0 ? (eng.diag.shore + 0.5) * dx / 1000 : -1 }

  // crest log: the app's episodes, with F and A recomputed here from each track
  const log = CL.buildCrestLog(hist, CL.crestParams(P.weldThick), true)
  const E = log.episodes
  let maxDiff = 0, labelMismatch = 0
  const eps = E.map((e) => {
    const o = ownNearRates(e)
    const lab = ownLabel(o.F, o.A, 25)
    if (Number.isFinite(o.F)) maxDiff = Math.max(maxDiff, Math.abs(o.F - e.near.F), Math.abs(o.A - e.near.A))
    if (lab !== e.label && Number.isFinite(e.near.F)) labelMismatch++
    return { id: e.id, km: e.endKm, firstMa: e.firstAgeMa, lastMa: e.lastAgeMa, end: e.endReason, F: o.F, A: o.A, FminusA: o.F - o.A, appF: e.near.F, appA: e.near.A, label: lab, appLabel: e.label, neighbourM: e.neighbourSaltM, lOverH: e.lOverH, atSeafloorMyr: e.atSeafloorMyr, nearMyr: e.nearMyr, lastCoverM: e.track.coverM[e.track.coverM.length - 1], minCoverM: Math.min(...e.track.coverM) }
  })
  r.crestLog = {
    n: E.length, merged: log.merged, buried: E.filter((e) => e.endReason === 'buried').length, welded: E.filter((e) => e.endReason === 'welded').length, runEnd: E.filter((e) => e.endReason === 'run end').length,
    tabular: eps.filter((e) => e.label === 'tabular').length, tapered: eps.filter((e) => e.label === 'tapered').length, unresolved: eps.filter((e) => e.label === 'unresolved').length,
    medF: median(eps.map((e) => e.F)), medA: median(eps.map((e) => e.A)), medFminusA: median(eps.map((e) => e.FminusA)), medNeighbourM: median(eps.map((e) => e.neighbourM)), medLoverH: median(eps.map((e) => e.lOverH)),
    maxOwnVsAppRate: maxDiff, labelMismatch, firstMaRange: [Math.min(...eps.map((e) => e.firstMa)), Math.max(...eps.map((e) => e.firstMa))], lastMaRange: [Math.min(...eps.map((e) => e.lastMa)), Math.max(...eps.map((e) => e.lastMa))],
    kmRange: [Math.min(...eps.map((e) => e.km)), Math.max(...eps.map((e) => e.km))], minCoverEver: Math.min(...eps.map((e) => e.minCoverM)), atSeafloor: eps.filter((e) => e.atSeafloorMyr > 0).length,
    episodes: eps,
  }
  return r
}

// ---- runs ----------------------------------------------------------------------------------------------
const rows = []
const variants = [['plain', null], ...SALTS.map((s) => [`ulp${s}`, s])]
for (const [name, salt] of variants) {
  const r = salt === null ? oneRun(name) : Noise.withUlpNoise(2.2e-16, salt, () => oneRun(name))
  rows.push(r)
  const b = r.balance, w = r.welds, c = r.crests, g = r.crestLog
  console.log(`\n== ${name}: hash ${r.hash}, ${f(r.ms, 0)} ms`)
  console.log(`  balance rel: salt ${b.salt.rel.toExponential(2)} (vs init ${b.saltRelToInit.toExponential(2)}; ${f(b.initSaltKm2, 1)} -> ${f(b.endSaltKm2, 1)} km2), sand ${b.sand.rel.toExponential(2)}, mud ${b.mud.rel.toExponential(2)}; cumIn ${(r.supplyHand.cumInTotal / 1e6).toFixed(1)} km2 vs supply x time ${(r.supplyHand.handTotal / 1e6).toFixed(1)} km2, sand share ${f(r.supplyHand.sandShare, 3)} (sandFrac ${r.supplyHand.sandFrac}), out ${(r.supplyHand.cumOut / 1e6).toFixed(2)} km2`)
  console.log(`  diag: clamps ${r.diag.clamps}, cells at cap now ${r.pressure.cellsAtCap} of ${r.pressure.sedCells}, max u/L ${f(r.pressure.maxUOverL, 4)}; saltClip ${r.diag.saltClip}, saltLimited ${r.diag.saltLimited} (vol ${f(r.diag.saltLimitedVol, 1)} m2, max h ${f(r.diag.saltLimitMaxH, 3)} m), deficit ${r.diag.deficit}`)
  console.log(`  salt: first ${f(r.salt.firstKm)} km, front ${f(r.salt.frontKm)} km (${f(r.salt.pastLimitEndKm, 0)} km past the ${r.salt.limitEndKm} km limit end, ${f(r.salt.shortOfEdgeKm, 0)} km short of the edge); max beyond 250 km ${f(r.salt.maxBeyond250, 0)} m at ${f(r.salt.maxBeyond250Km)} km (${f(r.salt.pileRatio, 2)} x start); max anywhere ${f(r.salt.maxAll, 0)} m at ${f(r.salt.maxAllKm)} km; last 20 km ${f(r.salt.maxLast20, 0)} m; salt beyond 250 km ${f(r.salt.volBeyond250Km2, 0)} km2, landward of 200 km ${f(r.salt.volLandward200Km2, 0)} km2`)
  console.log(`  welds: total ${w.totalKm} km (app ${f(w.appTotalKm)}), longest ${w.longestKm} km (app ${f(w.appLongestKm)}), runs >= 2 km ${w.runs2km}, runs ${w.count} at cols ${w.positionsKm.join(' ')}; cols under 50 m ${w.colsUnder50}, 50 to 100 m ${w.cols50to100}, under 100 m ${w.colsUnder100}; thinnest weld remnant ${f(w.minWeldRemnantM, 1)} m; shelf edge end ${f(w.shelfEdgeEndKm)} km`)
  console.log(`  crests: highs (prom >= 300 m) ${c.highs300} (app ${c.appHighs300}), minibasins ${c.minibasins}, under 2 km cover anywhere ${c.shallowAny}, D18 (20 km rule) ${c.d18}; shallowest inside the rule: ${f(c.shallowestInsideKm)} km, cover ${f(c.shallowestCoverM, 0)} m (${f(c.shallowestCoverM / FT, 0)} ft), prom ${f(c.shallowestProm, 0)} m on ${f(c.shallowestThick, 0)} m of salt`)
  console.log(`  highs beyond 250 km: ${c.beyond250.map((q) => `${q.km} km prom ${q.prom}/${q.thick} m cover ${q.cover} m`).join('; ') || 'none'}`)
  console.log(`  wavelength 20-120 km: own ${f(r.wavelength.ownKm, 2)} km, app ${f(r.wavelength.appKm, 2)} km`)
  console.log(`  wedge: shelf edge 56 Ma ${f(r.wedge.edge56)} km, 40 Ma ${f(r.wedge.edge40)}, 20 Ma ${f(r.wedge.edge20)}, 10 Ma ${f(r.wedge.edge10)}, end ${f(r.wedge.edgeEnd)} km; shoreline end own ${f(r.wedge.ownShoreKm)} km (app ${f(r.wedge.appShoreKm)})`)
  console.log(`  crest log: ${g.n} episodes (merged ${g.merged}): buried ${g.buried}, welded ${g.welded}, run end ${g.runEnd}; labels (own) tabular ${g.tabular}, tapered ${g.tapered}, unresolved ${g.unresolved}; own vs app rate max diff ${g.maxOwnVsAppRate.toExponential(1)} m/Myr, label mismatches ${g.labelMismatch}`)
  console.log(`    median F ${f(g.medF)} A ${f(g.medA)} F-A ${f(g.medFminusA)} m/Myr (${f(g.medFminusA / FT, 0)} ft/Myr); neighbour salt ${f(g.medNeighbourM, 0)} m; L/h ${f(g.medLoverH)}; first ${f(g.firstMaRange[1])}-${f(g.firstMaRange[0])} Ma, last ${f(g.lastMaRange[1])}-${f(g.lastMaRange[0])} Ma; km ${f(g.kmRange[0])}-${f(g.kmRange[1])}; least cover ever ${f(g.minCoverEver, 0)} m; at the seafloor ${g.atSeafloor}`)
  if (salt === null) {
    console.log('  per crest (plain):')
    for (const e of g.episodes) console.log(`    #${e.id} km ${f(e.km)} ${f(e.firstMa, 2)}-${f(e.lastMa, 2)} Ma ${e.end}; F ${f(e.F)} A ${f(e.A)} F-A ${f(e.FminusA)} m/Myr (app ${f(e.appF)}/${f(e.appA)}) ${e.label}${e.label !== e.appLabel ? ` (app ${e.appLabel})` : ''}; salt beside ${f(e.neighbourM, 0)} m, L/h ${f(e.lOverH)}, min cover ${f(e.minCoverM, 0)} m`)
    console.log('  salt thickness and cover every 10 km (m):')
    console.log('    ' + r.salt.every10km.map((q) => `${q.km}:${q.h}/${q.cover}`).join(' '))
  }
}

const m = (g) => median(rows.map(g))
const all = rows.flatMap((r) => r.crestLog.episodes)
console.log(`\n==== MEDIANS over ${rows.length} runs (plain + ${SALTS.join(',')}) ====`)
console.log(`  weld total ${f(m((r) => r.welds.totalKm))} km [${rows.map((r) => r.welds.totalKm).join(',')}], longest ${f(m((r) => r.welds.longestKm))} km [${rows.map((r) => r.welds.longestKm).join(',')}], runs >= 2 km ${f(m((r) => r.welds.runs2km))} [${rows.map((r) => r.welds.runs2km).join(',')}]`)
console.log(`  D18 crests ${f(m((r) => r.crests.d18))} [${rows.map((r) => r.crests.d18).join(',')}], shallow anywhere [${rows.map((r) => r.crests.shallowAny).join(',')}]; shallowest cover inside the rule ${f(m((r) => r.crests.shallowestCoverM), 0)} m [${rows.map((r) => f(r.crests.shallowestCoverM, 0)).join(',')}]`)
console.log(`  salt front ${f(m((r) => r.salt.frontKm))} km [${rows.map((r) => r.salt.frontKm).join(',')}], max beyond 250 km ${f(m((r) => r.salt.maxBeyond250), 0)} m [${rows.map((r) => f(r.salt.maxBeyond250, 0)).join(',')}] = ${f(m((r) => r.salt.pileRatio), 2)} x start; last 20 km max ${f(m((r) => r.salt.maxLast20), 0)} m`)
console.log(`  wavelength own ${f(m((r) => r.wavelength.ownKm), 2)} km [${rows.map((r) => f(r.wavelength.ownKm)).join(',')}], app [${rows.map((r) => f(r.wavelength.appKm)).join(',')}]`)
console.log(`  shelf edge end ${f(m((r) => r.wedge.edgeEnd))} km [${rows.map((r) => r.wedge.edgeEnd).join(',')}]; 56 Ma [${rows.map((r) => r.wedge.edge56).join(',')}]`)
console.log(`  clamps ${f(m((r) => r.diag.clamps), 0)} [${rows.map((r) => r.diag.clamps).join(',')}], cells at cap at the end [${rows.map((r) => r.pressure.cellsAtCap).join(',')}], max u/L [${rows.map((r) => f(r.pressure.maxUOverL, 4)).join(',')}]`)
console.log(`  balance: salt |rel| max ${Math.max(...rows.map((r) => Math.abs(r.balance.salt.rel))).toExponential(2)}, sand ${Math.max(...rows.map((r) => Math.abs(r.balance.sand.rel))).toExponential(2)}, mud ${Math.max(...rows.map((r) => Math.abs(r.balance.mud.rel))).toExponential(2)}; saltClip [${rows.map((r) => r.diag.saltClip).join(',')}], saltLimited [${rows.map((r) => r.diag.saltLimited).join(',')}]`)
console.log(`  crest log: episodes [${rows.map((r) => r.crestLog.n).join(',')}], all buried: ${rows.every((r) => r.crestLog.buried === r.crestLog.n)}; per-run median F-A [${rows.map((r) => f(r.crestLog.medFminusA)).join(',')}] m/Myr`)
console.log(`  ALL ${all.length} crests: median F ${f(median(all.map((e) => e.F)))} A ${f(median(all.map((e) => e.A)))} F-A ${f(median(all.map((e) => e.FminusA)))} m/Myr = ${f(median(all.map((e) => e.FminusA)) / FT, 0)} ft/Myr; A ${f(median(all.map((e) => e.A)) / FT, 0)} ft/Myr; labels tabular ${all.filter((e) => e.label === 'tabular').length}, tapered ${all.filter((e) => e.label === 'tapered').length}, unresolved ${all.filter((e) => e.label === 'unresolved').length}; neighbour salt median ${f(median(all.map((e) => e.neighbourM)), 0)} m; L/h median ${f(median(all.map((e) => e.lOverH)))}; own vs app rate max diff ${Math.max(...rows.map((r) => r.crestLog.maxOwnVsAppRate)).toExponential(1)}, label mismatches ${rows.reduce((a, r) => a + r.crestLog.labelMismatch, 0)}`)
if (outFile) writeFileSync(outFile, JSON.stringify(rows.map((r) => ({ ...r, crestLog: { ...r.crestLog, episodes: r.crestLog.episodes } })), null, 1))
await server.close()
