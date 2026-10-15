// Dev-time only. Downloads the two published sea-level records and writes the small JSON files
// that the app bundles. NOT run by the build, CI or the app (the app makes no network requests).
//
// Run it by hand when you want to refresh the data:   node scripts/fetch-sealevel.mjs
// It needs network access and Node 18+ (global fetch). It overwrites:
//   src/engine/data/sealevel-bintanja2008.json   (0 to 3 Ma, high resolution)
//   src/engine/data/sealevel-miller2020.json     (about 1 to 64.8 Ma, 20 kyr, smoothed)
//
// Sources and licences (read on the archive pages, accessed 2026-10-14):
//   Bintanja & van de Wal (2008), Nature 454, 869-872, doi:10.1038/nature07158
//     NOAA NCEI study noaa-recon-11933, doi:10.25921/revb-da37, licence CC0 1.0 (NOAA metadata).
//     Column 9 (labelled "Global sea level relative to present (m)"), time in column 1 (kyr BP).
//     SIGN TRAP: despite its label, column 9 is ice volume as sea-level equivalent: it is about
//     +123 m at the Last Glacial Maximum (21 ka), when the sea stood about 120 m LOWER. Sea level
//     is therefore -column 9, and that is what is stored. The model's value for age 0 is
//     -1.459 m rather than 0; it is kept as published (no re-baselining).
//   Miller et al. (2020), Science Advances 6(20) eaaz1346, doi:10.1126/sciadv.aaz1346
//     PANGAEA doi:10.1594/PANGAEA.923139, licence CC-BY 4.0.
//     Column "Sea lev rel [m]", age in ka BP. (Only the PANGAEA data set, which carries its own
//     CC-BY 4.0 licence, is bundled; the paper's terms were not checked.)
//
// Downsampling (only because the full Bintanja file would be about 450 KB, limit 200 KB):
//   keep every 3rd row of the 100-yr series, i.e. one value per 300 yr. Values are the original
//   rows, not averages, so every kept row can be checked against the raw file.
//   Miller 2020 is already 20 kyr spacing and is kept whole.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/engine/data/', import.meta.url))
const BW_URL = 'https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/bintanja2008/bintanja2008.txt'
const MILLER_URL = 'https://doi.pangaea.de/10.1594/PANGAEA.923139?format=textfile'
const ACCESSED = '2026-10-14'
const KEEP_EVERY = 3

async function get(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.text()
}

function numbers(line) {
  return line.trim().split(/\s+/).map(Number)
}

function bintanja(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^\s*Time\s+Iso_tot/.test(l))
  if (start < 0) throw new Error('Bintanja: header line not found')
  const rows = []
  for (const l of lines.slice(start + 1)) {
    if (!l.trim()) continue
    const c = numbers(l)
    if (c.length !== 9 || c.some((v) => !Number.isFinite(v))) continue
    // time is in kyr and carries rounding noise (0.39990); snap to the nearest 100 yr
    rows.push([Math.round(c[0] * 10) * 100, 0 - c[8]])
  }
  const kept = rows.filter((_, i) => i % KEEP_EVERY === 0)
  return { rawRows: rows.length, kept }
}

function miller(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith('Age [ka BP]'))
  if (start < 0) throw new Error('Miller: header line not found')
  const kept = []
  for (const l of lines.slice(start + 1)) {
    if (!l.trim()) continue
    const c = l.split('\t').map(Number)
    if (c.length !== 2 || c.some((v) => !Number.isFinite(v))) continue
    kept.push([Math.round(c[0] * 1000), c[1]])
  }
  return { rawRows: kept.length, kept }
}

function write(id, meta, kept) {
  for (let i = 1; i < kept.length; i++) if (!(kept[i][0] > kept[i - 1][0])) throw new Error(`${id}: ages not increasing at row ${i}`)
  const doc = { id, ...meta, accessed: ACCESSED, ageYr: kept.map((r) => r[0]), seaLevelM: kept.map((r) => r[1]) }
  mkdirSync(OUT, { recursive: true })
  const file = `${OUT}sealevel-${id}.json`
  writeFileSync(file, JSON.stringify(doc))
  console.log(`${file}: ${kept.length} rows, age ${kept[0][0]} to ${kept[kept.length - 1][0]} yr`)
}

const bw = bintanja(await get(BW_URL))
write('bintanja2008', {
  citation: 'Bintanja & van de Wal (2008), Nature 454, 869-872, doi:10.1038/nature07158',
  archive: 'https://doi.org/10.25921/revb-da37',
  file: BW_URL,
  licence: 'CC0 1.0',
  column: '9, sign reversed: sea level (m) = -(ice volume as sea-level equivalent relative to present)',
  rawRows: bw.rawRows,
  note: `every ${KEEP_EVERY}rd row of the 100 yr series kept (300 yr)`,
}, bw.kept)

const mi = miller(await get(MILLER_URL))
write('miller2020', {
  citation: 'Miller et al. (2020), Science Advances 6(20) eaaz1346, doi:10.1126/sciadv.aaz1346',
  archive: 'https://doi.org/10.1594/PANGAEA.923139',
  file: MILLER_URL,
  licence: 'CC-BY 4.0',
  column: 'Sea lev rel [m] (smoothed, relative to present day)',
  rawRows: mi.rawRows,
  note: 'all rows kept (20 kyr)',
}, mi.kept)
