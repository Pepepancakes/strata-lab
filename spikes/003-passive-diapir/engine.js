/*
 * Strata Lab - spike 003 (passive diapirs) - process engine (pure JS, no DOM).
 * Copy of spike 002's engine (spike 001 + thin-sheet salt) plus, all switchable, all off by default:
 *   - cover bending stiffness (ported from src/engine/salt.ts, M3.2) and the weld outflow limiter (M3.3)
 *   - exposed salt with sediment bypass (P.exposed): a column whose cover is thinner than P.roofMin has
 *     no roof; sediment arriving on it is passed to the lower neighbouring columns, per grain size
 *   - roof thinning (P.shed): a rising crest sheds a share of its cover to its lower neighbours
 *   - power-law salt rheology (P.saltN > 1)
 *   - a controlled test mode (P.ctrl): prescribed aggradation, prescribed salt feed, no transport
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
      // --- spike 003 additions ---
      coverBend: 0,        // 1 = cover bending stiffness (plate) in the salt step (src/engine/salt.ts, M3.2)
      coverVisc: 1e19,     // cover effective viscosity as a plate, Pa s
      limiter: 0,          // 1 = weld outflow limiter instead of the clip (src/engine/salt.ts, M3.3)
      weldThick: 100,      // a column is welded once its salt is thinner than this, m
      exposed: 0,          // 1 = exposed salt with sediment bypass
      roofMin: 2,          // m of bulk cover below which a salt column counts as exposed (no roof)
      shed: 0,             // roof thinning: m of cover shed per m of salt rise, for columns with thin cover
      shedBelow: 1000,     // m: only a cover thinner than this is shed
      saltN: 1,            // salt stress exponent (1 = Newtonian)
      saltTauRef: 1e5,     // Pa: wall shear stress at which the power-law viscosity equals saltVisc
      ctrl: null,          // controlled test mode, see ctrlDeposit()
      saltThick: 1500,     // initial salt thickness basinward of the pinch-out, m (start of run only)
      saltPinch: [25000, 45000], // salt edge: zero landward of x0, full thickness basinward of x1
      saltLimit: [2e6, 2.5e6],   // M3.10 basinward limit: full thickness landward of [0], none basinward of [1] (defaults lie beyond any section)
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

  /** Start salt thickness at distance x (m): pinch-out smoothstep, then the M3.10 basinward limit (same arithmetic as initialSaltThickness in src/engine/salt.ts). */
  function initialSaltThickness(P, x) {
    const [x0, x1] = P.saltPinch, [l0, l1] = P.saltLimit;
    let f = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
    f = f * f * (3 - 2 * f);
    let h = P.saltThick * f;
    if (x > l0) {
      let g = Math.max(0, Math.min(1, (x - l0) / (l1 - l0)));
      g = g * g * (3 - 2 * g);
      h *= 1 - g;
    }
    return h;
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
      H: new Float64Array(nx), H0: new Float64Array(nx), hs: new Float64Array(nx), initSalt: 0, saltClip: 0, cover: new Float64Array(nx), expo: new Uint8Array(nx),
      feedIn: 0, defS: 0, defM: 0, bypassS: 0, bypassM: 0, shedS: 0, shedM: 0, limited: 0, weldAge: new Float64Array(nx).fill(-1),
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
      const x = (j + 0.5) * P.dx;
      st.hs[j] = P.saltOn ? initialSaltThickness(P, x) : 0; st.initSalt += st.hs[j] * P.dx;
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
      W: f(), Sb: f(), Phi: f(), aw: f(), M: f(), hA: f(), dhs: f(),
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
    for (let j = 0; j < nx; j++) st.H[j] = st.b[j] + st.hs[j];
    for (let l = 0; l <= st.k; l++) for (let j = 0; j < nx; j++) st.H[j] += layerBulk(st, P, l * nx + j);
    for (let j = 0; j < nx; j++) {
      st.cover[j] = st.H[j] - st.b[j] - st.hs[j];
      st.expo[j] = P.exposed && st.hs[j] > 0 && st.cover[j] < P.roofMin ? 1 : 0;
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
          if (dS > 0) { st.sand[open + j] += dS; H[j] += dS / pS; } else if (dS < 0) { H[j] -= erode(st, P, j, SAND, -dS, top); if (st.short > 0) { st.deficit += st.short * dx; st.defS += st.short * dx; } }
          if (dM > 0) { st.mud[open + j] += dM; H[j] += dM / pM; } else if (dM < 0) { H[j] -= erode(st, P, j, MUD, -dM, top); if (st.short > 0) { st.deficit += st.short * dx; st.defM += st.short * dx; } }
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
    if (P.exposed) bypassFresh(st, P, top);
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
  // weight of the sediment column above the salt (Pa) and its bulk thickness (m).
  // Layer-major loops (same per-column addition order as a column walk, so the same bits).
  function sedimentLoads(st, P) {
    const nx = st.nx, S = st.scratch, W = S.W, Sb = S.Sb;
    W.fill(0, 0, nx); Sb.fill(0, 0, nx);
    for (let l = 0; l <= st.k; l++) {
      const row = l * nx;
      for (let j = 0; j < nx; j++) {
        const i = row + j, sol = st.sand[i] + st.mud[i];
        if (sol <= 0) continue;
        const bulk = layerBulk(st, P, i);
        W[j] += sol * RHO_S + (bulk - sol) * RHO_W; Sb[j] += bulk;
      }
    }
    for (let j = 0; j < nx; j++) W[j] *= G;
  }
  // driving potential at the salt roof: Phi = sigma_v(roof) + rho_salt g z_roof
  // (horizontal gradient of salt pressure at a fixed elevation); a = dPhi/dh_salt.
  // Where there is no cover (exposed salt) W and Sb are 0, so the pressure on the salt top is the
  // water load alone (rho_w g water depth) - the formula needs no special case.
  function saltPotentialOf(st, P, SL, h) {
    const S = st.scratch, rs = P.rhoSalt || RHO_SALT;   // P.rhoSalt: salt density override for the density-contrast tests (default 2160)
    for (let j = 0; j < st.nx; j++) {
      const zr = st.b[j] + h[j], wd = SL - (zr + S.Sb[j]);
      S.Phi[j] = S.W[j] + (wd > 0 ? RHO_W * G * wd : 0) + rs * G * zr;
      S.aw[j] = (wd > 0 ? rs - RHO_W : rs) * G;
    }
  }
  function saltPotential(st, P, SL) { saltPotentialOf(st, P, SL, st.hs); }

  // face mobility M_f (m^3/(Pa s)) from the upstream (higher-potential) column.
  // Newtonian: h^3 / 12 eta. Power law (strain rate = A tau^n): channel flow between no-slip plates gives
  //   q = -(2A/(n+2)) (h/2)^(n+2) |G|^(n-1) G,  G = dPhi/dx,  so  M = (2A/(n+2)) (h/2)^(n+2) |G|^(n-1)
  // with A = 1/(eta tauRef^(n-1)) so that eta_eff = eta at wall shear stress tauRef (n = 1 gives h^3/12 eta).
  function faceMobility(st, P, h) {
    const nx = st.nx, S = st.scratch, Phi = S.Phi, M = S.M, n = P.saltN;
    if (n === 1) {
      const e12 = 12 * P.saltVisc;
      for (let f = 0; f < nx - 1; f++) { const hu = h[Phi[f] >= Phi[f + 1] ? f : f + 1]; M[f] = hu * hu * hu / e12; }
    } else {
      const A = 1 / (P.saltVisc * Math.pow(P.saltTauRef, n - 1)), k = 2 * A / (n + 2);
      for (let f = 0; f < nx - 1; f++) {
        const hu = h[Phi[f] >= Phi[f + 1] ? f : f + 1], gr = Math.abs(Phi[f + 1] - Phi[f]) / P.dx;
        M[f] = k * Math.pow(hu / 2, n + 2) * Math.pow(gr, n - 1);
      }
    }
  }

  // ---- banded LU with partial pivoting (port of src/engine/banded.ts) ----
  function solveBanded(n, kl, ku, ab, ipiv, b) {
    const kv = kl + ku, at = (i, j) => (kv + i - j) * n + j;
    let ju = 0;
    for (let j = 0; j < n; j++) {
      const km = Math.min(kl, n - 1 - j);
      let jp = 0, best = Math.abs(ab[at(j, j)]);
      for (let d = 1; d <= km; d++) { const v = Math.abs(ab[at(j + d, j)]); if (v > best) { best = v; jp = d; } }
      ipiv[j] = j + jp;
      if (!(best > 0)) throw new Error('solveBanded: singular matrix');
      ju = Math.max(ju, Math.min(j + ku + jp, n - 1));
      if (jp !== 0) for (let c = j; c <= ju; c++) { const p = at(j, c), q = at(j + jp, c), t = ab[p]; ab[p] = ab[q]; ab[q] = t; }
      if (km > 0) {
        const piv = ab[at(j, j)];
        for (let d = 1; d <= km; d++) ab[at(j + d, j)] /= piv;
        for (let c = j + 1; c <= ju; c++) { const u = ab[at(j, c)]; if (u !== 0) for (let d = 1; d <= km; d++) ab[at(j + d, c)] -= ab[at(j + d, j)] * u; }
      }
    }
    for (let j = 0; j < n; j++) {
      const l = ipiv[j];
      if (l !== j) { const t = b[j]; b[j] = b[l]; b[l] = t; }
      const km = Math.min(kl, n - 1 - j), bj = b[j];
      for (let d = 1; d <= km; d++) b[j + d] -= ab[at(j + d, j)] * bj;
    }
    for (let j = n - 1; j >= 0; j--) {
      b[j] /= ab[at(j, j)];
      const bj = b[j];
      for (let i = Math.max(0, j - kv); i < j; i++) b[i] -= ab[at(i, j)] * bj;
    }
  }

  // ---- cover bending (port of src/engine/salt.ts coverStiffness / solveBent) ----
  // The cover is one thin viscous plate, D_i = eta_c h_c,i^3 / 3 per column with h_c = bulk cover thickness.
  // Where the cover is zero (exposed salt) D_i = 0: that column adds nothing to K, so the plate simply has no
  // stiffness there. K = G^T diag(D) G / dx^4 stays symmetric and positive semi-definite for any D >= 0, so
  // nothing is singular when the thickness goes to 0; the neighbouring columns' rows still bend over the gap.
  function bendState(st) {
    if (!st.bnd) {
      const nx = st.nx;
      st.bnd = { s0: new Float64Array(nx), s1: new Float64Array(nx), s2: new Float64Array(nx),
        ab: new Float64Array((2 * 3 + 3 + 1) * nx), ipiv: new Int32Array(nx) };
    }
    return st.bnd;
  }
  function coverStiffness(st, P, dtS) {
    const B = bendState(st), nx = st.nx, dx = P.dx, Sb = st.scratch.Sb;
    const f = P.coverVisc / 3 / (dx * dx * dx * dx) / dtS;
    B.s0.fill(0); B.s1.fill(0); B.s2.fill(0);
    for (let i = 0; i < nx; i++) {
      const hc = Sb[i], Di = f * hc * hc * hc;
      if (i === 0) { B.s0[0] += Di; B.s0[1] += Di; B.s1[0] += -Di; }
      else if (i === nx - 1) { B.s0[nx - 2] += Di; B.s0[nx - 1] += Di; B.s1[nx - 2] += -Di; }
      else {
        B.s0[i - 1] += Di; B.s0[i] += 4 * Di; B.s0[i + 1] += Di;
        B.s1[i - 1] += -2 * Di; B.s1[i] += -2 * Di; B.s2[i - 1] += Di;
      }
    }
  }
  function solveBent(st, c) {
    const S = st.scratch, B = bendState(st), nx = st.nx, M = S.M, a = S.aw, Phi = S.Phi;
    B.ab.fill(0);
    const sEntry = (k, m) => {
      if (k < 0 || m < 0 || k >= nx || m >= nx) return 0;
      const d = m - k;
      if (d === 0) return a[k] + B.s0[k];
      if (d === 1) return B.s1[k];
      if (d === -1) return B.s1[m];
      if (d === 2) return B.s2[k];
      if (d === -2) return B.s2[m];
      return 0;
    };
    for (let j = 0; j < nx; j++) {
      const Mm = j > 0 ? M[j - 1] : 0, Mp = j < nx - 1 ? M[j] : 0;
      for (let m = Math.max(0, j - 3); m <= Math.min(nx - 1, j + 3); m++) {
        let v = c * ((Mp + Mm) * sEntry(j, m) - Mp * sEntry(j + 1, m) - Mm * sEntry(j - 1, m));
        if (m === j) v += 1;
        B.ab[(6 + j - m) * nx + m] = v;
      }
      S.x[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0));
    }
    solveBanded(nx, 3, 3, B.ab, B.ipiv, S.x);
  }

  // ---- weld limiter (port of src/engine/salt.ts limitOutflow) ----
  function limitOutflow(st, h) {
    const S = st.scratch, nx = st.nx, phi = S.cp, lam = S.dp, x = S.x;
    let run = 0;
    for (let f = 0; f < nx - 1; f++) { run += x[f]; phi[f] = run; }
    for (let j = 0; j < nx; j++) {
      const left = j > 0 ? Math.max(phi[j - 1], 0) : 0, right = j < nx - 1 ? Math.max(-phi[j], 0) : 0, out = left + right;
      lam[j] = out > h[j] ? h[j] / out : 1;
      if (lam[j] < 1) st.limited++;
    }
    for (let f = 0; f < nx - 1; f++) phi[f] *= phi[f] > 0 ? lam[f + 1] : lam[f];
    for (let j = 0; j < nx; j++) {
      const t = h[j] + (j < nx - 1 ? phi[j] : 0) - (j > 0 ? phi[j - 1] : 0);
      x[j] = (t > 0 ? t : 0) - h[j];
    }
  }

  // One record step of salt flow: nSaltSub semi-implicit substeps (see src/engine/salt.ts header for the equations).
  // Leaves the change of salt thickness per column in scratch.dhs (the roof-thinning step uses it).
  function saltStep(st, P, t, dtYr) {
    const S = st.scratch, nx = st.nx;
    if (!P.saltOn) { S.dhs.fill(0, 0, nx); return; }
    const dx = P.dx, hs = st.hs, a = S.aw, M = S.M, Phi = S.Phi;
    const n = P.nSaltSub, c = dtYr * YR / n / (dx * dx), SL = seaLevel(P, t);
    const noFlow = P.ctrl && P.ctrl.noFlow;
    S.hA.set(hs.subarray(0, nx));
    if (!noFlow) {
      sedimentLoads(st, P);
      const bend = P.coverBend === 1 && P.coverVisc > 0 && nx >= 5;
      if (bend) coverStiffness(st, P, dtYr * YR / n);
      for (let s = 0; s < n; s++) {
        saltPotentialOf(st, P, SL, hs);
        faceMobility(st, P, hs);
        if (bend) solveBent(st, c);
        else {
          for (let j = 0; j < nx; j++) {
            const Mm = j > 0 ? M[j - 1] : 0, Mp = j < nx - 1 ? M[j] : 0;
            S.lo[j] = j > 0 ? -c * Mm * a[j - 1] : 0;
            S.up[j] = j < nx - 1 ? -c * Mp * a[j + 1] : 0;
            S.di[j] = 1 + c * (Mm + Mp) * a[j];
            S.rhs[j] = c * ((j < nx - 1 ? Mp * (Phi[j + 1] - Phi[j]) : 0) - (j > 0 ? Mm * (Phi[j] - Phi[j - 1]) : 0));
          }
          thomas(nx, S.lo, S.di, S.up, S.rhs, S.x, S.cp, S.dp);
        }
        if (P.limiter) {
          let low = false;
          for (let j = 0; j < nx; j++) if (hs[j] + S.x[j] < 0) { low = true; break; }
          if (low) limitOutflow(st, hs);
        }
        for (let j = 0; j < nx; j++) {
          let h = hs[j] + S.x[j];
          if (h < 0) { st.saltClip += -h * dx; h = 0; }
          hs[j] = h;
        }
      }
    }
    // prescribed feed from below (controlled tests only): q m^2/s spread evenly over the listed columns
    if (P.ctrl && P.ctrl.feed) {
      const fd = P.ctrl.feed, add = fd.q * dtYr * YR;
      const per = add / fd.cols.length / dx;
      for (const j of fd.cols) hs[j] += per;
      st.feedIn += add;
    }
    const ageMyr = (t + 0.5 * dtYr) / 1e6;
    for (let j = 0; j < nx; j++) {
      S.dhs[j] = hs[j] - S.hA[j];
      if (st.weldAge[j] < 0 && S.hA[j] >= P.weldThick && hs[j] < P.weldThick) st.weldAge[j] = ageMyr;
    }
  }

  // ---- exposed salt: sediment bypass ---------------------------------------------------------------
  // A column is exposed when it holds salt and its cover is thinner than P.roofMin (st.expo, set in recomputeH).
  // S3c rule (SALT-R1 finding S3-1). Sediment that arrives on an exposed column is shed ONLY IF the column is a
  // topographic high, and it follows the slope. Both tests use the seafloor at the START of the record step
  // (st.H0), never the surface after the substep's own deposit: that surface is smoothed by the transport, and a
  // hole in the seafloor looks like a high to its neighbours once the transport has begun to fill it (the S3b bug).
  //   - high: H0[j] is at or above the seafloor of the nearest NOT exposed column on each side;
  //   - receivers: the nearest not exposed column on a side whose H0 is lower;
  //   - split: in proportion to the slope to each receiver, (H0[j] - H0[q]) / ((j - q) dx). On a level top
  //     the split is equal. A column in a depression keeps what arrives and is buried.
  // Whole solids move, per grain size, so sand and mud are each conserved exactly.
  // `lay` is the layer that holds this substep's fresh deposit. Returns [[column, share], ...].
  function receivers(st, j, Hs, dx) {
    const nx = st.nx, out = [];
    let l = j - 1; while (l >= 0 && st.expo[l]) l--;
    let r = j + 1; while (r < nx && st.expo[r]) r++;
    if (l >= 0 && Hs[l] > Hs[j]) return out;       // not a topographic high
    if (r < nx && Hs[r] > Hs[j]) return out;
    const cand = [];
    if (l >= 0) cand.push([l, (Hs[j] - Hs[l]) / ((j - l) * dx)]);
    if (r < nx) cand.push([r, (Hs[j] - Hs[r]) / ((r - j) * dx)]);
    let sum = 0; for (const c of cand) sum += c[1];
    if (sum > 0) { for (const c of cand) if (c[1] > 0) out.push([c[0], c[1] / sum]); }
    else for (const c of cand) out.push([c[0], 1 / cand.length]);
    return out;
  }
  // bulk thickness of s solids of sand + m of mud sitting in cell i (constant-property mode aware)
  function bulkSM(st, P, s, m, i) { return P.linear ? (s + m) * (1 + P.linear.e0) : s / (1 - st.phs[i]) + m / (1 - st.phm[i]); }
  function bypassFresh(st, P, lay) {
    const nx = st.nx;
    const H = st.H;
    for (let j = 0; j < nx; j++) {
      if (!st.expo[j]) continue;
      const i = lay * nx + j, s = st.sand[i], m = st.mud[i];
      if (s + m <= 0) continue;
      const rc = receivers(st, j, st.H0, P.dx);
      if (!rc.length) continue;
      const bulk = bulkSM(st, P, s, m, i);
      st.sand[i] = 0; st.mud[i] = 0; H[j] -= bulk;
      for (const [q, w] of rc) {
        const iq = lay * nx + q;
        st.sand[iq] += s * w; st.mud[iq] += m * w;
        H[q] += bulkSM(st, P, s * w, m * w, iq);
      }
      st.bypassS += s * P.dx; st.bypassM += m * P.dx;
    }
  }
  // Roof thinning: take `amount` m of bulk cover from the top of column j downward, in the real mix, and give it
  // to the lower neighbours (columns j-1, j+1, equal split) in layer `lay`. Per grain size conserved.
  function shedCover(st, P, j, amount, lay) {
    const nx = st.nx, H = st.H;
    const rc = [];
    if (j > 0 && H[j - 1] < H[j]) rc.push(j - 1);
    if (j < nx - 1 && H[j + 1] < H[j]) rc.push(j + 1);
    if (!rc.length) return 0;
    let need = amount, gotS = 0, gotM = 0;
    for (let l = st.k; l >= 0 && need > 1e-9; l--) {
      const i = l * nx + j, s = st.sand[i], m = st.mud[i];
      if (s + m <= 0) continue;
      const b = bulkSM(st, P, s, m, i), fr = b <= need ? 1 : need / b;
      st.sand[i] = s - s * fr; st.mud[i] = m - m * fr;
      gotS += s * fr; gotM += m * fr; need -= b * fr;
    }
    for (const q of rc) {
      const iq = lay * nx + q;
      st.sand[iq] += gotS / rc.length; st.mud[iq] += gotM / rc.length;
    }
    st.shedS += gotS * P.dx; st.shedM += gotM * P.dx;
    return amount - need;
  }

  // ---- controlled test mode -----------------------------------------------------------------------
  // P.ctrl = { A, fs, flank: [columns], diapir: [columns], feed: {cols, q}, noFlow }
  // No transport. Each record step: every column gets A*dtRec of bulk sediment (sand share fs); salt is fed
  // from below through `feed`; then the equilibrium-surface rule: a diapir column whose seafloor stands above
  // the mean flank seafloor sheds the excess cover (all of it if need be) to the flank columns, equally.
  // This is the proxy for downslope transport that the full engine does with diffusion.
  function ctrlDeposit(st, P, lay) {
    const nx = st.nx, C = P.ctrl, B = C.A * P.dtRec;
    const pS = P.linear ? 1 / (1 + P.linear.e0) : 1 - P.phi0[SAND], pM = P.linear ? 1 / (1 + P.linear.e0) : 1 - P.phi0[MUD];
    for (let j = 0; j < nx; j++) {
      const i = lay * nx + j;
      st.sand[i] += C.fs * B * pS; st.mud[i] += (1 - C.fs) * B * pM;
      st.cumIn += C.fs * B * pS * P.dx + (1 - C.fs) * B * pM * P.dx; st.cumInS += C.fs * B * pS * P.dx;
    }
  }
  function ctrlLevel(st, P) {
    const C = P.ctrl, nx = st.nx, H = st.H;
    let zf = 0;
    const nf = C.flank.length;
    for (const j of C.flank) zf += H[j];
    zf /= nf;
    const lay = st.k;
    let outS = 0, outM = 0;
    for (const j of C.diapir) {
      const ex = H[j] - zf;
      if (ex <= 0) continue;
      let need = Math.min(ex, st.cover[j]);
      for (let l = st.k; l >= 0 && need > 1e-9; l--) {
        const i = l * nx + j, s = st.sand[i], m = st.mud[i];
        if (s + m <= 0) continue;
        const b = bulkSM(st, P, s, m, i), fr = b <= need ? 1 : need / b;
        outS += s * fr; outM += m * fr;
        st.sand[i] = s - s * fr; st.mud[i] = m - m * fr; need -= b * fr;
      }
    }
    if (outS + outM > 0) {
      for (const j of C.flank) {
        const i = lay * nx + j;
        st.sand[i] += outS / nf; st.mud[i] += outM / nf;
      }
      st.bypassS += outS * P.dx; st.bypassM += outM * P.dx;
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
    st.H0.set(st.H);                                   // seafloor at the start of the record step (bypass rule, S3c)
    const op = k1 * nx;
    for (let j = 0; j < nx; j++) setPor(st, P, op + j, 0);
    if (P.ctrl) ctrlDeposit(st, P, k1);
    else {
      const dt = P.dtRec / P.nSub;
      for (let s = 0; s < P.nSub; s++) transportSubstep(st, P, t0 + (s + 0.5) * dt, dt);
    }
    if (!P.ctrl) for (let j = 0; j < nx; j++) compactColumn(st, P, j, k1, P.dtRec);
    st.k = k1;
    saltStep(st, P, t0 + 0.5 * P.dtRec, P.dtRec);
    if (P.saltOn && (P.shed > 0 || P.ctrl)) {
      recomputeH(st, P);
      if (P.ctrl) ctrlLevel(st, P);
      else {
        for (let j = 0; j < nx; j++) {
          const dh = st.scratch.dhs[j];
          if (dh > 0 && st.hs[j] > 0 && st.cover[j] < P.shedBelow) shedCover(st, P, j, Math.min(P.shed * dh, st.cover[j]), k1);
        }
      }
    }
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
      ext: [st.feedIn, st.defS, st.defM, st.bypassS, st.bypassM, st.shedS, st.shedM, st.limited], weldAge: st.weldAge.slice(),
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
    [st.feedIn, st.defS, st.defM, st.bypassS, st.bypassM, st.shedS, st.shedM, st.limited] = snap.ext; st.weldAge.set(snap.weldAge);
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
  // Conservation, per material. Sediment: stored - initial = supplied - exported + deficit, where `deficit` is
  // sediment the transport asked the bed for and the bed did not have (exposed salt, empty bed); it is booked as
  // a source, per grain size, and should be 0 or tiny. Moving sediment between columns (bypass, roof thinning)
  // changes neither side. Salt: end volume - start volume = prescribed feed (controlled tests only).
  function massBalance(st, P) {
    const ss = storedSolid(st, P);
    const stored = ss.all - st.initSolid, expected = st.cumIn - st.cumOut + st.deficit;
    const storedS = ss.sand - st.initSand, expectedS = st.cumInS - st.cumOutS + st.defS;
    const storedM = stored - storedS, expectedM = expected - expectedS;
    const den = Math.max(st.cumIn, 1), denS = Math.max(st.cumInS, 1), denM = Math.max(st.cumIn - st.cumInS, 1);
    return { supplied: st.cumIn, exported: st.cumOut, stored, error: stored - expected,
      relError: (stored - expected) / den,
      sandRelError: (storedS - expectedS) / denS, mudRelError: (storedM - expectedM) / denM,
      deficit: st.deficit, deficitFrac: st.deficit / den, bypassSand: st.bypassS, bypassMud: st.bypassM, shedSand: st.shedS, shedMud: st.shedM, ...saltBalance(st, P) };
  }
  function saltBalance(st, P) {
    let v = 0; for (let j = 0; j < st.nx; j++) v += st.hs[j] * P.dx;
    const den = Math.max(st.initSalt, st.feedIn, 1);
    return { saltVol: v, saltInit: st.initSalt, saltFeed: st.feedIn, saltRelError: (v - st.initSalt - st.feedIn) / den, saltClip: st.saltClip, saltLimited: st.limited };
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
      phs: new Float64Array(nx).fill(P.phi0[SAND]), phm: new Float64Array(nx).fill(P.phi0[MUD]), saltClip: 0, scratch: makeScratch(nx, 1),
      cover: new Float64Array(nx), expo: new Uint8Array(nx), feedIn: 0, limited: 0, weldAge: new Float64Array(nx).fill(-1), initSalt: 0 };
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

  return { initialSaltThickness, sedimentLoads, saltPotential, saltStep, recomputeH, makeScratch, bareSaltState, coverStiffness, bendState, solveBanded, faceMobility, bypassFresh, shedCover, bulkSM, ctrlLevel, layerBulk2: layerBulk,
    saltRelaxation, saltLoadStep, saltBalance, defaultParams, clone, createState, step, snapshot, restore, massBalance, seaLevel,
    porosity, voidRatio, layerBulk, gibsonAnalytic, gibsonNumeric, drainedColumn,
    consts: { RHO_SALT, G, RHO_W, RHO_S, MU, YR, DRHO_G, SAND, MUD, EMPTY } };
});
