// SFM-R test 4: turbidites. (a) When is the rule triggered: shelf edge - shoreline distance and
// share through a run, and the surface gradient in the first marine columns (is the 'shelf edge'
// the shoreface?). (b) Where does the routed flux land: routeTurbidites() applied to a copy of the
// final surface, thickness against distance from the shelf edge, exported share. (c) What sets the
// volume: basin-floor sand against supply, sandFrac and tcMax.
//
//   node scripts/review/sfm/04-turbidites.mjs
import { run, close, engine, platform, depositByColumn, f, km, m_ft, deg, sum, FT } from './lib.mjs'

console.log(`SFM-R 04 turbidites. ${platform}`)
const { Turb } = await engine()

function gradients(H, dx, js, n = 8) {
  const out = []
  for (let j = js - 2; j < js + n; j++) out.push(`${j}:${f((H[j] - H[j + 1]) / dx, 4)}`)
  return out.join(' ')
}

// (a) trigger: constant sea level, default everything else (turbidites on)
{
  const { eng, P, trace } = await run({ seaLevelKind: 'sine', slAmp: 0 })
  const n = trace.t.length
  const same = trace.edge.filter((e, i) => e === trace.shore[i]).length
  const H = eng.rec.H, js = eng.diag.shore
  console.log(`\n== (a) constant sea level, default supply and subsidence, tcMax ${P.tcMax} ==`)
  console.log(`  steps where the detected shelf edge IS the shoreline column: ${same} of ${n}; mean tc share ${f(sum(trace.share) / n, 3)}`)
  console.log(`  end of run: shoreline col ${js} (${km(js * P.dx)}), shelf edge col ${eng.diag.shelfEdge}, sBreak ${P.sBreak}`)
  console.log(`  surface gradient per face from two columns landward of the shoreline: ${gradients(H, P.dx, js)}`)
  console.log(`  -> the first marine face is steeper than sBreak: the K drop from Kc to Km + Kg at the shoreline builds a shoreface steeper than 1 %, so the rule reads the shoreface as the shelf edge`)
  // what would the gradient need to be? marine K at the shoreline for the flux reaching it
  const F = 0.5
  const Kshore = (P.Km[0] + P.Kg[0]) * F + (P.Km[1] + P.Kg[1]) * (1 - F)
  const q = P.supply * P.sandFrac / (1 - P.phi0[0]) + P.supply * (1 - P.sandFrac) / (1 - P.phi0[1])
  console.log(`  hand: a flux of ${f(q, 1)} m2/yr bulk through a face with K = ${f(Kshore, 0)} m2/yr (shoreline K at F = 0.5) needs a gradient of ${f(q / Kshore, 4)} = ${f(q / Kshore / P.sBreak, 1)} x sBreak; even 10 % of the supply needs ${f(0.1 * q / Kshore / P.sBreak, 1)} x sBreak`)
}

// published curve: share against sea level, binned
{
  const { trace, P } = await run({})
  const bins = [[-150, -80], [-80, -40], [-40, -20], [-20, 0], [0, 50]]
  console.log(`\n== (a2) published curve, default run: tc share by sea-level band ==`)
  for (const [lo, hi] of bins) {
    const idx = trace.sea.map((s, i) => (s >= lo && s < hi ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) continue
    const sh = idx.map((i) => trace.share[i])
    const cap = sh.filter((s) => s >= 0.999 * P.tcMax).length
    const dist = idx.map((i) => (trace.edge[i] - trace.shore[i]) * P.dx / 1000)
    console.log(`  sea level ${lo} to ${hi} m: ${idx.length} steps, mean share ${f(sum(sh) / sh.length, 3)}, at cap ${cap} (${f(100 * cap / idx.length, 0)} %), median shelf edge - shoreline ${f(dist.sort((a, b) => a - b)[Math.floor(dist.length / 2)], 1)} km`)
  }
}

// (b) run-out on the final surface of the default run
{
  const { eng, P } = await run({})
  const rec = eng.rec, nx = rec.nx, dx = P.dx
  const H = Float64Array.from(rec.H)
  const sand = new Float64Array(nx), mud = new Float64Array(nx)
  const je = eng.diag.shelfEdge, js = eng.diag.shore
  const pS = 1 - P.phi0[0], pM = 1 - P.phi0[1]
  const qS = P.supply * P.sandFrac / pS, qM = P.supply * (1 - P.sandFrac) / pM
  const q = [qS, qM]
  const dt = 1000
  Turb.routeTurbidites(H, sand, mud, 0, nx, P, je, q, pS, pM, dt)
  console.log(`\n== (b) routeTurbidites on the final surface of the default run (1 kyr of the whole supply, share 1) ==`)
  console.log(`  shoreline col ${js}, shelf edge col ${je} (${km(je * dx)}); gradient at the shelf edge ${f((rec.H[je] - rec.H[je + 1]) / dx, 4)} (${deg((rec.H[je] - rec.H[je + 1]) / dx)})`)
  console.log(`  exported past the basinward edge: sand ${f(100 * q[0] / qS, 1)} %, mud ${f(100 * q[1] / qM, 1)} % of the routed flux`)
  const cum = (arr, tot) => { let c = 0; const out = []; for (let j = je; j < nx; j++) { c += arr[j]; out.push(c / tot) } return out }
  const cs = cum(sand, qS * pS * dt / dx), cm = cum(mud, qM * pM * dt / dx)
  const at = (c, p) => { const i = c.findIndex((v) => v >= p); return i < 0 ? 'not reached' : km((i) * dx, 0) }
  console.log(`  sand deposited: 25 % within ${at(cs, 0.25)} of the shelf edge, 50 % within ${at(cs, 0.5)}, 90 % within ${at(cs, 0.9)}; thickest cell col ${sand.indexOf(Math.max(...sand))} (${km((sand.indexOf(Math.max(...sand)) - je) * dx, 0)} from the edge), ${m_ft(Math.max(...sand) / pS, 2)} bulk per kyr`)
  console.log(`  mud deposited:  25 % within ${at(cm, 0.25)}, 50 % within ${at(cm, 0.5)}, 90 % within ${at(cm, 0.9)}`)
  // gradient profile and the deposition length L it gives
  const rows = []
  for (let j = je; j < nx; j += Math.max(1, Math.floor((nx - je) / 12))) {
    let sl = j < nx - 1 ? (rec.H[j] - rec.H[j + 1]) / dx : (rec.H[j - 1] - rec.H[j]) / dx
    if (sl < 1e-5) sl = 1e-5
    const L = P.tcL0[0] * Math.pow(sl / P.tcSref, P.tcN)
    rows.push(`${km(j * dx, 0)}: S ${f(sl, 4)}, L_sand ${f(L / 1000, 0)} km, sand ${f(sand[j] / pS, 3)} m, mud ${f(mud[j] / pM, 3)} m`)
  }
  console.log(`  profile (x: gradient, sand run-out length, deposit per kyr at full supply):\n    ${rows.join('\n    ')}`)
}

// (c) what sets the basin-floor sand volume
{
  const cases = [
    ['default', {}],
    ['supply 30', { supply: 30 }],
    ['sandFrac 0.5', { sandFrac: 0.5 }],
    ['tcMax 0.3', { tcMax: 0.3 }],
    ['tcMax 0', { tcMax: 0 }],
    ['constant sea level', { seaLevelKind: 'sine', slAmp: 0 }],
    ['sine 40 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 40 }],
    ['sine 80 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 80 }],
  ]
  console.log(`\n== (c) sand and mud stored beyond 70 km (the initial slope foot is at 65 km), solid m2, 3 Myr ==`)
  for (const [label, over] of cases) {
    const { eng, P, trace } = await run(over)
    const dep = depositByColumn(eng.rec)
    const j0 = Math.round(70000 / P.dx), j1 = Math.round(100000 / P.dx)
    const s = sum(dep.sand, j0) * P.dx, m = sum(dep.mud, j0) * P.dx
    const s1 = sum(dep.sand, j1) * P.dx, m1 = sum(dep.mud, j1) * P.dx
    const supS = P.supply * P.sandFrac * 3e6, supM = P.supply * (1 - P.sandFrac) * 3e6
    const meanShare = sum(trace.share) / trace.share.length
    const led = eng.rec.ledger
    const xsMax = Math.max(...trace.shoreX)
    console.log(`  ${label.padEnd(20)} beyond 70 km: sand ${f(s / 1e6, 3)} km2 (${f(100 * s / supS, 1)} % of sand supplied), mud ${f(m / 1e6, 3)} km2 (${f(100 * m / supM, 1)} %), sand/mud ${f(s / m, 3)}; beyond 100 km: sand ${f(s1 / 1e6, 3)} km2 (${f(100 * s1 / supS, 1)} %), mud ${f(m1 / 1e6, 3)} km2 (${f(100 * m1 / supM, 1)} %); exported sand ${f(100 * led.cumOut.sand / supS, 1)} %, mud ${f(100 * led.cumOut.mud / supM, 1)} %; mean tc share ${f(meanShare, 3)}; most basinward shoreline ${km(xsMax, 0)}`)
  }
  console.log(`  hand: routed sand = supply x sandFrac x share x (1 - exported share); the shelf has no say in it (transport.ts:98-100, 249-250)`)
}
// (d) is the shoreface the problem? The slow 1 Myr cycle again with a steeper sBreak (not a tuning
// proposal: it shows what the detector is reading). A lowstand rule should give a clearly negative
// correlation between sea level and share.
{
  console.log(`\n== (d) slow sine 40 m / 1 Myr: sBreak against the lowstand signal ==`)
  for (const sBreak of [0.01, 0.02, 0.03, 0.05]) {
    const { trace, P } = await run({ seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e6, sBreak })
    const n = trace.t.length
    const atCap = trace.share.filter((s) => s >= 0.999 * P.tcMax).length
    const ma = sum(trace.sea) / n, mb = sum(trace.share) / n
    let sab = 0, saa = 0, sbb = 0
    for (let i = 0; i < n; i++) { sab += (trace.sea[i] - ma) * (trace.share[i] - mb); saa += (trace.sea[i] - ma) ** 2; sbb += (trace.share[i] - mb) ** 2 }
    const dist = trace.edge.map((e, i) => (e - trace.shore[i]) * P.dx / 1000).sort((a, b) => a - b)
    console.log(`  sBreak ${sBreak}: mean share ${f(mb, 3)}, at cap ${atCap} of ${n}, median shelf edge - shoreline ${f(dist[Math.floor(n / 2)], 1)} km, corr(sea level, share) ${f(sab / Math.sqrt(saa * sbb), 3)}`)
  }
}
await close()
void FT
