// Sea-level interface. The engine asks a SeaLevelCurve for sea level (m, relative to present)
// at tYr, the ELAPSED model time in years since the start of the run (not an age).
// Why an interface: M1 ships the spike's teaching sine; M1.4 adds a published curve behind the
// same type without touching the solver.

export type SeaLevelCurve = (tYr: number) => number

export interface SineSeaLevelParams {
  slAmp: number
  slPeriod: number
  slShift: number
}

/** Exactly the spike's seaLevel(): slAmp * sin(2 pi t / slPeriod) + slShift. */
export function sineSeaLevel(p: SineSeaLevelParams): SeaLevelCurve {
  const { slAmp, slPeriod, slShift } = p
  return (tYr) => slAmp * Math.sin((2 * Math.PI * tYr) / slPeriod) + slShift
}
