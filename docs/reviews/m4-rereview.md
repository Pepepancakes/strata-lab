# M4.8 re-review of the M4.7 fix (M4.6 findings 1 to 5)

Reviewer: safety-reviewer (independent). Branch `strata-lab/m4-08-rereview`, fast-forwarded onto `strata-lab/m4-07-datum-fix` (b8b4a1d, one commit on top of the M4.6 review tip 2f39b79). Review only: no app code was changed. Scope: the M4.7 diff (11 files, +154/-61) and the five M4.6 findings; the full M4 review was not redone.

Output: `docs/reviews/m4-rereview-output.log` (local paths replaced by `<out>`). Scripts are the M4.6 ones under `scripts/review/` (`m4-review.mjs`, `m4-review-app-csv.mjs`, `m4-review-browser.mjs`); the fixer's edits to `m4-review.mjs` are checked below.

## M4.6 findings

### Finding 1 (was BLOCKING): a wellhead on land had two rig floors. CLOSED
- `src/engine/well.ts`: `wellStations(w, groundFt)` and `totalMeasuredDepthFt(w, groundFt)` shift every station by the ground's height above the sea; `sampleWell` derives `groundFt = max(0, hHead - sl)` and passes it, and exposes `samples.groundFt`. The pressure datum (`datum`, `rkbElev`, `pDepth`) is unchanged, so `tvd_rkb` now equals the EMW depth. Offshore `groundFt = 0` and the code path is the old one.
- Gulf default wellhead (69.5 km, 0 Ma, Node record, ground 118.22 ft): MD 0 is `tvdss -198.22` (ground + 80 ft air gap); MD 0 to 70 are `air`; MD 80 sits on the ground (sediment, zero load, no window, see N3); MD 90 is the first loaded station, 4.445 psi = 0.950449 ppg x 0.051965 x 90 ft. TD 30,000 ft TVDSS is reached at MD 30,198.22 (was 30,080); the J wells' kickoff at 5,000 ft TVDSS is MD 5,198.22 and their TD MD 33,963.07. `tvd_rkb - tvdss = 198.22` on every row of all four Gulf files.
- Panel: `flag-ground` reads "Wellhead on land, ground 117 ft above sea level. MD 0 is the rig floor, the air gap above the ground." in the built app (Chrome record, ground 117.38 ft; the physics-references text says "about 117 ft", fine).
- Offshore unchanged: the four `last3` CSVs produced by the app's code in Node on this branch are byte-identical in every data row to the same files produced on `strata-lab/m4-06-review` (0 differing lines each; only header line 8, the `window_ppg` note, differs). Same preset hashes (below).
- `scripts/review/m4-review.mjs`: the changes are (a) `groundFt` added to the parsed well, the survey's kickoff MD, the TVDSS conversion and the air-gap row check, (b) the salt window set to NaN in the hand model (Finding 2) and the narrowest/salt summaries made NaN-safe, (c) in BROWSER_CSV mode the hydrostatic-datum identity now also requires the rig floor to be exactly the air gap above the pressure datum (a new, stricter check, which is what failed by 98 psi in M4.6). `TOL` is untouched (0.011 ft, 0.11 m, 2e-5 ppg, 0.003 psi, 1.1e-4 porosity). No tolerance was loosened.
- Result: `HAND CALC OK: 42 checks, 0 failed` on the 8 Node CSVs (15,452 stations): geometry worst 0.0069 ft / 0.05 m, material 0 differ, pore psi to 1.4e-3, every ppg quantity to 1.2e-6. In the browser CSVs the record-independent identities pass on all 8 files (10 of 10): FG = K(S-P)+P to 8e-7 ppg, window = FG - pore to 1e-6, psi = ppg x 0.051966 x tvd_rkb to 4.9e-3 psi (M4.6: 98 psi on Gulf), rig floor 80.0 ft above the pressure datum, salt and sea rows 0 wrong.

### Finding 2 (NON-BLOCKING): 9.9 ppg window in salt. CLOSED
- `src/engine/wellPressure.ts:142` `if (salt) continue`: lower, upper, width stay NaN and the state stays `WINDOW_NONE`, so salt is out of the narrowest window and the tight / no-window runs (tested: `tests/wellPressure.test.ts` states `[TIGHT, NONE, OK]`, narrowest is a sediment station on the sampled record). Gulf CSV salt rows: `window_ppg` empty (was 9.93), FG = overburden to 1e-12.
- Wording: panel salt flag "No window is counted here: the fracture gradient is the overburden, and the hole needs a mud weight close to the overburden to stay open (practice, no source yet)"; `INFO.salt` says the same; CSV header line 8 "empty in sea water and in salt (no window there)"; `physics-references.md` M4.2 "In salt" bullet and "Window" bullet; `user-guide.md` legend and limits. Honest and consistent.

### Finding 3 (NON-BLOCKING): one stress ratio for all depths. BACKLOGGED
- `docs/roadmap.md` Backlog: "Fracture gradient: stress ratio rising with depth below the mudline (Traugott 1997 ...; M4.6 Finding 3). Product choice for John."
- Sentence in `INFO.fgMethod` (`src/views/wellplan/index.tsx:37`) and in `physics-references.md` ("Stress ratio" bullet) and `user-guide.md` limits. Present.

### Finding 4 (NON-BLOCKING): sub-salt pore pressure not claimed. CLOSED
- `physics-references.md` M4.1 "Not claimed" line: "Sub-salt pore pressure: not claimed (the salt's weight in sub-salt compaction and salt-sealed pressure are not modelled)". `user-guide.md` limits: same sentence.

### Finding 5 (informational): browser and Node records differ in the last bits. BACKLOGGED
- `docs/roadmap.md` Backlog line present. Still visible in this round: the record-dependent lines of `m4-review.mjs` in BROWSER_CSV mode fail by the Chrome/Node record difference (ground 117.38 vs 118.22 ft, salt top 28,883 vs 28,562 ft TVDSS); the record-independent lines all pass, which is what that mode is for.

## New findings (all NON-BLOCKING)

N1. `docs/handover.md:264` still says "The window's lower limit there [salt] is hydrostatic (a labelled choice)". Stale after M4.7; it is the trap list the next agent reads. Minimum fix: "No window is counted in salt (M4.7); the fracture gradient is the overburden". The same bullet could add the land rig floor: "on land the rig floor is ground + air gap; `samples.groundFt`; MD 0 is the rig floor".

N2. The hand-calculation table still prints a salt window of 3.7315 ppg in two places: `docs/physics-references.md:358` (row 9,000 ft salt, last cell; the table is introduced as "matched to 1e-9 relative by the test") and the header comment of `tests/wellPressure.test.ts:25`. The test itself now asserts NaN there. Minimum fix: replace the cell with "none (no window in salt, M4.7)" in both.

N3. The station that sits exactly on the ground (Gulf MD 80) is reported as `sediment` with porosity 0.49 and 0.000 psi / 0.000000 ppg for pore, hydrostatic, overburden and FG, window empty (`wellPressure.ts:143`, `!(sv > 0)`). It is correct (zero load at zero depth below the datum, 0/0 is no window) and the hand model agrees, but a reader sees a 0 ppg rock row. Minimum fix, if wanted: label it in the CSV header note ("a station on the ground surface carries no load: zeros, no window") or treat it as the ground (not drilled) in the plot. Cosmetic.

N4. Product observation for John, not a defect: on a land wellhead the narrowest window is always the first loaded station below the ground (Gulf: 0.51 ppg Eaton, 0.46 ppg Matthews & Kelly at MD 90, 10 ft below the ground; M&K gives a one-station "Tight window -107 to -107 ft TVDSS"). Window in ppg from RKB grows as z / (z + rig floor height) near the surface, so the flag names the conductor-pipe interval, as it names the mudline offshore (M4.6 check 5). A Gulf engineer would want the narrowest window below the surface casing; a depth floor for the flag is a product choice.

N5. `m4-review.mjs` in BROWSER_CSV mode takes `groundFt` from the Node record, so on the Gulf browser CSVs the "tvd_rkb - tvdss = air gap + ground" row check fails by 0.84 ft of Chrome/Node record difference (4 of the 22 record-dependent fails). The identity itself holds in the browser files: `tvd_rkb - tvdss` is 197.38 ft on all 3,021 rows of `gulf-vertical-eaton.csv` (197.37 to 197.38 across the J wells, 2-decimal printing). Minimum fix in the script: read the ground from the CSV in browser mode. Review-tool note only.

N6. The M4.6 addendum's sources (Eaton 1969 Eq. 1 confirmed; Zhang & Yin 2017 and IOGP 608 on salt FG) are not yet cited: `wellPressureParams.ts`, `wellPressure.ts` and `physics-references.md` still say "neither paper was read (to verify)" and "no source yet". Conservative, not wrong; a docs pass could cite them.

## Check results

1. Finding 1: see above. `scripts/review/m4-review.mjs` 42 of 42 on the Node CSVs, every station of six wells (8 files, 15,452 rows); datum-only changes to the script, no tolerance loosened; browser record-independent identities 10 of 10.
2. Regression tests against the old code: RAN. `strata-lab/m4-06-review` (2f39b79) checked out in a scratch worktree with the M4.7 versions of `tests/wellSample.test.ts`, `tests/wellPressure.test.ts`, `tests/wellExport.test.ts` copied in: 7 failed, 30 passed. The three "wellhead on land: one rig floor" tests fail on the old code exactly where expected (`tvdssFt[0]` -80 instead of -276.85 with a 60 m ground; `depthRkbFt - tvdFt` = 196.85 ft, not 0; J-well kickoff MD 2080 instead of 2277); the four salt tests fail on the old 3.7315 ppg salt window and `[TIGHT, OK, OK]` states. On the fix branch the three files pass (37 of 37).
3. Finding 2: no window in salt in code, test, CSV, panel and docs; wording "practice, no source yet" present in panel, INFO, physics-references and user guide.
4. Finding 4: "Sub-salt pore pressure: not claimed" in `physics-references.md` (M4.1 Not claimed) and `user-guide.md` (limits).
5. Findings 3 and 5 on the roadmap Backlog; constant-stress-ratio sentence in `INFO.fgMethod` and physics-references (and user guide).
6. `stateHash` on this machine, branch = main for all six: last3 cb22255bd39a216a, mtd 9be1b3f383e0bb5e, miocene fa992a56e93157c3, cenozoic ebd3965bbcc65cca, saltshort b9d410d60a5de2e7, gulf f2e2fd2ca42afb35 (`REVIEW_ROOT=<main checkout> node scripts/review/m4-review.mjs hashes`). Expected: the fix touches only `well.ts` sampling and `wellPressure.ts`, which read the record and change no state. `tests/wellScenario.test.ts` (v1 fixture without a well opens and writes back byte for byte) passes on both OSes with no fixture change.
7. Built file (`npm run build`, `m4-review-browser.mjs`): 38 of 38 at 100, 125 and 150 %. Canvas backing 643x360 CSS -> 643x360 / 804x450 / 965x540, no growth across redraws and exports; section canvas and controls keep their positions when the well is planned; plot and well panel inside the 1440 px viewport; PNG 1328x1054, 146,550 bytes at all three; CSV 75,332 bytes, identical text at 100 and 150 %; 0 console errors in the whole session; 0 non-file requests.
8. Gates. Windows: `npm ci`, `npm run check` (typecheck, lint; main 40 files, 432 passed, 1 skipped; wallclock 6 files, 89 passed, 1 skipped), `npm run build` (681.98 kB), `npm run check:offline` (10 URL strings allowlisted, 0 external hosts), `npm run verify:built` (VERIFY OK, 0 console errors) all pass. Linux (WSL Ubuntu, fresh clone of b8b4a1d, `CI=true npm run check`): typecheck and lint clean; main 40 files, 432 passed, 1 skipped; wallclock 6 files, 82 passed, 8 skipped (the 7 extra skips are the wall-clock timings under `it.skipIf(CI)`, as in M4.6). Same counts as Windows on the main project.

## Verdict
Finding 1 is fixed the way the review asked and the fix is proven two ways: the independent hand calculation matches the app at every station on six wells including the land wellhead, and the new tests fail on the old code. Finding 2 is fixed with honest wording; 3 and 5 are on the Backlog with the asked-for sentences in place; 4 is in both documents. Offshore results and all six preset hashes are unchanged. Six non-blocking items, two of them stale sentences (N1, N2) worth a one-line docs commit at merge time.

VERDICT: APPROVE
