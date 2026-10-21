// Helpers for the SFM-2 shelf-edge tests: run the default schedule recording shoreline, shelf edge, share and sea level per step.
import { defaultEngineParams, type EngineParams } from '../../src/engine/engineParams'
import type { LayerRecord } from '../../src/engine/record'
import { buildSchedule } from '../../src/engine/schedule'
import { createEngine, step } from '../../src/engine/step'
import { seaLevelOf } from './run'

export interface TraceStep { sea: number; shore: number; edge: number; share: number }

export function runTrace(overrides: Partial<EngineParams> = {}) {
  const P = { ...defaultEngineParams(), ...overrides }
  const schedule = buildSchedule()
  const eng = createEngine(P, schedule)
  const sl = seaLevelOf(P, schedule)
  const trace: TraceStep[] = []
  let k = 0
  while (step(eng, P, schedule, sl)) {
    trace.push({ sea: sl(schedule.tEndYr[k]), shore: eng.diag.shore, edge: eng.diag.shelfEdge, share: eng.diag.tcShare })
    k++
  }
  const sea = trace.map((s) => s.sea), sh = trace.map((s) => s.share)
  return { P, eng, trace, corr: correlation(sea, sh) }
}

export function correlation(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN
}

/** Solid sand and mud deposited during the run (layers nPre and above), per column. */
export function depositByColumn(rec: LayerRecord) {
  const { nx, nLayers, nPre, sand, mud } = rec
  const s = new Float64Array(nx), m = new Float64Array(nx)
  for (let l = nPre; l < nLayers; l++) for (let j = 0; j < nx; j++) { s[j] += sand[l * nx + j]; m[j] += mud[l * nx + j] }
  return { sand: s, mud: m }
}
