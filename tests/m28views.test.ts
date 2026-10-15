// M2.8: UI fixes from the M2 review: cause terms in words, stalled and window-limited rows,
// unresolved count, no painting of empty cells, M2 rows in the physics checks panel.
import { beforeAll, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FailureEvent } from '../src/engine/state'
import { TimeMachine } from '../src/worker/timeMachine'
import { runChecks } from '../src/worker/checks'
import type { StateView } from '../src/worker/protocol'
import { causeTerms, eventFlags, unresolvedColumns, CAUSE_RULE_HELP, STALLED_HELP, WINDOW_LIMITED_HELP } from '../src/views/events/causes'
import { EventsList } from '../src/views/events'
import { mtdMask } from '../src/views/section/draw'

function ev(over: Partial<FailureEvent>): FailureEvent {
  return {
    id: 1, step: 10, tYr: 1e5, ageMa: 2.9, sourceFrom: 20, sourceTo: 22, scarDepth: 120, volume: 1e6, sand: 1, mud: 1, cement: 0,
    exportedSand: 0, exportedMud: 0, depositedSand: 1, depositedMud: 1, runout: 4000, flowTime: 1, layer: 5, depositFrom: 23, depositTo: 25,
    cause: 'mixed', dSlope: Math.log(1.2), dPress: Math.log(1.5), dSeaLevel: -7, loadRate: 1e-3, seedColumn: 21, stalled: false, windowLimited: false,
    ...over,
  } as FailureEvent
}

describe('cause terms in words', () => {
  it('gives hand-calculated numbers for all three terms and the score against each threshold', () => {
    const t = causeTerms(ev({}))
    expect(t.slope.text).toContain('\u00d71.20')
    expect(t.slope.score).toBeCloseTo(Math.log(1.2) / 0.1, 12)
    expect(t.pressure.text).toContain('67%') // exp(-ln 1.5) = 0.667
    expect(t.pressure.score).toBeCloseTo(Math.log(1.5) / 0.1, 12)
    expect(t.seaLevel.text).toBe('sea-level fall 7.0 m')
    expect(t.seaLevel.score).toBeCloseTo(7 / 20, 12)
  })
  it('says so when a term did not push towards failure', () => {
    const t = causeTerms(ev({ dSlope: -0.2, dPress: 0, dSeaLevel: 3 }))
    expect(t.slope.text).toBe('no steepening')
    expect(t.pressure.text).toBe('no pressure rise')
    expect(t.seaLevel.text).toBe('sea level rose 3.0 m')
    expect(t.slope.score + t.pressure.score + t.seaLevel.score).toBe(0)
  })
})

describe('flags and unresolved count', () => {
  it('stalled and window-limited notes use the agreed words', () => {
    const f = eventFlags(ev({ stalled: true, windowLimited: true }))
    expect(f.stalledNote).toBe('failed but debris stayed: column unresolved')
    expect(f.windowNote).toBe('scar depth equals the search window (300 m, tuned)')
    const none = eventFlags(ev({}))
    expect(none.stalledNote).toBeNull()
    expect(none.windowNote).toBeNull()
  })
  it('counts the columns of stalled events only', () => {
    expect(unresolvedColumns([ev({}), ev({ stalled: true, sourceFrom: 5, sourceTo: 7 }), ev({ stalled: true, sourceFrom: 9, sourceTo: 9 })])).toBe(4)
  })
  it('the list shows the header count, the three terms, both notes and a labelled (i) for each flag', () => {
    const html = renderToStaticMarkup(createElement(EventsList, { events: [ev({}), ev({ id: 2, stalled: true, windowLimited: true })], dx: 1000, step: 99, selected: null }))
    expect(html).toContain('2 events, 1 stalled; 3 unresolved columns')
    expect(html).toContain('steepening')
    expect(html).toContain('pressure rise')
    expect(html).toContain('sea-level fall 7.0 m')
    expect(html).toContain('failed but debris stayed: column unresolved')
    expect(html).toContain('scar depth equals the search window (300 m, tuned)')
    for (const label of ['How the cause label is chosen', 'What stalled means (event 2)', 'What window-limited means (event 2)', 'What unresolved columns are']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('min-height:44px')
  })
  it('the help texts say how the label is chosen', () => {
    expect(CAUSE_RULE_HELP).toMatch(/largest ratio/)
    expect(CAUSE_RULE_HELP).toMatch(/mixed/)
    expect(STALLED_HELP).toMatch(/unresolved/)
    expect(WINDOW_LIMITED_HELP).toMatch(/lower bounds/)
  })
})

describe('empty cells are never painted (finding 6), MTD-prone preset', () => {
  const tm = new TimeMachine()
  let events: FailureEvent[] = []
  let end: StateView
  beforeAll(() => {
    const info = tm.run({ presetId: 'mtd', segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 25000 }], overrides: {} }, 1)
    events = tm.eventsAt(tm.root, info.nSteps)
    end = tm.seek(tm.root, info.nSteps, ['thick', 'sand', 'mud'])
  }, 120000)
  it('no marked cell has zero sediment or zero thickness', () => {
    const m = mtdMask(end, events)
    let marked = 0
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue
      marked++
      expect(end.sand![i] + end.mud![i], `cell ${i}`).toBeGreaterThan(0)
      expect(end.thick![i], `cell ${i}`).toBeGreaterThan(0)
    }
    expect(marked).toBeGreaterThan(0)
  })
  it('a hand-made empty cell in an event deposit is dropped from the mask', () => {
    const e = events.find((x) => x.depositFrom >= 0)!
    const i = e.layer * end.nx + e.depositFrom
    const sand = end.sand!.slice()
    const mud = end.mud!.slice()
    sand[i] = 0
    mud[i] = 0
    const v = { ...end, sand, mud } as StateView
    expect(mtdMask(end, events)[i]).toBe(1)
    expect(mtdMask(v, events)[i]).toBe(0)
  })
})

describe('M2 rows in the physics checks panel', () => {
  it('are present, pass, and use hand-calculated numbers', () => {
    const t0 = performance.now()
    const rows = runChecks()
    const ms = performance.now() - t0
    const ids = rows.map((r) => r.id)
    for (const id of ['slope-fs', 'slope-ru-crit', 'bingham-plug', 'balance-failure-sand', 'balance-failure-mud']) expect(ids).toContain(id)
    for (const r of rows.filter((x) => /^(slope|bingham|balance-failure)/.test(x.id))) expect(r.pass, `${r.id}: ${r.value} < ${r.limit}; ${r.detail}`).toBe(true)
    expect(rows.find((r) => r.id === 'slope-ru-crit')!.detail).toContain('0.7746')
    expect(ms).toBeLessThan(30000) // whole suite incl. Gibson; the M2 rows alone are timed below
  }, 60000)
  it('the M2 rows alone run in well under 1 s', async () => {
    const { runChecksM2 } = await import('../src/worker/checksM2')
    const t0 = performance.now()
    const rows = runChecksM2()
    expect(performance.now() - t0).toBeLessThan(1000)
    expect(rows.length).toBe(5)
    expect(rows.every((r) => r.pass)).toBe(true)
  })
})
