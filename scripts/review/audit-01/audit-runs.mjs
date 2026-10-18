// AUDIT-1 checks 3, 4 and 5: runs on main's engine, read-only. Nothing here copies engine code.
// Usage: node scripts/review/audit-01/audit-runs.mjs <part> [outfile]
//   balance   every preset to the end: ledger balance per class (sand, mud, salt, cement) and the MTD lines;
//             plus combined runs (salt + MTDs; salt + thermal + cement + MTDs)
//   schedule  the same scenario at two step lengths: totals, surface, overpressure, events, salt profile
//   rewind    snapshot / restore vs an uninterrupted run with every later state on (salt, welds, MTDs, thermal, cement, bundling)
//   saltoff   salt-off runs with the salt parameters changed: hash must not move
//   mtd       what a fresh debris deposit carries (porosity, pressure ratio) and how it consolidates
//   m4        what M4 reads: overburden, hydrostatic, pore pressure in ppg EMW at chosen columns of the Gulf and MTD presets
//   mu        sensitivity of overpressure to the pore-water viscosity (via kMudMult, the same term in k/mu)
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const part = process.argv[2] || 'balance'
const outFile = process.argv[3]
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
const Rec = await load('/src/engine/record.ts')
const Fail = await load('/src/engine/failure.ts')
const Sched = await load('/src/engine/schedule.ts')
const Comp = await load('/src/engine/compaction.ts')
const SI = await load('/src/engine/saltIntervals.ts')
const K = await load('/src/engine/constants.ts')
const U = await load('/src/units.ts')
const Sum = await load('/src/engine/summary.ts')

const out = []
const say = (s = '') => { out.push(s); console.log(s) }
const f = (x, d = 3) => (typeof x === 'number' ? (Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(d) : x.toFixed(d)) : String(x))
const ft = (m) => (m / 0.3048).toFixed(0)

function build(id, over = {}, segments) {
  const P = { ...Pr.presetParams(id), ...over }
  const sch = segments ? Sched.buildSchedule(segments) : Pr.presetSchedule(id)
  const eng = S.createEngine(P, sch)
  const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
  return { P, sch, eng, sea }
}
function runToEnd(r) {
  const t0 = process.hrtime.bigint()
  while (S.step(r.eng, r.P, r.sch, r.sea)) { /* run */ }
  r.ms = Number(process.hrtime.bigint() - t0) / 1e6
  return r
}
function balanceLines(r) {
  const b = Rec.recordBalance(r.eng.rec)
  const led = r.eng.rec.ledger
  const lines = []
  for (const k of ['sand', 'mud', 'salt', 'cement']) {
    const x = b[k]
    lines.push(`  ${k.padEnd(7)} stored-init ${f(x.stored, 6)}  in-out ${f(x.expected, 6)}  err ${x.error.toExponential(3)}  rel ${x.relError.toExponential(3)}  (in ${f(led.cumIn[k], 1)} out ${f(led.cumOut[k], 1)} init ${f(led.init[k], 1)})`)
  }
  const m = Fail.mtdBalance(r.eng.events)
  if (r.eng.events.length) lines.push(`  MTD sand rel ${m.sand.released.toFixed(1)} dep ${m.sand.deposited.toFixed(1)} exp ${m.sand.exported.toFixed(1)} err ${m.sand.error.toExponential(2)} worst ${m.sand.worstRel.toExponential(2)}; mud rel ${m.mud.released.toFixed(1)} dep ${m.mud.deposited.toFixed(1)} exp ${m.mud.exported.toFixed(1)} err ${m.mud.error.toExponential(2)} worst ${m.mud.worstRel.toExponential(2)}`)
  const d = r.eng.diag
  lines.push(`  diag: clamps ${d.clamps} deficit ${f(d.deficit, 3)} saltClip ${d.saltClip} saltLimited ${d.saltLimited ?? '-'} saltLimitedVol ${d.saltLimitedVol ?? '-'} failUnresolved ${d.failUnresolved ?? '-'} events ${r.eng.events.length} steps ${d.stepIndex} ${r.ms.toFixed(0)} ms`)
  return lines
}

if (part === 'balance') {
  say('# Check 4: conservation per class on every preset (ledger: stored - init vs in - out, m^2)')
  for (const id of ['last3', 'mtd', 'miocene', 'cenozoic', 'saltshort', 'gulf']) {
    const r = runToEnd(build(id))
    say(`\n${id}: hash ${Det.stateHash(r.eng.rec)}`)
    for (const l of balanceLines(r)) say(l)
  }
  say('\n## Combined: saltshort + MTDs (failOn 1, kMudMult 0.1)')
  { const r = runToEnd(build('saltshort', { failOn: 1, kMudMult: 0.1 })); for (const l of balanceLines(r)) say(l) }
  say('\n## Combined: saltshort + MTDs + thermal + cement (failOn 1, kMudMult 0.1, thermal 1, cement 1)')
  { const r = runToEnd(build('saltshort', { failOn: 1, kMudMult: 0.1, thermal: 1, cement: 1 })); for (const l of balanceLines(r)) say(l) }
  say('\n## Combined: mtd preset + thermal + cement')
  { const r = runToEnd(build('mtd', { thermal: 1, cement: 1 })); for (const l of balanceLines(r)) say(l) }
  say('\n## Combined: gulf + MTDs (failOn 1), bundled every 20 with failure on (deep cache path is bypassed)')
  { const r = runToEnd(build('gulf', { failOn: 1 })); for (const l of balanceLines(r)) say(l) }
}

function profile(eng) {
  const rec = eng.rec, nx = rec.nx
  const salt = Float64Array.from(rec.mud.subarray(0, nx))
  // overpressure statistics over the cells that hold sediment: mean u and the 90th percentile of u / L
  const lam = []
  let sumU = 0, nU = 0
  for (let i = 0; i < rec.nLayers * nx; i++) {
    if (rec.material[i] === 1 || rec.sand[i] + rec.mud[i] <= 1e-9) continue
    sumU += rec.u[i]
    nU++
    if (eng.ld[i] > 0) lam.push(rec.u[i] / eng.ld[i])
  }
  lam.sort((a, b) => a - b)
  return { H: Float64Array.from(rec.H), salt, sum: Sum.summarizeRecord(rec, eng.events.length), meanU: nU ? sumU / nU : 0, lam90: lam.length ? lam[Math.floor(0.9 * lam.length)] : 0 }
}
function cmp(a, b, label) {
  let dH = 0, dS = 0
  for (let j = 0; j < a.H.length; j++) { dH = Math.max(dH, Math.abs(a.H[j] - b.H[j])); dS = Math.max(dS, Math.abs(a.salt[j] - b.salt[j])) }
  const rel = (x, y) => Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y), 1e-300)
  say(`${label}: sand rel ${rel(a.sum.sand, b.sum.sand).toExponential(2)}, mud rel ${rel(a.sum.mud, b.sum.mud).toExponential(2)}, meanH ${f(a.sum.meanH, 1)} vs ${f(b.sum.meanH, 1)} (rel ${rel(a.sum.meanH, b.sum.meanH).toExponential(2)}), max|dH| ${dH.toFixed(1)} m, maxU ${a.sum.maxU.toExponential(3)} vs ${b.sum.maxU.toExponential(3)} (rel ${rel(a.sum.maxU, b.sum.maxU).toExponential(2)}), meanU ${a.meanU.toExponential(3)} vs ${b.meanU.toExponential(3)} (rel ${rel(a.meanU, b.meanU).toExponential(2)}), u/L p90 ${a.lam90.toFixed(3)} vs ${b.lam90.toFixed(3)}, events ${a.sum.events} vs ${b.sum.events}, max|dSalt| ${dS.toFixed(1)} m; summary differs in: [${Sum.compareSummaries(a.sum, b.sum).join(', ')}]`)
}

if (part === 'schedule') {
  say('# Check 3c: step-length dependence. Same scenario, two schedules.')
  const a1 = runToEnd(build('last3', { nx: 150, dx: 1000 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]))
  const a2 = runToEnd(build('last3', { nx: 150, dx: 1000 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 10000 }]))
  cmp(profile(a1.eng), profile(a2.eng), 'last3 5 kyr vs 10 kyr')
  const a3 = runToEnd(build('last3', { nx: 150, dx: 1000 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 2500 }]))
  cmp(profile(a1.eng), profile(a3.eng), 'last3 5 kyr vs 2.5 kyr')
  const b1 = runToEnd(build('mtd', {}, [{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]))
  const b2 = runToEnd(build('mtd', {}, [{ fromAgeMa: 3, toAgeMa: 0, dt: 10000 }]))
  const b3 = runToEnd(build('mtd', {}, [{ fromAgeMa: 3, toAgeMa: 0, dt: 2500 }]))
  cmp(profile(b1.eng), profile(b2.eng), 'mtd 5 kyr vs 10 kyr')
  cmp(profile(b1.eng), profile(b3.eng), 'mtd 5 kyr vs 2.5 kyr')
  const causes = (e) => { const c = {}; for (const ev of e.events) c[ev.cause] = (c[ev.cause] || 0) + 1; return JSON.stringify(c) }
  say(`  mtd trigger tags: 5 kyr ${causes(b1.eng)}; 10 kyr ${causes(b2.eng)}; 2.5 kyr ${causes(b3.eng)} (lookback is 4 STEPS, so the window is 20, 40 and 10 kyr)`)
  const c1 = runToEnd(build('saltshort', {}, [{ fromAgeMa: 10, toAgeMa: 0, dt: 50000 }]))
  const c2 = runToEnd(build('saltshort', {}, [{ fromAgeMa: 10, toAgeMa: 0, dt: 25000 }]))
  const c3 = runToEnd(build('saltshort', {}, [{ fromAgeMa: 10, toAgeMa: 0, dt: 100000 }]))
  cmp(profile(c1.eng), profile(c2.eng), 'saltshort 50 kyr vs 25 kyr')
  cmp(profile(c1.eng), profile(c3.eng), 'saltshort 50 kyr vs 100 kyr')
  const welds = (e) => { let n = 0; for (const a of e.weldAge) if (a >= 0) n++; return n }
  say(`  saltshort welded columns: 50 kyr ${welds(c1.eng)}, 25 kyr ${welds(c2.eng)}, 100 kyr ${welds(c3.eng)}`)
  // thermal + cement: cement should be step-length independent for a prescribed temperature history; here coupled
  const d1 = runToEnd(build('last3', { thermal: 1, cement: 1, heatFlow: 0.08 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]))
  const d2 = runToEnd(build('last3', { thermal: 1, cement: 1, heatFlow: 0.08 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 10000 }]))
  say(`  last3 + thermal + cement (q 80 mW/m2): cement in ${f(d1.eng.rec.ledger.cumIn.cement, 1)} m^2 at 5 kyr vs ${f(d2.eng.rec.ledger.cumIn.cement, 1)} m^2 at 10 kyr`)
  // bundling vs not on the Miocene schedule (documented 0.25 % of H)
  const e1 = runToEnd(build('miocene'))
  const e2 = runToEnd(build('miocene', { bundleEvery: 1 }))
  cmp(profile(e1.eng), profile(e2.eng), 'miocene bundled x10 vs unbundled')
}

if (part === 'rewind') {
  say('# Check 3d: snapshot / restore vs uninterrupted, with every later state on')
  const cases = [
    ['saltshort + MTDs + thermal + cement, unbundled', 'saltshort', { failOn: 1, kMudMult: 0.1, thermal: 1, cement: 1 }],
    ['gulf schedule shortened (20 Myr at 100 kyr), bundled x20, salt + thermal + cement + MTDs', 'gulf', { failOn: 1, thermal: 1, cement: 1 }, [{ fromAgeMa: 66, toAgeMa: 46, dt: 100000 }]],
    ['miocene shortened (10 Myr at 50 kyr), bundled x10, thermal + cement', 'miocene', { thermal: 1, cement: 1 }, [{ fromAgeMa: 23, toAgeMa: 13, dt: 50000 }]],
  ]
  for (const [label, id, over, segs] of cases) {
    const r = build(id, over, segs)
    const n = r.sch.nSteps
    const at = Math.floor(n / 3), end = Math.floor((2 * n) / 3)
    while (r.eng.diag.stepIndex < at) S.step(r.eng, r.P, r.sch, r.sea)
    const snap = S.snapshotEngine(r.eng)
    while (r.eng.diag.stepIndex < end) S.step(r.eng, r.P, r.sch, r.sea)
    const straight = Det.stateHash(r.eng.rec)
    const ev1 = r.eng.events.length, w1 = Float64Array.from(r.eng.weldAge), t1 = Float64Array.from(r.eng.temp), ld1 = Float64Array.from(r.eng.ld)
    S.restoreEngine(snap, r.eng, r.P)
    while (r.eng.diag.stepIndex < end) S.step(r.eng, r.P, r.sch, r.sea)
    const replay = Det.stateHash(r.eng.rec)
    let dw = 0, dt = 0, dld = 0, dldFilled = 0
    for (let j = 0; j < w1.length; j++) dw = Math.max(dw, Math.abs(w1[j] - r.eng.weldAge[j]))
    for (let i = 0; i < t1.length; i++) dt = Math.max(dt, Math.abs(t1[i] - r.eng.temp[i]))
    for (let i = 0; i < ld1.length; i++) {
      const d = Math.abs(ld1[i] - r.eng.ld[i])
      dld = Math.max(dld, d)
      if (r.eng.rec.sand[i] + r.eng.rec.mud[i] > 1e-9) dldFilled = Math.max(dldFilled, d)
    }
    say(`${label}: steps ${at}->${end} of ${n}; hash straight ${straight} replay ${replay} ${straight === replay ? 'IDENTICAL' : 'DIFFER'}; events ${ev1} vs ${r.eng.events.length}; max|dWeldAge| ${dw}; max|dTemp| ${dt}; max|dLd| ${dld} (in cells that hold sediment: ${dldFilled})`)
    // and a run restored at the END then stepped once more vs fresh: catches state the snapshot forgot
    const r2 = build(id, over, segs)
    while (r2.eng.diag.stepIndex < end + 1) S.step(r2.eng, r2.P, r2.sch, r2.sea)
    S.step(r.eng, r.P, r.sch, r.sea)
    say(`  one more step after the replay: ${Det.stateHash(r.eng.rec) === Det.stateHash(r2.eng.rec) ? 'IDENTICAL' : 'DIFFER'} to a fresh run`)
  }
}

if (part === 'saltoff') {
  say('# Check 3e: salt off, salt parameters changed: the hash must not move')
  const base = runToEnd(build('last3'))
  const h0 = Det.stateHash(base.eng.rec)
  for (const over of [{ saltThick: 4000, saltVisc: 1e16, coverUneven: 0.5, coverSeed: 7, coverThick: 1000, weldThick: 100, coverVisc: 1e22, saltK0: 1 }, { saltOn: 0, coverBend: 0, nSaltSub: 1 }]) {
    const r = runToEnd(build('last3', over))
    say(`  last3 with ${JSON.stringify(over)}: ${Det.stateHash(r.eng.rec) === h0 ? 'IDENTICAL' : 'DIFFER'}`)
  }
  const m = runToEnd(build('mtd'))
  const m2 = runToEnd(build('mtd', { saltThick: 4000, coverUneven: 0.5, weldThick: 100 }))
  say(`  mtd with salt params changed: ${Det.stateHash(m.eng.rec) === Det.stateHash(m2.eng.rec) ? 'IDENTICAL' : 'DIFFER'}`)
  // thermal on with salt off: saltK0 must not matter
  const t1 = runToEnd(build('last3', { thermal: 1, cement: 1 }))
  const t2 = runToEnd(build('last3', { thermal: 1, cement: 1, saltK0: 1, saltKa: 0, saltKb: 0 }))
  say(`  last3 thermal+cement with salt conductivity changed: ${Det.stateHash(t1.eng.rec) === Det.stateHash(t2.eng.rec) ? 'IDENTICAL' : 'DIFFER'}`)
}

if (part === 'mtd') {
  say('# Check 3b: what a fresh debris deposit carries, and how it consolidates')
  const r = build('mtd')
  const { eng, P } = r
  const rec = eng.rec, nx = rec.nx
  const smaxM = Fail.mtdSmax(P)
  say(`mtdSmax = ${smaxM.toExponential(4)} Pa -> mud porosity ${Comp.porosity(P, 1, smaxM).toFixed(4)} (target mtdPhiMud ${P.mtdPhiMud}), sand porosity at that stress ${Comp.porosity(P, 0, smaxM).toFixed(4)} (phi0 sand ${P.phi0[0]})`)
  let seen = 0
  while (S.step(eng, P, r.sch, r.sea)) {
    const k = eng.diag.stepIndex - 1
    const evs = eng.events.filter((e) => e.step === k)
    if (!evs.length || seen >= 3) continue
    seen++
    const e = evs[0]
    say(`\nevent ${e.id} step ${k} cols ${e.sourceFrom}-${e.sourceTo} scar ${e.scarDepth.toFixed(1)} m, deposit cols ${e.depositFrom}-${e.depositTo} runout ${(e.runout / 1000).toFixed(1)} km, cause ${e.cause}, released sand ${e.sand.toFixed(0)} mud ${e.mud.toFixed(0)} exported ${(e.exportedSand + e.exportedMud).toFixed(0)}`)
    const top = rec.nLayers - 1
    const cells = []
    for (let c = e.depositFrom; c <= e.depositTo && c >= 0; c++) {
      const i = top * nx + c
      if (rec.material[i] !== 2) continue
      cells.push(c)
    }
    say(`  MTD-tagged cells in the deposit layer: ${cells.length} of ${e.depositTo - e.depositFrom + 1}`)
    const c = cells[Math.floor(cells.length / 2)]
    if (c === undefined) continue
    const i = top * nx + c
    const show = (tag) => {
      const s = rec.sand[i] + rec.mud[i]
      const bulk = Comp.cellBulk(eng, P, i)
      say(`  ${tag} col ${c} layer ${top}: solids ${s.toFixed(2)} m, bulk ${bulk.toFixed(2)} m, porosity ${(1 - s / bulk).toFixed(3)}, smax ${rec.smax[i].toExponential(3)} Pa, u ${rec.u[i].toExponential(3)} Pa, cached load ${eng.ld[i].toExponential(3)} Pa, u/L ${(eng.ld[i] > 0 ? rec.u[i] / eng.ld[i] : 0).toFixed(3)}, material ${rec.material[i]}`)
    }
    show('at deposit')
    // source column: the scar cells
    const sc = e.seedColumn
    let shown = 0
    for (let l = top; l >= 0 && shown < 3; l--) {
      const ii = l * nx + sc
      const s = rec.sand[ii] + rec.mud[ii]
      if (s <= 1e-9) continue
      say(`  scar col ${sc} layer ${l}: solids ${s.toFixed(2)} m, u ${rec.u[ii].toExponential(3)} Pa, load ${eng.ld[ii].toExponential(3)} Pa, u/L ${(eng.ld[ii] > 0 ? rec.u[ii] / eng.ld[ii] : 0).toFixed(3)}`)
      shown++
    }
    for (let n = 0; n < 20; n++) S.step(eng, P, r.sch, r.sea)
    show('20 steps (100 kyr) later')
  }
  say(`\nend: events ${eng.events.length}, stalled ${eng.events.filter((e) => e.stalled).length}, windowLimited ${eng.events.filter((e) => e.windowLimited).length}, failUnresolved ${eng.diag.failUnresolved}, clamps ${eng.diag.clamps}`)
  const m = Fail.mtdBalance(eng.events)
  say(`mtd balance: sand err ${m.sand.error.toExponential(2)} worst ${m.sand.worstRel.toExponential(2)}; mud err ${m.mud.error.toExponential(2)} worst ${m.mud.worstRel.toExponential(2)}`)
}

if (part === 'm4') {
  say('# Check 5: what M4 reads, at the end of a run (SI from the record, ppg through src/units.ts)')
  const G = K.G, RW = K.RHO_W
  const emw = (pa, depth) => U.densityToPpg(pa / (G * depth))
  for (const [id, cols] of [['gulf', [150, 250, 320]], ['mtd', [60, 80, 100]], ['last3', [60, 80, 100]]]) {
    const r = runToEnd(build(id, id === 'last3' ? { thermal: 1, cement: 1 } : {}))
    const { eng, P } = r
    const rec = eng.rec, nx = rec.nx
    const sl = r.sea(r.sch.tEndYr[r.sch.nSteps - 1])
    say(`\n${id}: sea level ${sl.toFixed(1)} m, ${eng.events.length} events`)
    let maxLam = 0, maxLamDepth = 0, maxLamCol = -1, maxU = 0
    for (let j = 0; j < nx; j++) {
      let above = 0
      for (let l = rec.nLayers - 1; l >= 0; l--) {
        const i = l * nx + j
        const s = rec.sand[i] + rec.mud[i]
        if (rec.material[i] === 1 || s <= 1e-9) continue
        const L = eng.ld[i]
        const lam = L > 0 ? rec.u[i] / L : 0
        above += Comp.cellBulk(eng, P, i)
        if (lam > maxLam) { maxLam = lam; maxLamDepth = above; maxLamCol = j }
        if (rec.u[i] > maxU) maxU = rec.u[i]
      }
    }
    say(`  largest u/L (share of buoyant load carried by excess pressure): ${maxLam.toFixed(3)} at col ${maxLamCol}, ${ft(maxLamDepth)} ft below seafloor; largest u ${(maxU / 6894.757).toFixed(0)} psi`)
    for (const j of cols) {
      const sv = new Float64Array(rec.nLayers)
      SI.columnOverburden(eng, P, sl, j, sv)
      const wd = sl - rec.H[j]
      say(`  col ${j} (x ${(j * rec.dx / 1000).toFixed(0)} km): water depth ${ft(Math.max(0, wd))} ft, surface ${rec.H[j].toFixed(0)} m, basement ${rec.b[j].toFixed(0)} m`)
      say(`    depth below seafloor (ft) | TVDSS (ft) | OBG ppg | hydro ppg | pore ppg | u/L | porosity | material`)
      let depth = 0
      let printed = 0
      for (let l = rec.nLayers - 1; l >= 0; l--) {
        const i = l * nx + j
        const s = rec.sand[i] + rec.mud[i]
        if (s <= 1e-9) continue
        const h = Comp.cellBulk(eng, P, i)
        const mid = depth + 0.5 * h
        depth += h
        const d = Math.max(0, wd) + mid // depth below sea surface (datum = sea surface when under water)
        const ovb = sv[l] - 0.5 * SI.cellWeight(eng, P, i) // stress at the cell middle
        const target = [500, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000]
        const near = target.some((t) => Math.abs(mid - t * 0.3048) < 0.5 * h + 1e-9)
        if (!near && rec.material[i] !== 1 && printed > 0) continue
        if (d <= 30) continue
        printed++
        const isSalt = rec.material[i] === 1
        const pore = isSalt ? NaN : RW * G * d + rec.u[i]
        say(`    ${ft(mid).padStart(7)} | ${ft(d).padStart(7)} | ${emw(ovb, d).toFixed(2)} | ${emw(RW * G * d, d).toFixed(2)} | ${isSalt ? '  -  ' : emw(pore, d).toFixed(2)} | ${isSalt ? '  -  ' : (eng.ld[i] > 0 ? rec.u[i] / eng.ld[i] : 0).toFixed(3)} | ${isSalt ? '0.000' : (1 - s / h).toFixed(3)} | ${isSalt ? 'salt' : rec.material[i] === 2 ? 'MTD' : 'sed'}`)
        if (printed > 14) break
      }
    }
  }
}

if (part === 'bundle') {
  say('# Check 3c/5: bundled deep compaction vs the full solve on the COUPLED presets (the documented 0.25 % / 0.4 % figures come from prescribed deposition on 3 columns)')
  const G = K.G, RW = K.RHO_W
  const emw = (pa, depth) => U.densityToPpg(pa / (G * depth))
  for (const [id, cols] of [['miocene', [60, 80, 100]], ['gulf', [150, 250, 320]]]) {
    const a = runToEnd(build(id))
    const b = runToEnd(build(id, { bundleEvery: 1 }))
    const pa = profile(a.eng), pb = profile(b.eng)
    cmp(pa, pb, `${id} bundled x${a.P.bundleEvery} vs unbundled (${a.ms.toFixed(0)} ms vs ${b.ms.toFixed(0)} ms)`)
    // pore pressure in ppg at the deepest sediment cell of a few columns
    for (const j of cols) {
      const line = []
      for (const r of [a, b]) {
        const rec = r.eng.rec, nx = rec.nx
        const sl = r.sea(r.sch.tEndYr[r.sch.nSteps - 1])
        const wd = Math.max(0, sl - rec.H[j])
        let depth = wd, best = null
        for (let l = rec.nLayers - 1; l >= 0; l--) {
          const i = l * nx + j
          const s = rec.sand[i] + rec.mud[i]
          if (s <= 1e-9) continue
          const h = Comp.cellBulk(r.eng, P_(r), i)
          const mid = depth + 0.5 * h
          depth += h
          if (rec.material[i] === 1) continue
          if (mid - wd > 3000) { best = { d: mid, pore: emw(RW * G * mid + rec.u[i], mid), lam: rec.u[i] / r.eng.ld[i] }; break }
          best = { d: mid, pore: emw(RW * G * mid + rec.u[i], mid), lam: rec.u[i] / r.eng.ld[i] }
        }
        line.push(best ? `${ft(best.d)} ft TVDSS pore ${best.pore.toFixed(2)} ppg (u/L ${best.lam.toFixed(3)})` : 'n/a')
      }
      say(`  col ${j} at about 10,000 ft below seafloor (or the base): bundled ${line[0]} | unbundled ${line[1]}`)
    }
  }
}
function P_(r) { return r.P }

if (part === 'mu') {
  say('# Check 5: sensitivity of the overpressure to the pore-water viscosity. The solver uses k/mu with mu fixed at 1e-3 Pa s (20 C).')
  say('# Water at 60-120 C has mu about 0.47-0.23e-3 Pa s, i.e. k/mu 2-4x larger. kMudMult scales mud k the same way, so kMudMult 3 stands for mu/3.')
  for (const id of ['last3', 'mtd']) {
    for (const mult of [1, 3]) {
      const base = Pr.presetParams(id).kMudMult
      const r = runToEnd(build(id, { kMudMult: base * mult }))
      const s = Sum.summarizeRecord(r.eng.rec, r.eng.events.length)
      say(`  ${id} kMudMult x${mult}: maxU ${(s.maxU / 6894.757).toFixed(0)} psi, meanH ${s.meanH.toFixed(1)} m, events ${s.events}`)
    }
  }
}

await server.close()
if (outFile) writeFileSync(outFile, out.join('\n') + '\n')
