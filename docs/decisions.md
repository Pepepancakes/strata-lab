# Decisions

Newest at the bottom. Each entry gives the date, the decision, who made it, and why.

## 2026-10-14
- **D1. Strata Lab becomes a core project.** John: "GO!" after spike 001. The months route is
  preferred over quick approximations: "if there are two options, one easy to implement and gets
  mostly what I want vs something that is exactly what I'd like but would take months, I want to
  go the months route."
- **D2. Separate repo from geoblock.** Process-based and kinematic modelling are different
  engines. A link between them is in the backlog.
- **D3. Milestone order.**
  - John's ranking: 1 slope failure/MTDs, 2 salt, 3 well-planning outputs, 4 growth faults,
    5 3D, 6 real sea-level curves. He said he is biased towards salt as a Gulf geologist and
    asked for an independent judgement.
  - Kept his order, with two changes:
    - Real sea-level curves move into M1. They are small, and both MTD triggers and lowstand
      sand delivery depend on them. The sine wave also understates the effect of a sea-level
      fall (spike 001 finding).
    - A throwaway salt spike (S2) runs before M1. Salt is the hardest and least certain
      feature, and it decides what the layer record must hold. Fixing that record in M1
      before testing salt risks a rebuild later.
  - Result: S2 salt spike → M1 foundation → M2 MTDs → M3 salt → M4 well outputs →
    M5 growth faults → M6 3D.
  - Well outputs are small and could move earlier if John wants something for work sooner.
- **D4. Salt approach for S2/M3: thin-sheet (lubrication) viscous flow under the sediment
  columns.** It can produce minibasins, welds and passive diapirs at interactive speed. It
  cannot produce canopies or sheets that spread over younger sediment, which need a different
  solver; those are in the backlog. A full Stokes-flow model (as in research codes) is not
  interactive, so it is out of scope for the live app.
- **D5. Stack: TS strict + Vite + React + Vitest, engine in a Web Worker, canvas sections,
  single-file offline build.** Same as geoblock (recommended pick, accepted with the go).
- **D6. Push rule (same as geoblock).** Worker cards never push or merge to main. The
  orchestrator may commit and push docs and spikes. Card code waits on branches until John
  approves it for main.
- **D7. Validation standard.** "Looks right to John" is necessary but not enough. John says he
  is not a forward-modelling specialist. Every solver needs an exact-solution or hand-calculation
  benchmark, every parameter a citation or a visible "tuned" label, and calibration against
  published numbers is in the backlog. A specialist review is planned once M2 or M3 exist.
- **D8. Units.** The engine works in SI. Anything John reads is in oilfield units (ft, ppg),
  converted in one place.
- **D9. Delivery: one offline HTML file for now, not forever.** (John, 2026-10-14.) John
  accepted the single-file build for M1 onward, and said: "I would like documented somewhere that
  I see this app growing beyond a single html file."
  - Why one file for now: it opens anywhere with no install, server or internet, can be copied or
    emailed, and can't send data anywhere.
  - What John expects next: a private hosted web page (with a login), an installable desktop app,
    or both. Triggers that would force the move:
    - bundled data too large for one file
    - saving straight to folders on disk
    - 3D (M6) needing more than a double-clicked file allows
    - sharing with other people
  - Rule for everyone building now: **don't paint us into a corner.**
    - The single file is a build *output*, not a design limit.
    - Keep `src/` free of anything that only works as one file (no assumptions about `file://`
      paths, no inlined-only tricks outside the build config).
    - Keep the engine/worker boundary clean, so a hosted or desktop build can reuse it unchanged.
- **D10. Spike 002 result → record shape.** Salt is a material tag on units in the layer record,
  not a special bottom layer. That way a canopy (salt above younger sediment) stays storable later.
  Diapir width in thin-sheet flow is set by the grid, so M3 adds cover bending stiffness before
  diapirs count (see `spikes/002-salt/README.md`).
- **D11. M1 approved** (John, 2026-10-14: "approve"). Nine stacked cards as listed in the
  roadmap, with the recommended picks: a published 3 Myr sea-level curve as default (chosen by
  licence), the spike's grid and timing, and ft/ppg/km units.
- **D12. Runs up to 66 Myr** (John, 2026-10-14: "I'm good with your suggestions"). John said
  3 Myr is too short. It was a proof-of-concept choice: it resolves the glacial sea-level cycles,
  the detailed published curves cover about 3–5 Myr, and the run took under 2 s.
  - Speed depends on the number of steps, not the number of years. Measured on spike 001:
    600 steps take 2.0 s, 1,200 take 6.8 s, 2,400 take 24 s. 30 Myr at 50 kyr steps takes 1.9 s.
  - A hosted page or desktop app would not fix this, so D9 stands.
  - What M1 adds:
    - variable time steps
    - bundled deep compaction (the record keeps every layer)
    - presets: last 3 Myr (default), Miocene to present (~23 Myr) and full Cenozoic (66 Myr)
    - a published Cenozoic sea-level curve spliced to the high-resolution one
    - burial temperature and quartz cement (Walderhaug 1996)
    - thermal-decay subsidence (McKenzie 1978)
  - Targets: Miocene preset < 3 s, 66 Myr < 5 s.
  - Runs back to the Jurassic (salt deposition) come with M3.
- **D13. Overnight authority for 2026-10-14 to 15** (John: "go overnight"). For this run only:
  - **A.** The orchestrator may answer card questions with the card's recommended pick. Each
    answer is logged as a `DECISION (orchestrator)` comment for John to review in the morning.
  - **B.** It may fix failing cards and retry, up to 3 attempts per card. After that the card
    parks and its chain waits.
  - **C.** If a review says REQUEST CHANGES, it writes fix cards and re-reviews.
  - **D.** It may merge the M1 tip to main once. Conditions: the newest M1 review says
    `VERDICT: APPROVE`, and all gates pass on main after the merge. If any gate fails, it resets
    and doesn't push. John can revert.
  - **E.** It may then start M2 (slope failure and MTDs, cards M2.1 to M2.6). M2 stays off main.
    Its done-when includes John judging where and when the MTDs happen.
  - **F.** No messages overnight. One morning summary at 7:30 AM.
  Standing rules still hold: never deploy, never touch other repos or boards, never edit CLAUDE.md.

- **D14. Linux CI is red after the M1 merge (2026-10-15, shepherd note, for John).** All gates passed on Windows (198 tests, build, offline). On the GitHub Linux runner `npm run check` failed 8 tests: golden parity with spike 001 (largest height difference 55.7 m against 0.01 m), the committed scenario fixture hashes, and the burial rewind test timed out at 5 s. Wall-clock limits also failed (runner is slower). The parity and hash failures mean results are not bit-identical across operating systems (likely `Math.pow`/`Math.exp` differences amplified by threshold logic). Same inputs give the same result on one machine; across machines they do not. Nothing deploys from CI. Needs a decision: loosen goldens to a tolerance and hash with rounding, or make the engine platform-independent. M2 was started anyway because it is local work. Decided in D16.4.
- **D15. The repository is public, under the MIT licence (John, 2026-10-15).** John asked to make it public so he can clone it on another computer and others can try it; it holds no company or confidential data. Before the switch, the full history of `main` was checked for secrets, company names, local paths and copyrighted papers (none found; one local path in `PROJECT.md` removed). MIT was chosen because every runtime and dev dependency is permissive and it is the simplest licence for others to reuse. The bundled sea-level data keep their own licences (CC0 1.0 and CC BY 4.0) with attribution in `NOTICE.md`. Only `main` is pushed; milestone branches stay local until John approves them, as before (D6). Commit history shows the author name and email of existing commits.

- **D16. John's morning answers (2026-10-15: "all pass", then "go with your picks").**
  1. **Checks:** John ran the 10 preview checks on the M2 tip build with the canvas fix (default
     run, Miocene, colour modes, pseudo-well, sources, rewind, branch and compare, save/open,
     MTD-prone preset) and all pass. That includes his judgement of where and when the MTDs happen,
     which closes the last M2 done-when.
  2. **M1 stays on main.**
  3. **M2 goes to main** (round-3 re-review M2.11 APPROVE; gates pass on the merged result).
  4. **D14, cross-platform results:** compare results across machines with tolerances and summary
     statistics, not bit-exact goldens and hashes. Bit-exact determinism stays the rule on one
     machine (rewind, branches and same-run repeat tests keep exact equality). Wall-clock limits
     do not fail CI on a slower runner. The engine is not rewritten for platform-independent maths.
     Implemented: parity, scenario-file and MTD-preset tests compare with tolerances and summary statistics (`src/engine/summary.ts`); wall-clock tests skip when `CI` is set; the MTD view tests run the preset at its own 5 kyr steps (at 25 kyr it sat on a knife-edge of 0 to 4 events). Details in `docs/handover.md`, Known traps.
  5. **Kept as is, labelled:** the cause-label rule (largest term wins, 20 m lowstand threshold,
     tuned) and the slope strength defaults (friction 33/25 deg, no cohesion, "to verify").
  6. **Overnight D13 calls kept:** Miocene wall-clock limit 5 s, starting M2 while CI was red, two
     M2 fix rounds.

- **D17. M3 salt approved (John, 2026-10-15: "go").** The D14 fix (D16.4) was merged to main the
  same day. M3 is a seven-card stacked chain (roadmap M3). Picks:
  1. **Approach (a): thin-sheet salt flow plus cover bending stiffness**, not a full Stokes solver.
     The cover over the salt resists bending, which stops the narrowest bumps from growing fastest,
     so diapir width comes from cover thickness and strength, not from the grid (spike 002). Stokes
     flow stays in the backlog as the route to canopies.
  2. **Salt is off by default** (a start-only switch, like `failOn`). The M1 and M2 runs, goldens
     and scenario fixtures do not change, so `ENGINE_VERSION` stays as it is unless a default
     result changes.
  3. **Columns stay fixed in x** (D10). They ride up and down on the salt.
  4. **The Gulf-style example starts at 66 Ma** on autochthonous salt under an older (Mesozoic)
     cover, using the bundled Cenozoic sea-level curve. Jurassic-start runs (D12) move to the
     backlog: no redistributable pre-Cenozoic sea-level curve is bundled yet.
  5. **Salt viscosity:** the Gulf-style preset uses 1e18 Pa·s (middle of the published range, to
     verify). The spike's 1e17 (tuned, so flow shows in 3 Myr) stays available as a control value.
  6. **Merging:** nothing merges to main without John (D6). The shepherd advances the chain, verifies
     each card on Windows and Linux, and may write one fix round plus a re-review after REQUEST
     CHANGES. Geology or product questions go to John with a recommended pick; D13 overnight
     authority does not carry over.

- **D18. Gulf targets relaxed; passive-diapir physics next (John, 2026-10-15).** M3.8 found that the
  Gulf-style preset could not meet the card's targets (a weld under 10 m and a crest within 1 km of the
  seafloor) at `saltVisc` 1e18 with plausible values. John accepted the shortfall and relaxed the targets
  instead of changing a D17 pick:
  1. **Weld** = salt thinner than `weldThick` of **100 m** (about seismic resolution; tuned; Wagner and
     Jackson 2011, abstract only, to verify). Target: at least one weld run of **2 km or more** under the
     shelf or the pinch-out ramp the wedge crossed. The Gulf preset uses 100 m; the registry default stays
     10 m (33 ft), so no other run changes.
  2. **Crests:** at least two salt crests within **2 km** (about 6,600 ft) of the seafloor, and not edge
     artifacts (20 km or more from the section edge and from the salt edges).
  3. **The wedge must still prograde.** No drowned-shelf solutions.
  4. **Kept:** `saltVisc` 1e18 and the 66 Ma start (D17.4, D17.5).
  5. **Why:** thin-sheet flow slows as the cube of the salt thickness (h^3), so a column never gets down
     to 10 m in 66 Myr, and the older cover always lies on a crest, so a crest cannot stay at the seafloor.
  6. **Passive diapirs come next:** diapirs that reach the seafloor and stay there while sediment builds up
     around them are spike **S3**, then milestone **M3b**, straight after M3 and ahead of M4 (roadmap).
  7. **What M3.8 reached:** the weld target (runs of 2 km or more, salt left in a weld column 56 to 152 m),
     the wedge still prograding (shoreline 54.5 km at 56 Ma, 212.5 km at 0.6 Ma, M3.9 re-review), salt conserved to about 1e-14
     with nothing clipped, and spacing within 15 % at 1,000 and 500 m (by wavelength, not by count). Four
     crests sat within 2 km of the seafloor, so the crest target was met by the letter. The M3.9 re-review
     found the weld is real but its length moves with the last digit of the maths (the longest run was 1 to
     3 km across six noise salts), and that the four crests were ripples on a pile (D19). So the tests ask
     for a band, not for exact welds.

- **D19. Fix the basinward edge instead of accepting the salt pile (John, 2026-10-16, option B).** The M3.9
  re-review (REQUEST CHANGES, `docs/reviews/m3-rereview.md`, finding 4) showed that the Gulf preset's
  shallow crests were small ripples on a salt slab 8 to 9 km thick, twice the 4 km start, that had piled up
  against the closed (no-flow) basinward edge of the section at 400 km. The weld and wedge results were
  sound. John chose to fix the edge, not to accept the pile.
  1. **What M3.10 did:** two new start-only parameters, `saltLimitStart` and `saltLimitEnd` (a smooth
     taper like the landward pinch-out), end the salt basin where it should end. Defaults 2,000 and
     2,500 km are beyond any section, so every other run is bit-identical. The Gulf preset uses 200 and
     240 km (tuned; the idea that the Louann salt basin ends near the continent-ocean boundary and that
     salt flowed past it is after Hudec et al. 2013, abstract only, to verify). The limit was chosen from
     a sweep of eight limits by whether the pile was gone, not by crest count.
  2. **What it reached:** the thickest salt beyond 250 km fell from 9,068 m to 5,002 m (1.25 times the
     start); the last 20 km of the section holds no salt (was 9,068 m); the salt front ends at 355 km, 45 km
     short of the edge; salt in the section at the start fell from 1,380 to 660 km2. Total weld length is 12
     to 20 km across the plain run and six noise salts, longest run 3 to 4 km. The Gulf run takes about 5 s.
  3. **Crests, in plain words:** 5 crests meet the test (2 to 5 across the noise salts), at 286 to 323 km,
     but none is closer than 4,243 ft (about 1.3 km) to the seafloor, and they are still ripples of 300 to
     850 m on a flat slab, not diapirs. The D18 crest target is met by the letter, not in spirit. Making
     diapirs that reach the seafloor is the job of S3 and M3b, not of a preset tweak.
  4. **Still not Gulf-like:** 200/240 km is tuned, not a Gulf position; the outer 160 km of the section has
     no salt at the start; no canopies; the 4 km start has no source (tuned).
  5. Nothing merges to main without John (D6, D17.6).

- **D20. Controls panel in named groups (John, 2026-10-16: "go with your picks").** John had to use
  Ctrl+F to find the salt controls: 72 of the 81 parameters sat in one flat list under "All other
  parameters", in code order. The panel is regrouped by process (roadmap UI-1). No physics, default or
  record changes.
  1. **Speed and accuracy settings** (columns, column width, substeps, update intervals, deep-compaction
     bundling, benchmark mode) go in one **Grid and numerical settings** group at the bottom, not a
     numerical fold inside each process group (option A). The geology groups then hold only physical
     quantities.
  2. **A "changed from preset" marker** (a dot on the value, the preset value under it, and a count in
     the group header) is part of the same card, not later.

- **D21. Next work, all three tracks at once (John, 2026-10-16: "go all").**
  1. **Housekeeping:** the approved salt literature goes to main as docs (DOCS-1), with the LIT-4b and
     M3.12 re-review follow-ups; FIX-1 does the small M3.12 code follow-ups.
  2. **Salt evidence round before M3b:** QC tests (SALT-1), spike 003 rerun with a per-crest log (S3b),
     an independent 2D Stokes check (S4), and a review by a dedicated salt reviewer (SALT-R1). John sets
     the M3b scope from that review. A QC check that fails is recorded, not patched in the engine.
  3. **M4 runs now, alongside the salt round,** not after M3b (this changes the D3 order for M3b and M4
     only): the M3b scope cannot be set until S3b and S4 report, and M4 touches different files.
  4. **M4 picks:** wells are vertical or build-and-hold (J) in the section plane (S-shapes and
     out-of-plane wells go to the Backlog). Fracture gradient by Eaton (1969) by default, Matthews &
     Kelly (1967) as an option; in salt, fracture gradient = overburden. Depths in ft TVDSS; mud weights
     (EMW, ppg) referenced to RKB with an 80 ft air gap (tuned, editable); the existing pseudo-well
     curves move to the same datum. Mud-weight window = pore pressure to fracture gradient, with no
     wellbore-stability (collapse) limit in M4. The well is saved in the scenario file; old files open
     unchanged.

- **D22. Fix the S3 bypass rule and rerun S3b before choosing the M3b scope (John, 2026-10-17; the SALT-R1 recommendation).**
  SALT-R1 found that the S3b "exposed for 27 Myr" crests were holes in the seafloor kept open by the
  spike 003 bypass rule. The rule is fixed in the spike only (S3c): shed only from a topographic high,
  tested on the seafloor at the start of the record step, split between lower neighbours by slope. S3b
  is rerun on both platforms. Nothing is ported to `src/engine`, which has no exposed-salt bypass.
