// The time read-out under the Time slider: the shown step, its age and the sea level at that step (check 15 fix).
// The sea level is here so a highstand or lowstand step can be found from the slider itself, next to the
// "Sent down the slope" line, without reading it off the chart further down the page. View only.
import { mToFt } from '../../units'

/** "step k of n — a Ma (million years ago) — sea level +x ft". Age and sea level are left out when not known yet. */
export function timeReadout(step: number, nSteps: number, ageMa: number | null, seaLevelM: number | null): string {
  let text = `step ${step} of ${nSteps}`
  if (ageMa !== null) text += ` \u2014 ${ageMa.toFixed(3)} Ma (million years ago)`
  if (ageMa !== null && seaLevelM !== null && Number.isFinite(seaLevelM)) {
    const ft = Math.round(mToFt(seaLevelM))
    text += ` \u2014 sea level ${ft > 0 ? '+' : ''}${ft === 0 ? 0 : ft} ft`
  }
  return text
}
