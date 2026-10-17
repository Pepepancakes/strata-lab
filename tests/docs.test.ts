// Registry-vs-doc check (M1.8): docs/physics-references.md must have a line for every parameter
// key and every reference id in the registry, with the same status (cited / tuned / to verify)
// and the same reference id. If you change src/engine/params.ts or references.ts, this fails
// until the index block in the doc is rewritten. To rewrite it:
//   STRATA_WRITE_DOCS=1 npm run test:run -- docs
// Then review the diff, and add the prose (range, note) above it if the new entry needs it.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PARAMS } from '../src/engine/params'
import { PRESETS } from '../src/engine/presets'
import { REFERENCES } from '../src/engine/references'
import { MODES } from '../src/views/section/colors'

const DOC = 'docs/physics-references.md'
const START = '<!-- registry-index:start -->'
const END = '<!-- registry-index:end -->'

const read = (): string => readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n')

/** The index the registry implies, one line per reference and per parameter. */
function expectedIndex(): string {
  const refs = REFERENCES.map((r) => {
    const flags = [r.toVerify ? 'to verify' : null, r.dataset ? `data: ${r.dataset.file}` : null].filter(Boolean)
    return `- \`${r.id}\`: ${r.short}${flags.length ? ` (${flags.join('; ')})` : ''}`
  })
  const params = PARAMS.map((p) => {
    const ref = p.source.refId ? `, ${p.source.refId}` : ''
    return `- \`${p.key}\`: ${p.source.kind}${ref}`
  })
  return [
    START,
    '### Registry index',
    'Generated from `src/engine/references.ts` and `src/engine/params.ts` and checked by',
    '`tests/docs.test.ts`. Rewrite with `STRATA_WRITE_DOCS=1 npm run test:run -- docs`.',
    '',
    `References (${refs.length}):`,
    ...refs,
    '',
    `Parameters (${params.length}), as \`key\`: status, reference id:`,
    ...params,
    END,
  ].join('\n')
}

function currentIndex(text: string): string | null {
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  return a < 0 || b < 0 ? null : text.slice(a, b + END.length)
}

describe('docs/physics-references.md matches the registry', () => {
  if (process.env.STRATA_WRITE_DOCS === '1') {
    it('rewrites the index block', () => {
      const text = read()
      const cur = currentIndex(text)
      if (!cur) throw new Error(`Add ${START} and ${END} to ${DOC} first.`)
      writeFileSync(DOC, text.replace(cur, expectedIndex()))
    })
  }

  it('has an index block with a line for every parameter and every reference', () => {
    const cur = currentIndex(read())
    expect(cur, 'registry index block missing').not.toBeNull()
    expect(cur).toBe(expectedIndex())
  })

  it('lists no parameter or reference twice', () => {
    expect(new Set(PARAMS.map((p) => p.key)).size).toBe(PARAMS.length)
    expect(new Set(REFERENCES.map((r) => r.id)).size).toBe(REFERENCES.length)
  })

  it('every cited parameter names a reference that exists', () => {
    const ids = new Set(REFERENCES.map((r) => r.id))
    for (const p of PARAMS) {
      if (p.source.kind === 'cited') expect(p.source.refId, p.key).toBeDefined()
      if (p.source.refId) expect(ids.has(p.source.refId), `${p.key} -> ${p.source.refId}`).toBe(true)
    }
  })

  it('the prose cites every reference (first author and year)', () => {
    const prose = read().split(START)[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/æ/g, 'ae').toLowerCase()
    for (const r of REFERENCES) {
      const author = r.short.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[ ,&(]/)[0].toLowerCase()
      expect(prose, `${r.id}: first author "${author}" not in the prose`).toContain(author)
      const year = /\((\d{4})\)/.exec(r.short)?.[1]
      if (year) expect(prose, `${r.id}: year ${year} not in the prose`).toContain(year)
 }
 })
 })

 // ---- the user guide uses the labels the app shows ------------------------------------------------
 // Controls are named in bold in docs/user-guide.md. This fails when a label in the guide no longer
 // exists in the app, or when a control the app shows is missing from the guide.

 const GUIDE = 'docs/user-guide.md'

 function sourceText(dir: string): string {
 let out = ''
 for (const name of readdirSync(dir)) {
 const f = join(dir, name)
 if (statSync(f).isDirectory()) out += sourceText(f)
 else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) out += readFileSync(f, 'utf8') + '\n'
 }
 return out
 }

 // Set by the scenario controls, so there is no box with this registry label.
 const NOT_A_BOX = ['dtRec']
 // Text written in the app's own source (buttons, headings, panel rows, status lines, check names).
 const APP_STRINGS = [
 'Scenario preset', 'Run length', 'Time steps:', 'Find a parameter', 'Find a parameter (e.g. salt, viscosity)', 'Clear search', 'Sediment supply', 'Sea level', 'Subsidence', 'Salt', 'Slope failure (MTDs)', 'Transport and turbidity currents', 'Compaction and pore pressure', 'Temperature', 'Grid and numerical settings', 'Salt layer on', 'Cover resists bending', 'No parameter matches', 'changed from preset', 'Welds and heat', 'Flow and cover', 'Starting salt', 'Branch from here', 'compare with active',
 'Delete', 'Main run', 'Play', 'Pause', 'Back', 'Forward', 'Start', 'Present', 'Run checks', 'Save', 'Open', 'New', 'Reset',
 'Save first', 'Replace', 'Cancel', 'Engine worker:', 'ALL PASS', 'Pseudo-well', 'Mass balance', 'Speed', 'Physics checks',
 'Sea level through time', 'Subsidence rate through time', 'All sediment', 'Sand only', 'Quartz cement', 'Run time',
 'Last jump (worker)', 'Draw time', 'Changes not saved to a file (kept in this browser)', 'Ma (million years ago)',
 'Pressure, ppg EMW', 'Porosity', 'Temperature, \u00b0F', 'Grain size', 'Published curve', 'Sine (teaching)',
 'Rewind is bit-identical', 'Consolidation vs Gibson (1958)', 'Mass balance, sand only', 'Mass balance, mud only',
 ' porosity at 2 km vs Sclater & Christie (1980)', 'Drained ',
 'Infinite-slope FS', 'FS crosses 1 at', 'Bingham plug thickness', 'Mass balance through a slope failure',
 'Salt channel-flow decay', 'Cover bending: fastest-growing wavelength', 'Mass balance, salt only',
 'Planned well', 'Plan a well here', 'Remove well', 'Surface location', 'Well shape', 'Total depth', 'Air gap', 'Kickoff depth', 'Build rate', 'Hold angle', 'Direction', 'Fracture-gradient method', 'Compare branches',
 'supplied', 'stored', 'exported', 'imbalance', 'frames per second', 'steps per frame',
 ]

 describe('docs/user-guide.md matches the app', () => {
 const guide = readFileSync(GUIDE, 'utf8').replace(/\r\n/g, '\n').replace(/\*\*/g, '').replace(/\s+/g, ' ')
 const src = sourceText('src').replace(/\s+/g, ' ')
 const labelOf = (p: (typeof PARAMS)[number]) => (p.key === 'duration' ? 'Run length' : p.label)

 it('names every control the app shows, with the exact label', () => {
 for (const p of PARAMS) {
 if (NOT_A_BOX.includes(p.key)) continue
 expect(guide, `control "${labelOf(p)}" is not in the guide`).toContain(labelOf(p))
 }
 })

 it('names every colour mode and every preset with the exact label', () => {
 for (const m of MODES) expect(guide, m.label).toContain(m.label)
 for (const p of PRESETS) {
 const name = p.label.replace(' (default)', '')
 expect(guide, name).toContain(name)
 }
 })

 it('uses button, panel and heading text that the app source really contains', () => {
 for (const s of APP_STRINGS) {
 expect(guide, `"${s}" is not in the guide`).toContain(s)
 expect(src.includes(s), `"${s}" is not in the app source (renamed?)`).toBe(true)
 }
 })

 it('every bold label that starts a table row exists in the registry or the app strings', () => {
 const raw = readFileSync(GUIDE, 'utf8').replace(/\r\n/g, '\n')
 const known = [...PARAMS.map(labelOf), ...MODES.map((m) => m.label), ...APP_STRINGS, ...PRESETS.map((p) => p.label)]
 for (const m of raw.matchAll(/^\| \*\*([^*]+)\*\*/gm)) {
 const text = m[1].replace(/\s+/g, ' ').trim()
 expect(known.some((k) => text.startsWith(k) || k.startsWith(text)), `bold label "${text}" matches no app label`).toBe(true)
 }
 })
 })
