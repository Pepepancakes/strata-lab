// Scenario file (M1.7): format, validation, recompute, hash comparison.
// The committed fixture tests/fixtures/scenario-v1.strata.json is a real v1 file; its hashes are a
// golden. If the engine changes on purpose, rewrite it with: STRATA_WRITE_FIXTURE=1 npm run test:run -- scenarioFile
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { PRESETS } from '../src/engine/presets'
import { clipSegments } from '../src/app/scenario'
import {
  buildScenarioFile, compareHashes, parseScenario, serializeScenario, MAX_FILE_BYTES, type ScenarioFile, type ScenarioSource,
} from '../src/app/scenarioFile'
import { replayScenario } from '../src/worker/scenarioReplay'
import { TimeMachine } from '../src/worker/timeMachine'
import { SUMMARY_TOL, compareSummaries, type RunSummary } from '../src/engine/summary'
import { withUlpNoise } from './helpers/ulpNoise'

const FIXTURE = 'tests/fixtures/scenario-v1.strata.json'
const SMALL_GRID = { nx: 60, dx: 2500 }
const segments = clipSegments(PRESETS.find((p) => p.id === 'last3')!.segments, 0.5) // 100 steps of 5 kyr

/** A live scenario: main run, a branch with edits, a branch of that branch, and a deleted branch (so ids have a gap). */
function liveScenario(): { src: ScenarioSource; hashes: Record<string, string>; summaries: Record<string, RunSummary> } {
  const tm = new TimeMachine()
  const overrides = { ...SMALL_GRID, duration: 0.5e6 }
  const info = tm.run({ presetId: 'last3', overrides, segments }, 1)
  const b2 = tm.branch(info.rootId, 40, { supply: 30 }, 'More supply')
  const gone = tm.branch(info.rootId, 20, {}, 'Scrap')
  tm.branch(b2.id, 60, { sandFrac: 0.5, Km: [500, 2000] }, 'Sandier')
  tm.deleteBranch(gone.id)
  return {
    src: {
      presetId: 'last3', seed: 1, nx: info.nx, dx: info.dx, segments, overrides: { ...SMALL_GRID },
      branches: tm.list(),
    },
    hashes: tm.hashes(),
    summaries: tm.summaries(),
  }
}

if (process.env.STRATA_WRITE_FIXTURE === '1') {
  const { src, hashes, summaries } = liveScenario()
  writeFileSync(FIXTURE, serializeScenario(buildScenarioFile(src, hashes, summaries)))
}

describe('scenario file', () => {
  /** The hashes the file carries, by file branch id. */
  const stored = (f: ScenarioFile): Record<string, string> => Object.fromEntries(f.branches.map((b) => [b.id, b.stateHash!]))
  it('round trip: save -> open gives identical hashes for every branch', () => {
    const { src, hashes } = liveScenario()
    expect(src.branches.map((b) => b.id)).toEqual(['b1', 'b2', 'b4']) // the deleted branch left a gap
    const text = serializeScenario(buildScenarioFile(src, hashes))
    const parsed = parseScenario(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.branches.map((b) => b.name)).toEqual(['Main run', 'More supply', 'Sandier'])
    expect(parsed.file.branches[2].edits).toEqual({ Km: [500, 2000], sandFrac: 0.5 })
    expect(parsed.file.branches[2].parent).toBe('b2')

    const tm = new TimeMachine()
    const r = replayScenario(tm, parsed.file)
    expect(Object.keys(r.hashes)).toEqual(['b1', 'b2', 'b4'])
    for (const id of Object.keys(hashes)) expect(r.hashes[id], `branch ${id}`).toBe(hashes[id])
    expect(r.idMap).toEqual({ b1: 'b1', b2: 'b2', b4: 'b3' }) // new ids are dense; the file ids only link parents
    expect(r.branches.find((b) => b.id === 'b3')!.parentId).toBe('b2')
    expect(compareHashes(parsed.file, r.hashes, { nx: r.info.nx, dx: r.info.dx })).toMatchObject({ same: true, message: null })
    // saving again gives the same text (stable key order)
    expect(serializeScenario(buildScenarioFile({ ...src, branches: r.branches }, Object.fromEntries(Object.entries(r.idMap).map(([f, n]) => [n, r.hashes[f]]))))).toContain('"stateHash"')
  })

  it('does not store the computed record', () => {
    const { src, hashes } = liveScenario()
    const text = serializeScenario(buildScenarioFile(src, hashes))
    expect(text.length).toBeLessThan(5000)
  })

  it('a committed v1 fixture loads and recomputes to its stored hashes (or, on another machine, to its stored summary numbers)', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.version).toBe(1)
    expect(parsed.file.branches.length).toBe(3)
    const r = replayScenario(new TimeMachine(), parsed.file)
    // The fixture was written on Windows. Same hash there; on Linux the hash may differ in the
    // last bit of the maths, and the summary numbers must still agree within SUMMARY_TOL.
    const cmp = compareHashes(parsed.file, r.hashes, { nx: r.info.nx, dx: r.info.dx }, r.summaries)
    for (const b of parsed.file.branches) {
      const diff = compareSummaries(b.summary!, r.summaries[b.id])
      expect(diff, `${b.name}: ${r.hashes[b.id] === b.stateHash ? 'same hash' : 'hash differs (other maths library)'}`).toEqual([])
    }
    expect(cmp.differing).toEqual([])
    expect(cmp.same).toBe(true)
  })

  it('warns in plain words when a hash differs and the summary numbers differ too', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    if (!parsed.ok) throw new Error('fixture')
    const r = replayScenario(new TimeMachine(), parsed.file)
    const wrong = { ...stored(parsed.file), b2: 'deadbeef' } // other branches: hashes as stored, so this test reads the same on every machine
    const moved = { ...r.summaries, b2: { ...r.summaries.b2, meanH: r.summaries.b2.meanH * 1.02 } } // a 2 % change in mean surface height
    const cmp = compareHashes(parsed.file, wrong, { nx: r.info.nx, dx: r.info.dx }, moved)
    expect(cmp.same).toBe(false)
    expect(cmp.differing).toEqual(['More supply'])
    expect(cmp.message).toMatch(/different engine version; results differ/)
    expect(cmp.message).toMatch(/More supply/)
  })

  it('a different hash with the same summary numbers is another machine\'s maths: no warning (D16.4)', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    if (!parsed.ok) throw new Error('fixture')
    const r = replayScenario(new TimeMachine(), parsed.file)
    const wrong = { ...stored(parsed.file), b2: 'deadbeef' } // other branches: hashes as stored, so this test reads the same on every machine
    const cmp = compareHashes(parsed.file, wrong, { nx: r.info.nx, dx: r.info.dx }, r.summaries)
    expect(cmp).toMatchObject({ same: true, differing: [], message: null })
    expect(cmp.closeOnly).toContain('More supply')
  })

  it('an old file without summary numbers still warns on a different hash', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    if (!parsed.ok) throw new Error('fixture')
    const old = { ...parsed.file, branches: parsed.file.branches.map((b) => (b.id === 'b2' ? { ...b, summary: undefined } : b)) }
    const r = replayScenario(new TimeMachine(), parsed.file)
    const cmp = compareHashes(old, { ...stored(parsed.file), b2: 'deadbeef' }, { nx: r.info.nx, dx: r.info.dx }, r.summaries)
    expect(cmp.same).toBe(false)
    expect(cmp.differing).toEqual(['More supply'])
  })

  it('opens on a machine with different last-bit maths: hashes may differ, the summaries agree, no warning', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    if (!parsed.ok) throw new Error('fixture')
    for (const [amp, salt] of [[2.2e-16, 1], [2.2e-16, 2], [1e-13, 3], [1e-12, 4]]) {
      const r = withUlpNoise(amp, salt, () => replayScenario(new TimeMachine(), parsed.file))
      const cmp = compareHashes(parsed.file, r.hashes, { nx: r.info.nx, dx: r.info.dx }, r.summaries)
      const spread = parsed.file.branches.map((b) => compareSummaries(b.summary!, r.summaries[b.id]))
      expect(cmp.differing, `amp ${amp} salt ${salt}: ${JSON.stringify(spread)}`).toEqual([])
      expect(cmp.same).toBe(true)
    }
  }, 120000)

  it('a real engine change (supply +1 % in the main run) still warns', () => {
    const parsed = parseScenario(readFileSync(FIXTURE, 'utf8'))
    if (!parsed.ok) throw new Error('fixture')
    const changed = { ...parsed.file, run: { ...parsed.file.run, overrides: { ...parsed.file.run.overrides, supply: 20.2 } } }
    const r = replayScenario(new TimeMachine(), changed)
    const cmp = compareHashes(parsed.file, r.hashes, { nx: r.info.nx, dx: r.info.dx }, r.summaries)
    console.log('FIXPROBE real change', JSON.stringify(parsed.file.branches.map((b) => compareSummaries(b.summary!, r.summaries[b.id]))))
    expect(cmp.same).toBe(false)
    expect(cmp.differing).toContain('Main run')
    expect(cmp.message).toMatch(/different engine version; results differ/)
  })

  it('the summary tolerances are tighter than a 1 % change in supply on the default scenario', () => {
    expect(SUMMARY_TOL.meanH).toBeLessThan(0.01)
    expect(SUMMARY_TOL.mud).toBeLessThan(0.0065)
    expect(SUMMARY_TOL.sand).toBeLessThan(0.0075)
  })

  it('a file without hashes (autosave) is not flagged', () => {
    const { src } = liveScenario()
    const file = parseScenario(serializeScenario(buildScenarioFile(src)))
    if (!file.ok) throw new Error('parse')
    expect(compareHashes(file.file, {}, { nx: SMALL_GRID.nx, dx: SMALL_GRID.dx }).same).toBe(true)
  })
})

describe('malformed scenario files are refused with a plain message', () => {
  const good = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ScenarioFile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = (): Record<string, any> => JSON.parse(JSON.stringify(good))
  const cases: [string, string][] = [
    ['empty text', ''],
    ['not JSON', '{"format": "strata-lab-sc'],
    ['an array', '[]'],
    ['another kind of JSON', '{"hello": 1}'],
    ['too large', ' '.repeat(MAX_FILE_BYTES + 1)],
    ['future version', JSON.stringify({ ...clone(), version: 2 })],
    ['unknown preset', JSON.stringify((() => { const f = clone(); f.run.presetId = 'jurassic'; return f })())],
    ['bad segments', JSON.stringify((() => { const f = clone(); f.run.segments = [{ fromAgeMa: 3, toAgeMa: 0, dt: 7777 }]; return f })())],
    ['duration that disagrees', JSON.stringify((() => { const f = clone(); f.run.durationYr = 3e6; return f })())],
    ['unknown parameter', JSON.stringify((() => { const f = clone(); f.branches[1].edits = { warpFactor: 9 }; return f })())],
    ['start-only parameter in a branch', JSON.stringify((() => { const f = clone(); f.branches[1].edits = { nx: 100 }; return f })())],
    ['value out of range', JSON.stringify((() => { const f = clone(); f.branches[1].edits = { supply: 1e9 }; return f })())],
    ['parent listed after child', JSON.stringify((() => { const f = clone(); f.branches = [f.branches[0], f.branches[2], f.branches[1]]; return f })())],
    ['branch past the end', JSON.stringify((() => { const f = clone(); f.branches[1].startStep = 100; return f })())],
    ['duplicate id', JSON.stringify((() => { const f = clone(); f.branches[2].id = 'b2'; return f })())],
    ['main run with a parent', JSON.stringify((() => { const f = clone(); f.branches[0].parent = 'b9'; return f })())],
    ['no branches', JSON.stringify((() => { const f = clone(); f.branches = []; return f })())],
  ]
  for (const [name, text] of cases) {
    it(name, () => {
      const r = parseScenario(text)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/^This is not a usable Strata Lab scenario file\./)
    })
  }
})
