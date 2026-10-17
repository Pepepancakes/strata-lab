// SALT-R1 review script: independent recomputation of the numbers under review.
// Reviewer's own code; it does not import src/engine for any quantity it checks.
//
//   node scripts/review/salt-r1.mjs [section ...]      sections: qc4 qc20 vk s4 s3b (default: all)
//
// Inputs that are not in the repo:
//   S4_SCRATCH   folder with the spike 004 run outputs (out-gulf-*.json); default <os tmpdir>/strata-s4
// The S3b section runs the spike 003 engine (spikes/003-passive-diapir/engine.js) to get the state, then
// tracks two crests and computes F, A and the neighbour thickness with this script's own code.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const require = createRequire(import.meta.url)
const want = new Set(process.argv.slice(2))
const run = (name) => want.size === 0 || want.has(name)
const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-')

// Constants as in src/engine/constants.ts (copied by hand, not imported)
const G = 9.81, RHO_W = 1025, RHO_SALT = 2160, YR = 3.15576e7

// ------------------------------------------------------------------------------------------------ QC 4
if (run('qc4')) {
  console.log('== QC 4: Poiseuille flux q = h^3 / (12 mu) * dP/dx (WJ11 Eq. 7; HJ07 p. 11) ==')
  const mu = 1e18, dPdx = 1e6 / 1000 // any head gradient: the ratio does not depend on it
  const q = (h) => (h ** 3 / (12 * mu)) * dPdx
  const hs = [500, 1000, 2000]
  const qs = hs.map(q)
  console.log(`  q(500, 1000, 2000 m) = ${qs.map((v) => v.toExponential(4)).join(', ')} m2/s`)
  console.log(`  ratios per doubling: ${f(qs[1] / qs[0], 12)}, ${f(qs[2] / qs[1], 12)}; h^2 law would give 4, h^4 law 16`)
  // Backward-Euler one-step error estimate used to justify the 0.5 % tolerance: relative error ~ c M a,
  // c = dt / dx^2, M = h^3 / (12 mu), a = (rho_cover_bulk - rho_w) g. Cover bulk density taken as 2,400 kg/m3
  // (the test's QC 5b reference value); the exact value only moves the estimate by tens of per cent.
  const dt = 1 * YR, dx = 1000, a = (2400 - RHO_W) * G
  for (const h of hs) console.log(`  one-step error estimate at h = ${h} m: c M a = ${((dt / dx / dx) * (h ** 3 / (12 * mu)) * a).toExponential(2)}`)
  console.log('  measured in the test: ratios 7.99959 (h/2 -> h) and 7.99672 (h -> 2h), i.e. -5e-5 and -4.1e-4 relative; same order as the estimate.')
}

// ------------------------------------------------------------------------------------------------ QC 20
if (run('qc20')) {
  console.log('\n== QC 20: WJ11 Eq. 9 thinning time, 100 m to 50 m ==')
  // Eq. 9 (zero roof speed): 1/h^2 = 1/h0^2 + t P / (6 mu L^2)  ->  t = 6 mu L^2 (1/h1^2 - 1/h0^2) / P
  const eq9 = (P, mu, L, h0, h1) => (6 * mu * L * L * (1 / (h1 * h1) - 1 / (h0 * h0))) / P
  // The same thinning with the roof dropping as the layer thins (the engine's situation, where the head is
  // recomputed every step): dh/dt = -h^3 (P0 - a (h0 - h)) / (12 mu L^2), a = (rho_salt - rho_w) g.
  // Integrated by RK4 with a fine step; this is the reviewer's own check of the test's explanation.
  const dropRoof = (P0, mu, L, h0, h1, a) => {
    const rhs = (h) => (-(h ** 3) * (P0 - a * (h0 - h))) / (12 * mu * L * L)
    let h = h0, t = 0
    const dt = eq9(P0, mu, L, h0, h1) / 20000
    while (h > h1) {
      const k1 = rhs(h), k2 = rhs(h + 0.5 * dt * k1), k3 = rhs(h + 0.5 * dt * k2), k4 = rhs(h + dt * k3)
      const hn = h + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
      if (hn <= h1) { t += ((h - h1) / (h - hn)) * dt; break }
      h = hn; t += dt
    }
    return t
  }
  const a = (RHO_SALT - RHO_W) * G
  console.log(`  a = (rho_salt - rho_w) g = ${f(a, 1)} Pa/m; 50 m of roof drop = ${f((a * 50) / 1e6, 3)} MPa`)
  // Case 1: the test's own set-up (P' as printed by the test; mu 1e17, L = dx = 1000 m)
  const Pt = Number(process.env.QC20_PPRIME_MPA || 80.06) * 1e6
  const t1 = eq9(Pt, 1e17, 1000, 100, 50) / YR, t1d = dropRoof(Pt, 1e17, 1000, 100, 50, a) / YR
  console.log(`  test set-up P' = ${f(Pt / 1e6, 2)} MPa (env QC20_PPRIME_MPA to override): Eq. 9 ${f(t1, 0)} yr; with the dropping roof ${f(t1d, 0)} yr (+${f((t1d / t1 - 1) * 100, 2)} %)`)
  console.log('  engine (test output): 71,590 yr against Eq. 9 71,245 yr, +0.48 %. The roof drop explains about half; the rest is time-step error (halving the step moves it < 0.5 %).')
  // Case 2: WJ11 Fig. 7a values, P' = 1 MPa, L = 1000 m, mu = 1e17
  const t2 = eq9(1e6, 1e17, 1000, 100, 50) / YR / 1e6, t2d = dropRoof(1e6, 1e17, 1000, 100, 50, a) / YR / 1e6
  console.log(`  WJ11 Fig. 7a values: Eq. 9 ${f(t2, 2)} Myr (paper-derived value about 5.7 Myr); with the roof dropping 0.554 MPa of the 1 MPa: ${f(t2d, 2)} Myr, ratio ${f(t2d / t2, 2)}`)
  console.log('  engine (test output): 9.67 Myr, ratio 1.70. So the ratio is what a dropping roof gives, not a limiter effect.')
  // Eq. 9 at the paper's own check points: 9.7 m at 200 Myr and 4.4 m at 1000 Myr (Fig. 7a caption, p. 316)
  const hAt = (tS) => 1 / Math.sqrt(1 / 100 ** 2 + (tS * 1e6) / (6 * 1e17 * 1e6)) // t in seconds, P' 1 MPa, L 1000 m
  console.log(`  Eq. 9 remnant at 200 and 1000 Myr (P' 1 MPa, L 1000 m, mu 1e17): ${f(hAt(200e6 * YR), 2)} m and ${f(hAt(1000e6 * YR), 2)} m (paper: 9.7 m; note: 4.4 m)`)
  console.log(`  Eq. 9 time 100 -> 50 m at mu 1e18: ${f(eq9(1e6, 1e18, 1000, 100, 50) / YR / 1e6, 1)} Myr (ten times 1e17)`)
}

// ------------------------------------------------------------------------------------------------ van Keken
if (run('vk')) {
  console.log('\n== S4 benchmark 2a: linear growth rate of the van Keken case 1a interface, own finite-difference solve ==')
  // Stream function psi = F(z) sin(kx); eta (F"" - 2 k^2 F" + k^4 F) = -k drho g a delta(z - z0)
  // (two layers of equal viscosity, so the ODE holds across the interface with a delta load).
  // Growth rate sigma = -k F(z0) / a  (vz = -k F sin(kx) at the crest... sign chosen so that sigma > 0 means growth).
  // Finite differences on N cells, 5-point biharmonic stencil, ghost points for the wall conditions:
  //   no slip:   F = 0 and F' = 0   (ghost F[-1] = F[1])
  //   free slip: F = 0 and F" = 0   (ghost F[-1] = -F[1])
  const solve = (wall, N) => {
    const lam = 0.9142, k = Math.PI / lam, eta = 100, drho = 10, g = 10, a = 1, z0 = 0.2
    const dz = 1 / N, n = N - 1 // interior unknowns F[1..N-1]; F[0] = F[N] = 0
    // banded matrix with bandwidth 2 (pentadiagonal); store as dense rows of 5 and solve by Gaussian elimination
    const A = Array.from({ length: n }, () => new Float64Array(n)), b = new Float64Array(n)
    const c4 = 1 / dz ** 4, c2 = -2 * k * k / dz ** 2, c0 = k ** 4
    for (let i = 1; i <= N - 1; i++) {
      const r = i - 1
      const add = (j, v) => {
        if (j === 0 || j === N) return // F = 0 at the walls
        if (j === -1) { add(1, wall === 'noslip' ? v : -v); return } // ghost
        if (j === N + 1) { add(N - 1, wall === 'noslip' ? v : -v); return }
        A[r][j - 1] += v
      }
      add(i - 2, c4); add(i - 1, -4 * c4 + c2); add(i, 6 * c4 - 2 * c2 + c0); add(i + 1, -4 * c4 + c2); add(i + 2, c4)
    }
    // delta load at z0 spread over the nearest node (1/dz), on the right-hand side divided by eta
    const i0 = Math.round(z0 / dz)
    b[i0 - 1] = (-k * drho * g * a) / eta / dz
    // Gaussian elimination with partial pivoting (small system, dense is fine for N <= 800)
    for (let c = 0; c < n; c++) {
      let p = c
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
      if (p !== c) { [A[c], A[p]] = [A[p], A[c]]; const t = b[c]; b[c] = b[p]; b[p] = t }
      for (let r = c + 1; r < n; r++) {
        const m = A[r][c] / A[c][c]
        if (m === 0) continue
        for (let q = c; q < n; q++) A[r][q] -= m * A[c][q]
        b[r] -= m * b[c]
      }
    }
    const x = new Float64Array(n)
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let q = r + 1; q < n; q++) s -= A[r][q] * x[q]; x[r] = s / A[r][r] }
    const F0 = x[i0 - 1]
    return -k * F0 / a
  }
  for (const wall of ['noslip', 'freeslip']) {
    const s = [200, 400, 800].map((N) => solve(wall, N))
    // Richardson extrapolation (second order)
    const ext = s[2] + (s[2] - s[1]) / 3
    console.log(`  ${wall.padEnd(8)}: sigma at N = 200, 400, 800: ${s.map((v) => v.toFixed(6)).join(', ')}; extrapolated ${ext.toFixed(5)}`)
  }
  console.log('  spike bench.js (analytic 8x8 solve) states 0.01094 for no slip; the solver came out 1.4 % high at 96x104.')
  console.log('  Reference first-peak values used by the spike: t = 208.99, v_rms = 3.0916e-3 (SECONDARY: Underworld example notebook).')
  console.log('  Reviewer found the same pair in two further secondary places (Underworld docs 1_06_Rayleigh_Taylor; underworld-standard-examples 05).')
  console.log('  ASPECT cookbook van-keken-discontinuous.prm uses the same geometry/BC (free slip sides, no slip top and bottom) and reports agreement to better than 1 % with the paper for the first peak.')
  console.log('  The 1997 paper itself (JGR 102, 22477-22495, doi 10.1029/97JB01353) could not be read in this review either, so the values remain secondary-sourced.')
}

// ------------------------------------------------------------------------------------------------ S4 table
if (run('s4')) {
  console.log('\n== S4: recompute the cover-over-crest table and salt-area drift from the run outputs (own code) ==')
  const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4')
  const names = ['gulf-A', 'gulf-B', 'gulf-A-unf', 'gulf-B-unf', 'gulf-A-cov10', 'gulf-B-cov10', 'gulf-A-cov10-unf', 'gulf-B-cov10-unf', 'gulf-A-cov0.1', 'gulf-B-cov0.1', 'gulf-A-cov0.1-unf', 'gulf-B-cov0.1-unf', 'gulf-A-cfl1']
  const times = [24.8, 26.8, 30, 40, 50, 54, 60, 66]
  const atT = (series, t) => {
    let best = null
    for (const s of series) if (best === null || Math.abs(s.tMyr - t) < Math.abs(best.tMyr - t)) best = s
    return best
  }
  console.log('  run | ' + times.join(' | ') + ' | min cover 26-66 (zone) | first t<50 | burial t (S3b rule) | salt area drift % | records')
  let thinPrinted = false
  for (const name of names) {
    const file = path.join(SCR, `out-${name}.json`)
    if (!fs.existsSync(file)) { console.log(`  ${name}: no output file at ${file}`); continue }
    const o = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!thinPrinted && o.thinSeries) {
      thinPrinted = true
      const ts = o.thinSeries
      const row = times.map((t) => { const s = atT(ts, t); return Math.abs(s.tMyr - t) < 0.6 ? f(s.coverM, 0) : '-' })
      let firstExp = null, buried = null, cnt = 0
      for (const s of ts) {
        if (firstExp === null && s.coverM < 50) firstExp = s.tMyr
        if (firstExp !== null) { if (s.coverM > 100) { cnt++; if (cnt >= 3 && buried === null) buried = s.tMyr } else cnt = 0 }
      }
      const tail = ts.slice(-4).map((s) => `${s.tMyr}:${f(s.coverM, 0)}`).join(' ')
      console.log(`  thin sheet (case file in the same output) | ${row.join(' | ')} | - | ${firstExp} | ${buried === null ? 'series ends before 3 records over 100 m' : buried} | - | ${ts.length} records, last four t:cover ${tail}`)
    }
    const se = o.series
    const row = times.map((t) => f(atT(se, t).coverM, 0))
    let mn = Infinity, mnZone = Infinity, firstExp = null, buried = null, cnt = 0
    for (const s of se) {
      if (s.tMyr < 26 || s.tMyr > 66) continue
      mn = Math.min(mn, s.coverM); mnZone = Math.min(mnZone, s.zoneMinCoverM)
      if (firstExp === null && s.coverM < 50) firstExp = s.tMyr
      if (firstExp !== null) { if (s.coverM > 100) { cnt++; if (cnt >= 3 && buried === null) buried = s.tMyr } else cnt = 0 }
    }
    const drift = (o.saltArea1 / o.saltArea0 - 1) * 100
    console.log(`  ${name.padEnd(18)} | ${row.join(' | ')} | ${f(mn, 0)} (${f(mnZone, 0)}) | ${firstExp === null ? 'none' : f(firstExp, 1)} | ${buried === null ? 'none' : f(buried, 1)} | ${f(drift, 2)} | ${se.length} (${o.cfg.nx}x${o.cfg.ny}, ${f(o.minutes, 0)} min)`)
  }
  // A vs B agreement, cover x1 filtered and unfiltered: differences at the listed times, and sign of the minimum cover change
  const pair = (a, b) => {
    const fa = path.join(SCR, `out-${a}.json`), fb = path.join(SCR, `out-${b}.json`)
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) return
    const A = JSON.parse(fs.readFileSync(fa, 'utf8')).series, B = JSON.parse(fs.readFileSync(fb, 'utf8')).series
    const d = times.map((t) => atT(B, t).coverM - atT(A, t).coverM)
    let maxAbs = 0
    for (const s of A) { if (s.tMyr < 26 || s.tMyr > 66) continue; maxAbs = Math.max(maxAbs, Math.abs(atT(B, s.tMyr).coverM - s.coverM)) }
    console.log(`  B minus A, ${a} vs ${b}: at listed times ${d.map((v) => f(v, 0)).join(', ')} m; largest |B-A| over 26-66 Myr ${f(maxAbs, 0)} m`)
  }
  pair('gulf-A', 'gulf-B'); pair('gulf-A-unf', 'gulf-B-unf'); pair('gulf-A-cov10', 'gulf-B-cov10'); pair('gulf-A-cov0.1', 'gulf-B-cov0.1')
  // GL24-like
  for (const name of ['gl24-A', 'gl24-B']) {
    const file = path.join(SCR, `out-${name}.json`)
    if (!fs.existsSync(file)) continue
    const o = JSON.parse(fs.readFileSync(file, 'utf8'))
    const se = o.series
    const rel = se.filter((s) => s.tMyr >= 5).map((s) => s.reliefM)
    const srt = rel.slice().sort((p, q) => p - q)
    const cov = se.filter((s) => s.tMyr >= 5).map((s) => s.coverM)
    console.log(`  ${name}: relief from 5 Myr on: min ${f(Math.min(...rel), 0)}, median ${f(srt[Math.floor(srt.length / 2)], 0)}, max ${f(Math.max(...rel), 0)} m; cover over crest max ${f(Math.max(...cov), 0)} m; salt area drift ${f((o.saltArea1 / o.saltArea0 - 1) * 100, 2)} %; ${se.length} records, ${o.cfg.nx}x${o.cfg.ny}`)
  }
}

// ------------------------------------------------------------------------------------------------ S3b
if (run('s3b')) {
  console.log('\n== S3b: two crests of the per-crest log, tracked and summarised with this script\'s own code ==')
  const spike = path.join(repo, 'spikes', '003-passive-diapir')
  const S = require(path.join(spike, 'engine.js'))
  const { gulfParams } = require(path.join(spike, 'gulf.js'))
  const P = gulfParams({ exposed: 1 })
  const st = S.createState(P)
  const hs0 = Float64Array.from(st.hs)
  const dtMyr = P.dtRec / 1e6
  console.log(`  Gulf spike run: nx ${st.nx}, dx ${P.dx} m, record step ${dtMyr} Myr, weldThick ${P.weldThick} m, roofMin ${P.roofMin} m, saltThick ${P.saltThick} m`)
  console.log(`  start salt: columns with salt ${hs0.filter((v) => v > 0).length}, max ${f(Math.max(...hs0), 1)} m, first/last salt column ${hs0.findIndex((v) => v > 0)} / ${hs0.length - 1 - Array.from(hs0).reverse().findIndex((v) => v > 0)}`)
  // Crests to check: id 21 (column 270, the decisive crest used by S4) and id 13 (column 230)
  const targets = [{ id: 21, col0: 270, tNear: 24.8 }, { id: 13, col0: 230, tNear: 13.3 }]
  const NEAR = 500, TRACK = 3, GAP = 3
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const flank = (arr, j, d1, d2) => { const v = []; for (let d = d1; d <= d2; d++) for (const q of [j - d, j + d]) if (q >= 0 && q < st.nx) v.push(arr[q]); return mean(v) }
  const slope = (pts) => { const mt = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1])); let sxy = 0, sxx = 0; for (const [t, y] of pts) { sxy += (t - mt) * (y - my); sxx += (t - mt) ** 2 } return sxy / sxx }
  const tr = targets.map((g) => ({ ...g, j: g.col0, s: [], over: 0, done: false, snap: null }))
  while (S.step(st, P)) {
    const t = st.k * dtMyr
    for (const c of tr) {
      if (c.done || t < c.tNear - 1e-9) continue
      // same following rule as the spike (lowest cover with salt within +-TRACK), re-implemented here
      let best = -1, bc = Infinity
      for (let q = Math.max(0, c.j - TRACK); q <= Math.min(st.nx - 1, c.j + TRACK); q++) if (st.hs[q] >= P.weldThick && st.cover[q] < bc) { bc = st.cover[q]; best = q }
      if (best < 0) { c.done = true; c.why = 'welded'; continue }
      c.j = best
      if (st.cover[best] >= NEAR) { c.over++; if (c.over >= GAP) { c.done = true; c.why = 'buried'; c.tEnd = t - (GAP - 1) * dtMyr; continue } else continue } else c.over = 0
      c.s.push({ t, j: best, zt: st.b[best] + st.hs[best], Hf: flank(st.H, best, 3, 5), cover: st.cover[best], exposed: st.cover[best] < P.roofMin })
      c.snap = { hs: st.hs.slice(), j: best, t }
      // profiles around the crest at a few times (width of the sinking column)
      if (!c.prof) c.prof = []
      c.prof.push({ t, j: best, hs: Array.from(st.hs.slice(best - 6, best + 7)), zt: Array.from(st.hs.slice(best - 6, best + 7)).map((h, i) => h + st.b[best - 6 + i]), cover: Array.from(st.cover.slice(best - 6, best + 7)), H: Array.from(st.H.slice(best - 6, best + 7)) })
      if (c.prof.length > 25) c.prof.shift()
    }
    if (tr.every((c) => c.done)) break
  }
  for (const c of tr) {
    const s = c.s
    if (s.length === 0) {
      console.log(`  crest id ${c.id} (start column ${c.col0}): no near record on this platform (ended '${c.why}' at ${f(c.tEnd, 1)} Myr, column ${c.j}); the Windows run gave the values below. Platform sensitivity (D16.4).`)
      continue
    }
    const last = s[s.length - 1]
    const pre = s.filter((q) => q.t >= last.t - 1.0 - 1e-9)
    const Fp = slope(pre.map((q) => [q.t, q.zt])), Ap = slope(pre.map((q) => [q.t, q.Hf]))
    const first = pre[0]
    const nb10 = mean([c.snap.hs[c.snap.j - 10], c.snap.hs[c.snap.j + 10]].filter((v) => v !== undefined))
    const nb1 = mean([c.snap.hs[c.snap.j - 1], c.snap.hs[c.snap.j + 1]].filter((v) => v !== undefined))
    const nb5 = mean([c.snap.hs[c.snap.j - 5], c.snap.hs[c.snap.j + 5]].filter((v) => v !== undefined))
    const exposedMyr = s.filter((q) => q.exposed).length * dtMyr
    const tExp = s.find((q) => q.exposed)?.t
    console.log(`  crest id ${c.id} (start column ${c.col0}): end ${c.why} at ${f(c.tEnd, 1)} Myr, last near record ${f(last.t, 1)} Myr at column ${last.j} (${last.j + 0.5} km); first exposed ${f(tExp, 1)} Myr, exposed ${f(exposedMyr, 1)} Myr`)
    console.log(`    last 1 Myr (${pre.length} records): salt top ${f(first.zt, 1)} -> ${f(last.zt, 1)} m, flank seafloor (mean of +-3..5 columns) ${f(first.Hf, 1)} -> ${f(last.Hf, 1)} m`)
    console.log(`    two-point rates: F ${f((last.zt - first.zt) / (last.t - first.t), 1)} m/Myr, A ${f((last.Hf - first.Hf) / (last.t - first.t), 1)} m/Myr; least-squares F_pre ${f(Fp, 1)}, A_pre ${f(Ap, 1)}, F-A ${f(Fp - Ap, 1)} m/Myr`)
    console.log(`    neighbour salt at the last near record: +-1 km ${f(nb1, 0)} m, +-5 km ${f(nb5, 0)} m, +-10 km ${f(nb10, 0)} m (fraction of ${P.saltThick} m: ${f(nb10 / P.saltThick, 2)}); crest salt ${f(c.snap.hs[c.snap.j], 0)} m, cover at last near record ${f(last.cover, 0)} m`)
    // width of the sinking: profiles 2 Myr before the end and at the end (columns j-6 .. j+6)
    const pr = c.prof
    for (const k of [0, Math.floor(pr.length / 2), pr.length - 1]) {
      const p = pr[k]
      console.log(`    t ${f(p.t, 1)} Myr, columns ${p.j - 6}..${p.j + 6}: salt top ${p.zt.map((v) => f(v, 0)).join(' ')}`)
      console.log(`      cover ${p.cover.map((v) => f(v, 0)).join(' ')} | salt ${p.hs.map((v) => f(v, 0)).join(' ')} | seafloor ${p.H.map((v) => f(v, 0)).join(' ')}`)
    }
  }
  console.log('  CSV (spike): id 21: tEnd 54.3, F_pre -382.0, A_pre -10.8, F-A -371.2, nb1/5/10 3956/3877/4337; id 13: tEnd 34.9, F_pre -387.5, A_pre -5.4, F-A -382.0, nb 3913/4203/3802')
}

// ------------------------------------------------------------------------------------------------ S3b: pits or crests?
if (run('pit')) {
  console.log('\n== S3b: do the exposed columns stand above their flanks (a crest) or below them (a pit)? own census of the Gulf spike run ==')
  const spike = path.join(repo, 'spikes', '003-passive-diapir')
  const S = require(path.join(spike, 'engine.js'))
  const { gulfParams } = require(path.join(spike, 'gulf.js'))
  const P = gulfParams({ exposed: 1 })
  const st = S.createState(P)
  const dtMyr = P.dtRec / 1e6
  const marks = [10, 20, 27, 30, 35, 40, 45, 50, 54, 60, 66]
  console.log('  t Myr | exposed cols | above both non-exposed neighbours | below both | mixed | median seafloor step to the higher neighbour (m) | deepest pit (m) | column 271: seafloor, nearest non-exposed neighbours L/R seafloor, cover L/R')
  let mi = 0
  while (S.step(st, P)) {
    const t = st.k * dtMyr
    if (mi >= marks.length || Math.abs(t - marks[mi]) > dtMyr / 2) continue
    mi++
    let above = 0, below = 0, mixed = 0, n = 0
    const steps = []
    let deepest = 0
    const nbr = (j, sgn) => { let q = j + sgn; while (q >= 0 && q < st.nx && st.hs[q] > 0 && st.cover[q] < P.roofMin) q += sgn; return q >= 0 && q < st.nx ? q : -1 }
    for (let j = 0; j < st.nx; j++) {
      if (!(st.hs[j] > 0 && st.cover[j] < P.roofMin)) continue
      n++
      const l = nbr(j, -1), r = nbr(j, 1)
      const hl = l >= 0 ? st.H[l] : -Infinity, hr = r >= 0 ? st.H[r] : -Infinity
      const hi = Math.max(hl, hr), lo = Math.min(hl, hr)
      if (st.H[j] >= hi) above++; else if (st.H[j] < lo) below++; else mixed++
      steps.push(hi - st.H[j]); deepest = Math.max(deepest, hi - st.H[j])
    }
    steps.sort((a, b) => a - b)
    const med = steps.length ? steps[Math.floor(steps.length / 2)] : NaN
    const j = 271, l = nbr(j, -1), r = nbr(j, 1)
    const c271 = st.hs[j] > 0 && st.cover[j] < P.roofMin ? `${f(st.H[j], 0)}, L ${l}:${f(st.H[l], 0)} R ${r}:${f(st.H[r], 0)}, cover ${f(st.cover[l], 0)}/${f(st.cover[r], 0)}` : `not exposed (cover ${f(st.cover[j], 0)} m)`
    console.log(`  ${f(t, 1).padStart(5)} | ${String(n).padStart(3)} | ${String(above).padStart(3)} | ${String(below).padStart(3)} | ${String(mixed).padStart(3)} | ${f(med, 0).padStart(6)} | ${f(deepest, 0).padStart(6)} | ${c271}`)
  }
}
