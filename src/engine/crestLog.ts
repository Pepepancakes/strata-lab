// Crest log (M3b.1, option A of the salt literature, D23): for every salt crest, how fast its salt top
// rises (F), how fast the seafloor beside it builds up (A), and what that says about the sequence.
// A READ-ONLY analysis of the run. It changes no physics, no record and no fixture.
//
// What it reads. The finished record only holds the salt as it ended up, so the history the log needs
// (salt thickness, salt top, seafloor at every step) is captured step by step by CrestHistory, a side
// output that copies three arrays after each step and writes nothing back. Salt is read from the salt
// layer (record layer 0): salt that has flowed up into higher layers (a canopy) is not followed.
//
// Definitions (all elevations are metres, up positive, unless named "Depth", which is positive down):
//   salt top    z_t = b + h_s, basement plus salt thickness.
//   cover       H - z_t, the bulk sediment over the salt (the engine's own seafloor H).
//   crest       a high of the salt top (saltHighs, saltStructures.ts) with prominence >= minProm, salt thicker
//               than weldThick and cover under NEAR. minProm = 100 m is TUNED (copied from spike 003).
//   episode     one crest followed from step to step. Each step it moves to the column within +-TRACK of
//               its last column that has salt and the least cover. It ends when the cover has stayed over
//               NEAR for GAP steps in a row ("buried"), when no column within reach holds salt thicker
//               than weldThick ("welded"), or at the end of the run ("run end"). Two episodes that come within
//               2 columns are one crest; the younger is dropped. NEAR = 500 m, GAP = 3, TRACK = 3 are the
//               values of spike 003 (tuned, not measured).
//   F           rise rate of the salt top, m/Myr, least squares of z_t against time.
//   A           rise rate of the flank seafloor, m/Myr, least squares of the mean seafloor over the columns 3
//               to 5 either side of the crest (the 6 cells at 3 to 5 km at dx 1,000 m). Columns 1 and 2 are
//               left out because the crest's own relief (the mound) bends the seafloor there.
//   F - A       m/Myr. Positive: the crest gains on its flanks.
//   A/F         NaN unless F > 0 (the ratio of rates means nothing for a sinking salt top).
//   windows     "near": the last 1 Myr of the records whose cover is under NEAR (the rate WHILE the crest is
//               near the surface). "burial": the last 1 Myr up to the last record of the episode, which
//               includes the one or two records after the cover passes NEAR, when the new fill is pushing the
//               salt top down. Both after SALT-R1 S3-2 / SALT-R2 3.4. A window with fewer than 2 records
//               gives NaN.
//   label       Giles and Rowan 2012 (GR12 p. 20): sedimentation slower than rise (A < F) gives a TABULAR
//               sequence, faster (A > F) TAPERED. When |F - A| is under NOISE_FLOOR the label is
//               "unresolved". Hooks and wedges (fold zones of 50 to 1,000 m, GR12 p. 8) are not resolved at
//               dx = 1,000 m: the label comes from rates only, never from stratal geometry.
//   NOISE_FLOOR 25 m/Myr, TUNED. Set from the Gulf preset: with 1 ulp maths noise (7 runs, Windows) the F - A of
//               the same crest moves by 22 m/Myr (90th percentile; maximum 59) in the near window and 25 m/Myr
//               (maximum 58) in the burial window, so a difference under about 25 m/Myr is not told apart
//               from noise. See docs/physics-references.md, M3b.1.
//   neighbour salt   mean salt thickness at +-10 km (columns round(10,000 / dx)) of the crest at its last record.
//   L/h         flow length over salt thickness at the last record: L = distance from the crest to the
//               nearest salt-free column (thickness under weldThick) on either side, the smaller of the two;
//               h = mean salt thickness over +-10 km of the crest.
//   at the seafloor   cover under EXPOSED_M (2 m, spike 003 roofMin; main has no exposed-salt rule).
//
// Deterministic: a pure function of the history and the parameters; fixed loop order, no clock, no randomness.

import { saltHighs } from './saltStructures'

export const NEAR_M = 500
export const GAP_STEPS = 3
export const TRACK_COLS = 3
export const MIN_PROM_M = 100
export const WINDOW_MYR = 1
export const NOISE_FLOOR_M_PER_MYR = 25
export const EXPOSED_M = 2
export const NEIGHBOUR_M = 10_000

export type SequenceLabel = 'tabular' | 'tapered' | 'unresolved'
export type EpisodeEnd = 'buried' | 'welded' | 'run end'

export interface CrestParams {
  weldThick: number
  nearM: number
  gapSteps: number
  trackCols: number
  minProm: number
  windowMyr: number
  noiseFloor: number
  exposedM: number
  neighbourM: number
}

export const crestParams = (weldThick: number, over: Partial<CrestParams> = {}): CrestParams => ({
  weldThick, nearM: NEAR_M, gapSteps: GAP_STEPS, trackCols: TRACK_COLS, minProm: MIN_PROM_M, windowMyr: WINDOW_MYR,
  noiseFloor: NOISE_FLOOR_M_PER_MYR, exposedM: EXPOSED_M, neighbourM: NEIGHBOUR_M, ...over,
})

/** Per-step copy of the salt state: frame k is the state at the end of record step k. Never read by the engine. */
export interface CrestHistory {
  nx: number
  dx: number
  /** Frames stored. */
  n: number
  capacity: number
  /** Elapsed years and age (Ma) at the end of each step. */
  tYr: Float64Array
  ageMa: Float64Array
  /** Salt thickness, salt top elevation and seafloor elevation, frame * nx + column. */
  hs: Float64Array
  zt: Float64Array
  H: Float64Array
}

export function createCrestHistory(nx: number, dx: number, capacity: number): CrestHistory {
  return {
    nx, dx, n: 0, capacity, tYr: new Float64Array(capacity), ageMa: new Float64Array(capacity),
    hs: new Float64Array(capacity * nx), zt: new Float64Array(capacity * nx), H: new Float64Array(capacity * nx),
  }
}

/** Append one frame from a salt thickness array, the basement and the seafloor (all length nx). */
export function pushCrestFrame(h: CrestHistory, tYr: number, ageMa: number, hs: ArrayLike<number>, b: ArrayLike<number>, H: ArrayLike<number>): void {
  if (h.n >= h.capacity) throw new Error('crestLog: history is full')
  const o = h.n * h.nx
  for (let j = 0; j < h.nx; j++) {
    h.hs[o + j] = hs[j]
    h.zt[o + j] = b[j] + hs[j]
    h.H[o + j] = H[j]
  }
  h.tYr[h.n] = tYr
  h.ageMa[h.n] = ageMa
  h.n++
}

/** One record of an episode: the crest column at one step. Depths are below sea level (positive down). */
export interface CrestTrack {
  step: number[]
  tMyr: number[]
  ageMa: number[]
  col: number[]
  saltTopDepthM: number[]
  saltThickM: number[]
  coverM: number[]
  seafloorDepthM: number[]
  /** Mean flank seafloor depth over the columns 3 to 5 either side. */
  flankSeafloorDepthM: number[]
}

export interface WindowStats {
  /** Records used and the elapsed time (Myr) of the first and last. */
  n: number
  fromMyr: number
  toMyr: number
  /** m/Myr; NaN with fewer than 2 records (A/F also NaN unless F > 0). */
  F: number
  A: number
  FminusA: number
  ratioAF: number
  label: SequenceLabel
}

export interface CrestEpisode {
  id: number
  firstAgeMa: number
  lastAgeMa: number
  /** Ma at which the episode ended (buried: the first record over NEAR; welded: the weld step); null at run end. */
  endAgeMa: number | null
  endReason: EpisodeEnd
  startCol: number
  endCol: number
  /** Distance of the first and last crest column from the section start, km. */
  startKm: number
  endKm: number
  track: CrestTrack
  near: WindowStats
  burial: WindowStats
  /** The sequence label of the episode: that of the near window. */
  label: SequenceLabel
  /** Time with cover under EXPOSED_M, Myr. */
  atSeafloorMyr: number
  /** Time near (cover under NEAR), Myr. */
  nearMyr: number
  /** Mean salt thickness at +-neighbourM of the crest at its last record, m. */
  neighbourSaltM: number
  neighbourKm: number
  flowLengthM: number
  meanSaltM: number
  lOverH: number
}

export interface CrestLog {
  saltOn: boolean
  nSteps: number
  params: CrestParams
  episodes: CrestEpisode[]
  /** Candidate episodes dropped because they merged into an older one. */
  merged: number
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN)

/** Least-squares slope of y against t, per unit t; NaN with fewer than 2 points or no spread in t. */
export function slope(t: number[], y: number[]): number {
  const n = t.length
  if (n < 2) return NaN
  const mt = mean(t)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (t[i] - mt) * (y[i] - my)
    sxx += (t[i] - mt) * (t[i] - mt)
  }
  return sxx > 0 ? sxy / sxx : NaN
}

export function labelOf(F: number, A: number, noiseFloor: number): SequenceLabel {
  if (!Number.isFinite(F) || !Number.isFinite(A)) return 'unresolved'
  const d = F - A
  if (Math.abs(d) < noiseFloor) return 'unresolved'
  return d > 0 ? 'tabular' : 'tapered'
}

interface Work {
  id: number
  col: number
  startCol: number
  over: number
  firstOverT: number
  closing: boolean
  merged: boolean
  reason: EpisodeEnd
  endT: number | null
  endAge: number | null
  lastFrame: number
  // per record: elevations (up positive) for the fits
  ztEl: number[]
  hfEl: number[]
  track: CrestTrack
  exposedMyr: number
}

export function buildCrestLog(hist: CrestHistory, P: CrestParams, saltOn = true): CrestLog {
  const log: CrestLog = { saltOn, nSteps: hist.n, params: P, episodes: [], merged: 0 }
  if (!saltOn || hist.n === 0) return log
  const nx = hist.nx
  const dx = hist.dx
  const active: Work[] = []
  const done: Work[] = []
  let nextId = 1
  const frameHs = (k: number) => hist.hs.subarray(k * nx, (k + 1) * nx)
  const frameZt = (k: number) => hist.zt.subarray(k * nx, (k + 1) * nx)
  const frameH = (k: number) => hist.H.subarray(k * nx, (k + 1) * nx)

  const flankH = (H: Float64Array, j: number): number => {
    const v: number[] = []
    for (let d = 3; d <= 5; d++) for (const c of [j - d, j + d]) if (c >= 0 && c < nx) v.push(H[c])
    return mean(v)
  }
  const record = (w: Work, k: number): void => {
    const hs = frameHs(k)
    const zt = frameZt(k)
    const H = frameH(k)
    const j = w.col
    const hf = flankH(H, j)
    const tr = w.track
    tr.step.push(k)
    tr.tMyr.push(hist.tYr[k] / 1e6)
    tr.ageMa.push(hist.ageMa[k])
    tr.col.push(j)
    tr.saltTopDepthM.push(-zt[j])
    tr.saltThickM.push(hs[j])
    tr.coverM.push(H[j] - zt[j])
    tr.seafloorDepthM.push(-H[j])
    tr.flankSeafloorDepthM.push(-hf)
    w.ztEl.push(zt[j])
    w.hfEl.push(hf)
    w.lastFrame = k
    if (H[j] - zt[j] < P.exposedM) w.exposedMyr += (hist.tYr[k] - (k > 0 ? hist.tYr[k - 1] : 0)) / 1e6
  }
  const newTrack = (): CrestTrack => ({ step: [], tMyr: [], ageMa: [], col: [], saltTopDepthM: [], saltThickM: [], coverM: [], seafloorDepthM: [], flankSeafloorDepthM: [] })

  for (let k = 0; k < hist.n; k++) {
    const hs = frameHs(k)
    const zt = frameZt(k)
    const H = frameH(k)
    const tMyr = hist.tYr[k] / 1e6
    const cov = (j: number) => H[j] - zt[j]
    for (const w of active) {
      let best = -1
      let bc = Infinity
      for (let q = Math.max(0, w.col - P.trackCols); q <= Math.min(nx - 1, w.col + P.trackCols); q++) {
        if (hs[q] >= P.weldThick && cov(q) < bc) { bc = cov(q); best = q }
      }
      if (best < 0) {
        w.reason = 'welded'
        w.endT = tMyr
        w.endAge = hist.ageMa[k]
        w.closing = true
        continue
      }
      w.col = best
      if (bc >= P.nearM) {
        if (w.over === 0) { w.firstOverT = tMyr; w.endAge = hist.ageMa[k] }
        w.over++
        if (w.over >= P.gapSteps) { w.reason = 'buried'; w.endT = w.firstOverT; w.closing = true }
      } else w.over = 0
      if (w.closing) continue
      if (active.some((o) => o !== w && !o.closing && o.id < w.id && Math.abs(o.col - w.col) <= 2)) {
        w.merged = true
        w.closing = true
        continue
      }
      record(w, k)
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const w = active[i]
      if (!w.closing) continue
      if (w.merged) log.merged++
      else done.push(w)
      active.splice(i, 1)
    }
    // New crests: highs of the salt top, not within trackCols + 2 columns of an active crest.
    for (const f of saltHighs(zt, dx, P.minProm)) {
      const j = f.j
      if (hs[j] < P.weldThick || cov(j) >= P.nearM) continue
      if (active.some((w) => Math.abs(w.col - j) <= P.trackCols + 2)) continue
      const w: Work = {
        id: nextId++, col: j, startCol: j, over: 0, firstOverT: 0, closing: false, merged: false, reason: 'run end', endT: null, endAge: null,
        lastFrame: k, ztEl: [], hfEl: [], track: newTrack(), exposedMyr: 0,
      }
      record(w, k)
      active.push(w)
    }
  }
  for (const w of active) done.push(w) // still near at the end of the run: reason stays 'run end'
  done.sort((a, b) => a.track.step[0] - b.track.step[0] || a.startCol - b.startCol)

  const windowStats = (t: number[], z: number[], f: number[]): WindowStats => {
    const n = t.length
    const F = slope(t, z)
    const A = slope(t, f)
    return {
      n, fromMyr: n ? t[0] : NaN, toMyr: n ? t[n - 1] : NaN, F, A, FminusA: F - A,
      ratioAF: F > 0 ? A / F : NaN, label: labelOf(F, A, P.noiseFloor),
    }
  }
  const pick = (w: Work, keep: (i: number, t: number) => boolean): { t: number[]; z: number[]; f: number[] } => {
    const t: number[] = []
    const z: number[] = []
    const f: number[] = []
    w.track.tMyr.forEach((tt, i) => {
      if (keep(i, tt)) { t.push(tt); z.push(w.ztEl[i]); f.push(w.hfEl[i]) }
    })
    return { t, z, f }
  }
  const eps = 1e-9
  const dCols = Math.max(1, Math.round(P.neighbourM / dx))
  log.episodes = done.map((w, idx): CrestEpisode => {
    const tr = w.track
    const nRec = tr.step.length
    const tLast = tr.tMyr[nRec - 1]
    const nearIdx = tr.coverM.map((c, i) => (c < P.nearM ? i : -1)).filter((i) => i >= 0)
    const tNearLast = nearIdx.length ? tr.tMyr[nearIdx[nearIdx.length - 1]] : NaN
    const nearSet = new Set(nearIdx)
    const nw = pick(w, (i, t) => nearSet.has(i) && t >= tNearLast - P.windowMyr - eps)
    const bw = pick(w, (_i, t) => t >= tLast - P.windowMyr - eps)
    const near = windowStats(nw.t, nw.z, nw.f)
    const burial = windowStats(bw.t, bw.z, bw.f)
    // salt around the crest at its last record
    const hsL = frameHs(w.lastFrame)
    const jL = tr.col[nRec - 1]
    const side = (c: number): number => (c >= 0 && c < nx ? hsL[c] : NaN)
    const nb = mean([side(jL - dCols), side(jL + dCols)].filter((v) => !Number.isNaN(v)))
    const dist = (sgn: number): number => {
      for (let d = 1; ; d++) {
        const c = jL + sgn * d
        if (c < 0 || c >= nx) return (d - 1 + 0.5) * dx
        if (hsL[c] < P.weldThick) return d * dx
      }
    }
    const L = Math.min(dist(-1), dist(1))
    const win: number[] = []
    for (let i = -dCols; i <= dCols; i++) win.push(hsL[Math.min(nx - 1, Math.max(0, jL + i))])
    const hbar = mean(win)
    let nearMyr = 0
    for (const i of nearIdx) nearMyr += (hist.tYr[tr.step[i]] - (tr.step[i] > 0 ? hist.tYr[tr.step[i] - 1] : 0)) / 1e6
    return {
      id: idx + 1,
      firstAgeMa: tr.ageMa[0],
      lastAgeMa: tr.ageMa[nRec - 1],
      endAgeMa: w.reason === 'run end' ? null : w.endAge,
      endReason: w.reason,
      startCol: w.startCol,
      endCol: jL,
      startKm: ((w.startCol + 0.5) * dx) / 1000,
      endKm: ((jL + 0.5) * dx) / 1000,
      track: tr,
      near,
      burial,
      label: near.label,
      atSeafloorMyr: w.exposedMyr,
      nearMyr,
      neighbourSaltM: nb,
      neighbourKm: (dCols * dx) / 1000,
      flowLengthM: L,
      meanSaltM: hbar,
      lOverH: L / hbar,
    }
  })
  return log
}

/** The log of a run that has no salt: nothing to follow. */
export const emptyCrestLog = (weldThick: number): CrestLog => ({ saltOn: false, nSteps: 0, params: crestParams(weldThick), episodes: [], merged: 0 })
