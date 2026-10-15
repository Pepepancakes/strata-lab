import { describe, it, expect, beforeAll } from 'vitest'
import { stateHash } from '../src/engine/determinism'
import { defaultEngineParams, type EngineParams } from '../src/engine/engineParams'
import { getPreset } from '../src/engine/presets'
import { createRng } from '../src/engine/rng'
import { buildSchedule } from '../src/engine/schedule'
import { makeSeaLevel } from '../src/engine/sealevel'
import { createEngine, step } from '../src/engine/step'
import { MAX_BRANCHES, TimeMachine } from '../src/worker/timeMachine'
import type { RunSpec } from '../src/worker/protocol'

// Small, fast runs: 3 Myr at 10 kyr steps (300 steps) on 60 columns of 2.5 km (same 150 km section).
const SMALL: RunSpec = {
  presetId: 'last3',
  segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 10000 }],
  overrides: { nx: 60, dx: 2500, seaLevelKind: 'sine' },
}
// Same, with bundled deep compaction, temperature and cement on: keyframes at cycle ends, temp stored.
const BURIAL: RunSpec = {
  presetId: 'last3',
  segments: [{ fromAgeMa: 3, toAgeMa: 0, dt: 10000 }],
  overrides: { nx: 40, dx: 3750, seaLevelKind: 'sine', bundleEvery: 10, bundleAgeYr: 100000, thermal: 1, cement: 1, thermalEvery: 5, heatFlow: 0.09, cemTonset: 40 },
}

/** Hashes of a straight, uninterrupted run at the wanted steps. */
function straightHashes(spec: RunSpec, wanted: number[]): Map<number, string> {
  const preset = getPreset(spec.presetId)
  const P: EngineParams = { ...defaultEngineParams(), ...preset.params, ...spec.overrides }
  const schedule = buildSchedule(spec.segments ?? preset.segments)
  const eng = createEngine(P, schedule)
  const sea = makeSeaLevel(P, schedule.startAgeMa * 1e6)
  const want = new Set(wanted)
  const out = new Map<number, string>()
  if (want.has(0)) out.set(0, stateHash(eng.rec))
  while (step(eng, P, schedule, sea)) if (want.has(eng.diag.stepIndex)) out.set(eng.diag.stepIndex, stateHash(eng.rec))
  return out
}

/** n distinct pseudo-random steps in 1..nSteps from a seeded generator (fixed list for a fixed seed). */
function seededSteps(seed: number, n: number, nSteps: number): number[] {
  const rng = createRng(seed)
  const out = new Set<number>()
  while (out.size < n) out.add(1 + Math.floor(rng.next() * nSteps))
  return [...out]
}

describe.each([['unbundled', SMALL], ['bundled + temperature + cement', BURIAL]] as const)('seek is bit-identical to a straight run (%s)', (_name, spec) => {
  const tm = new TimeMachine()
  let steps: number[]
  let straight: Map<number, string>
  beforeAll(() => {
    tm.run(spec, 1)
    steps = [0, ...seededSteps(20240601, 20, tm.nSteps)]
    straight = straightHashes(spec, steps)
  }, 60000)

  it('matches the hash at 20 seeded random steps (and step 0), in random order', () => {
    expect(steps.length).toBe(21)
    for (const s of steps) expect(tm.hashAt(tm.root, s), `step ${s}`).toBe(straight.get(s))
  })
  it('matches when every seek has to restore a keyframe', () => {
    for (const s of steps.slice().reverse()) {
      tm.forgetPosition()
      expect(tm.hashAt(tm.root, s), `step ${s}`).toBe(straight.get(s))
    }
  })
  it('playing forward one step at a time gives the same states', () => {
    tm.forgetPosition()
    const sorted = steps.slice().sort((a, b) => a - b)
    for (const s of sorted) expect(tm.hashAt(tm.root, s)).toBe(straight.get(s))
  })
})

describe('branches', () => {
  const tm = new TimeMachine()
  const FORK = 100 // 2 Ma: 3 Myr at 10 kyr steps, so step 100 has age 2 Ma
  beforeAll(() => {
    tm.run(SMALL, 1)
  }, 60000)

  it('step 100 is 2 Ma', () => {
    expect(tm.seek(tm.root, FORK).ageMa).toBeCloseTo(2, 9)
  })

  it('a branch with unchanged parameters equals its parent at every step checked', () => {
    const b = tm.branch(tm.root, FORK, {})
    for (const s of [0, 50, FORK, FORK + 1, 150, 237, 300]) {
      const { diff } = tm.compare(tm.root, b.id, s)
      expect(diff.identical, `step ${s}`).toBe(true)
      expect(tm.hashAt(b.id, s)).toBe(tm.hashAt(tm.root, s))
    }
  })

  it('slShift -50 m at 2 Ma changes the record only after 2 Ma', () => {
    const b = tm.branch(tm.root, FORK, { slShift: -50 })
    for (const s of [0, 1, 40, 99, FORK]) {
      expect(tm.hashAt(b.id, s), `step ${s} must be shared history`).toBe(tm.hashAt(tm.root, s))
    }
    for (const s of [FORK + 1, 150, 300]) {
      expect(tm.hashAt(b.id, s), `step ${s} must differ`).not.toBe(tm.hashAt(tm.root, s))
    }
    const { a, b: bb, diff } = tm.compare(tm.root, b.id, 300)
    expect(diff.maxAbsDH).toBeGreaterThan(0.1)
    expect(diff.identical).toBe(false)
    // layers laid down before the fork have the same grain thicknesses at the fork itself
    const early = tm.compare(tm.root, b.id, FORK)
    expect(early.diff.maxAbsDH).toBe(0)
    expect(a.nLayers).toBe(bb.nLayers)
    // and the dThick field is zero for layers older than the fork at the end of the run only where nothing was eroded: just check the shape
    expect(diff.dThick?.length).toBe(a.nLayers * a.nx)
  })

  it('seeks inside a branch (random order, forced restores) equal playing it forward', () => {
    const b = tm.branch(tm.root, FORK, { slShift: -50, kA: [-14, -21.5] }) // kA changes the permeability caches too
    const steps = [0, ...seededSteps(77, 12, tm.nSteps), FORK, FORK + 1]
    tm.forgetPosition()
    const forward = new Map<number, string>()
    for (const s of steps.slice().sort((x, y) => x - y)) forward.set(s, tm.hashAt(b.id, s))
    for (const s of steps) {
      tm.forgetPosition()
      expect(tm.hashAt(b.id, s), `step ${s}`).toBe(forward.get(s))
    }
  })

  it('a branch of a branch works, and still works after its parent is deleted', () => {
    const p = tm.branch(tm.root, 50, { slShift: 20 })
    const c = tm.branch(p.id, 200, { slShift: -20 })
    const h = tm.hashAt(c.id, 260)
    const hEarly = tm.hashAt(c.id, 120)
    tm.deleteBranch(p.id)
    tm.forgetPosition()
    expect(tm.hashAt(c.id, 260)).toBe(h)
    expect(tm.hashAt(c.id, 120)).toBe(hEarly)
    tm.deleteBranch(c.id)
  })

  it('start-only parameters are read-only in a branch, with a plain message', () => {
    expect(() => tm.branch(tm.root, FORK, { nx: 80 })).toThrow(/only be set when a run starts/)
    expect(() => tm.branch(tm.root, FORK, { phi0: [0.5, 0.6] })).toThrow(/cannot change in a branch/)
    expect(() => tm.branch(tm.root, FORK, { nope: 1 })).toThrow(/Unknown parameter/)
    expect(() => tm.branch(tm.root, FORK, { slShift: 9999 })).toThrow(/at most 200/)
    expect(() => tm.branch(tm.root, 300, {})).toThrow(/at least one step/)
    expect(() => tm.seek('b99', 1)).toThrow(/no branch/)
    expect(() => tm.seek(tm.root, 301)).toThrow(/outside this run/)
  })

  it(`stops at ${MAX_BRANCHES} branches with a plain message`, () => {
    const fresh = new TimeMachine()
    fresh.run({ ...SMALL, segments: [{ fromAgeMa: 1, toAgeMa: 0, dt: 20000 }] }, 1)
    for (let i = 1; i < MAX_BRANCHES; i++) fresh.branch(fresh.root, 10, { slShift: i })
    expect(() => fresh.branch(fresh.root, 10, { slShift: 99 })).toThrow(/8 branches is the most/)
  })
})

describe('deleting a branch frees its snapshots', () => {
  it('drops its own bytes, keeps shared ones, leaves the others working', () => {
    const tm = new TimeMachine()
    tm.run(SMALL, 1)
    const before = tm.liveBytes()
    const b = tm.branch(tm.root, 100, { slShift: -50 })
    const withBranch = tm.liveBytes()
    const info = tm.list().find((x) => x.id === b.id)!
    expect(withBranch).toBeGreaterThan(before)
    expect(info.ownBytes).toBeGreaterThan(0)
    expect(info.reachableBytes).toBeGreaterThan(info.ownBytes) // it shares the parent's history up to the fork
    const { freedBytes } = tm.deleteBranch(b.id)
    expect(freedBytes).toBe(info.ownBytes)
    expect(tm.liveBytes()).toBe(before)
    expect(tm.list().map((x) => x.id)).toEqual([tm.root])
    expect(() => tm.seek(b.id, 10)).toThrow(/no branch/)
    expect(() => tm.deleteBranch(tm.root)).toThrow(/main run cannot be deleted/)
    expect(tm.seek(tm.root, 300).step).toBe(300)
  })
})

describe('views', () => {
  it('carry the record at the step, with transferable own buffers', () => {
    const tm = new TimeMachine()
    const info = tm.run(SMALL, 5)
    expect(info.nSteps).toBe(300)
    expect(info.stepAgeMa.length).toBe(300)
    const v = tm.seek(tm.root, 150, ['thick', 'sand', 'mud', 'smax', 'u', 'cem'])
    expect(v.nLayers).toBe(151)
    expect(v.ageMa).toBeCloseTo(1.5, 9)
    expect(v.thick!.length).toBe(151 * 60)
    for (const a of [v.b, v.H, v.thick!, v.sand!, v.mud!, v.smax!, v.u!, v.cem!, v.material, v.layerAgeMa]) {
      expect(a.buffer.byteLength).toBe(a.byteLength) // owns its buffer, so it can be transferred
    }
    // surface = basement + sum of bulk thickness
    for (let j = 0; j < v.nx; j++) {
      let z = v.b[j]
      for (let l = 0; l < v.nLayers; l++) z += v.thick![l * v.nx + j]
      expect(z).toBeCloseTo(v.H[j], 6)
    }
    expect(Math.abs(v.balance.sand.relError)).toBeLessThan(1e-9)
    expect(Math.abs(v.balance.mud.relError)).toBeLessThan(1e-9)
    expect(v.hash).toBeUndefined()
    expect(tm.seek(tm.root, 150, ['thick'], true).hash).toMatch(/^[0-9a-f]{16}$/)
  })
})
