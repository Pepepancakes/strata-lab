#!/usr/bin/env node
// Parameter lineage trace (LIN-1, D29). Research script only: never imported by the app or the build,
// and the app makes no network request. Method borrowed from the open-source tool Sediment
// (github.com/shresthkapoor7/sediment): concept -> seed paper -> reference walk, every link labelled
// "verified" (the citing paper's OpenAlex reference list contains the cited paper) or "inferred"
// (believed, not in the data). No code was taken from Sediment.
//
// A verified edge shows a reference relationship, NOT that a value was taken from that paper.
// OpenAlex gives titles, authors, years, DOIs, reference lists and abstracts. It does not give the
// paper: a value, equation or page may be quoted only from a paper whose full text was read.
//
// Usage (Node 22 or later, built-in fetch, no dependencies):
//   node scripts/lineage/openalex-trace.mjs --param perm-mud \
//        --query "mudstone permeability porosity relationship" \
//        [--seed W2025334488 | --seed 10.1016/j.marpetgeo.2010.07.005] \
//        [--ancestors W1,W2,W3,W4,W5]      up to five; their own references are fetched (one level down)
//        [--inferred W1>W2,W3>W4]          links you believe in but the data does not contain
//        [--read W1=full,W2=abstract]      what was read: full | abstract | none (default none)
//        [--max-refs 60] [--top2 15] [--out docs/lineage/<param>.json] [--keep-abstracts]
//        [--extra file.json]               {papers:[], edges:[]} for papers read from the project's notes that
//                                          OpenAlex lacks; their edges are always written as "inferred"
//        [--search-only]                   print the search candidates (title matches first) and stop
//
// Environment (all optional; the script runs with none set):
//   OPENALEX_MAILTO     added as &mailto= to requests (polite pool). Never write an address in a file.
//   LINEAGE_CACHE_DIR   response cache; default is a folder under the system temp directory (outside the repo).
//
// Politeness: at most 5 requests per second; every response is cached, so a rerun costs no requests.
// Output ordering is by year then OpenAlex id, so a rerun gives the same JSON apart from fetched_at.
// Abstracts are NOT written to the JSON by default (they are other people's text; paraphrase them in the
// doc). They are written next to the cache as abstracts-<param>.json for local reading.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const API = 'https://api.openalex.org';
const MIN_GAP_MS = 220; // under 5 requests per second
const SELECT = [
  'id', 'doi', 'display_name', 'publication_year', 'authorships', 'cited_by_count', 'open_access',
  'referenced_works', 'abstract_inverted_index', 'type', 'primary_location',
].join(',');

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (k === 'keep-abstracts' || k === 'search-only') { o[k] = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (!args.param || !args.query) {
  console.error('usage: node scripts/lineage/openalex-trace.mjs --param <slug> --query "<concept>" [--seed <id|doi>] [--ancestors W1,W2] [--inferred W1>W2] [--read W1=full] [--out file]');
  process.exit(2);
}
if (!/^[a-z0-9-]+$/.test(args.param)) { console.error('--param must be lower-case letters, digits, hyphens'); process.exit(2); }

const cacheDir = process.env.LINEAGE_CACHE_DIR || path.join(os.tmpdir(), 'strata-lineage-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const mailto = process.env.OPENALEX_MAILTO ? `&mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO)}` : '';
const outPath = args.out || path.join('docs', 'lineage', `${args.param}.json`);
const maxRefs = Number(args['max-refs'] ?? 60);
const top2 = Number(args.top2 ?? 15);

const shortId = (id) => (id ? String(id).replace(/^https?:\/\/openalex\.org\//, '') : id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
let networkCalls = 0;
let cacheHits = 0;

async function get(url) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const file = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(file)) { cacheHits++; return JSON.parse(fs.readFileSync(file, 'utf8')); }
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    networkCalls++;
    const res = await fetch(url + mailto);
    if (res.ok) {
      const body = await res.json();
      fs.writeFileSync(file, JSON.stringify(body));
      return body;
    }
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    throw new Error(`OpenAlex ${res.status} for ${url}`);
  }
  throw new Error(`OpenAlex gave up (rate limit or server error) for ${url}`);
}

function abstractText(inv) {
  if (!inv) return null;
  const words = [];
  for (const [w, pos] of Object.entries(inv)) for (const p of pos) words[p] = w;
  return words.filter((w) => w !== undefined).join(' ');
}

const abstracts = {}; // id -> text, written to the cache folder only
function compact(w) {
  const id = shortId(w.id);
  const abs = abstractText(w.abstract_inverted_index);
  if (abs) abstracts[id] = abs;
  const oa = w.open_access || {};
  return {
    id,
    title: w.display_name || null,
    authors: (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean),
    year: w.publication_year ?? null,
    venue: w.primary_location?.source?.display_name ?? null,
    doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null,
    type: w.type ?? null,
    cited_by_count: w.cited_by_count ?? 0,
    open_access: !!oa.is_oa,
    oa_url: oa.oa_url || null,
    has_abstract: !!abs,
    abstract: args['keep-abstracts'] ? abs : null,
    _refs: (w.referenced_works || []).map(shortId), // stripped before writing
  };
}

async function fetchWork(idOrDoi) {
  let ref = idOrDoi;
  if (/^10\./.test(ref)) ref = `doi:${ref}`;
  else if (/^https?:\/\/doi\.org\//.test(ref)) ref = `doi:${ref.replace(/^https?:\/\/doi\.org\//, '')}`;
  const w = await get(`${API}/works/${ref}?select=${SELECT}`);
  return compact(w);
}

async function fetchMany(ids) {
  // One request per work. Single-work lookups do not use up OpenAlex's daily list/search budget
  // (a batched filter=openalex:A|B|... list call does), so this is slower but cheaper.
  const out = [];
  for (const id of ids) {
    try {
      out.push(await fetchWork(id));
    } catch (e) {
      console.error(`skipped ${id}: ${e.message}`);
    }
  }
  return out;
}

async function search(q) {
  const sel = 'id,doi,display_name,publication_year,cited_by_count,open_access';
  const enc = encodeURIComponent(q);
  const byText = await get(`${API}/works?search=${enc}&per-page=10&select=${sel}`);
  const byTitle = await get(`${API}/works?filter=title.search:${enc}&per-page=10&select=${sel}`);
  const seen = new Set();
  const out = [];
  // Title matches first (D29 method), then title/abstract matches.
  for (const [src, list] of [['title', byTitle.results || []], ['title+abstract', byText.results || []]]) {
    for (const w of list) {
      const id = shortId(w.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id, title: w.display_name, year: w.publication_year,
        doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null,
        cited_by_count: w.cited_by_count ?? 0, found_by: src,
      });
    }
  }
  return out;
}

const byYearId = (a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

async function main() {
  let candidates = [];
  try {
    candidates = await search(args.query);
  } catch (e) {
    if (!args.seed || args['search-only']) throw e;
    console.error(`search failed (${e.message}); continuing with the given seed, candidates left empty`);
  }
  if (args['search-only']) {
    for (const c of candidates) console.log(`${c.id}\t${c.year}\t${c.found_by}\tc=${c.cited_by_count}\t${c.title}`);
    return;
  }
  let seedRef = args.seed;
  if (!seedRef) {
    if (!candidates.length) throw new Error('no search results and no --seed');
    seedRef = candidates[0].id; // top title match; pass --seed to choose another
    console.error(`no --seed given: using top candidate ${seedRef} (${candidates[0].title})`);
  }
  const seed = await fetchWork(seedRef);

  const papers = new Map();
  const edges = new Map();
  const addEdge = (from, to, kind) => {
    const k = `${from}>${to}`;
    if (!edges.has(k) || kind === 'verified') edges.set(k, { from, to, kind });
  };
  const refsOf = new Map(); // id -> reference ids (all, for cross-checks)
  papers.set(seed.id, { ...seed, role: 'seed' });
  refsOf.set(seed.id, seed._refs);

  // Level one: the seed's references. Keep all that fit under --max-refs (most cited first), plus any named ancestor.
  const ancestors = (args.ancestors ? args.ancestors.split(',').map((s) => shortId(s.trim())) : []).slice(0, 5);
  const level1 = await fetchMany(seed._refs);
  level1.sort((a, b) => b.cited_by_count - a.cited_by_count || (a.id < b.id ? -1 : 1));
  const keep1 = level1.filter((p, i) => i < maxRefs || ancestors.includes(p.id));
  for (const p of keep1) {
    papers.set(p.id, { ...p, role: ancestors.includes(p.id) ? 'ancestor' : 'reference' });
    addEdge(seed.id, p.id, 'verified');
  }
  for (const p of level1) refsOf.set(p.id, p._refs);

  // Ancestors that are not references of the seed (the user named them): fetch them too.
  for (const a of ancestors) {
    if (!papers.has(a)) {
      const p = await fetchWork(a);
      papers.set(p.id, { ...p, role: 'ancestor' });
      refsOf.set(p.id, p._refs);
    }
  }

  // Level two: references of each named ancestor (top --top2 by citations), one level further down.
  const level2Counts = {};
  for (const a of ancestors) {
    const ids = refsOf.get(a) || [];
    const got = await fetchMany(ids);
    got.sort((x, y) => y.cited_by_count - x.cited_by_count || (x.id < y.id ? -1 : 1));
    let kept = 0;
    for (const p of got) {
      refsOf.set(p.id, p._refs);
      if (papers.has(p.id)) { addEdge(a, p.id, 'verified'); continue; }
      if (kept < top2) {
        papers.set(p.id, { ...p, role: 'level2' });
        addEdge(a, p.id, 'verified');
        kept++;
      }
    }
    level2Counts[a] = { references_in_openalex: ids.length, kept };
  }

  // Cross edges among seed and ancestors that the data contains (verified), whichever way they run.
  const core = [seed.id, ...ancestors];
  for (const x of core) for (const y of core) {
    if (x !== y && (refsOf.get(x) || []).includes(y)) addEdge(x, y, 'verified');
  }

  // Edges the writer believes in but the data does not contain.
  const inferredList = (args.inferred ? args.inferred.split(',') : []).map((s) => s.trim().split('>')).filter((p) => p.length === 2);
  for (const [f, t] of inferredList) {
    if (!(refsOf.get(f) || []).includes(t)) {
      if (!papers.has(f) || !papers.has(t)) console.error(`warning: inferred edge ${f}>${t} names a paper that is not in the set`);
      addEdge(f, t, 'inferred');
    } else {
      console.error(`note: ${f}>${t} is in the data, so it is verified, not inferred`);
    }
  }

  // Papers that are not in OpenAlex (or have no reference list there) but that the writer has read from
  // the project's own notes (docs/pp-notes, docs/salt-notes). Their links can only be "inferred".
  let extraPapers = [];
  if (args.extra) {
    const extra = JSON.parse(fs.readFileSync(args.extra, 'utf8'));
    extraPapers = (extra.papers || []).map((p) => ({
      id: p.id, title: p.title ?? null, authors: p.authors || [], year: p.year ?? null, venue: p.venue ?? null,
      doi: p.doi ?? null, type: p.type ?? null, cited_by_count: null, open_access: p.open_access ?? null,
      oa_url: null, has_abstract: false, abstract: null, role: 'local', read: p.read || 'none', note: p.note || null,
    }));
    for (const e of extra.edges || []) addEdge(e.from, e.to, e.kind === 'verified' ? 'inferred' : e.kind || 'inferred');
  }

  const readMap = {};
  for (const s of (args.read ? args.read.split(',') : [])) {
    const [id, how] = s.trim().split('=');
    if (id && ['full', 'abstract', 'none'].includes(how)) readMap[shortId(id)] = how;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _refs is dropped on purpose
  const outPapers = [...papers.values()].map(({ _refs, ...p }) => ({ ...p, read: readMap[p.id] ?? 'none' }))
    .concat(extraPapers).sort(byYearId);
  const outEdges = [...edges.values()].sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : a.from + a.to > b.from + b.to ? 1 : 0));
  const result = {
    param: args.param,
    query: args.query,
    seed: seed.id,
    ancestors,
    candidates: candidates.map((c) => ({ id: c.id, title: c.title, year: c.year, doi: c.doi, found_by: c.found_by })),
    papers: outPapers,
    edges: outEdges,
    counts: {
      papers: outPapers.length,
      edges: outEdges.length,
      verified: outEdges.filter((e) => e.kind === 'verified').length,
      inferred: outEdges.filter((e) => e.kind === 'inferred').length,
      seed_references_in_openalex: seed._refs.length,
      level2: level2Counts,
    },
    note: 'verified = the citing paper\'s OpenAlex reference list contains the cited one (a reference relationship, not proof a value came from it). inferred = believed, not in the data. read = what the writer read: full | abstract | none. Abstracts are not stored here.',
    fetched_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(cacheDir, `abstracts-${args.param}.json`), JSON.stringify(abstracts, null, 2));
  console.error(`wrote ${outPath}: ${outPapers.length} papers, ${outEdges.length} edges; ${networkCalls} requests, ${cacheHits} cache hits`);
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
