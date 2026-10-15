// The physics benchmark suite the app can run on demand ("Run checks" in the checks panel).
// Each check compares the engine with an exact solution or an independent hand calculation and
// returns the measured number, its limit, and a plain sentence. These are the same benchmarks as
// tests/compaction.test.ts, tests/run.test.ts and tests/timemachine.test.ts, in a form the worker
// can run and report (the tests stay as they are; keep the two in step).
//
// Gibson (1958): a layer that grows at a constant rate on an impermeable base; exact excess pore
// pressure U(X, T) = 1 - 2/sqrt(pi T) Integral_0^inf e tanh(sqrt(T) e) [exp(-(e-a)^2) + exp(-(e+a)^2)] de,
// a = X sqrt(T)/2, X = z/h, T = m^2 t / cv. Written from the published solution (trapezoid rule).
// Drained compaction: slow deposition into a very permeable column stays hydrostatic, so porosity
// follows the Athy depth curve; compared with Sclater & Christie (1980) at 2 km.

import { rebuildCaches, compactColumn, porosity } from '../engine/compaction'
import { DRHO_G, MU, YR } from '../engine/constants'
import { stateHash } from '../engine/determinism'
import { defaultEngineParams } from '../engine/engineParams'
import { createRecord } from '../engine/record'
import { getReference } from '../engine/references'
import { buildSchedule } from '../engine/schedule'
import { makeSeaLevel } from '../engine/sealevel'
import { allocateEngine } from '../engine/state'
import { createEngine, step } from '../engine/step'
import type { CheckResult } from './protocol'
import { TimeMachine } from './timeMachine'

function gibsonAnalytic(X: number, T: number): number {
  const a = (X * Math.sqrt(T)) / 2
  const sT = Math.sqrt(T)
  const top = a + 12
  const N = 4000
  const h = top / N
  const f = (e: number) => e * Math.tanh(sT * e) * (Math.exp(-((e - a) ** 2)) + Math.exp(-((e + a) ** 2)))
  let sum = 0.5 * (f(0) + f(top))
  for (let i = 1; i < N; i++) sum += f(i * h)
  return 1 - (2 / Math.sqrt(Math.PI * T)) * sum * h
}

function gibsonMaxError(T: number, nSteps = 400): number {
  const m = 1e-3 // m/yr deposition rate (bulk)
  const tEnd = 1e6
  const dt = tEnd / nSteps
  const e0 = 1
  const mv = 1e-8
  const cv = (m * m * tEnd) / T
  const k = (cv * MU * mv) / YR
  const P = defaultEngineParams()
  P.nx = 1
  P.linear = { e0, C: mv * (1 + e0), k }
  const rec = createRecord({ nx: 1, dx: 1, capacity: nSteps + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  rebuildCaches(eng, P, rec.capacity)
  const solidPerStep = (m * dt) / (1 + e0)
  for (let s = 0; s < nSteps; s++) {
    rec.mud[s] = solidPerStep
    compactColumn(eng, P, 0, s, dt)
  }
  const h = m * tEnd
  const gp = DRHO_G / (1 + e0)
  let maxErr = 0
  for (let s = 0; s < nSteps; s++) maxErr = Math.max(maxErr, Math.abs(rec.u[s] / (gp * h) - gibsonAnalytic((s + 0.5) / nSteps, T)))
  return maxErr
}

function drained(lith: 0 | 1): { dPhi: number; maxLam: number } {
  const P = defaultEngineParams()
  P.kMudMult = 1e6
  P.kA = [-10, -10]
  P.kB = [0, 0]
  const nSteps = 600
  const dt = 5000
  const rate = (3000 / (nSteps * dt)) * 1.7
  const rec = createRecord({ nx: 1, dx: 1, capacity: nSteps + 1, startAgeMa: 0 })
  const eng = allocateEngine(rec)
  rebuildCaches(eng, P, rec.capacity)
  for (let s = 0; s < nSteps; s++) {
    const solid = rate * dt * (1 - P.phi0[lith])
    if (lith === 0) rec.sand[s] = solid
    else rec.mud[s] = solid
    compactColumn(eng, P, 0, s, dt)
  }
  let z = 0
  let maxLam = 0
  let best = { z: Infinity, phi: 0 }
  for (let s = nSteps - 1; s >= 0; s--) {
    const phi = porosity(P, lith, rec.smax[s])
    const h = (rec.sand[s] + rec.mud[s]) / (1 - phi)
    if (Math.abs(z + h / 2 - 2000) < Math.abs(best.z - 2000)) best = { z: z + h / 2, phi }
    maxLam = Math.max(maxLam, rec.u[s] / eng.ld[s])
    z += h
  }
  const target = lith === 0 ? 0.286 : 0.227 // Sclater & Christie (1980) at 2 km
  return { dPhi: Math.abs(best.phi - target), maxLam }
}

const SMALL_RUN = {
  presetId: 'last3' as const,
  segments: [{ fromAgeMa: 1, toAgeMa: 0, dt: 10000 }],
  overrides: { nx: 60, dx: 2500 },
}

/** Where each benchmark comes from: a published solution, or the project rule it enforces. */
function citeFor(id: string): string {
  if (id.startsWith('gibson')) return getReference('gibson-1958')?.full ?? 'Gibson (1958)'
  if (id.startsWith('drained')) return getReference('sclater-christie-1980')?.full ?? 'Sclater & Christie (1980)'
  if (id.startsWith('balance')) return 'Project rule (docs/agent-guide.md, principle 1): mass is conserved per grain size, not only in total.'
  if (id === 'rewind') return 'Project rule (docs/agent-guide.md, principle 2): same inputs give bit-identical results.'
  return 'Project benchmark.'
}

export function runChecks(): CheckResult[] {
  const out: CheckResult[] = []
  const add = (id: string, label: string, value: number, limit: number, unit: string, detail: string, pass = value < limit) =>
    out.push({ id, label, pass, value, limit, unit, detail, cite: citeFor(id) })

  for (const T of [0.1, 1, 10]) {
    add(`gibson-${T}`, `Consolidation vs Gibson (1958), T = ${T}`, gibsonMaxError(T), 0.001, 'of overburden',
      'Largest difference in excess pore pressure between the engine and the exact solution for a layer growing at a constant rate.')
  }
  for (const [name, lith, target] of [['sand', 0, 0.286], ['mud', 1, 0.227]] as const) {
    const r = drained(lith)
    add(`drained-${name}`, `Drained ${name} porosity at 2 km vs Sclater & Christie (1980)`, r.dPhi, 0.02, 'porosity',
      `Engine porosity at 2 km burial against ${target} from the published curve, with the column kept hydrostatic (largest overpressure ratio ${r.maxLam.toExponential(1)}).`,
      r.dPhi < 0.02 && r.maxLam < 0.01)
  }

  // mass balance and rewind on a small coupled run
  const tm = new TimeMachine()
  const info = tm.run(SMALL_RUN, 1)
  const v = tm.seek(tm.root, info.nSteps, ['thick'])
  add('balance-sand', 'Mass balance, sand only', Math.abs(v.balance.sand.relError), 1e-9, 'relative',
    'Sand stored in the record against sand supplied minus sand removed, over a 1 Myr coupled run.')
  add('balance-mud', 'Mass balance, mud only', Math.abs(v.balance.mud.relError), 1e-9, 'relative',
    'Mud stored in the record against mud supplied minus mud removed, over a 1 Myr coupled run.')

  const P = { ...defaultEngineParams(), ...SMALL_RUN.overrides }
  const schedule = buildSchedule(SMALL_RUN.segments)
  const eng = createEngine(P, schedule)
  const sea = makeSeaLevel(P, schedule.startAgeMa * 1e6)
  const at = 63
  while (eng.diag.stepIndex < at) step(eng, P, schedule, sea)
  const straight = stateHash(eng.rec)
  tm.forgetPosition()
  const same = tm.hashAt(tm.root, at) === straight
  add('rewind', 'Rewind is bit-identical', same ? 0 : 1, 1, 'differences',
    `Record restored from a saved state and replayed to step ${at} against the same step of an uninterrupted run (0 = identical).`)
  return out
}
