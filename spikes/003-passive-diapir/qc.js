// S3b density tests (spike 003): the equal-density null (QC 5b, GL24 Fig. 5a) and the GL24-like down-building run (QC 15).
//
// Both use the spike's controlled mode (no transport, no compaction, constant-property sediment, so heights are exact).
// Bulk density of the cover is set through the void ratio: rho_bulk = (rho_solid + e0 rho_water) / (1 + e0), so e0 =
// (rho_solid - rho_bulk) / (rho_bulk - rho_water). The salt density is P.rhoSalt (engine default 2160).
const S = require('./engine.js');
const { RHO_S, RHO_W, YR } = S.consts;

const e0For = (rhoBulk) => (RHO_S - rhoBulk) / (rhoBulk - RHO_W);

/** base parameters for a closed strip with a thick salt layer and a constant-density cover */
function stripParams(o) {
  const P = S.defaultParams();
  Object.assign(P, { nx: o.nx, dx: o.dx, duration: o.tMyr * 1e6, dtRec: o.dtRec, subsShelf: 0, subsBasin: 0, slAmp: 0, slShift: 0, coverThick: 0,
    saltOn: true, exposed: 0, saltVisc: o.saltVisc, coverBend: o.coverVisc > 0 ? 1 : 0, coverVisc: o.coverVisc, nSaltSub: 5, limiter: 1, weldThick: 100,
    linear: { e0: e0For(o.rhoCover), C: 1e-9, k: 1e-6 }, rhoSalt: o.rhoSalt,
    ctrl: { A: o.A, fs: 0.35, flank: [], diapir: [], noFlow: false, feed: null },
    saltPinch: [-1e9, -1e9 + 1], saltThick: 0 });
  return P;
}

/**
 * Start: flat basement, flat seafloor, salt thickness h0 + bump (cosine, `mode` half waves over the strip), the cover
 * fills the rest up to the seafloor (thin where the salt is thick).
 */
function makeStrip(o) {
  o = Object.assign({ nx: 100, dx: 1000, tMyr: 5, dtRec: 20000, A: 0, saltVisc: 1e18, coverVisc: 0, rhoCover: 2600, rhoSalt: 2260, h0: 2000, bump: 200, mode: 2, cover0: 400, rhoSolidFrac: 0.35 }, o);
  const P = stripParams(o);
  const st = S.createState(P);
  const nx = o.nx, e0 = P.linear.e0;
  st.initSolid = 0; st.initSand = 0; st.initSalt = 0;
  for (let j = 0; j < nx; j++) {
    const hs = o.h0 + o.bump * Math.cos(Math.PI * o.mode * (j + 0.5) / nx);
    const cover = o.cover0 - (hs - o.h0);                       // flat seafloor: thicker salt, thinner cover
    st.hs[j] = hs; st.b[j] = -3000 - o.h0 - 0;                  // flat basement
    const solid = cover / (1 + e0);
    st.sand[j] = o.rhoSolidFrac * solid; st.mud[j] = (1 - o.rhoSolidFrac) * solid;
    st.initSolid += solid * o.dx; st.initSand += o.rhoSolidFrac * solid * o.dx; st.initSalt += hs * o.dx;
  }
  S.recomputeH(st, P);
  return { P, st, o };
}

/** add sediment (new layer st.k) to every column whose seafloor is below the level L: the seafloor is levelled, as in a basin kept full */
function fillToLevel(st, P, L, fs) {
  const nx = st.nx, e0 = P.linear.e0, lay = st.k;
  for (let j = 0; j < nx; j++) {
    const need = L - st.H[j];
    if (!(need > 0)) continue;
    const solid = need / (1 + e0), i = lay * nx + j;
    st.sand[i] += fs * solid; st.mud[i] += (1 - fs) * solid;
    st.cumIn += solid * P.dx; st.cumInS += fs * solid * P.dx;
    st.H[j] += need;
  }
  S.recomputeH(st, P);
}

/** run and return time series: t (Myr), crest column, crest cover (depth below the seafloor, m), salt top, seafloor, max |dhs|.
 *  c.o.level = { L0, rate }: after each step fill every low column up to L0 + rate t (rate in m/yr). */
function runStrip(c, every = 5) {
  const { P, st } = c, series = [], lv = c.o.level;
  const rec = () => {
    let jm = 0; for (let j = 1; j < st.nx; j++) if (st.b[j] + st.hs[j] > st.b[jm] + st.hs[jm]) jm = j;
    let zf = 0; for (let j = 0; j < st.nx; j++) zf += st.H[j]; zf /= st.nx;
    series.push({ t: st.k * P.dtRec / 1e6, j: jm, depth: st.cover[jm], top: st.b[jm] + st.hs[jm], seafloor: st.H[jm], meanSurface: zf, level: lv ? lv.L0 + lv.rate * st.k * P.dtRec : NaN, hsCrest: st.hs[jm], hsMin: Math.min(...st.hs), hsMax: Math.max(...st.hs) });
  };
  rec();
  while (S.step(st, P)) {
    if (lv) fillToLevel(st, P, lv.L0 + lv.rate * st.k * P.dtRec, 0.35);
    if (st.k % every === 0) rec();
  }
  rec();
  return series;
}

/** equal-density null: all densities 2160 (cover = salt), flat seafloor, uneven salt top. Returns max salt thickness change (m). */
function nullCase(rhoCover) {
  const c = makeStrip({ rhoCover, rhoSalt: 2160, tMyr: 2, dtRec: 20000, saltVisc: 1e17, bump: 200, cover0: 600 });
  const h0 = Float64Array.from(c.st.hs);
  const ser = runStrip(c, 10);
  let d = 0; for (let j = 0; j < c.st.nx; j++) d = Math.max(d, Math.abs(c.st.hs[j] - h0[j]));
  return { maxChange: d, series: ser, c };
}

/** GL24-like down-building: 2 km salt, steady aggradation 200 m/Myr, cover 2600, salt 2260 kg/m3 */
function gl24Case(over) {
  const c = makeStrip(Object.assign({ nx: 100, dx: 1000, tMyr: 50, dtRec: 20000, A: 0, saltVisc: 1e18, coverVisc: 1e20, rhoCover: 2600, rhoSalt: 2260, h0: 2000, bump: 200, mode: 2, cover0: 400, level: { L0: -2600, rate: 2e-4 } }, over));
  const ser = runStrip(c, 25);
  return { series: ser, c };
}

module.exports = { makeStrip, runStrip, nullCase, gl24Case, gl24Summary, e0For };

/** numbers for the README: crest depth between 20 and 50 Myr, rise rate against the surface rate, time the source is drained, stem width */
function gl24Summary(g, rateMyr) {
  const s = g.series, w = s.filter((q) => q.t >= 20 - 1e-9);
  const depths = w.map((q) => q.depth), top = w.map((q) => [q.t, q.top]);
  const n = top.length, mt = top.reduce((a, p) => a + p[0], 0) / n, my = top.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0; for (const [t, y] of top) { sxy += (t - mt) * (y - my); sxx += (t - mt) * (t - mt); }
  const drained = s.find((q) => q.hsMin < 0.1 * g.c.o.h0);
  const hs = g.c.st.hs, hmax = Math.max(...hs); let width = 0; for (let j = 0; j < hs.length; j++) if (hs[j] > 0.5 * hmax) width++;
  return { depthMin: Math.min(...depths), depthMax: Math.max(...depths), rise: sxy / sxx, surfaceRate: rateMyr, drainedMyr: drained ? drained.t : NaN,
    hsMax: hmax, stemWidthKm: width * g.c.o.dx / 1000, crestDepthEnd: s[s.length - 1].depth, depth0: s[0].depth,
    domeAboveLevelEnd: s[s.length - 1].seafloor - s[s.length - 1].level };
}

if (require.main === module) {
  const n0 = nullCase(2160), n1 = nullCase(2600);
  console.log(`null (cover 2160 = salt 2160): max salt change ${n0.maxChange.toExponential(2)} m; contrast case (cover 2600): ${n1.maxChange.toFixed(2)} m`);
  const over = JSON.parse(process.argv[2] || '{}');
  const g = gl24Case(over);
  const mb = S.massBalance(g.c.st, g.c.P);
  console.log(`gl24-like: balance salt ${mb.saltRelError.toExponential(1)} sand ${mb.sandRelError.toExponential(1)} mud ${mb.mudRelError.toExponential(1)} clip ${mb.saltClip} limited ${mb.saltLimited}`);
  for (const s of g.series.filter((q, i) => i % 4 === 0)) console.log(`t ${s.t.toFixed(1)} Myr crest col ${s.j} depth ${s.depth.toFixed(0)} m top ${s.top.toFixed(0)} seafloor ${s.seafloor.toFixed(0)} hs crest ${s.hsCrest.toFixed(0)} min ${s.hsMin.toFixed(0)} max ${s.hsMax.toFixed(0)}`);
}
