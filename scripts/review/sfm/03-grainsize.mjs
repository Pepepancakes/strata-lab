// SFM-R test 3: grain-size fractionation down-dip. Sand share of what was deposited during the run,
// by zone (coastal plain, shelf, slope, basin floor as defined by the FINAL surface and sea level),
// for the default run and the constant-sea-level run; and the sand share of the coastal-plain
// deposit against the supply's sand share (does mud bypass the plain entirely?).
//
//   node scripts/review/sfm/03-grainsize.mjs
import { run, close, platform, depositByColumn, f, km, sum } from './lib.mjs'

console.log(`SFM-R 03 grain-size fractionation. ${platform}`)

async function zones(label, over) {
  const { eng, P, trace } = await run(over)
  const rec = eng.rec, nx = rec.nx, dx = P.dx, H = rec.H
  const sl = trace.sea[trace.sea.length - 1]
  const dep = depositByColumn(rec)
  // zones from the final surface: land (H >= sl), shelf (depth < 200 m), slope (gradient > 0.005 and depth > 200 m), floor
  const zone = new Array(nx).fill('floor')
  for (let j = 0; j < nx; j++) {
    const d = sl - H[j]
    const g = j < nx - 1 ? (H[j] - H[j + 1]) / dx : 0
    if (d <= 0) zone[j] = 'plain'
    else if (d < 200) zone[j] = 'shelf'
    else if (g > 0.005) zone[j] = 'slope'
  }
  console.log(`\n== ${label} (sea level at the end ${f(sl, 1)} m; supply sand share ${P.sandFrac}) ==`)
  for (const z of ['plain', 'shelf', 'slope', 'floor']) {
    const idx = zone.map((v, i) => (v === z ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) { console.log(`  ${z.padEnd(6)} none`); continue }
    const s = idx.reduce((a, j) => a + dep.sand[j], 0) * dx, m = idx.reduce((a, j) => a + dep.mud[j], 0) * dx
    console.log(`  ${z.padEnd(6)} cols ${idx[0]}..${idx[idx.length - 1]} (${km(idx[0] * dx, 0)} to ${km((idx[idx.length - 1] + 1) * dx, 0)}): sand ${f(s / 1e6, 2)} km2, mud ${f(m / 1e6, 2)} km2, sand share ${f(s / (s + m), 3)}`)
  }
  // down-dip sand share in 15 km bands
  const bands = []
  for (let j0 = 0; j0 < nx; j0 += Math.round(15000 / dx)) {
    const j1 = Math.min(nx, j0 + Math.round(15000 / dx))
    const s = sum(dep.sand, j0, j1), m = sum(dep.mud, j0, j1)
    bands.push(`${km(j0 * dx, 0)}:${s + m > 0 ? f(s / (s + m), 2) : '-'}`)
  }
  console.log(`  sand share by 15 km band: ${bands.join(' ')}`)
  // monotonic? count band-to-band increases of sand share basinward
  const vals = bands.map((b) => parseFloat(b.split(':')[1])).filter((v) => Number.isFinite(v))
  let up = 0
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1] + 0.02) up++
  console.log(`  bands where the sand share RISES basinward by more than 0.02: ${up} of ${vals.length - 1}`)
  // the plain: last-layer and whole-run sand share of the land columns, against the supply
  const land = zone.map((v, i) => (v === 'plain' ? i : -1)).filter((i) => i >= 0)
  const sL = land.reduce((a, j) => a + dep.sand[j], 0), mL = land.reduce((a, j) => a + dep.mud[j], 0)
  console.log(`  coastal plain deposit over the run: sand share ${f(sL / (sL + mL), 3)} against ${P.sandFrac} in the supply (Kc mud / Kc sand = ${P.Kc[1] / P.Kc[0]})`)
}

await zones('default run (published curve)', {})
await zones('constant sea level, default supply', { seaLevelKind: 'sine', slAmp: 0 })
await zones('constant sea level, no turbidites', { seaLevelKind: 'sine', slAmp: 0, tcMax: 0 })
await zones('constant sea level, no turbidites, equal subaerial K (Kc mud = Kc sand = 5e4)', { seaLevelKind: 'sine', slAmp: 0, tcMax: 0, Kc: [5e4, 5e4] })
await close()
