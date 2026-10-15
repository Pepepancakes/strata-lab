# M2 integrity re-review, round 3 (M2.11)

Reviewer: safety-reviewer (independent). Branch `strata-lab/m2-11-rereview`, after `git merge strata-lab/m2-10-fix-speed` (tip b105c9f).
I changed nothing under `src/` or `tests/`. Main has not moved (still f373e71, M1 merged).

## 1. Verdict summary

APPROVE. B1 from round 2 is fixed (the full-record scan is gone when no MTD exists) and the speed docs are now honest.
Nothing regressed. The 15 % budget is still missed on three of four presets; that is stated plainly and is not a blocker.

## 2. B1: speed numbers and the clearEmptyMtd cost

Measured myself with `node scripts/review/m2-speed.mjs 2` (2 paired runs each) and, independently, the speed section of `m2-review.mjs` (1 run):

| preset | my runs, paired overhead | my best-of-2 | docs: best-of-5 | docs: run range |
|---|---|---|---|---|
| last3 | +8 / +20 %, review script +11 % | +8 % | +11 % | +3 to +22 % |
| miocene | +39 / +57 %, script +39 % | +55 % | +48 % | +20 to +73 % |
| cenozoic | +36 / +52 %, script +43 % | +41 % | +45 % | +17 to +52 % |
| mtd | +15 / +22 %, script +26 % | +22 % | +20 % | +16 to +31 % |

Absolute times (on vs off): miocene 3.4 s vs 2.2 to 2.4 s, cenozoic 3.9 to 4.3 s vs 2.8 to 2.9 s, mtd 2.0 to 2.1 s vs 1.6 to 1.8 s. Every one of my numbers sits inside the ranges
printed in `docs/handover.md:67`, `docs/roadmap.md:141-145` and `docs/user-guide.md:534-538`, except one paired mtd run at +15 % (a point under the +16 % lower bound; noise).
The docs are honest.

- The false sentence is gone. The M2.7 statement now reads as history (M2.7 made it about double, M2.10 removed the scan), which matches round 2 (Miocene +88 to 125 %, Cenozoic +185 to 197 %).
- The budget miss is stated in all three docs ("met only on last3"). Per the card, a missed budget stated honestly is not a blocker.
- Code: `src/engine/failure.ts:417` now reads `if (eng.diag.mtdPresent) eng.diag.mtdPresent = clearEmptyMtd(eng.rec) ? 1 : 0`. The flag lives in `Diagnostics`, so snapshots and keyframes copy it.
  Cheap and rewind-safe in principle; the rewind checks below confirm it.

## 3. Behaviour unchanged by the scan skip

| check | result |
|---|---|
| MTD-prone preset events | 24 events, 10 steps with events, 4 unresolved (same as round 2) |
| failure-on state hash (mtd) | 9be1b3f383e0bb5e, same in the M2.10 before-run |
| failure-off hash (mtd) | 241d5678c435faf5 |
| mass balance per grain size, every failure step, raw arrays | sand 0.00e+0, mud 0.00e+0 (also the weak sand+mud run) |
| released = deposited + exported, per event | 2.19e-16 and 4.28e-16 |
| whole-run balance, sand and mud separately | 3.3e-17 / 7.8e-17 |
| rewind: 42 random seeks, record hash and event list | 0 mismatches; final hash 9be1b3f383e0bb5e |
| snapshot before event step 362, restore, replay | bit-identical |
| failure-off parity with M1 on main, last3 | 4e437221a1c4de32 = 4e437221a1c4de32 |
| failure-off parity with M1 on main, miocene | 27b6f1bfaa233f1c = 27b6f1bfaa233f1c |
| presets with no failures (last3, miocene, cenozoic), on vs off | identical hashes cb22255bd39a216a, fa992a56e93157c3, ebd3965bbcc65cca |
| no Math.random / Date.now / performance.now in src/engine | none |

Physics checks (infinite slope, Bingham, Nye slump within 1.2 %, FS crossing) all still pass against my independent references.
`m2-review.mjs`: 57 of 59 checks pass. The two failures are the known ones, neither new: the speed budget on Miocene and Cenozoic (item 2), and `lightningcss` MPL-2.0 (Vite dev dependency, not in the built file; package.json and lock identical to main).

## 4. Should-fix items (non-blocking)

1. UI unresolved count vs engine: documented, not fixed (`docs/user-guide.md` now says the header sums stalled-event columns, 2 in Node, while the engine counts 4 because two steps ended at the `failMaxIters` cap). I reproduce 2 stalled, 3 window-limited, `failUnresolved` 4. Honest.
2. Events at the iteration cap (#14, #24, run-out 0, last in step, not stalled): documented in the handover; my probe shows every sub-0.5 km event is stalled or last in its step, no retries. Acceptable.
3. Lowstand: the note says the label is rarely or never reached at default thresholds; I reproduce 0 of 24 as lowstand while 13 of 24 had a 20 m or larger fall. Honest, label only.

## 5. Gates

- `npm ci`: ok (audit warnings only).
- `npm run check`: typecheck and lint clean, 25 files, 288 passed, 1 skipped.
- `npm run build`: ok (dist/strata-lab.html, 585.85 kB).
- `npm run check:offline`: 10 URL strings, all allowlisted and inert; 0 external hosts.
- Built file in headless Chrome (`m2-browser.mjs`): 0 console errors, 0 external requests (3 requests seen, all local), physics panel 13 of 13 PASS on the default preset, event list and colour modes render; 22 files in `docs/screenshots/m2-11-rereview/`.
- Chrome on the MTD-prone preset: 37 events, 9 stalled, 10 unresolved columns, against 24 / 2 / 4 in Node. This is finding 4 (D14), still open and documented.

## 6. Blocking items

None.

## 7. Open for John

- Finding 4 (D14): how to word and test per-runtime determinism (24 events in Node, 37 in Chrome). Documented honestly; untouched.
- Speed: are Miocene +45 to 55 %, Cenozoic +40 to 45 % and MTD-prone +20 % with failure on acceptable (all runs under 5 s), or should a later card speed up the slope search of every sloping column? Failure is off by default.
- Cause-label knobs: `failSlopeTerm`, `failPressTerm`, `failLowstandDrop` are tuned; lowstand is never chosen at the defaults. Whether to change the thresholds or show a separate "also during a lowstand" flag.
- Whether to flag last-at-cap events (#14, #24) as stalled. That would change the stalled and unresolved counts.
- Whether the UI should show the engine's `failUnresolved` (needs plumbing through the worker), instead of the documented under-count.
- Geological plausibility of places and times of the failures remains his judgement.

## 8. Reproduce

```
npm ci && npm run check && npm run build && npm run check:offline
node scripts/review/m2-review.mjs
node scripts/review/m2-speed.mjs 2
node scripts/review/m2-browser.mjs docs/screenshots/m2-11-rereview
```
Outputs: `docs/reviews/m2-rereview-2-output.log`, `m2-rereview-2-results.json`, `m2-rereview-2-browser.log`, screenshots in `docs/screenshots/m2-11-rereview/`.
Speed numbers are noisy on this machine (tens of percent per single run).

VERDICT: APPROVE
