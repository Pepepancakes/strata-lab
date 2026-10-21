// The turbidite-share read-out (SFM-3): wording, cap flag and no-edge case. The 99 % cap fraction is a round number.
import { describe, expect, it } from 'vitest'
import { turbiditeReadout, TURBIDITE_INFO } from '../src/views/section/turbidite'

describe('turbidite share read-out', () => {
  it('rounds the share and flags the cap', () => {
    const r = turbiditeReadout(0.6, 0.6, 50)
    expect(r.percent).toBe(60)
    expect(r.atCap).toBe(true)
    expect(r.text).toContain('at its 60 % cap')
  })
  it('below the cap it says so', () => {
    const r = turbiditeReadout(0.234, 0.6, 50)
    expect(r.percent).toBe(23)
    expect(r.atCap).toBe(false)
    expect(r.text).toContain('23 %')
    expect(r.text).toContain('cap 60 %')
  })
  it('says there is no edge when none was found', () => {
    const r = turbiditeReadout(0, 0.6, -1)
    expect(r.noEdge).toBe(true)
    expect(r.atCap).toBe(false)
    expect(r.text).toContain('no shelf edge')
  })
  it('a zero cap is never "at the cap"', () => {
    expect(turbiditeReadout(0, 0, 10).atCap).toBe(false)
  })
  it('has a plain-words note', () => {
    expect(TURBIDITE_INFO).toContain('cap')
  })
})
