// try deep-marine diffusivity values; report max slope gradient, clinoform position, tc export, overpressure
const S = require('./engine.js');
const cases = JSON.parse(process.argv[2] || '[[[5,60]],[[50,500]],[[100,1000]],[[200,2000]]]');
for (const [Kg, extra] of cases) {
  const P = S.defaultParams(); P.Kg = Kg; Object.assign(P, extra || {});
  const st = S.createState(P); const t0 = Date.now();
  let lowSand = 0;
  while (S.step(st, P)) {}
  let maxG = 0, at = 0;
  for (let j = 0; j < P.nx - 1; j++) { const g = (st.H[j] - st.H[j + 1]) / P.dx; if (g > maxG) { maxG = g; at = j; } }
  let maxLam = 0;
  for (let i = P.nx; i < (st.k + 1) * P.nx; i++) if (st.ld[i] > 0 && st.sand[i] + st.mud[i] > 1e-3) maxLam = Math.max(maxLam, st.u[i] / st.ld[i]);
  // sand on basin floor (x > 80 km)
  let bfS = 0, bfT = 0;
  for (let l = 1; l <= st.k; l++) for (let j = 80; j < P.nx; j++) { bfS += st.sand[l * P.nx + j]; bfT += st.sand[l * P.nx + j] + st.mud[l * P.nx + j]; }
  const mb = S.massBalance(st, P);
  console.log(JSON.stringify(Kg), JSON.stringify(extra || {}), `max slope ${(Math.atan(maxG) * 180 / Math.PI).toFixed(1)} deg at ${at} km; shelf edge ${st.shelfEdge}; exported ${(mb.exported / mb.supplied * 100).toFixed(0)}%; basin-floor sand ${(100 * bfS / bfT).toFixed(0)}%; max OP ratio ${maxLam.toFixed(2)}; ${Date.now() - t0} ms`);
}
