// UI-1: the Controls panel groups, the search and the changed-from-preset marker (pure parts).
import { describe, it, expect } from 'vitest'
import { PARAMS } from '../src/engine/params'
import { presetParams } from '../src/engine/presets'
import { changedKeys, DEFAULT_OPEN, filterGroups, GROUPS, modeNote, SCENARIO_KEYS } from '../src/views/controls/groups'

const labelOf = (k: string) => PARAMS.find((p) => p.key === k)!.label
const groupKeys = (g: (typeof GROUPS)[number]) => [...(g.switchKey ? [g.switchKey] : []), ...g.sections.flatMap((s) => s.keys)]

describe('control groups', () => {
  it('holds every editable parameter exactly once (a new parameter needs a group)', () => {
    const all = GROUPS.flatMap(groupKeys)
    const editable = PARAMS.map((p) => p.key).filter((k) => !SCENARIO_KEYS.includes(k))
    expect([...all].sort()).toEqual([...editable].sort())
    expect(new Set(all).size).toBe(all.length)
  })

  it('names only parameters that exist, and keeps duration and dtRec out', () => {
    const keys = new Set(PARAMS.map((p) => p.key))
    for (const k of GROUPS.flatMap(groupKeys)) expect(keys.has(k), k).toBe(true)
    for (const k of SCENARIO_KEYS) expect(GROUPS.flatMap(groupKeys)).not.toContain(k)
  })

  it('has the four 0/1 switches, on the groups that own them, in the agreed order', () => {
    expect(GROUPS.filter((g) => g.switchKey).map((g) => g.switchKey)).toEqual(['saltOn', 'failOn', 'thermal', 'cement'])
    expect(GROUPS.map((g) => g.title)).toEqual([
      'Sediment supply', 'Sea level', 'Subsidence', 'Salt', 'Slope failure (MTDs)', 'Transport and turbidity currents',
      'Compaction and pore pressure', 'Temperature', 'Quartz cement', 'Grid and numerical settings',
    ])
    expect(DEFAULT_OPEN.every((id) => GROUPS.some((g) => g.id === id))).toBe(true)
  })

  it('carries the not-geology note on the grid group only', () => {
    expect(GROUPS.filter((g) => g.note).map((g) => g.title)).toEqual(['Grid and numerical settings'])
  })
})

describe('filterGroups', () => {
  const titles = (q: string) => filterGroups(GROUPS, q, labelOf).map((s) => s.group.title)

  it('an empty query keeps every group whole', () => {
    const r = filterGroups(GROUPS, '', labelOf)
    expect(r.length).toBe(10)
    for (const s of r) expect(s.shown).toBe(s.total)
  })

  it('"salt" shows the whole Salt group and the salt substeps under Grid and numerical settings', () => {
    const r = filterGroups(GROUPS, 'salt', labelOf)
    expect(r.map((s) => s.group.title)).toEqual(['Salt', 'Grid and numerical settings'])
    expect(r[0].shown).toBe(r[0].total)
    expect(r[1].sections.flatMap((s) => s.keys)).toEqual(['nSaltSub'])
  })

  it('is case-insensitive', () => {
    expect(titles('SALT')).toEqual(titles('salt'))
    expect(titles('  Salt ')).toEqual(titles('salt'))
  })

  it('"viscosity" finds salt, cover and debris-flow viscosity', () => {
    const keys = filterGroups(GROUPS, 'viscosity', labelOf).flatMap((s) => s.sections.flatMap((x) => x.keys))
    expect(keys).toEqual(expect.arrayContaining(['saltVisc', 'coverVisc', 'runViscosity']))
  })

  it('a section heading matches its whole section', () => {
    const r = filterGroups(GROUPS, 'triggers', labelOf)
    expect(r.map((s) => s.group.title)).toEqual(['Slope failure (MTDs)'])
    expect(r[0].sections.map((s) => s.heading)).toEqual(['Triggers'])
    expect(r[0].sections[0].keys.length).toBe(7)
  })

  it('finds a control that the current mode hides (the search is how it is never lost)', () => {
    expect(filterGroups(GROUPS, 'amplitude', labelOf).flatMap((s) => s.sections.flatMap((x) => x.keys))).toEqual(['slAmp'])
  })

  it('"zzz" leaves nothing', () => {
    expect(filterGroups(GROUPS, 'zzz', labelOf)).toEqual([])
  })
})

describe('changedKeys', () => {
  const preset = presetParams('last3') as unknown as Record<string, number | string | number[]>
  const copy = () => JSON.parse(JSON.stringify(preset)) as typeof preset

  it('finds nothing on the preset itself', () => {
    expect(changedKeys(copy(), preset)).toEqual([])
  })

  it('finds a scalar, one element of a pair, and a string', () => {
    const p = copy()
    p.sandFrac = 0.4
    ;(p.Kc as number[])[1] = 123456
    p.seaLevelKind = 'sine'
    expect(changedKeys(p, preset).sort()).toEqual(['Kc', 'sandFrac', 'seaLevelKind'])
  })

  it('counts a switch', () => {
    const p = copy()
    p.saltOn = 1
    expect(changedKeys(p, preset)).toEqual(['saltOn'])
  })

  it('treats a 1e-15 relative difference as the same value', () => {
    const p = copy()
    p.sandFrac = (preset.sandFrac as number) * (1 + 1e-15)
    ;(p.Kc as number[])[0] = (preset.Kc as number[])[0] * (1 - 1e-15)
    expect(changedKeys(p, preset)).toEqual([])
  })

  it('leaves out the Scenario controls', () => {
    const p = copy()
    p.duration = 1
    p.dtRec = 1
    expect(changedKeys(p, preset)).toEqual([])
  })
})

describe('modeNote', () => {
  it('hides the sine controls with the published curve, and only then', () => {
    expect(modeNote('slAmp', { seaLevelKind: 'curve' })).toMatch(/Sine \(teaching\)/)
    expect(modeNote('slPeriod', { seaLevelKind: 'curve' })).not.toBeNull()
    expect(modeNote('slAmp', { seaLevelKind: 'sine' })).toBeNull()
    expect(modeNote('slShift', { seaLevelKind: 'curve' })).toBeNull()
  })
  it('hides the thermal and history subsidence controls outside their mode', () => {
    expect(modeNote('subsTau', { subsMode: 'constant' })).not.toBeNull()
    expect(modeNote('subsTau', { subsMode: 'thermal' })).toBeNull()
    expect(modeNote('subsHistory', { subsMode: 'thermal' })).not.toBeNull()
    expect(modeNote('subsHistory', { subsMode: 'history' })).toBeNull()
  })
})
