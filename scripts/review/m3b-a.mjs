// M3b.4 review of the crest log (M3b part 1). Own code: the crest finder, tracker, rates and labels below are
// written from the definitions in the literature and the card (header of crestLog.ts used only as the spec to
// compare against), NOT by importing src/engine/crestLog.ts for any quantity. The engine is only RUN (preset,
// step, sea level) to produce the per-step salt state. The app's log (TimeMachine.crestLog) is imported at the end
// ONLY as the thing being checked.
//
// Usage: node scripts/review/m3b-a.mjs [outJson]
//   env NOISE=6 : number of 1-ulp noise runs (default 6) used for the cross-run medians (D16.4).
// Prints the platform and node version; run it on Windows node 26 and on Linux WSL node 22.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
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
const Ulp = await load('/tests/helpers/ulpNoise.ts')
const TM = await load('/src/worker/timeMachine.ts')

const results = { platform: `${process.platform} node ${process.versions.node}`, checks: [] }
let fails = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fails++; results.checks.push({ name, ok: !!ok, detail }) }
console.log(results.platform)

// ---- own tuned constants, from the doc, spelled out again ------------------------------------------------------------
const NEAR = 500, GAP = 3, TRACK = 3, PROM = 100, WIN = 1, NOISE = 25

// ---- own capture: run the engine and keep salt thickness h, salt top zt = b + h, seafloor H after each step ------------
function capture(id = 'gulf', over = {}) {
  const P = { ...Pr.presetParams(id), ...over }
  const sch = Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  const nx = eng.rec.nx
  const fr = []
  while (S.step(eng, P, sch, sea)) {
    const k = eng.diag.stepIndex - 1
    const r = eng.rec
    fr.push({ t: sch.tEndYr[k] / 1e6, age: sch.stepAgeMa[k], h: Float64Array.from(r.mud.subarray(0, nx)), b: Float64Array.from(r.b), H: Float64Array.from(r.H) })
  }
  return { P, fr, nx, dx: P.dx, weld: P.weldThick, hash: String(Det.stateHash(eng.rec)) }
}

// ---- own prominence (topographic) on the salt-top elevation ----------------------------------------------------------
function highs(z, minProm) {
  const n = z.length, out = []
  for (let j = 0; j < n; j++) {
    if (j > 0 && z[j - 1] > z[j]) continue
    if (j < n - 1 && z[j + 1] >= z[j]) continue
    let lo = z[j]; for (let q = j - 1; q >= 0 && z[q] <= z[j]; q--) lo = Math.min(lo, z[q])
    let ro = z[j]; for (let q = j + 1; q < n && z[q] <= z[j]; q++) ro = Math.min(ro, z[q])
    if (z[j] - Math.max(lo, ro) >= minProm) out.push(j)
  }
  return out
}
// least squares slope with the sums formulation (differs in form from the app's centred loop)
function ols(t, y) {
  const n = t.length; if (n < 2) return NaN
  let st = 0, sy = 0, stt = 0, sty = 0
  for (let i = 0; i < n; i++) { st += t[i]; sy += y[i]; stt += t[i] * t[i]; sty += t[i] * y[i] }
  const den = n * stt - st * st
  return den > 0 ? (n * sty - st * sy) / den : NaN
}
const labelOf = (F, A) => (!Number.isFinite(F) || !Number.isFinite(A) || Math.abs(F - A) < NOISE) ? 'unresolved' : (F - A > 0 ? 'tabular' : 'tapered')

function mine(cap) {
  const { fr, nx, weld } = cap
  const cover = (f, j) => f.H[j] - (f.b[j] + f.h[j])
  let active = [], done = [], id = 1
  const rec = (w, k) => {
    const f = fr[k], j = w.col
    const fl = []
    for (let d = 3; d <= 5; d++) for (const c of [j - d, j + d]) if (c >= 0 && c < nx) fl.push(f.H[c])
    w.k.push(k); w.t.push(f.t); w.col_.push(j); w.z.push(f.b[j] + f.h[j]); w.fl.push(fl.reduce((a, b) => a + b, 0) / fl.length); w.cov.push(cover(f, j))
    w.last = k
  }
  for (let k = 0; k < fr.length; k++) {
    const f = fr[k]
    for (const w of active) {
      let best = -1, bc = Infinity
      for (let q = Math.max(0, w.col - TRACK); q <= Math.min(nx - 1, w.col + TRACK); q++) if (f.h[q] >= weld && cover(f, q) < bc) { bc = cover(f, q); best = q }
      if (best < 0) { w.reason = 'welded'; w.closing = true; continue }
      w.col = best
      if (bc >= NEAR) { w.over++; if (w.over >= GAP) { w.reason = 'buried'; w.closing = true } } else w.over = 0
      if (w.closing) continue
      if (active.some((o) => o !== w && !o.closing && o.id < w.id && Math.abs(o.col - w.col) <= 2)) { w.merged = true; w.closing = true; continue }
      rec(w, k)
    }
    active = active.filter((w) => { if (!w.closing) return true; if (!w.merged) done.push(w); return false })
    const zt = Float64Array.from(f.h, (h, j) => f.b[j] + h)
    for (const j of highs(zt, PROM)) {
      if (f.h[j] < weld || cover(f, j) >= NEAR) continue
      if (active.some((w) => Math.abs(w.col - j) <= TRACK + 2)) continue
      const w = { id: id++, col: j, start: j, over: 0, closing: false, merged: false, reason: 'run end', k: [], t: [], col_: [], z: [], fl: [], cov: [] }
      rec(w, k); active.push(w)
    }
  }
  done.push(...active)
  done.sort((a, b) => a.k[0] - b.k[0] || a.start - b.start)
  return done.map((w, i) => {
    const n = w.t.length
    const nearIdx = w.cov.map((c, q) => (c < NEAR ? q : -1)).filter((q) => q >= 0)
    const tNear = w.t[nearIdx[nearIdx.length - 1]]
    const nw = nearIdx.filter((q) => w.t[q] >= tNear - WIN - 1e-9)
    const bw = w.t.map((_, q) => q).filter((q) => w.t[q] >= w.t[n - 1] - WIN - 1e-9)
    const stat = (ix) => { const F = ols(ix.map((q) => w.t[q]), ix.map((q) => w.z[q])), A = ols(ix.map((q) => w.t[q]), ix.map((q) => w.fl[q])); return { n: ix.length, F, A, d: F - A, ratio: F > 0 ? A / F : NaN, label: labelOf(F, A) } }
    return { id: i + 1, start: w.start, step0: w.k[0], reason: w.reason, endCol: w.col_[n - 1], near: stat(nw), burial: stat(bw) }
  })
}

const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN }
const FT = 0.3048

// ---- plain Gulf run: own crests vs the app's -------------------------------------------------------------------------
const cap = capture('gulf')
const my = mine(cap)
const tm = new TM.TimeMachine()
tm.run({ presetId: 'gulf', overrides: {} }, 1)
const app = tm.crestLog(tm.root)
console.log(`Gulf plain: own ${my.length} crests, app ${app.episodes.length} crests (merged ${app.merged})`)
check('record hash of own engine run equals the app TimeMachine hash (capture changes nothing)', String(tm.hashAt(tm.root, tm.nSteps)) === cap.hash, cap.hash)
check('same number of crests', my.length === app.episodes.length, `${my.length} vs ${app.episodes.length}`)
let worst = 0, matched = 0, labelMis = 0
const pairs = []
for (const e of app.episodes) {
  const m = my.find((x) => x.start === e.startCol && x.step0 === e.track.step[0])
  if (!m) { console.log('  no own match for app crest', e.id, e.startCol); continue }
  matched++
  for (const [wn, a, b] of [['near', e.near, m.near], ['burial', e.burial, m.burial]]) {
    for (const [q, x, y] of [['F', a.F, b.F], ['A', a.A, b.A], ['FminusA', a.FminusA, b.d]]) {
      if (Number.isNaN(x) && Number.isNaN(y)) continue
      const r = Math.abs(x - y) / Math.max(1, Math.abs(y)) // relative to max(1, |y|) m/Myr
      worst = Math.max(worst, r)
      if (r > 1e-8) console.log(`  DIFF crest ${e.id} ${wn} ${q}: app ${x} own ${y}`)
    }
    if (a.label !== b.label) { labelMis++; console.log(`  LABEL DIFF crest ${e.id} ${wn}: app ${a.label} own ${b.label}`) }
    if (a.n !== b.n) console.log(`  N DIFF crest ${e.id} ${wn}: ${a.n} vs ${b.n}`)
  }
  if (e.endReason !== m.reason) console.log(`  END DIFF crest ${e.id}: ${e.endReason} vs ${m.reason}`)
  pairs.push({ e, m })
}
check('every app crest has an own match (same start column and first step)', matched === app.episodes.length, `${matched}/${app.episodes.length}`)
check('F, A, F - A agree in both windows (relative to max(1, |value|))', worst < 1e-8, `worst ${worst.toExponential(2)}`)
check('labels agree in both windows', labelMis === 0, `${labelMis} differences`)
results.worstRel = worst

// ---- two crests, to the digit ----------------------------------------------------------------------------------------
const sel = pairs.filter((p) => p.e.near.n >= 5 && Number.isFinite(p.e.near.ratioAF))
const pick = [sel.find((p) => p.e.label === 'tapered'), sel.find((p) => p.e.label !== 'tapered') || sel[sel.length - 1]].filter(Boolean)
results.twoCrests = []
for (const { e, m } of pick) {
  const row = {
    crest: e.id, km: e.startKm, endKm: e.endKm, endReason: e.endReason, nNear: e.near.n,
    app: { F: e.near.F, A: e.near.A, d: e.near.FminusA, label: e.label },
    own: { F: m.near.F, A: m.near.A, d: m.near.d, label: m.near.label },
    ftF: e.near.F / FT, ftA: e.near.A / FT,
  }
  results.twoCrests.push(row)
  console.log(`crest ${e.id} (km ${e.startKm}->${e.endKm}, ${e.endReason}, near n=${e.near.n}): F app ${e.near.F} own ${m.near.F}; A app ${e.near.A} own ${m.near.A}; F-A app ${e.near.FminusA} own ${m.near.d}; label app ${e.label} own ${m.near.label}; in ft/Myr F ${(e.near.F / FT).toFixed(1)} A ${(e.near.A / FT).toFixed(1)}`)
}
// the user guide crests 5 and 11 (docs/user-guide.md 14.7), for the claim check
for (const id of [5, 11]) {
  const e = app.episodes.find((x) => x.id === id)
  if (e) console.log(`guide crest ${id}: km ${e.startKm} F ${(e.near.F / FT).toFixed(0)} ft/Myr (${e.near.F.toFixed(1)} m/Myr), A ${(e.near.A / FT).toFixed(0)} (${e.near.A.toFixed(1)}), F-A ${(e.near.FminusA / FT).toFixed(0)}, A/F ${e.near.ratioAF.toFixed(2)}, label ${e.label}`)
}
{ const e = app.episodes.find((x) => x.id === 5); if (e) console.log(`guide crest 5 extras: first ${e.firstAgeMa.toFixed(1)} Ma, near ${e.nearMyr.toFixed(1)} Myr, last ${e.lastAgeMa.toFixed(1)} Ma, burial F-A ${(e.burial.FminusA / FT).toFixed(0)} ft/Myr ${e.burial.label}, salt beside ${(e.neighbourSaltM / FT).toFixed(0)} ft (${e.neighbourSaltM.toFixed(0)} m), L/h ${e.lOverH.toFixed(1)}`) }
results.guideCrests = [5, 11].map((id) => { const e = app.episodes.find((x) => x.id === id); return e && { id, km: e.startKm, F_m: e.near.F, A_m: e.near.A, d_m: e.near.FminusA, ratio: e.near.ratioAF, label: e.label } })

// ---- medians over plain + noise runs (D16.4), per platform ------------------------------------------------------------
const NN = Number(process.env.NOISE || 6)
const meds = []
const pooled = { d: [], A: [], tab: 0, tap: 0, unr: 0 }
for (let r = -1; r < NN; r++) {
  const c = r < 0 ? cap : Ulp.withUlpNoise(2.2e-16, 7 + r, () => capture('gulf'))
  const ms = mine(c)
  for (const x of ms) { pooled.d.push(x.near.d); pooled.A.push(x.near.A); pooled[x.near.label === 'tabular' ? 'tab' : x.near.label === 'tapered' ? 'tap' : 'unr']++ }
  const tab = ms.filter((x) => x.near.label === 'tabular').length
  const tap = ms.filter((x) => x.near.label === 'tapered').length
  meds.push({ run: r < 0 ? 'plain' : `noise${r}`, n: ms.length, tabular: tab, tapered: tap, unresolved: ms.length - tab - tap, medD: median(ms.map((x) => x.near.d)), medDft: median(ms.map((x) => x.near.d)) / FT, medA: median(ms.map((x) => x.near.A)), medAft: median(ms.map((x) => x.near.A)) / FT, medDburial: median(ms.map((x) => x.burial.d)), nonPosD: ms.filter((x) => x.near.d < 0).length })
}
console.table(meds)
results.meds = meds
const mm = (k) => median(meds.map((m) => m[k]))
console.log(`median over ${meds.length} runs: crests ${mm('n')}, tabular ${mm('tabular')}, tapered ${mm('tapered')}, unresolved ${mm('unresolved')}, F-A ${mm('medD').toFixed(1)} m/Myr (${(mm('medD') / FT).toFixed(0)} ft/Myr), A ${mm('medA').toFixed(1)} m/Myr (${(mm('medA') / FT).toFixed(0)} ft/Myr)`)
results.runMedians = { n: mm('n'), tabular: mm('tabular'), tapered: mm('tapered'), unresolved: mm('unresolved'), medD: mm('medD'), medA: mm('medA') }
console.log(`pooled over all crests of ${meds.length} runs: ${pooled.d.length} crests, tabular ${pooled.tab}, tapered ${pooled.tap}, unresolved ${pooled.unr}, median F-A ${median(pooled.d).toFixed(1)} m/Myr (${(median(pooled.d) / FT).toFixed(0)} ft/Myr), median A ${(median(pooled.A) / FT).toFixed(0)} ft/Myr`)
results.pooled = { n: pooled.d.length, tab: pooled.tab, tap: pooled.tap, unr: pooled.unr, medD: median(pooled.d), medA: median(pooled.A) }
check('Gulf median F - A (near window) is negative on this platform', mm('medD') < 0, `${mm('medD').toFixed(1)} m/Myr`)
console.log(`tabular counts by run: ${meds.map((m) => m.tabular).join(',')} (a count this small must never be asserted, D16.4)`)

if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(results, null, 1))
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
await server.close()
process.exit(fails ? 1 : 0)
