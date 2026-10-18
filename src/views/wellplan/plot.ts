// Pressure plot of a planned well (M4.3): the numbers behind the picture, with no drawing in them.
// Everything here is a pure function of a WellSamples and its WellPressures, so it can be tested without a browser.
// The plot has EMW (ppg, from the rig floor) across and depth (ft TVDSS) down.

import { isCapped } from '../well/audit'
import { WELL_AIR, WELL_SALT, WELL_WATER, type WellSamples } from '../../engine/well'
import { WINDOW_NO_WINDOW, WINDOW_NONE, WINDOW_OK, WINDOW_TIGHT, type WellPressures } from '../../engine/wellPressure'

/** One branch's well, ready to plot. */
export interface PlotRun {
  branchId: string
  label: string
  samples: WellSamples
  pressures: WellPressures
  /** The four lines with the sea-water stations left out (NaN). In water every pressure is just the weight of sea water, and an EMW taken from the rig floor swings from 0 to 8.5 ppg over the first hundred feet, which says nothing about the rock. */
  lines: { hydro: Float64Array; pore: Float64Array; overburden: Float64Array; fg: Float64Array }
}

function rockOnly(s: WellSamples, a: Float64Array): Float64Array {
  const out = new Float64Array(s.n)
  for (let i = 0; i < s.n; i++) out[i] = s.kind[i] === WELL_WATER || s.kind[i] === WELL_AIR ? NaN : a[i]
  return out
}

export function makePlotRun(branchId: string, label: string, samples: WellSamples, pressures: WellPressures): PlotRun {
  return {
    branchId, label, samples, pressures,
    lines: {
      hydro: rockOnly(samples, pressures.hydroEmw),
      pore: rockOnly(samples, pressures.poreEmw),
      overburden: rockOnly(samples, pressures.overburdenEmw),
      fg: rockOnly(samples, pressures.fgEmw),
    },
  }
}

export interface PlotRange {
  xLo: number
  xHi: number
  yTop: number
  yBot: number
}

/** Most points per line; a 20,000 ft well has 2,000+ stations, far more than the screen can show. */
export const MAX_POINTS = 800

/** The EMW and depth ranges that hold every run, so branches share the same axes. Whole ppg, and whole thousands of ft. */
export function plotRange(runs: readonly PlotRun[]): PlotRange {
  let lo = Infinity
  let hi = -Infinity
  let top = 0
  let bot = 1000
  for (const r of runs) {
    const p = r.pressures
    for (let i = 0; i < p.n; i++) {
      if (r.samples.kind[i] === WELL_WATER || r.samples.kind[i] === WELL_AIR) continue // sea water carries no rock pressures
      for (const v of [p.hydroEmw[i], p.poreEmw[i], p.lowerEmw[i]]) if (Number.isFinite(v)) lo = Math.min(lo, v)
      for (const v of [p.overburdenEmw[i], p.fgEmw[i], p.upperEmw[i], p.poreEmw[i]]) if (Number.isFinite(v)) hi = Math.max(hi, v)
      const z = r.samples.tvdssFt[i]
      if (!Number.isFinite(p.hydroEmw[i])) continue
      bot = Math.max(bot, z)
      // the top is the sea surface; only a well that starts on land (rock above sea level) goes higher
      top = Math.min(top, z)
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { xLo: 6, xHi: 20, yTop: 0, yBot: 10000 }
  const xLo = Math.max(0, Math.floor(lo - 0.5))
  const xHi = Math.max(xLo + 2, Math.ceil(hi + 0.5))
  return { xLo, xHi, yTop: Math.floor(top / 1000) * 1000, yBot: Math.ceil(bot / 1000) * 1000 }
}

/** Station indices to draw: every `stride`-th one, the last, and every place where `key` changes (a break in a line, a change of window state). */
export function drawIndices(n: number, key: (i: number) => number): number[] {
  const stride = Math.max(1, Math.ceil(n / MAX_POINTS))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (i % stride === 0 || i === n - 1 || (i > 0 && key(i) !== key(i - 1))) {
      if (i > 0 && stride > 1 && key(i) !== key(i - 1) && out[out.length - 1] !== i - 1) out.push(i - 1) // the last station of the previous run
      out.push(i)
    }
  }
  return out
}

/** SVG path of a curve over the stations; a NaN value ends the line and the next value starts a new piece. */
export function linePath(values: Float64Array, tvdss: Float64Array, n: number, x: (v: number) => number, y: (ft: number) => number): string {
  let d = ''
  let pen = false
  for (const i of drawIndices(n, (k) => (Number.isFinite(values[k]) ? 1 : 0))) {
    const v = values[i]
    if (!Number.isFinite(v)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(v).toFixed(1)},${y(tvdss[i]).toFixed(1)}`
    pen = true
  }
  return d
}

/** A stretch of neighbouring stations that share one window state; the shade is drawn between the lower and upper limits. */
export interface WindowBand {
  state: number
  first: number
  last: number
  path: string
}

/** Shaded bands between the lower and upper limits of the mud-weight window, one per run of one state (ok, tight, no window). */
export function windowBands(samples: WellSamples, p: WellPressures, x: (v: number) => number, y: (ft: number) => number): WindowBand[] {
  const out: WindowBand[] = []
  let start = -1
  const close = (end: number): void => {
    if (start < 0) return
    const idx = drawIndices(end - start + 1, (k) => p.state[start + k]).map((k) => start + k)
    const up = idx.map((i) => `${x(p.upperEmw[i]).toFixed(1)},${y(samples.tvdssFt[i]).toFixed(1)}`)
    const low = idx.map((i) => `${x(p.lowerEmw[i]).toFixed(1)},${y(samples.tvdssFt[i]).toFixed(1)}`).reverse()
    out.push({ state: p.state[start], first: start, last: end, path: `M${up.join('L')}L${low.join('L')}Z` })
    start = -1
  }
  for (let i = 0; i < p.n; i++) {
    const s = p.state[i]
    const has = s !== WINDOW_NONE && Number.isFinite(p.lowerEmw[i]) && Number.isFinite(p.upperEmw[i])
    if (!has) {
      close(i - 1)
      continue
    }
    if (start >= 0 && p.state[start] !== s) close(i - 1)
    if (start < 0) start = i
  }
  close(p.n - 1)
  return out
}

/** Interval of one kind of ground along the well. */
export interface DepthInterval {
  topTvdssFt: number
  bottomTvdssFt: number
  topMdFt: number
  bottomMdFt: number
}

/** Salt along the well, as runs of salt stations. */
export function saltIntervals(s: WellSamples): DepthInterval[] {
  const out: DepthInterval[] = []
  let start = -1
  for (let i = 0; i <= s.n; i++) {
    const hit = i < s.n && s.kind[i] === WELL_SALT
    if (hit && start < 0) start = i
    if (!hit && start >= 0) {
      out.push({ topTvdssFt: s.tvdssFt[start], bottomTvdssFt: s.tvdssFt[i - 1], topMdFt: s.mdFt[start], bottomMdFt: s.mdFt[i - 1] })
      start = -1
    }
  }
  return out
}

/** The station nearest a depth (ft TVDSS). TVDSS never decreases along a build-and-hold well, so a binary search works. */
export function stationAtTvdss(s: Pick<WellSamples, 'n' | 'tvdssFt'>, ft: number): number {
  if (s.n === 0) return -1
  let lo = 0
  let hi = s.n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (s.tvdssFt[mid] < ft) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(s.tvdssFt[lo - 1] - ft) <= Math.abs(s.tvdssFt[lo] - ft)) return lo - 1
  return lo
}

export const WINDOW_STATE_NAME: Record<number, string> = {
  [WINDOW_NONE]: 'no window (water)',
  [WINDOW_OK]: 'open',
  [WINDOW_TIGHT]: 'tight',
  [WINDOW_NO_WINDOW]: 'no window',
}

/** What the hover readout shows for one run at one station (numbers are null where not defined, e.g. pore pressure in salt). */
export interface Readout {
  branchId: string
  label: string
  station: number
  mdFt: number
  tvdssFt: number
  hydroPpg: number | null
  porePpg: number | null
  overburdenPpg: number | null
  fgPpg: number | null
  widthPpg: number | null
  state: string
  inSalt: boolean
}

const orNull = (v: number): number | null => (Number.isFinite(v) ? v : null)

export function readoutAt(run: PlotRun, station: number): Readout {
  const p = run.pressures
  const s = run.samples
  return {
    branchId: run.branchId,
    label: run.label,
    station,
    mdFt: s.mdFt[station],
    tvdssFt: s.tvdssFt[station],
    hydroPpg: orNull(p.hydroEmw[station]),
    porePpg: orNull(p.poreEmw[station]),
    overburdenPpg: orNull(p.overburdenEmw[station]),
    fgPpg: orNull(p.fgEmw[station]),
    widthPpg: orNull(p.widthPpg[station]),
    state: WINDOW_STATE_NAME[p.state[station]] ?? '',
    inSalt: s.kind[station] === WELL_SALT,
  }
}

/**
 * Stations where the pore pressure is capped at the overburden (u / L >= 1 - 1e-9, F-3) and the pore line is drawn,
 * thinned to at most `max` so a long capped stretch shows as a row of markers rather than a solid blob.
 */
export function cappedStations(run: Pick<PlotRun, 'samples' | 'lines'>, max = 40): number[] {
  const s = run.samples
  const all: number[] = []
  for (let i = 0; i < s.n; i++) if (isCapped(s.uOverL[i]) && Number.isFinite(run.lines.pore[i])) all.push(i)
  if (all.length <= max) return all
  const step = all.length / max
  const out: number[] = []
  for (let k = 0; k < max; k++) out.push(all[Math.floor(k * step)])
  return out
}
