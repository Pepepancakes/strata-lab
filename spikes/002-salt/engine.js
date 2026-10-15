/*
 * Strata Lab - spike 002 (salt) - process engine (pure JS, no DOM).
 * Built on spike 001; adds a mobile salt layer between basement and sediment (step 4).
 *
 * 2D shelf-to-basin section. Each record step (dtRec years) every column gets one
 * new layer. Within a record step:
 *   1. tectonic subsidence lowers the basement
 *   2. sediment transport (nSub substeps):
 *        - two-lithology diffusion (Rivenaes 1992 style), water-depth dependent
 *          diffusivity (Kaufman et al. 1991), solved implicitly, mass conserving
 *        - turbidity-current routing (transport-length rule) for the share of supply
 *          that reaches the shelf edge when the shoreline is near it
 *   3. compaction + pore pressure per column: 1D consolidation in solid
 *      coordinates, Athy-type porosity vs effective stress, porosity-dependent
 *      permeability, implicit (backward Euler) tridiagonal solve.
 *   4. salt flow: thin-sheet (lubrication) viscous flow of the salt layer under the
 *      sediment columns. Flux q = -(h^3 / 12 eta) dPhi/dx (Poiseuille, no slip at
 *      base and roof), Phi = vertical load on the salt roof + rho_salt g z_roof.
 *      Columns ride up and down on the salt; they do not move sideways.
 *      Semi-implicit (water-load response implicit), flux form = salt conserved.
 * Units: SI internally (m, Pa, years for time, m^2 for permeability).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Strata = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const G = 9.81, RHO_W = 1025, RHO_S = 2650, MU = 1.0e-3, YR = 3.15576e7;
  const RHO_SALT = 2160;      // halite, kg/m^3 (Hudec & Jackson 2007)
  const DRHO_G = (RHO_S - RHO_W) * G;
  const SAND = 0, MUD = 1;
  const ACTIVE_SOLID = 1.0;   // m of solids that define surface (active layer) composition
  const EMPTY = 1e-9;         // m of solids below which a layer is treated as empty

  function defaultParams() {
    return {
      // grid & time (fixed for a run)
      nx: 150, dx: 1000, duration: 3.0e6, dtRec: 5000, nSub: 5,
      // boundary conditions (editable; in a branch they apply from the branch time)
      supply: 20,          // solid sediment supply, m^2/yr per metre of margin
      sandFrac: 0.35,      // sand share of supply (solid volume)
      slAmp: 40,           // eustatic amplitude, m
      slPeriod: 100000,    // eustatic period, yr
      slShift: 0,          // step offset of sea level, m
      subsShelf: 40,       // tectonic subsidence at landward edge, m/Myr
      subsBasin: 150,      // tectonic subsidence at basinward edge, m/Myr
      // transport diffusivities, bulk m^2/yr, [sand, mud]
      Kc: [5.0e4, 1.0e5],  // subaerial (fluvial); gives ~0.3 m/km coastal-plain gradient
      Km: [400, 2500],     // marine, at the shoreline
      dm: [10, 40],        // e-folding water depth of marine diffusivity, m
      Kg: [100, 1000],     // deep-marine background (gravity creep), m^2/yr; tuned for 5-7 deg muddy slopes
      // turbidity-current routing
      tcMax: 0.6,          // max share of supply routed as turbidity currents
      tcLambda: 8000,      // shoreline-to-shelf-edge distance scale, m
      sBreak: 0.01,        // gradient that defines the shelf edge
      tcL0: [20000, 400000], // deposition length at reference gradient, m [sand, mud]
      tcSref: 0.005, tcN: 2,
      // compaction: Athy law in effective stress, phi = phi0 exp(-beta sigma')
      // phi0 from Sclater & Christie (1980); beta converted from their depth
      // coefficients (sand 0.27/km, shale 0.51/km) to match their curves at 2 km.
      phi0: [0.49, 0.63],
      beta: [2.68e-8, 5.2e-8],
      // permeability: log10 k(m^2) = kA + kB*phi
      kA: [-14.5, -22.0], kB: [7.0, 8.0],
      kMudMult: 1,         // multiplier on mud permeability
      elastic: 0.05,       // unloading compressibility as share of loading value
      linear: null,        // benchmark mode: {e0, C, k} constant properties
      // salt (autochthonous layer on the basement)
      coverThick: 200,     // pre-existing (pre-kinematic) substrate, bulk m (start of run only)
      coverSmax: 20e6,     // its past maximum effective stress, Pa (sets how compacted/dense it is)
      coverNoise: 0,       // +- fractional thickness variation of the older cover (seeded)
      seed: 1,
      saltOn: true,
      saltThick: 1500,     // initial salt thickness basinward of the pinch-out, m (start of run only)
      saltPinch: [25000, 45000], // salt edge: zero landward of x0, full thickness basinward of x1
      saltVisc: 1e17,      // dynamic viscosity, Pa s (published range ~1e17-1e19; tuned to the fast end so flow shows in 3 Myr)
      nSaltSub: 5,         // salt substeps per record step
    };
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function porosity(P, i, s) { return P.phi0[i] * Math.exp(-P.beta[i] * (s > 0 ? s : 0)); }
  function setPor(st, P, i, sig) {
    if (!st.kps) { st.phs[i] = porosity(P, SAND, sig); st.phm[i] = porosity(P, MUD, sig); return; }
    const a = porosity(P, SAND, sig), b = porosity(P, MUD, sig);
    st.phs[i] = a; st.phm[i] = b; st.kps[i] = perm(P, SAND, a); st.kpm[i] = perm(P, MUD, b);
  }
  function voidRatio(P, i, s) { const p = porosity(P, i, s); return p / (1 - p); }
  function perm(P, i, phi) {
    let lk = P.kA[i] + P.kB[i] * phi;
    if (i === MUD) lk += Math.log10(P.kMudMult);
    return Math.pow(10, lk);
  }
  function seaLevel(P, t) { return P.slAmp * Math.sin(2 * Math.PI * t / P.slPeriod) + P.slShift; }

  // initial surface: coastal plain, shelf, slope, basin floor (elevation, m)
  const PROFILE = [[0, 15], [10000, 0], [40000, -100], [65000, -1500], [150000, -1900]];
  function initialSurface(x) {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [x0, z0] = PROFILE[i], [x1, z1] = PROFILE[i + 1];
      if (x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0);
    }
    return PROFILE[PROFILE.length - 1][1];
  }

  function createState(P) {
    const nx = P.nx, nSteps = Math.round(P.duration / P.dtRec), NL = nSteps + 1;
    const st = {
      k: 0, nx, NL, nSteps,
      b: new Float64Array(nx),
      sand: new Float64Array(NL * nx), mud: new Float64Array(NL * nx),
      smax: new Float64Array(NL * nx), u: new Float64Array(NL * nx), ld: new Float64Array(NL * nx),
      phs: new Float64Array(NL * nx), phm: new Float64Array(NL * nx),   // cached porosities
      kps: new Float64Array(NL * nx), kpm: new Float64Array(NL * nx),   // cached permeabilities
      H: new Float64Array(nx), hs: new Float64Array(nx), initSalt: 0, saltClip: 0,
      cumIn: 0, cumOut: 0, cumInS: 0, cumOutS: 0, deficit: 0, swap: 0, short: 0, clamps: 0, initSolid: 0, initSand: 0,
      scratch: makeScratch(nx, NL),
    };
    // pre-existing substrate: 200 m of compacted mixed sediment
    const subBulk = P.coverThick, subSmax = P.coverSmax, f = 0.3;
    const e = f * voidRatio(P, SAND, subSmax) + (1 - f) * voidRatio(P, MUD, subSmax);
    const solid = subBulk / (1 + e);
    // optional seeded, smoothed thickness variation of the older cover (deterministic)
    const noise = new Float64Array(nx);
    if (P.coverNoise > 0) {
      let seed = P.seed >>> 0;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
      const raw = Array.from({ length: nx }, rnd), R = 3;
      for (let j = 0; j < nx; j++) { let a = 0, c = 0; for (let d = -R; d <= R; d++) { const q = j + d; if (q >= 0 && q < nx) { a += raw[q]; c++; } } noise[j] = a / c; }
      let mx = 0; for (let j = 0; j < nx; j++) mx = Math.max(mx, Math.abs(noise[j]));
      for (let j = 0; j < nx; j++) noise[j] *= P.coverNoise / mx;
    }
    for (let j = 0; j < nx; j++) {
      const x = (j + 0.5) * P.dx, [x0, x1] = P.saltPinch;
      let f2 = P.saltOn ? Math.max(0, Math.min(1, (x - x0) / (x1 - x0))) : 0;
      f2 = f2 * f2 * (3 - 2 * f2);
      st.hs[j] = P.saltThick * f2; st.initSalt += st.hs[j] * P.dx;
      const cj = subBulk * (1 + noise[j]), sj = cj / (1 + e);
      st.b[j] = initialSurface(x) - cj - st.hs[j];
      st.sand[j] = f * sj; st.mud[j] = (1 - f) * sj; st.smax[j] = subSmax;
      st.initSolid += sj * P.dx; st.initSand += f * sj * P.dx;
      setPor(st, P, j, subSmax);
    }
    for (let j = 0; j < nx; j++) loadsInto(st, j, 0);
    recomputeH(st, P);
    return st;
  }

  function makeScratch(nx, NL) {
    const n = Math.max(nx, NL);
    const f = () => new Float64Array(n);
    return {
      F: f(), aS: f(), aT: f(), Qf: f(), iSs: f(), iMs: f(), order: new Array(nx), Ke: f(), Ks: f(), Km: f(), Hn: f(), cp: f(), dp: f(),
      idx: new Int32Array(NL), L: f(), A: f(), hh: f(), kk: f(), T: f(),
      lo: f(), di: f(), up: f(), rhs: f(), x: f(),
      W: f(), Sb: f(), Phi: f(), aw: f(), M: f(),
    };
  }

  function layerBulk(st, P, i) {
    const s = st.sand[i], m = st.mud[i];
    if (s + m <= 0) return 0;
    if (P.linear) return (s + m) * (1 + P.linear.e0);
    return s / (1 - st.phs[i]) + m / (1 - st.phm[i]);
  }

  function recomputeH(st, P) {
    const nx = st.nx;
    for (let j = 0; j < nx; j++) {
      let z = st.b[j] + st.hs[j];
      for (let l = 0; l <= st.k; l++) z += layerBulk(st, P, l * nx + j);
      st.H[j] = z;
    }
  }

  // buoyant vertical load at layer mid-points (= sigma_v - hydrostatic); identical
  // arithmetic is used inside compactColumn so restore() reproduces ld bit-for-bit
  function loadsInto(st, j, top) {
    const nx = st.nx;
    let above = 0;
    for (let l = top; l >= 0; l--) {
      const i = l * nx + j, s = st.sand[i] + st.mud[i];
      if (s <= EMPTY) continue;
      st.ld[i] = DRHO_G * (above + 0.5 * s);
      above += s;
    }
  }

  // solid sand and total solid in the top ACTIVE_SOLID of a column
  function surfComp(st, j, top, S) {
    const nx = st.nx;
    let s = 0, m = 0;
    for (let l = top; l >= 0; l--) {
      const i = l * nx + j;
      s += st.sand[i]; m += st.mud[i];
      if (s + m >= ACTIVE_SOLID) break;
    }
    S.aS[j] = s; S.aT[j] = s + m;
  }

  // remove `amount` of solid of one lithology from the top of a column;
  // returns bulk removed, leaves any shortfall in st.short
  function erode(st, P, j, lith, amount, top) {
    const nx = st.nx, arr = lith === SAND ? st.sand : st.mud;
    let need = amount, bulk = 0;
    for (let l = top; l >= 0 && need > 1e-12; l--) {
      const i = l * nx + j, a = arr[i];
      if (a <= 0) continue;
      const take = a < need ? a : need;
      arr[i] = a - take; need -= take;
      bulk += take / (1 - (lith === SAND ? st.phs[i] : st.phm[i]));
    }
    st.short = need > 1e-12 ? need : 0;
    return bulk;
  }

  function thomas(n, lo, di, up, rhs, x, cp, dp) {
    cp[0] = up[0] / di[0]; dp[0] = rhs[0] / di[0];
    for (let i = 1; i < n; i++) {
      const m = di[i] - lo[i] * cp[i - 1];
      cp[i] = up[i] / m; dp[i] = (rhs[i] - lo[i] * dp[i - 1]) / m;
    }
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  }

  function transportSubstep(st, P, t, dt) {
    const nx = st.nx, dx = P.dx, top = st.k + 1, H = st.H, S = st.scratch;
    const SL = seaLevel(P, t);
    const F = S.F, Ke = S.Ke, Ks = S.Ks, Km = S.Km, Hn = S.Hn;

    // shoreline and shelf edge -> share of supply that goes to turbidity currents
    let js = -1, je = -1, Ftc = 0;
    for (let j = 0; j < nx; j++) if (H[j] < SL) { js = j; break; }
    if (js >= 0) {
      for (let j = js; j < nx - 1; j++) if ((H[j] - H[j + 1]) / dx > P.sBreak) { je = j; break; }
      if (je >= 0) Ftc = P.tcMax * Math.exp(-(je - js) * dx / P.tcLambda);
    }
    st.shore = js; st.shelfEdge = je; st.tcShare = Ftc;
    const qS = P.supply * P.sandFrac, qM = P.supply * (1 - P.sandFrac);   // solid m^2/yr
    const pS = 1 - P.phi0[SAND], pM = 1 - P.phi0[MUD];
    const inS = qS * (1 - Ftc) / pS, inM = qM * (1 - Ftc) / pM;           // bulk m^2/yr

    const r = dt / (dx * dx);
    function solve() {
      // face diffusivities, composition from the upwind cell
      for (let f = 0; f < nx - 1; f++) {
        const jU = H[f] >= H[f + 1] ? f : f + 1;
        const d = SL - 0.5 * (H[f] + H[f + 1]);
        let k0, k1;
        if (d <= 0) { k0 = P.Kc[0]; k1 = P.Kc[1]; }
        else { k0 = P.Km[0] * Math.exp(-d / P.dm[0]) + P.Kg[0]; k1 = P.Km[1] * Math.exp(-d / P.dm[1]) + P.Kg[1]; }
        Ks[f] = k0 * F[jU]; Km[f] = k1 * (1 - F[jU]); Ke[f] = Ks[f] + Km[f];
      }
      // implicit solve for the new surface
      for (let j = 0; j < nx; j++) {
        const a = j > 0 ? -r * Ke[j - 1] : 0, c = j < nx - 1 ? -r * Ke[j] : 0;
        S.lo[j] = a; S.up[j] = c; S.di[j] = 1 - a - c;
        S.rhs[j] = H[j] + (j === 0 ? dt * (inS + inM) / dx : 0);
      }
      thomas(nx, S.lo, S.di, S.up, S.rhs, Hn, S.cp, S.dp);
    }

    // total face fluxes from the implicit solve (diffusivity from the active-layer mix)
    for (let j = 0; j < nx; j++) { surfComp(st, j, top, S); F[j] = S.aT[j] > 0 ? S.aS[j] / S.aT[j] : 0.5; }
    solve();
    const c = dt / dx, Qf = S.Qf, iSs = S.iSs, iMs = S.iMs, order = S.order;
    for (let f = 0; f < nx - 1; f++) Qf[f] = Ke[f] * (Hn[f] - Hn[f + 1]) / dx * c;   // bulk m over the substep
    for (let j = 0; j < nx; j++) { iSs[j] = 0; iMs[j] = 0; order[j] = j; }
    iSs[0] = inS * c * pS; iMs[0] = inM * c * pM;                                    // solid m
    // flux always runs from higher to lower surface, so processing cells from high to
    // low means every cell's inflow (amount and grain size) is known before it is used
    order.sort((a, b) => Hn[b] - Hn[a]);
    const open = top * nx;
    for (let o = 0; o < nx; o++) {
      const j = order[o];
      const qL = j > 0 ? Qf[j - 1] : 0, qR = j < nx - 1 ? Qf[j] : 0;
      const outL = qL < 0 ? -qL : 0, outR = qR > 0 ? qR : 0, Qout = outL + outR;
      const iS = iSs[j], iM = iMs[j];
      let oS = 0, oM = 0;
      if (Qout > 0) {
        const Qin = iS / pS + iM / pM;
        if (Qout <= Qin) {
          // net deposition: pass on a mobility-weighted mix of inflow + active layer
          const poolS = iS + S.aS[j], poolM = iM + (S.aT[j] - S.aS[j]);
          const d = SL - Hn[j];
          let kS, kM;
          if (d <= 0) { kS = P.Kc[0]; kM = P.Kc[1]; }
          else { kS = P.Km[0] * Math.exp(-d / P.dm[0]) + P.Kg[0]; kM = P.Km[1] * Math.exp(-d / P.dm[1]) + P.Kg[1]; }
          const wS = kS * poolS, wM = kM * poolM;
          const f = wS + wM > 0 ? wS / (wS + wM) : 0;
          const solid = Qout / (f / pS + (1 - f) / pM);
          oS = f * solid; oM = solid - oS;
          if (oS > poolS) { oS = poolS; oM = Math.min(poolM, (Qout - oS / pS) * pM); }
          else if (oM > poolM) { oM = poolM; oS = Math.min(poolS, (Qout - oM / pM) * pS); }
          const dS = iS - oS, dM = iM - oM;
          if (dS > 0) { st.sand[open + j] += dS; H[j] += dS / pS; } else if (dS < 0) H[j] -= erode(st, P, j, SAND, -dS, top);
          if (dM > 0) { st.mud[open + j] += dM; H[j] += dM / pM; } else if (dM < 0) H[j] -= erode(st, P, j, MUD, -dM, top);
          if (st.short > 0) st.deficit += st.short * dx;
        } else {
          // net erosion: everything arriving passes on, plus bed material in its real mix
          oS = iS; oM = iM;
          let need = Qout - Qin;
          for (let l = top; l >= 0 && need > 1e-12; l--) {
            const i = l * nx + j, s = st.sand[i], m = st.mud[i];
            if (s + m <= 0) continue;
            const b = s / pS + m / pM, fr = b <= need ? 1 : need / b;
            const ts = s * fr, tm = m * fr;
            st.sand[i] = s - ts; st.mud[i] = m - tm;
            H[j] -= ts / (1 - st.phs[i]) + tm / (1 - st.phm[i]);
            oS += ts; oM += tm; need -= b * fr;
          }
        }
        if (outR > 0) { const sh = outR / Qout; iSs[j + 1] += oS * sh; iMs[j + 1] += oM * sh; }
        if (outL > 0) { const sh = outL / Qout; iSs[j - 1] += oS * sh; iMs[j - 1] += oM * sh; }
      } else {
        if (iS > 0) { st.sand[open + j] += iS; H[j] += iS / pS; }
        if (iM > 0) { st.mud[open + j] += iM; H[j] += iM / pM; }
      }
    }
    st.cumIn += (qS + qM) * dt; st.cumInS += qS * dt;

    // turbidity currents: bypass steep slope, deposit where gradient decreases
    if (Ftc > 0) {
      const q = [qS * Ftc / pS, qM * Ftc / pM];
      for (let j = je; j < nx; j++) {
        let sl = j < nx - 1 ? (H[j] - H[j + 1]) / dx : (H[j - 1] - H[j]) / dx;
        if (sl < 1e-5) sl = 1e-5;
        for (let lith = 0; lith < 2; lith++) {
          const L = P.tcL0[lith] * Math.pow(sl / P.tcSref, P.tcN);
          const dep = q[lith] * (1 - Math.exp(-dx / L));
          q[lith] -= dep;
          const dB = dep * dt / dx;
          if (lith === SAND) st.sand[open + j] += dB * pS; else st.mud[open + j] += dB * pM;
          H[j] += dB;
        }
      }
      st.cumOut += (q[0] * pS + q[1] * pM) * dt; st.cumOutS += q[0] * pS * dt;
    }
  }

  // 1D consolidation of one column (excess pore pressure u, porosity via max effective stress)
  function compactColumn(st, P, j, top, dtYr) {
    const nx = st.nx, S = st.scratch, idx = S.idx;
    let n = 0;
    for (let l = 0; l <= top; l++) { const i = l * nx + j; if (st.sand[i] + st.mud[i] > EMPTY) idx[n++] = i; }
    if (n === 0) return;
    const L = S.L, A = S.A, hh = S.hh, kk = S.kk, T = S.T;
    let above = 0;
    for (let m = n - 1; m >= 0; m--) {
      const i = idx[m], s = st.sand[i] + st.mud[i];
      L[m] = DRHO_G * (above + 0.5 * s); above += s;
    }
    for (let m = 0; m < n; m++) {
      const i = idx[m], s = st.sand[i] + st.mud[i];
      let C, k, h;
      if (P.linear) { C = P.linear.C; k = P.linear.k; h = s * (1 + P.linear.e0); }
      else {
        const fs = st.sand[i] / s, sm = st.smax[i];
        const phS = st.phs[i], phM = st.phm[i];
        const kS = st.kps[i], kM = st.kpm[i];
        h = st.sand[i] / (1 - phS) + st.mud[i] / (1 - phM);
        k = 1 / (fs / kS + (1 - fs) / kM);   // vertical flow across interbeds
        const Cl = fs * P.beta[SAND] * phS / ((1 - phS) * (1 - phS)) + (1 - fs) * P.beta[MUD] * phM / ((1 - phM) * (1 - phM));
        C = (L[m] - st.u[i]) >= sm ? Cl : P.elastic * Cl;
      }
      A[m] = s * C; hh[m] = h; kk[m] = k;
    }
    for (let m = 0; m < n - 1; m++) T[m] = 1 / (hh[m] / (2 * kk[m]) + hh[m + 1] / (2 * kk[m + 1]));
    const Ttop = 2 * kk[n - 1] / hh[n - 1];
    const w = dtYr * YR / MU;
    for (let m = 0; m < n; m++) {
      const i = idx[m];
      const lo = m > 0 ? -w * T[m - 1] : 0, up = m < n - 1 ? -w * T[m] : 0;
      S.lo[m] = lo; S.up[m] = up;
      S.di[m] = A[m] - lo - up + (m === n - 1 ? w * Ttop : 0);
      S.rhs[m] = A[m] * (st.u[i] + (L[m] - st.ld[i]));
    }
    thomas(n, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp);
    for (let m = 0; m < n; m++) {
      const i = idx[m];
      let uu = S.x[m];
      if (uu > L[m]) { uu = L[m]; st.clamps++; }
      st.u[i] = uu;
      const sig = L[m] - uu;
      if (sig > st.smax[i]) { st.smax[i] = sig; setPor(st, P, i, sig); }
      st.ld[i] = L[m];
    }
  }


  // ---- salt ----------------------------------------------------------------
  // weight of the sediment column above the salt (Pa) and its bulk thickness (m)
  function sedimentLoads(st, P) {
    const nx = st.nx, S = st.scratch;
    for (let j = 0; j < nx; j++) {
      let w = 0, sb = 0;
      for (let l = 0; l <= st.k; l++) {
        const i = l * nx + j, sol = st.sand[i] + st.mud[i];
        if (sol <= 0) continue;
        const bulk = layerBulk(st, P, i);
        w += sol * RHO_S + (bulk - sol) * RHO_W; sb += bulk;
      }
      S.W[j] = w * G; S.Sb[j] = sb;
    }
  }
  // driving potential at the salt roof: Phi = sigma_v(roof) + rho_salt g z_roof
  // (horizontal gradient of salt pressure at a fixed elevation); a = dPhi/dh_salt
  function saltPotential(st, P, SL) {
    const S = st.scratch;
    for (let j = 0; j < st.nx; j++) {
      const zr = st.b[j] + st.hs[j], wd = SL - (zr + S.Sb[j]);
      S.Phi[j] = S.W[j] + (wd > 0 ? RHO_W * G * wd : 0) + RHO_SALT * G * zr;
      S.aw[j] = (wd > 0 ? RHO_SALT - RHO_W : RHO_SALT) * G;
    }
  }
  function saltStep(st, P, t, dtYr) {
    if (!P.saltOn) return;
    const nx = st.nx, dx = P.dx, S = st.scratch, hs = st.hs, Phi = S.Phi, a = S.aw, M = S.M;
    const SL = seaLevel(P, t), n = P.nSaltSub, c = dtYr * YR / n / (dx * dx), e12 = 12 * P.saltVisc;
    sedimentLoads(st, P);
    for (let s = 0; s < n; s++) {
      saltPotential(st, P, SL);
      // face mobility from the upstream (higher-potential) cell: an empty cell can't send salt
      for (let f = 0; f < nx - 1; f++) { const h = hs[Phi[f] >= Phi[f + 1] ? f : f + 1]; M[f] = h * h * h / e12; }
      for (let j = 0; j < nx; j++) {
        const Mm = j > 0 ? M[j - 1] : 0, Mp = j < nx - 1 ? M[j] : 0;
        S.lo[j] = j > 0 ? -c * Mm * a[j - 1] : 0;
        S.up[j] = j < nx - 1 ? -c * Mp * a[j + 1] : 0;
        S.di[j] = 1 + c * (Mm + Mp) * a[j];
        S.rhs[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0));
      }
      thomas(nx, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp);
      for (let j = 0; j < nx; j++) {
        let h = hs[j] + S.x[j];
        if (h < 0) { st.saltClip += -h * dx; h = 0; }
        hs[j] = h;
      }
    }
  }

  function step(st, P) {
    const nx = st.nx, k1 = st.k + 1;
    if (k1 > st.nSteps) return false;
    const t0 = st.k * P.dtRec;
    for (let j = 0; j < nx; j++) {
      const rate = (P.subsShelf + (P.subsBasin - P.subsShelf) * (j + 0.5) / nx) * 1e-6;
      const dz = rate * P.dtRec;
      st.b[j] -= dz; st.H[j] -= dz;
    }
    const op = k1 * nx;
    for (let j = 0; j < nx; j++) setPor(st, P, op + j, 0);
    const dt = P.dtRec / P.nSub;
    for (let s = 0; s < P.nSub; s++) transportSubstep(st, P, t0 + (s + 0.5) * dt, dt);
    for (let j = 0; j < nx; j++) compactColumn(st, P, j, k1, P.dtRec);
    st.k = k1;
    saltStep(st, P, t0 + 0.5 * P.dtRec, P.dtRec);
    recomputeH(st, P);
    return true;
  }

  // ---- time machine -------------------------------------------------------
  function snapshot(st) {
    const n = (st.k + 1) * st.nx;
    return {
      k: st.k, b: st.b.slice(), hs: st.hs.slice(), saltClip: st.saltClip, sand: st.sand.slice(0, n), mud: st.mud.slice(0, n),
      smax: st.smax.slice(0, n), u: st.u.slice(0, n),
      cumIn: st.cumIn, cumOut: st.cumOut, cumInS: st.cumInS, cumOutS: st.cumOutS, deficit: st.deficit, swap: st.swap, clamps: st.clamps,
      shore: st.shore, shelfEdge: st.shelfEdge, tcShare: st.tcShare,
    };
  }
  function restore(snap, st, P) {
    const n = (snap.k + 1) * st.nx;
    st.k = snap.k; st.b.set(snap.b); st.hs.set(snap.hs); st.saltClip = snap.saltClip;
    for (const key of ['sand', 'mud', 'smax', 'u']) { st[key].fill(0, n); st[key].set(snap[key]); }
    st.ld.fill(0);
    for (let i = 0; i < n; i++) setPor(st, P, i, st.smax[i]);
    st.cumIn = snap.cumIn; st.cumOut = snap.cumOut; st.cumInS = snap.cumInS; st.cumOutS = snap.cumOutS; st.deficit = snap.deficit; st.swap = snap.swap; st.clamps = snap.clamps;
    st.shore = snap.shore; st.shelfEdge = snap.shelfEdge; st.tcShare = snap.tcShare;
    for (let j = 0; j < st.nx; j++) loadsInto(st, j, st.k);
    recomputeH(st, P);
  }

  function storedSolid(st, P) {
    let s = 0, sand = 0;
    const n = (st.k + 1) * st.nx;
    for (let i = 0; i < n; i++) { s += st.sand[i] + st.mud[i]; sand += st.sand[i]; }
    return { all: s * P.dx, sand: sand * P.dx };
  }
  function massBalance(st, P) {
    const ss = storedSolid(st, P);
    const stored = ss.all - st.initSolid, expected = st.cumIn - st.cumOut;
    const storedS = ss.sand - st.initSand, expectedS = st.cumInS - st.cumOutS;
    return { supplied: st.cumIn, exported: st.cumOut, stored, error: stored - expected,
      relError: st.cumIn > 0 ? (stored - expected) / st.cumIn : 0,
      sandRelError: st.cumInS > 0 ? (storedS - expectedS) / st.cumInS : 0,
      deficit: st.deficit, ...saltBalance(st, P) };
  }
  function saltBalance(st, P) {
    let v = 0; for (let j = 0; j < st.nx; j++) v += st.hs[j] * P.dx;
    return { saltVol: v, saltInit: st.initSalt, saltRelError: st.initSalt > 0 ? (v - st.initSalt) / st.initSalt : 0, saltClip: st.saltClip };
  }

  // ---- benchmarks ---------------------------------------------------------
  // Gibson (1958): excess pore pressure in a layer growing at constant rate m on an
  // impermeable base. U = u/(gamma' h), X = z/h, T = m^2 t / c_v.
  function gibsonAnalytic(X, T) {
    const a = X * Math.sqrt(T) / 2, sT = Math.sqrt(T);
    const top = a + 10, N = 4000, hstep = top / N;
    const fn = (e) => e * Math.tanh(sT * e) * (Math.exp(-(e - a) * (e - a)) + Math.exp(-(e + a) * (e + a)));
    let sum = fn(0) + fn(top);
    for (let i = 1; i < N; i++) sum += fn(i * hstep) * (i % 2 ? 4 : 2);
    const I = sum * hstep / 3;
    return 1 - 2 / Math.sqrt(Math.PI * T) * I;
  }

  // run the real compactColumn() in constant-property mode against Gibson
  function gibsonNumeric(T, nSteps) {
    nSteps = nSteps || 400;
    const m = 1e-3, tEnd = 1e6, dt = tEnd / nSteps, e0 = 1, mv = 1e-8;
    const cv = m * m * tEnd / T;                     // m^2/yr
    const k = cv * MU * mv / YR;
    const P = defaultParams();
    P.nx = 1; P.linear = { e0, C: mv * (1 + e0), k };
    const st = { k: 0, nx: 1, NL: nSteps + 1, sand: new Float64Array(nSteps + 1), mud: new Float64Array(nSteps + 1),
      smax: new Float64Array(nSteps + 1), u: new Float64Array(nSteps + 1), ld: new Float64Array(nSteps + 1),
      phs: new Float64Array(nSteps + 1).fill(P.phi0[SAND]), phm: new Float64Array(nSteps + 1).fill(P.phi0[MUD]),
      kps: new Float64Array(nSteps + 1).fill(perm(P, SAND, P.phi0[SAND])), kpm: new Float64Array(nSteps + 1).fill(perm(P, MUD, P.phi0[MUD])),
      clamps: 0, scratch: makeScratch(1, nSteps + 1) };
    const sl = m * dt / (1 + e0);
    for (let s = 0; s < nSteps; s++) { st.mud[s] = sl; compactColumn(st, P, 0, s, dt); }
    const h = m * tEnd, gp = DRHO_G / (1 + e0);
    const X = [], U = [];
    for (let s = 0; s < nSteps; s++) { X.push((s + 0.5) / nSteps); U.push(st.u[s] / (gp * h)); }
    return { X, U };
  }

  // slow deposition, very permeable: should stay hydrostatic; compare porosity to
  // Sclater & Christie (1980) depth curves
  function drainedColumn(lith, depthTarget) {
    const P = defaultParams(); P.kMudMult = 1e6; P.kA = [-10, -10]; P.kB = [0, 0];
    const nSteps = 600, dt = 5000, rate = depthTarget / (nSteps * dt) * 1.7;
    const st = { k: 0, nx: 1, NL: nSteps + 1, sand: new Float64Array(nSteps + 1), mud: new Float64Array(nSteps + 1),
      smax: new Float64Array(nSteps + 1), u: new Float64Array(nSteps + 1), ld: new Float64Array(nSteps + 1),
      phs: new Float64Array(nSteps + 1).fill(P.phi0[SAND]), phm: new Float64Array(nSteps + 1).fill(P.phi0[MUD]),
      kps: new Float64Array(nSteps + 1).fill(perm(P, SAND, P.phi0[SAND])), kpm: new Float64Array(nSteps + 1).fill(perm(P, MUD, P.phi0[MUD])),
      clamps: 0, scratch: makeScratch(1, nSteps + 1) };
    for (let s = 0; s < nSteps; s++) {
      const bulk = rate * dt, sol = bulk * (1 - P.phi0[lith]);
      if (lith === SAND) st.sand[s] = sol; else st.mud[s] = sol;
      compactColumn(st, P, 0, s, dt);
    }
    const out = []; let z = 0, maxLam = 0;
    for (let s = nSteps - 1; s >= 0; s--) {
      const ph = porosity(P, lith, st.smax[s]);
      const solid = st.sand[s] + st.mud[s], h = solid / (1 - ph);
      out.push({ z: z + h / 2, phi: ph, sc: P.phi0[lith] * Math.exp(-(lith === SAND ? 0.27e-3 : 0.51e-3) * (z + h / 2)) });
      maxLam = Math.max(maxLam, st.u[s] / st.ld[s]);
      z += h;
    }
    return { profile: out, maxLam };
  }


  // ---- salt benchmarks ------------------------------------------------------
  // a bare salt layer under deep water (no sediment) with a small cosine bump in
  // thickness relaxes by lubrication flow; linear theory gives exponential decay at
  // rate r = (h0^3 / 12 eta) (rho_salt - rho_w) g k^2 for wavenumber k.
  function bareSaltState(P, nx, h0, amp, mode) {
    const st = { k: 0, nx, NL: 1, nSteps: 0, b: new Float64Array(nx), hs: new Float64Array(nx), H: new Float64Array(nx),
      sand: new Float64Array(nx), mud: new Float64Array(nx), smax: new Float64Array(nx), u: new Float64Array(nx), ld: new Float64Array(nx),
      phs: new Float64Array(nx).fill(P.phi0[SAND]), phm: new Float64Array(nx).fill(P.phi0[MUD]), saltClip: 0, scratch: makeScratch(nx, 1) };
    for (let j = 0; j < nx; j++) { st.b[j] = -3000 - h0; st.hs[j] = h0 + amp * Math.cos(Math.PI * mode * (j + 0.5) / nx); }
    return st;
  }
  function saltRelaxation(mode, eta, nRec) {
    const P = defaultParams(); P.slAmp = 0; P.slShift = 0; P.saltVisc = eta;
    const nx = 100, h0 = 1500, amp = 1, L = nx * P.dx;
    const st = bareSaltState(P, nx, h0, amp, mode);
    const k = Math.PI * mode / L, r = h0 * h0 * h0 / (12 * eta) * (RHO_SALT - RHO_W) * G * k * k;   // 1/s
    const tEnd = nRec * P.dtRec;
    for (let s = 0; s < nRec; s++) saltStep(st, P, 0, P.dtRec);
    // project onto the cosine mode to read the amplitude
    let num = 0, den = 0;
    for (let j = 0; j < nx; j++) { const c = Math.cos(Math.PI * mode * (j + 0.5) / nx); num += (st.hs[j] - h0) * c; den += c * c; }
    const rNum = -Math.log(num / den / amp) / (tEnd * YR);
    let v = 0; for (let j = 0; j < nx; j++) v += st.hs[j];
    return { rAnalytic: r, rNumeric: rNum, relErr: rNum / r - 1, efoldYr: 1 / (r * YR), tEnd, volErr: v / (nx * h0) - 1 };
  }
  // a sediment layer resting on half of a flat salt sheet under deep water: by hand,
  // the potential step is its buoyant weight (rho_s - rho_w) g * solid thickness, and
  // the first-instant Poiseuille flux across the step is (h0^3/12 eta) * dPhi / dx.
  function saltLoadStep() {
    const P = defaultParams(); P.slAmp = 0; P.slShift = 0; P.saltVisc = 1e18; P.nSaltSub = 1;
    const nx = 40, h0 = 1500, solid = 100, st = bareSaltState(P, nx, h0, 0, 1);
    for (let j = 0; j < nx / 2; j++) { st.mud[j] = solid; st.phm[j] = 0.4; }
    sedimentLoads(st, P); saltPotential(st, P, 0);
    const dPhi = st.scratch.Phi[nx / 2 - 1] - st.scratch.Phi[nx / 2];
    const dPhiHand = (RHO_S - RHO_W) * G * solid;
    const qHand = h0 * h0 * h0 / (12 * P.saltVisc) * dPhiHand / P.dx;            // m^2/s
    const dtYr = 1;                                                                // tiny step: implicit ~ explicit
    const before = st.hs.slice();
    saltStep(st, P, 0, dtYr);
    let moved = 0; for (let j = nx / 2; j < nx; j++) moved += (st.hs[j] - before[j]) * P.dx;
    const qNum = moved / (dtYr * YR);
    return { dPhi, dPhiHand, phiErr: dPhi / dPhiHand - 1, qNum, qHand, qErr: qNum / qHand - 1 };
  }

  return { saltRelaxation, saltLoadStep, saltBalance, defaultParams, clone, createState, step, snapshot, restore, massBalance, seaLevel,
    porosity, voidRatio, layerBulk, gibsonAnalytic, gibsonNumeric, drainedColumn,
    consts: { RHO_SALT, G, RHO_W, RHO_S, MU, YR, DRHO_G, SAND, MUD, EMPTY } };
});
