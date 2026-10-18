// SFM-R test 2: accommodation vs supply. One slow sea-level cycle (sine, 40 m, 1 Myr) and the
// default 100 kyr sine, fixed supply, default subsidence, turbidites on (default). Records the
// shoreline and shelf-edge trajectories and classifies each step: transgression (shoreline
// landward), normal regression (basinward while sea level steady or rising), forced regression
// (basinward while sea level falls). Hand check: on a plain of slope S a rise dSL moves the
// shoreline landward by dSL / S, less the progradation in that time.
//
//   node scripts/review/sfm/02-sealevel.mjs
import { run, close, platform, f, km, m_ft } from './lib.mjs'

console.log(`SFM-R 02 accommodation vs supply. ${platform}`)

async function cycle(label, over, segments) {
  const Hs = []
  const { P, trace } = await run(over, segments, (e) => Hs.push(Float64Array.from(e.rec.H)))
  const n = trace.t.length
  const dx = P.dx
  // classify steps
  let trans = 0, normal = 0, forced = 0, flat = 0
  const phase = []
  for (let k = 1; k < n; k++) {
    const dxS = trace.shoreX[k] - trace.shoreX[k - 1]
    const dS = trace.sea[k] - trace.sea[k - 1]
    let c
    if (Math.abs(dxS) < 1e-6) { c = 'flat'; flat++ }
    else if (dxS < 0) { c = 'T'; trans++ }
    else if (dS < 0) { c = 'FR'; forced++ }
    else { c = 'NR'; normal++ }
    phase.push(c)
  }
  console.log(`\n== ${label} ==`)
  console.log(`  steps: transgression ${trans}, normal regression ${normal}, forced regression ${forced}, flat ${flat} (of ${n - 1})`)
  // sea-level turning points and the shoreline's response (lag, amount)
  const turns = []
  for (let k = 1; k < n - 1; k++) {
    const a = trace.sea[k] - trace.sea[k - 1], b = trace.sea[k + 1] - trace.sea[k]
    if (a > 0 && b <= 0) turns.push({ k, kind: 'high' })
    if (a < 0 && b >= 0) turns.push({ k, kind: 'low' })
  }
  for (const tp of turns.slice(0, 6)) {
    // shoreline extreme within +-30 % of a period around the turn
    const w = Math.max(2, Math.round(0.3 * P.slPeriod / P.dtRec))
    let kx = tp.k
    for (let k = Math.max(0, tp.k - w); k <= Math.min(n - 1, tp.k + w); k++) {
      if (tp.kind === 'high' ? trace.shoreX[k] < trace.shoreX[kx] : trace.shoreX[k] > trace.shoreX[kx]) kx = k
    }
    console.log(`  sea-level ${tp.kind}stand at ${f(trace.t[tp.k] / 1e6, 3)} Myr (${f(trace.sea[tp.k], 1)} m): shoreline ${tp.kind === 'high' ? 'most landward' : 'most basinward'} at ${f(trace.t[kx] / 1e6, 3)} Myr, lag ${f((trace.t[kx] - trace.t[tp.k]) / 1e3, 0)} kyr, shoreline ${km(trace.shoreX[kx], 1)}, shelf edge col ${trace.edge[kx]} (${km(trace.edge[kx] * dx, 0)}), tc share ${f(trace.share[kx], 3)}`)
  }
  // hand check at every turning point after the first: where would the shoreline be with NO deposition
  // between the previous turn and this one? Take the surface at the previous turn, lower it by the
  // subsidence over the interval (linear ramp, constant mode), and find where it crosses the new sea
  // level. Deposition can only move the shoreline basinward of that line, so measured - hand is the
  // supply's contribution (positive = regression by filling).
  for (let i = 1; i < Math.min(turns.length, 6); i++) {
    const a = turns[i - 1], b = turns[i]
    const dt = trace.t[b.k] - trace.t[a.k]
    const H0 = Hs[a.k], slB = trace.sea[b.k]
    let xFlood = -1
    for (let j = 1; j < H0.length; j++) {
      const subs = (j0) => (P.subsShelf + (P.subsBasin - P.subsShelf) * (j0 + 0.5) / H0.length) * 1e-6 * dt
      const h0 = H0[j - 1] - subs(j - 1), h1 = H0[j] - subs(j)
      if (h1 < slB) { xFlood = ((j - 1 + 0.5) + (h0 - slB) / (h0 - h1)) * dx; break }
    }
    const xs = trace.shoreX[b.k]
    console.log(`  ${a.kind}stand -> ${b.kind}stand (${f(trace.sea[a.k], 0)} -> ${f(slB, 0)} m over ${f(dt / 1e3, 0)} kyr): no-deposition line ${km(xFlood, 1)}, measured shoreline ${km(xs, 1)}; filling moved it ${m_ft(xs - xFlood)} basinward`)
  }
  // phase string, one char per 20 steps, for the eye
  const every = Math.max(1, Math.round((n - 1) / 60))
  console.log(`  phases (every ${every} steps, T transgression, N normal regression, F forced regression): ${phase.filter((_, i) => i % every === 0).map((c) => c[0]).join('')}`)
  console.log(`  sea level  (same sampling, m):  ${trace.sea.filter((_, i) => i % every === 0).map((v) => f(v, 0)).join(' ')}`)
  console.log(`  shoreline  (same sampling, km): ${trace.shoreX.filter((_, i) => i % every === 0).map((v) => f(v / 1000, 0)).join(' ')}`)
  console.log(`  shelf edge (same sampling, km): ${trace.edge.filter((_, i) => i % every === 0).map((v) => f(v * dx / 1000, 0)).join(' ')}`)
  console.log(`  tc share   (same sampling):     ${trace.share.filter((_, i) => i % every === 0).map((v) => f(v, 2)).join(' ')}`)
  const edgeMinusShore = trace.edge.map((e, i) => (e - trace.shore[i]) * dx / 1000)
  const atMax = trace.share.filter((s) => s >= P.tcMax * 0.999).length
  console.log(`  shelf edge - shoreline: min ${f(Math.min(...edgeMinusShore), 1)} km, median ${f(median(edgeMinusShore), 1)} km, max ${f(Math.max(...edgeMinusShore), 1)} km; steps with tc share at its cap (${P.tcMax}): ${atMax} of ${n}`)
  console.log(`  correlation(sea level, tc share) = ${f(corr(trace.sea, trace.share), 3)} (a lowstand rule should give a clearly negative value)`)
}

function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
function corr(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return sab / Math.sqrt(saa * sbb)
}

await cycle('A: slow sine, 40 m, 1 Myr period, 3 Myr run (default supply 20, subsidence 40/150)', { seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e6 })
await cycle('B: default teaching sine, 40 m, 100 kyr', { seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e5 })
await cycle('C: published curve (default run)', {})
await cycle('D: slow sine, 40 m, 1 Myr, turbidites off (tcMax 0)', { seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e6, tcMax: 0 })
await close()
