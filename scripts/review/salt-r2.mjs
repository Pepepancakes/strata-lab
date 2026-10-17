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
