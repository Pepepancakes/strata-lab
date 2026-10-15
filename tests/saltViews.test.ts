// M3.5: salt in the views. The worker carries the weld data, the section has a "Salt thickness" colour mode
// and the pseudo-well breaks its pore-pressure and porosity lines at salt and reports a weld.
import { beforeAll, describe, expect, it } from 'vitest'
import { TimeMachine } from '../src/worker/timeMachine'
import type { StateView } from '../src/worker/protocol'
import { MODES, legendFor, NEUTRAL_SEDIMENT, ramp, saltColumnThickness, SALT_RAMP_MAX_M, shade, viewHasSalt, weldedColumns } from '../src/views/section/colors'
import { wellProfile } from '../src/views/well/profile'
import { SALT } from '../src/engine/record'
import { mToFt } from '../src/units'

const SALTY = { saltOn: 1, saltThick: 600, saltPinchStart: 15000, saltPinchEnd: 60000, saltVisc: 1e17, coverThick: 300, weldThick: 150, nx: 80, dx: 1000, duration: 2e6 }
const SEGS = [{ fromAgeMa: 2, toAgeMa: 0, dt: 50000 }]

describe('salt in the views', () => {
  const tm = new TimeMachine()
  let v0: StateView
  let end: StateView
  let nSteps = 0
  beforeAll(() => {
    const info = tm.run({ presetId: 'last3', segments: SEGS, overrides: SALTY }, 1)
    nSteps = info.nSteps
    v0 = tm.seek(tm.root, 0, ['thick', 'sand', 'mud'])
    end = tm.seek(tm.root, nSteps, ['thick', 'sand', 'mud'])
  }, 120000)

  it('the view says it has salt (two pre-run layers) and carries the weld data', () => {
    expect(viewHasSalt(end)).toBe(true)
    expect(end.nPre).toBe(2)
    expect(end.weldAge!.length).toBe(end.nx)
    expect(end.weldThick).toBe(150)
  })

  it('a run without salt does not look salty', () => {
    const t2 = new TimeMachine()
    const info = t2.run({ presetId: 'last3', segments: SEGS, overrides: { nx: 40, duration: 2e6 } }, 1)
    expect(viewHasSalt(t2.seek(t2.root, info.nSteps, ['thick', 'sand', 'mud']))).toBe(false)
  }, 60000)

  it('salt thickness per column equals the hand sum of its salt cells', () => {
    const t = saltColumnThickness(v0)
    let max = 0
    for (let j = 0; j < v0.nx; j++) {
      let hand = 0
      for (let l = 0; l < v0.nLayers; l++) {
        const i = l * v0.nx + j
        if (v0.material[i] === SALT && v0.thick![i] > 0) hand += v0.thick![i]
      }
      expect(t[j]).toBe(hand)
      max = Math.max(max, hand)
    }
    expect(max).toBeGreaterThan(500) // the 600 m sheet, thinned a little at the start
  })

  it('welded columns have thin salt and a weld age; others do not count', () => {
    const w = weldedColumns(end)
    const t = saltColumnThickness(end)
    for (let j = 0; j < end.nx; j++) if (w[j]) {
      expect(t[j]).toBeLessThan(150)
      expect(end.weldAge![j]).toBeGreaterThanOrEqual(0)
    }
    expect(weldedColumns({ ...end, weldAge: undefined } as StateView).every((x) => x === 0)).toBe(true)
  })

  it('the salt mode is a colour mode with a legend in feet', () => {
    expect(MODES.map((m) => m.id)).toContain('salt')
    const leg = legendFor('salt', 2)
    expect(leg.low).toBe('0 ft')
    expect(leg.high).toContain(Math.round(mToFt(SALT_RAMP_MAX_M)).toLocaleString('en-US'))
    expect(leg.info!.length).toBeGreaterThan(20)
    const [r0, g0, b0] = ramp('salt', 0)
    const [r1, g1, b1] = ramp('salt', 1)
    expect(r0 + g0 + b0).toBeGreaterThan(r1 + g1 + b1) // thicker salt is darker
  })

  it('shade darkens a packed colour and keeps it opaque', () => {
    const c = shade(NEUTRAL_SEDIMENT, 0.5)
    expect(c >>> 24).toBe(255)
    expect(c & 255).toBe(Math.round(214 * 0.5))
  })

  it('the pseudo-well breaks the pore-pressure line at salt and tells about a weld', () => {
    for (const col of [10, 30, 70]) {
      const prof = wellProfile(tm.wellColumn(tm.root, nSteps, col), [])
      for (const p of prof.points) if (p.salt) expect(p.porosity).toBe(0)
      if (prof.saltIntervals.length) {
        for (const p of prof.points) if (p.salt) expect(p.poreEmw).toBeNull()
        expect(prof.saltDensityPpg).toBeGreaterThan(17)
      }
    }
    const welded = weldedColumns(end).findIndex((x) => x === 1)
    if (welded >= 0) {
      const prof = wellProfile(tm.wellColumn(tm.root, nSteps, welded), [])
      expect(prof.weld).not.toBeNull()
      expect(prof.weld!.ageMa).toBeGreaterThanOrEqual(0)
    }
    const never = end.weldAge!.findIndex((a) => a < 0)
    if (never >= 0) expect(wellProfile(tm.wellColumn(tm.root, nSteps, never), []).weld).toBeNull()
  })
})
