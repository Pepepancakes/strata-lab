// Scenario helpers for the app: the time-step schedule of a run length, and a readable line for it.
// Pure functions, no DOM, so they are unit-tested (tests/scenario.test.ts).
//
// A preset (engine/presets.ts) fixes the steps for its full length, e.g. 5 kyr steps for the last
// 3 Myr and 50 kyr before that. A shorter run keeps the YOUNGEST part of that schedule: the
// segments are cut from the old end, each cut at a whole number of steps (schedule.ts needs that).

import type { Segment } from '../engine/schedule'

/** Shortest run the app offers, Myr. */
export const MIN_RUN_MA = 0.5

/** Cut a schedule (older to younger) down to the youngest `lengthMa`, on whole steps. */
export function clipSegments(segments: readonly Segment[], lengthMa: number): Segment[] {
  const out: Segment[] = []
  let remaining = lengthMa
  for (let i = segments.length - 1; i >= 0 && remaining > 1e-9; i--) {
    const s = segments[i]
    const len = s.fromAgeMa - s.toAgeMa
    if (len <= remaining + 1e-9) {
      out.unshift({ ...s })
      remaining -= len
      continue
    }
    const steps = Math.floor((remaining * 1e6) / s.dt + 1e-9)
    if (steps < 1) break
    // the cut lies on a step boundary: age = young end + whole steps
    out.unshift({ fromAgeMa: s.toAgeMa + (steps * s.dt) / 1e6, toAgeMa: s.toAgeMa, dt: s.dt })
    break
  }
  if (out.length === 0) throw new Error('The run is shorter than one time step.')
  // joins must be exact: the old end of each younger segment equals the young end of the next older one
  for (let i = out.length - 2; i >= 0; i--) out[i] = { ...out[i], toAgeMa: out[i + 1].fromAgeMa }
  return out
}

/** Length of a schedule in Myr. */
export function lengthOf(segments: readonly Segment[]): number {
  return segments[0].fromAgeMa - segments[segments.length - 1].toAgeMa
}

/** Total number of steps. */
export function stepCount(segments: readonly Segment[]): number {
  return segments.reduce((n, s) => n + Math.round(((s.fromAgeMa - s.toAgeMa) * 1e6) / s.dt), 0)
}

function fmtYears(dt: number): string {
  if (dt >= 1e6) return `${+(dt / 1e6).toPrecision(3)} Myr`
  if (dt >= 1000) return `${+(dt / 1000).toPrecision(3)} kyr`
  return `${dt} yr`
}

const fmtMa = (a: number): string => `${+a.toPrecision(4)} Ma`

/** "5 kyr steps back to 3 Ma, then 50 kyr steps back to 23 Ma": read from the present backwards. */
export function describeSchedule(segments: readonly Segment[]): string {
  const parts: string[] = []
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]
    const text = `${fmtYears(s.dt)} steps back to ${fmtMa(s.fromAgeMa)}`
    parts.push(i === segments.length - 1 ? text : `then ${text}`)
  }
  return parts.join(', ')
}
