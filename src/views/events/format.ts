// How a slope-failure event is shown to John: ft for depth, km for distance, Ma for time.
// All conversion goes through src/units.ts. Used by the event list and the pseudo-well hover.

import type { FailureEvent } from '../../engine/state'
import { m2ToKm2, mToFt, mToKm } from '../../units'

export interface EventRow {
  id: number
  timeMa: string
  cause: string
  /** Source position, km from the landward edge: first and last source column. */
  sourceKm: string
  scarFt: string
  /** The removed bulk area (this is a 2D section: m^2 per unit width), km^2. */
  volumeKm2: string
  runoutKm: string
}

/** Position (km) of the middle of column j. */
export const columnKm = (j: number, dxM: number): number => mToKm((j + 0.5) * dxM)

export function eventRow(e: FailureEvent, dxM: number): EventRow {
  const a = columnKm(e.sourceFrom, dxM)
  const b = columnKm(e.sourceTo, dxM)
  return {
    id: e.id,
    timeMa: e.ageMa.toFixed(3),
    cause: e.cause,
    sourceKm: e.sourceTo > e.sourceFrom ? `${a.toFixed(0)}\u2013${b.toFixed(0)}` : a.toFixed(0),
    scarFt: Math.round(mToFt(e.scarDepth)).toLocaleString('en-US'),
    volumeKm2: m2ToKm2(e.volume).toFixed(3),
    runoutKm: mToKm(e.runout).toFixed(1),
  }
}

/** The events whose deposit holds column j in layer l (two failures in one step share a layer). */
export function eventsAtCell(events: readonly FailureEvent[], layer: number, column: number): FailureEvent[] {
  return events.filter((e) => e.layer === layer && e.depositFrom >= 0 && column >= e.depositFrom && column <= e.depositTo)
}

/** One line for a tooltip. */
export function eventSentence(e: FailureEvent, dxM: number): string {
  const r = eventRow(e, dxM)
  return `MTD #${r.id}: ${r.timeMa} Ma, ${r.cause}, source ${r.sourceKm} km, scar ${r.scarFt} ft deep, ${r.volumeKm2} km\u00b2, run-out ${r.runoutKm} km`
}
