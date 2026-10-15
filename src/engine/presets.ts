// Scenario presets (D12): run length, time-step schedule, section size, supply, subsidence and the
// deep-compaction bundling for each of the three standard runs. A preset only sets registry
// parameters (params.ts) and a schedule (schedule.ts); nothing here is physics.
//
// Last 3 Myr is the default and is exactly the M1.3/M1.4 run (bundling off, bit-identical).
// Supply and subsidence of the two long presets are 'tuned': no published Gulf of Mexico rate
// was checked or used (never company data). The default scenario's values are kept so the long
// runs are comparable with it; the section is widened to 400 km (nx 400, dx 1 km) so the shelf
// edge stays inside it (measured: see docs/physics-references.md, M1.4b).

import { defaultEngineParams, type EngineParams } from './engineParams'
import { buildSchedule, DEFAULT_SEGMENTS, type Schedule, type Segment } from './schedule'

export type PresetId = 'last3' | 'miocene' | 'cenozoic'

export interface Preset {
  id: PresetId
  label: string
  /** Run length, Myr. */
  runLengthMa: number
  /** Steps from older to younger (schedule.ts format). */
  segments: readonly Segment[]
  /** Registry overrides on top of the defaults. All SI. */
  params: Partial<EngineParams>
  /** Where each number comes from. */
  note: string
}

const RECENT: Segment = { fromAgeMa: 3, toAgeMa: 0, dt: 5000 }

export const PRESETS: readonly Preset[] = [
  {
    id: 'last3',
    label: 'Last 3 Myr (default)',
    runLengthMa: 3,
    segments: DEFAULT_SEGMENTS,
    params: { duration: 3e6, nx: 150, dx: 1000, supply: 20, subsShelf: 40, subsBasin: 150, bundleEvery: 1 },
    note: 'Spike 001 default scenario, 5 kyr steps. Bundling off, so the run is bit-identical to M1.4.',
  },
  {
    id: 'miocene',
    label: 'Miocene to present (23 Myr)',
    runLengthMa: 23,
    segments: [{ fromAgeMa: 23, toAgeMa: 3, dt: 50000 }, RECENT],
    params: { duration: 23e6, nx: 400, dx: 1000, supply: 20, subsShelf: 40, subsBasin: 150, bundleEvery: 10, bundleAgeYr: 100000 },
    note: '50 kyr steps back to 3 Ma, then 5 kyr. Supply and subsidence tuned (default scenario values); section widened to 400 km.',
  },
  {
    id: 'cenozoic',
    label: 'Full Cenozoic (66 Myr)',
    runLengthMa: 66,
    segments: [{ fromAgeMa: 66, toAgeMa: 23, dt: 100000 }, { fromAgeMa: 23, toAgeMa: 3, dt: 50000 }, RECENT],
    params: { duration: 66e6, nx: 400, dx: 1000, supply: 20, subsShelf: 40, subsBasin: 150, bundleEvery: 20, bundleAgeYr: 100000 },
    note: '100 kyr steps back to 23 Ma, then as the Miocene run. Supply and subsidence tuned; section 400 km.',
  },
]

export function getPreset(id: PresetId): Preset {
  const p = PRESETS.find((x) => x.id === id)
  if (!p) throw new Error(`unknown preset ${id}`)
  return p
}

/** Fresh engine parameters for a preset (registry defaults + the preset's overrides). */
export function presetParams(id: PresetId): EngineParams {
  return { ...defaultEngineParams(), ...getPreset(id).params }
}

export function presetSchedule(id: PresetId): Schedule {
  return buildSchedule(getPreset(id).segments)
}
