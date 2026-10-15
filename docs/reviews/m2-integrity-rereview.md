# M2 integrity re-review (card M2.9)

Reviewer: safety-reviewer profile (integrity role). Branch `strata-lab/m2-09-rereview` = `strata-lab/m2-08-fix-ui`
(5779f34, whole M2 stack plus M2.7 and M2.8). Review only: nothing under `src/` or `tests/` was changed.
Added: `docs/reviews/m2-integrity-rereview.md`, `m2-rereview-output.log`, `m2-rereview-results.json`,
`m2-rereview-browser.log`, `docs/screenshots/m2-09-rereview/`; `scripts/review/m2-review.mjs` was updated
(new tag rule, new probes, results now go to `m2-rereview-results.json`; the M2.6 files are untouched).

Expected values come from code in the review scripts (hand formulas, a column-by-column search rebuilt from the raw
record, a numerical Bingham integral, the closed-form Nye slump, solid sums from the raw arrays, M1 from
`git archive main`). The M2 engine is only run. Script result: 56 of 59 checks pass. The three failures are the
speed budget (two checks, blocking item B1 below, because the docs misstate it) and the MPL-2.0 dev dependency
(finding 8, John accepted it in M1, no change).

## Verdict: REQUEST CHANGES (one blocking item, docs only)

Findings 1, 2, 3, 6 and 7 are fixed and re-verified with numbers. Finding 4 is correctly left open for John.
Parity with M1 holds. The one blocker is finding 5: the docs say the speed miss is +37 to 55 % (Miocene) and
+47 to 75 % (Cenozoic), "about 5 s", and "M2.7 did not change the cost of the slope search". After M2.7 the
cost is about double that, and I traced the cause to one line. Fix is small (update the numbers, ideally also
fix the line). Details in B1.

## 1. Results per check

### Finding 1 (cause label): FIXED for correctness; still weak at discriminating (documented, John's knob)
MTD-prone preset, Node 26, 24 events:

| Label | Before (M2.3 rule, 33 events) | After (M2.7 rule, 24 events) |
|---|---|---|
| lowstand | 32 | 0 |
| oversteepening | 1 | 8 |
| rapid loading | 0 | 16 |
| overpressure | 0 | 0 |
| mixed | n/a | 0 |

- Re-derivation: for all 24 events (not only each step's first) I applied the documented rule (term divided by its own
  threshold, largest score at or above 1 wins, ties slope then pressure then sea level, else mixed) to the stored
  terms: 24 of 24 labels match. For the first event of each step, the terms themselves (dSlope, dPress, sea-level
  change) were re-derived from an independent replay of the raw slope and ru: 10 of 10 match to 1e-6 (worst
  difference 0).
- Sample (score = term / threshold): #1 slope 5.7, pressure 19.6, sea 2.4, tag rapid loading; #4 slope 16.5,
  pressure 5.2, sea 0.6, tag oversteepening; #9 slope 9.0, pressure 0.0, sea 1.4, tag oversteepening;
  #6 slope 0.0, pressure 61.5, sea 0.6, tag rapid loading. Each label is what the raw terms support.
- No event is tagged lowstand while the pressure term dominates (0), and lowstand is no longer 32 of 33.
- Does the label discriminate? Two of four labels are used (16/8). Lowstand cannot win on this preset: the sea-level
  score is 0 to 2.4 while the slope and pressure scores are 1.4 to 65; 0 of 24 events have a sea-level score above both
  others, yet 13 of 24 events saw a sea-level fall of 20 m or more over the window. So the label never says
  "lowstand" for events that happened in a lowstand. This is a consequence of putting a 20 m sea-level number and
  two ln-unit terms with 0.1 thresholds on one scale. It is not a bug, and the UI now shows all three terms and the
  rule (i) button, so nothing is claimed that the numbers do not support. `docs/handover.md:69` states it
  honestly. NOT blocking. Note: `src/engine/params.ts` (`failLowstandDrop` note) says "20 m so that only a real
  lowstand qualifies", which is true of qualifying but suggests the label is reachable; see Open for John.

### Finding 2 (no-op failures repeated): FIXED
- Events before: 33 (11 steps, 11 of them with run-out under 0.5 km, 5 consecutive same-column repeats). Events now: 24 in 10 steps.
- Same columns, same volume (within 2 %), same step: 0 repeats (was 5).
- No event with run-out under 0.5 km is followed at once by an event on overlapping columns: 0 (checked every pair in a step).
- After a stalled event, no later event in the same step touches its columns: 0 repeats.
- Stalled events: 2 of 24 (#6, #18). `failUnresolved` = 4 (was 5).
- Mass balance per grain size through every failure step: sand 0, mud 0, all 0 (relative, raw arrays), 10 failure steps,
  1.07e6 m^2 of solids moved sideways (control: not a no-op). Weak-variant preset (173 events, 47 steps): also 0 and 0,
  2.75e6 m^2 moved. Per event, released = deposited + exported: 2.2e-16 (4.3e-16 weak). Whole run stored + out =
  initial + supply x time: 3.3e-17 sand, 7.8e-17 mud.
- Residual gap (SHOULD FIX, not blocking): 4 events still have run-out under 0.5 km (#6, #14, #18, #24). #6 and
  #18 are stalled. #14 and #24 are NOT stalled: each is the fifth (cap, `failMaxIters` 5) event of its step, so the
  engine stops before re-picking the columns and the stall flag is never set. They add to `diag.failUnresolved`
  (`failure.ts` end of `failureStep`, `iter === failMaxIters` line) by 1 each, but the UI cannot see them (see "UI unresolved count").

### Finding 3 and 6 (window-limited, empty MTD cells): FIXED
- `windowLimited` equals (scar at or above 95 % of the 300 m window) for all 24 events: correct. 3 flagged (#5 971 ft,
  #17 947 ft, #22 982 ft = 299.3 m), every event at the window is flagged. The deepest scar is the window, so the
  note "scar depth equals the search window (300 m, tuned)" is accurate; the numbers are lower bounds, as the (i) text says.
- MTD-tagged cells with no sediment in the final record: 0 of 67 (was 1 of 80); 0 of 184 in the weak variant (was 17 of
  207). `clearEmptyMtd` (`failure.ts:417`) does this in the engine; `draw.ts:39-42` also never paints a cell with no sediment
  or no thickness. Mass unaffected (tag only).

### Finding 7 (panel rows): FIXED
Five new rows in the built app (13 of 13 PASS, 513 to 533 ms): infinite-slope FS 2.2183, error 2e-16; FS = 1 at ru =
0.7746, error 2.2e-16, with FS above 1 below and below 1 above; Bingham plug h_p = 3.899 m, error 1.1e-16, a flow 0.9 h_p thick
has velocity 0; sand and mud balance through one failure, error 1.6e-16 each (limit 1e-12).
`src/worker/checksM2.ts` writes the expected values from formulas (blocks (a) to (d): tan/tan, 1 - tan/tan, tau_y/(rho' g sin), solids
summed from the raw arrays); the engine functions are only called for the "got" values. One small weakness: row (d) adds the
engine's own `mtdBalance(events).exported` to the after-sum, so it checks that nothing disappears other than what the event
reports leaving; this is the same ledger the earlier review used and the independent raw-array check in section 3 covers the rest.

### Finding 5 and 4 (docs): finding 5 BLOCKING (B1); finding 4 honest and open
See B1. Finding 4: `docs/handover.md:68` and `docs/user-guide.md` section 14 state the per-runtime determinism limit with the numbers
(Node 24 events, Chrome 37 events), say "Do not write or test the same events on every machine", and say the
test strategy is John's decision and not made here. My run confirms the Chrome numbers: the built app shows
"37 events, 9 stalled; 10 unresolved columns". Rewind is bit-exact inside one runtime (42 random seeks, 0 mismatches; a snapshot three steps before an event restores bit-identically; event list identical after seeks; final hash 9be1b3f383e0bb5e). Not a blocker.

### Parity with failure off: PASS
Failure is off by default (`failOn` 0). Spike 001 against M2: difference 0 in height, solids, u. Final record hash, M1 from
`git archive main` against M2 with failure off: `last3` 4e437221a1c4de32 and `miocene` 27b6f1bfaa233f1c, both identical
to the hashes in the card. `main` has not moved (f373e71, same as the M2.6 review).

### Gates: PASS
- `npm ci` ok. `npm run check`: tsc, eslint (including my edited script), 25 files, 284 passed, 1 skipped, 0 failed.
- `npm run build` ok (dist/index.html 585 kB, single file). `npm run check:offline`: 10 URL strings, all allowlisted and inert, 0 external hosts.
- Built `dist/strata-lab.html` in headless Chrome 155 (`m2-browser.mjs`): 0 console errors, 0 external requests,
  physics checks ALL PASS 13/13 on both presets, all six colour modes draw plus FS, 22 files in `docs/screenshots/m2-09-rereview/`.
- `tests/burial.test.ts` rewind test timeout is 15000 (`tests/burial.test.ts:163`).
- No `Math.random`, `Date.now`, `performance.now`, `new Date` in `src/engine` (0). package.json and package-lock.json identical to main.

## 2. Blocking items

### B1 (BLOCKING, docs): the speed numbers are out of date and the M2.7 statement is wrong
Docs: `docs/handover.md:67` ("`miocene` +37 to +55 %, `cenozoic` +47 to +75 % ... about 5 s ... M2.7 did not change the cost of the slope
search and did not re-measure it"), `docs/roadmap.md:141-142`, `docs/user-guide.md:532-533`.
Measured here, same machine, same script, two A/B runs each (failure-on time in ms, overhead over failure-off):

| Preset | M2.6 tip (a22040e) | M2.8 tip (5779f34), 3 runs | M2.8 tip with `failure.ts:417` commented out (my probe, not committed) |
|---|---|---|---|
| miocene | 3218, 3596 (+35 %, +62 %) | 5077, 4908, 5084 (+94 to +125 %) | 3397, 3320 (+42 %, +42 %) |
| cenozoic | 4290, 4380 (+40 %, +32 %) | 7706, 7931, 6995 (+142 to +175 %) | 4708, 4924 (+72 %, +71 %) |
| last3 | +7 to +22 % | +18 to +31 % | +13 to +15 % |
| mtd (24 events) | +13 to +17 % | +14 to +36 % | +1 to +28 % |

So after M2.7 the Miocene run takes about 5 s and the Cenozoic run 7 to 9 s with failure on (the docs say about 5 s), the extra cost roughly doubled, and
the docs claim M2.7 did not change it. The cause is `clearEmptyMtd(eng.rec)` at `failure.ts:417`, which scans every cell
of the whole record at the end of every failure step even when nothing failed (the cost grows with layers x columns, which is
why the long presets suffer). Hypothesis confirmed by the probe above; the same 24 events and 4 unresolved came out with the call removed.
Required: update the three doc locations with the numbers above (and delete "M2.7 did not change the cost"). Recommended (not
required for APPROVE): run `clearEmptyMtd` only when the record holds an MTD cell or an event occurred this step. That is the author's
call; I changed nothing. If it is fixed, re-measure and say so.

## 3. Should fix / notes (not blocking)

1. UI unresolved count under-reports (`src/views/events/causes.ts:76-80`, used by `src/views/events/index.tsx:39-44`).
   It sums columns in stalled events: Node gives 2, the engine's `failUnresolved` is 4 (the other 2 come from the cap case in
   "Finding 2, residual gap"). `docs/user-guide.md:493` says "2 stalled, 4 unresolved columns" for Node, which is the engine
   number, not what the header would show in Node (2). The M2.8 note that the UI count "matches diag.failUnresolved" is not true in Node.
   Fix either side; Chrome's 10 for 9 stalled events cannot be checked against `diag` from the UI.
2. Two sub-0.5 km events (#14, #24) are neither flagged stalled nor counted in the header, see above. Suggest flagging a last-at-cap
   event that moved under `failStallRunout` as stalled, or stating it.
3. Lowstand unreachable at the default thresholds (finding 1 above): documented; a decision for John.
4. M2.8 explanations quote 'Node 24 events' for tests and 'Chrome 37' for the browser: both reproduced. Good.
5. Edge cases I did not test: export of debris out of the section (no preset reaches it; 0 % exported in all events); the `cenozoic`
   preset with failure on still gives 0 events, so its failure path is untested end to end; 390 px width of the new event rows;
   parameter values against the sources (tags checked, papers not re-read).
6. Finding 8 unchanged: `lightningcss` and its win32 binary are MPL-2.0 dev dependencies (Vite), not in the built file; M2 adds no dependency.

## 4. Open for John

- Finding 4 (D14): how to word and test per-runtime determinism. Options already named in the docs: compare summary statistics
  (event count range, label shares, mass balance) across platforms, not event identity. Not a blocker as long as the docs stay honest, and they are.
- The lowstand label cannot win at the default thresholds, though 13 of 24 events happened with a 20 m or larger fall. Options: a separate
  "also during a lowstand" flag next to the label, a lower `failLowstandDrop`, or scale the three terms to a common unit. Label only, no physics.
- Speed: after B1 is fixed, whether about +40 % (Miocene) and +70 % (Cenozoic) with failure on is acceptable, or whether the M2.3 budget needs a real
  optimisation (the search of every sloping column at every step).

## 5. Reproduce

```
npm ci && npm run build
node scripts/review/m2-review.mjs [fs runout balance determinism parity speed geology licences]
node scripts/review/m2-browser.mjs docs/screenshots/m2-09-rereview
```
Results: `docs/reviews/m2-rereview-results.json`, `m2-rereview-output.log`, `m2-rereview-browser.log`,
`docs/screenshots/m2-09-rereview/report.json`. Speed numbers are noisy on this machine (about 10 to 30 %), but the
before/after difference is far outside the noise.

VERDICT: REQUEST CHANGES
