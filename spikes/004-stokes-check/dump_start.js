// Dump the thin-sheet (spike 003) state of the decisive Gulf case over the S4 window.
//   node dump_start.js
// writes   start-gulf.json    (committed, small)  state at t = tNear (24.8 Myr): the shared starting section for the Stokes run
// and      forcing-gulf.json  (scratch, not committed)  for every record step from tNear to the end: seafloor H(x), basement b(x),
//          salt thickness; the Stokes run uses the seafloor as the prescribed sediment level (median filtered, see cases.js)
//          and the mean basement drop as the subsidence.
// The run is the plain Gulf run of s4case.js (M3.10 start, exposed on), so it is the run the s4-case.json crest comes from.
const fs = require('fs');
const path = require('path');
const S = require('../003-passive-diapir/engine.js');
const { gulfParams } = require('../003-passive-diapir/gulf.js');
const C = require('../003-passive-diapir/s4-case.json').decisiveCase;
const scratch = process.env.S4_SCRATCH || require('path').join(require('os').tmpdir(), 'strata-s4');

const P = gulfParams({ exposed: 1 });
const st = S.createState(P);
const kNear = Math.round(C.thinSheetResult.tNearMyr * 1e6 / P.dtRec);
const [lo, hi] = C.section.windowColumns;
const frames = [];
let cols = null;
for (let k = 0; ; k++) {
  if (k >= kNear) {
    S.recomputeH(st, P);
    const f = { tMyr: +(k * P.dtRec / 1e6).toFixed(3), b: [], hs: [], H: [], cover: [] };
    for (let j = lo; j <= hi; j++) { f.b.push(+st.b[j].toFixed(2)); f.hs.push(+st.hs[j].toFixed(2)); f.H.push(+st.H[j].toFixed(2)); f.cover.push(+st.cover[j].toFixed(2)); }
    frames.push(f);
    if (k === kNear) {
      cols = [];
      for (let j = lo; j <= hi; j++) cols.push({ j, xM: (j + 0.5) * P.dx, baseM: +st.b[j].toFixed(1), saltM: +st.hs[j].toFixed(1), seafloorM: +st.H[j].toFixed(1), coverM: +st.cover[j].toFixed(1) });
    }
  }
  if (!S.step(st, P)) break;
}
const out = { about: 'Thin-sheet state at tNear for the S4 window (spike 003 engine, plain Gulf run). Elevations m, up positive; x = (j + 0.5) dx from the landward end.', tMyr: kNear * P.dtRec / 1e6, dxM: P.dx, columns: cols };
fs.writeFileSync(path.join(__dirname, 'start-gulf.json'), JSON.stringify(out) + '\n');
fs.mkdirSync(scratch, { recursive: true });
fs.writeFileSync(path.join(scratch, 'forcing-gulf.json'), JSON.stringify({ dxM: P.dx, firstColumn: lo, frames }));
console.log('t', out.tMyr, 'cols', cols.length, 'frames', frames.length, 'last t', frames[frames.length - 1].tMyr);
