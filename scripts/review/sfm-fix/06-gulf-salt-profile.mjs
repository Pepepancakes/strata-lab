// Band re-set (D31.4 / D27.1): salt thickness and cover at the end of the Gulf-style preset, every 10 km from 180 km to the
// basinward edge, plus the sea floor and the salt that left through the edge, so the edge and no-pile bands can be judged
// against the profile rather than against one number. Nothing is asserted.
//   node scripts/review/sfm-fix/06-gulf-salt-profile.mjs
// REVIEW_ROOT=<checkout> runs it on another checkout (e.g. the commit before SFM-1).
import { engine, close, platform } from './lib.mjs'

const { Step, Presets, Sea, Salt } = await engine()
const P = Presets.presetParams('gulf')
const schedule = Presets.presetSchedule('gulf')
const eng = Step.createEngine(P, schedule)
const sl = Sea.makeSeaLevel(P, schedule.startAgeMa * 1e6)
const v0 = Salt.saltVolume(eng.rec)
const front = []
while (Step.step(eng, P, schedule, sl)) {
  const age = schedule.stepAgeMa[eng.diag.stepIndex - 1]
  if (front.length === 0 || age <= front[front.length - 1][0] - 6 + 1e-9) {
    const h = eng.rec.mud.subarray(0, eng.rec.nx)
    let last = eng.rec.nx - 1
    while (last > 0 && h[last] <= 100) last--
    front.push([age, (last + 0.5) * P.dx / 1000, Math.round(h[eng.rec.nx - 1])])
  }
}
const nx = eng.rec.nx
const h = eng.rec.mud.subarray(0, nx)
console.log(`Gulf salt profile at 0 Ma. ${platform}. salt volume change ${((Salt.saltVolume(eng.rec) - v0) / v0).toExponential(2)}`)
console.log('km | salt m | cover m')
for (let km = 180; km <= 400; km += 10) {
  const j = Math.min(nx - 1, Math.round(km * 1000 / P.dx - 0.5))
  console.log(`${((j + 0.5) * P.dx / 1000).toFixed(1)} | ${Math.round(h[j])} | ${Math.round(eng.salt.Sb[j])}`)
}
console.log('salt front through time (age Ma | front km | salt in the last column m):')
for (const r of front) console.log(`${r[0].toFixed(1)} | ${r[1].toFixed(1)} | ${r[2]}`)
await close()
