// Summary tables for the README from the case outputs: node summary.js
const fs = require('fs'), path = require('path'), os = require('os');
const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const load = (n) => { const p = path.join(SCR, 'out-' + n + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null; };
const near = (o, t) => o.series.reduce((b, r) => (Math.abs(r.tMyr - t) < Math.abs(b.tMyr - t) ? r : b));
const gulf = ['gulf-A', 'gulf-A-cfl1', 'gulf-B', 'gulf-A-cov10', 'gulf-B-cov10', 'gulf-A-cov0.1', 'gulf-B-cov0.1'];
const times = [24.8, 26.8, 30, 40, 50, 54.3, 60, 66];
console.log('GULF: cover over the tracked crest (m) | shallowest salt in the crest zone 262-285 km (m) | exposed salt length in the window (km)');
console.log(['run', 'grid', 'cfl', 'steps', 'min', ...times.map((t) => t + ' Myr')].join(' | '));
for (const n of gulf) {
  const o = load(n); if (!o) { console.log(n, 'missing'); continue; }
  const last = o.series[o.series.length - 1].tMyr;
  const cells = times.map((t) => { if (t > last + 0.3) return '-'; const r = near(o, t); return r.coverM + ' | ' + r.zoneMinCoverM + ' | ' + r.exposedKm; });
  console.log([n, o.cfg.nx + 'x' + o.cfg.ny, '', o.steps, o.minutes.toFixed(0), ...cells].join(' | '), ' last t', last, JSON.stringify(o.analysis), 'salt area', ((o.saltArea1 / o.saltArea0 - 1) * 100).toFixed(2) + '%');
}
for (const n of ['gulf-A', 'gulf-B']) {
  const o = load(n); if (!o) continue;
  const z = o.series.map((r) => r.zoneMinCoverM), ex = o.series.map((r) => r.zoneExposedKm), exa = o.series.map((r) => r.exposedKm);
  console.log(n, 'zone min cover over the run: min', Math.min(...z), 'max', Math.max(...z), '| max exposed km in zone', Math.max(...ex), '| exposed km whole window: at start', exa[0], 'after 2 Myr', exa[4], 'max after 2 Myr', Math.max(...exa.slice(4)), 'times exposed>0 after 2 Myr:', o.series.filter((r, i) => i >= 4 && r.exposedKm > 0).map((r) => r.tMyr + ':' + r.exposedKm + '@' + r.minCoverKm).join(' '));
}
console.log('\nGL24-LIKE: crest above flank (m, + means salt above the flank seafloor) and cover over crest (m)');
for (const n of ['gl24-A', 'gl24-B']) {
  const o = load(n); if (!o) { console.log(n, 'missing'); continue; }
  const ts = [0.5, 1, 2, 3, 5, 10, 20, 30, 40, 50];
  console.log(n, o.cfg.nx + 'x' + o.cfg.ny, 'steps', o.steps, 'min', o.minutes.toFixed(0), 'salt area', ((o.saltArea1 / o.saltArea0 - 1) * 100).toFixed(2) + '%');
  console.log('  ' + ts.map((t) => { const r = near(o, t); return t + ' Myr: relief ' + r.reliefM + ', cover ' + r.coverM + ', crest@' + r.crestKm + ' km'; }).join('\n  '));
  console.log('  snapshots (salt thickness min / max, m):', o.snaps.map((s) => { const th = s.salt.filter((v) => v !== null).map((v) => v + 5000); return s.tMyr + ': ' + Math.min(...th).toFixed(0) + ' / ' + Math.max(...th).toFixed(0) + ' (n ' + th.length + '/' + s.salt.length + ')'; }).join('; '));
}
const g = load('gl24-A');
if (g) console.log('\nThin sheet GL24-like (crest depth below seafloor, m):', g.thinSeries.filter((r, i) => i % 4 === 0).map((r) => r.tMyr + ': ' + r.crestDepthM + ' thinnestSalt ' + r.thinnestSaltM).join('; '));
