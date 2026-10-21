// SFM-R shared loader and measures for the stratigraphic forward-modelling review scripts.
// The engine is loaded from src/ through vite's ssr loader (same pattern as scripts/review/m4-review.mjs),
// so the scripts run the engine on main unchanged. Everything measured here is the reviewer's own code.
//
// All numbers are deterministic for one machine; the review quotes them with the platform named (D16.4).

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
  }
  return mods
}
export async function close() { if (server) await server.close() }

/**
 * Run the engine. over = parameter overrides on the registry defaults; segments = schedule
 * (default: the 3 Myr / 5 kyr run); onStep(eng, k, sl) is called after each record step.
 * Returns { eng, P, sched, sl, trace } where trace holds per-step shoreline / shelf-edge / share / sea level.
 */
export async function run(over = {}, segments, onStep) {
  const { Step, Params, Sched, Sea } = await engine()
  const P = { ...Params.defaultEngineParams(), ...over }
  const sched = Sched.buildSchedule(segments ?? [{ fromAgeMa: P.duration / 1e6, toAgeMa: 0, dt: P.dtRec }])
  const sl = Sea.makeSeaLevel(P, sched.startAgeMa * 1e6)
  const eng = Step.createEngine(P, sched)
  const trace = { t: [], sea: [], shore: [], shoreX: [], edge: [], share: [] }
  let k = 0
  while (Step.step(eng, P, sched, sl)) {
    const tEnd = sched.tEndYr[k]
    const s = sl(tEnd)
    trace.t.push(tEnd)
    trace.sea.push(s)
    trace.shore.push(eng.diag.shore)
    trace.shoreX.push(shorelineX(eng.rec.H, P.dx, s))
    trace.edge.push(eng.diag.shelfEdge)
    trace.share.push(eng.diag.tcShare)
    if (onStep) onStep(eng, k, s)
    k++
  }
  return { eng, P, sched, sl, trace }
}

/** Shoreline x (m) by linear interpolation of the first crossing of H below sea level. -1 if none. */
export function shorelineX(H, dx, sl) {
  for (let j = 1; j < H.length; j++) {
    if (H[j] < sl) {
      const f = (H[j - 1] - sl) / (H[j - 1] - H[j])
      return ((j - 1 + 0.5) + f) * dx
    }
  }
  return H[0] < sl ? 0 : -1
}

/** Gradient (m/m, positive down-dip) between columns a and b of the surface. */
export function grad(H, dx, a, b) { return (H[a] - H[b]) / ((b - a) * dx) }

/** Steepest down-dip gradient and where it sits (column index of the upper cell), from column j0 on. */
export function steepest(H, dx, j0 = 0) {
  let best = -Infinity, at = -1
  for (let j = Math.max(1, j0); j < H.length - 1; j++) {
    const g = (H[j - 1] - H[j + 1]) / (2 * dx) // centred, so a one-cell step does not dominate
    if (g > best) { best = g; at = j }
  }
  return { grad: best, at }
}

/** Least-squares slope of H over columns [a, b]. */
export function fitSlope(H, dx, a, b) {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let j = a; j <= b; j++) { const x = j * dx, y = H[j]; n++; sx += x; sy += y; sxx += x * x; sxy += x * y }
  return -(n * sxy - sx * sy) / (n * sxx - sx * sx) // positive = falls basinward
}

/** Solid sand and mud deposited during the run (layers nPre and above), per column. */
export function depositByColumn(rec) {
  const { nx, nLayers, nPre, sand, mud } = rec
  const s = new Float64Array(nx), m = new Float64Array(nx)
  for (let l = nPre; l < nLayers; l++) for (let j = 0; j < nx; j++) { s[j] += sand[l * nx + j]; m[j] += mud[l * nx + j] }
  return { sand: s, mud: m }
}

/** Solid sand and mud in one layer, by column. */
export function layerByColumn(rec, l) {
  const { nx, sand, mud } = rec
  return { sand: sand.subarray(l * nx, (l + 1) * nx), mud: mud.subarray(l * nx, (l + 1) * nx) }
}

export const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-')
export const m_ft = (m, d = 0) => `${f(m, d)} m (${f(m * FT, d)} ft)`
export const km = (m, d = 1) => `${f(m / 1000, d)} km`
export const deg = (g) => `${f(Math.atan(g) * 180 / Math.PI, 2)} deg`
export const sum = (a, lo = 0, hi = a.length) => { let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s }
