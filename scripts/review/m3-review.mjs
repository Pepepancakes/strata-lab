// M3.7 integrity review: independent checks. Usage: node scripts/review/m3-review.mjs <part> [outfile]
//   part a  channel-flow decay, cover-bending dispersion, grid convergence (sandbox and full engine)
//   part b  conservation (Gulf preset, salt + failure), clipping, sand/mud balance
//   part c  determinism, rewind, snapshot/restore of weld age and salt state
//   part d  salt off = main (stateHash), speed
// Expected values are computed HERE from the textbook formulas (own constants, own sums). The engine is
// only run to produce the numbers that are compared; nothing from src/engine/salt.ts is used to compute
// an expected value.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = process.env.REVIEW_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const part = process.argv[2] || 'a'
const outFile = process.argv[3]
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const EP = await load('/src/engine/engineParams.ts')
const Rec = await load('/src/engine/record.ts')
const St = await load('/src/engine/state.ts')
const Salt = await load('/src/engine/salt.ts').catch(() => null)
const Step = await load('/src/engine/step.ts')
const Pre = await load('/src/engine/presets.ts')
const Sea = await load('/src/engine/sealevel.ts')
const Det = await load('/src/engine/determinism.ts')
const Sch = await load('/src/engine/schedule.ts')
const results = {}
let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`)
  if (!ok) fails++
  results[name] = { ok, detail }
}

// Own constants (written from the literature, not imported): g, halite density (Hudec & Jackson 2007),
// quartz grain density, sea water.
const g = 9.81, RS = 2160, RC = 2650, RW = 1025, YR = 3.15576e7

// A small deterministic generator of my own (not the engine's rng), so my noise is not theirs.
function lcg(seed) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

// ---- sandbox builders -----------------------------------------------------------------------------
// Bare salt sheet: ONE layer (salt), no sediment: W = 0, Sb = 0.
function bareSalt(nx, dx, h) {
  const rec = Rec.createRecord({ nx, dx, capacity: 3, startAgeMa: 0 })
  for (let j = 0; j < nx; j++) { rec.mud[j] = h(j); rec.material[j] = Rec.SALT; rec.b[j] = -3000 - 1500; rec.H[j] = rec.b[j] + h(j) }
  Rec.markInitialLedger(rec)
  return St.allocateEngine(rec)
}
// Salt under a pore-free cover whose seafloor is held at `top` (differential loading set-up).
function saltUnderCover(nx, dx, h, hc0) {
  const rec = Rec.createRecord({ nx, dx, capacity: 4, startAgeMa: 0, preLayers: 2 })
  const top = -2000
  for (let j = 0; j < nx; j++) {
    rec.mud[j] = h(j); rec.material[j] = Rec.SALT
    rec.mud[nx + j] = hc0
    rec.b[j] = top - hc0 - 1500
    rec.H[j] = top
  }
  Rec.markInitialLedger(rec)
  const eng = St.allocateEngine(rec)
  eng.phm.fill(0); eng.phs.fill(0)
  return { eng, rec, top }
}
const baseP = (over) => ({ ...EP.defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, ...over })

function projectCos(arr, base, nx, m, mean) {
  let num = 0, den = 0
  for (let j = 0; j < nx; j++) { const c = Math.cos((Math.PI * m * (j + 0.5)) / nx); num += (arr[base + j] - mean) * c; den += c * c }
  return num / den
}

if (part === 'a') {
  // ---- 1. channel flow --------------------------------------------------------------------------------
  // (a) re-derive Poiseuille: u(z) = (G/2eta) z (z-h) for dp/dx = G; q = integral u dz = -G h^3/(12 eta)
  {
    const h = 1234, eta = 7e17, G = 1e-3, N = 200000
    let q = 0
    for (let i = 0; i < N; i++) { const z = ((i + 0.5) / N) * h; q += (G / (2 * eta)) * z * (z - h) * (h / N) }
    const rel = Math.abs(q / (-(G * h ** 3) / (12 * eta)) - 1)
    check('1a Poiseuille integral = -G h^3/(12 eta)', rel < 1e-9, `rel ${rel.toExponential(2)}`)
  }
  // (b) decay of a thickness bump on a bare sheet, deep water (a = (rho_s - rho_w) g) and dry (a = rho_s g)
  const rows1 = []
  for (const [label, SL, aCoef] of [['deep water', 0, (RS - RW) * g], ['dry', -1e6, RS * g]]) {
    for (const [h0, eta, lamKm] of [[800, 3e17, 40], [3000, 3e18, 100], [1500, 5e17, 50]]) {
      const nx = 100, dx = 1000
      const mode = (2 * nx * dx) / 1000 / lamKm
      const k = (Math.PI * mode) / (nx * dx)
      const P = baseP({ nx, dx, saltVisc: eta, nSaltSub: 20, coverBend: 0 })
      const eng = bareSalt(nx, dx, (j) => h0 + 0.1 * Math.cos((Math.PI * mode * (j + 0.5)) / nx))
      const r = (aCoef * h0 ** 3 * k * k) / (12 * eta)
      const dt = 1 / r / YR / 200
      for (let s = 0; s < 200; s++) Salt.saltStep(eng, P, SL, dt)
      const amp = projectCos(eng.rec.mud, 0, nx, mode, h0)
      const rN = -Math.log(amp / 0.1) / (200 * dt * YR)
      const err = rN / r - 1
      rows1.push({ label, h0, eta, lamKm, hOverLam: h0 / (lamKm * 1000), errPct: +(err * 100).toFixed(3) })
      check(`1b decay ${label} h ${h0} eta ${eta.toExponential(0)} lam ${lamKm} km within 1 %`, Math.abs(err) < 0.01 && eng.diag.saltClip === 0, `err ${(err * 100).toFixed(3)} %`)
    }
  }
  results.channelRows = rows1

  // ---- 2. cover bending dispersion --------------------------------------------------------------------
  // Own derivation (see review doc): sigma(k) = drho g h^3 k^2 / (12 eta_s + (eta_c hc^3 / 3) h^3 k^6)
  const sigmaOf = (k, h, hc, es, ec) => ((RC - RS) * g * h ** 3 * k * k) / (12 * es + ((ec * hc ** 3) / 3) * h ** 3 * k ** 6)
  const lamStar = (h, hc, es, ec) => 2 * Math.PI * ((ec * hc ** 3 * h ** 3) / (18 * es)) ** (1 / 6)
  const disp = []
  for (const [es, ec, dx] of [[3e17, 2e19, 500], [3e17, 2e19, 250], [1e18, 3e20, 500]]) {
    const L = 100000, nx = Math.round(L / dx), h = 1500, hc = 1000
    const ls = lamStar(h, hc, es, ec)
    const P = baseP({ nx, dx, saltVisc: es, coverVisc: ec, coverBend: 1, nSaltSub: 1 })
    const modes = []
    for (let m = 4; m <= 64; m += 2) modes.push(m)
    const meas = []
    for (const m of modes) {
      const k = (Math.PI * m) / L
      const sg = sigmaOf(k, h, hc, es, ec)
      const { eng, rec, top } = saltUnderCover(nx, dx, (j) => h + 0.5 * Math.cos((Math.PI * m * (j + 0.5)) / nx), hc)
      const dt = 1 / sg / YR / 300
      for (let s = 0; s < 300; s++) {
        for (let j = 0; j < nx; j++) rec.mud[nx + j] = top - (rec.b[j] + rec.mud[j]) // seafloor kept level
        Salt.saltStep(eng, P, -1e6, dt)
      }
      const amp = projectCos(rec.mud, 0, nx, m, h)
      const sN = Math.log(amp / 0.5) / (300 * dt * YR)
      meas.push({ m, lamKm: (2 * L) / m / 1000, sigma: sN, formula: sg, errPct: (sN / sg - 1) * 100 })
    }
    // peak by parabola through the three highest points in (ln lambda)
    let ip = 0
    for (let i = 0; i < meas.length; i++) if (meas[i].sigma > meas[ip].sigma) ip = i
    const a = Math.max(1, Math.min(meas.length - 2, ip))
    const x = [-1, 0, 1].map((d) => Math.log(meas[a + d].lamKm)), y = [-1, 0, 1].map((d) => meas[a + d].sigma)
    // vertex of the parabola through 3 points
    const d1 = (y[1] - y[0]) / (x[1] - x[0]), d2 = (y[2] - y[1]) / (x[2] - x[1])
    const c2 = (d2 - d1) / (x[2] - x[0])
    // vertex of y = y0 + d1 (x-x0) + c2 (x-x0)(x-x1)
    const xs = (x[0] + x[1]) / 2 - d1 / (2 * c2)
    const lamMeas = Math.exp(xs)
    const nearPeak = meas.filter((q) => q.lamKm > (ls / 1000) * 0.6 && q.lamKm < (ls / 1000) * 1.8)
    const worst = Math.max(...nearPeak.map((q) => Math.abs(q.errPct)))
    const peakErr = (lamMeas / (ls / 1000) - 1) * 100
    disp.push({ es, ec, dx, lamStarKm: ls / 1000, lamMeasKm: lamMeas, peakErrPct: peakErr, worstNearPeakErrPct: worst, sigmaPeak: meas[ip].sigma, sigmaFormulaAtStar: sigmaOf((2 * Math.PI) / ls, h, hc, es, ec), meas })
    check(`2 lambda* eta_s ${es.toExponential(0)} eta_c ${ec.toExponential(0)} dx ${dx}: measured ${lamMeas.toFixed(2)} vs ${(ls / 1000).toFixed(2)} km`, Math.abs(peakErr) < 5, `peak err ${peakErr.toFixed(2)} %, worst growth-rate err within 0.6-1.8 lambda* ${worst.toFixed(2)} %`)
  }
  results.dispersion = disp.map((d) => ({ ...d, meas: undefined }))
  results.dispersionDetail = disp.map((d) => ({ es: d.es, ec: d.ec, dx: d.dx, meas: d.meas.map((q) => ({ lamKm: +q.lamKm.toFixed(2), sigma: q.sigma, formula: q.formula, errPct: +q.errPct.toFixed(2) })) }))

  // Sign of the physics: a cover that rides on a roof under water must be stable (drive -(rho_salt - rho_w) g)
  {
    const nx = 100, dx = 1000, h0 = 1500, m = 8
    const P = baseP({ nx, dx, saltVisc: 3e17, coverVisc: 2e19, coverBend: 1, nSaltSub: 1 })
    const eng = bareSalt(nx, dx, (j) => h0 + 0.5 * Math.cos((Math.PI * m * (j + 0.5)) / nx))
    for (let s = 0; s < 100; s++) Salt.saltStep(eng, P, 0, 200)
    const amp = projectCos(eng.rec.mud, 0, nx, m, h0)
    check('2 water-loaded roof without cover decays', amp < 0.5, `amp ${amp.toFixed(4)} m after 20 kyr`)
  }

  // ---- 3. grid convergence ------------------------------------------------------------------------------
  // (a) sandbox: white-noise roof (own noise, amplitude ~ 1/sqrt(dx)), level seafloor; width = argmax of the
  //     cosine power spectrum and the power-weighted mean wavelength. 5 seeds, eta_c 2e19.
  const grid = []
  for (const bend of [1, 0]) {
    for (const dx of [1000, 500, 250]) {
      const nx = Math.round(100000 / dx), wl = [], wm = []
      for (const seed of [11, 22, 33, 44, 55]) {
        const rnd = lcg(seed)
        const s0 = 0.5 * Math.sqrt(500 / dx)
        const P = baseP({ nx, dx, saltVisc: 3e17, coverVisc: 2e19, coverBend: bend, nSaltSub: 1 })
        const { eng, rec, top } = saltUnderCover(nx, dx, () => 1500 + s0 * (rnd() - 0.5) * Math.sqrt(12), 1000)
        let mean0 = 0
        for (let j = 0; j < nx; j++) mean0 += rec.mud[j]
        mean0 /= nx
        let rms = 0
        for (let s = 0; s < 60000 && rms < 20; s++) {
          for (let j = 0; j < nx; j++) rec.mud[nx + j] = top - (rec.b[j] + rec.mud[j])
          Salt.saltStep(eng, P, -1e6, 250)
          let v = 0
          for (let j = 0; j < nx; j++) v += (rec.mud[j] - mean0) ** 2
          rms = Math.sqrt(v / nx)
        }
        let sP = 0, sKP = 0, best = 0, bp = -1
        for (let q = 1; q < nx; q++) {
          let a = 0
          for (let j = 0; j < nx; j++) a += (rec.mud[j] - mean0) * Math.cos((Math.PI * q * (j + 0.5)) / nx)
          const p = ((2 * a) / nx) ** 2, k = (Math.PI * q) / (nx * dx)
          sP += p; sKP += k * p
          if (p > bp) { bp = p; best = q }
        }
        wl.push((2 * 100000) / best / 1000)
        wm.push((2 * Math.PI * sP) / sKP / 1000)
      }
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
      grid.push({ bend, dx, peakKm: mean(wl), peakRange: [Math.min(...wl), Math.max(...wl)], meanKm: mean(wm), cellsPerPeak: (mean(wl) * 1000) / dx })
    }
  }
  results.gridSandbox = grid
  for (const r of grid) console.log(`  sandbox bend ${r.bend} dx ${r.dx}: peak wavelength ${r.peakKm.toFixed(2)} km (range ${r.peakRange.map((v) => v.toFixed(1)).join('-')}), power-weighted ${r.meanKm.toFixed(2)} km, ${r.cellsPerPeak.toFixed(1)} cells`)
  {
    const on = grid.filter((r) => r.bend === 1).map((r) => r.meanKm)
    const spread = (Math.max(...on) - Math.min(...on)) / (on.reduce((a, b) => a + b) / 3)
    const lsKm = lamStar(1500, 1000, 3e17, 2e19) / 1000
    check('3 bending on: power-weighted width converges across 1000/500/250 m', spread < 0.1, `spread ${(spread * 100).toFixed(1)} %, lambda* ${lsKm.toFixed(2)} km`)
    const off = grid.filter((r) => r.bend === 0).map((r) => r.meanKm)
    check('3 bending off: width follows the grid (control)', off[0] / off[2] > 2, `${off.map((v) => v.toFixed(2)).join(' / ')} km`)
  }

  // (b) full engine, thin spot in the older cover (the M3.2 "needle" experiment), my own width measures
  const needle = []
  for (const bend of [1, 0]) for (const dx of [1000, 500, 250]) {
    const nx = Math.round(100000 / dx)
    const P = { ...EP.defaultEngineParams(), saltOn: 1, nx, dx, saltVisc: 1e17, coverBend: bend, coverVisc: 1e19 }
    const sch = Sch.buildSchedule()
    const eng = Step.createEngine(P, sch)
    const rec = eng.rec
    const Comp = await load('/src/engine/compaction.ts')
    for (let j = 0; j < nx; j++) {
      const x = (j + 0.5) * dx
      const f = 1 - 0.3 * Math.exp(-(((x - 70000) / 3000) ** 2))
      const i = nx + j
      rec.smax[i] = 30e6
      Comp.setPor(eng, P, i, 30e6)
      const scale = (1000 * f) / Comp.cellBulk(eng, P, i)
      rec.sand[i] *= scale; rec.mud[i] *= scale
      rec.b[j] = Step.initialSurface(x) - 1000 * f - rec.mud[j]
    }
    Rec.markInitialLedger(rec)
    Comp.rebuildCaches(eng, P)
    Comp.recomputeH(eng, P)
    const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
    while (Step.step(eng, P, sch, sl)) { /* run */ }
    const h = Float64Array.from(rec.mud.subarray(0, nx))
    // my measure: anomaly above the local median (+-30 km); second-moment width of the positive anomaly in the 40 km window; and FWHM
    const j0 = Math.round(50000 / dx), j1 = Math.round(90000 / dx)
    const win = Array.from(h.slice(Math.round(40000 / dx), Math.round(100000 / dx))).sort((a, b) => a - b)
    const med = win[Math.floor(win.length / 2)]
    let pk = j0
    for (let j = j0; j < j1; j++) if (h[j] > h[pk]) pk = j
    let m0 = 0, m1 = 0, m2 = 0
    for (let j = j0; j < j1; j++) { const a = Math.max(0, h[j] - med); m0 += a; m1 += a * (j + 0.5) * dx; m2 += a * ((j + 0.5) * dx) ** 2 }
    const sd = Math.sqrt(m2 / m0 - (m1 / m0) ** 2)
    const half = med + (h[pk] - med) / 2
    let l = pk, r = pk
    while (l > 0 && h[l] > half) l--
    while (r < nx - 1 && h[r] > half) r++
    needle.push({ bend, dx, peak: Math.round(h[pk]), median: Math.round(med), sdKm: sd / 1000, fwhmCells: r - l - 1, fwhmKm: ((r - l - 1) * dx) / 1000 })
  }
  results.needle = needle
  for (const r of needle) console.log(`  needle bend ${r.bend} dx ${r.dx}: peak ${r.peak} m over median ${r.median} m, second-moment sd ${r.sdKm.toFixed(2)} km, FWHM ${r.fwhmKm.toFixed(2)} km (${r.fwhmCells} cells)`)
}

// ---------------------------------------------------------------------------------------------------------
// own sums over the record arrays (no engine helper): solids of sediment cells and salt volume, m^2
function ownSums(rec) {
  const nx = rec.nx
  let sand = 0, mud = 0, salt = 0, minSalt = Infinity
  for (let l = 0; l < rec.nLayers; l++) for (let j = 0; j < nx; j++) {
    const i = l * nx + j
    if (rec.material[i] === Rec.SALT) { salt += rec.mud[i] + rec.sand[i]; if (rec.mud[i] < minSalt) minSalt = rec.mud[i] } else { sand += rec.sand[i]; mud += rec.mud[i] }
  }
  return { sand: sand * rec.dx, mud: mud * rec.dx, salt: salt * rec.dx, minSalt }
}
const rel = (a, b) => (b !== 0 ? a / b - 1 : a)

function runWith(id, over, every = 20) {
  const P = { ...Pre.presetParams(id), ...over }
  const sch = Pre.presetSchedule(id)
  const eng = Step.createEngine(P, sch)
  const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const s0 = ownSums(eng.rec)
  let worstSalt = 0, minSalt = Infinity, maxLedgerSalt = 0, n = 0
  const t0 = Date.now()
  while (Step.step(eng, P, sch, sl)) {
    n++
    if (n % every === 0) {
      const s = ownSums(eng.rec)
      worstSalt = Math.max(worstSalt, Math.abs(rel(s.salt, s0.salt)))
      minSalt = Math.min(minSalt, s.minSalt)
      maxLedgerSalt = Math.max(maxLedgerSalt, eng.rec.ledger.cumIn.salt)
    }
  }
  const ms = Date.now() - t0
  const s1 = ownSums(eng.rec)
  worstSalt = Math.max(worstSalt, Math.abs(rel(s1.salt, s0.salt)))
  const L = eng.rec.ledger
  const sandExp = L.init.sand + L.cumIn.sand - L.cumOut.sand, mudExp = L.init.mud + L.cumIn.mud - L.cumOut.mud
  return { P, sch, eng, ms, s0, s1, worstSalt, minSalt: Math.min(minSalt, s1.minSalt), maxLedgerSalt, sandErr: (s1.sand - sandExp) / L.cumIn.sand, mudErr: (s1.mud - mudExp) / L.cumIn.mud }
}

if (part === 'b') {
  // ---- 4. conservation through the Gulf preset, and failure over salt --------------------------------
  const gulf = runWith('gulf', {})
  const d = gulf.eng.diag
  console.log(`  gulf: ${gulf.ms} ms, salt start ${(gulf.s0.salt / 1e6).toFixed(4)} km2, end ${(gulf.s1.salt / 1e6).toFixed(4)} km2`)
  check('4 Gulf: salt volume conserved to 1e-12 at every 20th step', gulf.worstSalt < 1e-12, `worst ${gulf.worstSalt.toExponential(2)}`)
  check('4 Gulf: no clipping (saltClip 0, no negative thickness, nothing booked as inflow)', d.saltClip === 0 && gulf.minSalt >= 0 && gulf.maxLedgerSalt === 0, `clip ${d.saltClip}, min ${gulf.minSalt}, ledger in ${gulf.maxLedgerSalt}`)
  check('4 Gulf: sand and mud balance (own sums vs ledger) within 1e-9', Math.abs(gulf.sandErr) < 1e-9 && Math.abs(gulf.mudErr) < 1e-9, `sand ${gulf.sandErr.toExponential(2)}, mud ${gulf.mudErr.toExponential(2)}`)
  results.gulfLimiter = { limited: d.saltLimited, vol: d.saltLimitedVol, maxH: d.saltLimitMaxH }
  console.log(`  weld limiter acted ${d.saltLimited} times, withheld ${d.saltLimitedVol.toFixed(1)} m2, at most at ${d.saltLimitMaxH.toFixed(2)} m thickness`)

  // failures over salt: (1) MTD-prone preset + salt, (2) Gulf preset with failure on
  const variants = [
    ['mtd+salt', 'mtd', { saltOn: 1, saltVisc: 1e17, saltThick: 1500, saltPinchStart: 25000, saltPinchEnd: 45000 }],
    ['gulf+failure', 'gulf', { failOn: 1, kMudMult: 0.1 }],
  ]
  for (const [name, id, over] of variants) {
    const r = runWith(id, over, 10)
    const ev = r.eng.events
    let overSalt = 0
    const hsalt = Float64Array.from(r.eng.rec.mud.subarray(0, r.eng.rec.nx))
    for (const e of ev) for (let j = e.sourceFrom; j <= e.sourceTo; j++) if (hsalt[j] > 50) { overSalt++; break }
    console.log(`  ${name}: ${r.ms} ms, ${ev.length} events (${overSalt} with a source column over >50 m of salt at the end), unresolved ${r.eng.diag.failUnresolved}`)
    check(`4 ${name}: salt conserved (1e-12) and no clipping`, r.worstSalt < 1e-12 && r.eng.diag.saltClip === 0 && r.maxLedgerSalt === 0, `worst ${r.worstSalt.toExponential(2)}, clip ${r.eng.diag.saltClip}`)
    check(`4 ${name}: sand and mud balance through ${ev.length} failures within 1e-9`, Math.abs(r.sandErr) < 1e-9 && Math.abs(r.mudErr) < 1e-9, `sand ${r.sandErr.toExponential(2)}, mud ${r.mudErr.toExponential(2)}`)
    results[`${name}-events`] = { events: ev.length, overSalt }
  }
  // weld limiter in a sandbox where it must act: 30 m of salt under 3 km of cover next to 1.5 km of salt under 200 m
  for (const bend of [0, 1]) {
    const nx = 40, dx = 1000
    const { eng, rec } = saltUnderCover(nx, dx, (j) => (j < nx / 2 ? 30 : 1500), 200)
    for (let j = 0; j < nx / 2; j++) rec.mud[nx + j] = 3000
    const P = baseP({ nx, dx, saltVisc: 1e17, coverBend: bend, coverVisc: 1e19, nSaltSub: 1, weldThick: 10 })
    const v0 = ownSums(rec).salt
    let worst = 0, minH = Infinity
    for (let s = 0; s < 30; s++) {
      Salt.saltStep(eng, P, -1e6, 100000, 5 - s * 0.1)
      const q = ownSums(rec)
      worst = Math.max(worst, Math.abs(q.salt / v0 - 1)); minH = Math.min(minH, q.minSalt)
    }
    let welded = 0
    for (let j = 0; j < nx / 2; j++) if (eng.weldAge[j] !== -1) welded++
    check(`4 weld sandbox (bend ${bend}): limiter acted, salt conserved, never below 0, no clip, left columns welded`, eng.diag.saltLimited > 0 && worst < 1e-12 && minH >= 0 && eng.diag.saltClip === 0 && welded === nx / 2, `limited ${eng.diag.saltLimited}, vol err ${worst.toExponential(2)}, min ${minH}, clip ${eng.diag.saltClip}, welded cols ${welded}/${nx / 2}, left h ${rec.mud[0].toFixed(3)} m`)
  }
}
if (part === 'c') {
  const TM = await load('/src/worker/timeMachine.ts')
  const over = { saltVisc: 1e17, supply: 60 } // the M3.5 weld case: one column welds near 4.45 Ma
  const P = { ...Pre.presetParams('gulf'), ...over }
  const sch = Pre.presetSchedule('gulf')
  const straight = () => {
    const eng = Step.createEngine(P, sch)
    const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
    const at = new Map()
    let firstWeld = -1
    const saved = []
    while (Step.step(eng, P, sch, sl)) {
      const k = eng.diag.stepIndex
      if (firstWeld < 0 && eng.weldAge.some((v) => v !== -1)) firstWeld = k
      if (k % 97 === 0 || (firstWeld > 0 && Math.abs(k - firstWeld) <= 1)) {
        at.set(k, { hash: Det.stateHash(eng.rec), weld: eng.weldAge.slice(), salt: eng.rec.mud.slice(0, eng.rec.nx), clip: eng.diag.saltClip, lim: eng.diag.saltLimited })
        if (firstWeld > 0 && k >= firstWeld - 1 && k <= firstWeld + 1) saved.push(k)
      }
    }
    return { eng, at, firstWeld, final: Det.stateHash(eng.rec) }
  }
  const A = straight()
  const B = straight()
  const nWeld = A.eng.weldAge.filter((v) => v !== -1).length
  console.log(`  weld case: first weld at step ${A.firstWeld} of ${sch.nSteps}, welded columns at end ${nWeld}, final hash ${String(A.final).slice(0, 12)}`)
  check('6 weld case really welds (otherwise the weld-age check below is empty)', nWeld > 0 && A.firstWeld > 0, `${nWeld} columns`)
  check('6 second straight run: identical final hash and every sampled hash (exact)', A.final === B.final && [...A.at].every(([k, v]) => B.at.get(k).hash === v.hash), `${A.at.size} samples`)

  // time machine (keyframes + replay, what the app does for rewind)
  const tm = new TM.TimeMachine()
  const info = tm.run({ presetId: 'gulf', overrides: over }, 1)
  const root = tm.list()[0].id
  const steps = [...A.at.keys()]
  // visit in a scrambled but fixed order, jumping forward and back
  const order = steps.map((k, i) => [k, (i * 7919) % steps.length]).sort((a, b) => a[1] - b[1]).map((q) => q[0])
  let bad = 0, badWeld = 0, badSalt = 0, badClip = 0
  for (const k of order) {
    const h = tm.hashAt(root, k)
    const v = A.at.get(k)
    if (h !== v.hash) bad++
    const eng = tm.eng
    if (!eng.weldAge.every((w, i) => w === v.weld[i])) badWeld++
    if (!eng.rec.mud.subarray(0, eng.rec.nx).every((w, i) => w === v.salt[i])) badSalt++
    if (eng.diag.saltClip !== v.clip || eng.diag.saltLimited !== v.lim) badClip++
  }
  check(`6 rewind/seek in scrambled order (${order.length} stops): stateHash identical to the straight run`, bad === 0, `${bad} different`)
  check('6 weld age identical after every seek (incl. the steps around the first weld)', badWeld === 0, `${badWeld} different`)
  check('6 salt thickness and salt counters identical after every seek', badSalt === 0 && badClip === 0, `${badSalt} thickness, ${badClip} counters`)
  // branch: an edit that changes nothing must reproduce the main run; a salt edit must differ and still conserve salt
  const mid = Math.floor(sch.nSteps / 2) - (Math.floor(sch.nSteps / 2) % 20)
  const same = tm.branch(root, mid, { saltVisc: 1e17 }, 'same')
  const hs = tm.hashes()
  check('6 branch from the middle with a no-op edit: final hash equals the main run (exact)', hs[same.id] === A.final && hs[root] === A.final, `${String(hs[same.id]).slice(0, 12)} vs ${String(A.final).slice(0, 12)}`)
  const diff = tm.branch(root, mid, { saltVisc: 1e18 }, 'stiffer')
  const hs2 = tm.hashes()
  tm.hashAt(diff.id, sch.nSteps)
  const se = ownSums(tm.eng.rec)
  check('6 branch with saltVisc x10: different result, salt conserved to 1e-11 (see finding on stiff drift)', hs2[diff.id] !== A.final && Math.abs(se.salt / ownSums(A.eng.rec).salt - 1) < 1e-11 && tm.eng.diag.saltClip === 0, `salt err ${(se.salt / ownSums(A.eng.rec).salt - 1).toExponential(2)}`)
  void info
  // snapshot/restore at the engine level, including a restore into a fresh engine
  const eng = Step.createEngine(P, sch)
  const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  let snap = null
  const cut = A.firstWeld - 1
  while (Step.step(eng, P, sch, sl)) if (eng.diag.stepIndex === cut) { snap = Step.snapshotEngine(eng); break }
  const wBefore = eng.weldAge.slice()
  while (Step.step(eng, P, sch, sl)) { /* to the end */ }
  const e2 = Step.createEngine(P, sch)
  Step.restoreEngine(snap, e2, P, sch)
  const wRest = e2.weldAge.slice()
  check('6 snapshot taken the step before the first weld restores weld age (still none)', wBefore.every((v) => v === -1) && wRest.every((v) => v === -1))
  while (Step.step(e2, P, sch, sl)) { /* to the end */ }
  check('6 restore into a fresh engine and run on: final hash and weld age identical to the straight run', Det.stateHash(e2.rec) === A.final && e2.weldAge.every((v, i) => v === A.eng.weldAge[i]), `${String(Det.stateHash(e2.rec)).slice(0, 12)}`)
}

if (part === 'd') {
  // salt-off parity and speed: run in each tree (REVIEW_ROOT), then compare the printed JSON
  const ids = (process.env.PRESETS || 'last3,mtd,miocene,cenozoic').split(',')
  const reps = Number(process.env.REPS || 1)
  const out = {}
  for (const id of ids) {
    const P = Pre.presetParams(id), sch = Pre.presetSchedule(id)
    const times = []
    let hash = ''
    for (let r = 0; r < reps; r++) {
      const eng = Step.createEngine(P, sch)
      const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
      const t0 = performance.now()
      while (Step.step(eng, P, sch, sl)) { /* run */ }
      times.push(Math.round(performance.now() - t0))
      hash = String(Det.stateHash(eng.rec))
    }
    out[id] = { hash, times }
  }
  console.log('JSON ' + JSON.stringify(out))
}

// own prominence (topographic): rise of a maximum above the higher of the two saddles to taller ground
function featuresOf(h, dx, minProm) {
  const n = h.length
  const prom = (j, s) => {
    const a = s * h[j]
    let l = a, r = a
    for (let q = j - 1; q >= 0 && s * h[q] <= a; q--) l = Math.min(l, s * h[q])
    for (let q = j + 1; q < n && s * h[q] <= a; q++) r = Math.min(r, s * h[q])
    return a - Math.max(l, r)
  }
  const out = { highs: [], basins: [] }
  for (let j = 1; j < n - 1; j++) {
    if (h[j] >= h[j - 1] && h[j] > h[j + 1]) { const p = prom(j, 1); if (p >= minProm) out.highs.push({ x: (j + 0.5) * dx / 1000, p }) }
    if (h[j] <= h[j - 1] && h[j] < h[j + 1]) {
      // a basin needs a rim on BOTH sides (own rule): the highest ground on each side must exceed it by minProm
      let lm = -Infinity, rm = -Infinity
      for (let q = j - 1; q >= 0; q--) lm = Math.max(lm, h[q])
      for (let q = j + 1; q < n; q++) rm = Math.max(rm, h[q])
      const p = Math.min(lm, rm) - h[j]
      // saddle-based version: walk until deeper ground
      const pp = prom(j, -1)
      if (pp >= minProm && p >= minProm) out.basins.push({ x: (j + 0.5) * dx / 1000, p: pp })
    }
  }
  return out
}
const summarise = (a) => (a.length ? `${a.length} (spacing ${a.slice(1).map((v, i) => (v.x - a[i].x).toFixed(0)).join(',')})` : '0')

if (part === 'e') {
  // ---- 7. spread of the Gulf-style counts under 1 ulp noise (own count definition, minProm 300 m) -------
  const Ulp = await load('/tests/helpers/ulpNoise.ts')
  const rows = []
  const runOne = (label, fn) => {
    const P = Pre.presetParams('gulf'), sch = Pre.presetSchedule('gulf')
    const eng = fn(() => {
      const e = Step.createEngine(P, sch)
      const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
      while (Step.step(e, P, sch, sl)) { /* run */ }
      return e
    })
    const rec = eng.rec, nx = rec.nx
    const h = Float64Array.from(rec.mud.subarray(0, nx))
    const f = featuresOf(h, rec.dx, 300)
    let mx = 0, mxj = 0
    for (let j = 0; j < nx; j++) if (h[j] > mx) { mx = h[j]; mxj = j }
    const cover = Float64Array.from(eng.salt.Sb)
    let minCover = Infinity
    for (const q of f.highs) minCover = Math.min(minCover, cover[Math.round(q.x * 1000 / rec.dx - 0.5)])
    const welds = eng.weldAge.filter((v) => v !== -1).length
    const r = { label, minibasins: f.basins.length, highs: f.highs.length, thickest: Math.round(mx), at: (mxj + 0.5), minCoverOverHighKm: +(minCover / 1000).toFixed(2), welds, mudSum: 0 }
    rows.push(r)
    console.log(`  ${label}: minibasins ${summarise(f.basins)}; salt highs ${summarise(f.highs)}; thickest ${r.thickest} m at km ${r.at}; min cover over a high ${r.minCoverOverHighKm} km; welds ${welds}`)
    return r
  }
  runOne('plain', (g) => g())
  for (const salt of [1, 2, 3, 4, 5, 6]) runOne(`ulp noise salt ${salt}`, (g) => Ulp.withUlpNoise(2.2e-16, salt, g))
  const cnt = (k) => rows.map((r) => r[k])
  const rng = (a) => `${Math.min(...a)}-${Math.max(...a)}`
  console.log(`  minibasins ${rng(cnt('minibasins'))}, highs ${rng(cnt('highs'))}, thickest ${rng(cnt('thickest'))} m, welds ${rng(cnt('welds'))}`)
  results.ulpSpread = rows
  check('7 Gulf counts under 1 ulp noise: nothing near zero (min minibasins and highs >= 5)', Math.min(...cnt('minibasins')) >= 5 && Math.min(...cnt('highs')) >= 5, `minibasins ${rng(cnt('minibasins'))}, highs ${rng(cnt('highs'))}`)
  check('7 Gulf welds are 0 in all runs: a weld count must not be tested as a number', true, `welds ${rng(cnt('welds'))} (zero => no test may rest on it)`)
}

if (part === 'f') {
  // ---- 3/10. preset-level grid check, thickness table, expulsion --------------------------------------
  const grids = process.env.GRIDS ? JSON.parse(process.env.GRIDS) : [[2000, 200, {}], [1000, 400, {}], [500, 400, { note: 'half domain' }]]
  for (const [dx, nx] of grids) {
    const P = { ...Pre.presetParams('gulf'), dx, nx }
    const sch = Pre.presetSchedule('gulf')
    const eng = Step.createEngine(P, sch)
    const sl = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
    const t0 = Date.now()
    while (Step.step(eng, P, sch, sl)) { /* run */ }
    const rec = eng.rec
    const h = Float64Array.from(rec.mud.subarray(0, nx))
    const f = featuresOf(h, dx, 300)
    let mx = 0, mxj = 0
    for (let j = 0; j < nx; j++) if (h[j] > mx) { mx = h[j]; mxj = j }
    const o = ownSums(rec)
    console.log(`  dx ${dx} nx ${nx} (${(dx * nx / 1000)} km): ${Date.now() - t0} ms; minibasins ${summarise(f.basins)}; highs ${summarise(f.highs)}; thickest ${Math.round(mx)} m at km ${((mxj + 0.5) * dx / 1000).toFixed(0)}; salt err ${(o.salt / (Pre.presetParams('gulf').saltThick ? ownSums(Step.createEngine(P, sch).rec).salt : 1) - 1).toExponential(2)}; clip ${eng.diag.saltClip}`)
  }
}

console.log(`\n${fails} FAILED`)
if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 1))
await server.close()
process.exit(fails ? 1 : 0)
