// SFM-4 check 4: user-guide claims about the new shelf-edge behaviour, measured.
//  (a) "the shelf fills within about 0.3 Myr": first time after which shelf edge - shoreline stays <= 2 km at constant sea level.
//  (b) the share of the routed (turbidite) sand and mud that leaves past the basinward edge, by section length (150, 300, 400 km),
//      so "sand lands near the foot of the slope" can be compared with where it goes.
//   node scripts/review/sfm-fix/04-claims.mjs
import { runCase, close, platform, f, sum } from './lib.mjs'

console.log(`SFM-4 04 user-guide claims. ${platform}`)
{
  const r = await runCase({ over: { seaLevelKind: 'sine', slAmp: 0 } })
  const { shore, edge } = r.trace
  const n = shore.length
  const dist = shore.map((s, i) => (edge[i] >= 0 && s >= 0 ? edge[i] - s : 99))
  let k = dist.findIndex((d) => d <= 2)
  const after = dist.slice(k)
  const within = (lim) => after.filter((d) => d <= lim).length
  console.log(`(a) constant sea level: shelf edge first within 2 km of the shoreline at step ${k} = ${f(k * r.P.dtRec / 1e6, 3)} Myr; of the ${after.length} steps from then on, ${within(2)} are within 2 km, ${within(4)} within 4 km, median ${[...after].sort((a, b) => a - b)[Math.floor(after.length / 2)]} km (first-step distances: ${dist.slice(0, 8).join(', ')} km)`)
  const kc = r.trace.share.findIndex((s) => s >= 0.9 * r.P.tcMax)
  console.log(`(a2) constant sea level: turbidite share first reaches 0.9 x cap at step ${kc} = ${f(kc * r.P.dtRec / 1e6, 3)} Myr; mean share before ${f(sum(r.trace.share, 0, kc) / Math.max(1, kc))}, after ${f(sum(r.trace.share, kc) / (n - kc))}`)
}
for (const nx of [150, 300, 400]) {
  const r = await runCase({ over: { seaLevelKind: 'sine', slAmp: 0, nx } })
  const led = r.eng.rec.ledger
  console.log(`(b) nx ${nx}: edge export sand ${f(100 * led.cumEdge.sand / led.cumIn.sand, 1)} % / mud ${f(100 * led.cumEdge.mud / led.cumIn.mud, 1)} % of supply; turbidite-leftover and other export sand ${f(100 * (led.cumOut.sand - led.cumEdge.sand) / led.cumIn.sand, 1)} % / mud ${f(100 * (led.cumOut.mud - led.cumEdge.mud) / led.cumIn.mud, 1)} %; sea floor at 150 km ${f(r.eng.rec.H[149], 0)} m`)
}
await close()
