// Audit labels (AUD-1): the text and the small pure functions behind the notes that make the audit findings visible
// next to the pressure numbers. Nothing here touches the engine. Findings: docs/reviews/physics-audit-m1-m3.md,
// F-1 (bundled deep compaction), F-2 (viscosity), F-3 (cap at the overburden), F-4 (Gulf overburden), F-9 (limits).

import type { Segment } from '../../engine/schedule'
import { getPreset, type PresetId } from '../../engine/presets'
import { BUNDLE_TABLE } from './bundleTable'

// ---- F-3: pore pressure capped at the overburden --------------------------------------------------

/** u / L at or above 1 - CAP_TOL counts as capped: the solver holds u at the buoyant load there (effective stress zero). */
export const CAP_TOL = 1e-9

export function isCapped(uOverL: number | null | undefined): boolean {
  return typeof uOverL === 'number' && Number.isFinite(uOverL) && uOverL >= 1 - CAP_TOL
}

export const CAP_MEANING =
  'The solver never lets the pore pressure pass the overburden: where it would, it holds it there (the rock then carries no load and the water carries all of it). ' +
  'This is a cap, not a measurement. Real seals leak before that point (Hauser 2020), and this model has no leak-off, so a capped cell is a warning, not a prediction.'

export const CAP_MARKER_TEXT = 'Pore pressure is capped at the overburden here (u / L = 1): the model has no leak-off, so treat the pressure as an upper bound.'

export const NO_WINDOW_WORDS =
  'Where the mud-weight window is zero or negative the pore pressure has reached the fracture gradient. In this model that is mostly the cap above, not a prediction of a real well.'

// ---- F-1: bundled deep compaction -----------------------------------------------------------------

/** What the user changed from the preset, as far as the bundling table is concerned: any override or any change to the time steps. */
export function runIsEdited(presetId: PresetId, overrides: object, segments: readonly Segment[]): boolean {
  if (Object.keys(overrides).length > 0) return true
  const p = getPreset(presetId)
  return JSON.stringify(p.segments) !== JSON.stringify(segments)
}

export interface BundlingNoteInput {
  presetId: string
  /** The bundleEvery this run uses (preset value plus any override). */
  bundleEvery: number
  edited: boolean
}

/** The note shown under the well plot and written into the exports; null when deep compaction is solved in full (bundleEvery 1) or linear. */
export function bundlingNote(a: BundlingNoteInput): string | null {
  if (!(a.bundleEvery > 1)) return null
  const entry = BUNDLE_TABLE[a.presetId]
  if (!a.edited && entry && entry.bundleEvery === a.bundleEvery) {
    return `Bundled deep compaction (speed-up): pore pressure below about 5,000 ft may be off by up to ${entry.maxPpg.toFixed(1)} ppg on this preset (99 % of cells within ${(Math.ceil(entry.p99Ppg * 10 - 1e-9) / 10).toFixed(1)} ppg; measured, AUDIT-1). For full accuracy use the Deep compaction switch under Controls (Full accuracy, bundleEvery = 1; slower).`
  }
  return 'Bundled deep compaction (speed-up, bundleEvery = ' + a.bundleEvery + '): pore pressure below about 5,000 ft may be off from the full solve; ' +
    'the difference was not measured for an edited or custom run. For full accuracy use the Deep compaction switch under Controls (Full accuracy, bundleEvery = 1; slower).'
}

// ---- F-2 and F-9: limits of the pressure panel ----------------------------------------------------

export const VISCOSITY_LINE = 'Pore water at 68 F (20 C) viscosity (1 mPa s); the real water is thinner at depth, so the real overpressure would be lower.'
export const VISCOSITY_LINE_HEAT = 'Pore-water viscosity follows temperature (IAPWS 2008); no pressure or salinity effect.'

/** AUD-2: the viscosity line for a run with the heat model on (thermal = 1) or off. */
export function viscosityLine(thermalOn: boolean): string {
  return thermalOn ? VISCOSITY_LINE_HEAT : VISCOSITY_LINE
}

const LIMITS_HEAD =
  'Limits of these pressures: one vertical column at a time (1D drainage, no sideways flow and no leak-off), disequilibrium compaction as the only source of overpressure, ' +
  'a mud permeability that is tuned (not measured), the shale pressure used for sands too (no centroid effect, Traugott 1997), and pore pressure capped at the overburden. '

export function limitsParagraph(thermalOn: boolean): string {
  return LIMITS_HEAD + viscosityLine(thermalOn)
}

export const LIMITS_PARAGRAPH = limitsParagraph(false)

/** True when the run has the heat model on: the override if set, else the preset's value. */
export function thermalIsOn(presetThermal: number, overrides: Record<string, unknown>): boolean {
  const o = overrides.thermal
  return (typeof o === 'number' ? o : presetThermal) === 1
}

// ---- F-4a: Gulf overburden ------------------------------------------------------------------------

export const GULF_NOT_CALIBRATED =
  'Only partly calibrated to the Gulf: the mud uses Hart et al. (1995) Gulf shale coefficients (an extrapolation below 4,900 ft), the sand is still the North Sea curve, so the overburden and the fracture gradient still read low (see the Traugott check under Physics checks).'

export function showsGulfNote(presetId: string): boolean {
  return presetId === 'gulf'
}

/**
 * Traugott (1997, p. 2) deep-water Gulf regional average sediment density between the sea floor and a depth, ppg:
 * 16.3 + (sediment thickness in ft / 3125)^0.6. TRAUGOTT_SOURCE says what was read.
 */
export function traugottSedimentDensityPpg(sedimentThicknessFt: number): number {
  return 16.3 + Math.pow(Math.max(0, sedimentThicknessFt) / 3125, 0.6)
}

/** Sea water in Traugott's conversion, ppg (the paper uses 8.5 for Gulf sea water; the engine's RHO_W is 8.55). */
export const TRAUGOTT_WATER_PPG = 8.5

/**
 * Regional-trend overburden gradient, ppg, at a depth below the SEA SURFACE with a given water depth: the weight of the
 * water column at 8.5 ppg plus the sediment at the average density, divided by the depth. Reproduces the audit's
 * worked value: 2,000 ft of water and 12,300 ft TVD gives 16.7 ppg.
 */
export function traugottOverburdenPpg(waterDepthFt: number, depthBelowSeaSurfaceFt: number): number {
  const sed = Math.max(0, depthBelowSeaSurfaceFt - waterDepthFt)
  if (!(depthBelowSeaSurfaceFt > 0)) return NaN
  return (TRAUGOTT_WATER_PPG * Math.min(waterDepthFt, depthBelowSeaSurfaceFt) + traugottSedimentDensityPpg(sed) * sed) / depthBelowSeaSurfaceFt
}

/**
 * The check reads the sediment cell nearest this depth below the sea floor (the audit's 11,922 ft cell at column 150 and
 * its 8,006 ft cell at column 250 are the nearest it found in its table), or the deepest cell if the column is thinner.
 * The 12,000 ft is a choice that keeps the check inside the range the Gulf trend is quoted for (about 12,000 ft TVD); not physics.
 */
export const TRAUGOTT_REF_BELOW_SEAFLOOR_FT = 12000

export interface TraugottCheck {
  modelPpg: number
  trendPpg: number
  /** trend minus model: positive when the model is lighter than the regional trend. */
  gapPpg: number
  depthBelowSeaFt: number
  waterDepthFt: number
}

export function traugottCheck(cell: { depthBelowSeaFt: number; waterDepthFt: number; overburdenPpg: number } | null): TraugottCheck | null {
  if (!cell || !(cell.depthBelowSeaFt > cell.waterDepthFt)) return null
  const trendPpg = traugottOverburdenPpg(cell.waterDepthFt, cell.depthBelowSeaFt)
  return { modelPpg: cell.overburdenPpg, trendPpg, gapPpg: trendPpg - cell.overburdenPpg, depthBelowSeaFt: cell.depthBelowSeaFt, waterDepthFt: cell.waterDepthFt }
}

export const TRAUGOTT_SOURCE =
  'Traugott (1997), World Oil Deepwater Supplement, p. 2: deep-water Gulf regional average sediment density = 16.3 + (sediment thickness, ft / 3125)^0.6 ppg, combined with the water column at 8.5 ppg. ' +
  'A regional trend, not a local log: a gap of about 0.5 ppg is ordinary; the check flags a gap over 1 ppg.'

/** A gap larger than this (ppg) fails the check. A labelling threshold, not physics. */
export const TRAUGOTT_FLAG_PPG = 1
