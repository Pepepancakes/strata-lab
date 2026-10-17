// Pool crest-log CSVs from several runs/platforms (D16.4: quote medians over noise runs and both platforms).
// Usage: node s3c-pool.js label=file.csv [label=file.csv ...]   (CSV from s3b.js; '#' lines are skipped)
const fs = require('fs');

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => { const v = l.split(','), o = {}; head.forEach((h, i) => { o[h] = v[i] === '' ? NaN : (isNaN(+v[i]) ? v[i] : +v[i]); }); return o; });
}
const fin = (a) => a.filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
const med = (a) => { a = fin(a); if (!a.length) return NaN; const n = a.length; return n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2]); };
const rng = (a) => { a = fin(a); return a.length ? `${a[0].toFixed(0)} to ${a[a.length - 1].toFixed(0)}` : '-'; };

function summary(rows) {
  const ex = rows.filter((x) => x.exposedEver === 'true' || x.exposedEver === true), buried = ex.filter((x) => x.endWhy === 'buried');   // exposed crests that were then buried (same set as s3b.js aggregate)
  const exM = ex.map((x) => x.exposedMyr);
  return {
    crests: rows.length, exposedEver: ex.length, buried: buried.length,
    exposedMyrMedian: +med(exM).toFixed(1), exposedMyrMax: fin(exM).length ? Math.max(...exM) : NaN, exposedOver3Myr: exM.filter((v) => v > 3).length,
    F_near: +med(buried.map((x) => x.F_near)).toFixed(0), A_near: +med(buried.map((x) => x.A_near)).toFixed(0), FmA_near: +med(buried.map((x) => x.FmA_near)).toFixed(0),
    F_burial: +med(buried.map((x) => x.F_pre)).toFixed(0), A_burial: +med(buried.map((x) => x.A_pre)).toFixed(0), FmA_burial: +med(buried.map((x) => x.FmA_pre)).toFixed(0),
    nb5_median: +med(buried.map((x) => x.nb5)).toFixed(0), nb5_range: rng(buried.map((x) => x.nb5)),
    nb10_median: +med(buried.map((x) => x.nb10)).toFixed(0), nb10_range: rng(buried.map((x) => x.nb10)),
  };
}

const groups = process.argv.slice(2).map((a) => { const [label, file] = a.split('='); return { label, rows: readCsv(file) }; });
for (const g of groups) console.log(g.label.padEnd(24), JSON.stringify(summary(g.rows)));
if (groups.length > 1) console.log('POOLED'.padEnd(24), JSON.stringify(summary([].concat(...groups.map((g) => g.rows)))));
