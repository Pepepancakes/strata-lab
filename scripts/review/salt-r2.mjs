// SALT-R2 re-check of the S3c bypass fix. Own code. The spike engine is used only to produce the state; every
// quantity below is measured here (nothing from src/).
//   node scripts/review/salt-r2.mjs pit      pit census at EVERY record (0.1 Myr), all exposed columns
//   node scripts/review/salt-r2.mjs rates <gulf-crests.csv> [id id]   hand-check F_near/A_near of crests from the spike CSV
//   node scripts/review/salt-r2.mjs pool label=file.csv ...           medians over several CSVs (own pooling)
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const mode = process.argv[2]
const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '-')

if (mode === 'pit') {
  const spike = path.join(repo, 'spikes', '003-passive-diapir')
  const S = require(path.join(spike, 'engine.js'))
  const { gulfParams } = require(path.join(spike, 'gulf.js'))
  const P = gulfParams({ exposed: 1 })
  const st = S.createState(P)
  const dtMyr = P.dtRec / 1e6
  const exp = (j) => st.hs[j] > 0 && st.cover[j] < P.roofMin
  const nbr = (j, s) => { let q = j + s; while (q >= 0 && q < st.nx && exp(q)) q += s; return q >= 0 && q < st.nx ? q : -1 }
  let prevH = null
  // per record: for every exposed column the pit depth below the LOWER non-exposed neighbour; allowance = the largest
  // rise of either neighbour's seafloor over this record step, measured as H(now) - H(before) (own measure, includes
  // subsidence loss, so it is a lower bound of deposition; I add the subsidence back below).
  const run = new Map() // column -> consecutive records over allowance
  let recs = 0, colRecs = 0, over1 = 0, over2 = 0, over5 = 0, maxPit = -Infinity, maxRun = 0, nAbove = 0, nBelow = 0, nMixed = 0
  const worst = []
  while (S.step(st, P)) {
    const H = Float64Array.from(st.H)
    const t = st.k * dtMyr
    recs++
    if (prevH) {
      const next = new Map()
      for (let j = 0; j < st.nx; j++) {
        if (!exp(j)) continue
        const l = nbr(j, -1), r = nbr(j, 1)
        const subs = (q) => (P.subsShelf + (P.subsBasin - P.subsShelf) * (q + 0.5) / st.nx) * 1e-6 * P.dtRec
        const gain = Math.max(l >= 0 ? H[l] - prevH[l] + subs(l) : 0, r >= 0 ? H[r] - prevH[r] + subs(r) : 0)
        const hl = l >= 0 ? H[l] : Infinity, hr = r >= 0 ? H[r] : Infinity
        const lo = Math.min(hl, hr), hi = Math.max(l >= 0 ? H[l] : -Infinity, r >= 0 ? H[r] : -Infinity)
        if (H[j] >= hi) nAbove++; else if (H[j] < lo) nBelow++; else nMixed++
        const pit = lo - H[j]
        colRecs++
        maxPit = Math.max(maxPit, pit)
        if (pit > gain) {
          over1++
          const n = (run.get(j) || 0) + 1
          next.set(j, n); maxRun = Math.max(maxRun, n)
          if (n >= 2) over2++
          if (n >= 5) over5++
          if (n >= 2) worst.push({ t: +t.toFixed(1), col: j, pit: +pit.toFixed(0), gain: +gain.toFixed(0), run: n })
        }
      }
      run.clear(); for (const [k, v] of next) run.set(k, v)
    }
    prevH = H
  }
  console.log(`records ${recs}, exposed column-records ${colRecs}: above both ${nAbove}, below both ${nBelow}, mixed ${nMixed}`)
  console.log(`pit (lower neighbour minus column) max ${f(maxPit)} m; pit over one record of neighbour gain: ${over1} column-records; over it at 2 successive records ${over2}; at 5+ ${over5}; longest run ${maxRun} records`)
  console.log('worst runs (first 12):', JSON.stringify(worst.sort((a, b) => b.run - a.run).slice(0, 12)))
}

if (mode === 'pool') {
  const rd = (file) => {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
    const h = lines[0].split(',')
    return lines.slice(1).map((l) => { const v = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = v[i] }); return o })
  }
  const med = (a) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2])) : NaN }
  let all = []
  for (const arg of process.argv.slice(3)) {
    const [label, file] = arg.split('=')
    const rows = rd(file)
    all = all.concat(rows)
    const ex = rows.filter((r) => r.exposedEver === 'true'), bu = ex.filter((r) => r.endWhy === 'buried')
    console.log(label.padEnd(10), `crests ${rows.length} exposed ${ex.length} buried-after-exposure ${bu.length}`, `exposedMyr med ${f(med(ex.map((r) => +r.exposedMyr)), 1)} max ${f(Math.max(...ex.map((r) => +r.exposedMyr)), 1)}`,
      `F_near ${f(med(bu.map((r) => +r.F_near)))} A_near ${f(med(bu.map((r) => +r.A_near)))} FmA_near ${f(med(bu.map((r) => +r.FmA_near)))} | burial FmA ${f(med(bu.map((r) => +r.FmA_pre)))} | nb5 ${f(med(bu.map((r) => +r.nb5)))} nb10 ${f(med(bu.map((r) => +r.nb10)))}`)
  }
  const ex = all.filter((r) => r.exposedEver === 'true'), bu = ex.filter((r) => r.endWhy === 'buried')
  console.log('POOLED'.padEnd(10), `crests ${all.length} exposed ${ex.length} buried ${bu.length}`, `exposedMyr med ${f(med(ex.map((r) => +r.exposedMyr)), 1)} max ${f(Math.max(...ex.map((r) => +r.exposedMyr)), 1)} over3Myr ${ex.filter((r) => +r.exposedMyr > 3).length}`,
    `F_near ${f(med(bu.map((r) => +r.F_near)))} A_near ${f(med(bu.map((r) => +r.A_near)))} FmA_near ${f(med(bu.map((r) => +r.FmA_near)))} burial FmA ${f(med(bu.map((r) => +r.FmA_pre)))}`)
}

// Hand-check of two crests of the Windows S3c Gulf CSV with my own follower (same rule as the card: lowest cover
// within 3 columns, salt >= 100 m), my own least squares. Usage: rates id:col0:tNear id:col0:tNear ...
if (mode === 'rates') {
  const spike = path.join(repo, 'spikes', '003-passive-diapir')
  const S = require(path.join(spike, 'engine.js'))
  const { gulfParams } = require(path.join(spike, 'gulf.js'))
  const P = gulfParams({ exposed: 1 })
  const st = S.createState(P)
  const dtMyr = P.dtRec / 1e6
  const targets = process.argv.slice(3).map((a) => { const [id, col, tn] = a.split(':'); return { id, j: +col, tNear: +tn, s: [], over: 0, done: false, started: false } })
  const fm = (arr, j) => { const v = []; for (let d = 3; d <= 5; d++) for (const c of [j - d, j + d]) if (c >= 0 && c < arr.length) v.push(arr[c]); return v.reduce((a, b) => a + b, 0) / v.length }
  const lsq = (pts) => { const n = pts.length, mt = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n; let sxy = 0, sxx = 0; for (const [t, y] of pts) { sxy += (t - mt) * (y - my); sxx += (t - mt) ** 2 } return sxy / sxx }
  while (S.step(st, P)) {
    const t = st.k * dtMyr
    for (const T of targets) {
      if (T.done || t < T.tNear - 1e-9) continue
      if (!T.started) { T.started = true } else {
        let best = -1, bc = Infinity
        for (let q = Math.max(0, T.j - 3); q <= Math.min(st.nx - 1, T.j + 3); q++) if (st.hs[q] >= 100 && st.cover[q] < bc) { bc = st.cover[q]; best = q }
        if (best < 0) { T.done = true; continue }
        T.j = best
        if (st.cover[best] >= 500) { T.over++; if (T.over >= 3) { T.done = true; continue } } else T.over = 0
      }
      T.s.push({ t, zt: st.b[T.j] + st.hs[T.j], Hf: fm(st.H, T.j), cover: st.cover[T.j], j: T.j })
    }
  }
  for (const T of targets) {
    const near = T.s.filter((q) => q.cover < 500), tl = near[near.length - 1].t, w = near.filter((q) => q.t >= tl - 1 - 1e-9)
    const F = lsq(w.map((q) => [q.t, q.zt])), A = lsq(w.map((q) => [q.t, q.Hf]))
    const win = T.s.filter((q) => q.t >= T.s[T.s.length - 1].t - 1 - 1e-9)
    const Fp = lsq(win.map((q) => [q.t, q.zt])), Ap = lsq(win.map((q) => [q.t, q.Hf]))
    console.log(`crest ${T.id}: last near record t=${tl.toFixed(1)} Myr, ${w.length} records, col ${w[w.length - 1].j}; F_near ${F.toFixed(1)} A_near ${A.toFixed(1)} F-A ${(F - A).toFixed(1)} | window incl. burial records (${win.length} rec, to ${T.s[T.s.length - 1].t.toFixed(1)}): F ${Fp.toFixed(1)} A ${Ap.toFixed(1)} F-A ${(Fp - Ap).toFixed(1)}; exposed records ${T.s.filter((q) => q.cover < 2).length * dtMyr} Myr`)
  }
}
