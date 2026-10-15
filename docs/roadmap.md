# Strata Lab roadmap

**Status (2026-10-14):** spikes 001 and 002 done and reviewed by John. M1 is done and on main (merged 2026-10-15, review M1.9 APPROVE). M2 (slope failure and MTDs) is built and under review, not on main. Open: the Linux CI run is red (floating-point results differ from Windows; see docs/decisions.md D14).
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

**Status (2026-10-15): built, under review.** M2.1 to M2.4 are built on the stacked branches
`strata-lab/m2-01-stability` to `m2-04-views`, M2.5 (docs) on `m2-05-docs`. Nothing is on main yet.
Results so far (`npm run check`: 262 passed, 1 skipped at M2.4; build and offline check pass):
- Factor of safety matches the infinite-slope hand calculations to 1e-9 (`tests/stability.test.ts`).
  Default run: minimum FS 4.08 at km 70.5, 905 ft below the seafloor.
- Mass is conserved per grain size through failures (`tests/failure.test.ts`); the Bingham run-out
  matches its uniform-flow solution within 1 % (`tests/runout.test.ts`).
- The preset *Overpressured slope (MTD-prone)* gives 30 events (km 47 to 95, run-outs up to 17 km),
  25 tagged lowstand and 5 rapid loading. **John still has to judge** whether places and times look right.
- Open: failure on costs +9 % (3 Myr), +38 % (Miocene), +45 % (Cenozoic) run time, over the 15 %
  budget for the two long presets. Friction angle and cohesion are "to verify"; the run-out
  parameters are tuned and the Imran et al. (2001) form is unchecked against the paper.
- Limits: 2D infinite slope (no rotational slumps, no 3D), no earthquakes, no gentle-slope failures
  (under 0.5 deg).
- Still to do: M2.6 integrity review, then John's decision to merge.

## M3 — Salt
Spike 002 built into the engine as maintained code: minibasins, welds, passive diapirs, and salt
in all views and in the pseudo-well (density, no porosity, pressure across salt). Adds cover
bending stiffness to the thin-sheet flow, so diapir width comes from physics, not the grid
(spike 002 finding). John decides this approach before M3 cards are written.

**Done when:**
- The channel-flow benchmark passes.
- Salt is conserved.
- Diapir width converges as the grid is refined (1,000 / 500 / 250 m cells).
- A Gulf-style example (a prograding wedge over autochthonous salt) builds minibasins and welds
  that John recognises.

Canopies and sheets need a different solver (salt spreading over the seafloor). See the Backlog.

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
