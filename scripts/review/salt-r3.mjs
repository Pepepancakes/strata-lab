// SALT-R3 short check of S4b. Own code; reads only JSON files (it imports no app or spike module).
//   node scripts/review/salt-r3.mjs <s4b-case.json> <out-gulf-A-s4b.json>
// 1. From the committed start section: cover of the followed crest's start column at tNear (thin-sheet side).
// 2. From the Stokes run output: the run settings, the cover at chosen times, the minimum cover over all records
//    (crest follower AND whole-box minimum, so the verdict does not depend on which crest the follower picks),
//    and the least-squares F, A, F-A in the windows the S4b answer quotes (own least squares).
import fs from 'node:fs'
const [caseFile, outFile] = process.argv.slice(2)
const B = JSON.parse(fs.readFileSync(caseFile, 'utf8'))
const O = outFile ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null
const FT = 3.28084
const ls = (pts) => { const n = pts.length; if (n < 2) return NaN; const mt = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let a = 0, b = 0; for (const [t, y] of pts) { a += (t - mt) * (y - my); b += (t - mt) ** 2 } return a / b }
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-')

const c0 = B.start.columns.find((c) => c.j === B.crest.startColumn)
console.log(`start section ${B.start.tMyr.toFixed(1)} Myr, ${B.start.columns.length} columns from ${B.start.firstColumn}; followed crest column ${c0.j}: salt ${c0.saltM} m, cover ${c0.coverM} m (thin-sheet series first record cover ${B.thinSeries[0].coverM} m)`)
const saltCols = B.start.columns.filter((c) => c.saltM > 0)
console.log(`salt present from column ${saltCols[0].j} to ${saltCols[saltCols.length - 1].j}; thickest ${Math.max(...saltCols.map((c) => c.saltM)).toFixed(0)} m`)
// window 226-315 (cases.js colIdx0=15 .. 104 of the 211 dump)
const win = B.start.columns.slice(15, 105)
const area = win.reduce((s, c) => s + c.saltM * B.start.dxM, 0)
console.log(`window columns ${win[0].j}-${win[win.length - 1].j}: salt area ${(area / 1e6).toFixed(3)} km2 (cell-sum, thin-sheet columns)`)

if (O) {
  console.log('settings', JSON.stringify({ nx: O.cfg.nx, ny: O.cfg.ny, dx: O.cfg.dxM, dy: O.cfg.dyM, coverEta: O.cfg.coverEta, saltEta: O.cfg.saltEta, name: O.cfg.name }), 'steps', O.steps, 'minutes', O.minutes.toFixed(1))
  const st = O.series.filter((r) => r.coverM !== undefined)
  const T0 = B.crest.tNearMyr, TE = B.crest.tEndMyr
  console.log('records', st.length, 'first', st[0].tMyr, 'last', st[st.length - 1].tMyr)
  const after = st.filter((r) => r.tMyr > T0 + 0.01)
  console.log('crest-follower cover: min', Math.min(...after.map((r) => r.coverM)).toFixed(0), 'm; min over start..thin burial', Math.min(...after.filter((r) => r.tMyr <= TE + 1e-6).map((r) => r.coverM)).toFixed(0), 'm; records under 100 m', st.filter((r) => r.coverM < 100).length, 'of', st.length)
  console.log('whole-box minimum cover after start:', Math.min(...after.map((r) => r.minCoverM)).toFixed(0), 'm')
  for (const t of [30, 40, 50, 60]) { const r = st.reduce((b, x) => (Math.abs(x.tMyr - t) < Math.abs(b.tMyr - t) ? x : b)); console.log(`cover at ${r.tMyr}: Stokes ${r.coverM.toFixed(0)} m (${(r.coverM * FT).toFixed(0)} ft)`) }
  const th = B.thinSeries
  const w = (rows, t0, t1, key) => rows.filter((r) => r.tMyr >= t0 - 1e-6 && r.tMyr <= t1 + 1e-6).map((r) => [r.tMyr, r[key]])
  for (const [a, b, lab] of [[TE - 5, TE, 'last 5 Myr before thin burial'], [T0, T0 + 10, 'first 10 Myr'], [T0, TE, 'whole near phase']]) {
    const tF = ls(w(th, a, b, 'saltTopM')), tA = ls(w(th, a, b, 'flankSeafloorM')), sF = ls(w(st, a, b, 'saltTopM')), sA = ls(w(st, a, b, 'flankSeafloorM'))
    console.log(`${lab} ${a.toFixed(1)}-${b.toFixed(1)}: thin F ${f(tF)} A ${f(tA)} F-A ${f(tF - tA)} | Stokes F ${f(sF)} A ${f(sA)} F-A ${f(sF - sA)} (${w(st, a, b, 'saltTopM').length} pts)`)
  }
}
