// M2 rows of the in-app physics checks (slope failure and run-out). Each compares the engine with a
// hand calculation written here from the formula; the expected number never comes from the engine
// function under test. Runs in a few milliseconds (a 60 x 4 hand-built section, no time stepping).
//
// (a) Infinite slope, cohesionless: FS = tan(phi)/tan(beta) x (1 - ru).
// (b) FS = 1 when ru = 1 - tan(beta)/tan(phi).
// (c) Bingham flow on a slope: plug thickness h_p = tau_y / (rho' g sin(theta)); a flow thinner
//     than h_p does not move.
// (d) One failure event on a steep, overpressured hand-built slope: per grain size, solids before =
//     solids after + solids exported (m^2). The expected value is the sum of the arrays, not the ledger.

import { G } from '../engine/constants'
import { cellBulk, rebuildCaches, recomputeH } from '../engine/compaction'
import { defaultEngineParams, type EngineParams } from '../engine/engineParams'
import { failureStep, mtdBalance } from '../engine/failure'
import { appendLayer, createRecord, markInitialLedger } from '../engine/record'
import { binghamUniform } from '../engine/runout'
import { infiniteSlopeFS } from '../engine/stability'
import { allocateEngine } from '../engine/state'
import type { CheckResult } from './protocol'

const deg = (d: number) => (d * Math.PI) / 180

/** The 30-column hand-built slope of tests/failure.test.ts: tan(beta) = 0.15 over 10 km, then flat. */
function failingSection() {
  const NX = 30
  const DX = 1000
  const P: EngineParams = { ...defaultEngineParams(), nx: NX, dx: DX, failOn: 1, failMaxIters: 1 }
  const rec = createRecord({ nx: NX, dx: DX, capacity: 6, startAgeMa: 1 })
  const eng = allocateEngine(rec)
  for (let n = 0; n < 4; n++) {
    const k = appendLayer(rec, 1000, 1 - n * 0.001, (n + 1) * 1000)
    for (let j = 0; j < NX; j++) {
      rec.sand[k * NX + j] = 3
      rec.mud[k * NX + j] = 12
    }
  }
  rebuildCaches(eng, P)
  for (let i = 0; i < 5 * NX; i++) rec.u[i] = 0.8 * eng.ld[i]
  let bulk = 0
  for (let l = 0; l < rec.nLayers; l++) bulk += cellBulk(eng, P, l * NX)
  for (let j = 0; j < NX; j++) rec.b[j] = -0.15 * Math.min((j + 0.5) * DX, 10000) - bulk
  recomputeH(eng, P)
  markInitialLedger(rec)
  return { eng, P, NX, DX }
}

export function runChecksM2(): CheckResult[] {
  const out: CheckResult[] = []
  const cite = 'Infinite-slope limit-equilibrium factor of safety (textbook form; see docs/physics-references.md, slope stability).'
  const add = (id: string, label: string, value: number, limit: number, unit: string, detail: string, citeText: string, pass = value < limit) =>
    out.push({ id, label, pass, value, limit, unit, detail, cite: citeText })

  // (a) one case: 6 degrees, 25 degrees, ru 0.5, no cohesion. L = 1 MPa (cancels).
  {
    const beta = deg(6)
    const phi = deg(25)
    const ru = 0.5
    const L = 1e6
    const expected = (Math.tan(phi) / Math.tan(beta)) * (1 - ru)
    const got = infiniteSlopeFS(L, ru * L, beta, Math.tan(phi), 0)
    add('slope-fs', `Infinite-slope FS, 6\u00b0 slope, 25\u00b0 friction, r_u 0.5`, Math.abs(got - expected) / expected, 1e-12, 'relative',
      `Engine FS ${got.toFixed(4)} against tan(25\u00b0)/tan(6\u00b0) \u00d7 (1 \u2212 0.5) = ${expected.toFixed(4)}.`, cite)
  }
  // (b) FS = 1 at ru = 1 - tan(beta)/tan(phi)
  {
    const beta = deg(6)
    const phi = deg(25)
    const ruCrit = 1 - Math.tan(beta) / Math.tan(phi)
    const L = 1e6
    const fs = infiniteSlopeFS(L, ruCrit * L, beta, Math.tan(phi), 0)
    const below = infiniteSlopeFS(L, (ruCrit - 0.05) * L, beta, Math.tan(phi), 0)
    const above = infiniteSlopeFS(L, (ruCrit + 0.05) * L, beta, Math.tan(phi), 0)
    add('slope-ru-crit', 'FS crosses 1 at r_u = 1 \u2212 tan(\u03b2)/tan(\u03c6) (6\u00b0, 25\u00b0)', Math.abs(fs - 1), 1e-12, 'FS',
      `Hand value r_u = ${ruCrit.toFixed(4)}; the engine gives FS = ${fs.toFixed(6)} there, ${below.toFixed(3)} at r_u \u2212 0.05 (stable) and ${above.toFixed(3)} at r_u + 0.05 (fails).`, cite,
      Math.abs(fs - 1) < 1e-12 && below > 1 && above < 1)
  }
  // (c) Bingham plug
  {
    const tauY = 2000
    const rhoP = 600
    const theta = deg(5)
    const mu = 100
    const hp = tauY / (rhoP * G * Math.sin(theta))
    const thick = binghamUniform(3 * hp, theta, rhoP, tauY, mu)
    const thin = binghamUniform(0.9 * hp, theta, rhoP, tauY, mu)
    const err = Math.abs(thick.plug - hp) / hp
    add('bingham-plug', 'Bingham plug thickness h_p = \u03c4_y / (\u03c1\u2032 g sin \u03b8), 5\u00b0 slope', err, 1e-9, 'relative',
      `Hand h_p = ${hp.toFixed(3)} m for a flow 3 \u00d7 h_p thick (engine plug ${thick.plug.toFixed(3)} m, moving). A flow 0.9 \u00d7 h_p thick does not move (velocity ${thin.meanVelocity}).`,
      'Bingham fluid on a slope (Imran et al. 2001; Hampton et al. 1996 for sea-floor debris flows).',
      err < 1e-9 && thick.meanVelocity > 0 && thin.meanVelocity === 0)
  }
  // (d) mass through one failure event, per grain size
  {
    const { eng, NX, DX, P } = failingSection()
    const total = (a: Float64Array) => {
      let s = 0
      for (let i = 0; i < eng.rec.nLayers * NX; i++) s += a[i]
      return s * DX
    }
    const sand0 = total(eng.rec.sand)
    const mud0 = total(eng.rec.mud)
    const events = failureStep(eng, P, 3, 4000, 0.996)
    const mb = mtdBalance(events)
    const errSand = events.length ? Math.abs(total(eng.rec.sand) + mb.sand.exported - sand0) / sand0 : 1
    const errMud = events.length ? Math.abs(total(eng.rec.mud) + mb.mud.exported - mud0) / mud0 : 1
    const mass = 'Project rule (docs/agent-guide.md, principle 1): mass is conserved per grain size, not only in total.'
    add('balance-failure-sand', 'Mass balance through a slope failure, sand', errSand, 1e-12, 'relative',
      `${events.length} event(s) on a 0.15 slope at r_u 0.8: sand before = sand after + sand that ran off the end (${sand0.toFixed(0)} m\u00b2 in the section).`, mass)
    add('balance-failure-mud', 'Mass balance through a slope failure, mud', errMud, 1e-12, 'relative',
      `Same event(s): mud before = mud after + mud that ran off the end (${mud0.toFixed(0)} m\u00b2 in the section).`, mass)
  }
  return out
}
