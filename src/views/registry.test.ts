import { describe, it, expect } from 'vitest'
import { collectViews, viewsForRegion, allViews } from './registry'
import type { ViewDefinition } from './types'

const C = () => null
const mk = (id: string, region: ViewDefinition['region'], order: number): ViewDefinition => ({ id, title: id, region, order, component: C })

describe('view registry', () => {
  it('sorts by order within a region and filters by region', () => {
    const views = collectViews({
      './b/index.ts': { default: mk('b', 'section', 2) },
      './a/index.ts': { default: mk('a', 'section', 1) },
      './c/index.ts': { default: mk('c', 'right', 0) },
    })
    expect(viewsForRegion(views, 'section').map((v) => v.id)).toEqual(['a', 'b'])
    expect(viewsForRegion(views, 'right').map((v) => v.id)).toEqual(['c'])
    expect(viewsForRegion(views, 'well')).toEqual([])
  })
  it('rejects duplicate ids', () => {
    expect(() =>
      collectViews({ './a/index.ts': { default: mk('x', 'right', 0) }, './b/index.ts': { default: mk('x', 'well', 0) } }),
    ).toThrow(/duplicate/)
  })
  it('discovers real views by glob (engine-status)', () => {
    expect(allViews.map((v) => v.id)).toContain('engine-status')
  })
})
