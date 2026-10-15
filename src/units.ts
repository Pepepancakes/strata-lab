// Unit conversion. The engine works in SI; everything John reads is in ft, psi, ppg and km.
// ALL conversions live in this file. Views call these; nothing else does its own arithmetic.
//
// Sources: exact definitions. 1 ft = 0.3048 m; 1 psi = 6894.757293168 Pa (lbf/in^2 from the
// international foot and the avoirdupois pound-force); 1 US gal = 3.785411784 L; 1 lb = 0.45359237 kg.

export const M_PER_FT = 0.3048
export const PA_PER_PSI = 6894.757293168
const KG_PER_LB = 0.45359237
const M3_PER_GAL = 0.003785411784
const G = 9.80665 // standard gravity, m/s^2

/** kg/m^3 per ppg (pounds per US gallon). */
export const KGM3_PER_PPG = KG_PER_LB / M3_PER_GAL

export const mToFt = (m: number): number => m / M_PER_FT
export const ftToM = (ft: number): number => ft * M_PER_FT
export const mToKm = (m: number): number => m / 1000
export const kmToM = (km: number): number => km * 1000
export const paToPsi = (pa: number): number => pa / PA_PER_PSI
export const psiToPa = (psi: number): number => psi * PA_PER_PSI

/** Density in kg/m^3 to ppg. */
export const densityToPpg = (kgm3: number): number => kgm3 / KGM3_PER_PPG

/**
 * Pressure gradient (Pa per m of depth) to equivalent mud weight in ppg.
 * EMW = (dP/dz) / g, expressed as a density. Fresh water (1000 kg/m^3) gives 8.345 ppg.
 */
export const gradientToPpg = (paPerM: number): number => densityToPpg(paPerM / G)

/** Pressure (Pa) at a depth (m, must be > 0) to equivalent mud weight in ppg. */
export const pressureToEmwPpg = (pa: number, depthM: number): number => gradientToPpg(pa / depthM)

// ---- temperature, area, rates -------------------------------------------------------------------
export const cToF = (c: number): number => c * 1.8 + 32
export const fToC = (f: number): number => (f - 32) / 1.8
/** Solid area in a 2D section, m^2 (= m^3 per metre of margin), to km^2. */
export const m2ToKm2 = (m2: number): number => m2 / 1e6

// ---- display units of the parameter registry ---------------------------------------------------
// The registry (engine/params.ts) names an SI unit and the unit John reads. This table is the one
// place that turns one into the other, so a control shows ft, ppg-style units, deg F, km and so on
// while the engine keeps SI. Each entry converts SI -> display (`to`) and back (`from`).

export interface UnitConversion {
  to: (si: number) => number
  from: (display: number) => number
}

const same: UnitConversion = { to: (v) => v, from: (v) => v }
const scale = (k: number): UnitConversion => ({ to: (v) => v * k, from: (v) => v / k })

const CONVERSIONS: Record<string, UnitConversion> = {
  'm->ft': { to: mToFt, from: ftToM },
  'm->km': { to: mToKm, from: kmToM },
  'm->mm': scale(1000),
  'm^2/yr->ft^2/yr': scale(1 / (M_PER_FT * M_PER_FT)),
  'm/Myr->ft/Myr': { to: mToFt, from: ftToM },
  'yr->Myr': scale(1e-6),
  'yr->kyr': scale(1e-3),
  '1/Pa->1/psi': scale(PA_PER_PSI),
  'W/m^2->mW/m^2': scale(1000),
  'deg C->deg F': { to: cToF, from: fToC },
}

/** Conversion between a registry SI unit and its display unit. Same unit (or unlisted pair) = no change. */
export function displayConversion(unit: string, displayUnit: string): UnitConversion {
  if (unit === displayUnit) return same
  const c = CONVERSIONS[`${unit}->${displayUnit}`]
  if (!c) throw new Error(`units: no conversion from ${unit} to ${displayUnit}`)
  return c
}

/** Does the registry ask for a display unit this module can convert to? (Test guard for new parameters.) */
export function hasDisplayConversion(unit: string, displayUnit: string): boolean {
  return unit === displayUnit || `${unit}->${displayUnit}` in CONVERSIONS
}
