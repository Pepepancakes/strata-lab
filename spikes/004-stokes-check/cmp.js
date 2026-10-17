// compare cover-over-crest series of several output files at chosen times: node cmp.js name1 name2 ...
const fs = require('fs'), path = require('path'), os = require('os');
const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const names = process.argv.slice(2), times = [26, 28, 30, 35, 40, 45, 50, 55, 60, 65];
const outs = names.map((n) => JSON.parse(fs.readFileSync(path.join(SCR, 'out-' + n + '.json'))));
console.log(['t', ...names].join('\t'));
for (const t of times) {
  const row = [t];
  for (const o of outs) { const r = o.series.find((q) => Math.abs(q.tMyr - t) < 0.26); row.push(r && r.coverM !== undefined ? r.coverM + ' / ' + r.reliefM + ' @' + r.crestKm : '-'); }
  console.log(row.join('\t'));
}
for (const o of outs) console.log(o.cfg.name, JSON.stringify(o.analysis), 'steps', o.steps, 'min', o.minutes.toFixed(1), 'salt area', ((o.saltArea1 / o.saltArea0 - 1) * 100).toFixed(2) + '%');
