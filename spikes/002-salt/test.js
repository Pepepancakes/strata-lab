// node test.js  - spike 002 checks (spike 001 checks + salt)
const S = require('./engine.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };

// 1. Gibson (1958) benchmark of the pore-pressure solver
for (const T of [0.1, 1, 10]) {
  const num = S.gibsonNumeric(T, 400);
  let maxErr = 0, at = 0;
  for (let i = 0; i < num.X.length; i++) {
    const e = Math.abs(num.U[i] - S.gibsonAnalytic(num.X[i], T));
    if (e > maxErr) { maxErr = e; at = num.X[i]; }
  }
  const base = S.gibsonAnalytic(0, T);
  ok(maxErr < 0.02, `Gibson T=${T}: base U analytic ${base.toFixed(3)} numeric ${num.U[0].toFixed(3)}, max |err| ${maxErr.toFixed(4)} at z/h=${at.toFixed(2)}`);
}

// 2. drained compaction stays hydrostatic; compare with Sclater & Christie
for (const [lith, name] of [[0, 'sand'], [1, 'mud']]) {
  const r = S.drainedColumn(lith, 3000);
  const pick = (z) => r.profile.reduce((a, b) => Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a);
  const rows = [1000, 2000, 3000].map((z) => { const p = pick(z); return `${z}m: ${p.phi.toFixed(3)} vs S&C ${p.sc.toFixed(3)}`; });
  ok(r.maxLam < 0.01, `drained ${name}: max overpressure ratio ${r.maxLam.toExponential(2)}; porosity ${rows.join(', ')}`);
}

// 2b. salt: lubrication relaxation vs linear theory (several wavelengths and viscosities)
for (const [mode, eta, nRec] of [[1, 1e17, 200], [4, 1e17, 20], [2, 1e18, 400], [8, 1e18, 40]]) {
  const r = S.saltRelaxation(mode, eta, nRec);
  ok(Math.abs(r.relErr) < 0.02 && Math.abs(r.volErr) < 1e-12, `salt relaxation, wavelength ${200 / mode} km, eta ${eta.toExponential(0)}: decay rate numeric/analytic - 1 = ${(r.relErr * 100).toFixed(2)} % (e-fold ${(r.efoldYr / 1e3).toFixed(0)} kyr, ran ${r.tEnd / 1e3} kyr); volume error ${r.volErr.toExponential(1)}`);
}
// 2c. salt: potential and Poiseuille flux under an imposed sediment load step vs hand calculation
{
  const r = S.saltLoadStep();
  ok(Math.abs(r.phiErr) < 1e-9 && Math.abs(r.qErr) < 0.01, `salt load step: dPhi ${(r.dPhi / 1e6).toFixed(4)} MPa vs hand ${(r.dPhiHand / 1e6).toFixed(4)} (err ${r.phiErr.toExponential(1)}); flux ${(r.qNum * S.consts.YR).toFixed(3)} vs hand ${(r.qHand * S.consts.YR).toFixed(3)} m2/yr (err ${(r.qErr * 100).toFixed(2)} %)`);
}

// 3. full run: mass balance, timing
const P = S.defaultParams();
const st = S.createState(P);
let t0 = Date.now();
const snaps = new Map();
const SNAP = 30;
snaps.set(0, S.snapshot(st));
while (S.step(st, P)) if (st.k % SNAP === 0 || st.k === st.nSteps) snaps.set(st.k, S.snapshot(st));
const runMs = Date.now() - t0;
const mb = S.massBalance(st, P);
ok(Math.abs(mb.relError) < 1e-9 && Math.abs(mb.sandRelError) < 1e-9 && mb.deficit === 0, `mass balance: supplied ${(mb.supplied / 1e6).toFixed(3)} km2, stored ${(mb.stored / 1e6).toFixed(3)}, exported ${(mb.exported / 1e6).toFixed(3)}; total rel error ${mb.relError.toExponential(2)}, sand-only rel error ${mb.sandRelError.toExponential(2)}, unfilled erosion ${mb.deficit}`);
ok(Math.abs(mb.saltRelError) < 1e-12 && mb.saltClip === 0, `salt volume: start ${(mb.saltInit / 1e6).toFixed(3)} km2, end ${(mb.saltVol / 1e6).toFixed(3)} km2, rel error ${mb.saltRelError.toExponential(2)}, clipped ${mb.saltClip.toExponential(2)}`);
ok(runMs < 5000, `full 3 Myr run (${st.nSteps} steps x ${P.nSub} substeps, ${P.nx} columns) took ${runMs} ms; pressure clamps ${st.clamps}`);

// 4. determinism: restore mid snapshot + replay == direct run
const st2 = S.createState(P);
S.restore(snaps.get(300), st2, P);
t0 = Date.now();
while (S.step(st2, P)) {}
const replayMs = Date.now() - t0;
let same = true;
for (const key of ['sand', 'mud', 'smax', 'u', 'b', 'H', 'hs']) {
  const a = st[key], b = st2[key];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; console.log('  diff', key, i, a[i], b[i]); break; }
}
ok(same, `restore at 1.5 Ma + replay is bit-identical to the direct run (replay of 300 steps ${replayMs} ms)`);

// 5. branch with identical params == parent
const st3 = S.createState(P);
S.restore(snaps.get(240), st3, P);
const P2 = S.clone(P);
while (S.step(st3, P2)) {}
ok(st3.u.every((v, i) => v === st.u[i]), 'branch with unchanged parameters reproduces parent exactly');

// quick geology summary
const nx = P.nx;
let maxLam = 0, where = '';
for (let l = 1; l <= st.k; l++) for (let j = 0; j < nx; j++) {
  const i = l * nx + j; if (st.ld[i] > 0) { const lam = st.u[i] / st.ld[i]; if (lam > maxLam && st.sand[i] + st.mud[i] > 1e-3) { maxLam = lam; where = `x=${j}km layer ${l}`; } }
}
const salt = []; for (let j = 0; j < nx; j += 10) salt.push(`${j}:${st.hs[j].toFixed(0)}`);
console.log('salt thickness (km:m):', salt.join(' '));
let welds = 0; for (let j = 0; j < nx; j++) if (st.hs[j] < 10 && j * P.dx > P.saltPinch[1]) welds++;
console.log('weld columns (salt < 10 m, basinward of pinch-out):', welds, '| max salt', Math.max(...st.hs).toFixed(0), 'm');
const thick = []; for (let j = 0; j < nx; j += 15) thick.push(`${j}km:${(st.H[j]).toFixed(0)}m`);
console.log('surface elevation at end:', thick.join(' '));
console.log('max overpressure ratio', maxLam.toFixed(3), where, '| shoreline col', st.shore, 'shelf edge col', st.shelfEdge, 'tc share', st.tcShare.toFixed(2));
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
