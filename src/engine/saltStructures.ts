// Salt structures read off a finished (or any) section: salt highs, minibasins and welded runs (M3.4).
// Pure functions of the salt thickness profile; no physics here, only a way to count and measure what
// the salt flow made, so a preset can be checked and a report can be written.
//
// Definitions (stated so a test or a reader can argue with them):
//   prominence   how far a high rises above, or a low sinks below, the higher of the two saddles that
//                join it to a taller (or deeper) neighbour (topographic prominence). Where one side has
//                no taller neighbour before the section edge, the lowest point out to the edge is the
//                saddle on that side. A low is measured from the lower of its two rims.
//   salt high    a local maximum of salt thickness with prominence >= minProm (m). Its width is the
//                full width at half prominence. Diapir = a salt high; "reaches near the seafloor" is
//                judged from the cover thickness over it (roof depth below the seafloor).
//   minibasin    a local minimum of salt thickness with prominence >= minProm, so salt at least minProm
//                thicker on BOTH sides (the sag between two highs; the thinning under a wedge that runs
//                out at the pinch-out has no rim on its landward side and is not counted).
//                Width = full width at half prominence of the low.
//   weld run     neighbouring columns whose salt is now thinner than weldThick and that were thicker
//                before (weldAge set, M3.3).
// The numbers depend on minProm; reports state the value used.

import { WELD_NONE } from './state'

export interface SaltFeature {
  /** Column index of the crest (high) or the deepest point (low). */
  j: number
  /** Distance from the section start to the column centre, m. */
  x: number
  /** Salt thickness there, m. */
  thick: number
  prominence: number
  /** Full width at half prominence, m. */
  width: number
}

/** Prominence of the extremum at j of `v` (sign +1 for a maximum, -1 for a minimum). */
function prominenceAt(v: ArrayLike<number>, j: number, sign: 1 | -1): number {
  const n = v.length
  const a = sign * v[j]
  // Walk each way until something taller (in the sign-flipped series) or the edge; the saddle on a
  // side is the lowest point of that walk. The higher of the two saddles sets the prominence.
  let lMin = a
  for (let q = j - 1; q >= 0; q--) {
    const b = sign * v[q]
    if (b > a) break
    if (b < lMin) lMin = b
  }
  let rMin = a
  for (let q = j + 1; q < n; q++) {
    const b = sign * v[q]
    if (b > a) break
    if (b < rMin) rMin = b
  }
  return a - Math.max(lMin, rMin)
}

function widthAtHalf(v: ArrayLike<number>, j: number, sign: 1 | -1, prom: number, dx: number): number {
  const n = v.length
  const level = sign * v[j] - prom / 2 // in the sign-flipped series the feature is a maximum
  let l = j
  while (l > 0 && sign * v[l] > level) l--
  let r = j
  while (r < n - 1 && sign * v[r] > level) r++
  const xl = l < j && sign * v[l] <= level ? l + (level - sign * v[l]) / (sign * v[l + 1] - sign * v[l]) : l
  const xr = r > j && sign * v[r] <= level ? r - (level - sign * v[r]) / (sign * v[r - 1] - sign * v[r]) : r
  return Math.max(dx, (xr - xl) * dx)
}

/** Local extrema of v (maxima for sign 1, minima for -1) that are at least `minProm` prominent. */
function features(v: ArrayLike<number>, dx: number, sign: 1 | -1, minProm: number): SaltFeature[] {
  const out: SaltFeature[] = []
  const n = v.length
  for (let j = 0; j < n; j++) {
    const a = sign * v[j]
    // a local extremum: not below the left neighbour, strictly above the right (the first column of a plateau)
    if (j > 0 && sign * v[j - 1] > a) continue
    if (j < n - 1 && sign * v[j + 1] >= a) continue
    const prom = prominenceAt(v, j, sign)
    if (prom < minProm) continue
    out.push({ j, x: (j + 0.5) * dx, thick: v[j], prominence: prom, width: widthAtHalf(v, j, sign, prom, dx) })
  }
  return out
}

/** Salt highs (diapirs and broad swells) of the salt thickness profile `h`. */
export function saltHighs(h: ArrayLike<number>, dx: number, minProm: number): SaltFeature[] {
  return features(h, dx, 1, minProm)
}

/**
 * Minibasins: sags of the salt thickness with salt at least `minProm` thicker on both sides. A sag
 * next to the pinch-out or the section edge has no rim on that side and is not counted.
 */
export function minibasins(h: ArrayLike<number>, dx: number, minProm: number): SaltFeature[] {
  return features(h, dx, -1, minProm)
}

/** Centre-to-centre distances between neighbouring features, m. */
export function spacings(f: readonly SaltFeature[]): number[] {
  const s: number[] = []
  for (let i = 1; i < f.length; i++) s.push(f[i].x - f[i - 1].x)
  return s
}

export interface WeldRun {
  /** First and last column of the run. */
  j0: number
  j1: number
  /** Start and end of the run, km from the section start (column edges). */
  fromKm: number
  toKm: number
  /** Youngest and oldest weld age in the run, Ma. */
  firstMa: number
  lastMa: number
}

/** Runs of neighbouring columns that have welded (weldAge set) and whose salt is now below `weldThick`. */
export function weldRuns(weldAge: ArrayLike<number>, h: ArrayLike<number>, weldThick: number, dx: number): WeldRun[] {
  const runs: WeldRun[] = []
  const n = weldAge.length
  let j = 0
  while (j < n) {
    if (weldAge[j] !== WELD_NONE && h[j] < weldThick) {
      let k = j
      let oldest = weldAge[j]
      let youngest = weldAge[j]
      while (k + 1 < n && weldAge[k + 1] !== WELD_NONE && h[k + 1] < weldThick) {
        k++
        oldest = Math.max(oldest, weldAge[k])
        youngest = Math.min(youngest, weldAge[k])
      }
      runs.push({ j0: j, j1: k, fromKm: (j * dx) / 1000, toKm: ((k + 1) * dx) / 1000, firstMa: oldest, lastMa: youngest })
      j = k + 1
    } else j++
  }
  return runs
}
