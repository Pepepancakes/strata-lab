// node test.js  - spike 003 checks: stay-at-the-seafloor rule, wall shape, conservation, determinism, grid,
// cover bending at zero thickness, power-law mobility. Prints the tables that go into README.md.
const S = require('./engine.js');
const { makeCtrl, runCtrl } = require('./ctrl.js');
const { YR } = { YR: S.consts.YR };
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const hash = (st) => { let h = 0; for (const key of ['sand', 'mud', 'hs', 'b', 'H']) { const a = st[key]; for (let i = 0; i < a.length; i += 1) { const v = a[i]; h = (h * 31 + (v * 1e6 | 0)) | 0; } } return h; };

// ---- 1. stay-at-the-seafloor rule (prescribed feed, constant A) ----------------------------------------------
// Hand calculation. Strip of nT columns, nD diapir columns fed with a fixed salt flux Q (rise rate R = Q / W,
// W = nD dx), nF = nT - nD flank columns, every column receives A of sediment per year. While the crest is at or
// above the flank seafloor it sheds all arrivals to the flanks, so the flank seafloor rises at A_eff = A nT / nF.
// The crest stays at the seafloor iff R >= A_eff. If R < A_eff the crest is buried: with rho = nD / nF the cover grows at
// (A_eff - R) / (1 + rho) (derivation in README).
console.log('\n== 1. stay-at-the-seafloor rule: nT 100, nD 3, dx 1000 m, A 1.0 mm/yr, 1 Myr ==');
{
  const nT = 100, nD = 3, nF = nT - nD, A = 1e-3, Aeff = A * nT / nF, rho = nD / nF;
  console.log('R/Aeff | R (mm/yr) | predicted | cover at 1 Myr (m): model / predicted | crest minus flank (m) | at seafloor?');
  let allOk = true, mbMax = { salt: 0, sand: 0, mud: 0 };
  for (const f of [0.25, 0.5, 0.8, 0.95, 0.99, 1.0, 1.01, 1.05, 1.5, 2, 4]) {
    const R = f * Aeff, c = makeCtrl({ nx: nT, nD, A, R });
    const ser = runCtrl(c), last = ser[ser.length - 1];
    const predCover = Math.max(0, (Aeff - R) * 1e6 / (1 + rho));
    const stays = last.cover < c.P.roofMin;
    const expect = R >= Aeff * (1 - 1e-12);
    const tol = 0.012 * predCover + A * c.P.dtRec; // 1.2 % plus one record step of deposition
    const good = stays === (f * 1 >= 1 - 0.0021) && Math.abs(last.cover - predCover) <= tol;
    allOk = allOk && good;
    const mb = S.massBalance(c.st, c.P);
    mbMax.salt = Math.max(mbMax.salt, Math.abs(mb.saltRelError)); mbMax.sand = Math.max(mbMax.sand, Math.abs(mb.sandRelError)); mbMax.mud = Math.max(mbMax.mud, Math.abs(mb.mudRelError));
    console.log(`${f.toFixed(2).padStart(6)} | ${(R * 1e3).toFixed(4)} | ${expect ? 'stays' : 'buried'} | ${last.cover.toFixed(2).padStart(8)} / ${predCover.toFixed(2).padStart(8)} | ${last.rel.toFixed(1).padStart(8)} | ${stays ? 'yes' : 'no'}`);
  }
  ok(allOk, 'stay rule: crest at the seafloor iff R >= A_eff (resolved to 0.2 % at 1 Myr); cover thickness within 1.2 % + one step of the closed form');
  ok(mbMax.salt < 1e-12 && mbMax.sand < 1e-9 && mbMax.mud < 1e-9, `conservation over the table: salt ${mbMax.salt.toExponential(1)}, sand ${mbMax.sand.toExponential(1)}, mud ${mbMax.mud.toExponential(1)}`);
  // bypassed sediment is not lost: moved mass = A * W * t when the crest is exposed all the time (R >= A_eff)
  const c = makeCtrl({ nx: nT, nD, A, R: 2 * Aeff }); runCtrl(c);
  const mb = S.massBalance(c.st, c.P);
  const expectMoved = A * nD * 1e3 * 1e6 * (1 - 0.35 / 1.5 * 0 ) ; // bulk m^2 -> solids: compare as bulk below
  const movedBulk = (mb.bypassSand + mb.bypassMud) * 1.5; // linear mode: bulk = solids x (1 + e0), e0 = 0.5
  ok(Math.abs(movedBulk / (A * nD * 1e3 * 1e6) - 1) < 0.01, `bypass moved ${(movedBulk / 1e6).toFixed(2)} km2 of bulk sediment, hand calc A W t = ${(A * nD * 1e3 * 1e6 / 1e6).toFixed(2)} km2`);
}

// ---- 2. determinism ----------------------------------------------------------------------------------------
console.log('\n== 2. determinism ==');
{
  const run = () => { const c = makeCtrl({ A: 1e-3, R: 1.5e-3, flow: true, nx: 120, nZone: 10, tMyr: 0.5 }); runCtrl(c); return hash(c.st); };
  ok(run() === run(), 'two flow-on controlled runs give identical output');
  const small = () => { const P = S.defaultParams(); Object.assign(P, { nx: 100, duration: 2e6, dtRec: 20000, saltThick: 1500, coverNoise: 0.5, coverThick: 100, saltVisc: 1e17, coverBend: 1, limiter: 1, exposed: 1, shed: 1, supply: 40 });
    const st = S.createState(P); while (S.step(st, P)) {} return { h: hash(st), st, P }; };
  const a = small(), b = small();
  ok(a.h === b.h, 'two full-engine runs (bending, limiter, bypass, roof thinning on) give identical output');
  const mb = S.massBalance(a.st, a.P);
  ok(Math.abs(mb.saltRelError) < 1e-12 && Math.abs(mb.sandRelError) < 1e-9 && Math.abs(mb.mudRelError) < 1e-9 && mb.saltClip === 0,
    `full engine, 2 Myr, all new options on: salt ${mb.saltRelError.toExponential(1)}, sand ${mb.sandRelError.toExponential(1)}, mud ${mb.mudRelError.toExponential(1)}, clip ${mb.saltClip}, deficit ${mb.deficitFrac.toExponential(1)} of supply, bypassed ${(mb.bypassSand + mb.bypassMud).toExponential(2)} m2, shed ${(mb.shedSand + mb.shedMud).toExponential(2)} m2`);
}

// ---- 3. wall shape ------------------------------------------------------------------------------------------
console.log('\n== 3. wall shape with thin-sheet flow on (nx 200, dx 1000 m, 3 fed columns, A 1 mm/yr, feed Q = f A W0) ==');
{
  const res = {};
  for (const f of [0.5, 1, 2, 4]) {
    const c = makeCtrl({ A: 1e-3, R: f * 1e-3, flow: true, tMyr: 2, nx: 200, nZone: 15 });
    const { st, P } = c, row = [];
    let zeroMass = 0;
    while (S.step(st, P)) {
      if (st.k % 20 === 0) {
        let zf = 0; for (const j of c.flank) zf += st.H[j]; zf /= c.flank.length;
        let w = 0; for (let j = 0; j < st.nx; j++) if (st.hs[j] > 0 && st.cover[j] < P.roofMin) w++;
        let ws = 0; for (let j = 0; j < st.nx; j++) if (st.hs[j] > 1) ws++;
        row.push({ t: st.k * P.dtRec / 1e6, r: st.b[100] + st.hs[100] - zf, w, ws });
      }
    }
    res[f] = row;
    const mb = S.massBalance(st, P);
    zeroMass = Math.max(Math.abs(mb.saltRelError), Math.abs(mb.sandRelError), Math.abs(mb.mudRelError));
    console.log(`f=${f}: exposed width (km) every 0.1 Myr: ${row.map((x) => x.w).join(' ')} | crest relief (m): ${row.filter((x, i) => i % 3 === 2).map((x) => x.r.toFixed(0)).join(' ')} | salt body width at end ${row[row.length - 1].ws} km | max balance error ${zeroMass.toExponential(1)}`);
  }
  const w = (f) => res[f].map((x) => x.w);
  ok(w(0.5).every((v) => v === 0) || Math.max(...w(0.5)) <= 3, 'R < A: the exposed wall never widens (crest is buried)');
  ok(Math.max(...w(4)) > 3 && w(4)[1] >= w(4)[0], 'R = 4 A: the exposed wall widens upward (3 km to 9 km)');
  ok(w(4)[w(4).length - 1] < Math.max(...w(4)), 'R = 4 A at first, then the salt spreads sideways under the flanks, R = Q / W falls below A and the wall narrows');
  ok(res[2].every((x) => x.w === 0 || x.r > -1e-6), 'exposed salt only where the crest stands at or above the flank seafloor');
}

// ---- 4. grid ------------------------------------------------------------------------------------------------
console.log('\n== 4. grid: dx 1000 vs 500 m (same 100 km strip, same 3 km wide diapir) ==');
{
  const rows = [];
  for (const [dx, nx, nD] of [[1000, 100, 3], [500, 200, 6]]) {
    const nF = nx - nD, Aeff = 1e-3 * nx / nF;
    for (const f of [0.9, 1.1]) {
      const c = makeCtrl({ nx, dx, nD, A: 1e-3, R: f * Aeff }); const ser = runCtrl(c), last = ser[ser.length - 1];
      let w = 0; for (let j = 0; j < nx; j++) if (c.st.hs[j] > 0 && c.st.cover[j] < c.P.roofMin) w++;
      rows.push({ dx, f, cover: last.cover, w: w * dx });
    }
  }
  for (const r of rows) console.log(`dx ${r.dx} m, R/Aeff ${r.f}: cover ${r.cover.toFixed(1)} m, width at the seafloor ${r.w} m`);
  ok(rows[1].w === 3000 && rows[3].w === 3000 && rows[0].w === 0 && rows[2].w === 0, 'prescribed feed: crest at the seafloor (3,000 m wide) at both dx for R > A_eff, buried at both for R < A_eff');
  const fl = [];
  for (const [dx, nx, nD, nZ] of [[1000, 200, 3, 15], [500, 400, 6, 30]]) {
    const c = makeCtrl({ A: 1e-3, R: 4e-3, flow: true, tMyr: 0.5, nx, dx, nD, nZone: nZ });
    // keep the feed per metre of width the same: R is the rise rate over the fed width, so Q = R nD dx is the same 3 km x R
    while (S.step(c.st, c.P)) {}
    let w = 0; for (let j = 0; j < nx; j++) if (c.st.hs[j] > 0 && c.st.cover[j] < c.P.roofMin) w++;
    fl.push({ dx, w: w * dx, cover: c.st.cover[nx / 2] });
  }
  console.log(`flow on, R = 4 A, 0.5 Myr: width at the seafloor ${fl[0].w} m at dx 1000, ${fl[1].w} m at dx 500`);
  ok(fl[0].w > 0 && fl[1].w > 0 && Math.abs(fl[1].w / fl[0].w - 1) <= 0.35, 'with flow on the crest survives refinement; widths at the seafloor within 35 % (it is the exposed width of one bump, a few cells wide at dx 1000 - see README)');
}

// ---- 5. cover bending when the cover goes to zero --------------------------------------------------------------
console.log('\n== 5. cover bending at zero cover ==');
{
  const P = S.defaultParams(); P.coverBend = 1;
  const nx = 40, h0 = 1500;
  const st = S.bareSaltState(P, nx, h0, 1, 4);
  const sc = st.scratch;
  for (let j = 0; j < nx; j++) sc.Sb[j] = j % 7 === 3 ? 0 : 800 + 50 * (j % 5);        // some columns with no cover at all
  S.coverStiffness(st, P, 1);
  const B = S.bendState(st);
  // K as a dense matrix from the three stored bands, then x^T K x >= 0 and K (constant) = 0, K (linear) = 0
  const Kd = Array.from({ length: nx }, () => new Float64Array(nx));
  for (let i = 0; i < nx; i++) { Kd[i][i] = B.s0[i]; if (i + 1 < nx) { Kd[i][i + 1] = B.s1[i]; Kd[i + 1][i] = B.s1[i]; } if (i + 2 < nx) { Kd[i][i + 2] = B.s2[i]; Kd[i + 2][i] = B.s2[i]; } }
  const mul = (x) => Kd.map((r) => r.reduce((a, v, k) => a + v * x[k], 0));
  const kmax = Math.max(...Kd.map((r) => Math.max(...r.map(Math.abs))));
  let minq = Infinity;
  for (let t = 0; t < 50; t++) { const x = Array.from({ length: nx }, (_, i) => Math.sin(1.3 * t * i + t) + 0.1 * t); const y = mul(x); minq = Math.min(minq, x.reduce((a, v, i) => a + v * y[i], 0)); }
  const yc = mul(new Array(nx).fill(1)), yl = mul(Array.from({ length: nx }, (_, i) => i));
  ok(minq >= -1e-9 * kmax, `K stays positive semi-definite with columns of zero cover (min x'Kx / max|K| = ${(minq / kmax).toExponential(1)})`);
  // the ends are mirror ends (zero slope, as in src/engine/salt.ts), so only a rigid shift is free everywhere;
  // a tilt is free away from the two end rows
  ok(Math.max(...yc.map(Math.abs)) < 1e-9 * kmax && Math.max(...yl.slice(3, nx - 3).map(Math.abs)) < 1e-9 * kmax * nx, 'rigid shift costs nothing (K 1 = 0); tilt costs nothing away from the mirror ends');
  // limit h_c -> 0: relaxation of a bare-salt bump with bending on equals the M3.1 result bit for bit
  const a = S.saltRelaxation(4, 1e17, 20);
  const P2 = S.defaultParams(); P2.slAmp = 0; P2.slShift = 0; P2.saltVisc = 1e17; P2.coverBend = 1;
  const nxb = 100, st2 = S.bareSaltState(P2, nxb, 1500, 1, 4), st1 = S.bareSaltState(P2, nxb, 1500, 1, 4);
  const Poff = Object.assign({}, P2, { coverBend: 0 });
  for (let s = 0; s < 20; s++) { S.saltStep(st2, P2, 0, P2.dtRec); S.saltStep(st1, Poff, 0, P2.dtRec); }
  let md = 0; for (let j = 0; j < nxb; j++) md = Math.max(md, Math.abs(st2.hs[j] - st1.hs[j]));
  ok(md < 1e-6, `bare salt (cover 0): bending on vs off differ by ${md.toExponential(1)} m after 20 steps (decay rate error vs linear theory ${(a.relErr * 100).toFixed(2)} %)`);
}

// ---- 6. power-law mobility ----------------------------------------------------------------------------------
console.log('\n== 6. power-law salt: mobility formula ==');
{
  const P = S.defaultParams(); P.saltVisc = 1e18;
  const nx = 3, h = 1000, st = S.bareSaltState(P, nx, h, 0, 1);
  st.scratch.Phi[0] = 2e6; st.scratch.Phi[1] = 0; st.scratch.Phi[2] = 0;
  const G = (2e6 - 0) / P.dx;
  for (const n of [1, 3, 4, 5]) {
    const Pn = Object.assign({}, P, { saltN: n, saltTauRef: 1e5 });
    S.faceMobility(st, Pn, st.hs);
    const A = 1 / (1e18 * Math.pow(1e5, n - 1));
    // hand calculation of the channel flux: q = 2 A G^n (h/2)^(n+2) / (n+2); M = q / G
    const q = 2 * A * Math.pow(G, n) * Math.pow(h / 2, n + 2) / (n + 2);
    const M = st.scratch.M[0];
    ok(Math.abs(M * G / q - 1) < 1e-12, `n=${n}: flux ${(M * G * YR).toFixed(4)} m2/yr matches the hand calculation ${(q * YR).toFixed(4)}; Newtonian h^3/12eta = ${(h * h * h / 12 / 1e18 * G * YR).toFixed(4)}`);
    if (n === 1) ok(M === h * h * h / (12 * 1e18), 'n=1 is exactly the Newtonian mobility');
  }
}

// ---- 7. S3b: start salt equals main's initialSaltThickness -----------------------------------------------------
// Async part: main's function is TypeScript, so it is loaded through vite (a dev dependency of the repo), the same way
// scripts/review/*.mjs do. The spike's own function is a JS port; this check keeps it from drifting.
async function s3bChecks() {
  const path = require('path');
  const { gulfParams } = require('./gulf.js');
  const { runCase, aggregate } = require('./s3b.js');
  const { trackCrests, summarise } = require('./crestlog.js');
  const Q = require('./qc.js');
  const { withUlpNoise, AMP } = require('./ulp.js');

  console.log('\n== 7. start salt against main (M3.10) ==');
  const { createServer } = await import('vite');
  const root = path.join(__dirname, '..', '..');
  const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const main = await server.ssrLoadModule('/src/engine/salt.ts');
    const cmp = (P, label) => {
      const mainP = { saltThick: P.saltThick, saltPinchStart: P.saltPinch[0], saltPinchEnd: P.saltPinch[1], saltLimitStart: P.saltLimit[0], saltLimitEnd: P.saltLimit[1] };
      const st = S.createState(P);
      let worst = 0, nonzero = 0;
      for (let j = 0; j < P.nx; j++) { const h = main.initialSaltThickness(mainP, (j + 0.5) * P.dx); worst = Math.max(worst, Math.abs(h - st.hs[j])); if (h > 0) nonzero++; }
      ok(worst <= 1e-9, `${label}: spike starting salt equals main's initialSaltThickness at all ${P.nx} columns (${nonzero} with salt), worst difference ${worst.toExponential(1)} m`);
    };
    cmp(gulfParams({ exposed: 1 }), 'Gulf preset (pinch 10/100 km, limit 200/240 km)');
    cmp(Object.assign(S.defaultParams(), { nx: 150, saltOn: true }), 'spike defaults (pinch 25/45 km, default limit beyond the section)');
    cmp(gulfParams({ saltLimit: [150000, 170000], saltThick: 3000 }), 'Gulf with another limit (150/170 km) and 3000 m');
    const g = gulfParams({ exposed: 1 }), sg = S.createState(g);
    ok(sg.hs[300] === 0 && sg.hs[150] > 3000, `Gulf start: no salt at 300 km (${sg.hs[300]} m), ${sg.hs[150].toFixed(0)} m at 150 km`);
  } finally { await server.close(); }

  console.log('\n== 8. crest log: hand calculation ==');
  {
    // synthetic strip: crest column 20 stands 100 m above a flat flank at t = 0, rises F = 100 m/Myr; the flank rises A = 300 m/Myr.
    // Relief = 100 + (F - A) t = 0 at t = 0.5 Myr (exposed until the flank is 2 m above it), cover = (A - F) t - 100 reaches 500 m at t = 3.0 Myr.
    const nx = 40, F = 100, A = 300, P = { dtRec: 1e5, weldThick: 100, roofMin: 2, dx: 1000, saltThick: 4000 };
    const st = { nx, k: 0, b: new Float64Array(nx).fill(-5000), hs: new Float64Array(nx).fill(3000), H: new Float64Array(nx), cover: new Float64Array(nx) };
    const hs0 = Float64Array.from(st.hs);
    const setT = () => {
      const t = st.k * 0.1, Hf = -1800 + A * t;
      st.hs[20] = 3300 + F * t;                                      // crest salt top = -1700 + F t; flank surface = -1800 + A t
      for (let j = 0; j < nx; j++) { const zt = st.b[j] + st.hs[j]; st.H[j] = j === 20 ? Math.max(Hf, zt) : Hf; st.cover[j] = st.H[j] - zt; }
    };
    // flat salt (3000 m) has its top at -2000 m, so the flank surface -1800 + A t sits 200 m + A t above it: cover 200 m at t = 0
    setT();
    const eps = trackCrests(st, P, hs0, () => { if (st.k >= 60) return false; st.k++; setT(); return true; });
    const rows = eps.map((e) => summarise(e, P, hs0, 0.1));
    const r = rows.find((x) => x.exposedEver);
    ok(!!r && rows.length === 1, `one crest found and logged (${rows.length})`);
    ok(Math.abs(r.F_ep - F) < 1e-6 && Math.abs(r.A_ep - A) < 1e-6 && Math.abs(r.FmA_ep - (F - A)) < 1e-6, `F ${r.F_ep.toFixed(6)} A ${r.A_ep.toFixed(6)} F-A ${r.FmA_ep.toFixed(6)} m/Myr against 100 / 300 / -200`);
    ok(r.D === 0, 'dissolution D is 0 (the spike has none)');
    ok(Math.abs(r.exposedMyr - 0.5) <= 0.1 + 1e-9, `exposed ${r.exposedMyr.toFixed(2)} Myr against the hand value 0.49 (to one 0.1 Myr step)`);
    ok(r.endWhy === 'buried' && Math.abs(r.tEnd - 3.0) <= 0.1 + 1e-9, `buried at ${r.tEnd.toFixed(2)} Myr (hand value 3.0 +- one step), ${r.endWhy}`);
    ok(r.nbClass === 'thick' && Math.abs(r.nb5 - 3000) < 1e-9, `neighbours at burial: ${r.nb1.toFixed(0)} / ${r.nb5.toFixed(0)} / ${r.nb10.toFixed(0)} m (flat 3000 m), class ${r.nbClass}`);
  }

  console.log('\n== 9. equal-density null (QC 5b, GL24 Fig. 5a) ==');
  {
    const n0 = Q.nullCase(2160), n1 = Q.nullCase(2600);
    console.log(`flat seafloor, 200 m salt-top relief, 2 Myr: cover density 2160 (= salt) max salt change ${n0.maxChange.toExponential(2)} m; cover 2600: ${n1.maxChange.toFixed(1)} m`);
    ok(n0.maxChange < 1e-9, 'equal densities: no flux (salt thickness unchanged to 1e-9 m)');
    ok(n1.maxChange > 10, 'control: with a density contrast of 440 kg/m3 the same geometry moves salt (more than 10 m)');
  }

  console.log('\n== 10. GL24-like down-building with a thick source (QC 15) ==');
  {
    const cases = [['base: salt 1e18, cover plate 1e20, 200 m/Myr', {}, 200], ['salt 1e19', { saltVisc: 1e19 }, 200], ['no cover bending', { coverVisc: 0 }, 200], ['100 m/Myr', { level: { L0: -2600, rate: 1e-4 } }, 100], ['400 m/Myr', { level: { L0: -2600, rate: 4e-4 } }, 400]];
    console.log('case | crest depth 20-50 Myr (m) min..max | rise m/Myr against surface | source drained (Myr) | max salt (m)');
    let base;
    for (const [label, over, rate] of cases) {
      const g = Q.gl24Case(Object.assign({ bump: -200 }, over)), sm = Q.gl24Summary(g, rate);
      const mb = S.massBalance(g.c.st, g.c.P);
      console.log(`${label} | ${sm.depthMin.toFixed(0)}..${sm.depthMax.toFixed(0)} | ${sm.rise.toFixed(0)} / ${rate} | ${sm.drainedMyr} | ${sm.hsMax.toFixed(0)}; balance salt ${mb.saltRelError.toExponential(1)} sand ${mb.sandRelError.toExponential(1)} mud ${mb.mudRelError.toExponential(1)}`);
      ok(Math.abs(mb.saltRelError) < 1e-12 && Math.abs(mb.sandRelError) < 1e-9 && Math.abs(mb.mudRelError) < 1e-9 && mb.saltClip === 0, `  conservation: ${label}`);
      if (!base) base = { g, sm };
    }
    ok(Math.abs(base.sm.rise - 200) / 200 < 0.1 && base.sm.depthMax - base.sm.depthMin < 50, `base case: the crest rises with the surface (${base.sm.rise.toFixed(0)} against 200 m/Myr) at a steady depth ${base.sm.depthMin.toFixed(0)} to ${base.sm.depthMax.toFixed(0)} m for 20 to 50 Myr`);
    const a = Q.gl24Case({ bump: -200, tMyr: 4 }), b = Q.gl24Case({ bump: -200, tMyr: 4 });
    ok(hash(a.c.st) === hash(b.c.st), 'GL24-like run is deterministic');
  }

  console.log('\n== 11. Gulf run on the M3.10 start with the crest log ==');
  {
    const r = runCase({});
    const mb = r.mb, ag = aggregate(r.rows);
    console.log(`crests ${ag.crests}, exposed ${ag.exposed} (interior ${ag.interior}, toe ${ag.toe}), buried ${ag.buried}; exposed Myr ${ag.exposedMyr} (median ${ag.exposedMyrMedian.toFixed(1)}); F-A at burial ${ag.FmA_pre}; neighbours thick/mid/depleted ${ag.nbThick}/${ag.nbMid}/${ag.nbDepleted}; salt at +-10 km ${ag.nb10} m`);
    ok(Math.abs(mb.saltRelError) < 1e-12 && Math.abs(mb.sandRelError) < 1e-9 && Math.abs(mb.mudRelError) < 1e-9 && mb.saltClip === 0, `Gulf balance: salt ${mb.saltRelError.toExponential(1)} sand ${mb.sandRelError.toExponential(1)} mud ${mb.mudRelError.toExponential(1)} clip ${mb.saltClip}`);
    ok(ag.exposed >= 1 && r.rows.every((x) => x.D === 0), 'crests were logged, every row has D = 0');
    const powBefore = Math.pow;
    const noisy = withUlpNoise(AMP, 3, () => Array.from({ length: 50 }, (_, i) => Math.pow(1.1 + i, 0.37)));
    const plain = Array.from({ length: 50 }, (_, i) => Math.pow(1.1 + i, 0.37));
    const nDiff = noisy.filter((v, i) => v !== plain[i]).length, maxRel = Math.max(...noisy.map((v, i) => Math.abs(v / plain[i] - 1)));
    ok(Math.pow === powBefore && nDiff > 0 && maxRel <= 4.5e-16, `1 ulp helper: restores Math.pow, changes ${nDiff} of 50 results by at most ${maxRel.toExponential(1)} (relative, under 2 ulp)`);
  }
}

s3bChecks().then(() => {
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
