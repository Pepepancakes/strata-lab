// Writes s4-case.json: everything S4 (a small Stokes model) needs to rerun the decisive S3b case and the GL24-like
// case, plus the thin-sheet result to compare with. Deterministic: same file on every run on one machine.
//   node s4case.js            writes ./s4-case.json
const fs = require('fs');
const path = require('path');
const S = require('./engine.js');
const { runCase } = require('./s3b.js');
const Q = require('./qc.js');

const r1 = (v) => Math.round(v * 10) / 10;
const arr = (a) => Array.from(a, r1);

function build() {
  // ---- decisive case: the longest-lived interior crest of the plain Gulf run that was exposed and then buried ----
  const run = runCase({});
  const { P, st, eps, rows } = run;
  const pick = rows.filter((x) => x.exposedEver && x.endWhy === 'buried' && x.kind === 'interior').sort((a, b) => b.exposedMyr - a.exposedMyr)[0];
  const ep = eps.find((e) => e.id === pick.id);
  const P0 = S.createState(P);   // start state for the arrays
  const j = ep.s[ep.s.length - 1].j;
  const lo = Math.max(0, j - 60), hi = Math.min(P.nx, j + 61);
  // sediment bulk density of the cover over the crest at burial, from the engine's own load (W / (g Sb))
  const sc = st.scratch; S.recomputeH(st, P);
  const every = Math.round(0.5e6 / P.dtRec);
  const series = ep.s.filter((q, i) => i % every === 0 || i === ep.s.length - 1).map((q) => ({ tMyr: r1(q.t * 10) / 10, crestCol: q.j, coverM: r1(q.cover), saltTopM: r1(q.zt), seafloorAtCrestM: r1(q.Hc), flankSeafloorM: r1(q.Hf), saltThicknessM: r1(q.hs), flankDipDeg: Math.round(q.dip * 100) / 100, exposed: q.exposed }));
  const decisive = {
    what: 'Interior crest of the plain Gulf run (M3.10 start, exposed on, no roof thinning) that was exposed and then buried, with thick neighbouring salt. Thin-sheet result to compare against.',
    crestId: pick.id, crestColumnAtOnset: ep.j0, crestColumnAtEnd: j, crestKmAtEnd: j + 0.5,
    section: { nx: P.nx, dxM: P.dx, lengthKm: P.nx * P.dx / 1000, note: 'x = (column + 0.5) dx from the landward end; closed ends. S4 may cut a window; window columns below are inclusive.', windowColumns: [lo, hi - 1] },
    durationMyr: P.duration / 1e6, recordStepYr: P.dtRec,
    startingSalt: { thicknessM_perColumn: arr(P0.hs), basementElevationM_perColumn: arr(P0.b), initialCoverBulkM_perColumn: arr(P0.cover),
      law: 'saltThick 4000 m, pinch-out smoothstep 10 to 100 km, basinward limit smoothstep 200 to 240 km (M3.10), same arithmetic as initialSaltThickness in src/engine/salt.ts' },
    densitiesKgM3: { salt: S.consts.RHO_SALT, solidGrains: S.consts.RHO_S, water: S.consts.RHO_W, coverNote: 'cover bulk density is compaction dependent: phi = phi0 exp(-beta sigma); phi0 sand/mud ' + P.phi0.join('/') + ', beta ' + P.beta.join('/') + ' 1/Pa' },
    viscosities: { saltPaS: P.saltVisc, saltRheology: 'Newtonian (n = 1)', coverPaS: P.coverVisc, coverNote: 'cover is a thin viscous plate (bending only), not a Stokes layer; S4 must choose a cover viscosity and state it' },
    sedimentSupply: { supplyM2PerYr: P.supply, sandFraction: P.sandFrac, tcMax: P.tcMax, subsidenceMPerMyr: [P.subsShelf, P.subsBasin],
      note: 'transport is diffusive plus turbidity routing, so the arrival of sediment at the crest is an output. Use aggradationHistory below as the prescribed boundary condition.' },
    aggradationHistory: { note: 'seafloor elevation (m) of the columns 3 to 5 km either side of the crest, mean, and of the crest column, every 0.5 Myr, from tNearMyr to the end of the near-surface phase. Rate A is the slope of flankSeafloorM.', series },
    thinSheetResult: {
      tNearMyr: pick.tNear, tExposedMyr: pick.tExp, tBuriedMyr: pick.tEnd, exposedMyr: pick.exposedMyr,
      risePerMyr: { F_pre: r1(pick.F_pre), A_pre: r1(pick.A_pre), F_minus_A_pre: r1(pick.FmA_pre), F_wholeEpisode: r1(pick.F_ep), A_wholeEpisode: r1(pick.A_ep) }, dissolutionD: 0,
      neighbourSaltAtBurialM: { pm1km: r1(pick.nb1), pm5km: r1(pick.nb5), pm10km: r1(pick.nb10) }, flowLengthOverThickness: r1(pick.LoverH),
      question: 'Does a Stokes model with the same start, salt, cover and flank aggradation also bury this crest, and when? If it keeps the crest at the surface while the thin-sheet run buries it, burial is a thin-sheet limit.',
    },
  };

  // ---- GL24-like ----
  const g = Q.gl24Case({ bump: -200 });
  const c = g.c, sm = Q.gl24Summary(g, 200);
  const gl = {
    what: 'GL24-like down-building with a thick source (QC 15): 2 km salt, seafloor kept level and raised at 0.2 mm/yr, cover 2600 and salt 2260 kg/m3. Thin-sheet result to compare against.',
    section: { nx: c.o.nx, dxM: c.o.dx, lengthKm: c.o.nx * c.o.dx / 1000, closedEnds: true },
    durationMyr: c.o.tMyr, recordStepYr: c.o.dtRec,
    startingSalt: { thicknessM_perColumn: arr(Float64Array.from({ length: c.o.nx }, (_, k) => c.o.h0 + c.o.bump * Math.cos(Math.PI * c.o.mode * (k + 0.5) / c.o.nx))), shape: 'h0 + bump cos(pi mode x / L) with h0 2000 m, bump -200 m (crest at mid-section), mode 2', flatBasementElevationM: -3000 - c.o.h0 },
    densitiesKgM3: { cover: c.o.rhoCover, salt: c.o.rhoSalt },
    viscosities: { saltPaS: c.o.saltVisc, coverPaS: c.o.coverVisc, coverNote: 'plate bending in the thin-sheet run' },
    sedimentSupply: { seafloorRiseMPerMyr: 200, rule: 'after every record step each column below the level is filled up to the level; the level starts at the initial seafloor (-2600 m) and rises 200 m/Myr; columns above it get no sediment', initialCoverM: c.o.cover0 },
    thinSheetResult: {
      summary: sm,
      crestDepthAgainstTime: g.series.filter((q, i) => i % 5 === 0).map((q) => ({ tMyr: r1(q.t * 10) / 10, crestDepthM: r1(q.depth), saltTopM: r1(q.top), seafloorM: r1(q.seafloor), levelM: r1(q.level), crestSaltThicknessM: r1(q.hsCrest), thinnestSaltM: r1(q.hsMin) })),
      comparisonTarget: 'GL24 pp. 627 and 631, Fig. 10a: crests keep pace with the surface, roughly 1 to 3 km below it (reading approximate), for 20 to 50 Myr.',
    },
  };
  void sc;
  return { about: 'Contract for S4 (spike 003 / S3b). Engine SI units: m, kg/m3, Pa s, years. Written by spikes/003-passive-diapir/s4case.js; do not edit by hand.', decisiveCase: decisive, gl24LikeCase: gl };
}

module.exports = { build };

if (require.main === module) {
  const out = path.join(__dirname, 's4-case.json');
  const j = build();
  fs.writeFileSync(out, JSON.stringify(j, null, 1) + '\n');
  console.log('wrote', out, fs.statSync(out).size, 'bytes');
}
