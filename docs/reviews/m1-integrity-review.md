# M1 integrity review (card M1.9)

Reviewer: safety-reviewer profile (integrity role). Branch `strata-lab/m1-09-review`, on top of
`strata-lab/m1-08-docs` (994f073). Review only: no engine, app or doc under `src/`, `docs/` (other
than this folder) or `tests/` was changed.

Everything below was produced by `scripts/review/m1-review.mjs` (full output in
`docs/reviews/m1-review-output.log`, numbers in `docs/reviews/m1-review-results.json`), by the
repo's own `scripts/perf-built.mjs` and `scripts/screenshots-built.mjs` against the built file, and
by the four gates. Expected values come from code in the review script (a finite-difference solve
and the published closed form for Gibson, a rebuilt mass balance, hand-calculated temperature and
cement, and spike 001's `engine.js` executed in the script). The M1 engine is only run, never
asked for its own expected value. 91 of 92 script checks pass; the one failure is a licence
(finding 1).

## 1. Gates

| Gate | Result |
|---|---|
| `npm ci` | ok (npm audit reports advisories; not assessed, dev tooling) |
| `npm run check` (typecheck + lint + tests) | first run 197 passed, 1 failed, 1 skipped: a wall-clock assertion in `tests/longruns.test.ts` (the same flake the M1.8 hand-off reported). Rerun: 19 files, 198 passed, 1 skipped, 0 failed |
| `npm run build` | ok, `dist/strata-lab.html`, 543 kB (gzip 183 kB) |
| `npm run check:offline` | ok: 10 URL strings, all allowlisted and inert, 0 external hosts |

## 2. Independent checks (script)

### Gibson (1958): PASS
Engine against my own Crank-Nicolson solve of the PDE, and against the published closed form
(Gauss-Legendre). My two references agree with each other to 1e-7, so the reference is sound.

| T | engine vs closed form | engine vs own PDE | limit |
|---|---|---|---|
| 0.1 | 4.3e-6 | 4.4e-6 | 1e-3 of overburden |
| 1 | 8.1e-5 | 8.1e-5 | 1e-3 |
| 10 | 1.4e-4 | 1.4e-4 | 1e-3 |

### Golden parity with spike 001, sine curve: PASS (exact)
- Default parameter registry equals the spike's `defaultParams`: 0 differences.
- Max |H difference| 0 m; max column-total sand and mud difference 0 (limits 0.01 m and 1e-6).
  Per-cell solids, excess pressure and smax also compared in the script and printed in the log.

### Mass balance from raw arrays and supply history: PASS
Stored solids summed by me (compensated sum) from the record arrays, initial substrate rebuilt
from the Athy law, supply from the schedule. Relative imbalance, limit 1e-9:

| Run | sand only | mud only | all |
|---|---|---|---|
| 3 Myr sine | -1.5e-16 | 2.3e-17 | -1.3e-16 |
| 3 Myr published curve | -4.4e-16 | -1.6e-17 | -4.6e-16 |
| 6 Myr, thermal + cement + bundling | -6.2e-17 | 4.9e-18 | -5.7e-17 |
| Miocene preset (23 Myr) | -3.2e-16 | -1.3e-17 | -3.4e-16 |
| Cenozoic preset (66 Myr) | -1.8e-16 | -3.8e-17 | -2.2e-16 |

Supply recorded in the ledger equals supply times time exactly, deficit (unfilled erosion) is 0,
and the exported share (0.01 % to 2.5 %) is below the turbidite cap. Cement is held on its own
ledger line and equals the cement stored.

### Determinism: PASS
SHA-256 over the raw record bytes (my hash, not the app's). A second straight run repeats bit for
bit; random seeks (forwards and backwards through the app's TimeMachine) hash like the straight
run and give a bit-identical surface. 15 steps (600-step curve run), 11 steps (sine with thermal
and cement on), 9 steps (Miocene with bundling): 0 mismatches. A grep of `src/engine` for
`Math.random`, `Date.now` and `performance.now` finds only a comment in `rng.ts` that bans the first.

### The 2 Ma experiment, sine, both engines: PASS (M1 equals the spike)
Fork at 2 Ma (step 200 of the 600-step, 3 Myr run; 400 steps are compared after the fork), sea level -50 m, 5 kyr steps.
Spike 001 run in the script, M1 run in the script, M1 also through the app's `TimeMachine.branch`.

| Measure | Spike 001 | M1 | Difference |
|---|---|---|---|
| Shoreline shift, time-mean (km) | 2.10 | 2.10 | 0.00 % |
| Shoreline shift at highstands (km) | 0.70 | 0.70 | 0.00 % |
| Shoreline shift at lowstands (km) | 1.95 | 1.95 | 0.00 % |
| Shelf-edge shift, mean (km) | 2.26 | 2.26 | 0.00 % |
| Basin-floor sand, columns >= 65 km, share of all sand: change | +2.80 points, +5.2 % | same | 0.00 % |
| Same, 80 km toe | +0.83 points, +2.3 % | same | 0.00 % |
| Same, excluding the 200 m substrate (65 km) | +3.67 points, +7.0 % | same | 0.00 % |

M1 through the TimeMachine gives the same basin-floor share as the direct engine branch to 1e-12.
The "~5 %" of the spike is reproduced (5.2 %, or 7.0 % without substrate). The "~5 km" shoreline
shift is NOT reproduced by this script's measure on either engine (finding 4).

**Real curve (Bintanja & van de Wal), M1 only:** shoreline shift time-mean +2.55 km (highstand
+1.75, lowstand +2.70); shelf edge +3.51 km; basin-floor sand (65 km) +3.22 points, +5.9 % (+7.6 %
without substrate); 80 km toe +1.9 %. Same order as the sine, slightly larger.

### M1.4b / M1.4c benchmarks, recomputed: PASS
- Conduction: 3-layer hand sum T = Ts + q sum(h/k) matches `steadyConduction` to 0 C. The full
  temperature field of the Miocene run, rebuilt by me from the raw sand, mud and smax arrays
  (porosity law, geometric-mean conductivities, top-down sum), matches the engine and the app view
  to 1.4e-14 C at 8 columns, every cell.
- Quartz cement (Walderhaug): hand integral (Simpson, 200,000 intervals) at constant 100 C,
  heating 80 to 120 C, and 60 to 100 C crossing the 70 C onset: relative error 3e-10 %, 7e-13 %,
  9e-5 % (limit 0.5 %). One 1 Myr step against 100 steps of 10 kyr along the same heating line:
  identical.
- Thermal subsidence: engine basement drop equals rate x tau x (1 - exp(-t/tau)) at 1.0, 4.3, 8.3
  and 14.3 Myr and three columns, to 4e-15 relative (limit 1e-6).
- Bundled vs unbundled deep compaction, 12 Myr at 5 kyr, prescribed deposition (my own rates and
  facies rule, every 10 steps, 100 kyr window): surface within 1.85 m (limit 2 m), porosity log
  within 0.0007 (limit 0.005), peak excess pressure within 0.36 % (limit 2 %).
- Run times, script: Miocene 3.0 to 3.1 s in one of two runs (failed the 3 s line once; see
  finding 3), Cenozoic 3.7 s (limit 5). Shoreline and shelf edge never pass 119.5 km of 400 km in
  either preset.

## 3. Built file, headless Chrome (CDP, separate profile)

`scripts/perf-built.mjs` (two runs) and `scripts/screenshots-built.mjs` on `dist/strata-lab.html`:

| Item | Result |
|---|---|
| Full run, default (3 Myr, 600 steps) | 1.58 s |
| Miocene (1000 steps) | 2.3 s (limit 3 s) |
| Cenozoic 66 Myr (1430 steps) | 2.7 s (limit 5 s) |
| Main-thread long task during a run | none observed (0 ms; run is in the worker) |
| Seek / drag back (median, max) | 34-116 ms / 134-298 ms |
| Network requests other than the `file://` load | 0 (`externalRequests` empty, both app and spike page) |
| Console errors or exceptions | none |
| Controls | 49, all with a source tag: 37 tuned, 9 cited, 3 to verify, 0 without |
| Checks panel | ALL PASS (8/8, 196 ms): Gibson x3, drained sand and mud porosity (0.0044, 0.0179 against 0.02), mass balance sand and mud (2.7e-15, 1.6e-15), rewind bit-identical |
| Mass balance panel | 3 Myr curve: all sediment -7.5e-13, sand -3.9e-13; Miocene -1.2e-11 / -1.5e-11 |
| Branch from 1.5 Ma | works; 13 start-only controls locked in the branch |
| Sea-level credit | shown, with citation and data DOI |
| Saved scenario reopens with identical hashes | PASS at engine level (my script: build file, serialise, parse, rebuild, hashes identical; a file edited after saving is flagged; empty, truncated, wrong-format and version-2 files refused with plain messages). The Open button itself was not driven in the browser; it is covered by the repo's tests only |

Screenshots (31 files): `docs/screenshots/m1-09-review/`. Naming:
`m1-<preset>-<curve|sine>-<mode>-canvas.png` for presets `last3` and `miocene` and modes `grain`,
`age`, `phi`, `op`, `temp`; `-page.png` for the whole page in grain mode;
`m1-checks-page.png`, `m1-branch-page.png`; and `spike-last3-sine-<mode>-*.png` from spike 001's
built file for comparison. `report.json` alongside holds the raw run.

## 4. Licences

210 installed packages. Production (what ships in `dist`): react 19.3.1, react-dom 19.3.1,
scheduler 0.28.0, all MIT. Tally of everything installed: MIT 166, Apache-2.0 16, ISC 10,
BSD-2-Clause 8, BSD-3-Clause 3, MIT-0 2, CC0-1.0 1 (mdn-data), CC-BY-4.0 1 (caniuse-lite, data),
BlueOak-1.0.0 1 (minimatch), **MPL-2.0 2 (lightningcss, lightningcss-win32-x64-msvc)**.
`lightningcss` is pulled in by Vite as a build tool; it is not in `dist/strata-lab.html` (0 matches).

Sea-level data (verified against `docs/physics-references.md` and the bundled JSON `licence` fields):
- Bintanja & van de Wal (2008), Nature 454, 869-872, doi:10.1038/nature07158; data NOAA NCEI
  doi:10.25921/revb-da37; CC0 1.0. Used for 0 to 3 Ma.
- Miller et al. (2020), Science Advances 6(20) eaaz1346, doi:10.1126/sciadv.aaz1346; data PANGAEA
  doi:10.1594/PANGAEA.923139; CC-BY 4.0 (data set only; the paper's own terms were not checked).
  Used for 3 to 66 Ma. Attribution is present in the app's sea-level credit.

## 5. Geology read

Spike 001 and M1 on the sine are the same section (H at columns 0, 20, 40, 60, 80, 100, 149:
17, 4, 0, -20, -839, -1158, -1319 m in both).

Miocene preset (23 Myr, 400 km, thermal switched on for this read):
- Total section above basement: 1.1 km (3,670 ft) at 0 km, 1.35 km at 30 km, 3.0 km at 65 km, 3.3
  km (10,960 ft) at 100 km, 2.5 km at 150 km, 1.8 km at 300 km. Water depth 1.5 km at 150 km, 3.3 km at 400 km.
- Porosity at the depth of each cell against Sclater & Christie (1980), hydrostatic cells (u/L <
  0.05) only: sand model minus curve +0.008 (0-500 m), +0.015, +0.020, +0.018, +0.011 (2-3 km);
  mud +0.017, +0.042 (500-1000 m), +0.031, +0.028, +0.021. Overpressured cells (u/L >= 0.3, few
  cells) sit 0.06 to 0.09 above the curve, as they should. The model is systematically a little
  more porous than the curve, mud most so at 0.5 to 1 km. Only the 2 km points are tested (limit
  0.02).
- Deepest sand-dominated cell: 3,285 m (10,778 ft), 74.7 C = **166 F**, age 22.95 Ma. Hottest
  cell 80.8 C (177 F), at the 90 km column. That is just above the 70 C cement onset, so cement
  is a small effect in this preset. Max excess pore pressure 11.2 MPa.
- The shelf stays inside the section: shoreline and shelf edge reach 119.5 km of 400 km at most.

Real-curve 3 Myr run, read as a geologist:
- Sea level range -127.5 to +0.6 m, so about 128 m of lowering, 74 steps below -80 m.
- Shoreline: 0.5 to 68.5 km, mean 38 km; in each 100 kyr window it swings 38 km on average and up
  to 67 km, i.e. the whole shelf is flooded and exposed every cycle. Shelf edge 1.5 to 68.5 km.
- Lowstand sand: in steps below -80 m, the sand laid down is 31 % on the shelf (zones measured
  relative to that step's shelf edge), 36 % on the slope, 34 % on the basin floor; sand fraction
  74 %, 32 %, 28 %. At highstand (> -20 m) the shelf holds only 6 % of that interval's sand, the
  slope 40 % and the basin floor 54 %. Lowstand versus highstand contrast in where sand goes is
  therefore weak (finding 6).
- Basin-floor sand (65 km and beyond, excluding substrate): 52.2 % on the sine (same as the spike),
  53.3 % on the curve. Seabed slope maximum 6.2 to 6.6 degrees, at 68 to 70 km: plausible for a
  muddy-sandy slope.
- The turbidite share is 60 % of supply at lowstand and 37 % at highstand (141 of 193 highstand
  steps above 10 %).

Things that look implausible or need a decision: findings 5 to 7.

## 6. Findings

BLOCKING: none.

FOLLOW-UP:

1. **MPL-2.0 dev dependency.** `lightningcss` and `lightningcss-win32-x64-msvc` (via Vite) are MPL-2.0.
   The house rule says permissive licences only (MIT, Apache-2, BSD, ISC). It is build-time only and
   absent from `dist`, so nothing shipped is affected, but it breaks the letter of the rule. John to
   decide: accept as a dev-time exception and record it in `docs/decisions.md`, or pin a Vite config
   that does not load it. Related and fine: `caniuse-lite` (CC-BY-4.0) and `mdn-data` (CC0) are data
   used by build tools; `minimatch` is BlueOak-1.0.0 (permissive).
2. **The "no network" check allowlist.** `check:offline` reports 10 URL strings "allowlisted and
   inert" (React and namespace URLs, the DOIs). Passing, but the allowlist lives in
   `scripts/check-offline.mjs`; keep it from growing silently.
3. **Wall-clock test assertions are flaky.** `tests/longruns.test.ts` "miocene runs in under 3 s"
   failed at 3.03 s in M1.8's own run and in my first full run (passed on rerun), and the Miocene run
   in my script took 3.07 s once. In the built app the Miocene run takes 2.3 s. The test limit has
   little margin on this machine under load. Either widen it (say 5 s) or move timing to a
   non-gating script.
4. **Spike README overstates the shoreline shift.** `spikes/001-shelf-to-basin/README.md:31` says the
   -50 m branch moves the shoreline "~5 km" and the shelf edge "~3 km" basinward at highstands. Running
   the spike itself, my measure gives 2.1 km mean, 0.7 km at highstands and 1.95 km at lowstands for
   the shoreline, and 2.3 km for the shelf edge. The "~5 %" basin-floor sand figure is correct
   (5.2 %). M1 matches the spike to the last digit, so M1 is not at fault, and
   `docs/user-guide.md:234` repeats only the 5 % figure. Correct or qualify the spike README, or state
   what measure "5 km" referred to.
5. **Shoreline reaches the landward model boundary on the real curve.** At the highstands of the
   published curve the shoreline is found at column 0 (0.5 km) in 2 of 400 steps, and at highstand
   the "shelf edge" sits a median 2 km from the shoreline (min 0, max 58). A 128 m sea-level cycle
   on a shelf of this gradient floods the whole coastal plain, so the landward boundary is
   shaping the result. This is a model-domain limit, not a bug, but the Section view should say
   so, or the default run should start further landward.
6. **Turbidite routing at highstand on the real curve.** The share routed to the slope is 37 % of
   supply on average at highstand (60 % at lowstand), so sand bypasses the shelf at highstand too:
   94 % of highstand sand lands beyond the shelf edge (40 % slope, 54 % basin floor), against 69 %
   at lowstand. A geologist would expect a clearer lowstand-fan signal. This follows from the tuned
   transport-length rule (`tcMax`, `tcLambda`, `sBreak`, all labelled tuned). A likely cause (not
   tested here) is that the shelf edge is detected as the first steep gradient downstream of the
   shoreline, which puts it close to the shoreline (median 2 km at highstand) whenever the shoreline
   is on the upper slope. Not a physics error as written, but it deserves a stated limit in
   the user guide section 13 and a follow-up card (detect the edge as the rollover of the previous
   highstand shelf, or smooth it in time).
7. **Mud porosity above the published curve at 0.5 to 1.5 km.** Mean +0.03 to +0.04 porosity in
   hydrostatic mud, outside the 0.02 limit that the checks panel applies only at 2 km. Within the
   spread of published mud curves but worth one line in `docs/physics-references.md`, or an added
   panel row at 1 km.
8. **Miocene with temperature on is slower.** 4.1 s in my script with `thermal = 1`, against the 3 s
   target for the preset (default has temperature off, in-app 2.3 s). The Temperature colour mode is
   computed on demand and does not need the switch. Say in the user guide that switching temperature
   and cement on for the 23 Myr preset takes about 4 s on this machine.
9. **Temperature view shows a vertical step at about 110 km (Miocene).** A lithology edge: hotter
   mud-rich section next to cooler sand-rich section in the 1D steady-state conduction. Expected
   from the method (documented limit), cosmetic only.
10. **Bundling error margin.** On the 12 Myr / 5 kyr test with my own deposition rates the surface
    difference was 1.85 m against the 2 m limit, and `docs/physics-references.md` quotes 1.5 m for
    its rates. Fine today, but little headroom if the preset supplies change.
11. **Gap in coverage.** I did not drive Save, Open, autosave or the replace warning through the
    built UI, only the file layer. The M1.7 tests cover the rest.

## 7. Verdict

Physics checks come from independent references and agree: Gibson to 1.4e-4 against 1e-3, parity
with spike 001 exact, mass balance to 1e-16 on all runs including 66 Myr, determinism bit for bit,
cement and conduction and thermal subsidence matching hand calculations, offline and licences clean
for everything that ships. The 2 Ma experiment agrees with the spike to the digit. No finding blocks.

VERDICT: APPROVE
