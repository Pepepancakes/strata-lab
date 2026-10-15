import { describe, it, expect } from 'vitest'
import { PRESETS } from '../src/engine/presets'
import { buildSchedule } from '../src/engine/schedule'
import { clipSegments, describeSchedule, lengthOf, stepCount } from '../src/app/scenario'

describe('scenario helpers', () => {
  const miocene = PRESETS.find((p) => p.id === 'miocene')!.segments
  const cenozoic = PRESETS.find((p) => p.id === 'cenozoic')!.segments

  it('keeps a full-length schedule unchanged', () => {
    expect(clipSegments(miocene, 23)).toEqual(miocene)
  })

  it('cuts the old end on a whole number of steps and the result is a valid schedule', () => {
    for (const len of [0.5, 2, 3, 3.01, 7.3, 10, 22.99, 40, 65.5]) {
      const segs = clipSegments(cenozoic, len)
      const sch = buildSchedule(segs) // throws if a join or a step count is wrong
      expect(sch.nSteps).toBe(stepCount(segs))
      expect(lengthOf(segs)).toBeLessThanOrEqual(len + 1e-9)
      expect(lengthOf(segs)).toBeGreaterThan(len - 0.1) // at most one coarse step (0.1 Myr) is lost
      expect(segs[segs.length - 1].toAgeMa).toBe(0)
    }
  })

  it('keeps the youngest (finest) steps', () => {
    const segs = clipSegments(miocene, 10)
    expect(segs).toEqual([
      { fromAgeMa: 10, toAgeMa: 3, dt: 50000 },
      { fromAgeMa: 3, toAgeMa: 0, dt: 5000 },
    ])
  })

  it('reads the schedule from the present backwards', () => {
    expect(describeSchedule([{ fromAgeMa: 3, toAgeMa: 0, dt: 5000 }])).toBe('5 kyr steps back to 3 Ma')
    expect(describeSchedule(miocene)).toBe('5 kyr steps back to 3 Ma, then 50 kyr steps back to 23 Ma')
    expect(describeSchedule(cenozoic)).toBe('5 kyr steps back to 3 Ma, then 50 kyr steps back to 23 Ma, then 100 kyr steps back to 66 Ma')
  })

  it('refuses a run shorter than one step', () => {
    expect(() => clipSegments(miocene, 0.001)).toThrow(/shorter than one/)
  })
})
