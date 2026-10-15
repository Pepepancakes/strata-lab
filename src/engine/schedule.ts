// Time-step schedule: the run length as a piecewise list of segments, each with its own step.
// Why: runs can be 66 Myr (D12); steps are fine recently and coarse far back.
//
// Segments go from OLDER to YOUNGER and must join exactly: segment[i].toAgeMa equals
// segment[i+1].fromAgeMa, the last toAgeMa is 0 (present) unless a test says otherwise, and each
// segment length must be a whole number of steps. Ages at segment joins are taken from the
// segment limits, not accumulated, so they are exact.
//
// Time inside the engine is ELAPSED years since the start of the run (tStartYr, tEndYr).
// Ages are Ma before present. Elapsed time is a running sum of integer-valued step lengths.

export interface Segment {
  fromAgeMa: number
  toAgeMa: number
  /** Step length, years. */
  dt: number
}

export interface Schedule {
  nSteps: number
  runLengthMa: number
  /** Age at the start of the run, Ma. */
  startAgeMa: number
  stepDt: Float64Array
  /** Age at the END of each step, Ma. */
  stepAgeMa: Float64Array
  /** Elapsed years since run start at the start / end of each step. */
  tStartYr: Float64Array
  tEndYr: Float64Array
}

const TOL_YR = 0.01

export const DEFAULT_SEGMENTS: readonly Segment[] = [{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }]

export function buildSchedule(segments: readonly Segment[] = DEFAULT_SEGMENTS): Schedule {
  if (segments.length === 0) throw new Error('schedule: no segments')
  const counts: number[] = []
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (!(s.fromAgeMa > s.toAgeMa)) throw new Error(`schedule: segment ${i} must run from older to younger`)
    if (!(s.dt > 0)) throw new Error(`schedule: segment ${i} has a non-positive step`)
    if (i > 0 && segments[i - 1].toAgeMa !== s.fromAgeMa) {
      throw new Error(`schedule: gap or overlap between segment ${i - 1} and ${i}`)
    }
    const exact = ((s.fromAgeMa - s.toAgeMa) * 1e6) / s.dt
    const n = Math.round(exact)
    if (n < 1 || Math.abs(n * s.dt - (s.fromAgeMa - s.toAgeMa) * 1e6) > TOL_YR) {
      throw new Error(`schedule: segment ${i} is not a whole number of steps`)
    }
    counts.push(n)
  }
  const nSteps = counts.reduce((a, b) => a + b, 0)
  const sched: Schedule = {
    nSteps,
    runLengthMa: segments[0].fromAgeMa - segments[segments.length - 1].toAgeMa,
    startAgeMa: segments[0].fromAgeMa,
    stepDt: new Float64Array(nSteps),
    stepAgeMa: new Float64Array(nSteps),
    tStartYr: new Float64Array(nSteps),
    tEndYr: new Float64Array(nSteps),
  }
  let k = 0
  let t = 0
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    for (let n = 1; n <= counts[i]; n++, k++) {
      sched.stepDt[k] = s.dt
      sched.tStartYr[k] = t
      t += s.dt
      sched.tEndYr[k] = t
      // exact at the join: last step of a segment lands on the segment limit
      sched.stepAgeMa[k] = n === counts[i] ? s.toAgeMa : s.fromAgeMa - (n * s.dt) / 1e6
    }
  }
  return sched
}
