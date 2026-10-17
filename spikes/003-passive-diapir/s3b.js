// S3b runs: per-crest log on the M3.10 Gulf start. Usage:
//   node s3b.js gulf [json overrides]     plain Gulf run (exposed on), prints the crest table
//   node s3b.js sweep                     16-run sweep from S3 on a smaller strip (see README)
//   node s3b.js ulp                       six 1 ulp noise runs of the Gulf case
// Writes CSV to the scratch directory (SCRATCH env, default $TMPDIR/strata-s3b).
const fs = require('fs');
const path = require('path');
const S = require('./engine.js');
const { gulfParams, exposedClusters } = require('./gulf.js');
const { trackCrests, summarise, toCsv } = require('./crestlog.js');
const { withUlpNoise, AMP, SIX_SALTS } = require('./ulp.js');

const scratch = process.env.SCRATCH || path.join(process.env.TMPDIR || require('os').tmpdir(), 'strata-s3b');
fs.mkdirSync(scratch, { recursive: true });

/** run one case and log its crests; `exposed` on, no roof thinning (the S3 "bypass" variant) */
function runCase(over) {
  const P = gulfParams(Object.assign({ exposed: 1 }, over));
  const st = S.createState(P);
  const hs0 = Float64Array.from(st.hs);
  const t0 = Date.now();
  let exposedCols = 0, maxExposedCols = 0;
  const eps = trackCrests(st, P, hs0, () => {
    const ok = S.step(st, P);
    if (ok) { let c = 0; for (let j = 0; j < st.nx; j++) if (st.hs[j] > 0 && st.cover[j] < P.roofMin) c++; exposedCols = c; maxExposedCols = Math.max(maxExposedCols, c); }
    return ok;
  });
  const mb = S.massBalance(st, P);
  const rows = eps.map((e) => summarise(e, P, hs0, P.dtRec / 1e6));
  return { P, st, hs0, eps, rows, mb, ms: Date.now() - t0, maxExposedCols, exposedEnd: exposedCols };
}

/** the 16-run sweep: supply 8 or 20, salt 2000 or 3500, viscosity 1e16 or 1e17, cover 50 or 150 (S3 README), on a 150 km strip
 *  (the S3 strip size was not recorded; this one is stated in the README), basinward limit scaled to 90/120 km. */
function sweepCases() {
  const out = [];
  for (const supply of [8, 20]) for (const saltThick of [2000, 3500]) for (const saltVisc of [1e16, 1e17]) for (const coverThick of [50, 150]) {
    out.push({ supply, saltThick, saltVisc, coverThick, nx: 150, duration: 12e6, dtRec: 50000, saltPinch: [10000, 40000], saltLimit: [90000, 120000], subsShelf: 40, subsBasin: 150, tcMax: 0.1, coverNoise: 0.5, seed: 2, coverVisc: 1e18 });
  }
  return out;
}

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');
function printRows(rows, onlyExposed) {
  const r = rows.filter((x) => !onlyExposed || x.exposedEver);
  console.log('id  km   tNear tExp  tEnd  why     expMyr  F_pre A_pre F-A (burial) | Fn An F-An (near) | dip pk/end s>g onlap | nb1/5/10 salt (m) frac | L/h  | kind | roof0 roofExp');
  for (const x of r) {
    console.log(`${String(x.id).padStart(2)} ${fmt(x.km0, 0).padStart(4)} ${fmt(x.tNear).padStart(5)} ${fmt(x.tExp).padStart(5)} ${fmt(x.tEnd).padStart(5)} ${x.endWhy.padEnd(8)} ${fmt(x.exposedMyr).padStart(5)}  ${fmt(x.F_pre, 0).padStart(6)} ${fmt(x.A_pre, 0).padStart(5)} ${fmt(x.FmA_pre, 0).padStart(5)} | ${fmt(x.F_near, 0).padStart(5)} ${fmt(x.A_near, 0).padStart(4)} ${fmt(x.FmA_near, 0).padStart(5)} | ${fmt(x.dipPeak)}/${fmt(x.dipEnd)} ${x.steepToGentle ? 'y' : 'n'} ${x.onlap ? 'y' : 'n'} | ${fmt(x.nb1, 0)}/${fmt(x.nb5, 0)}/${fmt(x.nb10, 0)} ${x.nbClass} ${fmt(x.nbFrac10, 2)} | ${fmt(x.LoverH, 1)} | ${x.kind.padEnd(8)} | ${fmt(x.roofOnset, 2)}${x.roofOnsetFlag ? '*' : ''} ${fmt(x.roofExp, 2)}${x.roofExpFlag ? '*' : ''}`);
  }
}

module.exports = { runCase, sweepCases, printRows, aggregate, scratch };

/** counts and ranges over the exposed crests of one or more runs */
function aggregate(rows) {
  const ex = rows.filter((x) => x.exposedEver), fin = (a) => a.filter((v) => Number.isFinite(v));
  const rng = (a) => { a = fin(a); return a.length ? `${Math.min(...a).toFixed(1)} to ${Math.max(...a).toFixed(1)}` : '-'; };
  const med = (a) => { a = fin(a).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
  const cnt = (f) => ex.filter(f).length;
  const buried = ex.filter((x) => x.endWhy === 'buried');
  return {
    crests: rows.length, exposed: ex.length, buried: buried.length, stillNear: cnt((x) => x.endWhy !== 'buried'),
    interior: cnt((x) => x.kind === 'interior'), toe: cnt((x) => x.kind === 'toe'),
    exposedMyr: rng(ex.map((x) => x.exposedMyr)), exposedMyrMedian: med(ex.map((x) => x.exposedMyr)),
    F_pre: rng(buried.map((x) => x.F_pre)), A_pre: rng(buried.map((x) => x.A_pre)), FmA_pre: rng(buried.map((x) => x.FmA_pre)),
    FmA_negative: buried.filter((x) => x.FmA_pre < 0).length,
    F_ep: rng(ex.map((x) => x.F_ep)), A_ep: rng(ex.map((x) => x.A_ep)),
    nbThick: buried.filter((x) => x.nbClass === 'thick').length, nbMid: buried.filter((x) => x.nbClass === 'intermediate').length, nbDepleted: buried.filter((x) => x.nbClass === 'depleted').length,
    nb10: rng(buried.map((x) => x.nb10)), LoverH: rng(buried.map((x) => x.LoverH)),
    steepToGentle: buried.filter((x) => x.steepToGentle).length, onlap: buried.filter((x) => x.onlap).length,
    roofOnsetFlag: cnt((x) => x.roofOnsetFlag), roofExpFlag: cnt((x) => x.roofExpFlag),
    // S3c: medians (D16.4 quotes medians), exposure counts, near-phase rates
    exposedMax: ex.length ? Math.max(...ex.map((x) => x.exposedMyr)) : NaN, exposedOver3: cnt((x) => x.exposedMyr > 3),
    F_near_med: med(buried.map((x) => x.F_near)), A_near_med: med(buried.map((x) => x.A_near)), FmA_near_med: med(buried.map((x) => x.FmA_near)),
    FmA_near: rng(buried.map((x) => x.FmA_near)), F_pre_med: med(buried.map((x) => x.F_pre)), A_pre_med: med(buried.map((x) => x.A_pre)), FmA_pre_med: med(buried.map((x) => x.FmA_pre)),
    nb5_med: med(buried.map((x) => x.nb5)), nb5: rng(buried.map((x) => x.nb5)), nb10_med: med(buried.map((x) => x.nb10)),
  };
}

if (require.main === module) {
  const mode = process.argv[2] || 'gulf';
  if (mode === 'gulf') {
    const r = runCase(JSON.parse(process.argv[3] || '{}'));
    console.log('aggregate', JSON.stringify(aggregate(r.rows)));
    console.log(`gulf: ${(r.ms / 1000).toFixed(1)} s; crests logged ${r.rows.length}, ever exposed ${r.rows.filter((x) => x.exposedEver).length}; max exposed columns ${r.maxExposedCols}; at end ${r.exposedEnd}; balance salt ${r.mb.saltRelError.toExponential(1)} sand ${r.mb.sandRelError.toExponential(1)} mud ${r.mb.mudRelError.toExponential(1)}`);
    printRows(r.rows, false);
    fs.writeFileSync(path.join(scratch, 'gulf-crests.csv'), toCsv(r.rows));
  } else if (mode === 'sweep') {
    const all = [];
    sweepCases().forEach((c, i) => {
      const r = runCase(c);
      const ex = r.rows.filter((x) => x.exposedEver);
      console.log(`run ${i + 1}: supply ${c.supply} salt ${c.saltThick} visc ${c.saltVisc} cover ${c.coverThick}: ${(r.ms / 1000).toFixed(1)} s; crests ${r.rows.length}, exposed ${ex.length}, max cols ${r.maxExposedCols}, at end ${r.exposedEnd}; exposed Myr ${ex.map((x) => fmt(x.exposedMyr, 2)).join(',')}`);
      for (const x of r.rows) all.push(Object.assign({ run: i + 1, supply: c.supply, saltThick: c.saltThick, saltVisc: c.saltVisc, coverThick: c.coverThick }, x));
    });
    console.log('sweep pooled', JSON.stringify(aggregate(all)));
    fs.writeFileSync(path.join(scratch, 'sweep-crests.csv'), ['run,supply,saltThick,saltVisc,coverThick,' + require('./crestlog.js').COLS.join(',')].concat(
      all.map((x) => ['run', 'supply', 'saltThick', 'saltVisc', 'coverThick'].map((k) => x[k]).concat(require('./crestlog.js').COLS.map((c) => (typeof x[c] === 'number' ? (Number.isFinite(x[c]) ? +x[c].toPrecision(6) : '') : x[c]))).join(','))).join('\n'));
  } else if (mode === 'ulp') {
    const all = [];
    for (const salt of SIX_SALTS) {
      const r = withUlpNoise(AMP, salt, () => runCase({}));
      const ex = r.rows.filter((x) => x.exposedEver);
      console.log(`ulp ${salt}: ${(r.ms / 1000).toFixed(1)} s; crests ${r.rows.length}, exposed ${ex.length}, max cols ${r.maxExposedCols}, at end ${r.exposedEnd}; exposed Myr ${ex.map((x) => fmt(x.exposedMyr, 2)).join(',')}; km ${ex.map((x) => fmt(x.km0, 0)).join(',')}`);
      console.log('   ', JSON.stringify(aggregate(r.rows)));
      for (const x of r.rows) all.push(Object.assign({ salt }, x));
    }
    fs.writeFileSync(path.join(scratch, 'ulp-crests.csv'), toCsv(all.map((x) => x), null));
  }
}
