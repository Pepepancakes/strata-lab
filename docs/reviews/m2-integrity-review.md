# M2 integrity review (card M2.6)

Reviewer: safety-reviewer profile (integrity role). Branch `strata-lab/m2-06-review`, on top of
`strata-lab/m2-05-docs` (3e508c8), which stacks M2.1 to M2.4. Review only: no file under `src/`,
`tests/` or the author docs was changed. Added: `scripts/review/m2-review.mjs`,
`scripts/review/m2-browser.mjs`, `docs/reviews/m2-review-*`, `docs/screenshots/m2-06-review/`.

Expected values come from code in the review scripts: the infinite-slope equation, a column-by-column
re-implementation of the stability search, a numerical integral of the Bingham shear profile, the
closed-form Nye profile for a Bingham slump, mass sums rebuilt from the raw record arrays, and the
M1 engine run from `git archive main`. The M2 engine is only run, never asked for its own expected
value. 47 of 54 script checks pass. Five of the seven failures are deliberate probes I added after
looking at the events (findings 1 to 3); one is the speed budget (finding 5); one is a licence
(finding 8, the same as M1).

## Verdict: REQUEST CHANGES

The physics core is sound: factor of safety, run-out and mass balance all check out against
independent references, and with failure off M2 is bit-identical to M1 on main. What is not
acceptable as it stands is what the product shows John: the cause label on events says almost
nothing (finding 1), a third of the events are no-ops (finding 2), and a run gives a different
event list in Chrome than in Node (finding 4). Findings 1, 2 and 4 need a decision or a fix before merge.
Details and file:line items in section 4.

## 1. Gates

| Gate | Result |
|---|---|
| `npm run check` | typecheck, lint, 24 files, 262 passed, 1 skipped, 0 failed (after I fixed lint in my own scripts) |
| `npm run build` | ok, `dist/strata-lab.html` |
| `npm run check:offline` | ok: 10 URL strings, all allowlisted and inert, 0 external hosts |
| built file in headless Chrome 155 (`m2-browser.mjs`) | 0 console errors, 0 non-local requests, 21 screenshots |

## 2. Independent checks that pass

### Factor of safety: PASS
- `infiniteSlopeFS` equals the hand formula FS = tan(phi)/tan(beta) (1 - ru) + c/(L sin(beta) cos(beta))
  in 7 cases (worst relative difference 2.9e-16); FS crosses 1 exactly at ru = 1 - tan(beta)/tan(phi)
  (0.7746 for 6 degrees and 25 degrees); flat seafloor gives Infinity; u above the load clips to zero effective stress.
- My own search over the raw record (sand, mud, u, H, material) equals `computeStability` in 1405 finite
  columns across 40+ steps, including 22 columns with FS < 1: worst relative difference 4.4e-16, same
  critical layer in every column. One input is shared, the engine's cell thickness (`cellBulk`); that is
  covered by the M1 checks.
- The in-run pore pressure is the model's own `u`, not an input: the FS drop with ru is consistent.

### Run-out: PASS
- Depth-mean Bingham velocity against my numerical integral of the shear profile: 5 cases, worst 7.7e-9.
- Steady uniform flow on 3 degrees, 8 m, tau_y 500 Pa: block velocity 6.5047 m/s against 6.5049 m/s from
  the integral; bed stress 3183.1 Pa against rho' g h sin(theta) = 3183.2 Pa.
- A layer 0.9 times the plug thickness (h_p = 1.26 m) does not move (0.00 m); 3 times h_p flows.
- 2D slump on a flat bed against the closed-form profile h^2 = 2 tau_y s/(rho' g): final length 5965 m
  against 6027 m with 40 blocks (ratio 0.990) and 5953 m with 80 (0.988); it stops. A 1 % low bias that
  does not shrink with more blocks is the finite-difference front, small, and not a concern at this level.

### Mass balance through failure: PASS
- Sand and mud summed separately from the raw arrays before and after every failure step: the change equals
  minus what the ledger says left the section, error 0 (to double precision) in all 11 failure steps of the
  MTD preset and all 42 of a weakened variant (166 events). Control: failures moved 1.19e6 and 2.36e6 m^2
  of solids sideways, so the zero is not a no-op.
- Per event, released = deposited + exported (5.8e-16). Whole run: stored + out = initial + supply x time,
  sand and mud separately, residual 1e-16 or smaller in all three runs.
- Note: in these runs every event exports 0 %: debris never leaves the 150 km section. The export path is
  therefore untested by the presets (the repo's unit tests cover it; I did not re-derive that).

### Determinism within one runtime: PASS
- Second straight run repeats bit for bit (record bytes plus events) at 45 steps.
- 45 random forward/backward seeks of the time machine, including every event step and both neighbours:
  record hash equals the straight run, and the event list at each seek equals the straight run's events up
  to that step (0 mismatches). A snapshot taken three steps before an event step restores and replays bit-identically.
- No `Math.random`, `Date.now`, `performance.now` or `new Date` in `src/engine` (comments stripped).

### Parity with failure off: PASS
- Registry default `failOn` is 0. Spike 001 against M2 (sine curve): difference 0 in height, solids and u.
- Final record sha256 of `last3` and `miocene`, M1 from `git archive main` against M2 with failure off:
  identical (4e437221a1c4de32, 27b6f1bfaa233f1c).

### Built app: PASS with notes
- All six colour modes draw on the MTD preset (non-blank, 42 to 150 distinct colours), FS legend and
  hatching legend present. Clicking each of the 30 events moved the time slider to the event's step and
  selected the right row (0 mismatches). The pseudo-well shows an MTD interval. The failure toggle is off by default
  and the empty-state message is honest. Every one of the 62 registry controls carries a source tag
  (cited 9, tuned 48, to verify 5); `phiFric` and `cohesion` are "to verify".
- The default preset with failure on gives 0 events (lowest FS ever 2.33), which fits the MTD-prone
  preset being the one that fails.
- The physics checks panel passes 8 of 8 on both presets, but all 8 are M1 checks (Gibson, porosity, mass
  balance). Nothing in the panel benchmarks the factor of safety or run-out (finding 7).

## 3. What the MTD preset does geologically

33 events in 11 steps in Node (table in `docs/reviews/m2-review-results.json`, `geology.event table`).
- Where: all 11 first-failures seed within 1 km of the shelf edge, at the highest or second-highest
  excess-pressure column of the 23 to 36 searched; ru at the seed 0.72 to 0.94, slope 2.0 to 8.1 degrees.
  Slope failure at the shelf edge on an overpressured, quickly loaded margin is the right place and the right mechanism.
- Size: scars 45 to 977 ft (median 188 ft), volumes 0.01 to 0.32 km^2, run-out 0 to 15.5 km. Comparable to
  the small end of published MTDs; nothing here is wrong in kind. The upper end hits the search window (finding 3).
- Timing: events cluster at lowstands (2.07, 0.87, 0.72, 0.64 Ma and later), which is the usual pattern.
  Whether the tag says so for the right reason is finding 1.

## 4. Findings (request changes)

### Finding 1 (MUST FIX or decide): the cause tag is nearly always "lowstand"
`src/engine/triggers.ts:143` tests the sea-level fall first and `params.ts:187` sets `failLowstandDrop`
to 5 m over a 20 kyr window. Sea level falls by 5 m or more over that window in 44 % of all steps
(262 of 600), so 32 of 33 events are tagged lowstand. My re-derivation of the tag from the raw numbers
reproduces the code exactly (11 of 11 first events, numbers to 1e-6), so this is the rule, not a bug.
But 20 of the 32 "lowstand" events have a pressure term larger than the slope term, and 5 had a fall of
less than 10 m. The user sees a cause label that reads as an explanation and is almost constant.
Without the sea-level test the same events split 21 rapid loading / 12 oversteepening. For a product whose
first rule is honesty about what the model knows, a label that cannot discriminate should not be shown as
a cause. Options (John's call): raise the default to something that selects real lowstands (a fraction of
the 40 m amplitude, for example 20 m), make the order "largest term wins", or show all three terms. Either way
the label must not claim more than the numbers support.

### Finding 2 (MUST FIX): failures that move nothing, repeated until the iteration cap
11 of 33 events have run-out under 0.5 km, and 5 consecutive pairs hit the same columns with the same volume
(events 6 to 8 in one step: column 75, 59 ft, 0.018 km^2, run-out 0, three times; also 20 to 22, 32 and 33).
`failure.ts:374` loops to `failMaxIters` = 5; a failure whose debris lands back where it came from leaves FS < 1,
so it is picked again. `failUnresolved` counts 5 steps in the preset (`failure.ts:383`). Likely cause (hypothesis, not
proven): the Bingham layer is below its plug thickness after the scar, so debris stays and the column is
still unstable. The ledger is fine (finding mass balance), but the event list and counts are inflated
by events that are not events, and the unresolved count says the physics is not settling. Suggest: stop
re-failing a column when the last failure there moved nothing, and show unresolved columns instead of repeated events.

### Finding 3 (SHOULD FIX): the stability window cuts the largest scars
Three events have scars of 947 to 977 ft against a 300 m (984 ft) window (`stability.ts:139`, `params.ts:163`).
They are the biggest events and their depth is the window, not the physics. Either say so in the event row
or widen the window; the 300 m default is "tuned".

### Finding 4 (MUST DECIDE): event lists differ between Node and Chrome
The same preset, same parameters, same machine: Node 26.7 gives 33 events (first: 2.070 Ma, column 51, lowstand);
Chrome 155 running the built app gives 30 events (first: 2.485 Ma, column 47). The author's own M2.4 screenshot
report shows the Chrome list, so the app is self-consistent and the docs describe the browser result. This is
D14 (floating-point differences between platforms, amplified by threshold logic) now visible in the
product: failure is a threshold process, so a one-ulp difference in a pore pressure moves an event by whole steps. Rewind is
bit-exact inside one runtime (section 2), which is what the engine promises; "same inputs give identical results"
holds per runtime only. John uses one browser, so day-to-day impact is small, but
tests and golden fixtures that include events will be red on any other platform (as on Linux CI), and a
shared project file can show a different event list on another machine. Needs John's decision on how to word and
test this (compare summary statistics, not event identity, across platforms).

### Finding 5 (docs honesty): speed budget missed on long presets
Failure on costs 37 to 55 % extra on `miocene` and 47 to 75 % on `cenozoic` (three runs; timing noise is large on this
machine, `last3` and `mtd` read between -7 % and +18 %) against the 15 % budget of M2.3. Every preset still
finishes in about 5 s, so it is a budget miss, not a usability problem. The handover should say so with the numbers.

### Finding 6 (minor): one MTD-tagged cell has no sediment
1 of 80 MTD cells (17 of 207 in the weakened run) hold zero sediment after later erosion but keep the MTD tag.
Harmless for mass; drawing and the pseudo-well should not paint zero-thickness cells (they cannot show).

### Finding 7 (SHOULD FIX): no M2 benchmark in the in-app checks panel
`Physics checks` runs 8 checks, all from M1. M2's rule is that every solver is benchmarked; the hand calculations
and the Bingham slump I used here would fit as panel rows, so John can see them without a developer.

### Finding 8 (carried over from M1.9): MPL-2.0 dev dependency
`lightningcss` and `lightningcss-win32-x64-msvc` (via Vite) are MPL-2.0 and not in the built file (0 matches).
M2 adds no dependency: package.json and the lockfile are identical to main. John accepted this in M1; no new action.

## 5. Not checked

- Export of debris out of the section (no preset reaches it).
- Cross-platform behaviour beyond Node-versus-Chrome on this machine; Linux was not run.
- Whether the parameter values `runYield` 5000 Pa, `runViscosity` 1000 Pa s, `mtdPhiMud` 0.55 match the cited
  sources; I checked the tags exist (tuned) but did not re-read the papers.
- The `cenozoic` preset with failure on produces 0 events, so its failure path is untested end to end.

## 6. Reproduce

```
npm ci && npm run build
node scripts/review/m2-review.mjs [fs runout balance determinism parity speed geology licences]
node scripts/review/m2-browser.mjs
```
Results: `docs/reviews/m2-review-results.json`, `docs/reviews/m2-review-output.log`,
`docs/screenshots/m2-06-review/report.json`.
