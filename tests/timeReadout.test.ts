// The time read-out under the Time slider (check 15 fix): step, age and the sea level at the shown step, in ft.
// John could not tell which step was a highstand: the sea level was only in the chart further down the page.
import { describe, expect, it } from 'vitest'
import { timeReadout } from '../src/views/transport/readout'

describe('time read-out', () => {
  it('shows step, age and sea level in ft with a sign', () => {
    // 80 m = 262.47 ft
    expect(timeReadout(105, 600, 2.475, 80)).toBe('step 105 of 600 \u2014 2.475 Ma (million years ago) \u2014 sea level +262 ft')
  })
  it('a low sea level reads with a minus sign', () => {
    expect(timeReadout(15, 600, 2.925, -80)).toContain('sea level -262 ft')
  })
  it('zero reads 0 ft, without a sign, and never "-0"', () => {
    expect(timeReadout(600, 600, 0, -1e-9)).toContain('sea level 0 ft')
  })
  it('leaves age and sea level out before a run exists', () => {
    expect(timeReadout(0, 0, null, null)).toBe('step 0 of 0')
  })
})
