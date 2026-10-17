'use strict';
// Spike 004 checks: node test.js   (about 3 minutes; prints the benchmark table, exit 0 when everything passes)
// The four benchmarks of the card, each against an exact solution or a published value. They must pass before cases.js is believed.
const B = require('./bench.js');
const S = require('./stokes.js');

let fails = 0, checks = 0;
const rows = [];
function check(name, ok, detail) { checks++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); }
const pct = (a, b) => (100 * Math.abs(a - b) / Math.abs(b));

// ---- 1. Poiseuille channel: flux within 1 %
{
  const r = B.poiseuille({ nx: 20, ny: 20, L: 16 });
  const worst = Math.max(...r.relErr);
  rows.push(['1 Poiseuille flux, 20 x 20 cells, L/H = 16', 'Q = dp H^3 / (12 eta L) = ' + r.qExact.toFixed(6), 'Q = ' + r.qs[1].toFixed(6), (100 * worst).toFixed(2) + ' %', '1 %']);
  check('1 Poiseuille flux within 1 % at three sections', worst < 0.01, `worst ${(100 * worst).toFixed(3)} %`);
  check('1 Poiseuille mid-channel profile within 1 % of the peak speed', r.maxProfileErr < 0.01, `worst ${(100 * r.maxProfileErr).toFixed(3)} %`);
  const v = B.poiseuille({ nx: 20, ny: 20, L: 16, eta: 1e18, dp: 1e6 });
  check('1 Poiseuille flux scales with 1/eta (eta 1e18, dp 1e6)', Math.max(...v.relErr) < 0.01, `worst ${(100 * Math.max(...v.relErr)).toFixed(3)} %`);
}

// ---- 2. Rayleigh-Taylor (van Keken et al. 1997, case 1a)
{
  const ex = B.rtGrowthRateExact('noslip');
  for (const [nx, ny] of [[64, 70], [96, 104]]) {
    const v = [1, 2, 3, 4].map((seed) => B.rtGrowthRate({ nx, ny, amp: 0.004, nPerCell: [16, 16], seed }));
    const worst = Math.max(...v.map((q) => pct(q, ex)));
    rows.push([`2a RT initial growth rate, ${nx} x ${ny}, 4 marker seeds`, 'linear theory ' + ex.toFixed(5) + ' / time', 'worst ' + Math.max(...v).toFixed(5), worst.toFixed(1) + ' %', '5 %']);
    check(`2a RT initial growth rate within 5 % of the exact linear solution (${nx} x ${ny}, 4 seeds)`, worst < 5, `worst ${worst.toFixed(2)} %`);
  }
  const r = B.rtRun({ nx: 48, ny: 52 });
  const tRef = 208.99, vRef = 0.0031;
  rows.push(['2b RT case 1a time of first vrms peak, 48 x 52', tRef + ' (vK97 via Underworld notebook table)', r.tPeak.toFixed(2), pct(r.tPeak, tRef).toFixed(1) + ' %', '5 %']);
  rows.push(['2b RT case 1a vrms at first peak, 48 x 52', vRef + ' (same)', r.vPeak.toFixed(5), pct(r.vPeak, vRef).toFixed(1) + ' %', '5 %']);
  check('2b RT first peak time within 5 % of 208.99', pct(r.tPeak, tRef) < 5, `${r.tPeak.toFixed(2)} (${pct(r.tPeak, tRef).toFixed(2)} %)`);
  check('2b RT first peak vrms within 5 % of 0.0031', pct(r.vPeak, vRef) < 5, `${r.vPeak.toFixed(5)} (${pct(r.vPeak, vRef).toFixed(2)} %)`);
  // ---- 3. area per material, from the same run
  const a0 = r.areas0, a1 = r.areas1, tot = a0[0] + a0[1];
  const dA = Math.max(Math.abs(a1[0] - a0[0]), Math.abs(a1[1] - a0[1])) / tot;
  rows.push(['3 Area per material over the RT run (' + r.nmark + ' markers)', 'initial heavy / light = ' + a0[0].toFixed(5) + ' / ' + a0[1].toFixed(5), 'final ' + a1[0].toFixed(5) + ' / ' + a1[1].toFixed(5), (100 * dA).toFixed(3) + ' % of box', '0.1 % of box']);
  check('3 area per material conserved to 0.1 % of the box through the RT overturn', dA < 1e-3, `${(100 * dA).toFixed(4)} % of the box (marker resolution: 1 marker = ${(100 / r.nmark).toFixed(4)} % of the box)`);
}

// ---- 3b. sedimentation by marker conversion adds exactly the area below the surface and removes the same from the water
{
  const m = S.createModel({ nx: 20, ny: 20, W: 1, H: 1, g: 0, mats: [{ rho: 1, eta: 1 }, { rho: 2, eta: 1 }], init: (x, y) => (y > 0.7 ? 1 : 0), nPerCell: [8, 8], seed: 7 });
  const a0 = S.areasByMaterial(m);
  S.aggrade(m, (x) => 0.5 + 0.1 * Math.sin(6 * x), 0, 1);
  const a1 = S.areasByMaterial(m);
  let exact = 0; const nI = 20000; for (let q = 0; q < nI; q++) { const x = (q + 0.5) / nI; exact += (0.7 - (0.5 + 0.1 * Math.sin(6 * x))) / nI; }
  check('3 sedimentation: area gained by the sediment equals the area between the old and new surface (1 %)', Math.abs((a1[1] - a0[1]) - exact) < 0.01 * exact && Math.abs((a1[0] - a0[0]) + (a1[1] - a0[1])) < 1e-12, `gained ${(a1[1] - a0[1]).toFixed(5)}, exact ${exact.toFixed(5)}; total change ${(a1[0] + a1[1] - a0[0] - a0[1]).toExponential(1)}`);
}

// ---- 4. free surface relaxation
{
  const r = B.relaxation({ nx: 48, ny: 72, depth: 3e5, air: 6e4, theta: 0.5, nSteps: 30, tEnd: 2 });
  rows.push(['4 Free surface relaxation, 48 x 72, sticky layer eta/1000, FSSA theta 0.5', 'tau = 4 pi eta / (rho g lambda) = ' + (r.tau / 3.156e7 / 1e3).toFixed(2) + ' kyr', 'fitted ' + (r.tauFit / 3.156e7 / 1e3).toFixed(2) + ' kyr', pct(r.tauFit, r.tau).toFixed(1) + ' %', '10 %']);
  rows.push(['4 same, amplitude at every step against h0 exp(-t/tau)', '', 'worst', (100 * r.maxRelErr).toFixed(1) + ' %', '10 %']);
  check('4 relaxation time within 10 % of 4 pi eta / (rho g lambda)', pct(r.tauFit, r.tau) < 10, `fitted/exact ${(r.tauFit / r.tau).toFixed(4)}`);
  check('4 amplitude within 10 % of the exponential at every step to t = 2 tau', r.maxRelErr < 0.10, `worst ${(100 * r.maxRelErr).toFixed(2)} %`);
}

// ---- determinism: same run twice is bit identical
{
  const run = () => { const m = B.rtModel({ nx: 16, ny: 18 }); for (let i = 0; i < 5; i++) S.step(m, 2, 0.5); return Array.from(m.x.subarray(0, 50)).concat([m.t, m.nmark]).join(','); };
  check('same inputs give bit-identical markers (5 steps)', run() === run());
}

console.log('\nBenchmark table');
for (const r of rows) console.log(r.join(' | '));
console.log(`\n${checks - fails}/${checks} checks passed`);
console.log(fails ? 'SOME FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
