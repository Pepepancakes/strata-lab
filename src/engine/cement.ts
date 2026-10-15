// Quartz cementation of sands, controlled by temperature (M1.4c).
//
// Equations (Walderhaug 1994, 1996):
//   precipitation rate per unit quartz surface   r(T) = a 10^(b T)      [mol/m^2/s, T in deg C]
//   linear growth rate of the overgrowth         g(T) = r(T) Vm         [m/s], Vm = M/rho = 60.09 g/mol / 2.65 g/cm^3
//   cement volume per unit bulk volume of sand   dc   = A integral g(T(t)) dt
//   quartz surface area per bulk volume of sand  A = 6 (1 - phi_f) f / d   (spheres of diameter d; f = clean-quartz share)
// Below the onset temperature (about 70 deg C, `cemTonset`) the rate is set to zero.
// Over one step T is taken as LINEAR in time from its value at the start to its value at the end,
// which makes the integral exact:  integral 10^(bT) dt = dt (10^(b T1) - 10^(b T0)) / (b ln10 (T1 - T0)).
// Because of this, the result does not depend on the step length (the steps may differ, D12).
//
// What the model does with the cement:
//   * Cement is silica from OUTSIDE the model (Walderhaug sources it from stylolites and clay-coated
//     contacts; we do not track that). It is a gain, not a transfer, so it has its own line in the
//     ledger (`cumIn.cement`, stored `rec.cem`) and the sand and mud balances stay exact.
//   * It fills pore space of the sand fraction: the cell's thickness does not change. Walderhaug:
//     after cementation starts, compactional porosity loss is typically minor, so the sand framework
//     is FROZEN at the stress it carried when cementation began (`rec.cemS`; see setPor in
//     compaction.ts). Mud keeps compacting.
//   * Sand porosity seen by flow and logs = compaction porosity - cement / (sand bulk volume), never
//     below 0 (cement cannot exceed the pore space). Permeability follows that porosity.
// Assumptions / limits:
//   * Surface area A is held at its value when cementation begins (Walderhaug adjusts it every step as
//     the overgrowths grow); this overestimates late rates slightly. Same constant-area form is used in
//     the hand-calculation benchmark.
//   * Cement forms in the sand fraction of every cell, however small that fraction is.
//   * Cement adds no weight to the load and no conductivity change (the weight is a few per cent at most).
//   * Muds: no temperature-driven chemical compaction (smectite-illite, opal CT). No source was found
//     that is simple enough to use, and none is invented here; muds keep compacting by stress only.
// Benchmark: tests/burial.test.ts, hand calculation at a constant temperature and at a constant
// heating rate (< 0.5 % relative), plus the mass-balance line.

import { EMPTY } from './constants'
import { setPor } from './compaction'
import type { EngineParams } from './engineParams'
import { SALT } from './record'
import type { EngineState } from './state'

/** Molar mass of quartz, kg/mol, and its density, kg/m^3 (Walderhaug 1996: 60.09 g/mol, 2.65 g/cm^3). */
export const QUARTZ_MOLAR_MASS = 0.06009
export const QUARTZ_DENSITY = 2650
const YR_S = 3.15576e7 // Julian year in seconds (constants.ts YR)
const LN10 = Math.LN10

/** Precipitation rate r(T) of Walderhaug (1994), mol/m^2/s. No onset cut here. */
export function precipitationRate(P: EngineParams, tC: number): number {
  return P.cemA * Math.pow(10, P.cemB * tC)
}

/**
 * Overgrowth thickness (m) grown on quartz between a start and end temperature (deg C) that
 * changes linearly over dtYr. Zero below cemTonset. Exact for the linear-T assumption.
 */
export function quartzGrowth(P: EngineParams, t0C: number, t1C: number, dtYr: number): number {
  const on = P.cemTonset
  const vm = QUARTZ_MOLAR_MASS / QUARTZ_DENSITY // m^3/mol
  const dtS = dtYr * YR_S
  const b = P.cemB
  if (t0C <= on && t1C <= on) return 0
  let a = t0C, c = t1C, span = dtS
  if (a < on || c < on) {
    // only the part of the step above the onset counts; T is linear, so find where it crosses
    const f = (on - a) / (c - a) // 0..1: fraction of the step at which T = onset
    if (a < on) {
      a = on
      span = dtS * (1 - f)
    } else {
      c = on
      span = dtS * f
    }
  }
  let integral: number // integral of 10^(bT) dt over the part above the onset, in seconds
  if (Math.abs(c - a) < 1e-9) integral = span * Math.pow(10, b * a)
  else integral = (span * (Math.pow(10, b * c) - Math.pow(10, b * a))) / (b * LN10 * (c - a))
  return P.cemA * vm * integral
}

/** Quartz surface area per bulk volume of sand, m^2/m^3, for a sand porosity phi. */
export function quartzArea(P: EngineParams, phi: number): number {
  return (6 * (1 - phi) * P.cemSurf) / P.cemGrain
}

/** Sand porosity net of cement for cell i (what flow and well logs see). */
export function sandEffectivePorosity(eng: EngineState, i: number): number {
  const sand = eng.rec.sand[i]
  if (!(sand > 0)) return eng.phs[i]
  const p = eng.phs[i] - (eng.rec.cem[i] * (1 - eng.phs[i])) / sand
  return p > 0 ? p : 0
}

/**
 * Advance cement in cell i over a step in which its temperature went from t0C to t1C.
 * Returns the cement added, solid m (0 if none). Updates the record, the ledger and the cached
 * permeability.
 */
export function cementCell(eng: EngineState, P: EngineParams, i: number, t0C: number, t1C: number, dtYr: number): number {
  const rec = eng.rec
  if (rec.material[i] === SALT) return 0
  const sand = rec.sand[i]
  if (!(sand > EMPTY)) return 0
  const g = quartzGrowth(P, t0C, t1C, dtYr)
  if (!(g > 0)) return 0
  const phi = eng.phs[i]
  const bulkSand = sand / (1 - phi)
  const room = bulkSand - sand - rec.cem[i] // pore space still open
  if (!(room > 0)) return 0
  let add = quartzArea(P, phi) * g * bulkSand
  if (add > room) add = room
  if (rec.cemS[i] === 0) rec.cemS[i] = rec.smax[i] // sand framework freezes here
  rec.cem[i] += add
  rec.ledger.cumIn.cement += add * rec.dx
  setPor(eng, P, i, rec.smax[i]) // permeability follows the new effective porosity
  return add
}
