// SFM-R test 1: steady supply, constant sea level, no subsidence, no turbidites.
// Does the coastal plain reach the diffusion grade S = q/K (Paola-type graded profile), does the
// subaqueous foreset reach q/Kg, and does the shoreline sit where a geometric fill of the initial
// profile (plain at S_plain, foreset at S_foreset, uncompacted) puts it?
//
//   node scripts/review/sfm/01-steady.mjs
import { run, close, platform, shorelineX, fitSlope, steepest, f, m_ft, km, deg, FT } from './lib.mjs'
import { initialSurface } from './initial.mjs'

console.log(`SFM-R 01 steady state. ${platform}`)
const base = { seaLevelKind: 'sine', slAmp: 0, slShift: 0, subsShelf: 0, subsBasin: 0, tcMax: 0, duration: 3e6 }

async function one(label, over) {
  const { eng, P, sched, trace } = await run({ ...base, ...over })
  const rec = eng.rec, nx = rec.nx, dx = P.dx, H = rec.H
  const top = rec.nLayers - 1
  const sl = 0
  const xs = shorelineX(H, dx, sl)
  const js = Math.floor(xs / dx)
  // bulk supply and the active-layer mix: K_eff the code would use on the plain
  const pS = 1 - P.phi0[0], pM = 1 - P.phi0[1]
  const qS = P.supply * P.sandFrac / pS, qM = P.supply * (1 - P.sandFrac) / pM
  const q0 = qS + qM
  // sand share of the LAST layer on the plain (what the active layer sees, approximately)
  let s = 0, m = 0
  for (let j = 2; j < js - 2; j++) { s += rec.sand[top * nx + j]; m += rec.mud[top * nx + j] }
  const F = s + m > 0 ? s / (s + m) : P.sandFrac
  const Kc = P.Kc[0] * F + P.Kc[1] * (1 - F)
  const Kg = P.Kg[0] * F + P.Kg[1] * (1 - F)
  // aggradation on the plain over the last step, bulk m^2/yr (reduces the flux reaching the shoreline)
  const dt = sched.stepDt[sched.nSteps - 1]
  let agg = 0
  for (let j = 0; j < js; j++) agg += (rec.sand[top * nx + j] / pS + rec.mud[top * nx + j] / pM) * dx / dt
  const Splain = fitSlope(H, dx, 2, Math.max(3, js - 3))
  const Sprox = fitSlope(H, dx, 1, 6)
  const st = steepest(H, dx, js + 1)
  // foreset: mean gradient where water depth is > 5 dm (K has reached Kg) down to where the slope drops to half
  let a = -1, b = -1
  for (let j = js; j < nx - 1; j++) {
    const d = sl - 0.5 * (H[j] + H[j + 1])
    const g = (H[j] - H[j + 1]) / dx
    if (a < 0 && d > 5 * Math.max(P.dm[0], P.dm[1])) a = j
    if (a >= 0 && g < 0.5 * st.grad) { b = j; break }
  }
  const Sfore = a >= 0 && b > a + 1 ? fitSlope(H, dx, a, b) : NaN
  // geometric fill: plain of slope Splain landward of xs at sea level, foreset of slope Sfore basinward, over the initial profile
  const qBulkT = q0 * sched.tEndYr[sched.nSteps - 1]
  const area = (x0) => {
    let A = 0
    for (let j = 0; j < nx; j++) {
      const x = (j + 0.5) * dx
      const z0 = initialSurface(x)
      const z = x <= x0 ? sl + (x0 - x) * Splain : sl - (x - x0) * Sfore
      if (z > z0) A += (z - z0) * dx
    }
    return A
  }
  let lo = 0, hi = nx * dx
  for (let i = 0; i < 60; i++) { const mid = 0.5 * (lo + hi); if (area(mid) < qBulkT) lo = mid; else hi = mid }
  const xHand = 0.5 * (lo + hi)
  // stored bulk vs delivered bulk (compaction shrinks the pile; the hand fill ignores that)
  let bulk = 0
  for (let j = 0; j < nx; j++) bulk += (H[j] - initialSurface((j + 0.5) * dx)) * dx
  const bulkRatio = bulk / qBulkT
  // the same fill with the bulk actually stored (tests the plain + foreset geometry alone)
  lo = 0; hi = nx * dx
  for (let i = 0; i < 60; i++) { const mid = 0.5 * (lo + hi); if (area(mid) < bulk) lo = mid; else hi = mid }
  const xHandStored = 0.5 * (lo + hi)
  console.log(`\n== ${label} ==`)
  console.log(`  supply ${P.supply} m2/yr solid = ${f(q0, 1)} m2/yr bulk at phi0; last-layer plain sand share F = ${f(F, 3)}`)
  console.log(`  plain aggradation over the last step ${f(agg, 2)} m2/yr bulk (${f(100 * agg / q0, 1)} % of supply)`)
  // the plain's flux falls from q0 at x = 0 to q0 - agg at the shoreline, so the grade q/K does too:
  // proximal slope is tested against q0 / Kc, the distal slope against (q0 - agg) / Kc(F_distal)
  let sd = 0, md = 0
  for (let j = Math.max(1, js - 9); j < js - 2; j++) { sd += rec.sand[top * nx + j]; md += rec.mud[top * nx + j] }
  const Fd = sd + md > 0 ? sd / (sd + md) : F
  const Kcd = P.Kc[0] * Fd + P.Kc[1] * (1 - Fd)
  const Sdist = fitSlope(H, dx, Math.max(1, js - 9), js - 2)
  const Fimp = (q0 / Sprox - P.Kc[1]) / (P.Kc[0] - P.Kc[1]) // sand share that makes q0/Kc equal the measured proximal slope
  console.log(`  coastal plain slope (fit cols 2..${js - 3})   ${f(Splain * 1000, 3)} m/km  (${f(Splain * 5280, 2)} ft/mi)`)
  console.log(`  proximal plain slope (cols 1..6)             ${f(Sprox * 1000, 3)} m/km;  grade q0/Kc(F last layer ${f(F, 3)}) = ${f(q0 / Kc * 1000, 3)} m/km (error ${f(100 * (Sprox / (q0 / Kc) - 1), 1)} %); the active-layer sand share that gives the measured slope exactly: ${f(Fimp, 3)}`)
  console.log(`  distal plain slope (cols ${Math.max(1, js - 9)}..${js - 2})          ${f(Sdist * 1000, 3)} m/km;  grade (q0 - agg)/Kc(F ${f(Fd, 3)}) = ${f((q0 - agg) / Kcd * 1000, 3)} m/km (error ${f(100 * (Sdist / ((q0 - agg) / Kcd) - 1), 1)} %)`)
  console.log(`  shoreline at ${km(xs, 2)} (${f(xs * FT / 5280, 2)} mi); initial shoreline 10.0 km`)
  // progradation rate over the last third of the run against q_shore / (water depth in front of the foreset + plain slope term)
  const kA = Math.round(0.67 * (trace.t.length - 1)), kB = trace.t.length - 1
  const rate = (trace.shoreX[kB] - trace.shoreX[kA]) / (trace.t[kB] - trace.t[kA]) // m/yr
  const toe = b > 0 ? b : Math.min(nx - 1, js + 20)
  const depthToe = sl - initialSurface((toe + 0.5) * dx) // basin depth the foreset is filling, from the initial surface
  console.log(`  progradation rate, last third: ${f(rate * 1000, 1)} m/kyr = ${f(rate * 1e6 / 1000, 1)} km/Myr; hand: (q0 - agg) / toe depth ${f(depthToe, 0)} m = ${f((q0 - agg) / depthToe * 1000, 1)} m/kyr (uncompacted), x stored/delivered ${f(bulkRatio, 3)} = ${f((q0 - agg) / depthToe * 1000 * bulkRatio, 1)} m/kyr`)
  console.log(`  steepest marine gradient ${f(st.grad, 4)} (${deg(st.grad)}) at col ${st.at}; foreset fit cols ${a}..${b}: ${f(Sfore, 4)} (${deg(Sfore)}); expected q/Kg(F) = ${f((q0 - agg) / Kg, 4)} (${deg((q0 - agg) / Kg)})`)
  console.log(`  hand fill (uncompacted, plain ${f(Splain * 1000, 2)} m/km, foreset ${f(Sfore, 4)}): shoreline ${km(xHand, 2)}; model - hand = ${m_ft(xs - xHand)}`)
  console.log(`  hand fill with the STORED bulk (geometry only):  shoreline ${km(xHandStored, 2)}; model - hand = ${m_ft(xs - xHandStored)}`)
  console.log(`  bulk stored above the initial surface ${f(bulk / 1e6, 3)} km2 vs delivered ${f(qBulkT / 1e6, 3)} km2 (ratio ${f(bulk / qBulkT, 3)}: compaction)`)
  console.log(`  shoreline trajectory (km): ${[0.1, 0.25, 0.5, 0.75, 1].map((p) => { const k = Math.round(p * (trace.t.length - 1)); return `${f(trace.t[k] / 1e6, 2)} Myr ${f(trace.shoreX[k] / 1000, 1)}` }).join('; ')}`)
  console.log(`  surface at the basinward edge rose ${m_ft(H[nx - 1] - initialSurface((nx - 0.5) * dx))} (closed boundary)`)
  return { xs, Splain, Sfore }
}

await one('A: all mud (sandFrac 0)', { sandFrac: 0 })
await one('B: all sand (sandFrac 1)', { sandFrac: 1 })
await one('C: default mix (sandFrac 0.35)', {})
await one('D: default mix, half supply (10 m2/yr)', { supply: 10 })
await close()
