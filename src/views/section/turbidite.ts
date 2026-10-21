// The turbidite-share read-out under the section (SFM-3): what share of the sediment that reaches the shelf edge the
// model sends down the slope at the shown step, and whether the rule is at its cap (tcMax). View only: nothing here
// feeds back into the engine.

/** Within this fraction of the cap the rule counts as "at its cap" (a round number, not a cited value). */
export const AT_CAP_FRACTION = 0.99

export interface TurbiditeReadout {
  /** 0 to 100, whole percent. */
  percent: number
  /** The cap in whole percent. */
  capPercent: number
  atCap: boolean
  /** True when no shelf edge was found at this step (share 0 because there is nothing to route past). */
  noEdge: boolean
  text: string
}

export function turbiditeReadout(share: number, cap: number, shelfEdge: number): TurbiditeReadout {
  const percent = Math.round(share * 100)
  const capPercent = Math.round(cap * 100)
  const noEdge = shelfEdge < 0
  const atCap = !noEdge && cap > 0 && share >= AT_CAP_FRACTION * cap
  const text = noEdge
    ? 'Sent down the slope: none, no shelf edge found at this step'
    : `Sent down the slope: ${percent} % of what reaches the shelf edge${atCap ? ` (at its ${capPercent} % cap)` : ` (cap ${capPercent} %)`}`
  return { percent, capPercent, atCap, noEdge, text }
}

export const TURBIDITE_INFO =
  'Sent down the slope: at the shelf edge the model splits the sediment that arrives there. One part keeps building the shelf and the slope slowly; the other part is sent down the slope in one go, as a turbidity current (a sediment-laden bottom flow), and drops out in order: sand first, near the foot of the slope, mud last, far out on the basin floor. The share is largest when the shoreline sits at the shelf edge (a low sea level) and falls off as the shelf floods. "At its cap" means it has reached the largest share the rule allows (the control Max share routed as turbidity currents, tuned): the rule cannot send more. The numbers are set by a tuned rule, not by flow physics.'
