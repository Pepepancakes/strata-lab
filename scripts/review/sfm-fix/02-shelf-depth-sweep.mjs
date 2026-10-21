// SFM-4 check 2: is shelfBreakDepth (50 m, "tuned") doing something it was not declared to do, and was it chosen to hit a number?
// Sweep 0 (the pre-SFM-2 behaviour of the depth test), 25, 50, 100, 150, 300 m on the default run, constant sea level, sine 40 m and
// 80 m (100 kyr), and the 1 Myr sine. Per case: sand beyond 100 km (% of sand supplied), mean turbidite share, share at the highest 20 %
// of sea level, corr(sea level, share), shoreline. The point is whether any SFM-R target flips with the value: if none does, the
// value was not what made the result.
// Also: the highstand share by the two definitions in use (user guide says "under 5 % at highstand" for 40 m and 80 m).
//   node scripts/review/sfm-fix/02-shelf-depth-sweep.mjs
import { runCase, close, platform, f, corr, sandBeyond100, shorelineX, sum } from './lib.mjs'

console.log(`SFM-4 02 shelfBreakDepth sweep. ${platform}`)
const cases = [
  ['default (published curve)', {}],
  ['constant sea level', { seaLevelKind: 'sine', slAmp: 0 }],
  ['sine 40 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 40 }],
  ['sine 80 m / 100 kyr', { seaLevelKind: 'sine', slAmp: 80 }],
  ['sine 40 m / 1 Myr', { seaLevelKind: 'sine', slAmp: 40, slPeriod: 1e6 }],
]
for (const [label, over] of cases) {
  console.log(`== ${label}`)
  for (const d of [0, 25, 50, 100, 150, 300]) {
    const r = await runCase({ over: { ...over, shelfBreakDepth: d } })
    const { sea, share } = r.trace
    const n = share.length
    const sorted = [...sea].sort((x, y) => x - y)
    const top20 = share.filter((_, i) => sea[i] >= sorted[Math.floor(0.8 * n)])
    const mx = Math.max(...sea)
    const top80 = share.filter((_, i) => sea[i] >= 0.8 * mx) // the definition used in tests/shelfEdge.test.ts
    const c = corr(sea, share)
    console.log(`  depth ${String(d).padStart(3)} m: sand beyond 100 km ${f(sandBeyond100(r.eng, r.P), 2)} %, mean share ${f(sum(share) / n)}, highest-20%-of-steps share ${f(sum(top20) / top20.length)}, steps >= 0.8 x max sea level share ${top80.length ? f(sum(top80) / top80.length) : '-'}, corr ${f(c)}, shoreline ${f(shorelineX(r.eng.rec.H, r.P.dx, sea.at(-1)) / 1000, 1)} km`)
  }
}
await close()
