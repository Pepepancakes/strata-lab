// Per-crest log for spike 003 (S3b; LIT-3 v2 section 9 test 1, QC items 10 to 14).
// A "crest" is a local maximum of the salt top (b + hs) with prominence >= PROM over +-10 columns, salt thicker
// than weldThick, and bulk cover under NEAR (500 m). Once found it is followed column by column (+-3 columns per
// record step) until its cover stays over NEAR for 3 steps in a row or its salt falls under weldThick: that is
// the "burial" (or sinking below 500 m). Every number is taken from the spike's own state; nothing is tuned to
// get a result. The criteria that are my own choices (PROM, the 0.5 dip ratio, the thick/depleted split) are
// labelled as such in the README.
const S = require('./engine.js');

const NEAR = 500;          // m of bulk cover: "within 500 m of the seafloor" (card)
const PROM = 100;          // m prominence for a crest candidate (my choice, tuned)
const GAP = 3;             // steps over NEAR before a crest counts as buried
const TRACK = 3;           // columns a crest may move per record step

function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; }

/** mean of arr over columns jc+d1..jc+d2 on each side (clipped to the grid) */
function flankMean(arr, jc, d1, d2) {
  const v = [];
  for (let d = d1; d <= d2; d++) for (const j of [jc - d, jc + d]) if (j >= 0 && j < arr.length) v.push(arr[j]);
  return mean(v);
}

/** crest candidates in the current state: columns, in increasing order */
function candidates(st, P) {
  const nx = st.nx, out = [];
  const zt = (j) => st.b[j] + st.hs[j];
  for (let j = 1; j < nx - 1; j++) {
    if (st.hs[j] < P.weldThick || st.cover[j] >= NEAR) continue;
    const z = zt(j);
    if (!(z > zt(j - 1) && z >= zt(j + 1))) continue;
    // prominence over +-10 columns: z minus the higher of the two side minima
    let lmin = z, rmin = z;
    for (let q = j - 1; q >= Math.max(0, j - 10); q--) lmin = Math.min(lmin, zt(q));
    for (let q = j + 1; q <= Math.min(nx - 1, j + 10); q++) rmin = Math.min(rmin, zt(q));
    if (z - Math.max(lmin, rmin) >= PROM) out.push(j);
  }
  return out;
}

/**
 * Follow crests through a run. `stepFn()` must advance the state one record step and return false at the end.
 * Returns { episodes, series } where every episode has its per-step series.
 */
function trackCrests(st, P, hs0, stepFn) {
  const dtMyr = P.dtRec / 1e6, active = [], done = [];
  let nextId = 1;
  const record = (ep) => {
    const j = ep.j, zt = st.b[j] + st.hs[j];
    const Hf = flankMean(st.H, j, 3, 5), cf = flankMean(st.cover, j, 3, 5);
    const side = (sgn) => { const q = []; for (let d = 3; d <= 5; d++) { const c = j + sgn * d; if (c >= 0 && c < st.nx) q.push(st.H[c]); } return q.length ? mean(q) : NaN; };
    const dips = [side(-1), side(1)].filter((v) => !isNaN(v)).map((v) => Math.atan((st.H[j] - v) / (4 * P.dx)) * 180 / Math.PI);
    ep.s.push({ t: st.k * dtMyr, j, cover: st.cover[j], hs: st.hs[j], zt, Hc: st.H[j], Hf, cf, dip: dips.length ? Math.max(...dips) : NaN, exposed: st.cover[j] < P.roofMin });
  };
  while (stepFn()) {
    const t = st.k * dtMyr, cand = candidates(st, P);
    // follow active crests
    for (const ep of active) {
      // best column within +-TRACK: the lowest cover with salt
      let best = -1, bc = Infinity;
      for (let q = Math.max(0, ep.j - TRACK); q <= Math.min(st.nx - 1, ep.j + TRACK); q++) if (st.hs[q] >= P.weldThick && st.cover[q] < bc) { bc = st.cover[q]; best = q; }
      if (best < 0) { ep.endWhy = 'welded'; ep.end = t; ep.closing = true; ep.last = Array.from(st.hs); continue; }
      ep.j = best;
      if (st.cover[best] >= NEAR) {
        ep.over++;
        if (ep.over >= GAP) { ep.end = t - (GAP - 1) * dtMyr; ep.endWhy = 'buried'; ep.closing = true; }
      } else ep.over = 0;
      if (ep.closing) {
        // the state at the burial step (the first step over NEAR), not now
        continue;
      }
      // two crests that have drifted to within 2 columns are one crest: the younger one is dropped
      const older = active.find((o) => o !== ep && !o.closing && o.id < ep.id && Math.abs(o.j - ep.j) <= 2);
      if (older) { ep.merged = true; ep.closing = true; continue; }
      record(ep);
      if (ep.s[ep.s.length - 1].exposed && ep.tExp === undefined) {
        ep.tExp = t;
        const prev = ep.s.length > 1 ? ep.s[ep.s.length - 2] : null;
        ep.preExp = prev ? { cover: prev.cover, cf: prev.cf } : { cover: NaN, cf: NaN };
      }
      ep.snapEnd = { hs: st.hs.slice(), H: st.H.slice(), cover: st.cover.slice(), b: st.b.slice(), j: ep.j, t };
    }
    for (let i = active.length - 1; i >= 0; i--) if (active[i].closing) { if (!active[i].merged) done.push(active[i]); active.splice(i, 1); }
    // new crests: candidates not within TRACK+2 columns of an active crest
    for (const j of cand) {
      if (active.some((ep) => Math.abs(ep.j - j) <= TRACK + 2)) continue;
      const ep = { id: nextId++, j, j0: j, tNear: t, s: [], over: 0, tExp: undefined, preExp: null, end: undefined, endWhy: null, snapEnd: null,
        coverAtOnset: st.cover[j], cfAtOnset: flankMean(st.cover, j, 3, 5), hs0: hs0[j] };
      record(ep);
      if (ep.s[0].exposed) { ep.tExp = t; ep.preExp = { cover: NaN, cf: NaN }; }
      ep.snapEnd = { hs: st.hs.slice(), H: st.H.slice(), cover: st.cover.slice(), b: st.b.slice(), j, t };
      active.push(ep);
    }
  }
  // crests still near the surface at the end of the run
  for (const ep of active) { ep.end = undefined; ep.endWhy = 'still near at end'; done.push(ep); }
  return done.sort((a, b) => a.tNear - b.tNear || a.j0 - b.j0);
}

/** slope of y against t by least squares over the points (t in Myr, y in m) -> m/Myr; NaN with fewer than 2 points */
function slope(pts) {
  const n = pts.length; if (n < 2) return NaN;
  const mt = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0; for (const [t, y] of pts) { sxy += (t - mt) * (y - my); sxx += (t - mt) * (t - mt); }
  return sxx > 0 ? sxy / sxx : NaN;
}

/** summary row for one crest (see README for the definitions) */
function summarise(ep, P, hs0, dtMyr) {
  const s = ep.s, last = s[s.length - 1], n = s.length;
  const exposedSteps = s.filter((q) => q.exposed).length;
  const win = (arr, from, to) => arr.filter((q) => q.t >= from - 1e-9 && q.t <= to + 1e-9);
  const tLast = last.t;
  const pre = win(s, tLast - 1.0, tLast);                                  // last 1 Myr before the end of the near phase
  const F_ep = slope(s.map((q) => [q.t, q.zt])), A_ep = slope(s.map((q) => [q.t, q.Hf]));
  const F_pre = slope(pre.map((q) => [q.t, q.zt])), A_pre = slope(pre.map((q) => [q.t, q.Hf]));
  // S3-2 (SALT-R1): F_pre/A_pre ("rate at burial") include the first records after the cover passes NEAR, when the
  // new fill is pushing the salt top down. "Rate while near" uses records with cover under NEAR only, last 1 Myr of them.
  const nearRecs = s.filter((q) => q.cover < NEAR), tNearLast = nearRecs.length ? nearRecs[nearRecs.length - 1].t : NaN;
  const nearWin = nearRecs.filter((q) => q.t >= tNearLast - 1.0 - 1e-9);
  const F_near = slope(nearWin.map((q) => [q.t, q.zt])), A_near = slope(nearWin.map((q) => [q.t, q.Hf]));
  const dipPeak = Math.max(...s.map((q) => q.dip).filter((v) => !isNaN(v)));
  const dipEnd = last.dip, dipStart = s[0].dip;
  const snap = ep.snapEnd, j = snap.j, nx = snap.hs.length;
  const nb = {};
  for (const d of [1, 5, 10]) {
    const pick = (jj) => (jj >= 0 && jj < nx ? snap.hs[jj] : NaN), pick0 = (jj) => (jj >= 0 && jj < nx ? hs0[jj] : NaN);
    nb[d] = { hs: mean([pick(j - d), pick(j + d)].filter((v) => !isNaN(v))), frac: mean([pick(j - d), pick(j + d)].filter((v) => !isNaN(v))) / P.saltThick };
  }
  // flow length: distance (m) from the crest to the nearest column with salt under weldThick, each side, the smaller one
  const dist = (sgn) => { let d = 1; while (true) { const c = j + sgn * d; if (c < 0 || c >= nx) return (d - 1 + 0.5) * P.dx; if (snap.hs[c] < P.weldThick) return d * P.dx; d++; } };
  const Lflow = Math.min(dist(-1), dist(1));
  const hbar = mean(Array.from({ length: 21 }, (_, i) => snap.hs[Math.min(nx - 1, Math.max(0, j - 10 + i))]));
  const nbMean = mean([nb[1].frac, nb[5].frac, nb[10].frac].filter((v) => !isNaN(v)));
  const kind = Lflow <= 3 * P.dx ? 'toe' : 'interior';   // within 3 km of a salt-free column: the salt front, not an interior crest
  const nbCls = nbMean >= 0.5 ? 'thick' : nbMean <= 0.25 ? 'depleted' : 'intermediate';
  const roofOnset = ep.coverAtOnset / ep.cfAtOnset;
  const roofExp = ep.preExp && !isNaN(ep.preExp.cover) ? ep.preExp.cover / ep.preExp.cf : NaN;
  // onlap: at the end of the near phase the flank surface stands above the crest salt top
  const flankAbove = last.Hf > last.zt;
  return {
    id: ep.id, col0: ep.j0, km0: ep.j0 + 0.5, kmEnd: j + 0.5, tNear: ep.tNear, tExp: ep.tExp === undefined ? NaN : ep.tExp, exposedEver: exposedSteps > 0,
    tEnd: ep.end === undefined ? NaN : ep.end, endWhy: ep.endWhy, nearMyr: n * dtMyr, exposedMyr: exposedSteps * dtMyr,
    F_ep, A_ep, FmA_ep: F_ep - A_ep, F_pre, A_pre, FmA_pre: F_pre - A_pre, F_near, A_near, FmA_near: F_near - A_near, D: 0,
    dipStart, dipPeak, dipEnd, steepToGentle: dipEnd < 0.5 * dipPeak, onlap: flankAbove,
    hs0: ep.hs0, hsEnd: snap.hs[j], nb1: nb[1].hs, nb5: nb[5].hs, nb10: nb[10].hs, nbFrac1: nb[1].frac, nbFrac5: nb[5].frac, nbFrac10: nb[10].frac, nbClass: nbCls,
    Lflow, hbar, LoverH: Lflow / hbar, kind,
    roofOnset, roofOnsetFlag: roofOnset > 1 / 3, roofExp, roofExpFlag: roofExp > 1 / 3,
  };
}

const COLS = ['id', 'col0', 'km0', 'kmEnd', 'tNear', 'tExp', 'tEnd', 'endWhy', 'nearMyr', 'exposedMyr', 'exposedEver', 'F_ep', 'A_ep', 'FmA_ep', 'F_pre', 'A_pre', 'FmA_pre', 'F_near', 'A_near', 'FmA_near', 'D',
  'dipStart', 'dipPeak', 'dipEnd', 'steepToGentle', 'onlap', 'hs0', 'hsEnd', 'nb1', 'nb5', 'nb10', 'nbFrac1', 'nbFrac5', 'nbFrac10', 'nbClass', 'Lflow', 'hbar', 'LoverH', 'kind',
  'roofOnset', 'roofOnsetFlag', 'roofExp', 'roofExpFlag'];
function toCsv(rows, extra) {
  const f = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? String(+v.toPrecision(6)) : '') : String(v));
  const note = ['# Rates in m/Myr, least squares over a 1 Myr window of 0.1 Myr records.',
    '# F_near, A_near, FmA_near ("rate while near"): the last 1 Myr of records with bulk cover under NEAR (500 m) only.',
    '# F_pre, A_pre, FmA_pre ("rate at burial"): the last 1 Myr up to the end of the near phase, which includes the 1 to 2 records after the cover passes NEAR (the burial squeeze).',
    '# F = rise of the salt top, A = rise of the flank seafloor (columns 3 to 5 each side); F - A < 0 means the flank gains on the crest.'];
  const head = (extra ? Object.keys(extra).join(',') + ',' : '') + COLS.join(',');
  return note.concat([head]).concat(rows.map((r) => (extra ? Object.values(extra).map(f).join(',') + ',' : '') + COLS.map((c) => f(r[c])).join(','))).join('\n');
}

module.exports = { trackCrests, summarise, toCsv, candidates, slope, COLS, NEAR, PROM, GAP, TRACK };
