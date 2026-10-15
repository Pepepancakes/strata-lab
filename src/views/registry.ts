// View registry. Each view lives in src/views/<name>/index.ts(x) and default-exports a
// ViewDefinition. They are discovered by glob, so a new view card adds a folder and does not
// edit this file or any switch.
import type { Region, ViewDefinition } from './types'

export function collectViews(modules: Record<string, { default: ViewDefinition }>): ViewDefinition[] {
  const views = Object.keys(modules)
    .sort() // fixed order regardless of glob order
    .map((k) => modules[k].default)
  const seen = new Set<string>()
  for (const v of views) {
    if (seen.has(v.id)) throw new Error(`duplicate view id: ${v.id}`)
    seen.add(v.id)
  }
  return views
}

export function viewsForRegion(views: ViewDefinition[], region: Region): ViewDefinition[] {
  return views.filter((v) => v.region === region).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export const allViews: ViewDefinition[] = collectViews(
  import.meta.glob<{ default: ViewDefinition }>('./*/index.{ts,tsx}', { eager: true }),
)
