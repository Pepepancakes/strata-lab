import { describe, it, expect } from 'vitest'
import { handleRequest } from '../src/worker/handler'

describe('worker checks and handler', () => {
  it('runChecks reports every benchmark with a measured value and passes', () => {
    const r = handleRequest({ id: 1, kind: 'runChecks' })
    if (r.kind !== 'checks') throw new Error(JSON.stringify(r))
    expect(r.results.length).toBeGreaterThanOrEqual(8)
    for (const c of r.results) expect(c.pass, `${c.id}: ${c.value} vs ${c.limit}`).toBe(true)
    expect(r.allPass).toBe(true)
  }, 60000)

  it('requests before a run give a plain error; run then seek works with progress', () => {
    const e = handleRequest({ id: 2, kind: 'seek', branchId: 'b1', step: 1 })
    expect(e.kind === 'error' && e.message).toMatch(/Start a run first/)
    const seen: number[] = []
    const run = handleRequest(
      { id: 3, kind: 'run', seed: 1, spec: { presetId: 'last3', segments: [{ fromAgeMa: 0.5, toAgeMa: 0, dt: 10000 }], overrides: { nx: 40, dx: 3750 } } },
      (m) => { if (m.kind === 'progress') seen.push(m.step) },
    )
    expect(run.kind).toBe('runDone')
    expect(seen.length).toBeGreaterThan(1)
    expect(seen[seen.length - 1]).toBe(50)
    const v = handleRequest({ id: 4, kind: 'seek', branchId: 'b1', step: 25 })
    expect(v.kind === 'view' && v.view.step).toBe(25)
    const br = handleRequest({ id: 5, kind: 'branch', parentId: 'b1', step: 25, edits: { slShift: -30 } })
    expect(br.kind).toBe('branched')
    const bad = handleRequest({ id: 6, kind: 'branch', parentId: 'b1', step: 25, edits: { nx: 5 } })
    expect(bad.kind).toBe('error')
  })
})
