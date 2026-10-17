// Controlled setup for the stay-at-the-seafloor and wall-shape benchmarks (spike 003).
// A strip of nx columns, fixed basement, no transport and no compaction: every column gets A of bulk sediment
// per year, a fixed salt feed runs into the diapir columns, flank columns have no salt. Constant-property
// sediment (bulk = solids x (1 + e0)), so heights are exact. See engine.js ctrlDeposit / ctrlLevel.
const S = require('./engine.js');

/**
 * opts: nx, dx (m), nD (diapir columns, centred), A (m/yr), R (m/yr rise rate of the diapir =
 * feed / width), tMyr, dtRec (yr), fs (sand share), flow (true: thin-sheet salt flow on), hd0 (initial salt
 * thickness under the diapir), hFlank (salt left under the flanks), extra (engine parameter overrides).
 */
function makeCtrl(opts) {
  const o = Object.assign({ nx: 100, dx: 1000, nD: 3, A: 1e-3, R: 1e-3, tMyr: 1, dtRec: 5000, fs: 0.35, flow: false, hd0: 200, hFlank: 0, nZone: 0, extra: {} }, opts);
  const P = S.defaultParams();
  Object.assign(P, { nx: o.nx, dx: o.dx, duration: o.tMyr * 1e6, dtRec: o.dtRec, subsShelf: 0, subsBasin: 0, slAmp: 0, slShift: 0,
    coverThick: 50, saltOn: true, exposed: 1, roofMin: 2, saltVisc: 1e18, nSaltSub: 5, limiter: 1, linear: { e0: 0.5, C: 1e-9, k: 1e-6 } });
  Object.assign(P, o.extra);
  const mid = Math.floor(o.nx / 2), c0 = mid - Math.floor(o.nD / 2);
  // `zone` = columns that obey the equilibrium-surface rule (the diapir and, if nZone > 0, nZone columns each side);
  // `feedCols` = the nD columns the feed enters; `flank` = every other column (the reference seafloor).
  const feedCols = [], zone = [], flank = [];
  for (let j = 0; j < o.nx; j++) {
    if (j >= c0 && j < c0 + o.nD) feedCols.push(j);
    if (j >= c0 - o.nZone && j < c0 + o.nD + o.nZone) zone.push(j); else flank.push(j);
  }
  const diapir = zone;
  P.ctrl = { A: o.A, fs: o.fs, flank, diapir, noFlow: !o.flow, feed: { cols: feedCols, q: o.R * o.nD * o.dx / S.consts.YR } };
  const st = S.createState(P);
  // start: no cover anywhere, flat seafloor at -2000 m, salt only under the diapir (and hFlank under the flanks)
  const nx = o.nx;
  for (let j = 0; j < nx; j++) {
    st.sand[j] = 0; st.mud[j] = 0;
    st.hs[j] = j >= c0 && j < c0 + o.nD ? o.hd0 : o.hFlank;
    st.b[j] = -2000 - st.hs[j];
  }
  st.initSolid = 0; st.initSand = 0;
  st.initSalt = 0; for (let j = 0; j < nx; j++) st.initSalt += st.hs[j] * o.dx;
  S.recomputeH(st, P);
  return { P, st, o, diapir, flank, feedCols };
}

/** Run to the end; returns time series every `every` steps: t (yr), cover over the diapir centre, salt-top minus flank level, flank level. */
function runCtrl(c, every = 10) {
  const { P, st, o } = c, mid = c.feedCols[Math.floor(c.feedCols.length / 2)];
  const series = [];
  const rec = () => {
    let zf = 0; for (const j of c.flank) zf += st.H[j]; zf /= c.flank.length;
    series.push({ t: st.k * P.dtRec, cover: st.cover[mid], top: st.b[mid] + st.hs[mid], zf, rel: st.b[mid] + st.hs[mid] - zf, hs: st.hs[mid] });
  };
  rec();
  while (S.step(st, P)) if (st.k % every === 0) rec();
  rec();
  return series;
}

module.exports = { makeCtrl, runCtrl };
