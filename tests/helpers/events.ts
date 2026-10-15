// Helper for tests on the MTD-prone preset: find an event whose deposit is still there at the end.
// A later failure or erosion can remove an early deposit, so "the first event's deposit cell holds
// sediment" is not guaranteed and differs between machines (D14). Any event that still has a
// non-empty deposit cell will do.
import type { FailureEvent } from '../../src/engine/state'
import type { StateView } from '../../src/worker/protocol'

/** The first event with a deposit, and the first column of it, whose cell still holds sediment in `v`. */
export function survivingDeposit(events: readonly FailureEvent[], v: StateView): { e: FailureEvent; col: number } | undefined {
  for (const e of events) {
    if (e.depositFrom < 0 || e.layer < 0 || e.layer >= v.nLayers) continue
    for (let col = e.depositFrom; col <= e.depositTo; col++) {
      const i = e.layer * v.nx + col
      if (v.sand![i] + v.mud![i] > 0 && v.thick![i] > 0) return { e, col }
    }
  }
  return undefined
}
