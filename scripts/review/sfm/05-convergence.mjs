// SFM-R test 5: grid and time-step convergence. dx halved (nx doubled), transport substep halved
// (nSub doubled) and record step halved (dtRec 2500), for a constant-sea-level run and the default
// published-curve run. Compared: shoreline position, steepest marine gradient, coastal-plain slope,
// sand stored beyond 100 km, mean turbidite share, shelf-edge position.
//
//   node scripts/review/sfm/05-convergence.mjs
import { run, close, platform, depositByColumn, fitSlope, steepest, shorelineX, f, km, m_ft, deg, sum } from './lib.mjs'

console.log(`SFM-R 05 convergence. ${platform}`)

async function measure(over, segments) {
  const { eng, P, trace } = await run(over, segments)
  const rec = eng.rec, nx = rec.nx, dx = P.dx, H = rec.H
  const sl = trace.sea[trace.sea.length - 1]
  const xs = shorelineX(H, dx, sl)
  const js = Math.max(3, Math.floor(xs / dx))
  const st = steepest(H, dx, js + 1)
  const dep = depositByColumn(rec)
  const j1 = Math.round(100000 / dx)
  const sand100 = sum(dep.sand, j1) * dx
  // time-mean shoreline over the last 1 Myr (less noisy than the final value under a wiggly curve)
  const n = trace.t.length, k0 = Math.floor(n * 2 / 3)
  const meanXs = sum(trace.shoreX, k0) / (n - k0)
  const meanEdge = sum(trace.edge.map((e) => e * dx), k0) / (n - k0)
  return { xs, meanXs, meanEdge, steep: st.grad, plain: fitSlope(H, dx, 1, js - 2), sand100, share: sum(trace.share) / n, Hedge: H[nx - 1] }
}

function table(base, rows) {
  const keys = [['xs', 'shoreline at end', (v) => km(v, 2)], ['meanXs', 'mean shoreline, last 1 Myr', (v) => km(v, 2)], ['meanEdge', 'mean shelf edge, last 1 Myr', (v) => km(v, 2)],
    ['steep', 'steepest marine gradient', (v) => `${f(v, 4)} (${deg(v)})`], ['plain', 'plain slope m/km', (v) => f(v * 1000, 3)],
    ['sand100', 'sand beyond 100 km, solid km2', (v) => f(v / 1e6, 3)], ['share', 'mean tc share', (v) => f(v, 3)], ['Hedge', 'surface at the basinward edge', (v) => m_ft(v)]]
  for (const [k, label, fmt] of keys) {
    console.log(`  ${label.padEnd(30)} ${rows.map(([name, r]) => `${name}: ${fmt(r[k])}${name === rows[0][0] ? '' : ` (${k === 'xs' || k === 'meanXs' || k === 'meanEdge' || k === 'Hedge' ? m_ft(r[k] - base[k]) : f(100 * (r[k] / base[k] - 1), 1) + ' %'})`}`).join(' | ')}`)
  }
}

for (const [label, over] of [['constant sea level, default supply/subsidence/turbidites', { seaLevelKind: 'sine', slAmp: 0 }], ['published curve (default run)', {}]]) {
  console.log(`\n== ${label} ==`)
  const base = await measure(over)
  const dxHalf = await measure({ ...over, nx: 300, dx: 500 })
  const nSub2 = await measure({ ...over, nSub: 10 })
  const dtHalf = await measure({ ...over, dtRec: 2500 }, [{ fromAgeMa: 3, toAgeMa: 0, dt: 2500 }])
  const nSub1 = await measure({ ...over, nSub: 1 }) // 5 kyr transport step: the implicit solve has no CFL limit, but K and the sorting pass are explicit
  const dxDouble = await measure({ ...over, nx: 75, dx: 2000 }) // the record allows at most 400 columns, so the sequence is 2000 / 1000 / 500
  table(base, [['base (dx 1000, dt 5000/5)', base], ['dx 2000', dxDouble], ['dx 500', dxHalf], ['nSub 1', nSub1], ['nSub 10', nSub2], ['dtRec 2500', dtHalf]])
}
await close()
