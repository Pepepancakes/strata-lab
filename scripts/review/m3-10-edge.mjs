// M3.10 numbers for the Gulf preset basinward edge fix.
// Usage: node scripts/review/m3-10-edge.mjs <part> [ids...]
//   hash [ids]   stateHash and best-of-3 run time per preset (run with REVIEW_ROOT=<other worktree> to compare)
//   table        salt thickness (m) every 10 km and seafloor (ft) at 66, 40, 20, 0 Ma; salt flux at the last face
//   crests       crests within 2 km of the seafloor, away from the salt basin's and the section's edges
//   ulp          weld runs and total weld length under 1 ulp noise (six salts)
//   grid         dx 1000 and 500 m over 200 km: spacing/wavelength measures
// Own measures from the raw record (salt thickness is layer 0 of rec.mud); no saltStructures.ts.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const here = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const root = process.env.REVIEW_ROOT || here
const part = process.argv[2] || 'hash'
const ids = process.argv.slice(3)
const mk = (r) => createServer({ root: r, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { noDiscovery: true, include: [] } })
const server = await mk(root)
const load = (p) => server.ssrLoadModule(p)
const S = await load('/src/engine/step.ts')
const Pr = await load('/src/engine/presets.ts')
const Sea = await load('/src/engine/sealevel.ts')
const Det = await load('/src/engine/determinism.ts')
const hereServer = root === here ? server : await mk(here)
const ULP = await hereServer.ssrLoadModule('/tests/helpers/ulpNoise.ts')
const FT = 3.280839895

function run(id, over = {}, { at = [], ulp = null } = {}) {
  const P = { ...Pr.presetParams(id), ...over }
  const sch = Pr.presetSchedule(id)
  const go = () => {
    const eng = S.createEngine(P, sch)
    const sea = Sea.makeSeaLevel(P, sch.startAgeMa * 1e6)
    const rec = eng.rec, nx = rec.nx
    const snaps = {}
    const snap = () => ({ h: Float64Array.from(rec.mud.subarray(0, nx)), H: Float64Array.from(rec.H), b: Float64Array.from(rec.b) })
    const keep = (a) => { for (const k of at) if (!(k in snaps) && a <= k + 1e-9) snaps[k] = snap() }
    keep(sch.startAgeMa + 1)
    const h0 = Float64Array.from(rec.mud.subarray(0, nx))
    const t0 = process.hrtime.bigint()
    while (S.step(eng, P, sch, sea)) keep(sch.stepAgeMa[eng.diag.stepIndex - 1])
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    return { P, nx, dx: P.dx, h0, h: Float64Array.from(rec.mud.subarray(0, nx)), H: Float64Array.from(rec.H), b: Float64Array.from(rec.b),
      Sb: eng.salt && eng.salt.Sb ? Float64Array.from(eng.salt.Sb) : null, weldAge: eng.weldAge ? Float64Array.from(eng.weldAge) : null, ms, hash: String(Det.stateHash(rec)), snaps, clip: eng.diag.saltClip, eng, rec }
  }
  return ulp === null ? go() : ULP.withUlpNoise(2.2e-16, ulp, go)
}

if (part === 'hash') {
  for (const id of ids.length ? ids : ['last3', 'mtd', 'miocene', 'cenozoic', 'saltshort', 'gulf']) {
    const ts = []
    let r
    for (let i = 0; i < 3; i++) { r = run(id); ts.push(r.ms) }
    console.log(id, r.hash, 'min ms', Math.round(Math.min(...ts)), ts.map(Math.round).join('/'))
  }
}

if (part === 'table') {
  const r = run('gulf', JSON.parse(process.env.OVER || '{}'), { at: [66, 40, 20, 0.001] })
  const ages = [66, 40, 20, 0.001]
  console.log('km  | salt m at 66/40/20/0 Ma | seafloor ft')
  for (let j = 4; j < r.nx; j += 10) {
    const row = ages.map((a) => { const s = r.snaps[a] || r.snaps[66]; return Math.round(s.h[j]) })
    const sf = ages.map((a) => { const s = r.snaps[a] || r.snaps[66]; return Math.round(s.H[j] * FT) })
    console.log(String(((j + 0.5) * r.dx / 1000)).padStart(6), row.map((v) => String(v).padStart(6)).join(' '), '|', sf.map((v) => String(v).padStart(7)).join(' '))
  }
  console.log('final: max salt >250 km', Math.max(...Array.from(r.h).slice(250)), 'max salt within 20 km of edge', Math.max(...Array.from(r.h).slice(r.nx - 20)))
  console.log('clip', r.clip)
  const vol = (s, a, b) => { let v = 0; for (let j = a; j < b; j++) v += s.h[j] * r.dx; return v / 1e6 }
  for (const a of ages) {
    const s = r.snaps[a]
    console.log('age', a, 'salt volume km2: total', vol(s, 0, r.nx).toFixed(1), '| beyond 250 km', vol(s, 250, r.nx).toFixed(1), '| last 20 km', vol(s, r.nx - 20, r.nx).toFixed(1))
  }
  const sA = r.snaps[66], sB = r.snaps[0.001]
  console.log('mean salt flux across the 250 km face over the run (m2/yr) =', ((vol(sB, 250, r.nx) - vol(sA, 250, r.nx)) * 1e6 / 66e6).toFixed(2), '; flux at the last face = 0 (closed edge)')
}
if (part === 'sweep') {
  // args = JSON overrides, one run each, e.g. '{"saltLimitStart":300000,"saltLimitEnd":340000}'
  for (const js of ids) {
    const o = JSON.parse(js)
    const r = run('gulf', o)
    const mx = (a, b) => Math.max(...Array.from(r.h).slice(a, b))
    let welds = 0, wl = 0, run0 = 0, longest = 0
    for (let j = 0; j <= r.nx; j++) {
      const w = j < r.nx && r.h0[j] >= r.P.weldThick && r.h[j] < r.P.weldThick
      if (w) run0++
      else { if (run0) { welds++; wl += run0; longest = Math.max(longest, run0) } run0 = 0 }
    }
    console.log(js, '| max salt >250km', Math.round(mx(250, r.nx)), '| last 20km', Math.round(mx(r.nx - 20, r.nx)), '| max 100-250', Math.round(mx(100, 250)), '| weld runs', welds, 'total km', wl, 'longest', longest, '| ms', Math.round(r.ms))
  }
}
if (part === 'crests' || part === 'ulp' || part === 'grid') {
  const SS = await load('/src/engine/saltStructures.ts')
  const measure = (r) => {
    const { h, dx, nx } = r
    const edgeKm = dx * nx / 1000
    // salt basin edges at the END of the run: outermost columns with more than 100 m of salt
    let first = 0, last = nx - 1
    while (first < nx && h[first] <= 100) first++
    while (last > 0 && h[last] <= 100) last--
    const lo = (first + 0.5) * dx / 1000, hi = (last + 0.5) * dx / 1000
    const cover = r.Sb
    const all = SS.saltHighs(h, dx, 300)
    const shallow = all.filter((q) => cover[q.j] < 2000)
    const away = shallow.filter((q) => q.x / 1000 >= lo + 20 && q.x / 1000 <= hi - 20 && q.x / 1000 <= edgeKm - 20)
    const wr = SS.weldRuns(r.weldAge, h, r.P.weldThick, dx)
    const wlen = wr.reduce((a, w) => a + (w.toKm - w.fromKm), 0)
    const wlong = wr.reduce((a, w) => Math.max(a, w.toKm - w.fromKm), 0)
    const wl2 = wr.filter((w) => w.toKm - w.fromKm >= 2)
    return { lo, hi, nHighs: all.length, shallow: shallow.map((q) => ({ x: q.x / 1000, thick: Math.round(q.thick), prom: Math.round(q.prominence), coverFt: Math.round(cover[q.j] * FT) })),
      away: away.map((q) => ({ x: q.x / 1000, coverFt: Math.round(cover[q.j] * FT) })), wr: wr.length, wlen, wlong, nWeld2: wl2.length,
      wl: SS.saltWavelength(h, dx, 20000, 120000, 4000, 60000) / 1000, mins: SS.minibasins(h, dx, 300).length,
      spacing: (() => { const s = SS.spacings(all); return s.length ? s.reduce((a, b) => a + b, 0) / s.length / 1000 : 0 })() }
  }
  if (part === 'crests') {
    const r = run('gulf', JSON.parse(process.env.OVER || '{}'))
    console.log(JSON.stringify(measure(r)))
  }
  if (part === 'ulp') {
    for (const salt of [3, 5, 7, 11, 13, 17]) {
      const r = run('gulf', JSON.parse(process.env.OVER || '{}'), { ulp: salt })
      const m = measure(r)
      console.log(salt, 'weld runs', m.wr, 'total km', m.wlen, 'longest km', m.wlong, '>=2km runs', m.nWeld2, 'away-shallow', m.away.length, 'shallow', m.shallow.length, 'wl', m.wl.toFixed(1), 'maxSaltLast20', Math.round(Math.max(...Array.from(r.h).slice(r.nx - 20))), 'max>250', Math.round(Math.max(...Array.from(r.h).slice(250))))
    }
  }
  if (part === 'grid') {
    for (const [dx, nx] of [[1000, 200], [500, 400]]) {
      const r = run('gulf', { dx, nx, ...JSON.parse(process.env.OVER || '{}') })
      const m = measure(r)
      console.log('dx', dx, 'nx', nx, 'wavelength km', m.wl.toFixed(1), 'highs', m.nHighs, 'mean spacing km', m.spacing.toFixed(1), 'minibasins', m.mins, 'weld runs', m.wr, 'total km', m.wlen, 'ms', Math.round(r.ms))
    }
  }
}
await server.close()
process.exit(0)
