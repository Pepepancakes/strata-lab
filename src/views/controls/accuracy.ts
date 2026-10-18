// "Deep compaction: fast (bundled) / full accuracy" (AUD-5, D26.1). Pure helpers behind the switch at the top of
// the Numerical settings group. Full accuracy is bundleEvery = 1; fast is the preset's own bundleEvery.
// No new engine parameter: the switch edits the existing start-only parameter, so saved scenario files
// (which store the overrides) keep working and old files open unchanged.
import type { PresetId } from '../../engine/presets'
import type { ParamValue } from '../../engine/params'

/** Run times of the long presets, measured in the built file in Chrome (scripts/review/aud-05-browser.mjs). */
export interface RunTime {
  /** Seconds with the preset's bundled deep compaction. */
  fastS: number
  /** Seconds with bundleEvery = 1. */
  fullS: number
}

export const RUN_TIMES: Partial<Record<PresetId, RunTime>> = {
  miocene: { fastS: 2.6, fullS: 16.7 },
  cenozoic: { fastS: 2.8, fullS: 34.0 },
  gulf: { fastS: 3.6, fullS: 36.9 },
}

export const RUN_TIMES_PROVENANCE =
  'Measured by scripts/review/aud-05-browser.mjs in the built file in headless Chrome 155 on a Windows desktop (AUD-5). ' +
  'A slower computer takes proportionally longer; the full solve costs 6 to 12 times the bundled one.'

export type AccuracyMode = 'fast' | 'full' | 'not-bundled'

/**
 * Which mode the run is in. 'not-bundled' = the preset itself solves every layer every step (bundleEvery 1), so
 * there is nothing to switch. Otherwise 'full' when the run's bundleEvery is 1, else 'fast'.
 */
export function accuracyMode(presetBundleEvery: ParamValue | undefined, runBundleEvery: ParamValue | undefined): AccuracyMode {
  if (!(Number(presetBundleEvery) > 1)) return 'not-bundled'
  return Number(runBundleEvery) > 1 ? 'fast' : 'full'
}

/** The overrides after the switch is moved: full sets bundleEvery = 1, fast removes the override (back to the preset's value). */
export function withAccuracy(overrides: Readonly<Record<string, ParamValue>>, full: boolean): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = { ...overrides }
  if (full) out.bundleEvery = 1
  else delete out.bundleEvery
  return out
}

/** The cost line shown next to the switch for the loaded preset. */
export function costText(presetId: PresetId): string {
  const t = RUN_TIMES[presetId]
  if (!t) return 'Run time was not measured for this preset.'
  return `Measured on this preset: about ${Math.round(t.fastS)} s fast, about ${Math.round(t.fullS)} s full accuracy (${(t.fullS / t.fastS).toFixed(0)} times longer).`
}
