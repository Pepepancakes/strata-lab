// node tune_salt.js '{"saltVisc":1e17}' ...  - salt parameter sweep (each arg = JSON overrides)
const S = require('./engine.js');
for (const arg of process.argv.slice(2)) {
  const P = Object.assign(S.defaultParams(), JSON.parse(arg));
  const st = S.createState(P);
  const t0 = Date.now();
  const hist = [];
  while (S.step(st, P)) if (st.k % 120 === 0) hist.push(st.hs.slice());
  const ms = Date.now() - t0, nx = P.nx, hs = st.hs;
  // cover thickness above salt
  const cover = new Float64Array(nx);
  for (let j = 0; j < nx; j++) cover[j] = st.H[j] - st.b[j] - hs[j];
  let welds = 0, nearSurf = 0, highs = 0;
  for (let j = 0; j < nx; j++) {
    if (hs[j] < 10 && j * P.dx > P.saltPinch[1]) welds++;
    if (hs[j] > 300 && cover[j] < 250) nearSurf++;
  }
  // salt highs with >300 m prominence on both sides (within 15 km)
  for (let j = 1; j < nx - 1; j++) {
    if (hs[j] < hs[j - 1] || hs[j] < hs[j + 1]) continue;
    let lmin = hs[j], rmin = hs[j];
    for (let d = 1; d <= 15; d++) { if (j - d >= 0) lmin = Math.min(lmin, hs[j - d]); if (j + d < nx) rmin = Math.min(rmin, hs[j + d]); }
    if (hs[j] - lmin > 300 && hs[j] - rmin > 300) highs++;
  }
  const prof = (a) => Array.from({ length: 15 }, (_, i) => Math.round(a[i * 10 + 5])).join(' ');
  const mb = S.massBalance(st, P);
  console.log(arg, `| ${ms} ms | welds ${welds} | salt highs ${highs} | salt within 250 m of seafloor ${nearSurf} | max ${Math.max(...hs).toFixed(0)} | saltErr ${mb.saltRelError.toExponential(1)} clip ${mb.saltClip.toExponential(1)} | sedErr ${mb.relError.toExponential(1)}`);
  hist.forEach((h, i) => console.log(`   ${(i + 1) * 0.6} Myr salt: ${prof(h)}`));
  console.log('   cover:', prof(cover));
  console.log('   seafl:', prof(st.H));
}
