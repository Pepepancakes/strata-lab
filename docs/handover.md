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
