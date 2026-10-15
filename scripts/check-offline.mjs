// Fails if dist/strata-lab.html could reach the network. Prints "0 external hosts" on success.
import { readFileSync, existsSync, readdirSync } from 'node:fs'

const FILE = 'dist/strata-lab.html'
if (!existsSync(FILE)) {
  console.error(`${FILE} not found. Run npm run build first.`)
  process.exit(1)
}
const html = readFileSync(FILE, 'utf8')

// Inert strings: URLs that appear as text/namespaces but are never fetched.
const ALLOW = [
  'http://www.w3.org/', // XML / SVG / MathML / XHTML namespace identifiers
  'https://react.dev/', // error-message doc links inside React (text only)
  'https://reactjs.org/', // older doc links inside React (text only)
  'https://github.com/facebook/react', // comment/links inside React (text only)
  // Provenance strings of the bundled sea-level curves (src/engine/sealevel data): shown as
  // citations, never fetched. They entered the bundle when the engine moved into the worker (M1.5).
  'https://doi.org/10.25921/revb-da37',
  'https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/bintanja2008/',
  'https://doi.org/10.1594/PANGAEA.923139',
  'https://doi.pangaea.de/10.1594/PANGAEA.923139',
]

const urls = [...new Set(html.match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? [])]
const bad = urls.filter((u) => !ALLOW.some((a) => u.startsWith(a)))

// Cheap detection of network calls to a literal URL.
const calls =
  html.match(/\b(?:fetch|XMLHttpRequest\.open|importScripts|new WebSocket|new EventSource)\s*\(\s*["'`]https?:/g) ?? []
// External resource tags (src/href pointing to http(s) or protocol-relative).
const tags = html.match(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["'](?:https?:)?\/\/[^"']*/g) ?? []

// The Web Worker must be inlined: no separate files next to the html.
const extra = readdirSync('dist').filter((f) => f !== 'strata-lab.html')

if (bad.length || calls.length || tags.length || extra.length) {
  for (const f of extra) console.error(`unexpected file in dist/ (worker not inlined?): ${f}`)
  for (const u of bad) console.error(`external URL: ${u}`)
  for (const c of calls) console.error(`network call: ${c}`)
  for (const t of tags) console.error(`external resource tag: ${t}`)
  process.exit(1)
}
console.log(`${urls.length} URL strings, all allowlisted and inert`)
console.log('0 external hosts')
