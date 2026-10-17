// M4.1: sampling a long well is fast enough to redo on every slider move. Wall-clock gate: skipped on CI
// (shared runners are too noisy to time), and in the serial `wallclock` vitest project (vitest.config.ts).
// The measured time is printed to stderr and stated in the card handoff.
import { beforeAll, describe, expect, it } from 'vitest'
import { totalMeasuredDepthFt, type WellDefinition } from '../src/engine/well'
import { TimeMachine } from '../src/worker/timeMachine'

// A deep marine basin: 15 Myr at 15 kyr steps = 1,000 layers (the Gulf preset's record has about 1,300), with several km of sediment and salt in the basin.
const DEEP = { saltOn: 1, saltThick: 600, saltPinchStart: 15000, saltPinchEnd: 60000, saltVisc: 1e17, coverThick: 300, weldThick: 150, nx: 80, dx: 3000, duration: 15e6, supply: 20, subsShelf: 300, subsBasin: 900 }
const SEGS = [{ fromAgeMa: 15, toAgeMa: 0, dt: 15000 }]

/** Vertical to the kickoff, build at 2 deg/100 ft to 40 deg, hold: total depth chosen so that the measured depth is exactly 30,000 ft. */
function longWell(): WellDefinition {
  const kopMd = 6000 + 80
  const R = 18000 / (Math.PI * 2)
  const h = (40 * Math.PI) / 180
  const buildLen = (40 * 100) / 2
  const tvdAtMd30000 = kopMd + R * Math.sin(h) + (30000 - kopMd - buildLen) * Math.cos(h)
  return { xKm: 120, airGapFt: 80, kickoffFt: 6000, buildRateDegPer100Ft: 2, holdInclinationDeg: 40, direction: 'basinward', totalDepthFt: tvdAtMd30000 - 80 }
}

describe('well sampling speed', () => {
  const tm = new TimeMachine()
  let nSteps = 0
  const well = longWell()
  beforeAll(() => {
    nSteps = tm.run({ presetId: 'last3', segments: SEGS, overrides: DEEP }, 1).nSteps
  }, 120000)

  it('the test well is 30,000 ft of MD and the record is deep enough for every station to be sampled', () => {
    expect(totalMeasuredDepthFt(well)).toBeCloseTo(30000, 6)
    const s = tm.sampleWell(tm.root, nSteps, well)
    expect(s.stopped).toBeNull()
    expect(s.n).toBe(3001)
  })

  it.skipIf(!!process.env.CI)('sampling 3,001 stations takes under 20 ms (median of 15, including building the columns)', () => {
    tm.sampleWell(tm.root, nSteps, well) // warm up the JIT, as the app would after the first draw
    const times: number[] = []
    for (let k = 0; k < 15; k++) {
      const t0 = performance.now()
      tm.sampleWell(tm.root, nSteps, well)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]
    process.stderr.write(`well sampling: 3001 stations, median ${median.toFixed(2)} ms, worst ${times[times.length - 1].toFixed(2)} ms\n`)
    expect(median).toBeLessThan(20)
  })
})
