import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { PARAMS, defaultParams, getParamDef, branchEditableKeys } from '../src/engine/params'
import { REFERENCES, getReference } from '../src/engine/references'
import { sineSeaLevel } from '../src/engine/sealevel'

const require = createRequire(import.meta.url)
// read-only reference implementation; never imported by src/
const spike = require('../spikes/001-shelf-to-basin/engine.js')

// M1.4c additions: the spike had none of these
const M14C = ['subsMode', 'subsTau', 'subsHistory', 'thermal', 'thermalEvery', 'heatFlow', 'kGrain', 'kWater', 'tSeaDeep', 'tSeaShallow', 'tSeaScale', 'cement', 'cemA', 'cemB', 'cemTonset', 'cemGrain', 'cemSurf', 'phiFric', 'cohesion', 'stabMaxDepth']

describe('parameter registry', () => {
  it('has an entry for every spike engine parameter, and no extras', () => {
    const spikeKeys = Object.keys(spike.defaultParams()).sort()
    // seaLevelKind (M1.4) and the bundling switches (M1.4b) are new; the spike had neither
    expect(PARAMS.map((p) => p.key).filter((k) => !['seaLevelKind', 'bundleEvery', 'bundleAgeYr', ...M14C].includes(k)).sort()).toEqual(spikeKeys)
  })
  it('defaults equal the spike defaults exactly', () => {
    const d = defaultParams() as unknown as Record<string, unknown>
    const { seaLevelKind, bundleEvery, bundleAgeYr } = d
    const rest = Object.fromEntries(Object.entries(d).filter(([k]) => !['seaLevelKind', 'bundleEvery', 'bundleAgeYr', ...M14C].includes(k)))
    expect(d.subsMode).toBe('constant') // M1.4c: changing subsidence, temperature and cement are all off by default
    expect(d.thermal).toBe(0)
    expect(d.cement).toBe(0)
    expect(seaLevelKind).toBe('curve')
    expect(bundleEvery).toBe(1) // off by default, so the default run stays bit-identical to M1.4
    expect(bundleAgeYr).toBe(500000)
    expect(rest).toEqual(spike.defaultParams())
  })
  it('returns fresh copies of defaults', () => {
    const a = defaultParams()
    ;(a.Kc as number[])[0] = -1
    expect(defaultParams().Kc).toEqual([5.0e4, 1.0e5])
  })
  it('every cited refId resolves, and so does any other refId', () => {
    for (const p of PARAMS) {
      if (p.source.kind === 'cited') expect(p.source.refId, p.key).toBeTruthy()
      if (p.source.refId) expect(getReference(p.source.refId), `${p.key} -> ${p.source.refId}`).toBeDefined()
    }
  })
  it('reference ids are unique', () => {
    expect(new Set(REFERENCES.map((r) => r.id)).size).toBe(REFERENCES.length)
  })
  it('flags the tuned parameters named in physics-references', () => {
    for (const k of ['supply', 'Kg', 'Kc', 'Km', 'dm', 'kA', 'kB', 'kMudMult']) {
      expect(getParamDef(k)?.source.kind, k).toBe('tuned')
    }
  })
  it('keeps defaults inside min/max and array shapes consistent', () => {
    for (const p of PARAMS) {
      if (p.default === null || typeof p.default === 'string') continue
      const d = Array.isArray(p.default) ? p.default : [p.default]
      const lo = Array.isArray(p.min) ? p.min : [p.min as number]
      const hi = Array.isArray(p.max) ? p.max : [p.max as number]
      expect(lo.length, p.key).toBe(d.length)
      expect(hi.length, p.key).toBe(d.length)
      d.forEach((v, i) => {
        expect(v, p.key).toBeGreaterThanOrEqual(lo[i])
        expect(v, p.key).toBeLessThanOrEqual(hi[i])
      })
      if (Array.isArray(p.default)) expect(p.components, p.key).toHaveLength(p.default.length)
    }
  })
  it('lets branches change boundary conditions but not grid, time or stored-layer constants', () => {
    const editable = branchEditableKeys()
    expect(editable).toContain('supply')
    for (const k of ['nx', 'dx', 'duration', 'dtRec', 'phi0', 'beta']) expect(editable).not.toContain(k)
  })
})

describe('sea level', () => {
  it('sine matches the spike exactly', () => {
    const P = { ...spike.defaultParams(), slAmp: 33, slPeriod: 70000, slShift: -5 }
    const curve = sineSeaLevel(P)
    for (const t of [0, 1234.5, 17500, 5e5, 66e6]) expect(curve(t)).toBe(spike.seaLevel(P, t))
  })
})
