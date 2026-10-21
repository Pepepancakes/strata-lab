// The Controls panel's groups (UI-1, D20): which parameter sits where, the search, and the
// changed-from-preset marker. Pure, no React, so each piece is tested on its own.
// Every editable parameter is in exactly one group (tests/groups.test.ts fails when a new
// parameter is added to the registry without one). duration and dtRec stay with the Scenario controls.
import type { ParamValue } from '../../engine/params'

export interface Section {
  heading?: string
  keys: string[]
}

export interface Group {
  id: string
  title: string
  /** The 0/1 parameter that switches the whole group on or off, if there is one. */
  switchKey?: string
  /** A line under the group's header. */
  note?: string
  sections: Section[]
}

/** Set by the Scenario controls (preset, run length and its schedule), not by a control in a group. */
export const SCENARIO_KEYS: readonly string[] = ['duration', 'dtRec']

/** Groups that start open (they hold the eight controls that used to sit on top). */
export const DEFAULT_OPEN: readonly string[] = ['supply', 'sealevel', 'subsidence']

export const GROUPS: readonly Group[] = [
  { id: 'supply', title: 'Sediment supply', sections: [{ keys: ['supply', 'sandFrac'] }] },
  { id: 'sealevel', title: 'Sea level', sections: [{ keys: ['seaLevelKind', 'slAmp', 'slPeriod', 'slShift'] }] },
  { id: 'subsidence', title: 'Subsidence', sections: [{ keys: ['subsShelf', 'subsBasin', 'subsMode', 'subsTau', 'subsHistory'] }] },
  {
    id: 'salt', title: 'Salt', switchKey: 'saltOn',
    sections: [
      { heading: 'Starting salt', keys: ['saltThick', 'saltPinchStart', 'saltPinchEnd', 'saltLimitStart', 'saltLimitEnd'] },
      { heading: 'Flow and cover', keys: ['saltVisc', 'coverThick', 'coverUneven', 'coverSeed', 'coverBend', 'coverVisc'] },
      { heading: 'Welds and heat', keys: ['weldThick', 'saltK0', 'saltKa', 'saltKb'] },
    ],
  },
  {
    id: 'failure', title: 'Slope failure (MTDs)', switchKey: 'failOn',
    sections: [
      { heading: 'Stability', keys: ['phiFric', 'cohesion', 'stabMaxDepth'] },
      { heading: 'Failure and run-out', keys: ['failMaxCells', 'runYield', 'runViscosity', 'runDensity', 'mtdPhiMud'] },
      { heading: 'Triggers', keys: ['failMinDepth', 'failSlopeMin', 'failLowstandDrop', 'failRapidRate', 'failSlopeTerm', 'failPressTerm', 'failStallRunout'] },
    ],
  },
  {
    id: 'transport', title: 'Transport and turbidity currents',
    sections: [
      { heading: 'Diffusion', keys: ['Kc', 'Km', 'dm', 'Kg'] },
      { heading: 'Turbidity currents', keys: ['tcMax', 'tcLambda', 'sBreak', 'shelfBreakDepth', 'tcL0', 'tcSref', 'tcN'] },
    ],
  },
  { id: 'compaction', title: 'Compaction and pore pressure', sections: [{ keys: ['phi0', 'beta', 'kA', 'kB', 'kMudMult', 'elastic'] }] },
  { id: 'temperature', title: 'Temperature', switchKey: 'thermal', sections: [{ keys: ['heatFlow', 'kGrain', 'kWater', 'tSeaDeep', 'tSeaShallow', 'tSeaScale'] }] },
  { id: 'cement', title: 'Quartz cement', switchKey: 'cement', sections: [{ keys: ['cemA', 'cemB', 'cemTonset', 'cemGrain', 'cemSurf'] }] },
  {
    id: 'numerics', title: 'Grid and numerical settings',
    note: 'Not geology: these trade speed for accuracy. Change them only to check that a result does not depend on them. The fast / full accuracy switch for deep compaction is under Scenario, at the top.',
    sections: [{ keys: ['nx', 'dx', 'nSub', 'nSaltSub', 'bundleEvery', 'bundleAgeYr', 'thermalEvery', 'failMaxIters', 'linear'] }],
  },
]

/** Parameters shown as a check box instead of a number box (0 / 1). Group switches, plus coverBend. */
export const CHECKBOX_KEYS: readonly string[] = ['saltOn', 'failOn', 'thermal', 'cement', 'coverBend']

/** What is left of a group after a search. */
export interface ShownGroup {
  group: Group
  /** Only the sections (and keys) that match; every one when the group title matches or there is no query. */
  sections: Section[]
  /** Number of controls in `sections`. */
  shown: number
  /** Number of controls in the group (not counting its switch). */
  total: number
}

const norm = (s: string): string => s.trim().toLowerCase()

export function groupSize(g: Group): number {
  return g.sections.reduce((n, s) => n + s.keys.length, 0)
}

/**
 * The groups that a search leaves. A parameter matches on its label, its section heading or its
 * group title (case-insensitive). A matching group title keeps the whole group. An empty query
 * keeps everything. Groups with no match are left out.
 */
export function filterGroups(groups: readonly Group[], query: string, labelOf: (key: string) => string): ShownGroup[] {
  const q = norm(query)
  const out: ShownGroup[] = []
  for (const group of groups) {
    const total = groupSize(group)
    if (q === '' || norm(group.title).includes(q)) {
      out.push({ group, sections: group.sections, shown: total, total })
      continue
    }
    const sections: Section[] = []
    for (const sec of group.sections) {
      const headingHit = sec.heading !== undefined && norm(sec.heading).includes(q)
      const keys = headingHit ? sec.keys : sec.keys.filter((k) => norm(labelOf(k)).includes(q))
      if (keys.length) sections.push({ heading: sec.heading, keys })
    }
    if (sections.length) out.push({ group, sections, shown: sections.reduce((n, s) => n + s.keys.length, 0), total })
  }
  return out
}

/** Same rule as the number box: relative difference of 1e-12 or less is the same value. */
const REL_TOL = 1e-12

export function sameValue(a: ParamValue, b: ParamValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => sameValue(v, b[i]))
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= REL_TOL * Math.max(1, Math.abs(a), Math.abs(b))
  return a === b
}

/** Keys (every group key, switches included) whose value differs from the preset's. */
export function changedKeys(params: Readonly<Record<string, ParamValue>>, presetParams: Readonly<Record<string, ParamValue>>): string[] {
  const out: string[] = []
  for (const g of GROUPS) {
    const keys = [...(g.switchKey ? [g.switchKey] : []), ...g.sections.flatMap((s) => s.keys)]
    for (const k of keys) {
      if (k in params && k in presetParams && !sameValue(params[k], presetParams[k])) out.push(k)
    }
  }
  return out
}

/** Controls that do nothing in the current mode (UI-1 section 5): the note that stands in for them. */
export function modeNote(key: string, params: Readonly<Record<string, ParamValue>>): string | null {
  if ((key === 'slAmp' || key === 'slPeriod') && params.seaLevelKind !== 'sine') return 'Amplitude and period appear when Sine (teaching) is picked.'
  if (key === 'subsTau' && params.subsMode !== 'thermal') return 'Decay time appears when the subsidence history is thermal.'
  if (key === 'subsHistory' && params.subsMode !== 'history') return 'Piecewise factors appear when the subsidence history is history.'
  return null
}
