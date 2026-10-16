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

export type PresetId = 'last3' | 'miocene' | 'cenozoic' | 'mtd' | 'gulf' | 'saltshort'

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
  {
    id: 'mtd',
    label: 'Overpressured slope (MTD-prone)',
    runLengthMa: 3,
    segments: DEFAULT_SEGMENTS,
    params: {
      duration: 3e6, nx: 150, dx: 1000, supply: 30, subsShelf: 40, subsBasin: 150, bundleEvery: 1,
      kMudMult: 0.1, failOn: 1,
    },
    note: 'The default scenario with mud permeability x0.1 and supply x1.5 (30 m^2/yr), slope failure on, no slip surface shallower than 10 m. Both changes are tuned, not measured: the point is that slow pore-pressure dissipation plus fast loading overpressures the slope mud until it fails. No trigger is imposed; the events come from the factor of safety (stability.ts) and are tagged by triggers.ts.',
  },
  {
    id: 'gulf',
    label: 'Gulf-style: wedge over salt (66 Ma)',
    runLengthMa: 66,
    segments: [{ fromAgeMa: 66, toAgeMa: 23, dt: 100000 }, { fromAgeMa: 23, toAgeMa: 3, dt: 50000 }, RECENT],
    params: {
      duration: 66e6, nx: 400, dx: 1000, supply: 28, subsShelf: 90, subsBasin: 80, bundleEvery: 20, bundleAgeYr: 100000, tcMax: 0.1,
      saltOn: 1, saltThick: 4000, saltPinchStart: 10000, saltPinchEnd: 100000, saltLimitStart: 200000, saltLimitEnd: 240000, saltVisc: 1e18,
      coverThick: 300, coverUneven: 0.5, coverSeed: 2, coverVisc: 1e19, weldThick: 100,
    },
    note: 'All values are tuned (no published Gulf rate or section was used or checked); the targets are the D18 ones: weld runs of 2 km or more (salt thinner than 100 m), salt crests within 2 km of the seafloor, a wedge that keeps prograding. Salt: 4 km thick (tuned: no source for the thickness) with a 10 to 100 km pinch-out ramp, and a basinward limit at 200 to 240 km (M3.10, tuned; the idea that the Louann salt basin ends near the continent-ocean boundary is after Hudec et al. 2013, abstract only, to verify). The M3.9 version had no such limit and the salt piled 8 to 9 km thick against the closed basinward edge of the section; now the salt flows about 115 km past its limit by the end and stops 45 km short of the edge, at most 5 km thick. Viscosity 1e18 (D17.5), 300 m of older cover that is 50 % uneven (seed 2; seeds 1 to 4 were tried), cover as a plate at 1e19 (the default). Only 10 % of the supply is routed as turbidity currents (tcMax 0.1) so the deep basin is starved; supply 28 m^2/yr and subsidence 90/80 m/Myr keep the wedge prograding while loading the ramp enough to weld. Honest state: welds are met (total 12 to 20 km, longest run 3 to 4 km, across 1 ulp noise). The crests within 2 km of the seafloor (2 to 5, at 286 to 323 km) are 300 to 850 m ripples of the cover seed on a flat salt slab, not diapirs; diapirs that stay at the seafloor are for S3 and M3b (D18). See docs/physics-references.md (M3.8, M3.10).',
  },
  {
    id: 'saltshort',
    label: 'Salt: uneven cover (10 Myr)',
    runLengthMa: 10,
    segments: [{ fromAgeMa: 10, toAgeMa: 0, dt: 50000 }],
    params: {
      duration: 10e6, nx: 150, dx: 1000, supply: 50, subsShelf: 40, subsBasin: 150, bundleEvery: 1,
      saltOn: 1, saltThick: 1000, saltPinchStart: 10000, saltPinchEnd: 30000, saltVisc: 1e17,
      coverThick: 100, coverUneven: 0.5, coverVisc: 1e18,
    },
    note: 'A teaching run (under a second): thin salt at a viscosity of 1e17 under a thin, 50 % uneven cover, with a fast tuned supply of 50 m^2/yr, gives a dozen small diapirs and minibasins in 10 Myr. Cover bending is on at 1e18 (the cover is thin, so it is a weak plate). All values are tuned and synthetic. It is a toy, not a Gulf section: the structures are 1 to 25 km wide and several are only a few cells wide.',
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
