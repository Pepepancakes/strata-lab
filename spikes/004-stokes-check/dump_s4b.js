'use strict';
// S4b: cut the Stokes start section from the FIXED spike 003 Gulf run (S3c bypass rule) and log the comparison crest.
//   node dump_s4b.js [crestId] [tNearMyr]       default: crest 26 (Windows, SALT-R2 N-3), start at its tNear = 24.9 Myr
//   S4B_OUT=<file> writes the case file elsewhere (Linux: crest 83); a wrong crest id prints the list of crests.
// Runs the plain Gulf run (gulfParams({exposed: 1}), the run of `node ../003-passive-diapir/s3b.js gulf`) once, tracks
// crests with the spike's own crestlog.js, and writes
//   s4b-case.json          (committed)  start section (columns 211 to 331, the same cut as start-gulf.json), the thin-sheet
//                                       series of the followed crest every 0.1 Myr, its crestlog summary row, and the run settings
//   forcing-s4b.json       (scratch)    seafloor H(x) and basement b(x) per record step, for the Stokes sediment level
// Spike 003 code is not changed; this file only requires it. Deterministic on one machine (D16.4: not across machines).
const fs = require('fs');
const path = require('path');
const os = require('os');
const S = require('../003-passive-diapir/engine.js');
const { gulfParams } = require('../003-passive-diapir/gulf.js');
const { trackCrests, summarise } = require('../003-passive-diapir/crestlog.js');

const scratch = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');   // forcing-s4b.json goes here (not committed)
const crestId = +(process.argv[2] || 26);
const tNearArg = process.argv[3] ? +process.argv[3] : null;   // default: the followed crest's own tNear (24.9 Myr for Windows crest 26)
const outFile = process.env.S4B_OUT || path.join(__dirname, 's4b-case.json');
const lo = 211, hi = 331;          // dumped columns (inclusive); the Stokes window is 226 to 315 (cases.js)

const P = gulfParams({ exposed: 1 });
const st = S.createState(P);
const hs0 = Float64Array.from(st.hs);
const r1 = (v) => Math.round(v * 10) / 10;
const frames = [];
const capture = () => {
  S.recomputeH(st, P);
  const f = { tMyr: +(st.k * P.dtRec / 1e6).toFixed(3), b: [], hs: [], H: [], cover: [] };
  for (let j = lo; j <= hi; j++) { f.b.push(+st.b[j].toFixed(2)); f.hs.push(+st.hs[j].toFixed(2)); f.H.push(+st.H[j].toFixed(2)); f.cover.push(+st.cover[j].toFixed(2)); }
  f.cols = [];
  for (let j = lo; j <= hi; j++) f.cols.push({ j, xM: (j + 0.5) * P.dx, baseM: +st.b[j].toFixed(1), saltM: +st.hs[j].toFixed(1), seafloorM: +st.H[j].toFixed(1), coverM: +st.cover[j].toFixed(1) });
  frames.push(f);
};
capture();   // k = 0 (before the first step; only used when tNear is 0)
const eps = trackCrests(st, P, hs0, () => { const ok = S.step(st, P); if (ok) capture(); return ok; });
const ep = eps.find((e) => e.id === crestId);
if (!ep) throw new Error('crest ' + crestId + ' not found; crests (id:col0:tNear:tExp:tEnd): ' + eps.map((e) => [e.id, e.j0, e.tNear.toFixed(1), e.tExp, e.end].join(':')).join(' '));
const kNear = Math.round((tNearArg === null ? ep.tNear : tNearArg) * 1e6 / P.dtRec);
const cols = frames.find((f) => Math.round(f.tMyr * 1e6 / P.dtRec) === kNear).cols;
const kept = frames.filter((f) => Math.round(f.tMyr * 1e6 / P.dtRec) >= kNear);
for (const f of frames) delete f.cols;
const row = summarise(ep, P, hs0, P.dtRec / 1e6);
const mb = S.massBalance(st, P);
const series = ep.s.map((q) => ({ tMyr: +(Math.round(q.t * 10) / 10).toFixed(1), col: q.j, coverM: r1(q.cover), saltTopM: r1(q.zt), seafloorAtCrestM: r1(q.Hc), flankSeafloorM: r1(q.Hf), saltThicknessM: r1(q.hs), exposed: q.exposed }));
const n = eps.length, nExp = eps.filter((e) => e.tExp !== undefined).length;
const out = {
  about: 'S4b start section and thin-sheet comparison crest, cut from the FIXED spike 003 Gulf run (S3c bypass rule). Engine SI: m, years. Written by dump_s4b.js; do not edit by hand.',
  platform: process.platform + ', node ' + process.versions.node,
  crest: { id: ep.id, startColumn: ep.j0, endColumn: ep.s[ep.s.length - 1].j, tNearMyr: ep.tNear, tExposedMyr: ep.tExp === undefined ? null : ep.tExp, tEndMyr: ep.end === undefined ? null : ep.end, endWhy: ep.endWhy, followedBy: 'spike 003 crestlog.js (+-3 columns per 0.1 Myr, lowest cover with salt); the Stokes run follows the highest salt top within +-4 km of the previous crest' },
  crestlogRow: row,
  roofMinM: P.roofMin,
  runStats: { crestsLogged: n, crestsExposedEver: nExp, thinSheetSaltRelError: mb.saltRelError, thinSheetMassRelError: mb.relError },
  start: { tMyr: kNear * P.dtRec / 1e6, dxM: P.dx, firstColumn: lo, columns: cols },
  thinSeries: series,
};
fs.writeFileSync(outFile, JSON.stringify(out) + '\n');
fs.mkdirSync(scratch, { recursive: true });
fs.writeFileSync(path.join(scratch, 'forcing-s4b.json'), JSON.stringify({ dxM: P.dx, firstColumn: lo, frames: kept }));
console.log(out.platform, 'crests', n, 'exposed ever', nExp, 'followed', crestId, 'start col', ep.j0, 'end col', out.crest.endColumn, 'tNear', ep.tNear, 'tExp', ep.tExp, 'tEnd', ep.end, ep.endWhy, 'exposedMyr', row.exposedMyr);
console.log('mass balance', JSON.stringify(mb));
console.log('frames', kept.length, 'first', kept[0].tMyr, 'last', kept[kept.length - 1].tMyr, 'series', series.length);
