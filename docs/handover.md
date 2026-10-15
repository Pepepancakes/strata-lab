# Handover notes (keep current)

This file exists from day one so the project can move to another machine or agent at any time.
Update it whenever something here changes, in the same commit as the change.

## Where things stand
- 2026-10-15: M1 is on main (merge 56b964a). Linux CI is red because floating-point results differ
  from Windows (`docs/decisions.md` D14).
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

