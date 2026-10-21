// SFM-4 shared loader for the SFM fix-chain review checks.
// Loads the engine (and the test noise helper) from src/ and tests/ through vite's ssr loader, like scripts/review/sfm/lib.mjs.
// REVIEW_ROOT=<checkout> runs the same script on another checkout (for the "before" numbers, e.g. the commit before SFM-1).
// Everything measured here is the reviewer's own code. Numbers are deterministic per machine; quote the platform (D16.4).
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

export const root = process.env.REVIEW_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const FT = 3.28084
export const platform = `${process.platform} node ${process.version}`

let server, mods
export async function engine() {
  if (mods) return mods
  server = await createServer({
    root, configFile: false, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const load = (p) => server.ssrLoadModule(p)
  mods = {
    Step: await load('/src/engine/step.ts'),
    Params: await load('/src/engine/engineParams.ts'),
    Sched: await load('/src/engine/schedule.ts'),
    Sea: await load('/src/engine/sealevel.ts'),
    Turb: await load('/src/engine/turbidites.ts'),
    Record: await load('/src/engine/record.ts'),
    Presets: await load('/src/engine/presets.ts'),
    Salt: await load('/src/engine/salt.ts'),
    SaltS: await load('/src/engine/saltStructures.ts'),
    Noise: await load('/tests/helpers/ulpNoise.ts'),
  }
  return mods
}
export async function close() { if (server) await server.close() }

/** Run the default schedule (or a preset) to the end. Returns { eng, P, sched, trace } with per-step sea level, shoreline column, shelf-edge column, turbidite share. */
export async function runCase({ preset, over = {}, segments } = {}) {
  const { Step, Params, Sched, Sea, Presets } = await engine()
  const P = preset ? { ...Presets.presetParams(preset), ...over } : { ...Params.defaultEngineParams(), ...over }
  const sched = preset ? Presets.presetSchedule(preset) : Sched.buildSchedule(segments ?? [{ fromAgeMa: P.duration / 1e6, toAgeMa: 0, dt: P.dtRec }])
  const sl = Sea.makeSeaLevel(P, sched.startAgeMa * 1e6)
  const eng = Step.createEngine(P, sched)
  const trace = { sea: [], shore: [], edge: [], share: [] }
  let k = 0
  while (Step.step(eng, P, sched, sl)) {
    trace.sea.push(sl(sched.tEndYr[k]))
    trace.shore.push(eng.diag.shore)
    trace.edge.push(eng.diag.shelfEdge)
    trace.share.push(eng.diag.tcShare)
    k++
  }
  return { eng, P, sched, sl, trace }
}

/** Solid sand and mud deposited during the run (layers nPre and above), per column, m. */
export function depositByColumn(rec) {
  const { nx, nLayers, nPre, sand, mud } = rec
  const s = new Float64Array(nx), m = new Float64Array(nx)
  for (let l = nPre; l < nLayers; l++) for (let j = 0; j < nx; j++) { s[j] += sand[l * nx + j]; m[j] += mud[l * nx + j] }
  return { sand: s, mud: m }
}

export function shorelineX(H, dx, sl) {
  for (let j = 1; j < H.length; j++) {
    if (H[j] < sl) { const f = (H[j - 1] - sl) / (H[j - 1] - H[j]); return ((j - 1 + 0.5) + f) * dx }
  }
  return H[0] < sl ? 0 : -1
}

export function corr(a, b) {
  const n = a.length, ma = sum(a) / n, mb = sum(b) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN
}
export function median(a) { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2])) : NaN }
export const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-')
export const m_ft = (m, d = 0) => `${f(m, d)} m (${f(m * FT, d)} ft)`
export const sum = (a, lo = 0, hi = a.length) => { let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s }

/** Sand beyond 100 km as % of the sand supplied (same definition as scripts/review/sfm/07). */
export function sandBeyond100(eng, P) {
  const dep = depositByColumn(eng.rec)
  const j1 = Math.round(100000 / P.dx)
  return 100 * sum(dep.sand, j1) * P.dx / eng.rec.ledger.cumIn.sand
}
