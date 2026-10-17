// Table for the README: cover over the tracked crest (m), thin sheet vs Stokes runs, at chosen times.  node table.js
const fs = require('fs'), path = require('path'), os = require('os');
const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const load = (n) => { const p = path.join(SCR, 'out-' + n + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null; };
const times = [24.8, 26.8, 30, 40, 50, 54, 60, 66];
const C = require('../003-passive-diapir/s4-case.json').decisiveCase;
const near = (series, t, key) => { const r = series.reduce((b, q) => (Math.abs(q.tMyr - t) < Math.abs(b.tMyr - t) ? q : b)); return Math.abs(r.tMyr - t) <= 0.3 ? r[key] : null; };
const f = (v) => (v === null || v === undefined ? '-' : Math.round(v));
const groups = [
  ['Gulf, filtered level, cover x1', ['gulf-A', 'gulf-B']],
  ['Gulf, UNFILTERED level, cover x1', ['gulf-A-unf', 'gulf-B-unf']],
  ['Gulf, filtered level, cover x10', ['gulf-A-cov10', 'gulf-B-cov10']],
  ['Gulf, UNFILTERED level, cover x10', ['gulf-A-cov10-unf', 'gulf-B-cov10-unf']],
  ['Gulf, filtered level, cover x0.1', ['gulf-A-cov0.1', 'gulf-B-cov0.1']],
  ['Gulf, UNFILTERED level, cover x0.1', ['gulf-A-cov0.1-unf', 'gulf-B-cov0.1-unf']],
];
console.log('| run | ' + times.join(' | ') + ' | min cover 26-66 Myr | first t cover<50 | burial t |');
console.log('|' + '---|'.repeat(times.length + 4));
console.log('| thin sheet | ' + times.map((t) => f(near(C.aggradationHistory.series, t, 'coverM'))).join(' | ') + ' | 0 | 26.8 | 54.3 |');
for (const [title, names] of groups) {
  console.log('| **' + title + '** |' + ' |'.repeat(times.length + 3));
  for (const n of names) {
    const o = load(n); if (!o) { console.log('| ' + n + ' | missing |'); continue; }
    const s = o.series, last = s[s.length - 1].tMyr;
    const mid = s.filter((r) => r.tMyr >= 26 && r.coverM !== undefined);
    const minc = Math.min(...mid.map((r) => r.coverM)), minz = Math.min(...mid.map((r) => r.zoneMinCoverM));
    const a = o.analysis;
    console.log('| ' + n + ' ' + o.cfg.nx + 'x' + o.cfg.ny + ' | ' + times.map((t) => (t > last + 0.3 ? '-' : f(near(s, t, 'coverM')))).join(' | ') + ' | ' + f(minc) + ' (zone ' + f(minz) + ') | ' + (a.tExposedMyr ?? 'none') + ' | ' + (a.tBuriedMyr ?? 'none') + ' |');
  }
}
