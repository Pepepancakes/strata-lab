'use strict';
// The four benchmarks of spike 004 as functions (test.js asserts them). Each returns the numbers it measured.
const S = require('./stokes.js');

// ---------------------------------------------------------------- 1. Poiseuille channel
// Pressure driven flow between two no-slip plates (distance Hc, length L, viscosity eta, pressure drop dp):
//   vx(y) = dp/(2 eta L) y (Hc - y),   flux per unit width Q = dp Hc^3 / (12 eta L).
// Open (pressure) boundaries at both ends, no gravity. Optionally a viscosity that varies along the channel
// (flux through each section still equals the same Q): checks the variable-viscosity stencil too.
function poiseuille(o) {
  o = Object.assign({ nx: 20, ny: 40, L: 2, Hc: 1, eta: 1, dp: 1 }, o || {});
  const m = S.createModel({
    nx: o.nx, ny: o.ny, W: o.L, H: o.Hc, g: 0, etaRef: o.eta, open: { pL: o.dp, pR: 0 }, top: 'noslip', bottom: 'noslip',
    mats: [{ rho: 1, eta: o.eta }], init: () => 0, nPerCell: [3, 3],
  });
  S.markersToGrid(m); S.solveStokes(m, 0);
  const qExact = o.dp * o.Hc ** 3 / (12 * o.eta * o.L);
  const out = { qExact, qs: [], maxProfileErr: 0 };
  for (const jj of [1, Math.floor(o.nx / 2), o.nx - 1]) {
    let q = 0; for (let i = 0; i < o.ny; i++) q += m.vx[jj * o.ny + i] * m.dy;
    out.qs.push(q);
  }
  const j = Math.floor(o.nx / 2);
  for (let i = 0; i < o.ny; i++) {
    const y = (i + 0.5) * m.dy, ex = o.dp / (2 * o.eta * o.L) * y * (o.Hc - y);
    out.maxProfileErr = Math.max(out.maxProfileErr, Math.abs(m.vx[j * o.ny + i] - ex) / (o.dp * o.Hc * o.Hc / (8 * o.eta * o.L)));
  }
  out.relErr = out.qs.map((q) => Math.abs(q - qExact) / qExact);
  return out;
}

// ---------------------------------------------------------------- 2. Rayleigh-Taylor
// van Keken et al. (1997) case 1a: box 0.9142 x 1, lower (light) layer 0.2 + 0.02 cos(pi x / 0.9142) thick, rho 1000 below,
// 1010 above, eta = 100 both, g = 10, free slip on the vertical sides and NO slip top and bottom (the reference values below only match with no slip: free slip gives a first peak at t = 120).
function rtModel(o) {
  o = Object.assign({ nx: 48, ny: 52, amp: 0.02, wall: 'noslip' }, o || {});
  const lam = 0.9142;
  return S.createModel({
    nx: o.nx, ny: o.ny, W: lam, H: 1, g: 10, etaRef: 100, top: o.wall, bottom: o.wall,
    mats: [{ rho: 1010, eta: 100 }, { rho: 1000, eta: 100 }],
    init: (x, y) => ((1 - y) < 0.2 + o.amp * Math.cos(Math.PI * x / lam) ? 1 : 0), nPerCell: o.nPerCell || [6, 6], seed: o.seed,
  });
}

/** Run case 1a until the first vrms peak has passed; returns {t[], v[], tPeak, vPeak, areas0, areas1} */
function rtRun(o) {
  o = Object.assign({ tMax: 400, cfl: 0.5, dtMax: 2 }, o || {});
  const m = rtModel(o), t = [], v = [];
  const a0 = S.areasByMaterial(m);
  let peakSeen = false;
  while (m.t < o.tMax && !peakSeen) {
    const r = S.step(m, o.dtMax, o.cfl);
    t.push(m.t); v.push(S.vrms(m));
    if (v.length > 5) {
      let mx = 0; for (const q of v) mx = Math.max(mx, q);
      if (v[v.length - 1] < 0.97 * mx && m.t > 100) peakSeen = true;
    }
    void r;
  }
  let ip = 0; for (let q = 1; q < v.length; q++) if (v[q] > v[ip]) ip = q;
  // parabola through the three points around the maximum (times are not uniform)
  let tPeak = t[ip], vPeak = v[ip];
  if (ip > 0 && ip < v.length - 1) {
    const x0 = t[ip - 1], x1 = t[ip], x2 = t[ip + 1], y0 = v[ip - 1], y1 = v[ip], y2 = v[ip + 1];
    const d = (x0 - x1) * (x0 - x2) * (x1 - x2);
    const A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / d;
    const B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / d;
    const C = (x1 * x2 * (x1 - x2) * y0 + x2 * x0 * (x2 - x0) * y1 + x0 * x1 * (x0 - x1) * y2) / d;
    if (A < 0) { tPeak = -B / (2 * A); vPeak = C - B * B / (4 * A); }
  }
  return { t, v, tPeak, vPeak, areas0: a0, areas1: S.areasByMaterial(m), nmark: m.nmark, m };
}

/** Growth rate at t = 0 of a small cosine perturbation, from the solver (interface rise velocity at x = 0 over amplitude) */
function rtGrowthRate(o) {
  o = Object.assign({ nx: 48, ny: 52, amp: 0.002, wall: 'noslip' }, o || {});
  const m = rtModel(o);
  S.markersToGrid(m); S.solveStokes(m, 0);
  const v = [0, 0], y0 = 1 - 0.2 - o.amp;
  S.velAt(m, 0.0, y0, v);
  return -v[1] / o.amp;    // y is down, so rising is negative vy
}

/** Exact linear solution of the same problem (two equal-viscosity layers, free slip box, sheet load at the interface):
 *  psi = F(z) sin(kx), eta (F'''' - 2k2 F'' + k4 F) = -k drho g a delta(z - z0); F = F'' = 0 at both walls.
 *  Growth rate sigma = vz(0, z0)/a = -k F(z0)/a.  (Stokes stream function: Turcotte and Schubert 2002, ch. 6, or Chandrasekhar 1961.) */
function rtGrowthRateExact(wall) {
  wall = wall || 'noslip';
  const lam = 0.9142, k = Math.PI / lam, eta = 100, drho = 10, g = 10, a = 1, z0 = 0.2, Hh = 1;
  // basis for each layer: e1 = e^{kz}, e2 = z e^{kz}, e3 = e^{-kz}, e4 = z e^{-kz};   derivatives analytic
  const basis = (z, d) => {
    const ep = Math.exp(k * z), em = Math.exp(-k * z);
    if (d === 0) return [ep, z * ep, em, z * em];
    if (d === 1) return [k * ep, (1 + k * z) * ep, -k * em, (1 - k * z) * em];
    if (d === 2) return [k * k * ep, (2 * k + k * k * z) * ep, k * k * em, (-2 * k + k * k * z) * em];
    return [k ** 3 * ep, (3 * k * k + k ** 3 * z) * ep, -(k ** 3) * em, (3 * k * k - k ** 3 * z) * em];
  };
  const A = Array.from({ length: 8 }, () => new Array(9).fill(0));
  const put = (r, off, vec, sgn) => { for (let q = 0; q < 4; q++) A[r][off + q] += sgn * vec[q]; };
  const d2 = wall === 'noslip' ? 1 : 2;   // F'(z)=0 for no slip, F''(z)=0 for free slip
  put(0, 0, basis(0, 0), 1); put(1, 0, basis(0, d2), 1);            // F1(0) = 0 and F1' or F1'' = 0
  put(2, 4, basis(Hh, 0), 1); put(3, 4, basis(Hh, d2), 1);
  for (let d = 0; d < 3; d++) { put(4 + d, 0, basis(z0, d), 1); put(4 + d, 4, basis(z0, d), -1); }   // continuity of F, F', F''
  put(7, 4, basis(z0, 3), 1); put(7, 0, basis(z0, 3), -1); A[7][8] = -k * drho * g * a / eta;      // jump of F'''
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q < 9; q++) A[r][q] -= f * A[c][q]; }
  }
  const coef = A.map((row, r) => row[8] / row[r]);
  const F = basis(z0, 0).reduce((s, b, q) => s + b * coef[q], 0);
  return -k * F / a;
}

// ---------------------------------------------------------------- 4. free surface relaxation
// A cosine topography on a viscous half space relaxes as exp(-t/tau), tau = 4 pi eta / (rho g lambda)
// (Turcotte and Schubert 2002, Geodynamics, 2nd ed., postglacial rebound section; Crameri et al. 2012 case 1 is the same
// problem). Sticky layer (rho 0, eta/1000) above, free slip walls make the half wavelength domain exact for a cosine.
function relaxation(o) {
  o = Object.assign({ nx: 40, ny: 100, lam: 4e5, depth: 4e5, air: 1e5, amp: 2e3, eta: 1e21, rho: 3300, g: 10, theta: 1, airEta: 1e18, nSteps: 100, tEnd: 2 }, o || {});
  const W = o.lam / 2, H = o.depth + o.air, k = 2 * Math.PI / o.lam;
  const tau = 4 * Math.PI * o.eta / (o.rho * o.g * o.lam);
  const m = S.createModel({
    nx: o.nx, ny: o.ny, W, H, g: o.g, etaRef: o.eta, theta: o.theta, top: 'freeslip', bottom: 'freeslip',
    mats: [{ rho: 0, eta: o.airEta }, { rho: o.rho, eta: o.eta }],
    init: (x, y) => (y > o.air - o.amp * Math.cos(k * x) ? 1 : 0), nPerCell: [6, 6],
  });
  const amp = () => {
    const top = S.topOfMaterial(m, 1, o.nx); let mean = 0; for (const q of top) mean += q; mean /= top.length;
    let num = 0, den = 0;
    for (let j = 0; j < o.nx; j++) { const c = Math.cos(k * (j + 0.5) * m.dx); num += -(top[j] - mean) * c; den += c * c; }
    return num / den;
  };
  const dtMax = o.tEnd * tau / o.nSteps, ts = [0], hs = [amp()];
  while (m.t < o.tEnd * tau - 1e-9 * tau) {
    S.step(m, Math.min(dtMax, o.tEnd * tau - m.t), 0.5);
    ts.push(m.t); hs.push(amp());
  }
  // least squares slope of ln h against t
  const lh = hs.map(Math.log); const n = ts.length; let st = 0, sl = 0, stt = 0, stl = 0;
  for (let q = 0; q < n; q++) { st += ts[q]; sl += lh[q]; stt += ts[q] * ts[q]; stl += ts[q] * lh[q]; }
  const slope = (n * stl - st * sl) / (n * stt - st * st);
  return { tau, tauFit: -1 / slope, h0: hs[0], hEnd: hs[hs.length - 1], hExact: hs[0] * Math.exp(-o.tEnd), maxRelErr: Math.max(...hs.map((h, q) => Math.abs(h - hs[0] * Math.exp(-ts[q] / tau)) / (hs[0] * Math.exp(-ts[q] / tau)))), steps: ts.length - 1, ts, hs, m };
}

module.exports = { poiseuille, rtRun, rtGrowthRate, rtGrowthRateExact, relaxation, rtModel };
