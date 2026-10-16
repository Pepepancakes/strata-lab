# M3.7 integrity review (salt)

Verdict: APPROVE, with the notes below. Reviewer script: scripts/review/m3-review.mjs (parts a-f).
Expected values come from textbook formulas written in the script, not from src/engine/salt.ts.

Checked and passing
- Channel flow: Poiseuille integral re-derived; thickness-bump decay matches -G h^3/(12 eta) k^2 within 0.22 % for three
  (h, eta, wavelength) sets, deep water and dry (part a, 1a/1b).
- Cover bending: measured fastest-growing wavelength matches my own dispersion relation within 0.4 % (9.54/9.57, 9.57/9.57,
  12.33/12.30 km); growth rates within 2.4 % near the peak. Water-loaded roof without cover decays (sign correct).
- Grid: with bending on, power-weighted width varies 1.6 % across dx 1000/500/250 m; with bending off it follows the grid (control).
- Conservation: Gulf preset, MTD+salt and Gulf+failure all conserve salt to 1e-12 (own sums at every 20th/10th step); saltClip 0;
  sand and mud balance against the ledger to 1e-9. Weld-limiter sandbox (bending on and off): limiter acts, salt conserved, never negative.
- Determinism: two straight runs identical; 16 scrambled seeks identical (hash, weld age, salt thickness, counters); no-op branch
  reproduces the main run exactly; snapshot before first weld restored into a fresh engine finishes with the identical hash.
- Salt off = main: stateHash identical to main for last3, mtd, miocene, cenozoic; no measurable slowdown.
- Built file: npm run build, check:offline (0 external hosts) and verify:built OK.
- Repo check on Windows: typecheck and lint clean, 398 pass.

Notes (none blocking)
1. tests/run.test.ts:37 "runs in under 3 s" failed once (3208 ms) while I ran other heavy jobs at the same time; passes alone.
   It is a wall-clock test, so expect it to flake on a loaded machine.
2. Stiff-salt drift: conservation is 1e-12, not 1e-14, when saltVisc is 1e17 with a weld (branch test: -1.2e-12). Harmless,
   but do not tighten any test below 1e-11 for that case.
3. Grid dependence at preset level: Gulf minibasin counts are 3/1/2 (200 km at dx 2000/1000/500) and 8/11/2 for 400 km, so counts
   are not grid-converged. Only widths under bending are. Docs and tests must not state a minibasin count as physics.
4. The default Gulf run has 0 welds. Weld behaviour is tested only through the gulf saltVisc 1e17, supply 60 case and sandboxes.
5. The "(i)" explanations exist for salt, older cover, weld and broken pressure line (WhatItMeans.tsx); I did not drive the browser
   for them in this pass.
