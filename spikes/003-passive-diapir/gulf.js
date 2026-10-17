// Gulf-like demonstration (spike 003): the M3.8 'gulf' preset values run in this spike's own engine copy.
// Not the product engine: the spike has one fixed record step (100 kyr), no bundled compaction, its own seeded
// noise and its own start profile, so the numbers are not the M3.8 preset's. See README.
const fs = require('fs');
const S = require('./engine.js');

function gulfParams(over) {
  const P = S.defaultParams();
  Object.assign(P, {
    nx: 400, dx: 1000, duration: 66e6, dtRec: 100000, nSub: 5,
    supply: 28, subsShelf: 90, subsBasin: 80, tcMax: 0.1, slAmp: 0, slShift: 0,
    saltOn: true, saltThick: 4000, saltPinch: [10000, 100000], saltLimit: [200000, 240000], saltVisc: 1e18,
    coverThick: 300, coverNoise: 0.5, seed: 2, coverVisc: 1e19, weldThick: 100,
    coverBend: 1, limiter: 1, nSaltSub: 5,
  });
  return Object.assign(P, over || {});
}

// local maxima of the salt thickness with prominence >= minProm (m); returns column indices
function saltHighs(hs, minProm) {
  const n = hs.length, out = [];
  for (let j = 1; j < n - 1; j++) {
    if (!(hs[j] > hs[j - 1] && hs[j] >= hs[j + 1])) continue;
    let l = j - 1, lmin = hs[j]; while (l >= 0 && hs[l] <= hs[j]) { lmin = Math.min(lmin, hs[l]); l--; }
    let r = j + 1, rmin = hs[j]; while (r < n && hs[r] <= hs[j]) { rmin = Math.min(rmin, hs[r]); r++; }
    const base = Math.max(l >= 0 ? lmin : -Infinity, r < n ? rmin : -Infinity);
    const prom = hs[j] - (l < 0 ? rmin : r >= n ? lmin : Math.max(lmin, rmin));
    if (prom >= minProm) out.push(j);
  }
  return out;
}

/** exposed clusters: contiguous columns with salt and cover < roofMin -> [{j0, j1}] */
function exposedClusters(st, roofMin) {
  const out = []; let j0 = -1;
  for (let j = 0; j <= st.nx; j++) {
    const e = j < st.nx && st.hs[j] > 0 && st.cover[j] < roofMin;
    if (e && j0 < 0) j0 = j;
    if (!e && j0 >= 0) { out.push({ j0, j1: j - 1 }); j0 = -1; }
  }
  return out;
}

function weldRuns(st, P) {
  const out = []; let j0 = -1;
  for (let j = 0; j <= st.nx; j++) {
    const w = j < st.nx && st.weldAge[j] >= 0 && st.hs[j] < P.weldThick;
    if (w && j0 < 0) j0 = j;
    if (!w && j0 >= 0) { out.push({ j0, j1: j - 1, km: (j - j0) * P.dx / 1000, age: Math.min(...Array.from(st.weldAge.subarray(j0, j))) }); j0 = -1; }
  }
  return out;
}

function runGulf(over, opts) {
  opts = opts || {};
  const P = gulfParams(over);
  const st = S.createState(P);
  const t0 = Date.now();
  const track = [];            // every 10 steps: exposed clusters
  const first = new Map();     // first model time (Myr) a column is exposed
  const snaps = [];
  let steps = 0;
  while (S.step(st, P)) {
    steps++;
    if (st.k % 10 === 0) {
      const cl = exposedClusters(st, P.roofMin);
      track.push({ t: st.k * P.dtRec / 1e6, clusters: cl.map((c) => ({ ...c })), shore: st.shore });
      for (const c of cl) for (let j = c.j0; j <= c.j1; j++) if (!first.has(j)) first.set(j, st.k * P.dtRec / 1e6);
    }
    if (opts.snapEvery && st.k % opts.snapEvery === 0) snaps.push({ t: st.k * P.dtRec / 1e6, hs: Array.from(st.hs), H: Array.from(st.H), b: Array.from(st.b), cover: Array.from(st.cover) });
  }
  const ms = Date.now() - t0;
  return { P, st, ms, track, first, snaps };
}

module.exports = { gulfParams, runGulf, saltHighs, exposedClusters, weldRuns };

if (require.main === module) {
  const variant = process.argv[2] || 'base';
  const over = JSON.parse(process.argv[3] || '{}');
  const V = { base: {}, bypass: { exposed: 1 }, shed: { shed: 1 }, both: { exposed: 1, shed: 1 } };
  const r = runGulf(Object.assign({}, V[variant], over));
  const { st, P } = r;
  const mb = S.massBalance(st, P);
  const hs = Array.from(st.hs);
  const hi = saltHighs(hs, 300);
  const wr = weldRuns(st, P);
  const cl = exposedClusters(st, P.roofMin);
  console.log(`${variant}: ${(r.ms / 1000).toFixed(1)} s; salt err ${mb.saltRelError.toExponential(1)} clip ${mb.saltClip} limited ${mb.saltLimited}; sand ${mb.sandRelError.toExponential(1)} mud ${mb.mudRelError.toExponential(1)} deficit ${mb.deficitFrac.toExponential(1)} bypass sand/mud ${(mb.bypassSand / 1e6).toFixed(2)}/${(mb.bypassMud / 1e6).toFixed(2)} km2 shed ${(mb.shedSand / 1e6).toFixed(2)}/${(mb.shedMud / 1e6).toFixed(2)}`);
  console.log('  salt highs (km:salt m:cover m):', hi.map((j) => `${((j + 0.5)).toFixed(0)}:${hs[j].toFixed(0)}:${st.cover[j].toFixed(0)}`).join(' '));
  console.log('  exposed now:', JSON.stringify(cl.map((c) => `${c.j0 + 0.5}-${c.j1 + 0.5} km`)));
  console.log('  weld runs:', JSON.stringify(wr.map((w) => `${(w.j0 + 0.5).toFixed(0)}-${(w.j1 + 0.5).toFixed(0)} km (${w.km} km, ${w.age.toFixed(1)} Myr)`)));
  console.log('  shoreline col', st.shore, 'max salt', Math.max(...hs).toFixed(0));
  const prof = []; for (let j = 0; j < st.nx; j += 20) prof.push(`${j}:${hs[j].toFixed(0)}/${st.cover[j].toFixed(0)}`); console.log('  hs/cover every 20 km:', prof.join(' '));
}
