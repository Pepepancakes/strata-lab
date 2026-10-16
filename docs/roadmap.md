# Strata Lab roadmap

**Status (2026-10-16):** spikes 001 and 002 done and reviewed by John; spike 003 (S3, passive diapirs) is built and waits for John's answers. M1 and M2 are done and on main (M2 merged 2026-10-15 after review M2.11 APPROVE and John's checks, D16). Linux CI tolerances (D16.4) merged 2026-10-15. Now: M3 salt is built and fixed through M3.11 (chain `strata-lab/m3-01-salt-flow` to `m3-11-docs-d18`), NOT on main; it waits for John's judgement of the Gulf-style preset (D17, D18, D19). Next after M3: M3b passive diapirs, then M4.
Each milestone has a fixed "Done when". Anything beyond it goes to the Backlog, which keeps
polishing from running on forever.

**Order:** John ranked the candidate features, 2026-10-14:
1. slope failure / MTDs
2. salt
3. well-planning outputs
4. growth faults
5. 3D
6. real sea-level curves

The plan keeps that order with two changes (see `docs/decisions.md`, D3):
- Real sea-level curves move into M1, because they are small and the MTD and lowstand work
  needs them.
- Salt gets a throwaway spike before M1. Salt decides what the layer record must hold, and that
  record is what M1 fixes in place.

## S1 — Spike 001: shelf-to-basin  *(done 2026-10-14)*
`spikes/001-shelf-to-basin/`: a single HTML file. Physics checks: `node test.js`.
2D two-grain-size transport, turbidite routing, subsidence, compaction coupled to pore pressure,
rewind, branches, pseudo-well.
Results:
- Gibson within 0.0001.
- Sclater & Christie within 0.02.
- Mass balance holds to 1e-14 for each grain size.
- A 3 Myr run takes about 1.5 s; scrubbing has a median of 24 ms.
- Replay is bit-identical.

John: "one of the coolest things I've ever played with when it comes to geology". He found the
geology convincing, with nothing obviously wrong, and said go for a core project.

## S2 — Spike 002: salt under the prograding wedge  *(built 2026-10-14; John reviewed it the same day: "very impressed")*
Question: can salt flow in the column model, interactively, and does it look like Gulf salt?
- A salt layer at the base of each column. It flows sideways as a viscous channel (thin-sheet
  / lubrication approximation), driven by differences in overburden load and seafloor
  relief. The sediment columns above sink or rise as salt leaves or arrives.
- Should show: minibasins sinking under the thickest sediment, salt pushed basinward ahead of
  the wedge, welds where salt runs out, passive diapirs where salt reaches the seafloor.
- Out of scope: salt spreading over younger sediment (canopies and sheets), dissolution,
  faults over salt.

**Done when:**
- Salt volume is conserved to rounding.
- Salt flux matches the analytic viscous channel-flow solution for an imposed load step.
- A 3 Myr run still takes under 5 s.
- John says it looks like Gulf salt, or names what's wrong.

The spike also produces a recommendation on what the M1 layer record must hold for salt.

**Result (2026-10-14, `spikes/002-salt/README.md`):** the checks pass. Flow is within 0.06–0.9 % of
lubrication theory, the load-step flux within 0.02 % of the hand calculation, salt is conserved to
5e-16, and a 3 Myr run takes ~2 s. Expulsion ahead of the wedge works. Diapir width is set by the
grid, because thin-sheet flow under a heavy cover has no width selection. So M3 needs cover
bending stiffness (recommended) or a 2D Stokes solver. Record recommendation: units per column
tagged sediment/salt, so canopies stay storable later.

## M1 — Foundation  *(after S2; cards for John's approval first)*
Rebuild the engine and app as maintained code:
- Scaffold: TS / Vite / React, `npm run check`, CI, offline single-file build.
- Engine in a Web Worker, with the layer record shaped by S2: an ordered list of units per
  column, each tagged sediment or salt (salt can be off). Salt-only balance is in the checks.
- Processes from spike 001, ported test-first.
- Permanent physics check suite: Gibson, Sclater & Christie, mass balance per grain size,
  determinism.
- Time machine: snapshots, scrubber, play, branches, compare.
- Parameter registry with sources shown next to each control (ⓘ), and "tuned" labels.
- **Real sea-level curves:** a published Plio-Pleistocene eustatic curve as the default, plus
  the sine option for teaching.
- Scenario save/open (file), autosave.
- Views from the spike: section by grain size / age / porosity / overpressure, pseudo-well,
  sea-level chart, mass-balance panel.

**Done when:**
- The new app reproduces spike 001's checks and its 2 Ma branch experiment.
- A 3 Myr run finishes in under 3 s without freezing the page.
- Every slider shows its source or "tuned".
- A saved scenario reopens with identical results.

**Cards (approved by John 2026-10-14, running).** A stacked chain: each card merges
the previous card's branch, and nothing reaches main until John approves the tip.
| Card | Who | What |
|---|---|---|
| M1.1 | coder | Scaffold: TS/Vite/React/Vitest, lint rules that keep the engine pure, CI, one offline HTML file, engine worker inside it |
| M1.2 | coder | Layer record (units tagged sediment/salt, per spike 002), parameter registry with sources, sea-level interface, determinism harness |
| M1.3 | coder | Port spike 001 physics test-first; must match spike 001's output column by column (golden file) |
| M1.4 | coder | Published 3 Myr sea-level curve as default (licence checked, cited); sine kept for teaching |
| M1.4b | coder | Long runs: variable time steps, bundled deep compaction, presets (last 3 Myr, Miocene ~23 Myr, Cenozoic 66 Myr) |
| M1.4c | coder | Burial physics: temperature, quartz cement (Walderhaug 1996), thermal-decay subsidence (McKenzie 1978) |
| M1.5 | coder | Worker + time machine: scrub, play, branches, compare; ≤ 25 MB per branch (spike: ~75 MB) |
| M1.6 | frontend-dev | The app: section colour modes, pseudo-well, sea-level chart, balance, checks panel, ⓘ source on every control |
| M1.7 | frontend-dev | Save/open scenario files (recomputed, hash-checked), autosave, warn before replacing work |
| M1.8 | doc-writer | User guide, handover, agent guide, physics references checked against the registry |
| M1.9 | safety-reviewer | Integrity review with its own check script; reruns the 2 Ma experiment in both engines; verdict |

**Picks (accepted with the approval):**
- The default sea level is a published global curve covering 3 Myr. M1.4 chooses it by licence;
  Bintanja & van de Wal (2008) is checked first. If none can be bundled, the card stops and asks.
- Runs can be up to 66 Myr (D12). The default stays the spike's 150 km of 1 km columns over 3 Myr at
  5 kyr steps, and there are Miocene (~23 Myr) and Cenozoic presets. Jurassic-to-present runs come with M3 salt.
- Depths are in ft and pressures in ppg; horizontal distance is in km. A metric toggle stays in the Backlog.

## M2 — Slope failure and MTDs
- Slope stability in every slope cell: infinite-slope factor of safety using the excess pore
  pressure from the consolidation solver.
- Failure removes the unstable package and runs it out downslope as a debris flow, using a
  published run-out rule.
- MTDs are their own deposit type in every view.
- Triggers come from the physics (oversteepening, overpressure, rapid loading, sea-level fall),
  not from a button.

**Cards (written 2026-10-14; start after M1 is on main, D13):**
| Card | Who | What |
|---|---|---|
| M2.1 | coder | Infinite-slope factor of safety from the model's own pore pressure |
| M2.2 | coder | Failure, debris-flow run-out (BING-style Bingham, or a cited H/L rule), MTD deposit; mass conserved |
| M2.3 | coder | Triggers come from the physics and are tagged by cause; an MTD-prone preset; speed budget |
| M2.4 | frontend-dev | MTD texture in every view, a factor-of-safety colour mode, an event list, MTDs in the pseudo-well |
| M2.5 | doc-writer | User guide, references, handover |
| M2.6 | safety-reviewer | Integrity review with its own checks; verdict |

**Done when:**
- Factor of safety matches an infinite-slope hand calculation.
- Mass is conserved through failures.
- With low mud permeability and high supply, MTDs come off the overpressured upper slope, and
  John judges where and when they happen.

**Status (2026-10-15): DONE and on main.** Reviews: M2.6 request changes, fixes M2.7 (engine) and
M2.8 (UI and docs), M2.9 request changes (speed docs), fix M2.10, M2.11 APPROVE. The canvas-scaling
fix (`strata-lab/m2-12-canvas-fix`) is included. John's 10 preview checks all pass, including his
judgement of where and when the MTDs happen (D16). Merged to main with 292 tests passing, build,
offline check and built-file check green. Follow-up: Linux CI tolerances (D16.4).
Results (`npm run check`: 262 passed, 1 skipped at M2.4; build and offline check pass):
- Factor of safety matches the infinite-slope hand calculations to 1e-9 (`tests/stability.test.ts`).
  Default run: minimum FS 4.08 at km 70.5, 905 ft below the seafloor.
- Mass is conserved per grain size through failures (`tests/failure.test.ts`); the Bingham run-out
  matches its uniform-flow solution within 1 % (`tests/runout.test.ts`).
- The preset *Overpressured slope (MTD-prone)* gives 24 events in Node and 37 in the built app in
  Chrome (D14: event lists differ between runtimes). After M2.7 the tag is the dominant term: rapid
  loading and oversteepening, none lowstand (M2.3 had 32 of 33 lowstand). **John still has to judge**
  whether places and times look right.
- **The 15 % speed budget of M2.3 is still MISSED** except on `last3`, with failure on (M2.10,
  five paired runs, best-of-5 against best-of-5): `last3` +11 % (met), Miocene +48 % (runs +20 to
  73 %), Cenozoic +45 % (runs +17 to 52 %), MTD-prone preset +20 % (runs +16 to 31 %). Every preset
  finishes in under 5 s. M2.7 had made it about double (Miocene +88 to 125 %, Cenozoic +185 to 197 %) through a
  full-record scan every step; M2.10 removed that scan when no MTD exists.
- Results are identical on one runtime and rewind is bit-exact, but event lists can differ between
  Node, Chrome and Linux. Test strategy decided (D16.4): tolerances and summary statistics across
  machines, exact equality on one machine.
- The Physics checks panel has five M2 rows (M2.8); the event list shows all three cause terms,
  stalled and window-limited flags and the unresolved-column count. Friction angle and cohesion are "to verify"; the run-out
  parameters are tuned and the Imran et al. (2001) form is unchecked against the paper.
- Limits: 2D infinite slope (no rotational slumps, no 3D), no earthquakes, no gentle-slope failures
  (under 0.5 deg).
- Kept as is (D16.5): the cause-label rule and the slope strength defaults, labelled tuned / to verify.

## M3 — Salt
Spike 002 built into the engine as maintained code: minibasins, welds, passive diapirs, and salt
in all views and in the pseudo-well (density, no porosity, pressure across salt). Adds cover
bending stiffness to the thin-sheet flow, so diapir width comes from physics, not the grid
(spike 002 finding). Approach approved by John 2026-10-15 (D17).

**Cards (written 2026-10-15, D17; stacked chain, branches `strata-lab/m3-NN-<slug>`):**
| Card | Who | What |
|---|---|---|
| M3.1 | coder | Salt flow in the engine: spike 002 thin-sheet flow ported test-first, off by default, salt conserved |
| M3.2 | coder | Cover bending stiffness: dispersion-relation benchmark, diapir width converges with grid size |
| M3.3 | coder | Welds, and salt in the burial physics (load, no pores, seal, conductivity) |
| M3.4 | coder | Gulf-style preset from 66 Ma (prograding wedge over autochthonous salt); speed budget |
| M3.5 | frontend-dev | Salt in every view: section, salt-thickness mode, welds, pseudo-well, checks panel |
| M3.6 | doc-writer | User guide, references, handover |
| M3.7 | safety-reviewer | Integrity review with its own checks; verdict |
| M3.8 | coder | Gulf preset retuned to the relaxed D18 targets; short salt preset; leftovers (10 km table, speed) |
| M3.9 | safety-reviewer | Re-review (REQUEST CHANGES: D18 missing, S3/M3b missing, handover stale, salt piled at the edge) |
| M3.10 | coder | Basinward limit of the salt basin, no-pile tests, serial wall-clock test project (D19) |
| M3.11 | doc-writer | D18 and D19 recorded; S3 and M3b in the roadmap; handover and user guide brought up to date |

**Done when** (rewritten 2026-10-15 to the relaxed Gulf targets, D18; the first version asked for a weld
under 10 m and a crest within 1 km of the seafloor):
- The channel-flow benchmark passes.
- Salt is conserved.
- Diapir width converges as the grid is refined (1,000 / 500 / 250 m cells).
- A Gulf-style example (a prograding wedge over autochthonous salt, `saltVisc` 1e18, starting at 66 Ma) shows:
  - at least one weld run of 2 km or more (salt under 100 m) under the shelf or the pinch-out ramp the wedge crossed;
  - at least two salt crests within 2 km of the seafloor that are not edge artifacts (20 km or more from the
    section edge and the salt edges);
  - a wedge that keeps prograding;
  - spacing of the structures within 15 % at 1,000 and 500 m cells.
- Diapirs that reach and stay at the seafloor are NOT in M3: they are S3 and M3b (D18).

Canopies and sheets need a different solver (salt spreading over the seafloor). See the Backlog.

**Status (2026-10-16): built through M3.11 on the chain `strata-lab/m3-01-salt-flow` to `m3-11-docs-d18`; NOT on main.** Waiting
for John. The M3.7 review approved the chain, John relaxed the Gulf targets (D18), the M3.9 re-review asked for changes, and John chose to
fix the basinward edge (D19, M3.10). Windows `npm run check` at M3.10: 37 files, 431 tests passed, 2 skipped; Linux (CI=true, WSL): wall-clock
project 81 passed, 7 skipped (the extra skips are the wall-clock tests); build, offline check and built-file check pass. Salt is off by default
and the M1/M2 fixtures and state hashes are unchanged.
Results against the done-when:
- **Channel-flow benchmark: passes.** Thin-sheet decay within 1 % of linear theory (25 to 200 km wavelengths, eta 1e17 and 1e18; worst
  -0.57 % at 25 km), load-step flux within 0.02 % of the hand calculation (`tests/salt.test.ts`). Three M3 rows in the checks panel.
- **Salt conserved: passes.** Salt-only balance to rounding (3e-14 relative over the 66 Myr Gulf run, 5.8e-15 at M3.9); the weld
  limiter keeps salt at or above 0 with nothing clipped (`saltClip` 0).
- **Diapir width converges with the grid: passes for the linear stage.** Roof wavelength, mean of three seeds, with bending on (cover 1e19 Pa s):
  9.92 km at 1,000 m cells, 10.12 km at 500 m, 9.97 km at 250 m, against lambda* = 10.24 km; with bending off 2.47, 1.34 and 0.77 km (2 to 3 cells,
  following the grid). On the Gulf preset itself the wavelength agrees within 1.3 % (200 km section, 1,000 against 500 m); counts and spacing of
  structures do NOT converge with the grid (spacing differs 9 to 12 %, counts 4 against 5). The finite-amplitude needle is reported, not tested.
- **Gulf-style preset (D18 targets), after M3.10:**
  - **Weld: met, but not robust.** Welds (salt under 100 m, thicker before) total 17 km in the plain run and 12 to 20 km across six 1 ulp
    noise salts; the longest run is 3 to 4 km. Their positions move with the last digit of the maths, so the tests ask for a band (total 8 km or
    more, a run of 2 km or more) and not for particular welds.
  - **Crests: met by the letter only.** 5 crests (2 to 5 across the noise salts) lie within 2 km of the seafloor and 20 km or more from the edges,
    at 286 to 323 km, but the shallowest has 4,243 ft (1.3 km) of cover. They are ripples of 300 to 850 m on a flat salt slab 5 km thick, not
    diapirs.
  - **Wedge: progrades** (shoreline 54.5 km at 56 Ma, 212.5 km at 0.6 Ma at M3.9).
  - **Basinward edge fixed (D19).** At M3.9 salt piled 8 to 9 km thick against the closed 400 km edge. The preset now ends the salt basin at
    200/240 km (tuned); the thickest salt beyond 250 km is 5.0 km, the last 20 km hold none.
  - **Speed.** The 66 Myr Gulf run takes 5.0 to 5.1 s in Node; salt-off presets are within 5 % of main (best of three, interleaved).
- Views (M3.5): pink salt in every colour mode, a Salt thickness mode, weld and cover marks with (i) buttons, a salt-aware pseudo-well; checked in the built file at 100, 125 and 150 % scaling with 0 console errors.
- **Two salt presets:** *Gulf-style: wedge over salt (66 Ma)* and *Salt: uneven cover (10 Myr)*. The second is a teaching toy (under 1 s): its section is over-filled and its structures are 1 to 2 cells wide.

**John still has to judge:** (1) whether the Gulf-style preset looks acceptable as a teaching section, given the stated limits (tuned limit at
200/240 km, ripples on a slab, no canopies); (2) whether the tuned cover viscosity is acceptable as the control on structure width; (3) whether
M3 can go to main with passive diapirs left for M3b. Nothing merges without him (D6, D17.6).
Limits: no canopies, columns fixed in x, no dissolution, no faults over salt, viscous-cover approximation, runs start at 66 Ma at the earliest (D17.4).

## S3 — Spike 003: diapirs that reach the seafloor  *(built 2026-10-16; code on the branch `strata-lab/s3-passive-diapir`, `spikes/003-passive-diapir/`; not on main)*
Question (D18): can a salt crest reach the seafloor and stay there while sediment piles up around it, with salt and sediment conserved,
benchmarked against a hand calculation?
- Built: exposed salt with sediment bypass (sediment landing on a column with no roof goes to the lower neighbours), roof thinning, power-law
  salt, cover bending and the weld limiter ported from M3, and a controlled test mode. All options are off by default.
- **Result in plain words:** the machinery works when salt is fed in by hand. With a prescribed feed, the crest stays at the seafloor exactly when
  it rises at least as fast as the sediment around it builds up, matching the closed form to under 0.2 % (11 runs), with salt, sand and mud
  conserved to 1e-12 or better. On its own, in the Gulf preset values, exposed salt is buried again within a few Myr (about 3 Myr or less):
  thin-sheet flow drains a column as fast as sediment loads it, so no column gets a lasting supply. Nothing persisted to the end of a run.
- Making passive diapirs appear on their own needs a source of salt that keeps up (power-law weakening or a deeper source layer).
- **Open questions, waiting on John:** (1) is a transient, prescribed-feed passive diapir enough, or should the next card add a salt source that
  keeps up? (2) should exposed salt dissolve (a rate-limited loss to seawater; it would have to be booked as a sink in the salt balance)?
  (3) bypass splits sediment equally between the two lower sides; real sediment follows the slope (a small change); (4) roof thinning is a tuned
  rule, not physics.

## M3b — Passive diapirs and thinner welds  *(after M3 and S3, before M4; scope to be set from S3 and John's answers)*
Build S3's approach into the engine, as maintained code and test-first, so that the Gulf preset shows crests that reach and stay at the seafloor
and welds that thin closer to zero than the 100 m label of D18.
- Scope is NOT fixed yet. It depends on John's answers to the S3 questions (feed or a salt source that keeps up; dissolution).
- Salt, sand and mud stay conserved separately; salt stays off by default; the M1/M2 fixtures stay unchanged.

**Done when (proposed, to be confirmed when the scope is set):**
- The exposed-crest rule matches a hand calculation (as S3 result 1).
- Salt, sand and mud are conserved.
- The Gulf preset shows at least two crests at the seafloor at the end of the run, not edge artifacts, and the wedge still progrades.
- John says the picture reads as passive diapirs, or names what is wrong.

## M4 — Well-planning outputs
- A planned well (vertical or deviated) through the section.
- Along the well: pore pressure, overburden, fracture gradient (Eaton 1969 / Matthews & Kelly
  1967) and the mud-weight window in ppg against TVDSS.
- The same well across branches, to compare scenarios.
- PNG and CSV export.

**Done when:**
- Fracture gradient matches a hand calculation.
- John says the plot reads like a pre-drill pressure prediction.

## M5 — Growth faults
Listric normal faults that start and grow under loading over mobile shale or salt, with
hanging-wall rollover and thicker growth strata. Columns must be able to move sideways, which is
a large engine change, so this milestone opens with its own spike.

## M6 — 3D
A 3D version on the GPU (WebGPU). Opens with a spike on speed.

## Backlog
- Salt canopies and allochthonous sheets (salt flowing over the seafloor like a glacier).
- Jurassic-to-present runs (salt deposition onward; D12, moved here by D17): needs a
  redistributable pre-Cenozoic sea-level curve.
- More published sea-level curves, and tectonic tilt or flexure.
- Calibration: compare against published Gulf of America shelf-margin progradation rates,
  published pressure-depth profiles, and other forward models (for example, Landlab components).
- Review by a stratigraphic forward-modelling specialist once M2 or M3 exist.
- Teaching mode: guided scenarios ("why did this sand get here?").
- Export a section to geoblock.
- Metric/oilfield units toggle.
- **Grow beyond one HTML file** (John, D9): a private hosted web page with a login, and/or an
  installable desktop app. The likely triggers are big bundled data, saving straight to folders,
  3D needs (M6), or sharing with others. M1 keeps `src/` free of single-file-only assumptions,
  so this is a build change rather than a rewrite.
