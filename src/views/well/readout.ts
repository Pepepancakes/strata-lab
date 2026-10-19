// Pseudo-well depth readout (fix 03, check 7). Pure functions (tested in tests/wellReadout.test.ts).
//
// Why: the plot spans the whole column (often 0 to 38,000 ft TVDSS on 5,000 ft ticks), so the shallow section
// the docs quote (500 to 2,000 ft below the sea floor) is a sliver about 20 px tall at the top and its values
// cannot be read off the line. Pointing at the plot names the cell there and gives its numbers.
//
// The numbers are the plotted ones (wellProfile): ppg EMW from the rig floor, the air gap above the sea
// surface (or above the ground on land). Near the top that reads lower than an EMW from the sea surface (at
// 500 ft below a 250 ft sea floor about 0.9 ppg lower, at 2,000 ft about 0.4 ppg), and hydrostatic water reads
// under 8.55 ppg, so the readout says which datum it uses and gives the excess over hydrostatic directly.

import type { WellPoint, WellProfile } from './profile'

export interface WellReadout {
  point: WellPoint
  /** TVDSS asked for, ft. */
  tvdssFt: number
  /** Depth of the cell middle below the top of the sediment column (the sea floor, or the ground on land), ft. */
  belowTopFt: number
  /** The top of the column is above the sea surface. */
  onLand: boolean
}

/** The cell of the profile whose interval holds `tvdssFt`; null in the water, in the air or below the base. */
export function readoutAt(prof: WellProfile, tvdssFt: number): WellReadout | null {
  if (!Number.isFinite(tvdssFt) || tvdssFt < prof.topFt || tvdssFt > prof.bottomFt) return null
  let best: WellPoint | null = null
  let bestD = Infinity
  for (const p of prof.points) {
    const top = p.tvdssFt - p.thickFt / 2
    const bot = p.tvdssFt + p.thickFt / 2
    // inside the cell wins; otherwise the nearest middle (cells of zero thickness have no interval)
    const d = tvdssFt >= top && tvdssFt <= bot ? -1 / (1 + p.thickFt) : Math.abs(tvdssFt - p.tvdssFt)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  if (!best) return null
  return { point: best, tvdssFt, belowTopFt: best.tvdssFt - prof.topFt, onLand: prof.topFt < 0 }
}

const ft = (v: number): string => Math.round(v).toLocaleString('en-US')
const ppg = (v: number): string => `${v.toFixed(2)} ppg`

/** One plain sentence for the readout line under the plot. */
export function readoutText(r: WellReadout, airGapFt: number): string {
  const p = r.point
  const where = `${ft(p.tvdssFt)} ft TVDSS (${ft(r.belowTopFt)} ft below the ${r.onLand ? 'ground' : 'sea floor'})`
  const tags = [p.mtd ? 'MTD' : '', p.capped ? 'capped at the overburden' : ''].filter(Boolean)
  const tagText = tags.length ? ` [${tags.join(', ')}]` : ''
  const datum = `EMW from the rig floor, ${ft(airGapFt)} ft above the ${r.onLand ? 'ground' : 'sea surface'}.`
  if (p.salt) {
    return `${where}: salt: no pore pressure; overburden ${p.overburdenEmw === null ? 'not shown this shallow' : ppg(p.overburdenEmw)}. ${datum}`
  }
  if (p.poreEmw === null || p.hydroEmw === null || p.overburdenEmw === null) {
    return `${where}: too close to the surface for a ppg value. ${datum}`
  }
  const excess = p.poreEmw - p.hydroEmw
  return `${where}${tagText}: pore ${ppg(p.poreEmw)}, hydrostatic ${ppg(p.hydroEmw)}, overburden ${ppg(p.overburdenEmw)}; pore pressure is ${ppg(excess)} over hydrostatic. ${datum}`
}

/**
 * Pointer position to depth: inverse of the plot's y scale. `clientY` and the drawn box (`rectTop`, `rectHeight`) are
 * in screen px; `viewH`, `top` and `bot` are the viewBox height and the plot margins in viewBox units. Clamped to the plot.
 */
export function svgYToFt(clientY: number, rectTop: number, rectHeight: number, viewH: number, top: number, bot: number, topFt: number, botFt: number): number {
  const yv = ((clientY - rectTop) / rectHeight) * viewH
  const t = Math.max(0, Math.min(1, (yv - top) / (viewH - top - bot)))
  return topFt + t * (botFt - topFt)
}
