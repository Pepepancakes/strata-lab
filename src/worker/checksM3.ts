// M3 rows of the in-app physics checks (salt flow). Each compares the engine with a hand calculation
// written here from the formula; the expected number never comes from the engine function under test.
// Runs in well under a second (hand-built flat salt sheets, no sediment transport).
//
// (a) Channel-flow decay. A small cosine bump on a flat salt sheet of thickness h under deep water
//     relaxes at the rate
//         r = h^3 (rho_salt - rho_w) g k^2 / (12 eta)            [1/s]
//     (thin-sheet / Poiseuille flow between no-slip plates, Turcotte & Schubert, Geodynamics, channel
//     flow). The measured rate is minus the slope of ln(amplitude) over a few e-folds.
// (b) Bending dispersion peak. A salt channel under a level-topped, dense cover that resists bending as a
//     viscous plate (D = eta_c h_c^3 / 3) has growth rate
//         sigma(k) = drho g h^3 k^2 / (12 eta_s + D h^3 k^6),     drho = rho_s - rho_salt
//     fastest at lambda* = 2 pi (eta_c h_c^3 h^3 / (18 eta_s))^(1/6). The engine is run at five wavelengths
//     around lambda*, the growth rates are measured, and the peak is found from a parabola through the
//     three highest points in log wavenumber (same procedure as tests/coverBending.test.ts).
// (c) Salt balance. Salt is neither made nor lost by flow: the volume in the section after a run of
//     flow driven by a sediment load step equals the volume before (the sum of the thickness array),
//     and no salt is clipped (diag.saltClip = 0). Sand and mud are untouched by the salt step.
// Cross-machine: the two flow rows use tolerances of 1 % and 5 % (the same bands as the tests).

import { G, RHO_S, RHO_SALT, RHO_W, YR } from '../engine/constants'
import { defaultEngineParams, type EngineParams } from '../engine/engineParams'
import { createRecord, markInitialLedger, SALT } from '../engine/record'
import { saltSedimentLoads, saltStep, saltVolume } from '../engine/salt'
import { allocateEngine, type EngineState } from '../engine/state'
import type { CheckResult } from './protocol'

const SALT_CITE = 'Thin-sheet channel flow (Turcotte & Schubert, Geodynamics); see docs/physics-references.md, salt flow.'
const BEND_CITE = 'Viscous-plate bending of the cover (D = eta_c h_c^3 / 3, Turcotte & Schubert); dispersion relation derived in src/engine/salt.ts and docs/physics-references.md (cover bending).'
const MASS_CITE = 'Project rule (docs/agent-guide.md, principle 1): mass is conserved per material (sand, mud, salt), not only in total.'

const saltParams = (over: Partial<EngineParams>): EngineParams => ({ ...defaultEngineParams(), saltOn: 1, seaLevelKind: 'sine', slAmp: 0, slShift: 0, ...over })

/** A bare salt sheet (one layer, basement 4.5 km down so the water is deep): thickness(j) in m. */
function bareSalt(nx: number, dx: number, thickness: (j: number) => number, preLayers = 1, cover = 0): EngineState {
  const rec = createRecord({ nx, dx, capacity: 4, startAgeMa: 0, preLayers })
  for (let j = 0; j < nx; j++) {
    const h = thickness(j)
    rec.mud[j] = h
    rec.material[j] = SALT
    rec.b[j] = -4500
    if (preLayers === 2) rec.mud[nx + j] = cover
    rec.H[j] = rec.b[j] + h + cover
  }
  markInitialLedger(rec)
  const eng = allocateEngine(rec)
  eng.phm.fill(0)
  eng.phs.fill(0)
  return eng
}

/** Amplitude of the cosine mode m (m half waves across the section) in the salt thickness around h0. */
function modeAmp(eng: EngineState, m: number, h0: number): number {
  const nx = eng.rec.nx
  let num = 0
  let den = 0
  for (let j = 0; j < nx; j++) {
    const c = Math.cos((Math.PI * m * (j + 0.5)) / nx)
    num += (eng.rec.mud[j] - h0) * c
    den += c * c
  }
  return num / den
}

// ---- (a) decay ---------------------------------------------------------------------------------
const DECAY = { nx: 100, dx: 1000, h0: 1500, amp: 0.1, eta: 1e17, wavelengthKm: 50 }

/** `engineEtaScale` multiplies the viscosity the ENGINE sees (the hand value keeps the true one): 1 in the app, other values only in tests, to show a real change fails the band. */
export function decayRow(engineEtaScale = 1): CheckResult {
  const { nx, dx, h0, amp, eta, wavelengthKm } = DECAY
  const m = (2 * nx * dx) / 1000 / wavelengthKm
  const k = (Math.PI * m) / (nx * dx)
  const P = saltParams({ nx, dx, saltVisc: eta * engineEtaScale, nSaltSub: 20 })
  const eng = bareSalt(nx, dx, (j) => h0 + amp * Math.cos((Math.PI * m * (j + 0.5)) / nx))
  const rHand = ((h0 * h0 * h0) / (12 * eta)) * (RHO_SALT - RHO_W) * G * k * k
  const dtYr = 1 / rHand / YR / 50
  for (let s = 0; s < 50; s++) saltStep(eng, P, 0, dtYr)
  const rNum = -Math.log(modeAmp(eng, m, h0) / amp) / (50 * dtYr * YR)
  const err = Math.abs(rNum / rHand - 1)
  return {
    id: 'salt-decay', label: 'Salt channel-flow decay vs h\u00b3 (\u03c1_salt \u2212 \u03c1_w) g k\u00b2 / 12\u03b7 (50 km bump)', pass: err < 0.01 && eng.diag.saltClip === 0,
    value: err, limit: 0.01, unit: 'relative',
    detail: `Hand rate ${(rHand * YR).toExponential(3)} /yr (h = ${h0} m, \u03b7 = ${eta.toExponential(0)} Pa s, wavelength ${wavelengthKm} km); the engine's bump decays at ${(rNum * YR).toExponential(3)} /yr.`,
    cite: SALT_CITE,
  }
}

// ---- (b) dispersion peak -----------------------------------------------------------------------
const BEND = { nx: 200, dx: 250, h0: 1500, hc: 1000, etaS: 1e17, etaC: 1e19, amp: 0.1, modes: [5, 7, 10, 14, 18], nSteps: 800 }

function growthRate(m: number): number {
  const { nx, dx, h0, hc, etaS, etaC, amp, nSteps } = BEND
  const P = saltParams({ nx, dx, saltVisc: etaS, coverVisc: etaC, nSaltSub: 1, coverBend: 1 })
  const k = (Math.PI * m) / (nx * dx)
  const D = (etaC * hc ** 3) / 3
  const sigma = ((RHO_S - RHO_SALT) * G * h0 ** 3 * k * k) / (12 * etaS + D * h0 ** 3 * k ** 6)
  const eng = bareSalt(nx, dx, (j) => h0 + amp * Math.cos((Math.PI * m * (j + 0.5)) / nx), 2, hc)
  const rec = eng.rec
  const top = rec.b[0] + h0 + hc // level seafloor: sedimentation fills lows and erodes highs
  const dtYr = 1 / Math.abs(sigma) / YR / nSteps
  for (let s = 0; s < nSteps; s++) {
    for (let j = 0; j < nx; j++) rec.mud[nx + j] = top - (rec.b[j] + rec.mud[j])
    saltStep(eng, P, -1e6, dtYr)
  }
  return Math.log(modeAmp(eng, m, h0) / amp) / (nSteps * dtYr * YR)
}

function dispersionRow(): CheckResult {
  const { nx, dx, h0, hc, etaS, etaC, modes } = BEND
  const lambdaStar = 2 * Math.PI * Math.pow((etaC * hc ** 3 * h0 ** 3) / (18 * etaS), 1 / 6)
  const ks = modes.map((m) => (Math.PI * m) / (nx * dx))
  const rates = modes.map(growthRate)
  const i = Math.min(Math.max(1, rates.indexOf(Math.max(...rates))), modes.length - 2)
  const x = [Math.log(ks[i - 1]), Math.log(ks[i]), Math.log(ks[i + 1])]
  const y = [rates[i - 1], rates[i], rates[i + 1]]
  const d1 = (y[1] - y[0]) / (x[1] - x[0])
  const d2 = (y[2] - y[1]) / (x[2] - x[1])
  const a = (d2 - d1) / (x[2] - x[0])
  const b = d1 - a * (x[0] + x[1])
  const lambdaMeasured = (2 * Math.PI) / Math.exp(-b / (2 * a))
  const err = Math.abs(lambdaMeasured / lambdaStar - 1)
  return {
    id: 'salt-bending-peak', label: 'Cover bending: fastest-growing wavelength \u03bb* = 2\u03c0 (\u03b7_c h_c\u00b3 h\u00b3 / 18\u03b7_s)^(1/6)', pass: err < 0.05 && Number.isFinite(err),
    value: err, limit: 0.05, unit: 'relative',
    detail: `Hand \u03bb* = ${(lambdaStar / 1000).toFixed(2)} km (1 km of cover over 1.5 km of salt, \u03b7_c ${etaC.toExponential(0)}, \u03b7_s ${etaS.toExponential(0)} Pa s). The engine's growth rates at ${modes.length} wavelengths peak at ${(lambdaMeasured / 1000).toFixed(2)} km.`,
    cite: BEND_CITE,
  }
}

// ---- (c) salt balance --------------------------------------------------------------------------
function balanceRow(): CheckResult {
  const nx = 40
  const dx = 1000
  const h0 = 1500
  const P = saltParams({ nx, dx, saltVisc: 1e18, nSaltSub: 1, coverBend: 0 })
  const eng = bareSalt(nx, dx, () => h0)
  const rec = eng.rec
  // 100 m of mud solids (porosity 0.4) on the left half: the load that drives the salt basinward
  rec.nLayers = 2
  for (let j = 0; j < nx / 2; j++) {
    rec.mud[nx + j] = 100
    eng.phm[nx + j] = 0.4
  }
  saltSedimentLoads(eng, P)
  let before = 0
  for (let j = 0; j < nx; j++) before += rec.mud[j] * dx // hand sum of the array
  let sandBefore = 0
  for (let j = 0; j < nx; j++) sandBefore += rec.sand[j] + rec.sand[nx + j]
  for (let s = 0; s < 200; s++) saltStep(eng, P, 0, 5000)
  let moved = 0
  for (let j = 0; j < nx; j++) moved = Math.max(moved, Math.abs(rec.mud[j] - h0))
  const err = Math.abs(saltVolume(rec) - before) / before
  let sandAfter = 0
  for (let j = 0; j < nx; j++) sandAfter += rec.sand[j] + rec.sand[nx + j]
  return {
    id: 'balance-salt', label: 'Mass balance, salt only', pass: err < 1e-12 && eng.diag.saltClip === 0 && sandAfter === sandBefore,
    value: err, limit: 1e-12, unit: 'relative',
    detail: `Salt volume after 1 Myr of flow under a 100 m mud load on half the section (salt moved by up to ${moved.toFixed(0)} m) against the volume before (${(before / 1e6).toFixed(2)} km\u00b2). Clipped: ${eng.diag.saltClip}; sand and mud untouched by the salt step.`,
    cite: MASS_CITE,
  }
}

export function runChecksM3(): CheckResult[] {
  return [decayRow(), dispersionRow(), balanceRow()]
}
