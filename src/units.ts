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
