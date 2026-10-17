# Handover notes (keep current)

This file exists from day one so the project can move to another machine or agent at any time.
Update it whenever something here changes, in the same commit as the change.

## Where things stand
- 2026-10-16: M4 (planned well: path, pressures, fracture gradient, window, branch compare, PNG and CSV export) is built on the chain
  `strata-lab/m4-01-well-path` -> ... -> `m4-05-docs`. NOT on main; waits for John's judgement (roadmap M4; D21). See "M4 planned well" below.
- 2026-10-16: M3 (salt) is built and fixed on the chain `strata-lab/m3-01-salt-flow` -> ... -> `m3-06-docs` ->
  `m3-08-fix-gulf-preset` -> `m3-09-rereview` -> `m3-10-fix-salt-edge` -> `m3-11-docs-d18`. MERGED to main 2026-10-16 with John's
  approval (roadmap M3; decisions D17, D18, D19). Spike S3 (passive diapirs, branch
  `strata-lab/s3-passive-diapir`) is built and waits for his answers; milestone M3b follows M3 (roadmap).
  See "M3 salt" and "M3 state after M3.10" below.
- 2026-10-15: M1 is on main (merge 56b964a). Linux CI was red because floating-point results differ
  from Windows (`docs/decisions.md` D14); the tolerance fix (D16.4) is merged.
- 2026-10-15: M2 (slope failure and MTDs) is done and on main: review round 3 APPROVE, John's
  preview checks all pass (`docs/decisions.md` D16). See "M2 slope failure and MTDs" below. Next:
  make Linux CI compare results with tolerances (D16.4), then M3 salt.
- 2026-10-14: spike 001 (2D deepwater shelf-to-basin) built and accepted. John said go for a core
  project. Repo created, docs written. Spike 002 (salt) built the same day; see
  `spikes/002-salt/README.md`.

## How to run what exists
- Open `spikes/001-shelf-to-basin/dist/strata-spike-001.html` in a browser. It is one offline file.
- `node spikes/001-shelf-to-basin/test.js` runs the physics checks: Gibson, drained compaction,
  mass balance, speed, determinism. It should end `ALL PASS`.
- `node spikes/001-shelf-to-basin/build.js` rebuilds the HTML from `engine.js` + `app.html`.
- Spike 002 works the same way: `spikes/002-salt/` (`test.js`, `build.js`, `grid_check.js`).
- Requires Node 22 or newer (developed on Node 26).

## Known traps
- **Canvas size at display scaling above 100%.** A canvas's `height` attribute is its backing
  size, not its display size. Reading it back to size the canvas multiplied it by the scaling on
  every redraw, and the resize observer triggered the next redraw. At 150% Windows scaling the
  section grew past 350,000 px in 2 s and crashed the page (found by John on 2026-10-15). The
  display height is now a constant (`SECTION_CSS_HEIGHT`), passed in. Every headless-browser check
  must also run at 125% and 150% scaling (`deviceScaleFactor`), not only 100%.
- **Per-grain-size mass balance.** Total mass can balance while the sand/mud split is wrong. The
  first sorting scheme in spike 001 swapped about 27% of supply between grain sizes without any
  error showing in the total. Always test sand-only (and later salt-only) balance.
- **Bit-identical rewind needs identical arithmetic.** In spike 001, `restore()` recomputes cached
  loads with exactly the same expression order as `compactColumn()`. Changing one without the
  other breaks determinism by rounding error, and the determinism test catches it.
- **Snapshot memory.** Spike 001 snapshots are full copies (about 75 MB of heap per branch at one
  snapshot per 75 kyr). M1 should store changed layers only, or cap the number of branches.
- **Thin-sheet salt has no diapir width** (`coverBend` = 0, M3.1). Under a heavy cover the narrowest bumps
  grow fastest, so diapirs collapse to 1–4 grid cells. M3.2 `coverBend` = 1 (default) fixes that for the
  linear stage; a finite-amplitude needle from a strong thin spot is still a few cells wide and its width
  is not stable across machines (note in `tests/coverConvergence.test.ts`). Always run a grid-refinement check.
- **Headless screenshots.** To check the UI, drive headless Chrome over CDP with a separate
  `--user-data-dir`. John's own Edge profile is locked while Edge is open.

## M1.3 engine port (2026-10-14)
- Spike 001 physics now lives in `src/engine` (`transport`, `turbidites`, `subsidence`, `compaction`, `step`); results are bit-identical to the spike on the default run.
- `node scripts/spike001-golden.mjs` rewrites `tests/golden/spike001-default.json` from the spike. Only do that if the spike itself changes.
- Cached porosity, permeability and loads are NOT in the record. `restoreEngine` rebuilds them from `smax` and the stored thicknesses; `buoyantLoad()` in `compaction.ts` is the one load expression shared by compaction and restore.
- Salt cells are skipped by transport and compaction: they stop erosion, the active layer and the load. Salt weight on the sediment below is not counted until M3.

## M1.4b long runs (2026-10-14)
- Presets live in `src/engine/presets.ts` (`PRESETS`, `getPreset`, `presetParams`, `presetSchedule`): last 3 Myr (default, bundling off), Miocene 23 Myr (400 columns, bundling every 10), Cenozoic 66 Myr (400 columns, bundling every 20).
- Bundled deep compaction (params `bundleEvery`, `bundleAgeYr`; `compactStep` in `step.ts`): layers younger than `bundleAgeYr` are consolidated every step, older ones once per `bundleEvery` steps with the summed time. The record still holds every layer. Off when `bundleEvery` is 1 (default) and always off in the Gibson `linear` mode.
- **Trap: with bundling on, cached loads of deep layers lag, so `ld` cannot be rebuilt from the record.** `snapshotEngine` stores `ld` when `eng.lagLoads` is true and `restoreEngine` puts it back. Do not "simplify" this: a rewind from the middle of a cycle is no longer bit-identical without it (test in `tests/longruns.test.ts`).
- **Trap: bundled runs keep `rec.H` as a running value** (`H += bulk change of the updated layers`) and recompute it exactly only on the full-solve step. `restoreEngine` therefore does not call `recomputeH` for bundled snapshots. Anything that changes cell thickness outside `step()` must call `recomputeH`.
- **Trap: coupled ON/OFF comparisons are limited by chaos, not by bundling.** A 1e-7 relative change in supply moves H by 4 m on the 12 Myr default run (60 m on a coarse 60-column grid), more than the bundling does. Compare bundling with a prescribed deposition (no transport), as `tests/longruns.test.ts` does. `STRATA_SLOW=1` runs the coupled comparison against the chaos floor.

## M1.7 scenario files and autosave (2026-10-14)
- `*.strata.json` v1 is the RECIPE (preset, seed, grid, duration, time steps, main-run overrides, branch tree with edits, final stateHash per branch). Code: `src/app/scenarioFile.ts` (build, parse and validate by hand, compareHashes), `src/worker/scenarioReplay.ts` (rebuild on a TimeMachine; worker request `openScenario`; `hashes` gives the hashes for Save).
- Branch ids inside a file only link parents. A reopened scenario gets dense new ids (deleting a branch leaves a gap, rebuilding does not). Never key anything outside the file on them.
- Autosave (`src/app/autosave.ts`) writes the same recipe, without hashes, to localStorage (`strata-lab.autosave.v1`), debounced 800 ms and flushed on pagehide. Restore recomputes it like Open.
- Replace warning (`src/app/replaceGuard.ts`): New, Open and Reset warn when there are changes not saved to a file; preset, run-length and main-run edits warn only when they would drop branches.
- Raise `ENGINE_VERSION` in `src/version.ts` by hand when an engine change alters results, and rewrite the fixture: `STRATA_WRITE_FIXTURE=1 npm run test:run -- scenarioFile` (tests/fixtures/scenario-v1.strata.json is a golden for the hashes).
- `node scripts/verify-scenario-built.mjs` checks the round trip in the built file (real download through CDP).

## M2 slope failure and MTDs (2026-10-15)
Built as a chain `strata-lab/m2-01-stability` -> `m2-02-failure-runout` -> `m2-03-triggers` -> `m2-04-views` -> `m2-05-docs`, then fixes M2.7, M2.8, M2.10 and the canvas fix; merged to main 2026-10-15.
- Code: `src/engine/stability.ts` (`computeStability`, `infiniteSlopeFS`, `seafloorSlope`), `failure.ts` (failure and MTD deposit), `runout.ts` (Bingham run-out), `triggers.ts` (cause tag and its history). Views: `src/views/events` (event list), FS mode in `src/views/section`, MTD intervals in `src/views/well`. Registry keys and their sources: `docs/physics-references.md`, "M2 parameter summary".
- **Trap: results are bit-identical on ONE machine only (D14, D16.4).** Windows, Linux and Mac maths libraries differ in the last bit of `pow`, `exp`, `log`. The shoreline, shelf-edge and slope-failure logic amplifies that: a 1 ulp change moves single columns of the default run by 30 to 75 m (mean 2 to 5 m) and max pore pressure by up to 15 %, while totals hold (sand 5e-15, mud 2e-4, mean surface height 1.8e-3, relative). Rules: (1) tests that compare ACROSS machines (golden files, committed fixtures, hashes from a file) use tolerances and summary statistics, never `stateHash` or per-column equality: see `src/engine/summary.ts` (`SUMMARY_TOL`, measured values in its header) and the golden test in `tests/run.test.ts`; (2) tests of ONE machine (rewind, branch, "same hash on a second run") keep exact equality; (3) prove a new cross-machine tolerance with `withUlpNoise` (`tests/helpers/ulpNoise.ts`), which emulates another libm, and prove it is not too loose by showing a 1 % change in supply still fails; (4) a scenario file whose hash differs but whose summary statistics agree opens without a warning (`compareHashes`, `closeOnly`); old files without summaries still warn; (5) wall-clock tests use `it.skipIf(!!process.env.CI)` and the vitest default timeout is 30 s; (6) never build a test on a count that sits near zero. The MTD preset at 25 kyr steps makes 2 events (0 to 4 under ulp noise), at 5 kyr it makes 24 (24 to 34), so tests use `MTD_SEGMENTS` (5 kyr). The unperturbed FS does not hover at 1: minimum FS per step wanders between 1.3 and 7 with short dips below 1, so whether a dip fails in a given step is chaotic, which is why only the coarse run is fragile.
- **Trap: failure is OFF by default (`failOn` = 0, start-only).** That is what keeps the M1 golden runs bit-identical, so `ENGINE_VERSION` is still 1. Anything that changes failure, run-out, stability or trigger code changes the hashes of runs with failure on (the MTD-prone preset) but not the M1 fixtures, so no test warns you. Raise `ENGINE_VERSION` by hand if you change results.
- **Trap: FS is not stored.** `computeStability()` recomputes it from the record each time, so nothing has to be rebuilt on restore. Do not cache it in the record. The worker sends an `fs` field to the section and has an `events` request for the list.
- **Trap: the trigger history IS state.** `EngineState.hist` (the last `LOOKBACK_STEPS` end-of-step slopes, pressures, sea levels and loads, `HIST_SLOTS` slots) is cloned in every keyframe and copied back on restore (`src/worker/keyframes.ts`). Without it a rewound run tags events differently. Events are never edited after they are made, so snapshots keep a shallow copy of the list. `TimeMachine.eventsAt(branchId, step)` gives the events up to a step.
- **Trap: a deposit goes into the layer of the step that failed.** Two events in one step share that layer. The engine tags a cell MTD only when debris is at least half of its solids, so the views also mark every cell in an event's deposit. Do not use `material === MTD` alone to find a deposit.
- **Trap: the top cells of a fresh layer look unstable** (their excess pressure has not drained). `failMinDepth` (10 m) and `failSlopeMin` (0.5 deg) hide that and are stated limits, not tuning to hit a target. Lowering them makes thin skin failures every step.
- **Trap: the default parameters produce no failures** on the default scenario (friction 33/25 deg on 6 deg slopes). Tests that need events either use the preset (`'mtd'`) or set `phiFric` to [16, 9] (about 40 events).
- **Open: speed. The 15 % budget of M2.3 is still MISSED on the long presets and on `mtd` with failure on.** M2.10 measured (`node scripts/review/m2-speed.mjs 5`, five paired runs each, same machine, not perfectly idle so single runs scatter by tens of percent; best-of-5 on versus best-of-5 off): `last3` +11 % (runs +3 to +22 %, budget met on the best-of), `miocene` +48 % (runs +20 to +73 %, 3.3 to 4.1 s with failure on against 2.2 to 2.9 s off), `cenozoic` +45 % (runs +17 to +52 %, 3.9 to 4.4 s against 2.7 to 3.4 s), `mtd` +20 % (runs +16 to +31 %, 2.0 to 2.4 s against 1.7 to 1.9 s). So the budget is met only on `last3`. Every preset finishes in under 5 s. History: M2.7 made the cost about double (miocene +88 to +125 %, cenozoic +185 to +197 % in the M2.10 before-run) because `clearEmptyMtd` scanned the whole record at the end of every failure step. M2.10 runs that scan only while `diag.mtdPresent` is 1 (a deposit has tagged an MTD cell and the last scan still found one), which brought the cost back to about the M2.6 level. The rest is the slope search of every sloping column at every step. Failure off is unchanged (parity with main holds).
- **Trap: `diag.mtdPresent` is state.** It lives in `Diagnostics`, so snapshots and keyframes copy it with the rest of diag. If you add another place that writes `material = MTD`, set it to 1 there, or the clean-up scan will skip those cells.
- **Known limit: events at the iteration cap are not flagged stalled.** On the MTD-prone preset (Node) events #14 and #24 are the last event of a step that reached `failMaxIters` (5), with run-out 0 km (under `failStallRunout`), and the columns were still unstable. They count in the engine's `failUnresolved` (+1 each) but carry no stalled flag, so the list header shows 2 unresolved columns (the two stalled events, #6 and #18) while `diag.failUnresolved` is 4 (2 stalled columns + 2 steps that hit the cap). A code change to flag them would change event counts and identities, so it was left for John.
- **Platform honesty (review finding 4, D14): results are identical on the same browser/runtime, and rewind is bit-exact, but event lists can differ between Node and Chrome (and Linux).** Failure is a threshold process, so a one-ulp difference in a pore pressure moves an event by whole steps. Measured on the MTD-prone preset after M2.7: Node 26 gives 24 events (16 rapid loading, 8 oversteepening, 2 stalled); the built app in Chrome gives 37 events (32 rapid loading, 5 oversteepening, 9 stalled, 10 unresolved columns, 1 window-limited). Do not write or test “the same events on every machine”. Tests and golden fixtures that include events can be red on another platform (Linux CI). How to test this (summary statistics instead of event identity?) is John's decision and is NOT made here.
- **Cause tag (M2.7).** The tag is the term with the largest score, each term divided by its own tuned threshold (`failSlopeTerm` 0.1, `failPressTerm` 0.1, `failLowstandDrop` 20 m); `mixed` when none reaches 1. On the MTD-prone preset it is still two labels (rapid loading and oversteepening), because the pressure term is a log of 1/(1-ru) and reaches 5 to 65 times its threshold while sea level reaches 0.4 to 2.4. The thresholds are the knobs if John wants another spread; they change the label only.
- **Stalled events and the search window (M2.7, shown in the list in M2.8).** An event that moved debris less than `failStallRunout` (500 m) and re-picked the same columns in the same step is `stalled`: the columns are masked for the rest of the step and counted as unresolved (the list header shows the count). `windowLimited` means the scar is within 5 % of `stabMaxDepth` (300 m, tuned): the true failure may be deeper. Both flags have an (i) explanation in the list.
- **Physics checks (M2.8).** The panel has five M2 rows (`src/worker/checksM2.ts`): infinite-slope FS for 6 deg / 25 deg / ru 0.5, FS = 1 at ru = 0.7746, the Bingham plug thickness, and sand and mud balance through one failure. Expected values are written from the formulas in that file, not taken from the engine.
- **Zero-thickness cells (finding 6).** The section's MTD mask ignores cells with no sediment, so they are never painted; the pseudo-well already skipped them.
- `src/engine/params.ts` is one long registry array and every card adds rows to it. Expect merge conflicts there.
- Same-step events stack their headwall labels in the section (#1 to #6 at 2.485 Ma in the preset). The right column was widened from 340 to 420 px for the event table. The 390 px phone width was not checked.
- Screenshots of the built file: `docs/screenshots/m2-04/` (script `scripts/screenshots-m24.mjs`, `report.json` shows 0 console errors and 0 external requests).
- `tests/docs.test.ts` now also checks the M2 control labels in the user guide. When you rename a label, rename it in section 13 of `docs/user-guide.md`.

## M3.3 Welds and salt in the burial physics
Code: `limitOutflow` in `src/engine/salt.ts`, `src/engine/saltIntervals.ts`, salt temperature in `src/engine/thermal.ts`; tests: `tests/welds.test.ts`.
- Weld limiter: when a salt substep would leave a cell below 0, each cell's outgoing face flux is scaled by min(1, h / out). The same face flux is used both sides, so salt is conserved to rounding and `saltClip` stays 0. The M3.1 clip stays as a last guard. With no negative cell the step is untouched.
- `weldAge` (state, `WELD_NONE` = -1): age of the first time a column went from >= `weldThick` to below it. Copied by snapshots and keyframes.
- Salt temperature: exact steady conduction through a salt cell with k(T) = k0 / (0.99 + (a - b/k0) T). The coefficients a and b are marked to verify (halite not checked).
- Salt weight is in `columnOverburden` (views). Compaction still does not add the weight of salt to sediment BELOW salt (canopies): not needed before M3.4.
- Test at coarse steps: the limiter acts on thick cells too (a step-size guard); at the 20 kyr benchmark it acts only below 1 m.

## M3 salt (2026-10-15)
Chain above; the engine is `src/engine/salt.ts` (flow, cover bending, weld limiter), `banded.ts` (solver), `saltIntervals.ts`,
`saltStructures.ts` (measures for reports), the Gulf preset in `presets.ts`; views in `src/views/section`, `src/views/well`; checks in
`src/worker/checksM3.ts`. Numbers and benchmarks: `docs/roadmap.md` (M3) and `docs/physics-references.md` (M3 benchmarks and results).
Salt is OFF by default (`saltOn` = 0, start-only, D17.2): with it off every M1/M2 run, golden and fixture is unchanged and `ENGINE_VERSION` is still 1.
- **Trap: the record layout changes with salt on.** There are TWO pre-run layers: layer 0 = salt (every cell tagged `SALT`, thickness in
  `mud`, possibly 0), layer 1 = the older cover (sediment). `rec.nPre` (1 or 2) is the number of pre-run layers; record step k fills layer
  `nPre + k`. Never map a layer to its step or age with a literal 1: use `nPre` (`keyframes.ts` and the saved-record head, which carries
  `nPre` only when it is not 1, were changed for this).
- **Trap: what salt state is stored.** Stored and copied by snapshots and keyframes: the salt thickness (in the record), `weldAge`
  (`WELD_NONE` = -1), and the `diag` counters `saltClip` and `saltLimited*`. Derived and never stored: everything in `eng.salt`
  (`SaltScratch`: weights, potential, face mobility, the tridiagonal and banded work arrays, and the M3.4 cache of old-layer loads `Wd`,
  `Sbd`, `low`, `cacheId`). If you add salt state, add it to `snapshotEngine`/`restoreEngine` and to `packKeyframe`/`restoreKeyframe`, or a rewound
  run drifts. Rewind tests with salt on: `tests/salt.test.ts` (including a bundled run rewound from the middle of a cycle) and `tests/welds.test.ts` (weld age after rewind, snapshot and keyframe routes).
- **Trap: weld age is history.** `weldAge` is the age of the FIRST time a column went from at least `weldThick` to below it. A column that was
  never thicker than `weldThick` (the pinch-out, the landward edge) never welds. It is a label: the weld limiter does not use `weldThick`.
  `weldThick` can be changed on a branch (not start-only), which changes labels from then on but not the flow.
- **Trap: the load cache in bundled salt runs.** M3.4 keeps the weight of the old layers from the first step of a bundling cycle (`cacheId`),
  and `low[j]` records the lowest layer that transport removed sediment from. A new place that removes or changes old sediment must set `low`,
  or the salt sees stale weights. The cache gives bit-identical results to a full sum (`tests/saltSpeed.test.ts`); setting `eng.salt.cacheId = -1`
  forces a full rebuild.
- **Trap: the banded solver is plain Gaussian elimination in a fixed order** (`banded.ts`, LU with partial pivoting, 3 sub- and 3 super-diagonals,
  same layout as LAPACK dgbtf2/dgbtrs, no `Math` calls) so it stays deterministic. Do not swap in a library or reorder the sums. It is checked
  against a dense solve (`tests/banded.test.ts`).
- **Trap: the cross-machine spread of salt results (D16.4).** Same-machine runs are bit-identical and rewind is exact. Across machines (and
  under `withUlpNoise`) widths of individual structures move. Tested bands: the roof wavelength within 10 % across the grids and within 3 % under
  1 ulp noise (`tests/coverConvergence.test.ts`). NOT a test: the width of a finite-amplitude needle (one to five cells; 1.76 km became 2.32 km at 250 m cells
  under 1 ulp). Test the Gulf preset with bands and summary statistics only, and never on a count near zero. The spread of its welds and crests
  is in "M3 state after M3.10" below (M3.4 reported counts from one run only: 11 minibasins, 11 highs; that was withdrawn).
- **Trap: thin-sheet salt still has no width of its own.** With `coverBend` = 0 diapirs collapse to a few cells again. The registry default
  (1) is what hides this; the width then depends on `coverVisc`, which is tuned (the Gulf preset uses the default, 1e19 Pa s).
- **Trap: the preferred diapir spacing at `coverVisc` 1e19 is about 10.2 km** (1.5 km salt, 1 km cover). The old "about 8 km" note in
  `params.ts` was corrected in M3.8.
- **Trap: `coverThick` default (200 m) is the salt-off substrate**, which is why M3.1 to M3.3 runs did not change when M3.4 added it. The Gulf
  preset sets 300 m (it was 1,000 m at M3.4).
- **Trap: the section extent only grows** (`extentOf`/`growExtent`, `store.ts`, an M1 behaviour). A canvas pixel hash after visiting views in a
  different order is therefore different. Compare screenshots only after the extent has settled.
- Browser evidence for the views: `scripts/review/m3-views-browser.mjs <outdir>` after `npm run build` (screenshots are kept out of the repo). It
  checks the default run, the Gulf preset, all colour modes, pseudo-wells, rewind/branch/compare and 100/125/150 % scaling (section 643 x 360 CSS px at all three, no growth).
- Labels: when you rename a salt control or a view label, rename it in section 14 of `docs/user-guide.md`; `tests/docs.test.ts` checks the control labels.

## M3 state after M3.10 (2026-10-16)
Read with D18 and D19 in `docs/decisions.md`. Full tables: `docs/reviews/m3-10-edge-fix.md` (script `scripts/review/m3-10-edge.mjs`) and
`docs/reviews/m3-rereview.md` (script `scripts/review/m3-rereview.mjs`).
- **Two salt presets.** *Gulf-style: wedge over salt (66 Ma)* (`gulf`, 5.0 to 5.1 s in Node) and *Salt: uneven cover (10 Myr)* (`saltshort`, 0.4 s).
  `saltshort` is a teaching toy: its section ends 3.3 km above sea level with 3.5 to 6 km of cover over the salt, and its structures are 1 to 2 cells
  wide (minibasin widths 2, 25, 2, 1, 1, 5 km). Do not read its widths or its depths (re-review finding 10).
- **Weld label is 100 m** (`weldThick`, D18). The Gulf preset sets 100 m; the registry default stays 10 m, so no other run changes. It is a tuned
  label, not physics: thin-sheet flow slows as the cube of the thickness and never reaches 10 m in 66 Myr. Wagner and Jackson (2011) is cited,
  abstract only, to verify.
- **Basinward salt limit** (`saltLimitStart`, `saltLimitEnd`, start-only, M3.10, D19): the salt basin ends between 200 and 240 km in the Gulf preset
  (smoothstep). Defaults are 2,000 and 2,500 km, so every other run is unchanged. The values are tuned, chosen by the pile test (see the trap below),
  not by crest count. The 4 km start thickness is tuned too (no source; the old "upper end of Louann estimates" note was withdrawn, finding 11).
- **The weld is real, but its length is not robust.** Under 1 ulp noise (six noise salts, M3.10) the total weld length is 12 to 20 km (17 km plain)
  and the longest run 3 to 4 km. Before the edge fix (M3.9) the longest run was 2, 3, 1, 2, 2, 3 km across six salts, so one in six missed the 2 km
  target. Positions move too (28-31, 35-37, 44-45, 50-52, 75-76 km in the M3.9 base run). `tests/gulfPreset.test.ts` therefore asks for a band that
  all seven runs pass (total 8 km or more, one run of 2 km or more), never for particular welds. The tolerance was proved with `withUlpNoise`.
- **Crests.** 5 crests lie within 2 km of the seafloor and 20 km or more from the section edge and the salt edges in the plain run (2 to 5 across the
  six noise salts) at 286.5, 308.5, 314.5, 318.5 and 322.5 km. The shallowest has 4,243 ft (1.3 km) of cover. They are 300 to 850 m ripples of the
  cover seed on a flat slab 5 km thick (the first is the slab's own top), not diapirs. The D18 target is met by the letter, not in spirit. Diapirs at
  the seafloor are S3 and M3b. M3.9's four crests were 287.5, 314.5, 354.5 and 389.5 km with 1,863, 1,567, 1,247 and 1,106 m of cover, on a slab 8 to 9
  km thick; the last one was 10.5 km from the edge. With `coverUneven` 0 there were no crests; with other `coverSeed` values 1 to 2 at other places.
- **Grid.** Wavelength of the salt thickness agrees within 1.3 % at dx 1,000 against 500 m (200 km section: 23.2 against 22.9 km), 9 % at dx 1,000
  against 2,000 on 400 km (14.1 against 12.8 km). Counts and spacing do NOT converge (spacing 16.0 against 17.6 km, 4 against 5 highs; M3.9 reported
  59.6 % for the median crest gap and 25.8 % for spacing). The record holds 400 columns, so dx 500 m covers only 200 km. Keep saying counts and spacing
  are not grid-converged (finding 7).
- **Salt thickness every 10 km at the end of the run (0 Ma), m.** M3.9 piled 8 to 9 km of salt beyond 250 km; M3.10 has 5.0 km at most and none after
  355 km. (Columns are centred at the km shown for M3.9 and 0.5 km less for M3.10; the 66, 40 and 20 Ma tables and the seafloor in ft are in the
  review doc. Finding 6.)

```
  km      M3.9 (no limit)   M3.10 (now)
    5             0                 0
   15            30                30
   25           637               637
   35           145                85
   45            41              2778
   55           546              1809
   65           201               324
   75           248               142
   85          1159               533
   95           674              1799
  105           726               456
  115           894              1792
  125           987               669
  135           718               782
  145           565               569
  155           381              1005
  165           505              1650
  175           368              1431
  185           324              1102
  195           459               955
  205           478               749
  215           590               553
  225           817              1089
  235          1595              2751
  245          3521              3838
  255          4615              4253
  265          6020              4791
  275          7107              4835
  285          8057              4787
  295          8094              4511
  305          8283              4566
  315          8741              4801
  325          8495              3609
  335          8524              2620
  345          8578              2013
  355          8969               493
  365          8550                 0
  375          8609                 0
  385          8709                 0
  395          8575                 0
```

- **Speed.** Gulf preset 5.0 to 5.1 s (M3.9: 5.4 to 6.0 s). Salt-off presets against main, best of three, two interleaved passes, ms (M3.10): last3
  1421 / 1461 on main, 1414 / 1475 here; mtd 2173 / 2127, 2208 / 2082; miocene 2316 / 2314, 2334 / 2298; cenozoic 2845 / 2745, 2728 / 2744. All within
  5 % (a first, non-interleaved pass read mtd +12.7 %, which was machine noise). M3.9 measured the same (last3 1,447 / 1,505 against 1,475 / 1,447,
  mtd 2,103 / 2,062 against 2,130 / 2,103, miocene 2,307 / 2,327 against 2,276 / 2,412, cenozoic 2,746 / 2,839 against 2,751 / 2,894). `stateHash` of
  last3, mtd, miocene and cenozoic on this machine is identical to main (cb22255b, 9be1b3f3, fa992a56, ebd3965b); `gulf` changed on purpose
  (f2e2fd2c, was dae567c7); `saltshort` b9d410d6 is unchanged since M3.9.
- **Wall-clock tests** (`run`, `longruns`, `coverBending`, `m28views`, `gulfPreset`) flaked on a loaded Windows machine when the heavy salt files ran in
  parallel (finding 9). Since M3.10 `vitest.config.ts` has a `main` project and a serial `wallclock` project, and `npm run check` runs
  `test:gated` (main, then wallclock). `npm run test:run` is plain `vitest run` without that isolation, so those tests can still flake there. They are
  skipped when `CI` is set.
- **Known limit: the section's vertical scale depends on viewing history (finding 8).** Step 0 drawn on the first visit and on later visits differs by
  a pixel in 7,750 of 231,480 pixels (every layer line and axis label). The engine state and the StateView at step 0 are identical on every visit
  (hash 566eca05), so the difference is in the drawing only. It follows from the extent that only grows (trap above). No fix needed for the physics.
- **Trap: a closed, zero-flux salt edge piles salt up against the section edge.** The basinward edge is closed (no salt may leave, which keeps the salt
  balance exact). If salt starts 4 km thick all the way to that edge, the wedge squeezes it basinward at about 9 m2/yr and it stacks up (8 to 9 km thick
  at the end at M3.9; salt volume beyond 250 km doubled from 600 to 1,202 km2). Any crests on that pile are ripples that follow the cover seed, not
  diapirs. Give the salt basin its own basinward limit (`saltLimitStart`/`saltLimitEnd`) and leave room beyond it. Check with the no-pile test in
  `tests/gulfPreset.test.ts` (under 100 m of salt in the last 20 km, under 1.5 times the start beyond 250 km). On a 200 km section the limit sits at the
  section edge and the edge pile comes back, so use that section only for structure width.
- Still wrong for a Gulf geologist: 200/240 km is tuned, not a Gulf position; the outer 160 km of the section has no salt at the start; no canopies;
  structures are ripples on a slab; salt is 5 km thick at most with a 4 km start that has no source; the Hudec et al. (2013) reference was read at
  abstract level only; the start at 66 Ma puts only 300 m of cover on the salt.

## M4 planned well (2026-10-16)
Chain: `strata-lab/m4-01-well-path` -> `m4-02-well-pressures` -> `m4-03-well-view` (merges UI-1) -> `m4-04-well-export` -> `m4-05-docs`.
NOT on main. Picks are D21 in `docs/decisions.md`; numbers and the hand calculations are in `docs/physics-references.md` ("M4.1 Planned well path and
sampling", "M4 well pressures"); the user text is in `docs/user-guide.md` section 8, "The planned well". The well is a VIEW: nothing here changes a run,
`ENGINE_VERSION` is still 1, and `stateHash` of last3, mtd, miocene, cenozoic, saltshort and gulf is unchanged (cb22255b, 9be1b3f3, fa992a56, ebd3965b,
b9d410d6, f2e2fd2c). `git diff main -- src/engine` is three new files and no edited one.
- **Module contract.**
  - `src/engine/well.ts`: `WellDefinition` (xKm, airGapFt, kickoffFt, buildRateDegPer100Ft, holdInclinationDeg, direction, totalDepthFt), `verticalWell`,
    `validateWell`, `wellStations` (closed-form path, one station per 10 ft of MD), `sampleWell(eng, P, sl, well)` -> `WellSamples` (SI; kinds `WELL_AIR`,
    `WELL_WATER`, `WELL_SEDIMENT`, `WELL_SALT`, `WELL_MTD`; stop reason `leftSection` or `baseOfRecord`), `emwPpg`, `DEFAULT_AIR_GAP_FT` (80, tuned).
  - `src/engine/wellPressure.ts`: `wellPressures(samples, params)` -> `WellPressures` (fracture gradient, window, state per station `WINDOW_NONE/OK/TIGHT/NO_WINDOW`,
    runs, narrowest window), `eatonK`, `fracturePressurePa`. Parameters: `src/engine/wellPressureParams.ts` (`WELL_PRESSURE_PARAMS`, a separate small
    registry, NOT in `params.ts`, so they never enter a stateHash).
  - Worker request `sampleWell` (`TimeMachine.sampleWell`, `src/worker/protocol.ts`, `handler.ts`): reads one branch at one step.
  - Scenario file: optional `well` and `wellPressure` (written only with a well; absent = defaults), read and validated in `src/app/scenarioFile.ts`. Old files open
    unchanged and the fixture did not change. The store holds `wellPlan`.
  - Views: `src/views/wellplan` (panel `index.tsx`, `plot.ts` pure plot maths, `exportWell.ts` CSV and title lines, `exportPng.ts` PNG), the well path on the
    section in `src/views/section/wellPath.ts`. The pseudo-well (`src/views/well`) uses the same RKB datum and the planned well's air gap.
  - Export: `wellCsv(ctx, runs)`, `parseWellCsv`, `exportFileName`, `titleLines`, `describeWell`, `CSV_COLUMNS`; `plotPng(svg, titleLines, legend)`,
    `downloadBlob`; `store.branchHashes()`. File names `strata-<preset>-well-stations-<Ma>Ma.csv` and `strata-<preset>-well-pressure-<Ma>Ma.png`.
- **Trap: depth in every pressure formula is TVD below RKB**, not measured depth. A deviated well and a vertical well read the same at the same TVD (tested).
  Keep ft TVDSS on the axis and ppg from the rig floor; sea water at 3,000 ft reads 8.332 ppg, not 8.554 (air gap 80 ft).
- **Trap: salt has no pore pressure.** `porePa` is NaN in salt samples. No window is counted in salt (M4.7), and the fracture
  gradient is the overburden (D21; no source, to verify). Anything that plots or exports `porePa` must handle NaN (the CSV leaves the field empty).
- **Trap: do not blend across a salt flank or an MTD edge.** Numbers are interpolated between the two columns only when both hold the same material at that
  elevation; otherwise the nearest column is used (`sampleWell`). Overburden is always interpolated.
- **Trap: Eaton and Matthews & Kelly use ONE constant each** (nu 0.40, Ki 0.60, both tuned; neither paper was read). With constant K the two differ only by
  the number chosen. Do not add depth curves without reading the papers. The margins, the tight threshold, nu and Ki are saved in the file but have no
  control in the panel yet (only the method does).
- **Trap: the plot top moves down about 84 px when Compare branches is ticked** (the fieldset appears above the plot). The section does not move. Checked in
  the built file at 100, 125 and 150 % scaling, canvas backing size stable, 0 console errors.
- **Trap: `tests/wellTiming.test.ts` is wall-clock** and sits in the `wallclock` project (skipped when `CI` is set). It, and the cenozoic and 3 Myr gates,
  failed once each at 10.1 s and 3.8 s while a browser was running; they passed alone. Re-run before suspecting a code change.
- Checks: `node scripts/verify-well-export-built.mjs` after `npm run build` (25 checks: PNG magic bytes and size at 100 and 150 %, CSV parses back, fracture
  gradient against the Eaton formula to 3.5e-8 relative, compare CSV has one block per branch, 0 console errors, 0 external requests).
- Labels: the planned-well labels are listed in `tests/docs.test.ts` (`APP_STRINGS`), so the guide and the app source are checked against each other.

## M3b part 1 crest log (2026-10-17)
Chain: `strata-lab/m3b-01-crest-log` -> `m3b-02-crest-view` -> `m3b-03-docs`. NOT on main; waiting for review (M3b.4) and John's check. Picks are D23 in
`docs/decisions.md`; definitions, sources and tuned values are in `docs/physics-references.md` ("M3b.1 Crest log"); the user text is `docs/user-guide.md` 14.7.
It is a read-only analysis: `ENGINE_VERSION` is still 1, the record, presets and fixtures are unchanged, and `git diff main -- src/engine` adds only the
analysis file and the side output that copies three arrays after each step.
- **Module contract.** `src/engine/crestLog.ts` (`crestParams`, `buildCrestLog`, `labelOf`, `slope`, `CrestLog`, `CrestEpisode`; `CrestHistory` with `createCrestHistory` and `pushCrestFrame` is the side output),
  request `crestLog` in `src/worker/protocol.ts` / `timeMachine.ts`. Views: `src/views/crests` (`model.ts` rows, sort and markers; `exportCrests.ts` the two CSVs;
  `Markers.tsx`; `index.tsx` the table, registered in the well region at order 0.75). Tests: `tests/crestLog.test.ts` (hand-made records),
  `tests/crestLogGulf.test.ts`, `tests/crestView.test.ts`.
- **Trap: the label comes from the rates only.** `tabular`, `tapered` and `unresolved` are set by the sign of F - A and a 25 m/Myr floor. The grid is 1,000 m wide, so
  hooks and wedges (fold zones of 50 to 1,000 m, GR12 p. 8) cannot be seen. Do not describe a label as a halokinetic sequence type found in the strata.
- **Trap: single-crest numbers are noise-sensitive (D16.4).** Which crests exist, how many are tabular, and the F - A of one crest move with 1 ulp of maths noise and
  differ between Windows node 26 and Linux WSL node 22. Quote medians over noise runs and over both platforms and name the platform. Gulf, 7 runs per platform, near
  window: median F - A -70.6 m/Myr (Windows) and -102.8 m/Myr (Linux); 1 tabular, 125 tapered, 58 unresolved over 14 runs. Never test a count near zero (the tabular
  count is about 0 to 1 per run, so no test asserts it).
- **Trap: the noise floor is tuned.** 25 m/Myr (82 ft/Myr) leaves about 30 % of Gulf crests unresolved. John may prefer 10 m/Myr (open question from M3b.1/M3b.2); changing
  it is a one-line change of `NOISE_FLOOR_M_PER_MYR`, but redo the noise-run measurement and the numbers quoted in the docs.
- **Trap: the near window and the burial window are different numbers.** The table shows the near window; the CSV has both. Burial is more negative because it includes
  the one or two records after the cover passes 500 m. Do not compare a table number with a burial CSV column.
- **Trap: at the end of a run every Gulf crest is buried**, so the section has no markers until the time slider moves back. That is correct, not a bug. Whether the app
  should open at the first crest's time is an open question.
- **Trap: the log is for the main run only.** A branch request throws (M3b.1), the store clears the log and the table says so. A per-branch log needs the history before the
  fork to be shared.
- **Trap: x is the crest's position at its LAST record.** That is also where the neighbour salt is measured. The CSV has both `x_first_km` and `x_last_km`. A crest followed
  across several columns moves; do not use `x_first_km` to place a marker.
- **Trap: salt is read from the salt layer only.** Salt that has flowed up into higher layers (a canopy) is not followed. The Gulf preset has none, but a future canopy
  solver would make the log blind to it.
- **Trap: there is no dissolution term.** VJ92a p. 347 write net rise as F - D; the engine has no D, so F is the whole rise. "At the seafloor" is cover under 2 m
  (spike 003 `roofMin`), not an engine rule, and no Gulf crest reaches it (median time at the seafloor 0). Do not add salt to keep a crest exposed: burial is expected geology (John, 2026-10-16).
- **Trap: the merged-candidate count (44 to 100 per Gulf run) is a footnote under the table** and in the CSV header, not a list of crests.
- **Trap: canvas size at display scaling.** The marker buttons use the canvas's own mapping, and the canvas backing store follows scaling (1123x360 at 100 %, 924x450 at 125 %,
  725x540 at 150 %, Gulf, Chrome on Windows). Checked in the built file at all three, 12 crest rows, no horizontal overflow, 0 console errors. Recheck after any layout change.
- Labels: `Salt crests`, `Export crests (CSV)` and `Export crest records (CSV)` are listed in `tests/docs.test.ts` (`APP_STRINGS`), so the guide and the app source are checked against each other.
