// M2.6 integrity review: independent checks of the M2 slope-failure / MTD engine.
//
// Run:   node scripts/review/m2-review.mjs [section ...]
// Sections: fs runout balance determinism parity speed geology licences (default: all)
//
// WHAT IS INDEPENDENT. Every "expected" value below is computed in this file from equations or
// from the raw record arrays:
//   fs          infinite-slope hand calculations (with excess pore pressure and cohesion) and a
//               column-by-column re-implementation of the search, written here from the raw
//               record (sand, mud, u, H), compared with computeStability.
//   runout      Bingham velocity by numerical integration of the shear profile; the final
//               length of a 2D Bingham slump on a flat bed from the closed-form Nye/Johnson
//               profile h dh/dx = -tau_y / (rho' g); a thin layer that must not move at all.
//   balance     per-grain-size solid totals summed (Neumaier) from the raw sand/mud arrays
//               before and after every failure step, and the whole-run balance rebuilt from the
//               supply history. The ledger is used only as the thing being checked.
//   determinism SHA-256 of the raw record bytes plus the event list, compared between a
//               straight run and random forward/backward seeks of the time machine.
//   parity      the spike 001 reference engine (golden), and the M1 code archived from main.
//   geology     a replay of the MTD-prone preset that re-computes the stability BEFORE each
//               failure step, and re-derives the trigger tag of every first event of a step.
// The engine under test is loaded only to be RUN (through Vite's SSR loader). No expected value
// comes from src/ and no helper from tests/ is used.
// Results go to docs/reviews/m2-review-results.json.

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { writeFileSync, existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const spike = createRequire(import.meta.url)(join(root, 'spikes/001-shelf-to-basin/engine.js'))
const want = new Set(process.argv.slice(2))
const run = (name) => want.size === 0 || want.has(name)

const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = (p) => server.ssrLoadModule(p)
const E = {
  step: await load('/src/engine/step.ts'),
  params: await load('/src/engine/engineParams.ts'),
  schedule: await load('/src/engine/schedule.ts'),
  sea: await load('/src/engine/sealevel.ts'),
  comp: await load('/src/engine/compaction.ts'),
  presets: await load('/src/engine/presets.ts'),
  stab: await load('/src/engine/stability.ts'),
  fail: await load('/src/engine/failure.ts'),
  runout: await load('/src/engine/runout.ts'),
  trig: await load('/src/engine/triggers.ts'),
  det: await load('/src/engine/determinism.ts'),
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
const DEG = Math.PI / 180
// physical constants restated here (not read from src/)
const g = 9.81, rhoS = 2650, rhoW = 1025
const SALT = 1 // record material code for salt (record.ts), restated

/** SHA-256 over the raw bytes of every used part of the record and the event list. */
function ownHash(eng) {
  const rec = eng.rec
  const h = createHash('sha256')
  const cells = rec.nLayers * rec.nx
  const f = (a, n) => h.update(Buffer.from(a.buffer, a.byteOffset, n * a.BYTES_PER_ELEMENT))
  h.update(`${rec.nx},${rec.dx},${rec.nLayers};`)
  f(rec.b, rec.nx); f(rec.H, rec.nx)
  for (const k of ['sand', 'mud', 'smax', 'u', 'tDep', 'cem', 'cemS']) f(rec[k], cells)
  f(rec.material, cells)
  f(rec.stepDt, rec.nLayers); f(rec.stepAgeMa, rec.nLayers)
  h.update(JSON.stringify(eng.events))
  return h.digest('hex').slice(0, 16)
}

function setup(presetId, overrides = {}) {
  const P = { ...E.presets.presetParams(presetId), ...overrides }
  const sch = E.presets.presetSchedule(presetId)
  const eng = E.step.createEngine(P, sch)
  const sea = E.sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  return { P, sch, eng, sea }
}
const runAll = (M, P = M.P) => { while (E.step.step(M.eng, P, M.sch, M.sea)) { /* run */ } }

// =============================================================================================
// 1. Factor of safety: hand calculations and an independent column search
// =============================================================================================
if (run('fs')) {
  const FS = E.stab.infiniteSlopeFS
  // Hand formula, written from the standard infinite-slope equation with excess pore pressure:
  //   FS = tan(phi)/tan(beta) (1 - ru) + c / (L sin(beta) cos(beta)),   ru = u / L
  const hand = (L, u, betaDeg, phiDeg, c) => {
    const b = betaDeg * DEG
    return (Math.tan(phiDeg * DEG) / Math.tan(b)) * (1 - u / L) + c / (L * Math.sin(b) * Math.cos(b))
  }
  const cases = [
    ['dry-hydrostatic sand slope, 6 deg, phi 33', 3e6, 0, 6, 33, 0],
    ['mud, 6 deg, phi 25, ru 0.5', 2e6, 1e6, 6, 25, 0],
    ['mud, 6 deg, phi 25, ru 0.75', 2e6, 1.5e6, 6, 25, 0],
    ['mud, 3 deg, phi 25, ru 0.9', 5e5, 4.5e5, 3, 25, 0],
    ['cohesive mud c 10 kPa, 4 deg, ru 0.3', 1e6, 3e5, 4, 25, 1e4],
    ['steep 20 deg sand, ru 0.1', 1e6, 1e5, 20, 33, 0],
    ['shallow slip surface (L 5 kPa), c 5 kPa, 1 deg', 5e3, 0, 1, 25, 5e3],
  ]
  let worst = 0
  const rows = []
  for (const [name, L, u, b, phi, c] of cases) {
    const eng = FS(L, u, b * DEG, Math.tan(phi * DEG), c)
    const exp = hand(L, u, b, phi, c)
    const rel = Math.abs(eng - exp) / exp
    worst = Math.max(worst, rel)
    rows.push({ name, engine: eng, hand: exp, rel })
  }
  out('fs', 'hand calculations (engine vs hand)', rows.map((r) => `${r.name}: ${r.engine.toFixed(6)} vs ${r.hand.toFixed(6)}`))
  check('fs', 'infiniteSlopeFS equals the hand formula in 7 cases (rel <= 1e-12)', worst <= 1e-12, `worst ${worst.toExponential(2)}`)
  // closed-form anchors
  const tanPhi = Math.tan(25 * DEG)
  check('fs', 'u = 0, c = 0: FS = tan(phi)/tan(beta) (6 deg, 25 deg = 4.4366)', Math.abs(FS(1e6, 0, 6 * DEG, tanPhi, 0) - Math.tan(25 * DEG) / Math.tan(6 * DEG)) < 1e-12, FS(1e6, 0, 6 * DEG, tanPhi, 0).toFixed(5))
  const ruCrit = 1 - Math.tan(6 * DEG) / Math.tan(25 * DEG)
  const below = FS(1e6, (ruCrit - 1e-6) * 1e6, 6 * DEG, tanPhi, 0), above = FS(1e6, (ruCrit + 1e-6) * 1e6, 6 * DEG, tanPhi, 0)
  check('fs', `FS crosses 1 at ru = 1 - tan(beta)/tan(phi) = ${ruCrit.toFixed(5)}`, below > 1 && above < 1 && Math.abs(below - 1) < 1e-5, `FS ${below.toFixed(6)} / ${above.toFixed(6)}`)
  check('fs', 'flat seafloor gives Infinity (nothing drives sliding)', FS(1e6, 0, 0, tanPhi, 0) === Infinity, '')
  check('fs', 'u above the load is clipped to zero effective stress (FS = c-term only)', FS(1e6, 2e6, 6 * DEG, tanPhi, 0) === 0, `${FS(1e6, 2e6, 6 * DEG, tanPhi, 0)}`)

  // independent re-implementation of the whole search, from the raw record (failure OFF so FS < 1 columns survive)
  const M = setup('mtd', { failOn: 0 })
  const P = M.P
  const tanS = Math.tan(P.phiFric[0] * DEG), tanM = Math.tan(P.phiFric[1] * DEG)
  const myFS = (eng, j, minSlope, minDepth, maxDepth) => {
    const rec = eng.rec, nx = rec.nx
    const a = j > 0 ? j - 1 : j, b = j < nx - 1 ? j + 1 : j
    const tanB = Math.abs((rec.H[b] - rec.H[a]) / ((b - a) * rec.dx))
    if (!(tanB > minSlope)) return { fs: Infinity, layer: -1 }
    const beta = Math.atan(tanB)
    let above = 0, depth = 0, best = Infinity, bestL = -1
    for (let l = rec.nLayers - 1; l >= 0; l--) {
      const i = l * nx + j
      const s = rec.sand[i] + rec.mud[i]
      if (s <= 0) continue
      const bulk = rec.material[i] === SALT ? s : E.comp.cellBulk(eng, P, i) // thickness: engine porosity cache (not independent)
      if (bulk <= 0) continue
      const mid = depth + 0.5 * bulk
      if (mid > maxDepth) break
      depth += bulk
      if (rec.material[i] === SALT) continue
      if (s <= 1e-9) continue
      const L = g * (rhoS - rhoW) * (above + 0.5 * s)
      above += s
      if (mid < minDepth) continue
      const fsand = rec.sand[i] / s
      const tp = fsand * tanS + (1 - fsand) * tanM
      const c = fsand * P.cohesion[0] + (1 - fsand) * P.cohesion[1]
      const fs = (c + (L - rec.u[i]) * Math.cos(beta) ** 2 * tp) / (L * Math.sin(beta) * Math.cos(beta))
      if (fs < best) { best = fs; bestL = l }
    }
    return { fs: best, layer: bestL }
  }
  let nCols = 0, worstRel = 0, layerMismatch = 0, nUnstable = 0, nFinite = 0, nSnap = 0, nUnstableSnap = 0
  const minFS = []
  const minSlope = Math.tan(P.failSlopeMin * DEG)
  while (E.step.step(M.eng, P, M.sch, M.sea)) {
    const k = M.eng.diag.stepIndex
    const st = E.stab.computeStability(M.eng, P, { minSlope, minDepth: P.failMinDepth })
    let anyBelow = false
    for (let j = 0; j < M.eng.rec.nx; j++) if (st.fsMin[j] < 1) anyBelow = true
    // check every 25th step, and every step in which some column is below 1 (up to 40 of them)
    if (!(k % 25 === 0 || (anyBelow && nUnstableSnap < 40))) continue
    nSnap++
    if (anyBelow) nUnstableSnap++
    let lo = Infinity
    for (let j = 0; j < M.eng.rec.nx; j++) {
      const mine = myFS(M.eng, j, minSlope, P.failMinDepth, P.stabMaxDepth)
      nCols++
      if (mine.fs === Infinity && st.fsMin[j] === Infinity) continue
      nFinite++
      const rel = mine.fs === st.fsMin[j] ? 0 : Math.abs(mine.fs - st.fsMin[j]) / Math.max(Math.abs(mine.fs), 1e-12)
      worstRel = Math.max(worstRel, rel)
      if (mine.layer !== st.critLayer[j]) layerMismatch++
      if (mine.fs < 1) nUnstable++
      lo = Math.min(lo, mine.fs)
    }
    if (anyBelow && minFS.length < 6) minFS.push(`step ${k}: min FS ${lo.toFixed(3)}`)
  }
  out('fs', 'independent search vs computeStability (MTD preset, failure OFF; every 25th step and the first 40 steps with a column below FS 1)', { snapshots: nSnap, unstableSnapshots: nUnstableSnap, columns: nCols, finite: nFinite, unstableCells: nUnstable, worstRel, layerMismatch, minFS })
  check('fs', 'column search recomputed from the raw record equals computeStability (rel <= 1e-9, same critical layer)', worstRel <= 1e-9 && layerMismatch === 0 && nFinite > 100, `${nFinite} finite columns, worst rel ${worstRel.toExponential(2)}, ${layerMismatch} layer mismatches`)
  check('fs', 'the snapshots contain columns with FS < 1 (so the test reaches the failure region)', nUnstable > 0, `${nUnstable} columns`)
}

// =============================================================================================
// 2. Run-out: analytic benchmarks
// =============================================================================================
if (run('runout')) {
  const R = E.runout
  const rhoF = 1800, rhoP = rhoF - rhoW, tauY = 500, mu = 1000
  // (a) Bingham mean velocity vs numerical integral of the shear profile (own integration, Simpson)
  const numMean = (tauB, h) => {
    const N = 20000, dz = h / N
    // u(z) = int_0^z max(tauB (1 - s/h) - tauY, 0)/mu ds ; mean = (1/h) int u dz  (cumulative trapezoid)
    let u = 0, sum = 0, prev = 0
    for (let i = 1; i <= N; i++) {
      const z = i * dz, zm = z - 0.5 * dz
      u += (Math.max(tauB * (1 - zm / h) - tauY, 0) / mu) * dz
      sum += 0.5 * (prev + u) * dz
      prev = u
    }
    return sum / h
  }
  let worst = 0
  for (const [tb, h] of [[1986, 5], [3000, 12], [800, 3], [40000, 30], [650, 20]]) {
    const a = R.binghamMeanVelocity(tb, h, tauY, mu), b = numMean(tb, h)
    worst = Math.max(worst, Math.abs(a - b) / b)
  }
  check('runout', 'Bingham depth-mean velocity vs own numerical integral of the shear profile (5 cases, < 1e-3)', worst < 1e-3, `worst ${worst.toExponential(2)}`)

  // (b) steady uniform flow on a constant slope: interior blocks of a long chain reach U = U_Bingham(tauB = rho' g h sin)
  {
    const theta = 3 * DEG, tn = Math.tan(theta), h0 = 8, dx = 1000, nx = 600
    const bed = new Float64Array(nx)
    for (let j = 0; j < nx; j++) bed[j] = -tn * (j + 0.5) * dx
    const nb = 60, len = 200
    const edges = [], area = []
    for (let i = 0; i <= nb; i++) edges.push(50000 + i * len)
    // a uniform sheet of FLOW thickness h0 measured along the slope: area = h0 * len / cos(theta)
    for (let i = 0; i < nb; i++) area.push(h0 * (len / Math.cos(theta)))
    const r = R.runOut({ edges, area, bed, dx, xMax: nx * dx, rhoFlow: rhoF, rhoWater: rhoW, tauY, mu, tMax: 400 })
    const tauB = rhoP * g * h0 * Math.sin(theta)
    const uExp = numMean(tauB, h0)
    const mid = 30
    const uMid = r.velocity[mid]
    out('runout', 'uniform flow (3 deg, h 8 m, tau_y 500 Pa, mu 1000 Pa s)', { tauB_hand: tauB, plug_hand_m: (tauY / tauB) * h0, U_integral: uExp, U_engine_midblock: uMid, tauB_engine: r.tauB[mid], steps: r.steps })
    check('runout', 'uniform flow: mid-chain block velocity within 1 % of the numerically integrated Bingham velocity', Math.abs(uMid - uExp) / uExp < 0.01, `${uMid.toFixed(5)} vs ${uExp.toFixed(5)} m/s`)
    check('runout', 'uniform flow: bed stress equals rho\' g h sin(theta) within 1 %', Math.abs(r.tauB[mid] - tauB) / tauB < 0.01, `${r.tauB[mid].toFixed(1)} vs ${tauB.toFixed(1)} Pa`)
  }

  // (c) a layer thinner than the plug thickness h_p = tau_y/(rho' g sin) does not move at all
  {
    const theta = 3 * DEG, tn = Math.tan(theta), dx = 1000, nx = 300
    const bed = new Float64Array(nx)
    for (let j = 0; j < nx; j++) bed[j] = -tn * (j + 0.5) * dx
    const hp = tauY / (rhoP * g * Math.sin(theta)) // hand: plug thickness
    const nb = 20, len = 300, edges = [], area = []
    for (let i = 0; i <= nb; i++) edges.push(20000 + i * len)
    for (let i = 0; i < nb; i++) area.push(0.9 * hp * (len / Math.cos(theta)))
    const r = R.runOut({ edges, area, bed, dx, xMax: nx * dx, rhoFlow: rhoF, rhoWater: rhoW, tauY, mu, tMax: 3600 })
    const moved = Math.abs(r.edges[0] - 20000) + Math.abs(r.edges[nb] - (20000 + nb * len))
    // the free ends of a finite chain slump too, so allow the chain to creep a little at its two ends but not as a flow
    out('runout', 'thin layer (0.9 h_p) at rest', { h_p_hand_m: hp, edgeMovement_m: moved, stopped: r.stopped, time_s: r.time })
    check('runout', 'a layer 0.9 x the plug thickness stays put on a 3 deg slope (edge movement < 5 m)', moved < 5 && r.stopped, `h_p = ${hp.toFixed(2)} m, moved ${moved.toFixed(2)} m`)
    const area2 = []
    for (let i = 0; i < nb; i++) area2.push(3 * hp * (len / Math.cos(theta)))
    const r2 = R.runOut({ edges, area: area2, bed, dx, xMax: nx * dx, rhoFlow: rhoF, rhoWater: rhoW, tauY, mu, tMax: 600 })
    check('runout', 'a layer 3 x the plug thickness does flow', Math.max(...r2.velocity.map(Math.abs)) > 0.01, `max U ${Math.max(...r2.velocity.map(Math.abs)).toFixed(3)} m/s`)
  }

  // (d) 2D Bingham slump on a flat bed: final extent from the closed-form profile.
  //     Equilibrium: rho' g h dh/dx = -tau_y  =>  h(s)^2 = 2 tau_y s/(rho' g), s = distance from the front.
  //     Each half (area A/2) is a dome of half-length Lh with A/2 = (2/3) sqrt(2 tau_y/(rho' g)) Lh^(3/2).
  {
    const dx = 1000, nx = 600
    const bed = new Float64Array(nx) // flat
    const A = 4000 * 20 // 4 km long, 20 m thick block, m^2
    for (const nb of [40, 80]) {
      const w0 = 4000, x0 = 300000
      const edges = [], area = []
      for (let i = 0; i <= nb; i++) edges.push(x0 + (i * w0) / nb)
      for (let i = 0; i < nb; i++) area.push(A / nb)
      const r = R.runOut({ edges, area, bed, dx, xMax: nx * dx, rhoFlow: rhoF, rhoWater: rhoW, tauY, mu })
      const c = (2 * tauY) / (rhoP * g)
      const Lh = Math.pow((3 * (A / 2)) / (2 * Math.sqrt(c)), 2 / 3)
      const Lexp = 2 * Lh
      const Lgot = r.edges[nb] - r.edges[0]
      // area is conserved by construction: sum h ds over final blocks
      out('runout', `flat-bed Bingham slump, ${nb} blocks`, { stopped: r.stopped, time_h: r.time / 3600, final_length_m: Lgot, analytic_length_m: Lexp, ratio: Lgot / Lexp, steps: r.steps })
      check('runout', `flat-bed slump (${nb} blocks): final length within 8 % of the closed-form Nye profile, and it stops`, r.stopped && Math.abs(Lgot / Lexp - 1) < 0.08, `${Lgot.toFixed(0)} vs ${Lexp.toFixed(0)} m (ratio ${(Lgot / Lexp).toFixed(3)})`)
    }
  }
}

// =============================================================================================
// 3. Mass balance through failures, from the raw record
// =============================================================================================
const livingSolids = (rec) => { // sand and mud (non-salt cells) summed from the raw arrays
  const n = rec.nLayers * rec.nx
  const sA = [], mA = [], cA = []
  for (let i = 0; i < n; i++) {
    if (rec.material[i] === SALT) continue
    sA.push(rec.sand[i]); mA.push(rec.mud[i]); cA.push(rec.cem[i])
  }
  return { sand: nsum(sA) * rec.dx, mud: nsum(mA) * rec.dx, cem: nsum(cA) * rec.dx }
}

/** Replay a preset with failure applied by hand after each step: lets us look BEFORE and AFTER every failure step. */
function replay(presetId, overrides, onStep) {
  const M = setup(presetId, { ...overrides, failOn: 1 })
  const P0 = { ...M.P, failOn: 0 }
  const opt = { minSlope: Math.tan(M.P.failSlopeMin * DEG), minDepth: M.P.failMinDepth }
  while (E.step.step(M.eng, P0, M.sch, M.sea)) {
    const k = M.eng.diag.stepIndex - 1
    const ctx = { M, k, opt, nBefore: M.eng.events.length }
    if (onStep.before) onStep.before(ctx)
    E.fail.failureStep(M.eng, M.P, k, M.sch.tEndYr[k], M.sch.stepAgeMa[k], M.sea)
    if (onStep.after) onStep.after(ctx)
  }
  return M
}

if (run('balance')) {
  for (const [label, id, ov] of [['MTD-prone preset', 'mtd', {}], ['MTD preset, weak sand+mud (phi 22/18, mud-rich)', 'mtd', { phiFric: [22, 18], sandFrac: 0.2 }], ['default preset with failure on', 'last3', { failOn: 1 }]]) {
    let before = null, colBefore = null, moved = 0
    const colTotals = (rec) => { const t = new Float64Array(rec.nx); for (let l = 0; l < rec.nLayers; l++) for (let j = 0; j < rec.nx; j++) { const i = l * rec.nx + j; if (rec.material[i] !== SALT) t[j] += rec.sand[i] + rec.mud[i] } return t }
    let worstSand = 0, worstMud = 0, worstAll = 0, nEventSteps = 0, worstEventRel = 0, worstEventExpRel = 0
    let cumOutBefore = null
    const M = replay(id, ov, {
      before: ({ M }) => { before = livingSolids(M.eng.rec); colBefore = colTotals(M.eng.rec); const l = M.eng.rec.ledger.cumOut; cumOutBefore = { sand: l.sand, mud: l.mud, cement: l.cement } },
      after: ({ M, nBefore }) => {
        if (M.eng.events.length === nBefore) return
        nEventSteps++
        // control: the failure really moved solids between columns (so a zero error is not a no-op)
        const colAfter = colTotals(M.eng.rec)
        let mv = 0
        for (let j = 0; j < colAfter.length; j++) mv += Math.abs(colAfter[j] - colBefore[j])
        moved += mv * M.eng.rec.dx / 2
        const a = livingSolids(M.eng.rec), l = M.eng.rec.ledger.cumOut
        const dOutSand = l.sand - cumOutBefore.sand, dOutMud = l.mud - cumOutBefore.mud
        const ev = M.eng.events.slice(nBefore)
        const released = { sand: nsum(ev.map((e) => e.sand)), mud: nsum(ev.map((e) => e.mud)) }
        // the stored total must change by exactly minus what left the section
        const errSand = (a.sand - before.sand) + dOutSand
        const errMud = (a.mud - before.mud) + dOutMud
        const errCem = (a.cem - before.cem) + (l.cement - cumOutBefore.cement)
        worstSand = Math.max(worstSand, Math.abs(errSand) / before.sand)
        worstMud = Math.max(worstMud, Math.abs(errMud) / before.mud)
        worstAll = Math.max(worstAll, Math.abs(errSand + errMud) / (before.sand + before.mud), Math.abs(errCem) / Math.max(1, before.sand))
        // the events' own bookkeeping: released = deposited + exported, per event and grain size
        for (const e of ev) {
          worstEventRel = Math.max(worstEventRel,
            Math.abs(e.sand - e.depositedSand - e.exportedSand) / Math.max(e.sand, 1e-30),
            Math.abs(e.mud - e.depositedMud - e.exportedMud) / Math.max(e.mud, 1e-30))
        }
        // exported by the events (by their own account) must match the ledger change
        const expSand = nsum(ev.map((e) => e.exportedSand)), expMud = nsum(ev.map((e) => e.exportedMud))
        worstEventExpRel = Math.max(worstEventExpRel, Math.abs(expSand - dOutSand) / Math.max(released.sand, 1e-30), Math.abs(expMud - dOutMud) / Math.max(released.mud, 1e-30))
      },
    })
    const nEv = M.eng.events.length
    out('balance', `${label}: events / steps with events`, [nEv, nEventSteps])
    out('balance', `${label}: worst per-step solid-balance error (sand, mud, all) relative to the stored total`, [worstSand, worstMud, worstAll])
    out('balance', `${label}: solid area moved sideways between columns by failures, summed over steps (m^2) - control that the zero error is not a no-op`, moved)
    if (nEv > 0) {
      check('balance', `${label}: failures moved solids (control)`, moved > 0, `${moved.toFixed(0)} m^2`)
      check('balance', `${label}: sand balance across every failure step < 1e-9 (raw arrays)`, worstSand < 1e-9, worstSand.toExponential(2))
      check('balance', `${label}: mud balance across every failure step < 1e-9 (raw arrays)`, worstMud < 1e-9, worstMud.toExponential(2))
      check('balance', `${label}: per-event released = deposited + exported < 1e-9 (sand and mud)`, worstEventRel < 1e-9, worstEventRel.toExponential(2))
      check('balance', `${label}: events' exported solids equal the ledger's cumOut change`, worstEventExpRel < 1e-9, worstEventExpRel.toExponential(2))
    } else {
      out('balance', `${label}`, 'no failure events: the per-step checks are vacuous here (this preset does not fail)')
    }
    // whole-run balance: stored = init + in - out, with out taken from the ledger (what is being checked)
    const rec = M.eng.rec, P = M.P
    const st = livingSolids(rec)
    const f = 0.3, smax0 = 20e6
    const ph = (i, s) => P.phi0[i] * Math.exp(-P.beta[i] * s)
    const e = (i, s) => ph(i, s) / (1 - ph(i, s))
    const solid0 = 200 / (1 + f * e(0, smax0) + (1 - f) * e(1, smax0))
    const initSand = rec.nx * f * solid0 * rec.dx, initMud = rec.nx * (1 - f) * solid0 * rec.dx
    let years = 0
    for (let s = 0; s < M.eng.diag.stepIndex; s++) years += M.sch.stepDt[s]
    const inSand = P.supply * P.sandFrac * years, inMud = P.supply * (1 - P.sandFrac) * years
    const led = rec.ledger
    const relSand = (initSand + inSand - st.sand - led.cumOut.sand) / (inSand + inMud)
    const relMud = (initMud + inMud - st.mud - led.cumOut.mud) / (inSand + inMud)
    out('balance', `${label}: whole-run residual (sand, mud) / total supply`, [relSand, relMud])
    check('balance', `${label}: whole run: stored + out = initial + supply x time, sand and mud separately < 1e-9`, Math.abs(relSand) < 1e-9 && Math.abs(relMud) < 1e-9, `${relSand.toExponential(2)}, ${relMud.toExponential(2)}`)
    // no empty MTD cells; all MTD cells hold sediment
    let mtdCells = 0, bad = 0
    for (let i = 0; i < rec.nLayers * rec.nx; i++) if (rec.material[i] === 2) { mtdCells++; if (!(rec.sand[i] + rec.mud[i] > 0)) bad++ }
    out('balance', `${label}: MTD-tagged cells / of which emptied by later erosion but still tagged MTD (zero thickness, harmless)`, [mtdCells, bad])
    // overpressure sanity after failures: u within [-L, L]? report most negative lambda*
    let minLam = 0, maxLam = 0
    for (let l = rec.nLayers - 1; l >= 0; l--) for (let j = 0; j < rec.nx; j++) {
      const i = l * rec.nx + j
      const L = M.eng.ld[i]
      if (L > 0 && rec.material[i] !== SALT) { const lam = rec.u[i] / L; if (lam < minLam) minLam = lam; if (lam > maxLam) maxLam = lam }
    }
    out('balance', `${label}: lambda* range in the final record (min, max)`, [minLam, maxLam])
  }
}

// =============================================================================================
// 4. Determinism: rewind across failure events
// =============================================================================================
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }

if (run('determinism')) {
  const presetId = 'mtd'
  const M = setup(presetId)
  const nSteps = M.sch.nSteps
  // straight run, record the hash after every step that matters
  const hashes = new Map(), appHashes = new Map(), evN = new Map()
  const evSteps = []
  const rnd = lcg(20261015)
  const picks = new Set([nSteps, 1, 2])
  while (E.step.step(M.eng, M.P, M.sch, M.sea)) {
    const k = M.eng.diag.stepIndex
    const n = M.eng.events.length
    if (n > (evN.get('last') ?? 0) && !evSteps.includes(k)) evSteps.push(k)
    evN.set('last', n)
  }
  for (const k of evSteps) { picks.add(k); picks.add(k - 1); picks.add(k + 1) }
  while (picks.size < evSteps.length * 3 + 12) picks.add(1 + Math.floor(rnd() * nSteps))
  const pickList = [...picks].filter((k) => k >= 1 && k <= nSteps).sort((a, b) => a - b)
  // second straight run, with hashing at the picks
  const S1 = setup(presetId)
  while (E.step.step(S1.eng, S1.P, S1.sch, S1.sea)) {
    const k = S1.eng.diag.stepIndex
    if (picks.has(k)) { hashes.set(k, ownHash(S1.eng)); appHashes.set(k, E.det.stateHash(S1.eng.rec)) }
  }
  const S2 = setup(presetId)
  let repeat = true
  while (E.step.step(S2.eng, S2.P, S2.sch, S2.sea)) { const k = S2.eng.diag.stepIndex; if (picks.has(k) && ownHash(S2.eng) !== hashes.get(k)) repeat = false }
  out('determinism', 'steps with failure events', evSteps)
  check('determinism', `MTD preset: a second straight run repeats bit for bit at ${pickList.length} steps (raw record + events)`, repeat, '')

  const tm = new E.tm.TimeMachine()
  const info = tm.run({ presetId, overrides: {} }, 7)
  const order = pickList.slice().sort(() => rnd() - 0.5)
  let badApp = 0, badEv = 0
  const evEnd = JSON.stringify(S1.eng.events)
  for (const k of order) {
    const v = tm.seek(info.rootId, k, ['sand'], true)
    if (v.hash !== appHashes.get(k)) badApp++
    const ev = tm.eventsAt(info.rootId, k)
    // events up to step k from the straight run (steps are 0-based in events: ev.step < k)
    const exp = JSON.stringify(S1.eng.events.filter((e) => e.step < k))
    if (JSON.stringify(ev) !== exp) badEv++
  }
  // own sha256 of the time machine's engine at the final step (via a seek to the end) vs straight run
  const vEnd = tm.seek(info.rootId, nSteps, ['sand'], true)
  check('determinism', `${order.length} random forward/backward seeks (incl. every event step and its neighbours): record hash equals the straight run`, badApp === 0, `${badApp} mismatches`)
  check('determinism', 'the event list at every seek equals the straight run\'s events up to that step', badEv === 0, `${badEv} mismatches`)
  check('determinism', 'seek to the end gives the straight run\'s final hash', vEnd.hash === appHashes.get(nSteps), `${vEnd.hash}`)
  check('determinism', 'the full event list is identical after the seeks', JSON.stringify(tm.eventsAt(info.rootId, nSteps)) === evEnd, `${S1.eng.events.length} events`)
  out('determinism', 'summary', { picks: order.length, eventSteps: evSteps.length, events: S1.eng.events.length, finalHash: appHashes.get(nSteps) })

  // a keyframe restore inside a multi-event step: hash of the engine restored from a snapshot taken BEFORE the step
  const S3 = setup(presetId)
  const kEv = evSteps.find((k) => S3.eng.events.length >= 0 && k > 300) ?? evSteps[0]
  while (S3.eng.diag.stepIndex < kEv - 3) E.step.step(S3.eng, S3.P, S3.sch, S3.sea)
  const snap = E.step.snapshotEngine(S3.eng)
  E.step.step(S3.eng, S3.P, S3.sch, S3.sea); E.step.step(S3.eng, S3.P, S3.sch, S3.sea); E.step.step(S3.eng, S3.P, S3.sch, S3.sea)
  const h1 = ownHash(S3.eng)
  E.step.restoreEngine(snap, S3.eng, S3.P)
  for (let i = 0; i < 3; i++) E.step.step(S3.eng, S3.P, S3.sch, S3.sea)
  check('determinism', `snapshot just before event step ${kEv}, restore, replay 3 steps: bit-identical (record + events)`, ownHash(S3.eng) === h1, '')

  // static scan of src/engine for clocks and random numbers
  const { readdirSync } = await import('node:fs')
  const hits = []
  const walkDir = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walkDir(p); else if (/\.ts$/.test(f.name)) { const txt = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); for (const m of txt.matchAll(/Math\.random|Date\.now|performance\.now|new Date\(|crypto\.getRandomValues/g)) hits.push(`${p.replace(root, '')}: ${m[0]}`) } } }
  walkDir(join(root, 'src/engine'))
  check('determinism', 'no Math.random / Date.now / performance.now / new Date in src/engine (comments excluded below)', hits.length === 0, hits.join('; ') || 'none')
}

// =============================================================================================
// 5. Parity with failure OFF: spike 001 golden, and the M1 code archived from main
// =============================================================================================
if (run('parity')) {
  const SINE = { seaLevelKind: 'sine' }
  const sp = spike.createState(spike.defaultParams())
  while (spike.step(sp, spike.defaultParams())) { /* run */ }
  const mp = { ...E.params.defaultEngineParams(), ...SINE }
  check('parity', 'failure is OFF in the registry defaults', E.params.defaultEngineParams().failOn === 0, `failOn ${E.params.defaultEngineParams().failOn}`)
  const sch = E.schedule.buildSchedule([{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }])
  const eng = E.step.createEngine(mp, sch), sea = E.sea.makeSeaLevel(mp, sch.startAgeMa * 1e6)
  while (E.step.step(eng, mp, sch, sea)) { /* run */ }
  const rec = eng.rec, nx = rec.nx
  let dH = 0, dCell = 0, dU = 0
  for (let j = 0; j < nx; j++) dH = Math.max(dH, Math.abs(sp.H[j] - rec.H[j]))
  for (let i = 0; i < (sp.k + 1) * nx; i++) { dCell = Math.max(dCell, Math.abs(sp.sand[i] - rec.sand[i]), Math.abs(sp.mud[i] - rec.mud[i])); dU = Math.max(dU, Math.abs(sp.u[i] - rec.u[i])) }
  out('parity', 'spike 001 vs M2 (failure off, sine curve): max |dH| m, max per-cell |d solid| m, max |du| Pa', [dH, dCell, dU])
  check('parity', 'M2 with failure off reproduces spike 001 (H within 0.01 m, solids within 1e-6 m)', dH <= 0.01 && dCell <= 1e-6, `dH ${dH}, dCell ${dCell}, du ${dU}`)
  check('parity', 'no events, empty history cost: failure off records no events', eng.events.length === 0, `${eng.events.length}`)

  // M1 on main, executed from an archive of main's src/ (bit-for-bit comparison of the whole record)
  try {
    const tmp = mkdtempSync(join(process.env.TMPDIR ?? process.env.TEMP ?? root, 'm1src-'))
    execSync(`git archive main src | tar -x -C "${tmp}"`, { cwd: root, shell: 'bash', stdio: 'pipe' })
    const url = (f) => '/@fs/' + join(tmp, 'src/engine', f).replace(/\\/g, '/')
    const M1 = { step: await load(url('step.ts')), params: await load(url('engineParams.ts')), schedule: await load(url('schedule.ts')), sea: await load(url('sealevel.ts')), presets: await load(url('presets.ts')) }
    const hashM1 = (id, mod) => {
      const P = mod.presets.presetParams(id), s = mod.presets.presetSchedule(id)
      const e = mod.step.createEngine(P, s), sl = mod.sea.makeSeaLevel(P, s.startAgeMa * 1e6)
      while (mod.step.step(e, P, s, sl)) { /* run */ }
      const h = createHash('sha256'); const rr = e.rec; const cells = rr.nLayers * rr.nx
      const f = (a, n) => h.update(Buffer.from(a.buffer, a.byteOffset, n * a.BYTES_PER_ELEMENT))
      f(rr.b, rr.nx); f(rr.H, rr.nx)
      for (const k of ['sand', 'mud', 'smax', 'u', 'tDep', 'cem', 'cemS']) f(rr[k], cells)
      f(rr.material, cells)
      return h.digest('hex').slice(0, 16)
    }
    const MM = { step: E.step, params: E.params, schedule: E.schedule, sea: E.sea, presets: E.presets }
    for (const id of ['last3', 'miocene']) {
      const a = hashM1(id, M1), b = hashM1(id, MM)
      out('parity', `${id}: sha256 of the final record, M1 (main) vs M2 with failure off`, [a, b])
      check('parity', `${id}: final record bit-identical to M1 on main (failure off)`, a === b, `${a} vs ${b}`)
    }
  } catch (err) {
    out('parity', 'M1 archive comparison failed to run', String(err).slice(0, 300))
    check('parity', 'M1 archive comparison could run', false, String(err).slice(0, 120))
  }
}

// =============================================================================================
// 6. Speed on every preset, failure off vs on
// =============================================================================================
if (run('speed')) {
  const rows = []
  for (const id of ['last3', 'miocene', 'cenozoic', 'mtd']) {
    const time = (failOn) => {
      const M = setup(id, { failOn })
      const t0 = ms(); runAll(M); return { ms: ms() - t0, events: M.eng.events.length, unresolved: M.eng.diag.failUnresolved }
    }
    const reps = id === 'cenozoic' ? 1 : 2
    const offs = [], ons = []
    let ev = 0, unres = 0
    for (let r = 0; r < reps; r++) { offs.push(time(0).ms); const o = time(1); ons.push(o.ms); ev = o.events; unres = o.unresolved }
    const off = Math.min(...offs), on = Math.min(...ons)
    rows.push({ preset: id, offMs: Math.round(off), onMs: Math.round(on), overheadPct: Math.round((100 * (on - off)) / off), events: ev, unresolved: unres })
  }
  out('speed', 'preset: failure off ms, failure on ms, overhead %, events with failure on, unresolved', rows)
  const long = rows.filter((r) => r.preset === 'miocene' || r.preset === 'cenozoic')
  check('speed', 'M2.3 speed budget (<= 15 % extra time with failure on) on the 3 Myr preset', rows.find((r) => r.preset === 'last3').overheadPct <= 15, `${rows.find((r) => r.preset === 'last3').overheadPct} %`)
  check('speed', 'M2.3 speed budget (<= 15 % extra) on Miocene and Cenozoic (known miss, documented in handover)', long.every((r) => r.overheadPct <= 15), long.map((r) => `${r.preset} +${r.overheadPct} %`).join(', '))
  check('speed', 'every preset finishes in under 60 s of wall clock with failure on', rows.every((r) => r.onMs < 60000), rows.map((r) => `${r.preset} ${r.onMs} ms`).join(', '))
}

// =============================================================================================
// 7. Geology of the MTD-prone preset (and the default), tag check
// =============================================================================================
if (run('geology')) {
  const events = []
  const post = [] // end-of-step slope and ru (after failure), per step, for the tag re-derivation
  let pre = null
  let seaFall = 0, nStepsTotal = 0
  const lam = (eng, st, j) => (st.critLayer[j] >= 0 ? st.ru[j] : NaN)
  const M = replay('mtd', {}, {
    before: ({ M, opt }) => { pre = E.stab.computeStability(M.eng, M.P, opt) },
    after: ({ M, k, opt, nBefore }) => {
      const eng = M.eng, rec = eng.rec, nx = rec.nx
      const aft = E.stab.computeStability(eng, M.P, opt)
      post[k] = { slope: Float64Array.from(aft.slope), ru: Float64Array.from(Array.from({ length: nx }, (_, j) => lam(eng, aft, j))) }
      const tNow = M.sch.tEndYr[k]
      nStepsTotal++
      if (k >= 4 && M.sea(tNow) - M.sea(M.sch.tEndYr[k - 4]) <= -M.P.failLowstandDrop) seaFall++
      if (eng.events.length === nBefore) return
      const e0 = eng.events[nBefore]
      // pre-failure profile of the first failure in the step
      const seed = e0.seedColumn
      let maxRu = -1, maxRuCol = -1, nSearched = 0, rank = 1
      for (let j = 0; j < nx; j++) if (pre.critLayer[j] >= 0) { nSearched++; if (pre.ru[j] > maxRu) { maxRu = pre.ru[j]; maxRuCol = j } }
      for (let j = 0; j < nx; j++) if (pre.critLayer[j] >= 0 && pre.ru[j] > pre.ru[seed]) rank++
      // slope maximum and the column where the slope first exceeds 1 deg (top of the slope)
      let maxSlopeCol = 0
      for (let j = 0; j < nx; j++) if (pre.slope[j] > pre.slope[maxSlopeCol]) maxSlopeCol = j
      events.push({
        id: e0.id, step: k, ageMa: e0.ageMa, nInStep: eng.events.length - nBefore,
        seed, shelfEdge: eng.diag.shelfEdge, shore: eng.diag.shore, seedMinusEdgeKm: seed - eng.diag.shelfEdge,
        slopeDeg: Math.atan(pre.slope[seed]) / DEG, fs: pre.fsMin[seed], ruSeed: pre.ru[seed], critDepthM: pre.critDepth[seed],
        waterDepthM: -rec.H[seed], maxRu, maxRuCol, ruRank: rank, nSearched, maxSlopeCol, maxSlopeDeg: Math.atan(pre.slope[maxSlopeCol]) / DEG,
        preK: JSON.parse(JSON.stringify({ tanNow: pre.slope[seed], ruNow: pre.critLayer[seed] >= 0 ? pre.ru[seed] : NaN })),
      })
    },
  })
  const ev = M.eng.events
  out('geology', 'preset events / steps with events / unresolved failures', [ev.length, events.length, M.eng.diag.failUnresolved])
  check('geology', 'the manual replay (step with failure off + failureStep) gives the same event list as the engine run', JSON.stringify(ev) === JSON.stringify(setup('mtd') && (() => { const S = setup('mtd'); runAll(S); return S.eng.events })()), `${ev.length} events`)

  // per-event table
  const table = ev.map((e) => ({
    id: e.id, ageMa: +e.ageMa.toFixed(3), cause: e.cause, srcKm: e.sourceFrom === e.sourceTo ? `${e.sourceFrom}` : `${e.sourceFrom}-${e.sourceTo}`,
    scarFt: Math.round(e.scarDepth * 3.28084), volKm2: +(e.volume / 1e6).toFixed(3), runoutKm: +(e.runout / 1e3).toFixed(1),
    dSlope: +e.dSlope.toFixed(2), dPress: +e.dPress.toFixed(2), dSeaM: +e.dSeaLevel.toFixed(1), loadRate_mPerKyr: +(e.loadRate * 1e3).toFixed(2),
    exportedPct: +((100 * (e.exportedSand + e.exportedMud)) / (e.sand + e.mud)).toFixed(1),
  }))
  out('geology', 'event table', table)

  // (1) where do failures start? relative to the shelf edge and to the maximum-ru column
  out('geology', 'first event of each step: seed column, shelf edge, seed-edge (km), slope (deg), ru at seed, max ru in slope zone and where, rank of seed by ru',
    events.map((e) => `#${e.id} step ${e.step} seed ${e.seed} edge ${e.shelfEdge} (${e.seedMinusEdgeKm >= 0 ? '+' : ''}${e.seedMinusEdgeKm}) slope ${e.slopeDeg.toFixed(2)} ru ${e.ruSeed.toFixed(3)} max-ru ${e.maxRu.toFixed(3)}@${e.maxRuCol} rank ${e.ruRank}/${e.nSearched} depth ${(e.critDepthM * 3.28084).toFixed(0)} ft water ${(e.waterDepthM * 3.28084).toFixed(0)} ft`))
  const seedRu = events.map((e) => e.ruSeed).sort((a, b) => a - b)
  out('geology', 'ru at the seed of the failing column (min, median, max)', [seedRu[0], seedRu[Math.floor(seedRu.length / 2)], seedRu[seedRu.length - 1]])
  const nearEdge = events.filter((e) => e.seed >= e.shelfEdge - 25 && e.seed <= e.shelfEdge + 5).length
  const topRank = events.filter((e) => e.ruRank <= Math.max(3, Math.ceil(0.1 * e.nSearched))).length
  out('geology', 'events whose seed lies within 25 km seaward... of the shelf edge (edge-25..edge+5 km)', [nearEdge, events.length])
  out('geology', 'events whose seed column is among the 10 % highest-ru searched columns', [topRank, events.length])

  // (2) scar depth and run-out against the published range
  const scars = ev.map((e) => e.scarDepth), runs = ev.map((e) => e.runout / 1e3)
  const sortN = (a) => a.slice().sort((x, y) => x - y)
  const q = (a, p) => sortN(a)[Math.min(a.length - 1, Math.floor(p * a.length))]
  out('geology', 'scar depth ft (min, median, max)', [q(scars, 0) * 3.28084, q(scars, 0.5) * 3.28084, q(scars, 0.999) * 3.28084].map(Math.round))
  out('geology', 'run-out km (min, median, max)', [q(runs, 0), q(runs, 0.5), q(runs, 0.999)].map((x) => +x.toFixed(1)))
  const cap = M.P.stabMaxDepth
  const atCap = ev.filter((e) => e.scarDepth >= 0.95 * cap)
  out('geology', `events with scar depth >= 95 % of the search window (${cap} m = ${Math.round(cap * 3.28084)} ft)`, atCap.map((e) => `#${e.id} ${Math.round(e.scarDepth * 3.28084)} ft`))
  const zero = ev.filter((e) => e.runout < 500)
  out('geology', 'events with run-out under 0.5 km (debris came to rest where it was released)', zero.map((e) => `#${e.id}`))
  // repeated identical re-failure of the same column in one step
  const same = []
  for (let a = 1; a < ev.length; a++) {
    const p = ev[a - 1], c = ev[a]
    if (c.step === p.step && c.sourceFrom === p.sourceFrom && c.sourceTo === p.sourceTo && Math.abs(c.volume - p.volume) / p.volume < 0.02) same.push(`#${p.id}->#${c.id}`)
  }
  out('geology', 'consecutive events in one step on the same columns with the same volume (within 2 %)', same)
  check('geology', 'FOLLOW-UP probe: no event re-fails the same columns with an unchanged volume in the same step', same.length === 0, `${same.length} repeats: ${same.join(' ')}`)
  check('geology', 'FOLLOW-UP probe: no failure leaves its debris where it was (zero run-out)', zero.length === 0, `${zero.length} of ${ev.length}`)
  check('geology', 'FOLLOW-UP probe: no scar is cut off by the stability search window', atCap.length === 0, `${atCap.length} at the ${Math.round(cap * 3.28084)} ft window`)

  // (3) tag audit. Re-derive dSlope, dPress, dSea, loadRate and the tag for the first event of each step
  const T = { floor: 1e-4, ruCap: 0.999 }
  let matchNum = 0, matchTag = 0, nChecked = 0, worstDiff = 0
  for (const e of events) {
    const full = ev.find((x) => x.id === e.id)
    const k = e.step
    const ref = Math.max(0, k - 4)
    if (!post[ref] && k > 0) continue
    nChecked++
    const tanThen = k === 0 ? e.preK.tanNow : post[ref].slope[e.seed]
    const ruThen = k === 0 ? NaN : post[ref].ru[e.seed]
    const dSlope = Math.log(Math.max(e.preK.tanNow, T.floor) / Math.max(tanThen, T.floor))
    let dPress = 0
    if (!Number.isNaN(ruThen) && !Number.isNaN(e.preK.ruNow)) {
      const now = Math.min(Math.max(e.preK.ruNow, 0), T.ruCap), then = Math.min(Math.max(ruThen, 0), T.ruCap)
      dPress = Math.log((1 - then) / (1 - now))
    }
    const dSea = k === 0 ? 0 : M.sea(M.sch.tEndYr[k]) - M.sea(M.sch.tEndYr[ref])
    const diff = Math.max(Math.abs(dSlope - full.dSlope), Math.abs(dPress - full.dPress), Math.abs(dSea - full.dSeaLevel))
    worstDiff = Math.max(worstDiff, diff)
    if (diff < 1e-6) matchNum++
    let cause
    if (dSea <= -M.P.failLowstandDrop) cause = 'lowstand'
    else if (dSlope > 0 && dSlope >= dPress) cause = 'oversteepening'
    else if (full.loadRate >= M.P.failRapidRate) cause = 'rapid loading'
    else cause = 'overpressure'
    if (cause === full.cause) matchTag++
  }
  out('geology', 'tag re-derivation of the first event in each step: events checked, numbers matching to 1e-6, tags matching, worst number difference', [nChecked, matchNum, matchTag, worstDiff])
  check('geology', 'dSlope, dPress and sea-level change of each step\'s first event reproduce from an independent replay (1e-6)', matchNum === nChecked, `${matchNum}/${nChecked}, worst ${worstDiff.toExponential(2)}`)
  check('geology', 'the tag follows the documented rule given those numbers', matchTag === nChecked, `${matchTag}/${nChecked}`)

  // how much does the first-match-wins order decide? re-tag every event WITHOUT the sea-level test
  const counts = { actual: {}, withoutSeaTest: {} }
  let pressureDominated = 0, lowstandAndPressureDominated = 0, lowstandSmall = 0
  for (const e of ev) {
    counts.actual[e.cause] = (counts.actual[e.cause] ?? 0) + 1
    let c
    if (e.dSlope > 0 && e.dSlope >= e.dPress) c = 'oversteepening'
    else if (e.loadRate >= M.P.failRapidRate) c = 'rapid loading'
    else c = 'overpressure'
    counts.withoutSeaTest[c] = (counts.withoutSeaTest[c] ?? 0) + 1
    if (e.dPress > e.dSlope) pressureDominated++
    if (e.cause === 'lowstand' && e.dPress > e.dSlope) lowstandAndPressureDominated++
    if (e.cause === 'lowstand' && e.dSeaLevel > -10) lowstandSmall++
  }
  out('geology', 'tags as stored vs tags if the sea-level test were skipped', counts)
  out('geology', 'events where the pressure term beats the slope term (dPress > dSlope)', [pressureDominated, ev.length])
  out('geology', 'events tagged lowstand although the pressure term beats the slope term', [lowstandAndPressureDominated, ev.length])
  out('geology', 'events tagged lowstand with a sea-level fall of less than 10 m over the 20 kyr window', [lowstandSmall, ev.length])
  out('geology', 'share of record steps (k >= 4) in which sea level fell by >= failLowstandDrop over the 4-step window', `${seaFall} of ${nStepsTotal} (${(100 * seaFall / nStepsTotal).toFixed(0)} %)`)
  check('geology', 'FOLLOW-UP probe: the tag has discriminating power (lowstand is not > 90 % of events)', (counts.actual.lowstand ?? 0) / ev.length <= 0.9, `${counts.actual.lowstand ?? 0} of ${ev.length} lowstand`)
  check('geology', 'FOLLOW-UP probe: no event is tagged lowstand while the pressure term dominates', lowstandAndPressureDominated === 0, `${lowstandAndPressureDominated} events`)

  // default preset with failure on: how many events?
  const D = setup('last3', { failOn: 1 }); runAll(D)
  let minFS = Infinity
  {
    const dd = setup('last3', { failOn: 0 }); const opt = { minSlope: Math.tan(dd.P.failSlopeMin * DEG), minDepth: dd.P.failMinDepth }
    let colMin = 0
    while (E.step.step(dd.eng, dd.P, dd.sch, dd.sea)) { const st = E.stab.computeStability(dd.eng, dd.P, opt); for (let j = 0; j < dd.eng.rec.nx; j++) if (st.fsMin[j] < minFS) { minFS = st.fsMin[j]; colMin = j } }
    out('geology', 'default preset (6 deg shelf-edge slope), failure off: lowest FS found at any step, and its column', [minFS, colMin])
  }
  out('geology', 'default preset with failure on: events', D.eng.events.length)
  check('geology', 'default preset: no or very few failures (<= 3)', D.eng.events.length <= 3, `${D.eng.events.length} events, lowest FS ever ${minFS.toFixed(2)}`)

  // slope profile of the preset's final surface, for the doc
  const rec = M.eng.rec
  const prof = []
  for (let j = 0; j < rec.nx; j += 10) prof.push(`${j} km: ${(Math.atan(Math.abs(rec.H[Math.min(j + 1, rec.nx - 1)] - rec.H[Math.max(0, j - 1)]) / (2 * rec.dx)) / DEG).toFixed(2)} deg, H ${rec.H[j].toFixed(0)} m`)
  out('geology', 'final surface of the MTD preset (every 10 km)', prof)
  // per-step shelf edge position over time
  results.geology.perEvent = events
}

// =============================================================================================
// 8. Licences: dependency changes M2 vs main, installed packages
// =============================================================================================
if (run('licences')) {
  const diff = execSync('git diff main -- package.json package-lock.json', { cwd: root, encoding: 'utf8' })
  out('licences', 'package.json / package-lock.json differences against main', diff.length === 0 ? 'none' : diff.slice(0, 400))
  check('licences', 'M2 adds no dependency (package.json and package-lock.json identical to main)', diff.length === 0, diff.length === 0 ? 'identical' : 'DIFFERS')
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
  const permissive = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|Python-2\.0|CC0-1\.0|CC-BY-4\.0|Unlicense|MIT-0)$/
  const ok = (l) => l.replace(/[()]/g, '').split(/ OR | AND /).some((x) => permissive.test(x.trim()))
  const odd = rows.filter((r) => !ok(r.license))
  out('licences', 'installed packages', rows.length)
  check('licences', 'every installed package has a permissive licence', odd.length === 0, odd.map((r) => `${r.name} ${r.license}`).join('; ') || 'none odd')
  // data files M2 added: none expected
  const newData = execSync('git diff main --name-status -- src/engine/data', { cwd: root, encoding: 'utf8' })
  check('licences', 'M2 adds no data file under src/engine/data', newData.trim() === '', newData.trim() || 'none')
}

// ---------------------------------------------------------------------------------------------
const failed = verdicts.filter((v) => !v.ok)
console.log(`\n${verdicts.length - failed.length}/${verdicts.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.section}: ${f.name}`)
const file = join(root, 'docs/reviews/m2-review-results.json')
let prev = {}
if (want.size && existsSync(file)) prev = JSON.parse(readFileSync(file, 'utf8'))
writeFileSync(file, JSON.stringify({ ...prev, ...results }, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v), 1) + '\n')
await server.close()
process.exit(failed.length ? 1 : 0)
