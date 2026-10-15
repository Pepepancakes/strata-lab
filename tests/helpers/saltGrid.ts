// Grid-convergence experiments for the diapir width (M3.2).
//   1. roofSpectrum(): salt-only sandbox with a level seafloor and seeded roof noise, measuring the
//      dominant wavelength of the growing roof relief. This is the clean test of "does the grid or
//      the physics set the width": with no bending the fastest mode is the grid's own Nyquist mode.
//   2. runThinSpot(): spike 002 grid_check.js in the full engine (3 Myr, wedge, sedimentation).
// Both run a 100 km section (400 columns of 250 m is the record's column limit, MAX_COLUMNS).
import { defaultEngineParams, type EngineParams } from '../../src/engine/engineParams'
import { buildSchedule } from '../../src/engine/schedule'
import { cellBulk, rebuildCaches, recomputeH, setPor } from '../../src/engine/compaction'
import { createRecord, markInitialLedger, SALT } from '../../src/engine/record'
import { saltStep } from '../../src/engine/salt'
import { allocateEngine, type EngineState } from '../../src/engine/state'
import { createRng } from '../../src/engine/rng'
import { createEngine, initialSurface, step } from '../../src/engine/step'
import { seaLevelOf } from './run'

export const SECTION = 100000 // m, model width
export const GRIDS = [1000, 500, 250] as const

// ---- 1. level-seafloor sandbox with roof noise --------------------------------------------------

export interface SpectrumResult {
  /** Power-weighted mean wavelength of the roof relief, km: 2 pi sum(P) / sum(k P) over the cosine modes. */
  lambdaKm: number
  /** Years run until the rms relief reached the target. */
  tYr: number
  clipped: number
  /** Salt volume error, relative. */
  saltErr: number
}

/**
 * Flat salt (1,500 m) under 1,000 m of dense cover (no pores) whose seafloor is kept level (the cover
 * is reset before each salt step), roof noise seeded with `seed` (white per column, amplitude scaled
 * by 1/sqrt(dx) so every grid starts with the same relief per unit wavenumber). Runs until the rms
 * relief of the salt thickness is `relief` m (a few e-foldings of growth, still linear), then returns
 * the mean wavelength of the cosine spectrum. `over` changes parameters (coverBend, coverVisc ...).
 */
export function roofSpectrum(dx: number, seed: number, over: Partial<EngineParams>, relief = 20): SpectrumResult {
  const nx = Math.round(SECTION / dx)
  const P: EngineParams = { ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, nx, dx, saltVisc: 1e17, nSaltSub: 1, ...over }
  const rec = createRecord({ nx, dx, capacity: 4, startAgeMa: 0, preLayers: 2 })
  const top = -2000
  const rng = createRng(seed)
  const s0 = 0.5 * Math.sqrt(500 / dx)
  let mean0 = 0
  for (let j = 0; j < nx; j++) {
    rec.mud[j] = 1500 + s0 * (rng.next() - 0.5) * Math.sqrt(12)
    mean0 += rec.mud[j]
    rec.material[j] = SALT
    rec.mud[nx + j] = 1000
    rec.b[j] = top - 1000 - 1500
    rec.H[j] = top
  }
  mean0 /= nx
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  eng.phm.fill(0)
  eng.phs.fill(0)
  const dtYr = 250
  let tYr = 0
  for (let s = 0; s < 40000; s++) {
    for (let j = 0; j < nx; j++) rec.mud[nx + j] = top - (rec.b[j] + rec.mud[j])
    saltStep(eng, P, -1e6, dtYr)
    tYr += dtYr
    let v = 0
    for (let j = 0; j < nx; j++) v += (rec.mud[j] - mean0) ** 2
    if (Math.sqrt(v / nx) > relief) break
  }
  let sP = 0
  let sKP = 0
  for (let q = 1; q < nx; q++) {
    let a = 0
    for (let j = 0; j < nx; j++) a += (rec.mud[j] - mean0) * Math.cos((Math.PI * q * (j + 0.5)) / nx)
    const p = ((a * 2) / nx) ** 2
    sP += p
    sKP += ((Math.PI * q) / (nx * dx)) * p
  }
  let vol = 0
  for (let j = 0; j < nx; j++) vol += rec.mud[j]
  return { lambdaKm: (2 * Math.PI * sP) / sKP / 1000, tYr, clipped: eng.diag.saltClip, saltErr: vol / nx / mean0 - 1 }
}

// ---- 2. spike 002 grid_check in the full engine ------------------------------------------------

export const X0 = 70000 // m, centre of the thin spot
export const COVER_BULK = 1000 // m, older cover over the salt
export const COVER_SMAX = 30e6 // Pa, its past maximum effective stress (as in the spike)

export interface GridRun {
  eng: EngineState
  P: EngineParams
  /** Salt thickness per column at the end, m. */
  hs: Float64Array
  ms: number
}

export interface Width {
  /** Peak salt thickness in the window, m. */
  peak: number
  /** Background: median salt thickness over X0 +- 30 km, m. */
  background: number
  /** Full width at half height of the high above the background, m (crossings placed by linear interpolation). */
  fwhm: number
  /** Columns above half height. */
  cells: number
}

/** Salt thickness high near X0: full width at half height above the median thickness over X0 +- 30 km. */
export function saltHighWidth(hs: Float64Array, dx: number): Width {
  const nx = hs.length
  const j0 = Math.round((X0 - 20000) / dx)
  const j1 = Math.round((X0 + 20000) / dx)
  let jm = j0
  for (let j = j0; j < j1; j++) if (hs[j] > hs[jm]) jm = j
  const win = Array.from(hs.slice(Math.round((X0 - 30000) / dx), Math.min(nx, Math.round((X0 + 30000) / dx)))).sort((a, b) => a - b)
  const background = win[Math.floor(win.length / 2)]
  const half = background + (hs[jm] - background) / 2
  let l = jm
  let r = jm
  while (l > 0 && hs[l] > half) l--
  while (r < nx - 1 && hs[r] > half) r++
  const xl = l < jm ? (l + 0.5 + (half - hs[l]) / (hs[l + 1] - hs[l])) * dx : (jm + 0.5) * dx
  const xr = r > jm ? (r + 0.5 - (half - hs[r]) / (hs[r - 1] - hs[r])) * dx : (jm + 0.5) * dx
  return { peak: hs[jm], background, fwhm: xr - xl, cells: r - l - 1 }
}

/** Default schedule (3 Myr), older cover 1,000 m with one Gaussian thin spot (fraction `amp` thinner, half-width `wid` m) at X0. */
export function runThinSpot(dx: number, amp: number, wid: number, over: Partial<EngineParams>): GridRun {
  const nx = Math.round(SECTION / dx)
  const P: EngineParams = { ...defaultEngineParams(), saltOn: 1, nx, dx, saltVisc: 1e17, ...over }
  const schedule = buildSchedule()
  const eng = createEngine(P, schedule)
  const rec = eng.rec
  for (let j = 0; j < nx; j++) {
    const x = (j + 0.5) * dx
    const f = 1 - amp * Math.exp(-(((x - X0) / wid) ** 2))
    const i = nx + j
    rec.smax[i] = COVER_SMAX
    setPor(eng, P, i, COVER_SMAX)
    const scale = (COVER_BULK * f) / cellBulk(eng, P, i)
    rec.sand[i] *= scale
    rec.mud[i] *= scale
    rec.b[j] = initialSurface(x) - COVER_BULK * f - rec.mud[j] // seafloor stays where it was
  }
  markInitialLedger(rec)
  rebuildCaches(eng, P)
  recomputeH(eng, P)
  const sl = seaLevelOf(P, schedule)
  const t0 = performance.now()
  while (step(eng, P, schedule, sl)) { /* run */ }
  const ms = performance.now() - t0
  return { eng, P, hs: Float64Array.from(rec.mud.subarray(0, nx)), ms }
}
