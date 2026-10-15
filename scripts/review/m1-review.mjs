// M1.9 integrity review: independent checks of the M1 engine.
//
// Run:   node scripts/review/m1-review.mjs [section ...]
// Sections: gibson parity balance exp2ma determinism burial longruns geology (default: all)
//
// WHAT IS INDEPENDENT. Every "expected" value below is computed in this file, by this file's own
// code, from the equations or the raw record arrays: the Gibson reference is a finite-difference
// solution of the PDE written here (plus the published closed form, evaluated here), the mass
// balance is rebuilt from the raw record arrays and the supply history, the temperature and cement
// references are hand calculations, and the golden run is spikes/001-shelf-to-basin/engine.js
// executed here. The M1 engine under test is loaded only to be RUN (through Vite's SSR loader,
// because it is TypeScript); no helper from tests/ and no expected value from src/ is used.
// Results are written to docs/reviews/m1-review-results.json.

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const spike = createRequire(import.meta.url)(join(root, 'spikes/001-shelf-to-basin/engine.js'))
const want = new Set(process.argv.slice(2))
const run = (name) => want.size === 0 || want.has(name)

const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const E = {
  step: await load('/src/engine/step.ts'),
  params: await load('/src/engine/engineParams.ts'),
  record: await load('/src/engine/record.ts'),
  schedule: await load('/src/engine/schedule.ts'),
  sea: await load('/src/engine/sealevel.ts'),
  comp: await load('/src/engine/compaction.ts'),
  state: await load('/src/engine/state.ts'),
  cement: await load('/src/engine/cement.ts'),
  thermal: await load('/src/engine/thermal.ts'),
  presets: await load('/src/engine/presets.ts'),
  tm: await load('/src/worker/timeMachine.ts'),
}

const results = {}
const out = (section, key, value) => {
  ;(results[section] ??= {})[key] = value
  console.log(`[${section}] ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
}
const verdicts = []
const check = (section, name, ok, detail) => {
  verdicts.push({ section, name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${section}: ${name}  (${detail})`)
  ;(results[section] ??= {}).checks = [...((results[section] ?? {}).checks ?? []), { name, ok, detail }]
}

// ---------------------------------------------------------------------------------------------
// helpers (all local)
// ---------------------------------------------------------------------------------------------
const nsum = (arr) => { // Neumaier compensated sum, fixed order
  let s = 0, c = 0
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i], t = s + x
    c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s
    s = t
  }
  return s + c
}
const ms = () => Number(process.hrtime.bigint()) / 1e6

/** SHA-256 over the raw bytes of every used part of the record (own hash, not the app's FNV). */
function ownHash(rec) {
  const h = createHash('sha256')
  const cells = rec.nLayers * rec.nx
  const f = (a, n) => h.update(Buffer.from(a.buffer, a.byteOffset, n * a.BYTES_PER_ELEMENT))
  h.update(`${rec.nx},${rec.dx},${rec.nLayers};`)
  f(rec.b, rec.nx); f(rec.H, rec.nx)
  for (const k of ['sand', 'mud', 'smax', 'u', 'tDep', 'cem', 'cemS']) f(rec[k], cells)
  f(rec.material, cells)
  f(rec.stepDt, rec.nLayers); f(rec.stepAgeMa, rec.nLayers)
  return h.digest('hex').slice(0, 16)
}

/** M1 run with a sea-level kind; returns a driver. */
function m1Setup(segments, overrides = {}) {
  const P = { ...E.params.defaultEngineParams(), ...overrides }
  const sch = E.schedule.buildSchedule(segments)
  const eng = E.step.createEngine(P, sch)
  const sea = E.sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  return { P, sch, eng, sea }
}

// =============================================================================================
// 1. Gibson (1958)
// =============================================================================================
// Layer growing at constant bulk rate m on an impermeable base, drained at the top.
// u = gamma' m t U(X,T),  X = z/(m t),  T = m^2 t / cv.   Derivation (chain rule on
//   u_t = cv u_zz + gamma' m):   T dU/dT = U_XX / T + X U_X + 1 - U,   U_X(0) = 0, U(1) = 0.
// Reference A: this PDE solved by Crank-Nicolson in ln T on a 2000-interval grid (no closed form,
//   no engine code). Start at T0 = 1e-3 from the quasi-steady state U = T (1 - X^2) / 2.
// Reference B: the published closed form  U = 1 - 2/sqrt(pi T) Int e tanh(sqrt(T) e)
//   [exp(-(e-a)^2) + exp(-(e+a)^2)] de, a = X sqrt(T)/2, evaluated here with Gauss-Legendre.
function gibsonPDE(Ttarget, N = 2000, dTau = 0.004) {
  const dX = 1 / N
  let T = 1e-3
  const U = new Float64Array(N + 1)
  for (let i = 0; i <= N; i++) { const X = i * dX; U[i] = T * (1 - X * X) / 2 }
  // unknowns U[0..N-1], U[N] = 0
  const nSteps = Math.round(Math.log(Ttarget / T) / dTau)
  const dt = Math.log(Ttarget / T) / nSteps
  const lo = new Float64Array(N), di = new Float64Array(N), up = new Float64Array(N), rhs = new Float64Array(N)
  const cp = new Float64Array(N), dp = new Float64Array(N)
  const L = (Uv, i, Tn) => { // spatial operator at node i
    const X = i * dX
    const Um = i === 0 ? Uv[1] : Uv[i - 1] // symmetric image for U_X(0) = 0
    const Up = Uv[i + 1]
    return (Up - 2 * Uv[i] + Um) / (dX * dX) / Tn + X * (Up - Um) / (2 * dX) + 1 - Uv[i]
  }
  for (let s = 0; s < nSteps; s++) {
    const T0 = T, T1 = T * Math.exp(dt)
    for (let i = 0; i < N; i++) {
      const X = i * dX
      const Tm = Math.sqrt(T0 * T1) // time-centred coefficient
      const a = 1 / (Tm * dX * dX), c = X / (2 * dX)
      // implicit half: -dt/2 * L
      const lw = i === 0 ? 0 : (a - c), mid = -2 * a - 1, upw = (i === 0 ? 2 * a : a + c)
      lo[i] = -0.5 * dt * lw
      di[i] = 1 - 0.5 * dt * mid
      up[i] = -0.5 * dt * upw
      rhs[i] = U[i] + 0.5 * dt * L(U, i, Tm) + dt * 1 * 0 // explicit half
    }
    // the "+1" source: L already contains +1 explicitly; add the implicit half's source
    for (let i = 0; i < N; i++) rhs[i] += 0.5 * dt
    // Dirichlet U[N] = 0 contributes nothing
    cp[0] = up[0] / di[0]; dp[0] = rhs[0] / di[0]
    for (let i = 1; i < N; i++) { const m = di[i] - lo[i] * cp[i - 1]; cp[i] = up[i] / m; dp[i] = (rhs[i] - lo[i] * dp[i - 1]) / m }
    U[N - 1] = dp[N - 1]
    for (let i = N - 2; i >= 0; i--) U[i] = dp[i] - cp[i] * U[i + 1]
    U[N] = 0
    T = T1
  }
  return (X) => { const x = X / dX, i = Math.min(N - 1, Math.floor(x)), f = x - i; return U[i] * (1 - f) + U[i + 1] * f }
}
// Gauss-Legendre nodes (n = 64) by Newton iteration
function gaussLegendre(n) {
  const x = [], w = []
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp
    for (let it = 0; it < 100; it++) {
      let p1 = 1, p2 = 0
      for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1) }
      pp = n * (z * p1 - p2) / (z * z - 1)
      const z1 = z; z = z1 - p1 / pp
      if (Math.abs(z - z1) < 1e-15) break
    }
    x.push(z); w.push(2 / ((1 - z * z) * pp * pp))
  }
  return { x, w }
}
const GL = gaussLegendre(64)
function gibsonClosed(X, T) {
  const a = X * Math.sqrt(T) / 2, sT = Math.sqrt(T)
  const f = (e) => e * Math.tanh(sT * e) * (Math.exp(-((e - a) ** 2)) + Math.exp(-((e + a) ** 2)))
  // integrate in 8 panels on [0, a + 12] (integrand is a smooth bump of width ~1 around e = a)
  const top = a + 12, panels = 24
  let sum = 0
  for (let p = 0; p < panels; p++) {
    const A = top * p / panels, B = top * (p + 1) / panels
    for (let i = 0; i < GL.x.length; i++) sum += GL.w[i] * f(0.5 * (B - A) * GL.x[i] + 0.5 * (A + B)) * 0.5 * (B - A)
  }
  return 1 - 2 / Math.sqrt(Math.PI * T) * sum
}

function gibsonEngine(T, nSteps = 400) {
  const { allocateEngine } = E.state, { createRecord } = E.record
  const MU = 1.0e-3, YRs = 3.15576e7, g = 9.81, rhoS = 2650, rhoW = 1025 // restated here, not imported
  const m = 1e-3, tEnd = 1e6, dt = tEnd / nSteps, e0 = 1, mv = 1e-8
  const cv = m * m * tEnd / T // m^2/yr
  const k = cv * MU * mv / YRs // m^2: cv = k / (mu mv) with k/mu in 1/Pa/s and cv per year
  const P = E.params.defaultEngineParams()
  P.nx = 1
  P.linear = { e0, C: mv * (1 + e0), k }
  const rec = createRecord({ nx: 1, dx: 1, capacity: nSteps + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  E.comp.rebuildCaches(eng, P, rec.capacity)
  for (let s = 0; s < nSteps; s++) {
    rec.nLayers = s + 1
    rec.mud[s] = m * dt / (1 + e0)
    E.comp.compactColumn(eng, P, 0, s, dt)
  }
  const gp = (rhoS - rhoW) * g / (1 + e0), h = m * tEnd
  const X = [], U = []
  for (let s = 0; s < nSteps; s++) { X.push((s + 0.5) / nSteps); U.push(rec.u[s] / (gp * h)) }
  return { X, U }
}

if (run('gibson')) {
  for (const T of [0.1, 1, 10]) {
    const { X, U } = gibsonEngine(T)
    const pde = gibsonPDE(T)
    let eClosed = 0, ePde = 0, eRef = 0
    for (let i = 0; i < X.length; i++) {
      const c = gibsonClosed(X[i], T), p = pde(X[i])
      eClosed = Math.max(eClosed, Math.abs(U[i] - c))
      ePde = Math.max(ePde, Math.abs(U[i] - p))
      eRef = Math.max(eRef, Math.abs(c - p))
    }
    out('gibson', `T=${T}`, { maxErrVsClosedForm: eClosed, maxErrVsOwnPDE: ePde, closedFormVsPDE: eRef, topU: U[U.length - 1], baseU: U[0] })
    check('gibson', `engine vs closed form at T=${T} < 0.001 of overburden`, eClosed < 1e-3, eClosed.toExponential(2))
    check('gibson', `own PDE agrees with closed form at T=${T} (< 2e-4) so the reference is sound`, eRef < 2e-4, eRef.toExponential(2))
    check('gibson', `engine vs own PDE at T=${T} < 0.001`, ePde < 1e-3, ePde.toExponential(2))
  }
}

// =============================================================================================
// 2. Golden parity with spike 001 (sine curve)
// =============================================================================================
let spikeBase = null
function runSpike(P, stopAt = Infinity, hook = null) {
  const st = spike.createState(P)
  while (st.k < stopAt && spike.step(st, P)) { if (hook) hook(st) }
  return st
}
const SINE = { seaLevelKind: 'sine' }
const segs3 = [{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]

if (run('parity')) {
  // defaults: the registry must equal the spike's defaultParams
  const sp = spike.defaultParams(), mp = E.params.defaultEngineParams()
  const diffs = []
  for (const key of Object.keys(sp)) {
    if (key === 'linear') continue
    if (JSON.stringify(sp[key]) !== JSON.stringify(mp[key])) diffs.push(`${key}: spike ${JSON.stringify(sp[key])} M1 ${JSON.stringify(mp[key])}`)
  }
  out('parity', 'default parameter differences (spike vs M1 registry)', diffs)
  check('parity', 'M1 default parameters equal spike defaults', diffs.length === 0, `${diffs.length} differences`)

  const P = spike.defaultParams()
  const sp0 = ms()
  const st = runSpike(P)
  const spikeMs = ms() - sp0
  const M = m1Setup(segs3, SINE)
  const t0 = ms()
  while (E.step.step(M.eng, M.P, M.sch, M.sea)) { /* run */ }
  const m1Ms = ms() - t0
  const rec = M.eng.rec, nx = rec.nx
  let dH = 0, dB = 0, dSand = 0, dMud = 0
  for (let j = 0; j < nx; j++) {
    dH = Math.max(dH, Math.abs(st.H[j] - rec.H[j]))
    dB = Math.max(dB, Math.abs(st.b[j] - rec.b[j]))
    let sS = 0, sM = 0, mS = 0, mM = 0
    for (let l = 0; l <= st.k; l++) { sS += st.sand[l * nx + j]; sM += st.mud[l * nx + j]; mS += rec.sand[l * nx + j]; mM += rec.mud[l * nx + j] }
    dSand = Math.max(dSand, Math.abs(sS - mS)); dMud = Math.max(dMud, Math.abs(sM - mM))
  }
  // per-cell comparison too (every layer, every column)
  let dCell = 0, dU = 0, dSmax = 0
  for (let i = 0; i < (st.k + 1) * nx; i++) {
    dCell = Math.max(dCell, Math.abs(st.sand[i] - rec.sand[i]), Math.abs(st.mud[i] - rec.mud[i]))
    dU = Math.max(dU, Math.abs(st.u[i] - rec.u[i])); dSmax = Math.max(dSmax, Math.abs(st.smax[i] - rec.smax[i]))
  }
  out('parity', 'steps', { spike: st.k, m1: M.eng.diag.stepIndex })
  out('parity', 'max |H spike - H M1| (m)', dH)
  out('parity', 'max |basement difference| (m)', dB)
  out('parity', 'max column-total |sand diff| (m)', dSand)
  out('parity', 'max column-total |mud diff| (m)', dMud)
  out('parity', 'max per-cell |solid diff| (m), |u diff| (Pa), |smax diff| (Pa)', [dCell, dU, dSmax])
  out('parity', 'run time ms (spike, M1)', [Math.round(spikeMs), Math.round(m1Ms)])
  check('parity', 'H within 0.01 m of the spike on the sine curve', dH <= 0.01, `${dH}`)
  check('parity', 'sand column totals within 1e-6', dSand <= 1e-6, `${dSand}`)
  check('parity', 'mud column totals within 1e-6', dMud <= 1e-6, `${dMud}`)
  spikeBase = st
}

// =============================================================================================
// 3. Mass balance, rebuilt from raw arrays + supply history
// =============================================================================================
function independentBalance(eng, P, sch) {
  const rec = eng.rec, nx = rec.nx, n = rec.nLayers * nx
  const sandA = [], mudA = [], cemA = []
  let saltCells = 0
  for (let i = 0; i < n; i++) {
    if (rec.material[i] === 1) { saltCells++; continue }
    sandA.push(rec.sand[i]); mudA.push(rec.mud[i]); cemA.push(rec.cem[i])
  }
  const storedSand = nsum(sandA) * rec.dx, storedMud = nsum(mudA) * rec.dx
  // initial substrate from the Athy law at 20 MPa, 30 % sand (restated here, not read from the ledger)
  const ph = (i, s) => P.phi0[i] * Math.exp(-P.beta[i] * s)
  const e = (i, s) => ph(i, s) / (1 - ph(i, s))
  const f = 0.3, smax0 = 20e6
  const solid0 = 200 / (1 + f * e(0, smax0) + (1 - f) * e(1, smax0))
  const initSand = nx * f * solid0 * rec.dx, initMud = nx * (1 - f) * solid0 * rec.dx
  // supply history: steps actually taken
  const k = eng.diag.stepIndex
  let years = 0
  for (let s = 0; s < k; s++) years += sch.stepDt[s]
  const inSand = P.supply * P.sandFrac * years, inMud = P.supply * (1 - P.sandFrac) * years
  const impliedOutSand = inSand - (storedSand - initSand)
  const impliedOutMud = inMud - (storedMud - initMud)
  const led = rec.ledger
  return {
    years, saltCells,
    ledgerInSand: led.cumIn.sand, ledgerInMud: led.cumIn.mud, inSand, inMud,
    relInSand: (led.cumIn.sand - inSand) / inSand, relInMud: (led.cumIn.mud - inMud) / inMud,
    impliedOutSand, impliedOutMud, ledgerOutSand: led.cumOut.sand, ledgerOutMud: led.cumOut.mud,
    relOutSand: (impliedOutSand - led.cumOut.sand) / (inSand + inMud),
    relOutMud: (impliedOutMud - led.cumOut.mud) / (inSand + inMud),
    relAll: ((impliedOutSand + impliedOutMud) - (led.cumOut.sand + led.cumOut.mud)) / (inSand + inMud),
    exportShare: (impliedOutSand + impliedOutMud) / (inSand + inMud),
    sandExportShare: impliedOutSand / inSand,
    initErr: (initSand + initMud - (led.init.sand + led.init.mud)) / (inSand + inMud),
    cementStored: nsum(cemA) * rec.dx, cementLedger: led.cumIn.cement - led.cumOut.cement,
    deficit: eng.diag.deficit,
  }
}

function runAll(M) { while (E.step.step(M.eng, M.P, M.sch, M.sea)) { /* run */ } }

function reportBalance(label, M) {
  const b = independentBalance(M.eng, M.P, M.sch)
  out('balance', label, b)
  check('balance', `${label}: supply in the ledger equals supply x time (sand, mud)`, Math.abs(b.relInSand) < 1e-9 && Math.abs(b.relInMud) < 1e-9, `${b.relInSand.toExponential(2)}, ${b.relInMud.toExponential(2)}`)
  check('balance', `${label}: sand-only balance < 1e-9`, Math.abs(b.relOutSand) < 1e-9, b.relOutSand.toExponential(2))
  check('balance', `${label}: mud-only balance < 1e-9`, Math.abs(b.relOutMud) < 1e-9, b.relOutMud.toExponential(2))
  check('balance', `${label}: all-sediment balance < 1e-9`, Math.abs(b.relAll) < 1e-9, b.relAll.toExponential(2))
  check('balance', `${label}: no unfilled erosion (deficit)`, b.deficit === 0, `${b.deficit}`)
  check('balance', `${label}: export is between 0 and the turbidite cap (tcMax)`, b.exportShare >= 0 && b.exportShare <= M.P.tcMax + 1e-12, `${(b.exportShare * 100).toFixed(2)} %`)
  return b
}

if (run('balance')) {
  const sineRun = m1Setup(segs3, SINE); runAll(sineRun); reportBalance('last 3 Myr, sine', sineRun)
  const curveRun = m1Setup(segs3, {}); runAll(curveRun); reportBalance('last 3 Myr, published curve', curveRun)
  // a stress case: thermal + cement + thermal subsidence + bundling on
  const stress = m1Setup([{ fromAgeMa: 6, toAgeMa: 3, dt: 50000 }, { fromAgeMa: 3, toAgeMa: 0, dt: 5000 }],
    { thermal: 1, cement: 1, subsMode: 'thermal', bundleEvery: 10, bundleAgeYr: 100000, nx: 200 })
  runAll(stress)
  const b = reportBalance('6 Myr, thermal + cement + bundling', stress)
  check('balance', 'cement ledger equals stored cement (separate ledger line)', Math.abs(b.cementStored - b.cementLedger) <= 1e-9 * Math.max(1, Math.abs(b.cementLedger)), `${b.cementStored} vs ${b.cementLedger}`)
}

// =============================================================================================
// 4. The 2 Ma experiment, both engines, then the real curve
// =============================================================================================
const DX_KM = 1
function shoreMetrics(shore, label) {
  // shore[k] = index of the first submerged column after step k (or -1). km = (j + 0.5) dx
  const km = shore.map((j) => (j < 0 ? null : (j + 0.5) * DX_KM))
  const valid = km.filter((v) => v !== null)
  const cyc = 20 // 100 kyr cycle = 20 steps of 5 kyr
  const hi = [], lo = []
  for (let a = 0; a + cyc <= km.length; a += cyc) {
    const w = km.slice(a, a + cyc).filter((v) => v !== null)
    if (w.length) { hi.push(Math.min(...w)); lo.push(Math.max(...w)) }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  const atLandwardEdge = shore.filter((j) => j === 0).length // shoreline at the first column: the coastal plain is drowned
  return { n: km.length, missing: km.length - valid.length, mean: mean(valid), highstand: mean(hi), lowstand: mean(lo), min: Math.min(...valid), max: Math.max(...valid), stepsShorelineAtLandwardEdge: atLandwardEdge, label }
}
function basinSand(rec, toeKm, includeSubstrate = true) {
  let all = 0, basin = 0
  for (let l = includeSubstrate ? 0 : 1; l < rec.nLayers; l++) for (let j = 0; j < rec.nx; j++) {
    const s = rec.sand[l * rec.nx + j]; all += s
    if ((j + 0.5) * rec.dx / 1000 >= toeKm) basin += s
  }
  return basin / all
}
function spikeBasinSand(st, toeKm, includeSubstrate = true) {
  const nx = st.nx; let all = 0, basin = 0
  for (let l = includeSubstrate ? 0 : 1; l <= st.k; l++) for (let j = 0; j < nx; j++) {
    const s = st.sand[l * nx + j]; all += s
    if ((j + 0.5) >= toeKm) basin += s
  }
  return basin / all
}

function experiment(engineName, base, branch) {
  // base/branch: { shore: [...steps after 2 Ma], sandShare: fn(toe, withSub) }
  const r = {}
  const mb = shoreMetrics(base.shore), mr = shoreMetrics(branch.shore)
  r.shore = { base: mb, branch: mr, shiftMean: mr.mean - mb.mean, shiftHighstand: mr.highstand - mb.highstand, shiftLowstand: mr.lowstand - mb.lowstand }
  r.sand = {}
  for (const toe of [65, 80]) for (const sub of [true, false]) {
    const a = base.sandShare(toe, sub), b = branch.sandShare(toe, sub)
    r.sand[`toe${toe}${sub ? '' : '-noSubstrate'}`] = { base: a, branch: b, deltaPercentagePoints: (b - a) * 100, deltaRelativePercent: (b / a - 1) * 100 }
  }
  let maxDiff = 0, sumAbs = 0, cnt = 0
  for (let k = 0; k < base.shore.length; k++) if (base.shore[k] >= 0 && branch.shore[k] >= 0) { const d = Math.abs(branch.shore[k] - base.shore[k]); maxDiff = Math.max(maxDiff, d); sumAbs += d; cnt++ }
  r.shoreStepwise = { maxAbsDifferenceKm: maxDiff * DX_KM, meanAbsDifferenceKm: sumAbs / cnt * DX_KM, finalStepKm: (branch.shore[branch.shore.length - 1] - base.shore[base.shore.length - 1]) * DX_KM }
  const edgeKm = (a) => { const v = a.filter((x) => x >= 0); return v.reduce((x, y) => x + y + 0.5, 0) / v.length * DX_KM }
  r.shelfEdge = { baseMeanKm: edgeKm(base.edge), branchMeanKm: edgeKm(branch.edge), shiftMeanKm: edgeKm(branch.edge) - edgeKm(base.edge) }
  return r
}

function spikeBranchRun(P0, k0, shift, extra = {}) {
  // base state to k0, snapshot, then continue base and (on a fresh state) the branch with slShift
  const base = spike.createState(P0)
  while (base.k < k0) spike.step(base, P0)
  const snap = spike.snapshot(base)
  const shoreBase = [], edgeBase = []
  while (spike.step(base, P0)) { shoreBase.push(base.shore); edgeBase.push(base.shelfEdge) }
  const P1 = spike.clone(P0); P1.slShift = shift; Object.assign(P1, extra)
  const br = spike.createState(P1)
  spike.restore(snap, br, P1)
  const shoreBr = [], edgeBr = []
  while (spike.step(br, P1)) { shoreBr.push(br.shore); edgeBr.push(br.shelfEdge) }
  return { base: { shore: shoreBase, edge: edgeBase, sandShare: (t, s) => spikeBasinSand(base, t, s) },
    branch: { shore: shoreBr, edge: edgeBr, sandShare: (t, s) => spikeBasinSand(br, t, s) }, baseState: base, brState: br }
}

function m1BranchRun(overrides, k0, shift) {
  const M = m1Setup(segs3, overrides)
  while (M.eng.diag.stepIndex < k0) E.step.step(M.eng, M.P, M.sch, M.sea)
  const snap = E.step.snapshotEngine(M.eng)
  const shoreBase = [], edgeBase = []
  while (E.step.step(M.eng, M.P, M.sch, M.sea)) { shoreBase.push(M.eng.diag.shore); edgeBase.push(M.eng.diag.shelfEdge) }
  const baseRec = M.eng.rec
  const baseShare = (t, s) => basinSand(baseRec, t, s)
  const baseShares = {}
  for (const toe of [65, 80]) for (const sub of [true, false]) baseShares[`${toe}${sub}`] = baseShare(toe, sub)
  // branch: same engine object, restored, with the edited parameter set and a fresh sea-level function
  const P1 = { ...M.P, slShift: shift }
  const sea1 = E.sea.makeSeaLevel(P1, M.sch.startAgeMa * 1e6)
  E.step.restoreEngine(snap, M.eng, P1)
  const shoreBr = [], edgeBr = []
  while (E.step.step(M.eng, P1, M.sch, sea1)) { shoreBr.push(M.eng.diag.shore); edgeBr.push(M.eng.diag.shelfEdge) }
  const brShares = {}
  for (const toe of [65, 80]) for (const sub of [true, false]) brShares[`${toe}${sub}`] = basinSand(M.eng.rec, toe, sub)
  return { base: { shore: shoreBase, edge: edgeBase, sandShare: (t, s) => baseShares[`${t}${s}`] },
    branch: { shore: shoreBr, edge: edgeBr, sandShare: (t, s) => brShares[`${t}${s}`] }, hash: ownHash(M.eng.rec) }
}

async function m1BranchViaTimeMachine(overrides, k0, shift) {
  const tm = new E.tm.TimeMachine()
  const info = tm.run({ presetId: 'last3', overrides }, 1)
  const b = tm.branch(info.rootId, k0, { slShift: shift })
  const vBase = tm.seek(info.rootId, 600, ['sand'], true)
  const vBr = tm.seek(b.id, 600, ['sand'], true)
  const share = (v, toe) => {
    let all = 0, basin = 0
    for (let l = 0; l < v.nLayers; l++) for (let j = 0; j < v.nx; j++) {
      const s = v.sand[l * v.nx + j]; all += s
      if ((j + 0.5) * v.dx / 1000 >= toe) basin += s
    }
    return basin / all
  }
  return { baseHash: vBase.hash, brHash: vBr.hash, base65: share(vBase, 65), br65: share(vBr, 65) }
}

if (run('exp2ma')) {
  const K0 = 200 // 2 Ma: 3 Myr run, 5 kyr steps, 1 Myr elapsed = step 200
  const P0 = spike.defaultParams()
  const sp = spikeBranchRun(P0, K0, -50)
  const rS = experiment('spike', sp.base, sp.branch)
  out('exp2ma', 'sine / spike 001', rS)
  const m1 = m1BranchRun(SINE, K0, -50)
  const rM = experiment('m1', m1.base, m1.branch)
  out('exp2ma', 'sine / M1 engine', rM)
  const viaTm = await m1BranchViaTimeMachine(SINE, K0, -50)
  out('exp2ma', 'sine / M1 through the app TimeMachine (branch edit slShift -50)', viaTm)
  const share65b = m1.branch.sandShare(65, true), share65a = m1.base.sandShare(65, true)
  check('exp2ma', 'TimeMachine branch gives the same basin-floor sand as the direct engine branch', Math.abs(viaTm.br65 - share65b) < 1e-12 && Math.abs(viaTm.base65 - share65a) < 1e-12, `${viaTm.br65} vs ${share65b}`)
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b)
  const cmp = (name, m, s) => check('exp2ma', `${name}: M1 within 10 % of the spike (M1 ${m.toFixed(3)}, spike ${s.toFixed(3)})`, rel(m, s) <= 0.1, `${(rel(m, s) * 100).toFixed(2)} %`)
  cmp('shoreline shift, time-mean (km)', rM.shore.shiftMean, rS.shore.shiftMean)
  cmp('shoreline shift at highstands (km)', rM.shore.shiftHighstand, rS.shore.shiftHighstand)
  cmp('shoreline shift at lowstands (km)', rM.shore.shiftLowstand, rS.shore.shiftLowstand)
  for (const key of Object.keys(rS.sand)) {
    cmp(`basin-floor sand change ${key} (percentage points)`, rM.sand[key].deltaPercentagePoints, rS.sand[key].deltaPercentagePoints)
    cmp(`basin-floor sand change ${key} (relative %)`, rM.sand[key].deltaRelativePercent, rS.sand[key].deltaRelativePercent)
  }
  // the real curve (M1 only: the spike has the sine curve only)
  const mc = m1BranchRun({}, K0, -50)
  const rC = experiment('m1-curve', mc.base, mc.branch)
  out('exp2ma', 'published curve / M1 engine', rC)
  const mcTm = await m1BranchViaTimeMachine({}, K0, -50)
  out('exp2ma', 'published curve / M1 through the app TimeMachine', mcTm)
  check('exp2ma', 'curve: TimeMachine branch equals direct engine branch', Math.abs(mcTm.br65 - mc.branch.sandShare(65, true)) < 1e-12, `${mcTm.br65}`)
  // history before 2 Ma must be identical in branch and base (the snapshot is the same)
  out('exp2ma', 'branch own hash (M1 sine)', m1.hash)
}

// =============================================================================================
// 5. Determinism: seek to random steps, hash, compare with a straight run
// =============================================================================================
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }

if (run('determinism')) {
  for (const [label, presetId, overrides, nPick] of [
    ['last3 (published curve), thermal+cement off', 'last3', {}, 14],
    ['last3 (sine) with thermal + cement', 'last3', { ...SINE, thermal: 1, cement: 1 }, 10],
    ['Miocene (bundled deep compaction)', 'miocene', {}, 8],
  ]) {
    const preset = E.presets.getPreset(presetId)
    const M = m1Setup(preset.segments, { ...preset.params, ...overrides })
    const nSteps = M.sch.nSteps
    const rnd = lcg(20261014)
    const picks = new Set()
    while (picks.size < nPick) picks.add(1 + Math.floor(rnd() * nSteps))
    picks.add(nSteps)
    const hashes = new Map(), appHashes = new Map(), Hs = new Map()
    const det = await load('/src/engine/determinism.ts')
    while (E.step.step(M.eng, M.P, M.sch, M.sea)) {
      const k = M.eng.diag.stepIndex
      if (picks.has(k)) { hashes.set(k, ownHash(M.eng.rec)); appHashes.set(k, det.stateHash(M.eng.rec)); Hs.set(k, Array.from(M.eng.rec.H)) }
    }
    // second straight run: must repeat bit for bit
    const M2 = m1Setup(preset.segments, { ...preset.params, ...overrides })
    let repeat = true
    while (E.step.step(M2.eng, M2.P, M2.sch, M2.sea)) { const k = M2.eng.diag.stepIndex; if (picks.has(k) && ownHash(M2.eng.rec) !== hashes.get(k)) repeat = false }
    // time machine: seek to the picks in random order (forwards and backwards)
    const tm = new E.tm.TimeMachine()
    const info = tm.run({ presetId, overrides: { ...preset.params ? {} : {}, ...overrides } }, 7)
    const order = [...picks].sort(() => rnd() - 0.5)
    let bad = 0, badH = 0
    for (const k of order) {
      const v = tm.seek(info.rootId, k, ['sand'], true)
      if (v.hash !== appHashes.get(k)) bad++
      const H = hashes.get(k) && Hs.get(k)
      for (let j = 0; j < H.length; j++) if (Object.is(H[j], v.H[j]) === false) { badH++; break }
    }
    out('determinism', label, { steps: nSteps, picks: order.length, straightRunRepeatsBitwise: repeat, seekHashMismatches: bad, seekSurfaceMismatches: badH })
    check('determinism', `${label}: straight run repeats bit for bit at ${picks.size} steps`, repeat, '')
    check('determinism', `${label}: ${order.length} random seeks hash like the straight run`, bad === 0, `${bad} mismatches`)
    check('determinism', `${label}: seeked surface H bit-identical`, badH === 0, `${badH} mismatches`)
  }
}

// =============================================================================================
// 6. Burial physics: conduction, quartz cement, thermal subsidence
// =============================================================================================
if (run('burial')) {
  // (a) conduction hand calculation: three layers
  {
    const h = [100, 200, 300], k = [2, 2.5, 3], q = 0.04, Ts = 10
    let t = Ts
    const exp = []
    for (let i = 0; i < 3; i++) { exp.push(t + q * 0.5 * h[i] / k[i]); t += q * h[i] / k[i] }
    const got = new Float64Array(3)
    const base = E.thermal.steadyConduction(Ts, q, h, k, got)
    let err = Math.abs(base - t)
    for (let i = 0; i < 3; i++) err = Math.max(err, Math.abs(got[i] - exp[i]))
    check('burial', 'steadyConduction vs hand sum T = Ts + q sum(h/k), 3 layers (< 0.01 C)', err < 0.01, `${err.toExponential(2)} C`)
  }
  // (b) the engine's own columns vs a profile rebuilt from the raw record, Miocene run with thermal on
  const preset = E.presets.getPreset('miocene')
  const M = m1Setup(preset.segments, { ...preset.params, thermal: 1, cement: 0 })
  const tRun0 = ms(); runAll(M); const tRun = ms() - tRun0
  out('burial', 'Miocene + thermal run time (s)', tRun / 1000)
  const rec = M.eng.rec, nx = rec.nx, p = M.P
  const sl = M.sea(M.sch.tEndYr[M.sch.nSteps - 1])
  const phi = (i, s) => p.phi0[i] * Math.exp(-p.beta[i] * s)
  let worst = 0, worstView = 0
  const tm = new E.tm.TimeMachine()
  const info = tm.run({ presetId: 'miocene', overrides: { thermal: 1, cement: 0 } }, 1)
  const view = tm.seek(info.rootId, M.sch.nSteps, ['temp', 'thick'], false)
  for (const j of [0, 20, 50, 80, 100, 150, 250, 399]) {
    // independent: thickness from smax, conductivity from geometric means, sum top-down
    let wd = sl - rec.H[j]
    let T = wd <= 0 ? p.tSeaShallow : p.tSeaDeep + (p.tSeaShallow - p.tSeaDeep) * Math.exp(-wd / p.tSeaScale)
    for (let l = rec.nLayers - 1; l >= 0; l--) {
      const i = l * nx + j
      const s = rec.sand[i], m = rec.mud[i], tot = s + m
      if (tot <= 0) continue
      const hS = s / (1 - phi(0, rec.smax[i])), hM = m / (1 - phi(1, rec.smax[i]))
      const hh = hS + hM, por = 1 - tot / hh, fs = s / tot
      const kg = Math.exp(fs * Math.log(p.kGrain[0]) + (1 - fs) * Math.log(p.kGrain[1]))
      const kk = Math.exp((1 - por) * Math.log(kg) + por * Math.log(p.kWater))
      const mid = T + p.heatFlow * 0.5 * hh / kk
      T += p.heatFlow * hh / kk
      worst = Math.max(worst, Math.abs(mid - M.eng.temp[i]))
      worstView = Math.max(worstView, Math.abs(mid - view.temp[i]))
    }
  }
  out('burial', 'conduction: worst |independent - engine eng.temp| over 8 columns, all cells (C)', worst)
  out('burial', 'conduction: worst |independent - app view temp| (C)', worstView)
  check('burial', 'temperature field rebuilt from the raw record matches the engine (< 0.01 C)', worst < 0.01 && worstView < 0.01, `${worst.toExponential(2)} / ${worstView.toExponential(2)} C`)

  // (c) quartz cement hand calculation. A single clean sand cell, no engine stepping.
  {
    const { allocateEngine } = E.state, { createRecord } = E.record
    const Pc = E.params.defaultEngineParams()
    const A0 = Pc.cemA, B0 = Pc.cemB, d = Pc.cemGrain, f = Pc.cemSurf
    const Vm = 0.06009 / 2650 // m3/mol, Walderhaug 1996: 60.09 g/mol, 2.65 g/cm3
    const YRs = 3.15576e7
    const mkCell = () => {
      const rec = createRecord({ nx: 1, dx: 1, capacity: 2, startAgeMa: 0 })
      const eng = allocateEngine(rec)
      rec.nLayers = 1
      rec.sand[0] = 1.0; rec.smax[0] = 30e6
      E.comp.setPor(eng, Pc, 0, 30e6)
      return { rec, eng }
    }
    const handCase = (Tfun, dtYr) => {
      // numerical integral of r(T(t)) over the part of the step above the onset (composite Simpson, 200000 intervals)
      const n = 200000, dts = dtYr * YRs / n
      let s = 0
      for (let i = 0; i <= n; i++) {
        const t = i / n, T = Tfun(t)
        const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2
        s += w * (T > Pc.cemTonset ? A0 * Math.pow(10, B0 * T) : 0)
      }
      return s * dts / 3 * Vm // growth, m
    }
    for (const [label, T0, T1] of [['constant 100 C', 100, 100], ['heating 80 -> 120 C', 80, 120], ['heating 60 -> 100 C (crosses the 70 C onset)', 60, 100]]) {
      const { rec, eng } = mkCell()
      const dtYr = 1e6
      const phiS = eng.phs[0]
      const g = handCase((t) => T0 + (T1 - T0) * t, dtYr)
      const area = 6 * (1 - phiS) * f / d
      const bulkSand = 1.0 / (1 - phiS)
      const expected = area * g * bulkSand
      const room = bulkSand - 1.0
      const got = E.cement.cementCell(eng, Pc, 0, T0, T1, dtYr)
      const expC = Math.min(expected, room)
      const relErr = Math.abs(got - expC) / expC
      out('burial', `cement ${label}`, { expected: expC, engine: got, relErr, ledgerGain: rec.ledger.cumIn.cement, growth_um: g * 1e6 })
      check('burial', `cement hand calculation, ${label} (< 0.5 %)`, relErr < 0.005, `${(relErr * 100).toExponential(2)} %`)
      check('burial', `cement ledger equals cement stored, ${label}`, Math.abs(rec.ledger.cumIn.cement - rec.cem[0] * rec.dx) < 1e-15, '')
    }
    // step-length independence: one 1 Myr step vs 100 steps of 10 kyr along the same heating line
    const a = mkCell(), b = mkCell()
    E.cement.cementCell(a.eng, Pc, 0, 80, 120, 1e6)
    for (let s = 0; s < 100; s++) E.cement.cementCell(b.eng, Pc, 0, 80 + 40 * s / 100, 80 + 40 * (s + 1) / 100, 1e4)
    const dd = Math.abs(a.rec.cem[0] - b.rec.cem[0]) / a.rec.cem[0]
    out('burial', 'cement step-length independence (1 step vs 100 steps, same heating line)', dd)
    check('burial', 'cement independent of step length (< 0.5 %)', dd < 0.005, `${(dd * 100).toExponential(2)} %`)
  }

  // (d) thermal subsidence: basement drop vs closed form, 66 Myr, only tectonic part of b
  {
    const pc = E.presets.getPreset('cenozoic')
    const Mt = m1Setup(pc.segments, { ...pc.params, subsMode: 'thermal' })
    const b0 = Array.from(Mt.eng.rec.b)
    const tau = Mt.P.subsTau
    const samples = []
    const stepsToCheck = new Set([100, 430, 830, 1430])
    let worstRel = 0
    while (E.step.step(Mt.eng, Mt.P, Mt.sch, Mt.sea)) {
      const k = Mt.eng.diag.stepIndex
      if (stepsToCheck.has(k)) {
        const tEl = Mt.sch.tEndYr[k - 1]
        for (const j of [0, 199, 399]) {
          const rate = (Mt.P.subsShelf + (Mt.P.subsBasin - Mt.P.subsShelf) * (j + 0.5) / Mt.P.nx) * 1e-6
          const expected = rate * tau * (1 - Math.exp(-tEl / tau))
          const got = b0[j] - Mt.eng.rec.b[j]
          worstRel = Math.max(worstRel, Math.abs(got - expected) / expected)
          if (j === 199) samples.push({ step: k, tMyr: tEl / 1e6, expectedM: expected, engineM: got })
        }
      }
    }
    const constant = (Mt.P.subsShelf + (Mt.P.subsBasin - Mt.P.subsShelf) * 200.5 / 400) * 1e-6 * 66e6
    out('burial', 'thermal subsidence column 199: expected vs engine (m)', samples)
    out('burial', 'thermal subsidence: 66 Myr total vs constant-rate total at column 199 (m)', { thermal: samples[samples.length - 1].engineM, constant })
    check('burial', 'thermal subsidence follows rate x tau x (1 - exp(-t/tau)) (< 1e-6 relative)', worstRel < 1e-6, worstRel.toExponential(2))
  }
}

// =============================================================================================
// 7. Long runs
// =============================================================================================
function timeIt(fn) { const t = ms(); const r = fn(); return [r, (ms() - t) / 1000] }

if (run('longruns')) {
  // Miocene and Cenozoic: time, balance, shelf inside the section
  const longs = {}
  for (const id of ['miocene', 'cenozoic']) {
    const preset = E.presets.getPreset(id)
    const M = m1Setup(preset.segments, { ...preset.params })
    let maxShore = 0, maxEdge = 0, noShore = 0, edgeLast = 0
    const t0 = ms()
    while (E.step.step(M.eng, M.P, M.sch, M.sea)) {
      const d = M.eng.diag
      if (d.shore >= 0) maxShore = Math.max(maxShore, d.shore + 0.5); else noShore++
      if (d.shelfEdge >= 0) maxEdge = Math.max(maxEdge, d.shelfEdge + 0.5)
      if (d.shore >= M.P.nx - 1 || d.shelfEdge >= M.P.nx - 1) edgeLast++
    }
    const secs = (ms() - t0) / 1000
    out('longruns', `${id} run`, { steps: M.sch.nSteps, seconds: secs, maxShoreKm: maxShore, maxShelfEdgeKm: maxEdge, stepsWithNoShoreline: noShore, stepsAtGridEnd: edgeLast, memoryMB: E.record.recordBytes(M.P.nx, M.sch.nSteps + 1) / 1e6 })
    check('longruns', `${id} run time (${id === 'miocene' ? '< 3 s' : '< 5 s'})`, secs < (id === 'miocene' ? 3 : 5), `${secs.toFixed(2)} s`)
    reportBalance(`${id} preset`, M)
    check('longruns', `${id}: shoreline and shelf edge stay inside the section (< 75 % of its length)`, maxShore < 0.75 * M.P.nx && maxEdge < 0.75 * M.P.nx && edgeLast === 0, `shore ${maxShore} km, edge ${maxEdge} km of ${M.P.nx} km`)
    longs[id] = M
  }

  // bundled vs unbundled, 12 Myr / 5 kyr, same prescribed deposition (own rule, differs from the repo test)
  {
    const seg = [{ fromAgeMa: 12, toAgeMa: 0, dt: 5000 }]
    const doRun = (over) => {
      const P = { ...E.params.defaultEngineParams(), nx: 3, ...over }
      const sch = E.schedule.buildSchedule(seg)
      const eng = E.step.createEngine(P, sch)
      const rates = [25, 70, 140] // bulk-ish m/Myr of solids
      for (let k = 0; k < sch.nSteps; k++) {
        const k1 = E.record.appendLayer(eng.rec, sch.stepDt[k], sch.stepAgeMa[k], sch.tEndYr[k])
        for (let j = 0; j < 3; j++) {
          const i = k1 * 3 + j
          const s = rates[j] * sch.stepDt[k] / 1e6 * (1 + 0.5 * Math.cos(2 * Math.PI * k / 130 + 2 * j))
          const f = 0.4 + 0.3 * Math.sin(k / 31 + 3 * j)
          eng.rec.sand[i] = f * s; eng.rec.mud[i] = (1 - f) * s
          E.comp.setPor(eng, P, i, 0)
          eng.rec.H[j] += s * (f / (1 - P.phi0[0]) + (1 - f) / (1 - P.phi0[1]))
        }
        E.step.compactStep(eng, P, sch, k, k1)
        eng.diag.stepIndex = k + 1
      }
      return { P, eng }
    }
    const logPhi = (r, j, bin = 100, nb = 30) => { // porosity by depth bin, own implementation
      const rec = r.eng.rec; const solid = Array(nb).fill(0), bulk = Array(nb).fill(0); let z = 0
      for (let l = rec.nLayers - 1; l >= 0 && z < bin * nb; l--) {
        const i = l * rec.nx + j; const b = E.comp.cellBulk(r.eng, r.P, i); if (b <= 0) continue
        const s = rec.sand[i] + rec.mud[i], z1 = z + b
        for (let q = Math.floor(z / bin); q < nb && q * bin < z1; q++) { const fr = (Math.min(z1, (q + 1) * bin) - Math.max(z, q * bin)) / b; bulk[q] += fr * b; solid[q] += fr * s }
        z = z1
      }
      return bulk.map((b, q) => (b >= bin * 0.999 ? 1 - solid[q] / b : NaN))
    }
    const [off, tOff] = timeIt(() => doRun({}))
    const [on, tOn] = timeIt(() => doRun({ bundleEvery: 10, bundleAgeYr: 100000 }))
    let dH = 0, dPhi = 0, uOff = 0, uOn = 0
    for (let j = 0; j < 3; j++) {
      dH = Math.max(dH, Math.abs(off.eng.rec.H[j] - on.eng.rec.H[j]))
      const a = logPhi(off, j), b = logPhi(on, j)
      for (let q = 0; q < a.length; q++) if (!Number.isNaN(a[q]) && !Number.isNaN(b[q])) dPhi = Math.max(dPhi, Math.abs(a[q] - b[q]))
    }
    for (let i = 0; i < off.eng.rec.nLayers * 3; i++) { uOff = Math.max(uOff, off.eng.rec.u[i]); uOn = Math.max(uOn, on.eng.rec.u[i]) }
    const dU = Math.abs(uOn - uOff) / uOff
    out('longruns', 'bundled vs unbundled, 12 Myr, 5 kyr, prescribed deposition', { dH_m: dH, dPhi, dU, Hoff: Array.from(off.eng.rec.H), secondsOff: tOff, secondsOn: tOn, sameLayersAndSolids: off.eng.rec.nLayers === on.eng.rec.nLayers })
    check('longruns', 'bundled vs unbundled: surface within 2 m', dH < 2, `${dH.toFixed(3)} m`)
    check('longruns', 'bundled vs unbundled: porosity log within 0.005', dPhi < 0.005, dPhi.toFixed(5))
    check('longruns', 'bundled vs unbundled: max excess pressure within 2 %', dU < 0.02, `${(dU * 100).toFixed(2)} %`)
  }
  results.__longM = null
}

// =============================================================================================
// 8. Geology read
// =============================================================================================
const FT = 3.280839895
if (run('geology')) {
  // Miocene preset with temperature on (default is off; the app has a switch)
  const preset = E.presets.getPreset('miocene')
  const M = m1Setup(preset.segments, { ...preset.params, thermal: 1 })
  const t0 = ms(); runAll(M); const secs = (ms() - t0) / 1000
  out('geology', 'Miocene + thermal run time (s)', secs)
  const rec = M.eng.rec, nx = rec.nx, P = M.P
  const thick = (j) => rec.H[j] - rec.b[j]
  const cols = [0, 10, 30, 50, 65, 80, 100, 150, 200, 300, 399]
  out('geology', 'Miocene: total section thickness above basement (m / ft) by column km', cols.map((j) => [j, Math.round(thick(j)), Math.round(thick(j) * FT)]))
  out('geology', 'Miocene: surface elevation H (m) by column', cols.map((j) => [j, Math.round(rec.H[j])]))
  // deposited thickness only (excluding the 200 m substrate)
  // porosity-depth: dominated cells, depth to mid-cell below the local surface
  const bins = [[0, 500], [500, 1000], [1000, 1500], [1500, 2000], [2000, 3000], [3000, 4000], [4000, 6000]]
  const acc = { sand: bins.map(() => []), mud: bins.map(() => []) }
  for (let j = 0; j < nx; j++) {
    let z = 0
    for (let l = rec.nLayers - 1; l >= 1; l--) {
      const i = l * nx + j, s = rec.sand[i], m = rec.mud[i], tot = s + m
      if (tot <= 1e-9) continue
      const h = E.comp.cellBulk(M.eng, P, i), mid = z + h / 2; z += h
      const phi = 1 - tot / h, fs = s / tot
      const bi = bins.findIndex(([a, b]) => mid >= a && mid < b)
      if (bi < 0) continue
      if (fs > 0.9) acc.sand[bi].push(phi); else if (fs < 0.1) acc.mud[bi].push(phi)
    }
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
  const sc = (lith, zm) => (lith === 'sand' ? 0.49 * Math.exp(-0.27e-3 * zm) : 0.63 * Math.exp(-0.51e-3 * zm))
  out('geology', 'Miocene porosity vs depth, cells >90 % sand / >90 % mud, mean model vs Sclater & Christie (1980) curve at bin mid-depth', bins.map(([a, b], q) => ({
    binM: `${a}-${b}`, sandN: acc.sand[q].length, sandModel: +mean(acc.sand[q]).toFixed(3), sandSC: +sc('sand', (a + b) / 2).toFixed(3),
    mudN: acc.mud[q].length, mudModel: +mean(acc.mud[q]).toFixed(3), mudSC: +sc('mud', (a + b) / 2).toFixed(3),
  })))
  // deepest sand and its temperature (F)
  let best = null
  for (let j = 0; j < nx; j++) for (let l = 1; l < rec.nLayers; l++) {
    const i = l * nx + j
    if (rec.sand[i] > 0.5 * (rec.sand[i] + rec.mud[i]) && rec.sand[i] > 0.05) { // sand-bearing cell, >0.05 m solid sand, sand-dominated
      let z = 0; for (let q = rec.nLayers - 1; q > l; q--) z += E.comp.cellBulk(M.eng, P, q * nx + j)
      const dep = z + E.comp.cellBulk(M.eng, P, i) / 2
      if (!best || dep > best.depthM) best = { col: j, layer: l, depthM: dep, tC: M.eng.temp[i], ageMa: rec.stepAgeMa[l] }
    }
  }
  out('geology', 'Miocene deepest sand-dominated cell', { ...best, depthFt: best.depthM * FT, tF: best.tC * 9 / 5 + 32 })
  let maxT = 0, maxTcol = -1
  for (let i = 0; i < rec.nLayers * nx; i++) if (M.eng.temp[i] > maxT) { maxT = M.eng.temp[i]; maxTcol = i % nx }
  out('geology', 'Miocene hottest cell (C, F, column)', [maxT, maxT * 9 / 5 + 32, maxTcol])
  // overpressure
  let uMax = 0; for (let i = 0; i < rec.nLayers * nx; i++) uMax = Math.max(uMax, rec.u[i])
  out('geology', 'Miocene max excess pore pressure (MPa)', uMax / 1e6)

  // Last 3 Myr real curve: shoreline swings and lowstand sand by zone
  const C = m1Setup(segs3, {})
  const shore = [], edge = []
  while (E.step.step(C.eng, C.P, C.sch, C.sea)) { shore.push(C.eng.diag.shore); edge.push(C.eng.diag.shelfEdge) }
  const cr = C.eng.rec
  const sls = Array.from(C.sch.tEndYr, (t) => C.sea(t))
  const lowSteps = [], highSteps = []
  for (let k = 0; k < C.sch.nSteps; k++) { if (sls[k] < -80) lowSteps.push(k); if (sls[k] > -20) highSteps.push(k) }
  const zones = { shelf: [0, 40], slope: [40, 65], basin: [65, 150] }
  const share = (steps) => {
    const r = {}; let tot = 0
    for (const [z, [a, b]] of Object.entries(zones)) {
      let s = 0, m = 0
      for (const k of steps) for (let j = a; j < b; j++) { const i = (k + 1) * cr.nx + j; s += cr.sand[i]; m += cr.mud[i] }
      r[z] = { sandSolidM2: s * cr.dx, mudSolidM2: m * cr.dx, sandFraction: s / (s + m) }; tot += s
    }
    for (const z of Object.keys(zones)) r[z].shareOfThisIntervalSand = r[z].sandSolidM2 / (tot * cr.dx)
    return r
  }
  out('geology', 'curve, last 3 Myr: sea level range (m)', [Math.min(...sls), Math.max(...sls)])
  out('geology', 'curve: steps with sea level < -80 m / > -20 m', [lowSteps.length, highSteps.length])
  out('geology', 'curve: sand deposited in lowstand steps (< -80 m), by zone', share(lowSteps))
  out('geology', 'curve: sand deposited in highstand steps (> -20 m), by zone', share(highSteps))
  const sm = shoreMetrics(shore.map((x) => x), 'curve')
  out('geology', 'curve: shoreline km (mean, min, max, steps without shoreline)', [sm.mean, sm.min, sm.max, sm.missing])
  const edgeKm = edge.filter((v) => v >= 0).map((v) => v + 0.5)
  out('geology', 'curve: shelf edge km (min, max)', [Math.min(...edgeKm), Math.max(...edgeKm)])
  // shoreline swing per 100 kyr window
  const sw = []
  for (let a = 0; a + 20 <= shore.length; a += 20) { const w = shore.slice(a, a + 20).filter((v) => v >= 0); if (w.length) sw.push(Math.max(...w) - Math.min(...w)) }
  out('geology', 'curve: shoreline swing within 100 kyr windows (km): mean, max', [sw.reduce((x, y) => x + y, 0) / sw.length, Math.max(...sw)])
  // sine run for comparison
  const S = m1Setup(segs3, SINE)
  const shoreS = []
  while (E.step.step(S.eng, S.P, S.sch, S.sea)) shoreS.push(S.eng.diag.shore)
  const sm2 = shoreMetrics(shoreS, 'sine')
  out('geology', 'sine: shoreline km (mean, min, max)', [sm2.mean, sm2.min, sm2.max])
  out('geology', 'basin-floor sand share (>= 65 km, excluding substrate): sine, curve', [basinSand(S.eng.rec, 65, false), basinSand(cr, 65, false)])
  if (spikeBase) out('geology', 'basin-floor sand share (>= 65 km, excluding substrate): spike sine', spikeBasinSand(spikeBase, 65, false))
  // maximum seabed slope after the run
  const slopeDeg = (rec_) => { let g = 0, at = 0; for (let j = 0; j < rec_.nx - 1; j++) { const s = (rec_.H[j] - rec_.H[j + 1]) / rec_.dx; if (s > g) { g = s; at = j } } return [Math.atan(g) * 180 / Math.PI, at] }
  out('geology', 'max slope deg and column: sine, curve', [slopeDeg(S.eng.rec), slopeDeg(cr)])
  out('geology', 'surface elevation H (m) at columns 0,20,40,60,80,100,149: sine', [0, 20, 40, 60, 80, 100, 149].map((j) => Math.round(S.eng.rec.H[j])))
  out('geology', 'surface elevation H (m) at columns 0,20,40,60,80,100,149: curve', [0, 20, 40, 60, 80, 100, 149].map((j) => Math.round(cr.H[j])))
  out('geology', 'surface elevation H (m) at columns 0,20,40,60,80,100,149: spike sine', spikeBase ? [0, 20, 40, 60, 80, 100, 149].map((j) => Math.round(spikeBase.H[j])) : 'n/a (run parity)')
}

// =============================================================================================
// 9. Geology, second pass: zones that move with the shelf edge, turbidite share, porosity at depth
// =============================================================================================
if (run('geology2')) {
  const DRHO_G = (2650 - 1025) * 9.81 // restated
  // (a) curve and sine runs, 3 Myr, with the diagnostics of every step
  for (const [label, over] of [['published curve', {}], ['sine', SINE]]) {
    const C = m1Setup(segs3, over)
    const edge = [], shore = [], tc = []
    while (E.step.step(C.eng, C.P, C.sch, C.sea)) { const d = C.eng.diag; edge.push(d.shelfEdge); shore.push(d.shore); tc.push(d.tcShare) }
    const cr = C.eng.rec, nx = cr.nx
    const sls = Array.from(C.sch.tEndYr, (t) => C.sea(t))
    // zones relative to the shelf edge of THAT step: shelf < edge, slope edge..edge+25 km (the initial slope is 25 km wide), basin floor beyond
    const SLOPE_W = 25
    const classes = { low: (k) => sls[k] < -80, high: (k) => sls[k] > -20, all: () => true }
    const res = {}
    for (const [cn, test] of Object.entries(classes)) {
      const z = { shelf: [0, 0], slope: [0, 0], basin: [0, 0] }
      let steps = 0
      for (let k = 0; k < C.sch.nSteps; k++) {
        if (!test(k) || edge[k] < 0) continue
        steps++
        for (let j = 0; j < nx; j++) {
          const i = (k + 1) * nx + j
          const zone = j <= edge[k] ? 'shelf' : j <= edge[k] + SLOPE_W ? 'slope' : 'basin'
          z[zone][0] += cr.sand[i]; z[zone][1] += cr.mud[i]
        }
      }
      const totS = z.shelf[0] + z.slope[0] + z.basin[0]
      res[cn] = { steps, ...Object.fromEntries(Object.entries(z).map(([n, [s, m]]) => [n, { sandShareOfAllSandInClass: +(s / totS).toFixed(3), sandFraction: +(s / (s + m)).toFixed(3) }])) }
    }
    out('geology2', `${label}: layers by zone relative to that step's shelf edge (preserved at the end of the run)`, res)
    // turbidite share vs shoreline-to-edge distance
    let hiTc = 0, hiN = 0, loTc = 0, loN = 0, hiFar = 0
    for (let k = 0; k < C.sch.nSteps; k++) {
      if (edge[k] < 0 || shore[k] < 0) continue
      if (sls[k] > -20) { hiN++; hiTc += tc[k]; if (tc[k] > 0.1) hiFar++ }
      if (sls[k] < -80) { loN++; loTc += tc[k] }
    }
    out('geology2', `${label}: turbidite share of supply (mean at highstand > -20 m, at lowstand < -80 m, steps at highstand with share > 10 %)`, [hiTc / hiN, loTc / loN, hiFar, hiN])
    const gaps = []
    for (let k = 0; k < C.sch.nSteps; k++) if (edge[k] >= 0 && shore[k] >= 0 && sls[k] > -20) gaps.push(edge[k] - shore[k])
    gaps.sort((a, b) => a - b)
    out('geology2', `${label}: at highstand, shoreline-to-"shelf edge" distance km (min, median, max)`, [gaps[0], gaps[gaps.length >> 1], gaps[gaps.length - 1]])
    out('geology2', `${label}: shelf edge found at <= 3 km from the landward boundary, steps`, edge.filter((e) => e >= 0 && e <= 2).length)
  }
  // (b) porosity against Sclater & Christie at the depth of each cell, hydrostatic cells only
  const preset = E.presets.getPreset('miocene')
  const M = m1Setup(preset.segments, { ...preset.params })
  runAll(M)
  const rec = M.eng.rec, nx = rec.nx
  const bins = [[0, 500], [500, 1000], [1000, 1500], [1500, 2000], [2000, 3000], [3000, 4500]]
  const acc = {}
  for (const lith of ['sand', 'mud']) for (const press of ['hydrostatic (u/L < 0.05)', 'overpressured (u/L >= 0.3)']) acc[`${lith} ${press}`] = bins.map(() => ({ n: 0, dPhi: 0, phi: 0, sc: 0 }))
  for (let j = 0; j < nx; j++) {
    // loads from the top down
    let above = 0, z = 0
    for (let l = rec.nLayers - 1; l >= 1; l--) {
      const i = l * nx + j, s = rec.sand[i], m = rec.mud[i], tot = s + m
      if (tot <= 1e-9) continue
      const h = E.comp.cellBulk(M.eng, M.P, i)
      const L = DRHO_G * (above + 0.5 * tot); above += tot
      const mid = z + h / 2; z += h
      const fs = s / tot
      const lith = fs > 0.9 ? 'sand' : fs < 0.1 ? 'mud' : null
      if (!lith) continue
      const phi = 1 - tot / h
      const lam = rec.u[i] / L
      const press = lam < 0.05 ? 'hydrostatic (u/L < 0.05)' : lam >= 0.3 ? 'overpressured (u/L >= 0.3)' : null
      if (!press) continue
      const bi = bins.findIndex(([a, b]) => mid >= a && mid < b); if (bi < 0) continue
      const sc = lith === 'sand' ? 0.49 * Math.exp(-0.27e-3 * mid) : 0.63 * Math.exp(-0.51e-3 * mid)
      const a = acc[`${lith} ${press}`][bi]; a.n++; a.dPhi += phi - sc; a.phi += phi; a.sc += sc
    }
  }
  const tab = {}
  for (const [name, arr] of Object.entries(acc)) tab[name] = arr.map((a, q) => a.n ? { binM: `${bins[q][0]}-${bins[q][1]}`, n: a.n, model: +(a.phi / a.n).toFixed(3), SclaterChristie: +(a.sc / a.n).toFixed(3), diff: +(a.dPhi / a.n).toFixed(3) } : null).filter(Boolean)
  out('geology2', 'Miocene porosity at each cell\'s own depth vs Sclater & Christie (1980), mean per bin', tab)
}

// =============================================================================================
// 10. Saved scenario reopens with identical hashes (engine level; the UI path is in the browser run)
// =============================================================================================
if (run('scenario')) {
  const sf = await load('/src/app/scenarioFile.ts')
  const mkTm = (file) => {
    const tm = new E.tm.TimeMachine()
    const info = tm.run({ presetId: file.run.presetId, overrides: file.run.overrides }, file.run.seed)
    const ids = new Map([[file.branches[0].id, info.rootId]])
    for (const b of file.branches.slice(1)) ids.set(b.id, tm.branch(ids.get(b.parent), b.startStep, b.edits).id)
    return { tm, info, ids }
  }
  const src = { presetId: 'last3', seed: 7, nx: 150, dx: 1000, segments: segs3, overrides: { seaLevelKind: 'curve' },
    branches: [{ id: 'a', parentId: null, forkStep: 0, label: 'Main run', edits: {} }, { id: 'b', parentId: 'a', forkStep: 300, label: 'Branch', edits: { slShift: -50 } }] }
  const probe = buildScenarioFile0(src)
  function buildScenarioFile0(s) { return sf.buildScenarioFile(s) }
  const r1 = mkTm(probe)
  const h1 = {}
  for (const b of probe.branches) h1[b.id] = r1.tm.seek(r1.ids.get(b.id), r1.info.nSteps, ['sand'], true).hash
  const text = sf.serializeScenario(sf.buildScenarioFile(src, h1))
  const parsed = sf.parseScenario(text)
  check('scenario', 'file parses', parsed.ok, parsed.ok ? '' : parsed.message)
  const r2 = mkTm(parsed.file)
  const h2 = {}
  for (const b of parsed.file.branches) h2[b.id] = r2.tm.seek(r2.ids.get(b.id), r2.info.nSteps, ['sand'], true).hash
  const cmp = sf.compareHashes(parsed.file, h2, { nx: 150, dx: 1000 })
  out('scenario', 'hashes written / recomputed after reopening', [h1, h2])
  check('scenario', 'reopened scenario reproduces every stored hash', cmp.same, cmp.message ?? 'identical')
  check('scenario', 'branch hash differs from main hash (the edit did something)', h1.a !== h1.b, `${h1.a} vs ${h1.b}`)
  const tampered = text.replace('"slShift": -50', '"slShift": -49')
  const p3 = sf.parseScenario(tampered)
  const r3 = mkTm(p3.file); const h3 = {}
  for (const b of p3.file.branches) h3[b.id] = r3.tm.seek(r3.ids.get(b.id), r3.info.nSteps, ['sand'], true).hash
  check('scenario', 'a file edited after saving is detected (hash mismatch warning)', !sf.compareHashes(p3.file, h3, { nx: 150, dx: 1000 }).same, tampered === text ? 'text not changed!' : 'warning raised')
  for (const bad of ['', '{', '{"format":"x"}', JSON.stringify({ ...JSON.parse(text), version: 2 })]) {
    const pr = sf.parseScenario(bad)
    check('scenario', `malformed file refused: ${JSON.stringify(bad).slice(0, 30)}`, pr.ok === false, pr.ok ? 'ACCEPTED' : pr.message)
  }
}

// =============================================================================================
// 11. Licences of every installed package (production = react, react-dom and what they need)
// =============================================================================================
if (run('licences')) {
  const { readdirSync } = await import('node:fs')
  const nm = join(root, 'node_modules')
  const rows = []
  const walk = (dir, scope) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue
      const p = join(dir, name)
      if (name.startsWith('@')) { walk(p, name); continue }
      const pj = join(p, 'package.json')
      if (!existsSync(pj)) continue
      const j = JSON.parse(readFileSync(pj, 'utf8'))
      const lic = typeof j.license === 'string' ? j.license : j.license?.type ?? (j.licenses ? j.licenses.map((l) => l.type).join(' OR ') : 'UNKNOWN')
      rows.push({ name: scope ? `${scope}/${name}` : name, version: j.version, license: lic })
    }
  }
  walk(nm, '')
  const tally = {}
  for (const r of rows) tally[r.license] = (tally[r.license] ?? 0) + 1
  out('licences', 'installed packages', rows.length)
  out('licences', 'licence tally', tally)
  const permissive = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|Python-2\.0|CC0-1\.0|CC-BY-4\.0|Unlicense|MIT-0)$/
  const ok = (l) => l.replace(/[()]/g, '').split(/ OR | AND /).some((x) => permissive.test(x.trim()))
  const odd = rows.filter((r) => !ok(r.license))
  out('licences', 'not plain permissive (needs a look)', odd)
  const prodRoots = ['react', 'react-dom', 'scheduler']
  out('licences', 'production packages', rows.filter((r) => prodRoots.includes(r.name)))
  out('licences', 'all packages', rows.map((r) => `${r.name}@${r.version} ${r.license}`))
  check('licences', 'every installed package has a permissive licence (or an OR choice that includes one)', odd.length === 0, odd.map((r) => `${r.name} ${r.license}`).join('; ') || 'none odd')
}

// ---------------------------------------------------------------------------------------------
const failed = verdicts.filter((v) => !v.ok)
console.log(`\n${verdicts.length - failed.length}/${verdicts.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.section}: ${f.name}`)
const file = join(root, 'docs/reviews/m1-review-results.json')
let prev = {}
if (want.size && existsSync(file)) prev = JSON.parse(readFileSync(file, 'utf8'))
delete results.__longM
writeFileSync(file, JSON.stringify({ ...prev, ...results }, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v), 1) + '\n')
await server.close()
process.exit(failed.length ? 1 : 0)
