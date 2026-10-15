// M2.4: MTD in every view. Data for the section (factor-of-safety field, MTD texture), the event list
// and the pseudo-well, checked on a real run of the MTD-prone preset.
import { beforeAll, describe, expect, it } from 'vitest'
import type { FailureEvent } from '../src/engine/state'
import { AppStore } from '../src/app/store'
import { TimeMachine } from '../src/worker/timeMachine'
import type { StateView, WellColumn } from '../src/worker/protocol'
import { eventRow, eventsAtCell } from '../src/views/events/format'
import { cellValue, FS_WARN, FS_WARN_T, fsToT, MODES, ramp } from '../src/views/section/colors'
import { mtdMask, mtdTexture, eventViewStep } from '../src/views/section/draw'
import { wellProfile } from '../src/views/well/profile'

describe('factor-of-safety colour scale', () => {
  it('is centred on 1.0 and red below 1.2', () => {
    expect(fsToT(1)).toBeCloseTo(0.5, 12)
    expect(fsToT(0.25)).toBe(0)
    expect(fsToT(4)).toBeCloseTo(1, 12)
    expect(fsToT(Infinity)).toBe(1)
    const red = (fs: number) => {
      const [r, g, b] = ramp('fs', fsToT(fs))
      return r > 90 && r > g + 40 && r > b + 40
    }
    for (const fs of [0.3, 0.7, 0.99, 1.0, 1.1, 1.19]) expect(red(fs), `FS ${fs}`).toBe(true)
    for (const fs of [1.3, 2, 4]) expect(red(fs), `FS ${fs}`).toBe(false)
    expect(FS_WARN_T).toBeGreaterThan(0.5)
    expect(FS_WARN).toBe(1.2)
  })
  it('is one of the colour modes', () => {
    expect(MODES.map((m) => m.id)).toContain('fs')
  })
})

describe('MTD texture', () => {
  const pack = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
  it('changes some pixels of a dark and of a light colour, and is deterministic', () => {
    for (const c of [pack(30, 20, 60), pack(240, 230, 200), pack(222, 45, 38)]) {
      let changed = 0
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (mtdTexture(c, x, y, 1) !== c) changed++
      expect(changed).toBeGreaterThan(40 * 40 * 0.15)
      expect(changed).toBeLessThan(40 * 40 * 0.6)
      expect(mtdTexture(c, 7, 9, 1)).toBe(mtdTexture(c, 7, 9, 1))
    }
  })
})

describe('MTD preset in the views', () => {
  const tm = new TimeMachine()
  let events: FailureEvent[]
  let end: StateView
  let nSteps = 0
  beforeAll(() => {
    const info = tm.run({ presetId: 'mtd', segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 25000 }], overrides: {} }, 1)
    nSteps = info.nSteps
    events = tm.eventsAt(tm.root, nSteps)
    end = tm.seek(tm.root, nSteps, ['thick', 'sand', 'mud', 'fs'])
  }, 120000)

  it('the preset makes events, each with a deposit marked MTD in the view', () => {
    expect(events.length).toBeGreaterThan(0)
    const e = events.find((x) => x.depositFrom >= 0)!
    expect(mtdMask(end, events)[e.layer * end.nx + e.depositFrom]).toBe(1)
    expect(mtdMask(end).reduce((a, b) => a + b, 0)).toBeLessThan(mtdMask(end, events).reduce((a, b) => a + b, 0))
  })

  it('the factor-of-safety field has a value per cell, finite on the slope, and a critical depth per column', () => {
    expect(end.fsCell!.length).toBe(end.nLayers * end.nx)
    expect(end.fsMin!.length).toBe(end.nx)
    let finite = 0
    for (let j = 0; j < end.nx; j++) if (Number.isFinite(end.fsMin![j])) { finite++; expect(end.fsLayer![j]).toBeGreaterThanOrEqual(0); expect(end.fsDepth![j]).toBeGreaterThan(0) }
    expect(finite).toBeGreaterThan(0)
    // colour value is on the ramp
    for (let i = 0; i < end.fsCell!.length; i += 97) {
      const l = Math.floor(i / end.nx)
      const j = i % end.nx
      if (end.sand![i] + end.mud![i] > 0 && l > 0) {
        const t = cellValue(end, 'fs', l, j)
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the event row is in ft, km and Ma', () => {
    const e = events[0]
    const r = eventRow(e, end.dx)
    expect(r.timeMa).toBe(e.ageMa.toFixed(3))
    expect(Number(r.scarFt.replace(/,/g, ''))).toBe(Math.round(e.scarDepth / 0.3048))
    expect(Number(r.runoutKm)).toBeCloseTo(e.runout / 1000, 1)
  })

  it('the pseudo-well lists MTD intervals and every one maps to an event', () => {
    const e = events.find((x) => x.depositFrom >= 0 && x.layer <= end.nLayers - 1)!
    const col = Math.round((e.depositFrom + e.depositTo) / 2)
    const w: WellColumn = tm.wellColumn(tm.root, nSteps, col)
    const prof = wellProfile(w, events)
    expect(prof.mtdIntervals.length).toBeGreaterThan(0)
    for (const m of prof.mtdIntervals) {
      expect(m.botFt).toBeGreaterThan(m.topFt)
      const found = m.layers.flatMap((l) => eventsAtCell(events, l, col))
      expect(found.length).toBeGreaterThan(0)
    }
    expect(prof.points.some((p) => p.mtd)).toBe(true)
  })

  it('an event is seen at the view step after the record step it happened in', () => {
    const e = events[0]
    expect(eventViewStep(e)).toBe(e.step + 1)
    const before = tm.seek(tm.root, e.step, ['thick', 'sand', 'mud'])
    const after = tm.seek(tm.root, e.step + 1, ['thick', 'sand', 'mud'])
    expect(mtdMask(after, events)[e.layer * after.nx + Math.max(0, e.depositFrom)]).toBe(1)
    expect(before.nLayers).toBe(e.layer) // the layer of the event does not exist yet one step earlier
  })
})

describe('store: selecting an event', () => {
  it('seeks to the step after the event and puts the well in its deposit', () => {
    const s = new AppStore()
    const ev: FailureEvent = { id: 7, step: 40, depositFrom: 60, depositTo: 70, sourceFrom: 30, sourceTo: 33, layer: 41 } as FailureEvent
    // internal state: no worker needed for this action's own bookkeeping
    ;(s as unknown as { state: Record<string, unknown> }).state = {
      ...s.getState(), events: [ev], info: { nx: 150, nSteps: 120 }, step: 5,
    }
    ;(s as unknown as { refresh: () => void }).refresh = () => {}
    s.selectEvent(7)
    expect(s.getState().step).toBe(41)
    expect(s.getState().selectedEvent).toBe(7)
    expect(s.getState().wellCol).toBe(65)
    s.selectEvent(null)
    expect(s.getState().selectedEvent).toBeNull()
  })
})
