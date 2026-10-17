'use strict';
// The two S4 cases run through the Stokes solver (stokes.js). Offline, node only, never ships.
//   node cases.js gulf <res> [coverFactor]    decisive Gulf case (spike 003 s4-case.json), res = A (coarse) or B (fine)
//   node cases.js gl24 <res>                  GL24-like down-building case
// Output: <scratch>/out-<name>.json (series + profiles) and a one-line summary on stdout.
// Set S4_SCRATCH to choose the output folder (default: a folder under the OS temp dir).
//
// Frame. All elevations z are in the frame of the basement at t = tNear (z up). The thin-sheet run lowers the basement by
// subsidence; here the basement is fixed and the sea level and the sediment level are raised by the same amount (the flow
// only depends on differences of surface elevation, and a rise of the whole water column adds a uniform pressure).
// Prescribed sedimentation. The thin-sheet seafloor of the plain Gulf run, median filtered over 11 columns (11 km, removes
// crests narrower than about 5 km), plus the mean basement drop, is the sediment LEVEL: every water marker below it becomes
// cover. Where salt stands above the level it stays exposed. Sediment is never removed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('./stokes.js');

const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const CFL = +process.env.S4_CFL || 0.5;   // advection Courant number
const ETAW = +process.env.S4_ETAW || 1e16;   // sticky-water viscosity
const WATER = 0, SALT = 1, COVER = 2, BASE = 3;
const YR = 3.15576e7;

// ----- cover density: Athy porosity with the engine's 35 % sand / 65 % mud mix (spike 003 engine.js comment: 0.27e-3 and 0.51e-3 per m)
const RHO_W = 1025, RHO_S = 2650, PHI0 = 0.35 * 0.49 + 0.65 * 0.63, CPOR = 0.35 * 0.27e-3 + 0.65 * 0.51e-3;
const athyRho = (d) => { const phi = PHI0 * Math.exp(-CPOR * d); return RHO_W * phi + RHO_S * (1 - phi); };

function interp(xs0, dx, arr, x) {   // arr at x = xs0 + (i+0.5) dx
  let f = (x - xs0) / dx - 0.5; if (f < 0) f = 0; if (f > arr.length - 1) f = arr.length - 1;
  const i = Math.min(arr.length - 2, Math.floor(f)), w = f - i;
  return (1 - w) * arr[i] + w * arr[i + 1];
}
function median(a) { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; }

// ----- case definitions: each returns the model options, the sediment level function and the crest tracker settings
function gulfCase(res, coverFactor) {
  // S4B=1: the S4b rerun. Start section, forcing and thin-sheet comparison crest come from the FIXED spike 003 (dump_s4b.js, s4b-case.json).
  const S4B = !!process.env.S4B;
  const start = S4B ? require(process.env.S4B_CASE || './s4b-case.json').start : require('./start-gulf.json'), fr = require(path.join(SCR, S4B ? 'forcing-s4b.json' : 'forcing-gulf.json'));
  const C = require('../003-passive-diapir/s4-case.json').decisiveCase;
  if (S4B) { const B = require(process.env.S4B_CASE || './s4b-case.json'); C.thinSheetResult = { tNearMyr: B.crest.tNearMyr, tExposedMyr: B.crest.tExposedMyr, tBuriedMyr: B.crest.tEndMyr }; C.aggradationHistory = { series: B.thinSeries.filter((q, i) => i % 5 === 0) }; }
  const colIdx0 = 15, colIdx1 = 104;                           // window columns 226 .. 315 of the 211 .. 331 dump
  const dxD = start.dxM, cols = start.columns.slice(colIdx0, colIdx1 + 1);
  const x0 = cols[0].xM - dxD / 2, W = cols.length * dxD;
  const base = cols.map((c) => c.baseM), saltTop = cols.map((c) => c.baseM + c.saltM), sea = cols.map((c) => c.seafloorM);
  const b0 = fr.frames[0].b.slice(colIdx0, colIdx1 + 1).reduce((s, v) => s + v, 0) / cols.length;
  // level in the fixed basement frame, per frame
  const lev = fr.frames.map((f) => {
    const drop = b0 - f.b.slice(colIdx0, colIdx1 + 1).reduce((s, v) => s + v, 0) / cols.length;
    const out = [];
    for (let i = colIdx0; i <= colIdx1; i++) { const w = []; for (let q = Math.max(0, i - 5); q <= Math.min(f.H.length - 1, i + 5); q++) w.push(f.H[q]); out.push((process.env.S4_UNFILT ? f.H[i] : median(w)) + drop); }   // S4_UNFILT=1: level is the raw thin-sheet seafloor (no median filter)
    return { t: f.tMyr, z: out, drop };
  });
  let zmax = -1e9, zmin = 1e9;
  for (const f of lev) for (const z of f.z) zmax = Math.max(zmax, z);
  for (const b of base) zmin = Math.min(zmin, b);
  const zt = Math.ceil((zmax + 400) / 100) * 100, zb = Math.floor((zmin - 500) / 100) * 100;
  const dyT = res === 'A' ? 250 : 500 / 3, dxT = res === 'A' ? 500 : 1000 / 3;
  const nx = Math.round(W / dxT), ny = Math.round((zt - zb) / dyT);
  const cf = coverFactor || 1;
  return {
    name: 'gulf-' + res + (cf !== 1 ? '-cov' + cf : '') + (process.env.S4_TAG || ''), x0, W, zb, zt, nx, ny, tStart: start.tMyr, tEnd: process.env.S4_TEND ? +process.env.S4_TEND : lev[lev.length - 1].t, dtCap: 2e5, recMyr: 0.5,
    mats: [{ rho: RHO_W, eta: ETAW }, { rho: 2160, eta: C.viscosities.saltPaS }, { rho: 0, eta: C.viscosities.coverPaS * cf, compact: true }, { rho: 2700, eta: 1e23 }],
    compaction: athyRho, bottom: 'noslip', etaRef: 1e18,
    init: (x, z) => { const X = x; const b = interp(x0, dxD, base, X), s = interp(x0, dxD, saltTop, X), h = interp(x0, dxD, sea, X); return z < b ? BASE : z < s ? SALT : z < h ? COVER : WATER; },
    levelAt: (tAbs) => {     // returns array over the window columns (z), linear in time
      let q = 0; while (q < lev.length - 2 && lev[q + 1].t <= tAbs) q++;
      const a = lev[q], b = lev[q + 1], w = Math.min(1, Math.max(0, (tAbs - a.t) / (b.t - a.t)));
      return { z: a.z.map((v, i) => (1 - w) * v + w * b.z[i]), x0, dx: dxD };
    },
    crest: { x0km: 270.5, halfKm: 4, trackKm: 3, flankKm: [3, 5], zoneKm: [262, 285] },
    thin: { tNear: C.thinSheetResult.tNearMyr, tExposed: C.thinSheetResult.tExposedMyr, tBuried: C.thinSheetResult.tBuriedMyr },
    thinSeries: C.aggradationHistory.series,
    drop: (tAbs) => { let q = 0; while (q < lev.length - 2 && lev[q + 1].t <= tAbs) q++; const a = lev[q], b = lev[q + 1], w = Math.min(1, Math.max(0, (tAbs - a.t) / (b.t - a.t))); return (1 - w) * a.drop + w * b.drop; },
  };
}

function gl24Case(res) {
  const G = require('../003-passive-diapir/s4-case.json').gl24LikeCase;
  const L = 1e5, h = (x) => 2000 - 200 * Math.cos(Math.PI * 2 * x / L), zBase = -5000, level0 = -2600, rate = 200e-6;  // m per yr
  const zt = 8000, zb = zBase;
  const dyT = res === 'A' ? 250 : 200, dxT = res === 'A' ? 500 : 400;   // B: 250 x 65 cells (finer than A, and still affordable)
  const nx = Math.round(L / dxT), ny = Math.round((zt - zb) / dyT);
  return {
    name: 'gl24-' + res, x0: 0, W: L, zb, zt, nx, ny, tStart: 0, tEnd: G.durationMyr, dtCap: 2.5e5, recMyr: 0.5,
    mats: [{ rho: RHO_W, eta: ETAW }, { rho: G.densitiesKgM3.salt, eta: G.viscosities.saltPaS }, { rho: G.densitiesKgM3.cover, eta: G.viscosities.coverPaS }],
    compaction: null, bottom: 'noslip', etaRef: 1e18,
    init: (x, z) => (z < zBase + h(x) ? SALT : z < level0 ? COVER : WATER),
    levelAt: (tAbs) => ({ z: [level0 + rate * tAbs * 1e6, level0 + rate * tAbs * 1e6], x0: 0, dx: L / 2 }),
    crest: { x0km: 50, halfKm: 12, trackKm: 3, flankKm: [10, 20] },
    thin: { tNear: 0 }, thinSeries: G.thinSheetResult.crestDepthAgainstTime, drop: () => 0,
  };
}

// ----- profiles from the markers (bin = one grid column)
function profiles(m) {
  const nb = m.nx, w = m.W / nb, salt = new Float64Array(nb).fill(NaN), sea = new Float64Array(nb).fill(NaN);
  for (let k = 0; k < m.nmark; k++) {
    let j = Math.floor(m.x[k] / w); j = j < 0 ? 0 : j >= nb ? nb - 1 : j;
    const q = m.mat[k], y = m.y[k];
    if (q === SALT && (Number.isNaN(salt[j]) || y < salt[j])) salt[j] = y;
    if (q !== WATER && (Number.isNaN(sea[j]) || y < sea[j])) sea[j] = y;
  }
  return { salt, sea, w };
}

function run(cfg, opts) {
  opts = opts || {};
  const m = S.createModel({
    nx: cfg.nx, ny: cfg.ny, W: cfg.W, H: cfg.zt - cfg.zb, g: 9.81, etaRef: cfg.etaRef, theta: 0.5, top: 'freeslip', bottom: cfg.bottom,
    mats: cfg.mats, compaction: cfg.compaction, init: (x, y) => cfg.init(cfg.x0 + x, cfg.zt - y), nPerCell: [5, 5], seed: 4321,
  });
  const dx = m.dx, dy = m.dy;
  const zOf = (y) => cfg.zt - y;
  const series = [], snaps = [];
  let nextRec = 0, tAbsLast = cfg.tStart, xc = cfg.crest.x0km * 1000;
  const a0 = S.areasByMaterial(m);
  const t0 = Date.now(), log = [];
  const record = (tAbs) => {
    const p = profiles(m), drop = cfg.drop(tAbs);
    // crest: highest salt top within +-halfKm of the previous crest position
    const lo = Math.max(0, Math.floor((xc - cfg.crest.halfKm * 1000 - cfg.x0) / dx)), hi = Math.min(m.nx - 1, Math.ceil((xc + cfg.crest.halfKm * 1000 - cfg.x0) / dx));
    let jc = -1, yb = Infinity;
    for (let j = lo; j <= hi; j++) if (!Number.isNaN(p.salt[j]) && p.salt[j] < yb) { yb = p.salt[j]; jc = j; }
    const row = { tMyr: +tAbs.toFixed(3) };
    if (jc >= 0) {
      xc = cfg.x0 + (jc + 0.5) * dx;
      const fl = [];
      for (let j = 0; j < m.nx; j++) { const d = Math.abs((j - jc) * dx); if (d >= cfg.crest.flankKm[0] * 1000 && d <= cfg.crest.flankKm[1] * 1000 && !Number.isNaN(p.sea[j])) fl.push(p.sea[j]); }
      const flank = fl.length ? fl.reduce((s, v) => s + v, 0) / fl.length : NaN;
      Object.assign(row, { crestKm: +(xc / 1000).toFixed(2), saltTopM: +(zOf(yb) - drop).toFixed(1), seafloorAtCrestM: +(zOf(p.sea[jc]) - drop).toFixed(1), coverM: +(yb - p.sea[jc]).toFixed(1), flankSeafloorM: +(zOf(flank) - drop).toFixed(1), reliefM: +(flank - yb).toFixed(1) });
    }
    // shallowest salt and exposed salt length (cover < 50 m), over the whole box and over the crest zone
    const z0 = cfg.crest.zoneKm ? cfg.crest.zoneKm[0] * 1000 : 0, z1 = cfg.crest.zoneKm ? cfg.crest.zoneKm[1] * 1000 : 1e12;
    let minCov = Infinity, minKm = NaN, nExp = 0, nExpZone = 0, minCovZone = Infinity, minKmZone = NaN;
    for (let j = 0; j < m.nx; j++) {
      if (Number.isNaN(p.salt[j])) continue;
      const c = p.salt[j] - p.sea[j], X = cfg.x0 + (j + 0.5) * dx;
      if (c < minCov) { minCov = c; minKm = X / 1000; }
      if (c < 50) nExp++;
      if (X >= z0 && X <= z1) { if (c < minCovZone) { minCovZone = c; minKmZone = X / 1000; } if (c < 50) nExpZone++; }
    }
    Object.assign(row, { minCoverM: +minCov.toFixed(1), minCoverKm: +minKm.toFixed(2), exposedKm: +(nExp * dx / 1000).toFixed(2), zoneMinCoverM: +minCovZone.toFixed(1), zoneMinCoverKm: +minKmZone.toFixed(2), zoneExposedKm: +(nExpZone * dx / 1000).toFixed(2) });
    const a = S.areasByMaterial(m);
    row.saltAreaKm2 = +(a[SALT] / 1e6).toFixed(4); row.coverAreaKm2 = +(a[COVER] / 1e6).toFixed(3); row.nmark = m.nmark; row.vmaxMmyr = +(Math.max(...S.maxVel(m)) * YR * 1e3).toFixed(4);
    series.push(row);
    if (opts.snapEvery && Math.abs(tAbs / opts.snapEvery - Math.round(tAbs / opts.snapEvery)) < 1e-6) snaps.push({ tMyr: row.tMyr, x0: cfg.x0, dx, zOff: drop, salt: Array.from(p.salt, (v) => (Number.isNaN(v) ? null : +(zOf(v) - drop).toFixed(1))), sea: Array.from(p.sea, (v) => (Number.isNaN(v) ? null : +(zOf(v) - drop).toFixed(1))) });
    return row;
  };
  const fillTo = (tAbs) => {
    const L = cfg.levelAt(tAbs), arr = L.z; const nb = 4 * m.nx, bw = m.W / nb, ly = new Float64Array(nb);
    for (let b = 0; b < nb; b++) ly[b] = cfg.zt - interp(L.x0, L.dx, arr, cfg.x0 + (b + 0.5) * bw);
    return S.aggrade(m, (x) => { let b = Math.floor(x / bw); if (b >= nb) b = nb - 1; return ly[b]; }, WATER, COVER);
  };
  // the level at the start is the starting seafloor: nothing to fill; keep initial markers
  const MYR = 1e6 * YR, tEndYr = (cfg.tEnd - cfg.tStart) * MYR;   // model time is in seconds
  record(cfg.tStart);
  nextRec = cfg.recMyr * MYR;
  let steps = 0;
  while (m.t < tEndYr - 1e3) {
    const dtMax = Math.min(cfg.dtCap * YR, nextRec - m.t > 1e3 ? nextRec - m.t : cfg.dtCap * YR, tEndYr - m.t);
    const r = S.step(m, dtMax, CFL);
    steps++;
    const tAbs = cfg.tStart + m.t / MYR;
    fillTo(tAbs);
    if (m.t >= nextRec - 1e3) { const row = record(tAbs); nextRec += cfg.recMyr * MYR; if (opts.verbose) console.log(cfg.name, 't', row.tMyr, 'cover', row.coverM, 'relief', row.reliefM, 'steps', steps, 'min', ((Date.now() - t0) / 60000).toFixed(1), 'dt yr', (r.dt / YR).toExponential(2), 'vmax mm/yr', row.vmaxMmyr); }
    if (opts.maxMin && (Date.now() - t0) / 60000 > opts.maxMin) { log.push('stopped at the time limit'); break; }
  }
  const a1 = S.areasByMaterial(m);
  return { cfg: { name: cfg.name, nx: cfg.nx, ny: cfg.ny, dxM: dx, dyM: dy, W: cfg.W, heightM: cfg.zt - cfg.zb, coverEta: cfg.mats[COVER].eta, saltEta: cfg.mats[SALT].eta, tStart: cfg.tStart, tEnd: cfg.tEnd, dtCapYr: cfg.dtCap }, thin: cfg.thin, thinSeries: cfg.thinSeries, series, snaps, steps, minutes: (Date.now() - t0) / 60000, saltArea0: a0[SALT], saltArea1: a1[SALT], log };
}

// burial analysis on a series: exposed = cover < 50 m; buried = after exposure, cover > 100 m for 3 consecutive records
function analyse(series) {
  let tExp = null, tBur = null, tExpZ = null, tBurZ = null;
  const cov = (r) => r.coverM, covZ = (r) => (r.zoneMinCoverM !== undefined ? r.zoneMinCoverM : r.coverM);
  const f = (get) => {
    let te = null, tb = null;
    for (let i = 0; i < series.length; i++) {
      const r = series[i]; if (get(r) === undefined) continue;
      if (te === null && get(r) < 50) te = r.tMyr;
      if (te !== null && tb === null && i + 2 < series.length && [0, 1, 2].every((q) => get(series[i + q]) > 100)) tb = r.tMyr;
    }
    return [te, tb];
  };
  [tExp, tBur] = f(cov); [tExpZ, tBurZ] = f(covZ);
  return { tExposedMyr: tExp, tBuriedMyr: tBur, zoneTExposedMyr: tExpZ, zoneTBuriedMyr: tBurZ };
}

module.exports = { gulfCase, gl24Case, run, analyse, profiles };

if (require.main === module) {
  const [which, res, cf] = process.argv.slice(2);
  const cfg = which === 'gulf' ? gulfCase(res || 'A', cf ? +cf : 1) : gl24Case(res || 'A');
  console.log(cfg.name, 'grid', cfg.nx, 'x', cfg.ny, 'box', (cfg.W / 1e3), 'km x', ((cfg.zt - cfg.zb) / 1e3).toFixed(1), 'km', 't', cfg.tStart, '->', cfg.tEnd);
  const out = run(cfg, { verbose: true, snapEvery: 5, maxMin: +process.env.S4_MAXMIN || 0 });
  out.analysis = analyse(out.series);
  fs.mkdirSync(SCR, { recursive: true });
  fs.writeFileSync(path.join(SCR, 'out-' + cfg.name + '.json'), JSON.stringify(out));
  console.log(cfg.name, 'done', out.steps, 'steps', out.minutes.toFixed(1), 'min', JSON.stringify(out.analysis), 'salt area change', ((out.saltArea1 / out.saltArea0 - 1) * 100).toFixed(3), '%');
}
