// AUD-4: summarise the toe episode (end position beyond 300 km) in each run of a review JSON.
// node scripts/review/aud-04-toe.mjs <json> [<json2> ...]
import { readFileSync } from 'node:fs'
for (const file of process.argv.slice(2)) {
  const rows = JSON.parse(readFileSync(file, 'utf8'))
  console.log(`\n${file}`)
  for (const r of rows) {
    const toe = r.crestLog.episodes.filter((e) => e.km >= 300)
    const at = r.crestLog.episodes.filter((e) => e.atSeafloorMyr > 0)
    const cov = r.salt.every10km.filter((q) => q.km >= 305 && q.km <= 335).map((q) => `${q.km}:${q.h}/${q.cover}`).join(' ')
    console.log(`  ${r.name.padEnd(6)} episodes ${r.crestLog.n} (buried ${r.crestLog.buried}, run end ${r.crestLog.runEnd}, welded ${r.crestLog.welded}); at the seafloor ${at.length} [${at.map((e) => `#${e.id} ${e.km} km ${e.atSeafloorMyr.toFixed(1)} Myr`).join('; ')}]; toe: ${toe.map((e) => `#${e.id} ${e.km} km ${e.firstMa.toFixed(1)}-${e.lastMa.toFixed(2)} Ma ${e.end}, F ${e.F.toFixed(1)} A ${e.A.toFixed(1)} F-A ${e.FminusA.toFixed(1)} m/Myr ${e.label}, min cover ${e.minCoverM.toFixed(0)} m, last cover ${e.lastCoverM.toFixed(0)} m`).join('; ') || 'none'}; salt/cover 305..335 km: ${cov}`)
  }
}
