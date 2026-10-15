// M3.2 done-when: the width that the physics picks does not depend on the grid, and without the
// bending term it does. Cross-machine rule (D16.4): every number is a summary statistic (mean over
// seeds, ratios) compared with a stated band, and the bands are proved with withUlpNoise.
//
// Width measures used (both stated in docs/physics-references.md):
//   A. dominant wavelength of the roof: the power-weighted mean wavelength of the cosine spectrum of
//      the salt-thickness relief, in the level-seafloor sandbox with seeded roof noise (the
//      differential-loading setup of the dispersion test). Linear stage, rms relief 20 m.
//   B. full width at half height of the salt-thickness high above the local background, in the
//      full engine (3 Myr, wedge, sedimentation), spike 002 grid_check.js on a 100 km section.
import { describe, it, expect } from 'vitest'
import { GRIDS, roofSpectrum, runThinSpot, saltHighWidth } from './helpers/saltGrid'
import { withUlpNoise } from './helpers/ulpNoise'

const SEEDS = [1, 2, 3]
const LONG = 120000 // ms, vitest timeout for the heavy cases

/** Mean over seeds of the roof wavelength (km) at each grid. */
function spectrumTable(over: Record<string, number>): number[] {
  return GRIDS.map((dx) => {
    const rs = SEEDS.map((seed) => {
      const r = roofSpectrum(dx, seed, over)
      expect(r.clipped).toBe(0)
      expect(Math.abs(r.saltErr)).toBeLessThan(1e-12)
      return r.lambdaKm
    })
    return rs.reduce((a, b) => a + b, 0) / rs.length
  })
}

const spread = (v: number[]): number => (Math.max(...v) - Math.min(...v)) / (v.reduce((a, b) => a + b, 0) / v.length)

// analytic fastest-growing wavelength for the sandbox (h = 1,500 m, h_c = 1,000 m, eta_c / eta_s = 100)
const lambdaStarKm = (etaC: number): number => (2 * Math.PI * Math.pow((etaC * 1000 ** 3 * 1500 ** 3) / (18 * 1e17), 1 / 6)) / 1000

describe('grid convergence A: dominant roof wavelength (level seafloor, seeded roof noise)', () => {
  const on = spectrumTable({ coverBend: 1, coverVisc: 1e19 })
  const off = spectrumTable({ coverBend: 0 })
  const stiff = spectrumTable({ coverBend: 1, coverVisc: 1e20 })

  it('prints the tables (spike README format)', () => {
    const rows = GRIDS.map((dx, i) => `| ${dx.toLocaleString('en-US')} m | ${on[i].toFixed(2)} km (${((on[i] * 1000) / dx).toFixed(1)} cells) | ${stiff[i].toFixed(2)} km | ${off[i].toFixed(2)} km (${((off[i] * 1000) / dx).toFixed(1)} cells) |`)
    console.log(`roof wavelength, mean of ${SEEDS.length} seeds (analytic lambda* = ${lambdaStarKm(1e19).toFixed(2)} km at eta_c 1e19, ${lambdaStarKm(1e20).toFixed(2)} km at 1e20)\n| Grid cell | bending on, eta_c 1e19 | bending on, eta_c 1e20 | bending off |\n|---|---|---|---|\n${rows.join('\n')}`)
    expect(rows.length).toBe(3)
  })

  it('with bending the wavelength agrees within 10 % across 1,000 / 500 / 250 m and sits near lambda*', () => {
    expect(spread(on)).toBeLessThan(0.1)
    expect(spread(stiff)).toBeLessThan(0.1)
    for (const l of on) expect(Math.abs(l / lambdaStarKm(1e19) - 1)).toBeLessThan(0.1)
    for (const l of stiff) expect(Math.abs(l / lambdaStarKm(1e20) - 1)).toBeLessThan(0.1)
  })

  it('without bending it collapses to a few cells and follows the grid (so the test can fail)', () => {
    GRIDS.forEach((dx, i) => {
      expect((off[i] * 1000) / dx).toBeGreaterThan(1.5)
      expect((off[i] * 1000) / dx).toBeLessThan(4)
    })
    expect(off[0] / off[2]).toBeGreaterThan(2.5) // 4x finer grid, about 3.3x narrower
    expect(spread(off)).toBeGreaterThan(0.5) // far outside the 10 % band
  })

  it('a real change of the physics moves the wavelength out of the 10 % band: 10x the cover viscosity gives about 1.47x', () => {
    for (let i = 0; i < 3; i++) expect(stiff[i] / on[i]).toBeGreaterThan(1.3)
  })

  it('the bands hold under 1 ulp libm noise (what another machine looks like)', () => {
    const noisy = withUlpNoise(2.2e-16, 7, () => spectrumTable({ coverBend: 1, coverVisc: 1e19 }))
    expect(spread(noisy)).toBeLessThan(0.1)
    noisy.forEach((l, i) => expect(Math.abs(l / on[i] - 1)).toBeLessThan(0.03))
  }, LONG)
})

// B is REPORTED, not asserted (run with STRATA_SLOW=1). Only the strong spot is reported: the gentle
// 30 % / 8 km spot leaves only about 30 m of relief on the wedge-driven salt ramp at 70 km, so there
// is no isolated high whose width could be read (the spike put it at 100 km, past the wedge). The strong thin spot grows into a needle one to
// five cells wide whose width flips between regimes (peak 3,200 m or 2,600 m) when the maths library
// differs by 1 ulp: at eta_c 1e19 the 250 m width was 1.76 km, and 2.32 km under withUlpNoise. A
// number that moves 30 % on a different machine cannot be a test (D16.4), and it is not a width the
// physics sets either. Measure A is the width test; the finite-amplitude needle is M3.3's problem
// (the roof thins to a weld, and D falls as the cover's cube).
describe.skipIf(!process.env.STRATA_SLOW)('grid convergence B (reported): full engine, thin spots, 3 Myr', () => {
  const widths = (amp: number, wid: number, over: Record<string, number>): string[] =>
    GRIDS.map((dx) => {
      const r = runThinSpot(dx, amp, wid, over)
      expect(r.eng.diag.saltClip).toBe(0)
      const w = saltHighWidth(r.hs, dx)
      return `${(w.fwhm / 1000).toFixed(2)} km (${w.cells} cells, peak ${w.peak.toFixed(0)} m over ${w.background.toFixed(0)} m)`
    })
  it('prints the width at half height with and without bending', () => {
    for (const [amp, wid] of [[0.6, 4000]]) {
      const on = widths(amp, wid, { coverBend: 1, coverVisc: 1e19 })
      const on20 = widths(amp, wid, { coverBend: 1, coverVisc: 1e20 })
      const off = widths(amp, wid, { coverBend: 0 })
      console.log(`thin spot ${amp * 100} %, ${wid / 1000} km\n| Grid cell | bending on (1e19) | bending on (1e20) | bending off |\n|---|---|---|---|\n${GRIDS.map((dx, i) => `| ${dx} m | ${on[i]} | ${on20[i]} | ${off[i]} |`).join('\n')}`)
    }
    expect(true).toBe(true)
  }, 600000)
})
