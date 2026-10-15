// node grid_check.js  - is diapir width set by physics or by the grid?
// Same physical setup at dx = 1000 m and dx = 500 m: dense older cover (1000 m) with one
// smooth 30 % thin spot (Gaussian, 8 km wide) at x = 100 km. Report the salt high's width.
const AMP = +(process.argv[2] || 0.3), WID = +(process.argv[3] || 8000);
const S = require('./engine.js');
for (const [nx, dx] of [[150, 1000], [300, 500], [600, 250]]) {
  const P = Object.assign(S.defaultParams(), { nx, dx, saltVisc: 1e17, coverThick: 1000, coverSmax: 30e6 });
  const st = S.createState(P);
  for (let j = 0; j < nx; j++) {
    const x = (j + 0.5) * dx, f = 1 - AMP * Math.exp(-(((x - 100000) / WID) ** 2));
    const s0 = st.sand[j], m0 = st.mud[j], bulk0 = S.layerBulk(st, P, j);
    st.sand[j] = s0 * f; st.mud[j] = m0 * f;
    st.b[j] += bulk0 * (1 - f);               // keep the seafloor where it was
    st.initSolid -= (s0 + m0) * (1 - f) * dx; st.initSand -= s0 * (1 - f) * dx;
  }
  // recompute H via a zero-length restore round trip
  S.restore(S.snapshot(st), st, P);
  const t0 = Date.now();
  while (S.step(st, P)) {}
  const hs = st.hs;
  let jm = Math.round(80000 / dx); for (let j = jm; j < Math.round(120000 / dx); j++) if (hs[j] > hs[jm]) jm = j;
  // background = median salt 70-130 km
  const bg = Array.from(hs.slice(Math.round(70000 / dx), Math.round(130000 / dx))).sort((a, b) => a - b)[Math.round(30000 / dx)];
  const half = bg + (hs[jm] - bg) / 2;
  let l = jm, r = jm; while (l > 0 && hs[l] > half) l--; while (r < nx - 1 && hs[r] > half) r++;
  const cover = st.H[jm] - st.b[jm] - hs[jm];
  console.log(`dx ${dx} m: peak salt ${hs[jm].toFixed(0)} m at ${((jm + 0.5) * dx / 1000).toFixed(1)} km over background ${bg.toFixed(0)} m; width at half height ${((r - l - 1) * dx / 1000).toFixed(1)} km = ${r - l - 1} cells; cover over peak ${cover.toFixed(0)} m; salt err ${S.massBalance(st, P).saltRelError.toExponential(1)}; ${Date.now() - t0} ms`);
}
