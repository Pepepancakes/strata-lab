// M3.5 physics-check rows for salt (src/worker/checksM3.ts): they pass, they hold under another machine's
// maths library (withUlpNoise, D16.4), and a real change (5 % off the viscosity) still fails the band.
import { describe, it, expect } from 'vitest'
import { decayRow, runChecksM3 } from '../src/worker/checksM3'
import { runChecks } from '../src/worker/checks'
import { withUlpNoise } from './helpers/ulpNoise'

describe('M3 checks rows', () => {
  it('three rows, all pass, each with a measured value, a limit and a source', () => {
    const rows = runChecksM3()
    expect(rows.map((r) => r.id)).toEqual(['salt-decay', 'salt-bending-peak', 'balance-salt'])
    for (const r of rows) {
      expect(r.pass, `${r.id}: ${r.value} vs ${r.limit}`).toBe(true)
      expect(r.value).toBeLessThan(r.limit)
      expect(r.cite.length).toBeGreaterThan(20)
    }
  })

  it('the rows pass with the last bit of pow/exp/log changed (another machine), and the results stay close', () => {
    const base = runChecksM3()
    for (const salt of [1, 7, 12345]) {
      const noisy = withUlpNoise(2.2e-16, salt, () => runChecksM3())
      noisy.forEach((r, i) => {
        expect(r.pass, `${r.id} salt ${salt}`).toBe(true)
        if (r.id !== 'balance-salt') expect(Math.abs(r.value - base[i].value)).toBeLessThan(0.002) // 0.2 % of the answer, well inside the bands
      })
    }
  })

  it('a real change still fails: 5 % off the viscosity breaks the 1 % decay band', () => {
    expect(decayRow(1).pass).toBe(true)
    expect(decayRow(1.05).pass).toBe(false)
    expect(decayRow(0.95).pass).toBe(false)
  })

  it('the app check list includes them', () => {
    const ids = runChecks().map((r) => r.id)
    for (const id of ['salt-decay', 'salt-bending-peak', 'balance-salt']) expect(ids).toContain(id)
  }, 60000)
})
