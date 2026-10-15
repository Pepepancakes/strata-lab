// Physical constants used by the process modules (SI). Same values as spike 001.
// G: standard gravity. RHO_W: sea water (typical value). RHO_S: quartz-dominated grain density.
// MU: water viscosity near 20 C. YR: Julian year in seconds (365.25 d).

export const G = 9.81
export const RHO_W = 1025
export const RHO_S = 2650
export const MU = 1.0e-3
/** Halite density, kg/m^3 (Hudec & Jackson 2007). Used by the salt flow (salt.ts). */
export const RHO_SALT = 2160
export const YR = 3.15576e7
/** Buoyant unit weight of solids, Pa/m: (rho_s - rho_w) g. */
export const DRHO_G = (RHO_S - RHO_W) * G
export const SAND = 0
export const MUD = 1
/** Solid thickness (m) that defines the surface (active layer) composition. Numerical choice. */
export const ACTIVE_SOLID = 1.0
/** Solid thickness (m) below which a cell is treated as empty. Numerical choice. */
export const EMPTY = 1e-9
