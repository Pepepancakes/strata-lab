# Handover notes (keep current)

This file exists from day one so the project can move to another machine or agent at any time.
Update it whenever something here changes, in the same commit as the change.

## Where things stand
- 2026-10-14: spike 001 (2D deepwater shelf-to-basin) built and accepted. John said go for a core
  project. Repo created, docs written. Spike 002 (salt) built the same day; see
  `spikes/002-salt/README.md`. Waiting on John's look at it. Then M1 cards go to John for approval.

## How to run what exists
- Open `spikes/001-shelf-to-basin/dist/strata-spike-001.html` in a browser. It is one offline file.
- `node spikes/001-shelf-to-basin/test.js` runs the physics checks: Gibson, drained compaction,
  mass balance, speed, determinism. It should end `ALL PASS`.
- `node spikes/001-shelf-to-basin/build.js` rebuilds the HTML from `engine.js` + `app.html`.
- Spike 002 works the same way: `spikes/002-salt/` (`test.js`, `build.js`, `grid_check.js`).
- Requires Node 22 or newer (developed on Node 26).

## Known traps
- **Per-grain-size mass balance.** Total mass can balance while the sand/mud split is wrong. The
  first sorting scheme in spike 001 swapped about 27% of supply between grain sizes without any
  error showing in the total. Always test sand-only (and later salt-only) balance.
- **Bit-identical rewind needs identical arithmetic.** In spike 001, `restore()` recomputes cached
  loads with exactly the same expression order as `compactColumn()`. Changing one without the
  other breaks determinism by rounding error, and the determinism test catches it.
- **Snapshot memory.** Spike 001 snapshots are full copies (about 75 MB of heap per branch at one
  snapshot per 75 kyr). M1 should store changed layers only, or cap the number of branches.
- **Thin-sheet salt has no diapir width.** Under a heavy cover the narrowest bumps grow fastest,
  so diapirs collapse to 1–4 grid cells. Always run a grid-refinement check on salt structures.
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
