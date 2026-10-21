// M4.2: pressures along a well. Hand calculation of overburden, pore pressure, Eaton and Matthews & Kelly
// fracture gradient and the mud-weight window; then the same functions on a real sampled record.
//
// HAND CALCULATION (constants: g = 9.81 m/s^2, sea water 1025 kg/m^3, 1 ft = 0.3048 m, 1 psi = 6894.757293168 Pa,
// 1 ppg = 0.45359237 kg / 0.003785411784 m^3 = 119.8264 kg/m^3; EMW = P / (g D) in ppg, D below RKB, air gap 80 ft)
//
//   Column:  sea surface at 0 ft TVDSS
//              5,000 ft of sea water (mud line at 5,000 ft TVDSS)
//              mud 1   5,000 - 8,000 ft   bulk density 2000 kg/m^3, pore pressure = hydrostatic + 500 psi
//              salt    8,000 - 10,000 ft  density 2160 kg/m^3, no pore pressure of its own
//              mud 2  10,000 - 14,000 ft  bulk density 2200 kg/m^3, pore pressure = hydrostatic + 2,500 psi
//   (hydrostatic = 1025 g x depth below the sea surface). Eaton nu = 0.40, so K = nu / (1 - nu) = 2/3.
//   Matthews & Kelly Ki = 0.60.
//
//   Overburden S = 1025 g (5,000 ft) + sum of density x g x thickness. Pf = K (S - P) + P. FG = Pf / (g D).
//
//   station            A: 6,500 ft TVDSS (mud 1)   B: 9,000 ft (salt)   C: 12,000 ft (mud 2)
//   D below RKB, ft         6,580                       9,080                12,080
//   S, psi                  3,523.614243               5,761.380334         8,606.292265
//   P, psi                  3,389.363679               4,000.657402 (hydro) 7,834.209869
//   S  as EMW, ppg          10.304926                  12.210209            13.709814
//   P  as EMW, ppg           9.912306                   8.478674             12.479887
//   Eaton FG, ppg           10.174052                  12.210209 (= S)      13.299838
//   M&K FG, ppg             10.147878                  12.210209 (= S)      13.217843
//   window (Eaton), ppg      0.261747 (tight)           none (salt, M4.7)    0.819951
//   (digits from the same arithmetic done separately in Python; the code is asked to match to 1e-9 relative)
import { beforeAll, describe, expect, it } from 'vitest'
import { G, RHO_SALT, RHO_W } from '../src/engine/constants'
import { getReference } from '../src/engine/references'
import {
  eatonK, fracturePressurePa, wellPressures, WINDOW_NO_WINDOW, WINDOW_NONE, WINDOW_OK, WINDOW_TIGHT, type PressureInput,
} from '../src/engine/wellPressure'
import {
  defaultWellPressureParams, validateWellPressureParams, WELL_PRESSURE_PARAMS, type WellPressureParams,
} from '../src/engine/wellPressureParams'
import {
  DEFAULT_AIR_GAP_FT, WELL_AIR, WELL_SALT, WELL_SEDIMENT, WELL_WATER, wellStations, verticalWell, type WellDefinition, type WellSamples,
} from '../src/engine/well'
import { ftToM, KGM3_PER_PPG, paToPsi, psiToPa } from '../src/units'
import { TimeMachine } from '../src/worker/timeMachine'

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30)
const FT = ftToM(1)

// ---- the hand column, written with plain arithmetic (not with the code under test) ----
interface Layer { topFt: number; botFt: number; rho: number; excessPsi: number; salt: boolean }
const SEA = RHO_W * G
function column(waterFt: number, layers: Layer[], tvdssFt: number): { kind: number; s: number; p: number; h: number } {
  const hydro = SEA * tvdssFt * FT
  let s = SEA * waterFt * FT
  for (const l of layers) {
    const top = waterFt + l.topFt
    const bot = waterFt + l.botFt
    const inside = Math.min(Math.max(tvdssFt, top), bot) - top
    s += l.rho * G * Math.max(inside, 0) * FT
    if (tvdssFt >= top && tvdssFt <= bot) {
      return { kind: l.salt ? WELL_SALT : WELL_SEDIMENT, s, p: l.salt ? NaN : hydro + psiToPa(l.excessPsi), h: hydro }
    }
  }
  throw new Error('below the column')
}
const HAND_LAYERS: Layer[] = [
  { topFt: 0, botFt: 3000, rho: 2000, excessPsi: 500, salt: false },
  { topFt: 3000, botFt: 5000, rho: RHO_SALT, excessPsi: 0, salt: true },
  { topFt: 5000, botFt: 9000, rho: 2200, excessPsi: 2500, salt: false },
]

/** A PressureInput from a list of stations (md, tvdss), the hand column below them. */
function inputFor(md: number[], tvdss: number[], waterFt = 5000, layers = HAND_LAYERS, gapFt = DEFAULT_AIR_GAP_FT): PressureInput {
  const n = md.length
  const out: PressureInput = {
    n, mdFt: Float64Array.from(md), tvdssFt: Float64Array.from(tvdss), kind: new Uint8Array(n), depthRkbFt: new Float64Array(n),
    hydroPa: new Float64Array(n), porePa: new Float64Array(n), overburdenPa: new Float64Array(n),
  }
  for (let i = 0; i < n; i++) {
    const c = column(waterFt, layers, tvdss[i])
    out.kind[i] = c.kind
    out.depthRkbFt[i] = tvdss[i] + gapFt
    out.hydroPa[i] = c.h
    out.porePa[i] = c.p
    out.overburdenPa[i] = c.s
  }
  return out
}

describe('hand calculation: 5,000 ft of water, mud, 2,000 ft of salt, mud', () => {
  const x = inputFor([6580, 9080, 12080], [6500, 9000, 12000])
  const r = wellPressures(x)
  const rows = [
    { i: 0, sPsi: 3523.614243, pPsi: 3389.363679, sEmw: 10.30492571, pEmw: 9.912305522, eaton: 10.174052314, mk: 10.147877635, width: 0.261746792 },
    { i: 1, sPsi: 5761.380334, pPsi: 4000.657402, sEmw: 12.210209047, pEmw: 8.478673576, eaton: 12.210209047, mk: 12.210209047, width: NaN }, // salt: no window (M4.7)
    { i: 2, sPsi: 8606.292265, pPsi: 7834.209869, sEmw: 13.709813854, pEmw: 12.47988747, eaton: 13.299838392, mk: 13.2178433, width: 0.819950922 },
  ]
  it('overburden, pore pressure, fracture gradient (both methods) and the window match the table to 1e-9', () => {
    for (const t of rows) {
      expect(rel(r.overburdenPsi[t.i], t.sPsi), 'S psi').toBeLessThan(1e-9)
      expect(rel(r.overburdenEmw[t.i], t.sEmw), 'S ppg').toBeLessThan(1e-9)
      expect(rel(r.fgEatonEmw[t.i], t.eaton), 'Eaton').toBeLessThan(1e-9)
      expect(rel(r.fgMatthewsKellyEmw[t.i], t.mk), 'M&K').toBeLessThan(1e-9)
      if (Number.isFinite(t.width)) expect(rel(r.widthPpg[t.i], t.width), 'window').toBeLessThan(1e-9)
      else expect(Number.isNaN(r.widthPpg[t.i]), 'no window in salt').toBe(true)
      expect(rel(r.hydroPsi[t.i], paToPsi(x.hydroPa[t.i])), 'hydro psi').toBeLessThan(1e-12)
    }
    expect(rel(r.porePsi[0], rows[0].pPsi)).toBeLessThan(1e-9)
    expect(rel(r.porePsi[2], rows[2].pPsi)).toBeLessThan(1e-9)
    expect(rel(r.poreEmw[0], rows[0].pEmw)).toBeLessThan(1e-9)
    expect(rel(r.poreEmw[2], rows[2].pEmw)).toBeLessThan(1e-9)
    // salt: no pore pressure of its own and no window (M4.7)
    expect(Number.isNaN(r.porePsi[1])).toBe(true)
    expect(Number.isNaN(r.lowerEmw[1]) && Number.isNaN(r.upperEmw[1]) && Number.isNaN(r.widthPpg[1])).toBe(true)
  })

  it('in salt the fracture gradient is the overburden, for both methods', () => {
    expect(r.fgEatonEmw[1]).toBe(r.overburdenEmw[1])
    expect(r.fgMatthewsKellyEmw[1]).toBe(r.overburdenEmw[1])
    expect(r.fracturePsi[1]).toBeCloseTo(r.overburdenPsi[1], 9)
  })

  it('Eaton is the default; Matthews & Kelly is the option', () => {
    expect(defaultWellPressureParams().fgMethod).toBe('eaton')
    expect(r.fgEmw[0]).toBe(r.fgEatonEmw[0])
    const mk = wellPressures(x, { ...defaultWellPressureParams(), fgMethod: 'matthews-kelly' })
    expect(mk.fgEmw[2]).toBe(mk.fgMatthewsKellyEmw[2])
    expect(rel(mk.widthPpg[2], rows[2].mk - rows[2].pEmw)).toBeLessThan(1e-9)
  })

  it('states: the first window is tight (0.26 ppg), salt has none, the last is ok; summary names the narrowest', () => {
    expect(Array.from(r.state)).toEqual([WINDOW_TIGHT, WINDOW_NONE, WINDOW_OK])
    expect(r.summary.narrowest).toMatchObject({ station: 0, tvdssFt: 6500, mdFt: 6580 })
    expect(r.summary.tight).toHaveLength(1)
    expect(r.summary.noWindow).toHaveLength(0)
  })

  it('margins narrow the window: 0.4 ppg above pore pressure and 0.2 below the fracture gradient make station C tight', () => {
    const m = wellPressures(x, { ...defaultWellPressureParams(), lowerMarginPpg: 0.4, upperMarginPpg: 0.2 })
    expect(Math.abs(m.widthPpg[2] - (rows[2].width - 0.6))).toBeLessThan(1e-8)
    expect(m.state[2]).toBe(WINDOW_TIGHT)
    expect(m.state[0]).toBe(WINDOW_NO_WINDOW) // 0.2617 - 0.6 < 0
  })
})

describe('deep water: the water column is in the overburden', () => {
  const layers: Layer[] = [{ topFt: 0, botFt: 4000, rho: 2000, excessPsi: 300, salt: false }]
  it('5,000 ft of water adds 1025 g x 5,000 ft to S and moves the fracture gradient (hand calculation)', () => {
    const wet = wellPressures(inputFor([1580], [1500 + 5000], 5000, layers))
    const dry = wellPressures(inputFor([1580], [1500], 0, layers)) // same rock, no water, mud line at the sea surface
    const water = SEA * 5000 * FT
    // hand: S_wet = water + 2000 g (1,500 ft); P_wet = 1025 g (6,500 ft) + 300 psi
    const sWet = water + 2000 * G * 1500 * FT
    const pWet = SEA * 6500 * FT + psiToPa(300)
    const k = 0.4 / 0.6
    const dWet = ftToM(6500 + 80)
    const fgWet = (k * (sWet - pWet) + pWet) / (G * dWet) / KGM3_PER_PPG
    expect(rel(wet.fgEatonEmw[0], fgWet)).toBeLessThan(1e-9)
    expect(rel(paToPsi(sWet - 2000 * G * 1500 * FT), paToPsi(water))).toBeLessThan(1e-12)
    // the known deep-water effect: the same rock with 5,000 ft of water above it has a much lower FG in ppg from RKB
    expect(wet.fgEatonEmw[0]).toBeLessThan(dry.fgEatonEmw[0])
    expect(rel(wet.overburdenPsi[0] - dry.overburdenPsi[0], paToPsi(water))).toBeLessThan(1e-9)
    // the overburden as EMW from RKB at the sea floor is about the sea water, so the shallow window opens with it
    const mud = wellPressures(inputFor([5080], [5000], 5000, layers))
    expect(rel(mud.overburdenEmw[0], (RHO_W / KGM3_PER_PPG) * (5000 / 5080))).toBeLessThan(1e-9)
  })
})

describe('window states and intervals', () => {
  it('pore pressure above overburden gives no window (fracture pressure falls below pore pressure)', () => {
    const layers: Layer[] = [{ topFt: 0, botFt: 4000, rho: 2000, excessPsi: 6000, salt: false }]
    const x = inputFor([5580], [5500], 5000, layers)
    const r = wellPressures(x)
    expect(r.state[0]).toBe(WINDOW_NO_WINDOW)
    expect(r.widthPpg[0]).toBeLessThan(0)
    expect(r.summary.noWindow).toHaveLength(1)
    expect(r.summary.noWindow[0].topTvdssFt).toBe(5500)
  })

  it('runs of stations: tight and ok intervals, narrowest, both with the TVDSS and MD of the run', () => {
    const tv: number[] = []
    for (let t = 5100; t <= 13900; t += 100) tv.push(t)
    const x = inputFor(tv.map((t) => t + 500), tv) // vertical-ish: MD = TVD + 500 only to keep the two apart
    const r = wellPressures(x)
    const p = defaultWellPressureParams()
    const k = eatonK(p.poissonRatio)
    // independent loop
    let min = Infinity, at = -1
    const want: number[] = []
    for (let i = 0; i < x.n; i++) {
      if (x.kind[i] === WELL_SALT) { want.push(NaN); continue }
      const d = ftToM(x.depthRkbFt[i])
      const w = (fracturePressurePa(x.overburdenPa[i], x.porePa[i], k) - x.porePa[i]) / (G * d) / KGM3_PER_PPG
      want.push(w)
      if (w < min) { min = w; at = i }
    }
    for (let i = 0; i < x.n; i++) if (!Number.isNaN(want[i])) expect(rel(r.widthPpg[i], want[i])).toBeLessThan(1e-9)
    expect(r.summary.narrowest!.station).toBe(at)
    expect(r.summary.narrowest!.tvdssFt).toBe(tv[at])
    expect(r.summary.narrowest!.mdFt).toBe(tv[at] + 500)
    const tightIdx = want.map((w, i) => (!Number.isNaN(w) && w > 0 && w < 0.5 ? i : -1)).filter((i) => i >= 0)
    const covered = r.summary.tight.reduce((a, t) => a + Math.round((t.bottomTvdssFt - t.topTvdssFt) / 100) + 1, 0)
    expect(covered).toBe(tightIdx.length)
    expect(tightIdx.length).toBeGreaterThan(0)
    for (const t of r.summary.tight) {
      expect(t.minWidthPpg).toBeLessThan(0.5)
      expect(t.bottomMdFt - t.topMdFt).toBe(t.bottomTvdssFt - t.topTvdssFt)
    }
  })
})

describe('a deviated well: depth is TVD, not MD', () => {
  it('pressures at the station with TVDSS 12,000 ft equal the vertical case although its MD is larger', () => {
    const w: WellDefinition = { xKm: 10, airGapFt: 80, kickoffFt: 5000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30, direction: 'basinward', totalDepthFt: 12000 }
    const all = wellStations(w)
    const first = Array.from(all.tvdssFt).findIndex((t) => t >= 5000) // the hand column starts at the mud line
    const st = { n: all.n - first, mdFt: all.mdFt.slice(first), tvdssFt: all.tvdssFt.slice(first) }
    const last = st.n - 1
    expect(st.tvdssFt[last]).toBeCloseTo(12000, 9)
    expect(st.mdFt[last]).toBeGreaterThan(12080 + 400) // the hold is longer than its vertical gain
    const dev = wellPressures(inputFor(Array.from(st.mdFt), Array.from(st.tvdssFt)))
    const vert = wellPressures(inputFor([12080], [12000]))
    expect(dev.overburdenEmw[last]).toBe(vert.overburdenEmw[0])
    expect(dev.fgEatonEmw[last]).toBe(vert.fgEatonEmw[0])
    expect(rel(dev.widthPpg[last], 0.819950922)).toBeLessThan(1e-9) // the table value of station C
    // the EMW uses the TVD: dividing by the MD would give a lower number
    const wrong = st.mdFt[last] * FT
    expect(dev.overburdenEmw[last]).toBeGreaterThan((dev.overburdenPsi[last] * 6894.757293168) / (G * wrong) / KGM3_PER_PPG)
    // a station reports its MD in the summary
    expect(dev.summary.narrowest!.mdFt).toBe(st.mdFt[dev.summary.narrowest!.station])
    expect(dev.summary.narrowest!.mdFt).toBeGreaterThan(dev.summary.narrowest!.tvdssFt)
  })
})

describe('parameters', () => {
  it('every parameter is cited, tuned or to verify; cited ones name a reference that exists; defaults are valid', () => {
    expect(WELL_PRESSURE_PARAMS.map((p) => p.key).sort()).toEqual(Object.keys(defaultWellPressureParams()).sort())
    for (const p of WELL_PRESSURE_PARAMS) {
      expect(['cited', 'tuned', 'to-verify']).toContain(p.source.kind)
      if (p.source.kind === 'cited') expect(p.source.refId, p.key).toBeTruthy()
      if (p.source.refId) expect(getReference(p.source.refId), p.key).toBeDefined()
      expect(p.source.note.length).toBeGreaterThan(20)
    }
    expect(validateWellPressureParams(defaultWellPressureParams())).toEqual([])
    const bad: WellPressureParams = { ...defaultWellPressureParams(), poissonRatio: 0.6 }
    expect(validateWellPressureParams(bad)).toHaveLength(1)
  })
  it('the defaults: Eaton, nu 0.40, Ki 0.60, no margins, tight below 0.5 ppg', () => {
    expect(defaultWellPressureParams()).toEqual({
      fgMethod: 'eaton', poissonRatio: 0.4, matthewsKellyKi: 0.6, lowerMarginPpg: 0, upperMarginPpg: 0, tightWindowPpg: 0.5,
    })
  })
})

// ---- on a real record ------------------------------------------------------------------------------
const SALTY = { saltOn: 1, saltThick: 600, saltPinchStart: 15000, saltPinchEnd: 60000, saltVisc: 1e17, coverThick: 300, weldThick: 150, nx: 80, dx: 3000, duration: 6e6, supply: 8 }
const SEGS = [{ fromAgeMa: 6, toAgeMa: 0, dt: 50000 }]

describe('pressures on a sampled record', () => {
  const tm = new TimeMachine()
  let nSteps = 0
  let forkId = ''
  const sample = (branch: string, w: WellDefinition): WellSamples => tm.sampleWell(branch, nSteps, w)
  beforeAll(() => {
    nSteps = tm.run({ presetId: 'last3', segments: SEGS, overrides: SALTY }, 1).nSteps
    forkId = tm.branch(tm.root, Math.floor(nSteps / 2), { supply: 30 }, 'More supply').id
  }, 180000)

  it('the samples carry the depth below RKB, and the psi / ppg / ft constant is the same everywhere', () => {
    const s = sample(tm.root, verticalWell(61.5, 8000))
    const r = wellPressures(s)
    expect(s.stopped).toBeNull()
    let checked = 0
    let factor = NaN
    for (let i = 0; i < s.n; i++) {
      if (s.kind[i] === WELL_AIR) { expect(Number.isNaN(s.depthRkbFt[i])).toBe(true); continue }
      if (r.overburdenPsi[i] === 0) continue // the sea surface itself
      expect(s.depthRkbFt[i]).toBeGreaterThan(0)
      // psi per (ppg x ft): 119.8264 kg/m3 x 9.81 x 0.3048 m / 6894.757 Pa = 0.051965
      const f = r.overburdenPsi[i] / (r.overburdenEmw[i] * s.depthRkbFt[i])
      if (Number.isNaN(factor)) factor = f
      expect(rel(f, factor)).toBeLessThan(1e-12)
      checked++
    }
    expect(checked).toBeGreaterThan(500)
    expect(factor).toBeCloseTo((KGM3_PER_PPG * 9.81 * 0.3048) / 6894.757293168, 12)
    expect(factor).toBeGreaterThan(0.0519)
    expect(factor).toBeLessThan(0.0520)
  })

  it('salt: fracture gradient = overburden. Sediment: pore pressure < fracture gradient < overburden. Water has no window', () => {
    const s = sample(tm.root, verticalWell(61.5, 8000))
    const r = wellPressures(s)
    let salt = 0, sed = 0, water = 0
    for (let i = 0; i < s.n; i++) {
      if (s.kind[i] === WELL_SALT) {
        salt++
        expect(r.fgEmw[i]).toBe(r.overburdenEmw[i])
        expect(Number.isNaN(r.widthPpg[i])).toBe(true) // no window in salt (M4.7)
        expect(r.state[i]).toBe(WINDOW_NONE)
      } else if (s.kind[i] === WELL_WATER) {
        water++
        expect(Number.isNaN(r.fgEmw[i])).toBe(true)
        expect(r.hydroEmw[i]).toBe(r.poreEmw[i])
      } else if (s.kind[i] !== WELL_AIR) {
        sed++
        expect(r.fgEmw[i]).toBeLessThan(r.overburdenEmw[i] + 1e-9)
        expect(r.fgEmw[i]).toBeGreaterThanOrEqual(r.poreEmw[i] - 1e-9)
      }
    }
    expect(salt).toBeGreaterThan(50)
    expect(sed).toBeGreaterThan(50)
    expect(water).toBeGreaterThan(50)
    expect(r.summary.narrowest).not.toBeNull()
    expect(s.kind[r.summary.narrowest!.station]).toBe(WELL_SEDIMENT) // the narrowest window is outside the salt (M4.7)
    expect(Math.min(...Array.from(r.widthPpg).filter((v) => !Number.isNaN(v)))).toBe(r.summary.narrowest!.widthPpg)
  })

  it('the same well on two branches at the same time: more supply gives different pore pressure (and a different window)', () => {
    const w = verticalWell(61.5, 8000)
    const a = wellPressures(sample(tm.root, w))
    const b = wellPressures(sample(forkId, w))
    // SFM-2: the two sea floors differ in depth now, so the stations are not the same count; compare the shared stations
    expect(Math.abs(a.n - b.n)).toBeLessThan(0.05 * a.n)
    let maxDiff = 0
    for (let i = 0; i < Math.min(a.n, b.n); i++) {
      const d = Math.abs(a.porePsi[i] - b.porePsi[i])
      if (!Number.isNaN(d)) maxDiff = Math.max(maxDiff, d)
    }
    expect(maxDiff).toBeGreaterThan(10) // psi; hundreds in practice
    expect(a.summary.narrowest!.widthPpg).not.toBe(b.summary.narrowest!.widthPpg)
    // and sampling does not move the engine
    const before = tm.hashes()
    sample(forkId, w)
    expect(tm.hashes()).toEqual(before)
  })

  it('the same branch twice gives bit-identical pressures', () => {
    const w = verticalWell(61.5, 8000)
    const a = wellPressures(sample(tm.root, w))
    const b = wellPressures(sample(tm.root, w))
    expect(Array.from(b.fgEmw)).toEqual(Array.from(a.fgEmw))
    expect(Array.from(b.state)).toEqual(Array.from(a.state))
  })
})
