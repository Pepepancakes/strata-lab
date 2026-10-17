// M4.6 integrity review: hand calculation of the planned well against the app's CSV export, and the preset hashes.
// Own code. Nothing from src/engine/well.ts, wellPressure.ts, wellPressureParams.ts or src/views/wellplan is imported or read
// for an expected value; the engine is only RUN (presets, step, sea level, record) to produce the layer record that both
// this script and the app sample. The app's numbers come from CSV files that the built app downloaded
// (scripts/review/m4-review-browser.mjs); the well definition is parsed back from the CSV's own "# well:" header line.
//
// Usage: node scripts/review/m4-review.mjs <csvDir> [outJson]        (csvDir holds <preset>-<well>-<method>.csv files from
//            scripts/review/m4-review-app-csv.mjs, the app's code run in Node on the same record; exact tolerances)
//        BROWSER_CSV=1 node scripts/review/m4-review.mjs <csvDir>    (CSVs the built app downloaded in Chrome, from
//            m4-review-browser.mjs: record-independent identities exactly, the record-dependent numbers only loosely, D14)
//        REVIEW_ROOT=<other checkout> node scripts/review/m4-review.mjs hashes     (hashes only, e.g. against main)
//
// Expected values, written from first principles:
//   geometry      minimum curvature between survey stations 10 ft apart with the inclination rising linearly at the build rate:
//                 dTVD = dMD/2 (cos I1 + cos I2) RF, dX = dMD/2 (sin I1 + sin I2) RF, RF = (2 / DL) tan(DL / 2), DL the dog-leg (rad).
//                 (Not the app's closed-form arc. In a plane the two agree to rounding when both are right.)
//   overburden    sea water above the sea floor plus the bulk weight of every cell above the station, cell by cell, from the record's
//                 solid thickness and the engine's porosity state (bulk = s / (1 - phi_s) + m / (1 - phi_m); salt bulk = solid, 2160 kg/m^3).
//   hydrostatic   rho_w g (datum - z); pore = hydrostatic + the record's excess pressure u; none in salt.
//   EMW (ppg)     P / (g D) with D the depth below the rig floor (datum + air gap), 1 ppg = 0.45359237 kg / 0.003785411784 m^3.
//   fracture      Pf = K (S - P) + P, K = nu / (1 - nu) (Eaton) or Ki (Matthews & Kelly); salt: Pf = S, no window.
//   window        FG - pore (ppg).
//   between columns: the documented rule (physics-references.md M4.1): overburden interpolated by distance; numbers interpolated only
//                 when both columns hold the same material at that elevation, otherwise the nearest column; material from the nearest.
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = process.env.REVIEW_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = process.argv[2] || 'hashes'
const outFile = process.argv[3]
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const Step = await load('/src/engine/step.ts')
const Pre = await load('/src/engine/presets.ts')
const Sea = await load('/src/engine/sealevel.ts')
const Det = await load('/src/engine/determinism.ts')
const Rec = await load('/src/engine/record.ts')

const results = { checks: [], files: {} }
let fails = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fails++; results.checks.push({ name, ok: !!ok, detail }) }

// ---- own constants -------------------------------------------------------------------------------------------------------
const g = 9.81 // the engine's g (constants.ts); EMW must use the same g as the pressures or sea water would not read rho_w
const RW = 1025, RS = 2650, RSALT = 2160
const FT = 0.3048, PSI = 6894.757293168
const PPG = 0.45359237 / 0.003785411784 // kg/m^3 per ppg = 119.8264
const ppg = (pa, depthM) => pa / (g * depthM) / PPG
const psi = (pa) => pa / PSI
const NU = 0.40, KI = 0.60
const SALT = Rec.SALT, MTD = Rec.MTD

// ---- units (check 2) ------------------------------------------------------------------------------------------------------
{
  const psiPerFtPerPpg = (PPG * g * FT) / PSI
  const psiPerFtPerPpgStd = (PPG * 9.80665 * FT) / PSI
  check('units: 1 ppg over 1 ft = 0.05197 psi at g 9.81 (0.05195 at standard g; field rule 0.052)', Math.abs(psiPerFtPerPpg - 0.051965) < 1e-5 && Math.abs(psiPerFtPerPpgStd - 0.051948) < 1e-5, `${psiPerFtPerPpg.toFixed(6)} / ${psiPerFtPerPpgStd.toFixed(6)} psi/ft per ppg`)
  check('units: sea water 1025 kg/m^3 = 8.554 ppg', Math.abs(RW / PPG - 8.5541) < 1e-3, `${(RW / PPG).toFixed(4)} ppg; from RKB at 3,000 ft of water with an 80 ft air gap: ${((RW / PPG) * 3000 / 3080).toFixed(3)} ppg`)
  results.units = { psiPerFtPerPpg, psiPerFtPerPpgStd, seaWaterPpg: RW / PPG }
}

// ---- run a preset to its end -------------------------------------------------------------------------------------------
const runs = new Map()
function runPreset(id) {
  if (runs.has(id)) return runs.get(id)
  const P = Pre.presetParams(id), sch = Pre.presetSchedule(id)
  const eng = Step.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const t0 = Date.now()
  while (Step.step(eng, P, sch, sea)) { /* run */ }
  const out = { eng, P, sch, sl: sea(sch.tEndYr[sch.nSteps - 1]), hash: String(Det.stateHash(eng.rec)), ms: Date.now() - t0 }
  runs.set(id, out)
  return out
}

if (arg === 'hashes') {
  const ids = (process.env.PRESETS || 'last3,mtd,miocene,cenozoic,saltshort,gulf').split(',')
  const out = {}
  for (const id of ids) { const r = runPreset(id); out[id] = r.hash; console.log(`${id} ${r.hash} (${r.ms} ms)`) }
  console.log('JSON ' + JSON.stringify(out))
  await server.close()
  process.exit(0)
}


// ---- my own well geometry (minimum curvature, survey stations every 10 ft of MD) ------------------------------------------
function parseWellLine(line) {
  // "# well: vertical well, surface 69.5 km, TD 20,000 ft TVDSS, air gap 80 ft"
  // "# well: build-and-hold well (kickoff 5,000 ft TVDSS, build 3 deg/100 ft, hold 30 deg, toward the basin), surface 69.5 km, TD 20,000 ft TVDSS, air gap 80 ft"
  const num = (re) => { const m = line.match(re); if (!m) throw new Error(`cannot read ${re} from ${line}`); return Number(m[1].replace(/,/g, '')) }
  const w = { xKm: num(/surface ([\d.,]+) km/), tdFt: num(/TD ([\d.,]+) ft TVDSS/), airGapFt: num(/air gap ([\d.,]+) ft/), groundFt: 0, kopFt: 0, bur: 0, hold: 0, dir: 1 }
  if (/build-and-hold/.test(line)) {
    w.kopFt = num(/kickoff ([\d.,]+) ft TVDSS/); w.bur = num(/build ([\d.,]+) deg\/100 ft/); w.hold = num(/hold ([\d.,]+) deg/)
    w.dir = /toward the land/.test(line) ? -1 : 1
  }
  return w
}
/** Survey by minimum curvature: inclination rises at BUR from the KOP (MD from RKB) to the hold angle, then stays. M4.7: on land the rig floor is groundFt + air gap above the sea, so the KOP (TVDSS) is that much deeper in MD. */
function surveyPath(w, step = 10) {
  const kopMd = w.kopFt + w.airGapFt + w.groundFt
  const inc = (md) => (w.hold <= 0 ? 0 : Math.min(w.hold, Math.max(0, (md - kopMd) * w.bur / 100))) * Math.PI / 180
  const rf = (dl) => (dl < 1e-12 ? 1 : (2 / dl) * Math.tan(dl / 2))
  const at = (mdTarget) => {
    let md = 0, tvd = 0, x = 0
    while (md < mdTarget - 1e-9) {
      const md2 = Math.min(mdTarget, md + step)
      const i1 = inc(md), i2 = inc(md2), dl = Math.abs(i2 - i1), r = rf(dl), d = md2 - md
      tvd += (d / 2) * (Math.cos(i1) + Math.cos(i2)) * r
      x += (d / 2) * (Math.sin(i1) + Math.sin(i2)) * r
      md = md2
    }
    return { tvdRkb: tvd, dispFt: x, incDeg: inc(mdTarget) * 180 / Math.PI }
  }
  return at
}

// ---- my own column model of the record ----------------------------------------------------------------------------------
function columnModel(run, j) {
  const { eng, P, sl } = run
  const rec = eng.rec, nx = rec.nx, n = rec.nLayers
  if (P.linear) throw new Error('linear compaction mode not handled by this script')
  const cells = []
  let z = rec.b[j]
  for (let l = 0; l < n; l++) {
    const i = l * nx + j
    const s = rec.sand[i], m = rec.mud[i], solid = s + m
    const isSalt = rec.material[i] === SALT
    const bulk = solid <= 0 ? 0 : isSalt ? solid : s / (1 - eng.phs[i]) + m / (1 - eng.phm[i])
    const bot = z
    z += bulk
    if (solid <= 0 || bulk <= 0) continue
    const phi = isSalt ? 0 : 1 - solid / bulk
    cells.push({ top: z, bot, kind: isSalt ? 'salt' : rec.material[i] === MTD ? 'MTD' : 'sediment', rho: isSalt ? RSALT : RS * (1 - phi) + RW * phi, phi, u: rec.u[i], thick: bulk })
  }
  const H = z
  // load at the top of each cell, from the top down
  let load = RW * g * Math.max(0, sl - H)
  for (let k = cells.length - 1; k >= 0; k--) { cells[k].loadTop = load; load += cells[k].rho * g * cells[k].thick }
  return { cells, H, Hrec: rec.H[j] }
}
function cellAt(col, e) {
  const c = col.cells
  if (c.length === 0) return 'below'
  if (e > c[c.length - 1].top) return 'above'
  if (e < c[0].bot) return 'below'
  for (let k = c.length - 1; k >= 0; k--) if (e >= c[k].bot) return c[k] // topmost cell whose bottom is at or below e
  return 'below'
}

/** Expected values at one station. Returns null where the app has no row (not reached). */
function handStation(run, cols, w, head, st, xM) {
  const { eng, sl } = run
  const rec = eng.rec, nx = rec.nx, dx = rec.dx
  if (xM < 0 || xM > nx * dx) return { stop: 'leftSection' }
  const e = sl - st.tvdssFt * FT
  const airM = w.airGapFt * FT
  const rkb = head.datum + airM
  const col = (j) => { if (!cols.has(j)) cols.set(j, columnModel(run, j)); return cols.get(j) }
  const xm = xM / dx - 0.5
  let j0, j1, t
  if (xm <= 0) { j0 = j1 = 0; t = 0 } else if (xm >= nx - 1) { j0 = j1 = nx - 1; t = 0 } else { j0 = Math.floor(xm); t = xm - j0; j1 = t === 0 ? j0 : j0 + 1 }
  if (e > rkb + 1e-9) return { material: 'air' }
  const c0 = cellAt(col(j0), e), c1 = j1 === j0 ? c0 : cellAt(col(j1), e)
  const in0 = typeof c0 === 'object', in1 = typeof c1 === 'object'
  const depthDatum = head.datum - e
  const D = depthDatum + airM
  if (!in0 && !in1) {
    if (c0 === 'below' || c1 === 'below') return { stop: 'baseOfRecord' }
    if (e > sl) return { material: 'air' }
    const p = RW * g * (sl - e)
    return { material: 'sea water', hydroPpg: ppg(p, sl - e + airM), porePpg: ppg(p, sl - e + airM), obPpg: ppg(p, sl - e + airM), porePsi: psi(p), fgPpg: NaN, windowPpg: NaN, phi: NaN }
  }
  const near0 = in0 && (!in1 || t <= 0.5)
  const nearC = near0 ? c0 : c1
  const both = in0 && in1
  const same = both && c0.kind === c1.kind
  const pick = (a, b) => (same ? a + t * (b - a) : near0 ? a : b)
  const prop = (f) => (!both ? f(in0 ? c0 : c1) : pick(f(c0), f(c1)))
  const sv = (c) => c.loadTop + c.rho * g * (c.top - e)
  const S = both ? sv(c0) + t * (sv(c1) - sv(c0)) : in0 ? sv(c0) : sv(c1)
  const hydro = RW * g * depthDatum
  const salt = nearC.kind === 'salt'
  let P = NaN
  if (!salt) {
    const sed0 = in0 && c0.kind !== 'salt', sed1 = in1 && c1.kind !== 'salt'
    const u = sed0 && sed1 ? (same ? c0.u + t * (c1.u - c0.u) : near0 ? c0.u : c1.u) : sed0 ? c0.u : c1.u
    P = hydro + u
  }
  const pLower = P
  const pfE = salt ? S : (NU / (1 - NU)) * (S - P) + P
  const pfMk = salt ? S : KI * (S - P) + P
  return {
    material: nearC.kind, phi: prop((c) => c.phi), hydroPpg: ppg(hydro, D), porePpg: salt ? NaN : ppg(P, D), porePsi: salt ? NaN : psi(P), obPpg: ppg(S, D),
    // M4.7: no window in salt (there is no pore pressure to start from)
    fgEatonPpg: ppg(pfE, D), fgMkPpg: ppg(pfMk, D), windowEatonPpg: salt || !(S > 0) ? NaN : ppg(pfE, D) - ppg(pLower, D), windowMkPpg: salt || !(S > 0) ? NaN : ppg(pfMk, D) - ppg(pLower, D),
    obPsi: psi(S), hydroPsi: psi(hydro), vesPsi: salt ? NaN : psi(S - P),
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l !== '')
  const header = lines.filter((l) => l.startsWith('#'))
  const body = lines.filter((l) => !l.startsWith('#'))
  const cols = body[0].split(',')
  const rows = body.slice(1).map((l) => { const c = l.split(','); const o = {}; cols.forEach((k, i) => { o[k] = c[i] }); return o })
  return { header, cols, rows }
}

// ---- compare one CSV ----------------------------------------------------------------------------------------------------
const TOL_EXACT = { ft: 0.011, km: 0.00011, ppg: 2e-5, psi: 0.003, phi: 1.1e-4 } // the CSV prints 2/4/6/3/4 decimals; psi also carries the 0.005 ft geometry rounding (0.45 psi/ft) at the partial last station
// browser CSVs: the record in Chrome differs from Node's by a few ulps (D14), which moves the ground a little; see the units check for scale
const TOL_BROWSER = { ft: 0.011, km: 0.00011, ppg: Number(process.env.BROWSER_TOL_PPG || 0.1), psi: Number(process.env.BROWSER_TOL_PSI || 1), phi: 0.002 }
const TOL = process.env.BROWSER_CSV ? TOL_BROWSER : TOL_EXACT
function reviewFile(path) {
  const name = basename(path, '.csv')
  const preset = name.split('-')[0]
  const method = /matthews/.test(name) ? 'mk' : 'eaton'
  const { header, rows } = parseCsv(readFileSync(path, 'utf8'))
  const wellLine = header.find((l) => l.startsWith('# well:'))
  const methodLine = header.find((l) => l.startsWith('# fracture_gradient_method:'))
  const w = parseWellLine(wellLine)
  const run = runPreset(preset)
  const { eng, sl } = run
  const rec = eng.rec, nx = rec.nx, dx = rec.dx
  const cols = new Map()
  // head: datum = the sea surface, or the ground where it is above the sea (interpolated H at the wellhead)
  const xm0 = (w.xKm * 1000) / dx - 0.5
  const hj0 = Math.max(0, Math.min(nx - 1, Math.floor(xm0))), hj1 = Math.min(nx - 1, hj0 + 1), ht = xm0 <= 0 ? 0 : xm0 >= nx - 1 ? 0 : xm0 - hj0
  const hHead = rec.H[hj0] + ht * (rec.H[hj1] - rec.H[hj0])
  const head = { datum: Math.max(sl, hHead), waterDepthFt: Math.max(0, sl - hHead) / FT, groundFt: Math.max(0, hHead - sl) / FT }
  w.groundFt = head.groundFt // M4.7: ONE rig floor, the air gap above the ground on land
  const path_ = surveyPath(w)
  const worst = { tvd: 0, tvdss: 0, x: 0, phi: 0, porePsi: 0, pore: 0, hydro: 0, ob: 0, fg: 0, win: 0 }
  let material = 0, n = 0, stopRow = null, lastMd = -1, mdStepOk = true, airGapOk = true
  const near = []
  const examples = []
  for (const r of rows) {
    const md = Number(r.md_ft)
    if (lastMd >= 0 && !(Math.abs(md - lastMd - 10) < 1e-6 || r === rows[rows.length - 1])) mdStepOk = false
    lastMd = md
    const gm = path_(md)
    const tvdss = gm.tvdRkb - w.airGapFt - w.groundFt
    const xKm = w.xKm + (w.dir * gm.dispFt * FT) / 1000
    const d = (a, b) => Math.abs(a - b)
    worst.tvd = Math.max(worst.tvd, d(gm.tvdRkb, Number(r.tvd_rkb_ft)))
    worst.tvdss = Math.max(worst.tvdss, d(tvdss, Number(r.tvdss_ft)))
    worst.x = Math.max(worst.x, d(xKm, Number(r.x_km)))
    if (d(Number(r.tvd_rkb_ft) - Number(r.tvdss_ft), w.airGapFt + w.groundFt) > 0.011) airGapOk = false
    const h = handStation(run, cols, w, head, { tvdssFt: tvdss }, xKm * 1000) // my own station position; the app's rows are matched by MD
    if (h.stop) { stopRow = { md, expected: h.stop }; break }
    if (h.material !== r.material) { material++; if (examples.length < 8) examples.push({ md, key: 'material', mine: h.material, theirs: r.material }) }
    const num = (s) => (s === '' || s === undefined ? NaN : Number(s))
    const cmp = (key, mine, theirs) => { mine = mine ?? NaN; if (Number.isNaN(mine) && Number.isNaN(theirs)) return; const bad = Number.isNaN(mine) !== Number.isNaN(theirs); const dd = bad ? Infinity : d(mine, theirs); if (dd > worst[key]) worst[key] = dd; if ((bad || dd > (key === 'phi' ? TOL.phi : key === 'porePsi' ? TOL.psi : TOL.ppg)) && examples.length < 8) examples.push({ md, key, mine, theirs, material: r.material, mineMaterial: h.material }) }
    cmp('phi', h.phi, num(r.porosity))
    cmp('porePsi', h.porePsi, num(r.pore_pressure_psi))
    cmp('pore', h.porePpg, num(r.pore_pressure_ppg))
    cmp('hydro', h.hydroPpg, num(r.hydrostatic_ppg))
    cmp('ob', h.obPpg, num(r.overburden_ppg))
    if (h.material !== 'sea water' && h.material !== 'air') {
      cmp('fg', method === 'mk' ? h.fgMkPpg : h.fgEatonPpg, num(r.fracture_gradient_ppg))
      cmp('win', method === 'mk' ? h.windowMkPpg : h.windowEatonPpg, num(r.window_ppg))
    } else if (r.fracture_gradient_ppg !== '' || r.window_ppg !== '') worst.fg = Infinity
    n++
    // plausibility rows: the first 15 rock stations below the sea floor, every salt boundary, and the base of salt
    near.push({ md, tvdss: Number(r.tvdss_ft), material: r.material, hydro: h.hydroPpg, pore: h.porePpg, ob: h.obPpg, fg: method === 'mk' ? h.fgMkPpg : h.fgEatonPpg, win: method === 'mk' ? h.windowMkPpg : h.windowEatonPpg, vesPsi: h.vesPsi, porePsi: h.porePsi, obPsi: h.obPsi, hydroPsi: h.hydroPsi })
  }
  const geomOk = worst.tvd <= TOL.ft && worst.tvdss <= TOL.ft && worst.x <= TOL.km
  const physOk = worst.phi <= TOL.phi && worst.porePsi <= TOL.psi && worst.pore <= TOL.ppg && worst.hydro <= TOL.ppg && worst.ob <= TOL.ppg && worst.fg <= TOL.ppg && worst.win <= TOL.ppg
  const mdTd = rows[rows.length - 1].md_ft
  const fmt = (v) => (v === Infinity ? 'INF' : v.toExponential(2))
  check(`${name}: ${rows.length} rows, MD step 10 ft to TD ${mdTd} ft, tvd_rkb - tvdss = air gap ${w.airGapFt} ft + ground ${w.groundFt.toFixed(1)} ft, method line "${(methodLine || '').slice(28, 60)}"`, mdStepOk && airGapOk && (method === 'mk') === /Matthews/.test(methodLine || ''), '')
  check(`${name}: geometry (min curvature, 10 ft surveys) vs CSV: worst |dTVD| ${worst.tvd.toFixed(4)} ft, |dTVDSS| ${worst.tvdss.toFixed(4)} ft, |dx| ${(worst.x * 1000).toFixed(3)} m (tol ${TOL.ft} ft, ${TOL.km * 1000} m)`, geomOk)
  check(`${name}: material agrees at every station (${material} differ of ${n})`, material === 0)
  check(`${name}: porosity ${fmt(worst.phi)}, pore psi ${fmt(worst.porePsi)}, pore ppg ${fmt(worst.pore)}, hydro ppg ${fmt(worst.hydro)}, overburden ppg ${fmt(worst.ob)}, FG(${method}) ppg ${fmt(worst.fg)}, window ppg ${fmt(worst.win)} (tol ${TOL.ppg} ppg, ${TOL.psi} psi, ${TOL.phi})`, physOk)
  const stopLine = header.find((l) => /rows:/.test(l))
  check(`${name}: well end: ${stopRow ? `my model stops (${stopRow.expected}) at MD ${stopRow.md}; the CSV's last row is MD ${mdTd}` : `my model reaches every CSV row (last MD ${mdTd})`}`, !stopRow || Number(mdTd) < stopRow.md + 1e-6, stopLine || '')
  const sea = near.filter((r) => r.material === 'sea water')
  const rock = near.filter((r) => r.material !== 'sea water' && r.material !== 'air')
  const saltRows = near.filter((r) => r.material === 'salt')
  const summary = {
    examples, well: w, waterDepthFt: head.waterDepthFt, seaLevelM: sl, rows: rows.length, worst, stop: stopRow,
    firstRock: rock.slice(0, 12).map((r) => ({ tvdss: +r.tvdss.toFixed(1), pore: +r.pore.toFixed(3), fg: +r.fg.toFixed(3), ob: +r.ob.toFixed(3), win: +r.win.toFixed(3) })),
    deepest: rock.slice(-1).map((r) => ({ tvdss: +r.tvdss.toFixed(1), material: r.material, pore: +r.pore.toFixed(3), fg: +r.fg.toFixed(3), ob: +r.ob.toFixed(3), win: +r.win.toFixed(3), vesPsi: +r.vesPsi.toFixed(0) }))[0],
    salt: saltRows.length ? { topTvdss: saltRows[0].tvdss, baseTvdss: saltRows[saltRows.length - 1].tvdss, n: saltRows.length, fgEqualsOb: saltRows.every((r) => Math.abs(r.fg - r.ob) < 1e-12) } : null,
    narrowest: rock.filter((r) => Number.isFinite(r.win)).length ? rock.filter((r) => Number.isFinite(r.win)).reduce((a, r) => (r.win < a.win ? r : a)) : null,
  }
  if (saltRows.length) {
    const base = saltRows[saltRows.length - 1]
    const kBase = near.indexOf(base)
    const below = near.slice(kBase + 1, kBase + 60).filter((r) => r.material !== 'salt')
    const above = near.slice(0, near.indexOf(saltRows[0])).filter((r) => r.material !== 'salt' && r.material !== 'sea water').slice(-5)
    summary.belowSalt = below.slice(0, 5).map((r) => ({ tvdss: +r.tvdss.toFixed(1), material: r.material, pore: +r.pore.toFixed(3), hydro: +r.hydro.toFixed(3), ob: +r.ob.toFixed(3), fg: +r.fg.toFixed(3), win: +r.win.toFixed(3), vesPsi: +r.vesPsi.toFixed(0), porePsi: +r.porePsi.toFixed(0) }))
    summary.aboveSalt = above.map((r) => ({ tvdss: +r.tvdss.toFixed(1), pore: +r.pore.toFixed(3), ob: +r.ob.toFixed(3), fg: +r.fg.toFixed(3), win: +r.win.toFixed(3), vesPsi: +r.vesPsi.toFixed(0) }))
    const saltWins = saltRows.map((r) => r.win).filter(Number.isFinite)
    summary.saltWindow = saltWins.length ? { min: Math.min(...saltWins), max: Math.max(...saltWins) } : 'none (no window in salt)'
  }
  if (sea.length) summary.seaWaterLastRow = { tvdss: sea[sea.length - 1].tvdss, ppg: +sea[sea.length - 1].hydro.toFixed(4) }
  results.files[name] = summary
  return summary
}

// ---- record-independent identities in any CSV (used for the browser CSVs, whose record differs from Node's: D14) --------------
function selfCheck(path) {
  const name = basename(path, '.csv')
  const method = /matthews/.test(name) ? 'mk' : 'eaton'
  const K = method === 'mk' ? KI : NU / (1 - NU)
  const { rows, header } = parseCsv(readFileSync(path, 'utf8'))
  const w = parseWellLine(header.find((l) => l.startsWith('# well:')))
  const psiPerFtPpg = (PPG * g * FT) / PSI
  let worstFg = 0, worstWin = 0, worstPsi = 0, worstHydro = 0, saltBad = 0, seaBad = 0, mono = true, lastTvd = -Infinity, n = 0
  let hydroConst = null
  for (const r of rows) {
    const D = Number(r.tvd_rkb_ft)
    if (D < lastTvd - 1e-9) mono = false
    lastTvd = D
    if (r.material === 'air') continue
    const pore = Number(r.pore_pressure_ppg), ob = Number(r.overburden_ppg), hy = Number(r.hydrostatic_ppg)
    // hydrostatic: hy * D / (rho_w/PPG) = D - c, c the same for every row (air gap + ground above sea), within 0.02 ft
    const c = D - (hy * D) / (RW / PPG)
    if (hydroConst === null) hydroConst = c
    else worstHydro = Math.max(worstHydro, Math.abs(c - hydroConst))
    if (r.material === 'sea water') { if (r.fracture_gradient_ppg !== '' || r.window_ppg !== '' || Math.abs(pore - hy) > 1e-6 || Math.abs(ob - hy) > 1e-6) seaBad++; continue }
    const fg = Number(r.fracture_gradient_ppg), win = Number(r.window_ppg)
    if (r.material === 'salt') { if (r.pore_pressure_ppg !== '' || Math.abs(fg - ob) > 1e-6 || r.window_ppg !== '') saltBad++; n++; continue }
    worstFg = Math.max(worstFg, Math.abs(fg - (K * (ob - pore) + pore)))
    worstWin = Math.max(worstWin, Math.abs(win - (fg - pore)))
    worstPsi = Math.max(worstPsi, Math.abs(Number(r.pore_pressure_psi) - pore * psiPerFtPpg * D))
    n++
  }
  check(`${name} (browser CSV, record-independent): FG = K(S - P) + P with K ${K.toFixed(4)} to ${worstFg.toExponential(1)} ppg; window = FG - pore to ${worstWin.toExponential(1)}; psi = ppg x 0.051966 x D to ${worstPsi.toExponential(1)} psi; hydrostatic datum constant to ${worstHydro.toExponential(1)} ft (rig floor ${hydroConst.toFixed(1)} ft above the pressure datum = air gap ${w.airGapFt}; M4.7); salt rows wrong ${saltBad}; sea rows wrong ${seaBad}; TVD monotonic ${mono}; ${n} rock rows`,
    worstFg < 3e-6 && worstWin < 3e-6 && worstPsi < 0.01 && worstHydro < 0.05 && Math.abs(hydroConst - w.airGapFt) < 0.05 && saltBad === 0 && seaBad === 0 && mono && n > 0)
}

const dir = arg
const files = readdirSync(dir).filter((f) => /^(last3|gulf|mtd|miocene|cenozoic|saltshort)-.*\.csv$/.test(f)).sort()
if (files.length === 0) throw new Error(`no CSV files in ${dir}`)
if (process.env.BROWSER_CSV) for (const f of files) selfCheck(join(dir, f))
for (const f of files) reviewFile(join(dir, f))
// the preset hashes of the two runs used
results.hashes = Object.fromEntries([...runs].map(([id, r]) => [id, r.hash]))
console.log('hashes of the runs sampled: ' + JSON.stringify(results.hashes))
for (const [name, s] of Object.entries(results.files)) {
  console.log(`\n== ${name}: water depth ${s.waterDepthFt.toFixed(0)} ft, ${s.rows} rows`)
  console.log('   first rock stations below the sea floor (tvdss, pore, FG, OB, window ppg): ' + s.firstRock.slice(0, 6).map((r) => `${r.tvdss}: ${r.pore} ${r.fg} ${r.ob} ${r.win}`).join(' | '))
  console.log(`   narrowest: ${s.narrowest ? `${s.narrowest.win.toFixed(3)} ppg at ${s.narrowest.tvdss.toFixed(0)} ft (${s.narrowest.material})` : 'none'}; deepest: ${JSON.stringify(s.deepest)}`)
  if (s.salt) { console.log(`   salt ${s.salt.topTvdss} to ${s.salt.baseTvdss} ft (${s.salt.n} rows), FG = OB ${s.salt.fgEqualsOb}, window in salt ${JSON.stringify(s.saltWindow)}`); console.log('   above salt: ' + JSON.stringify(s.aboveSalt)); console.log('   below salt: ' + JSON.stringify(s.belowSalt)) }
}
for (const [name, s] of Object.entries(results.files)) if (s.examples.length) console.log(`   ${name} first differences: ` + JSON.stringify(s.examples))
if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 2))
console.log(`\n${fails ? 'HAND CALC FAILED' : 'HAND CALC OK'}: ${results.checks.length} checks, ${fails} failed`)
await server.close()
process.exit(fails ? 1 : 0)
