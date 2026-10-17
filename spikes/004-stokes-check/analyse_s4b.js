'use strict';
// S4b: Stokes against thin sheet for the followed crest. Prints markdown tables.
//   S4_SCRATCH=<folder with out-gulf-A-s4b.json> node analyse_s4b.js [outfile name, default gulf-A-s4b]
const fs = require('fs');
const path = require('path');
const os = require('os');
const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const name = process.argv[2] || 'gulf-A-s4b';
const out = JSON.parse(fs.readFileSync(path.join(SCR, 'out-' + name + '.json'), 'utf8'));
const B = JSON.parse(fs.readFileSync(process.env.S4B_CASE || path.join(__dirname, 's4b-case.json'), 'utf8'));
const FT = 3.28084, ROOF = B.roofMinM;
const st = out.series.filter((r) => r.coverM !== undefined);   // Stokes records (0.5 Myr)
const th = B.thinSeries;                                       // thin sheet, 0.1 Myr, crest followed by crestlog
const tc = (r) => r.tMyr;
const thin = th.map((q) => ({ tMyr: q.tMyr, coverM: q.coverM, saltTopM: q.saltTopM, flankM: q.flankSeafloorM, reliefM: +(q.saltTopM - q.flankSeafloorM).toFixed(1) }));
const stk = st.map((r) => ({ tMyr: r.tMyr, coverM: r.coverM, saltTopM: r.saltTopM, flankM: r.flankSeafloorM, reliefM: r.reliefM, zoneMin: r.zoneMinCoverM, km: r.crestKm }));
const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '-'), f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const slope = (pts) => { const n = pts.length; if (n < 2) return NaN; const mt = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let a = 0, b = 0; for (const [t, y] of pts) { a += (t - mt) * (y - my); b += (t - mt) ** 2; } return a / b; };
const win = (rows, t0, t1, key) => rows.filter((r) => r.tMyr >= t0 - 1e-6 && r.tMyr <= t1 + 1e-6).map((r) => [r.tMyr, r[key]]);
const at = (rows, t) => rows.reduce((b, r) => (Math.abs(r.tMyr - t) < Math.abs(b.tMyr - t) ? r : b), rows[0]);

console.log('## cover over the crest (m, ft) against time');
console.log('| t Myr | thin cover m | thin ft | Stokes cover m | Stokes ft | Stokes crest km | Stokes zone min m |');
console.log('|---|---|---|---|---|---|---|');
for (const t of [24.9, 25.5, 26, 27, 27.5, 28, 30, 32, 34, 36, 38, 40, 45, 50, 55, 58, 60, 60.9, 62, 64, 66]) {
  const a = th.find((q) => Math.abs(q.tMyr - t) < 0.05), b = at(stk, t);
  if (Math.abs(b.tMyr - t) > 0.26) continue;
  console.log(`| ${t} | ${a ? f0(a.coverM) : '-'} | ${a ? f0(a.coverM * FT) : '-'} | ${f0(b.coverM)} | ${f0(b.coverM * FT)} | ${b.km} | ${f0(b.zoneMin)} |`);
}
const range = (rows, t0, t1) => { const v = rows.filter((r) => r.tMyr >= t0 && r.tMyr <= t1).map((r) => r.coverM); return [Math.min(...v), Math.max(...v)]; };
const T0 = B.crest.tNearMyr, TE = B.crest.tEndMyr, TX = B.crest.tExposedMyr;
console.log('\n## time at the seafloor and cover range');
console.log(`thin sheet: records with cover < ${ROOF} m: ${th.filter((q) => q.coverM < ROOF).length} x 0.1 Myr = ${(th.filter((q) => q.coverM < ROOF).length * 0.1).toFixed(1)} Myr; cover < 50 m: ${(th.filter((q) => q.coverM < 50).length * 0.1).toFixed(1)} Myr; cover range ${T0}-${TE} Myr: ${range(thin, T0, TE).map(f0).join(' to ')} m`);
console.log(`Stokes:     records with cover < ${ROOF} m: ${stk.filter((q) => q.coverM < ROOF).length} x 0.5 Myr; cover < 50 m: ${stk.filter((q) => q.coverM < 50).length} x 0.5 Myr; cover < 100 m: ${stk.filter((q) => q.coverM < 100).length}; cover range ${T0}-${TE} Myr: ${range(stk, T0, TE).map(f0).join(' to ')} m (min at t ${stk.reduce((b, r) => (r.coverM < b.coverM ? r : b)).tMyr}); zone min over run ${Math.min(...stk.map((r) => r.zoneMin)).toFixed(0)} m; shallowest salt anywhere in the 90 km box after the start record ${Math.min(...st.filter((r) => r.tMyr > T0 + 0.01).map((r) => r.minCoverM)).toFixed(0)} m at ${st.filter((r) => r.tMyr > T0 + 0.01).reduce((b, r) => (r.minCoverM < b.minCoverM ? r : b)).minCoverKm} km (${st.filter((r) => r.tMyr > T0 + 0.01).reduce((b, r) => (r.minCoverM < b.minCoverM ? r : b)).tMyr} Myr); start section itself has ${st[0].minCoverM} m at ${st[0].minCoverKm} km`);
console.log('\n## salt-top rise F, flank seafloor rise A, F - A (m/Myr, least squares), relief = salt top minus flank seafloor (m)');
console.log('| window Myr | thin F | thin A | thin F-A | thin F-A ft/Myr | Stokes F | Stokes A | Stokes F-A | Stokes F-A ft/Myr | n Stokes pts |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const wins = [[T0, TE, 'whole near phase'], [T0, T0 + 10, 'first 10 Myr'], [TX, TX + B.crestlogRow.exposedMyr, 'thin exposure window'], [TE - 5, TE, 'last 5 Myr before thin burial'], [TE - 1, TE, 'last 1 Myr (SALT-R2 F_pre)'], [TE, 66, 'after thin burial']];
for (const [a, b, lab] of wins) {
  const tF = slope(win(thin, a, b, 'saltTopM')), tA = slope(win(thin, a, b, 'flankM')), sF = slope(win(stk, a, b, 'saltTopM')), sA = slope(win(stk, a, b, 'flankM'));
  console.log(`| ${a.toFixed(1)}-${b.toFixed(1)} ${lab} | ${f1(tF)} | ${f1(tA)} | ${f1(tF - tA)} | ${f1((tF - tA) * FT)} | ${f1(sF)} | ${f1(sA)} | ${f1(sF - sA)} | ${f1((sF - sA) * FT)} | ${win(stk, a, b, 'saltTopM').length} |`);
}
console.log('\n## relief (m, ft)');
console.log('| t Myr | thin m | thin ft | Stokes m | Stokes ft |');
console.log('|---|---|---|---|---|');
for (const t of [24.9, 27.5, 30, 33.7, 40, 50, 55, 60, 60.9, 66]) {
  const a = th.find((q) => Math.abs(q.tMyr - t) < 0.05) ? thin.find((q) => Math.abs(q.tMyr - t) < 0.05) : null, b = at(stk, t);
  if (Math.abs(b.tMyr - t) > 0.26) continue;
  console.log(`| ${t} | ${a ? f0(a.reliefM) : '-'} | ${a ? f0(a.reliefM * FT) : '-'} | ${f0(b.reliefM)} | ${f0(b.reliefM * FT)} |`);
}
const rl = (rows, t0, t1) => { const v = rows.filter((r) => r.tMyr >= t0 && r.tMyr <= t1).map((r) => r.reliefM); return [Math.min(...v), Math.max(...v)]; };
console.log(`relief range ${T0}-${TE}: thin ${rl(thin, T0, TE).map(f0).join(' to ')} m; Stokes ${rl(stk, T0, TE).map(f0).join(' to ')} m`);
console.log(`\nmass: Stokes salt area ${(out.saltArea0 / 1e6).toFixed(4)} -> ${(out.saltArea1 / 1e6).toFixed(4)} km2 (${((out.saltArea1 / out.saltArea0 - 1) * 100).toFixed(3)} %); steps ${out.steps}; run ${out.minutes.toFixed(1)} min; grid ${out.cfg.nx}x${out.cfg.ny} dx ${out.cfg.dxM} dy ${out.cfg.dyM}; cover eta ${out.cfg.coverEta}; salt eta ${out.cfg.saltEta}; analysis ${JSON.stringify(out.analysis)}`);
