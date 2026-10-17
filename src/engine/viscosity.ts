// Pore-water viscosity as a function of temperature (AUD-2, F-2; D26.2).
//
// Vogel form  mu(T) = A exp(B / (T - C)),  T in kelvin, fitted (log-space least squares, C scanned
// in 0.05 K steps) to the IAPWS R12-08 viscosity of ordinary water (IAPWS 2008, Huber et al. 2009,
// J. Phys. Chem. Ref. Data 38, 101) evaluated along the liquid line at 0 to 200 C. Accuracy
// against R12-08 eq. 10 over 0 to 200 C: within 0.8 % (tests/viscosity.test.ts checks 1 %). The
// fit was made on densities of liquid water at 0.1 MPa / saturation, so it carries the pressure of
// that line. LEFT OUT: the pressure dependence (R12-08 gives about +1 % per 10 MPa at 20 C, falling
// to about zero near 50 C, and a few percent over 100 MPa at deep-burial temperatures) and salinity
// (sea water is about 5 % more viscous than fresh water at 20 C; brines more). Both are small
// next to the factor 3 to 6 the temperature itself changes. Above 200 C this is an extrapolation.
// Deterministic: a pure function of T.

export const VISC_A = 2.5646642e-5 // Pa s
export const VISC_B = 548.24198 // K
export const VISC_C = 143.85 // K

/** Water viscosity in Pa s at temperature tC (deg C). Below 0 C the 0 C value is used. */
export function waterViscosity(tC: number): number {
  const t = tC < 0 ? 0 : tC
  return VISC_A * Math.exp(VISC_B / (t + 273.15 - VISC_C))
}
