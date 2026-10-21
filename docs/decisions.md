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

- **D23. After SALT-R2: a docs fix, one Stokes rerun, and M3b starts with option A (John, 2026-10-17: "go with your picks").**
  1. SALT-R2 found the S3c physics fix sound and asked for changes to documentation only (D-1, D-2,
     N-1, N-2, N-4). One fix card (S3d) does them. The orchestrator checks it, and the salt reviewer
     confirms it in the same short check as S4b (SALT-R3); no further review round.
  2. SALT-R2 N-3: one S4 Stokes run (case A, cover viscosity x1) from a start section cut from the fixed
     spike at about 24.9 Myr (S4b). John decides option C (a salt source layer) after it; nothing is
     built for C before then. C is a question about how salt reaches a crest, not a way to add salt to
     keep a crest exposed: burial of a diapir is expected geology (John, 2026-10-16).
  3. M3b part 1 is option A: a read-only per-crest rise-to-accumulation output (F, A, F - A, ratio,
     neighbouring salt thickness, flow length over salt thickness) with a tabular or tapered label from
     the rates (Giles and Rowan 2012 p. 20). No engine physics change; record and fixtures unchanged.
     B is a later sensitivity test, D is long-term, E is out, F stays open.
  4. John is away for part of 2026-10-17 and asked that work keep moving: implementation choices are made
     by the orchestrator and recorded as DECISION lines on the cards. Geology and product questions still
     go to John (by Telegram). Card code reaches main only after John's check.

- **D24. Option C (a salt feed from below) is not built for the Gulf slab (John, 2026-10-17: "go with your recommendations").**
  1. SALT-R3 (salt reviewer, `docs/reviews/salt-r3-check.md` on branch `strata-lab/salt-r3-check`, VERDICT APPROVE)
     recommended not building C, at medium confidence. The S4b Stokes rerun from the fixed spike 003 start section has
     the full 4 km salt layer as its source and still never exposes the crest (at least 138 m, 453 ft, of cover up to
     the thin-sheet burial), so a feed is not what is missing. A feed would also move the thin sheet further from
     Stokes and would be a tuned number with no published calibration. Burial of a diapir is expected geology (D23.2).
  2. S3 answer recorded: the thin sheet's exposed-then-falling crest is a thin-sheet model limit (medium-to-high
     confidence that Stokes does not hold the crest at the surface; low confidence on the exact cover sizes and rates).
  3. Reopen C only for a thick-source down-building case like GL24. B stays a later sensitivity test, D long-term,
     E out, F (brittle cover) open.
  4. SALT-R3's wording items N-5, N-7 and N-8 are fixed on local branch `strata-lab/salt-r3-wording` (spike READMEs,
     docs only), which goes to main with the spike branches. N-9 (S4b run output not committed) is accepted for a spike.

- **D25. Crest panel beside the section (John, 2026-10-17: "go crest layout").**
  1. John's check of M3b part 1: the Salt crests table sat below the pseudo-well and the planned well, 1,240 to 1,580 px
     down the page on the Gulf preset (section bottom about 630 px), so a click on a row could not be seen on the
     section. On a 1080p screen at 125 % the window is about 760 px tall.
  2. Fix (card UI-2): a compact crest list (Crest, label, F - A, Last Ma; about 10 rows, scrolling inside) at the top of
     the right-hand column, shown only when the run has salt, with a selected-crest card under it (position, F, A, A/F,
     salt beside, L/h, how it ended, the two CSV exports). Clicking a row also moves the pseudo-well to the crest's
     column (the M3b.4 reviewer's recommendation; the slope-failure list already does this).
  3. The M3b.4 review's eight non-blocking items (N-1 to N-8) ride on the same card. The 25 m/Myr noise floor stays,
     the merged-candidate footnote stays, and a per-branch crest log stays later (the M3b.4 recommendations).

- **D26. Physics audit (AUDIT-1) HIGH findings: the recommended picks (John, 2026-10-17: "go with your picks").**
  The audit is `docs/reviews/physics-audit-m1-m3.md` (it comes onto main with the first card of the batch).
  1. F-1, bundled deep compaction moves deep pore pressure by 0.7 to 1 ppg on the long presets: correct the docs with
     the coupled-preset numbers, show the measured bundled-versus-full difference on the well plot, and add a
     "full accuracy" switch (no bundling) once its run-time cost is measured. Re-solving one column unbundled is later.
  2. F-2, pore-water viscosity fixed at 20 C (68 F): viscosity follows the model temperature when the heat model is on,
     from a cited formula with a test against published values; the pressure panel says "water at 68 F" when it is
     off. Whatever the change does to pressures and to slope failures is reported, not tuned away.
  3. F-3, pore pressure silently capped at the overburden: show it now (a count in the physics checks; capped cells
     marked on the pseudo-well and the planned well). A leak-off limit below the overburden (Hauser 2020) is later and
     needs its own literature check.
  4. F-4, Gulf preset overburden 1.5 to 2 ppg light: label the Gulf preset's densities as uncalibrated, add a check
     against the deepwater Gulf regional overburden trend (Traugott 1997), and give the Gulf preset Gulf shale
     compaction coefficients (Hart, Flemings and Deshpande 1995, Eugene Island 330). The Gulf salt and crest numbers
     will move, so a salt review follows.
  5. Order: labels and checks (no physics change), then viscosity, then the Gulf coefficients and a salt re-check, then
     the full-accuracy switch, then one integrity review of the batch. Card code reaches main only after John's check.
  6. **D26.4 outcome (AUD-3; John, 2026-10-17: "A").** The Gulf preset's mud now uses Hart, Flemings and Deshpande (1995,
     p. 46: phi0 0.40, beta 3.68e-8 /Pa); sand stays North Sea (the paper gives shale only). Measured result, medians of
     four runs (plain and 1 ulp noise salts 7, 11, 13), Windows node 26 / Linux node 22: the Traugott gap at column 150
     falls 1.73 -> 1.15 / 1.14 ppg (about a third of it); pore pressure at 10,000 ft rises 12.7 -> 15.2 ppg; the
     overburden-cap count **rises** 15.6k -> 36.1k (Windows), 16.1k -> 48.2k (Linux); welds total 16 -> 8.5 km (Windows),
     7.5 km (Linux); salt beyond 250 km reaches 6.4 to 6.6 km (was 5.0). **D18's shallow-crest target is dropped for the
     Gulf preset as a measured result of the cited compaction change:** crests within 2 km of the seafloor go from 4 to 0 in
     every run on both platforms. The old 2 to 5 were 300 to 850 m cover ripples over the light, over-porous mud, not
     diapirs. Diapirs at the seafloor are left to S3 and M3b work. Also (AUD-4): with the Hart mud the toe of the salt became exposed: 6.2 to 6.7 km of salt bare at the seafloor over the last 3 to 5 km before the front, a step of about 1,270 m (4,170 ft) in the plain run, bare since about 21 Ma, one "run end" crest in the log (14 of 14 runs on Windows node 26 and Linux node 22). It is a model limit (no dissolution, no extrusion, salt not eroded), not a result. **Model limit, shallow section (AUD-6 B-1):** with the Hart mud the Gulf pore pressure 500 ft below the sea floor is 9.35 to 10.49 ppg (columns 100 to 250; u / L 0.17 to 0.65) against 8.59 to 8.62 ppg (u / L 0.01 to 0.07) with the North Sea mud, and 10.2 to 12.2 ppg against 8.7 to 8.8 ppg at 2,000 ft (Windows node 26; Linux node 22: 9.21 to 10.74 and 10.4 to 12.3 ppg). Hart's well is hydrostatic there. The tuned mud permeability law (log10 k = kA + kB phi) was tuned with phi0 0.63; at phi0 0.40 the surface mud is about 70 times less permeable (10^-18.8 against 10^-17 m^2), so the top of the column no longer drains. Nothing was retuned; the re-fit is in the Backlog. Same mechanism: the higher cap count, 83 to 4,759 slope-failure events (26 s to 37 min on Windows) with failure on, and the thinner welds. Nothing was retuned to bring them or the cap count
     back. The tests assert the new bands (weld total 5 km or more and a run of 2 km or more, no-pile limit 2 times the
     start thickness, no crest count; any crest that exists is under the seafloor and obeys the 20 km rule).
     `ENGINE_VERSION` is 3 (a saved Gulf run replays with the new mud). The overburden-cap count is for AUD-4 and AUD-6
     to read against F-3b (the leak-off limit, later).

- **D27. The AUD-3 answer, and a Fable round on three tracks (John, 2026-10-17 evening: "A", then "go with your picks").**
  1. AUD-3 (D26.4), option A: the Gulf preset keeps the Hart, Flemings and Deshpande (1995, p. 46) Gulf shale coefficients
     (phi0 0.40, beta 3.68e-8 /Pa). They narrow the Traugott (1997) overburden gap at column 150 from 1.73 to 1.15 ppg, but the
     shallow crests go from 4 to 0 in every run on Windows and Linux, and the weld total roughly halves (16 to about 8 km). The
     D18 shallow-crest target is dropped for this preset as a measured result, not tuned back: the old crests were 300-850 m
     cover ripples over the light, over-porous mud. Diapirs at the seafloor are left to the S3/M3b work. The Gulf test bands
     are reset from the new Windows and Linux medians with the D16.4 margin. Hart's fit comes from the shallow, hydrostatic
     section (above about 1,500 m, 4,900 ft) of one Eugene Island 330 well, so its use at 8,000 to 12,000 ft is an extrapolation.
  2. John's spare weekly Fable 5.1 allowance (resets 2026-10-18, 17:00 Central) goes to high-judgement cards only:
     - the two review cards of the audit batch (AUD-4 salt re-check, AUD-6 integrity review);
     - spike S5, which opens M5 (growth faults), and its review;
     - the pore-pressure and fracture-gradient literature review (LIT-PP).
     Building, UI and docs cards stay on Sonnet.
  3. S5, spike 005 (`spikes/005-growth-fault/`): one listric growth fault over a mobile layer, as a throwaway prototype. It must
     show hanging-wall rollover and growth strata that thicken into the fault. Sand, mud and salt mass must be conserved per
     grain size and material, and the run must be bit-identical on a rerun. The rollover is checked against a hand-calculated
     hanging-wall construction (inclined shear and vertical shear). S5 also delivers a design note: how the layer record carries
     sideways motion, what that costs, and the M5 card list with recommended picks. A review card (Fable) checks it. M5 itself
     is scoped from the note and John's picks, as M3b was.
  4. LIT-PP: two deep-read cards over the papers John supplied (Eaton 1969; Traugott 1997; Hart et al. 1995; Zhang and Yin
     2017; Alberty and McLean SPE 167945; IOGP Report 608; Hauser's papers on salt-sealed formations and on stress and fracture
     pressure; the Hauser and Couzens-Schultz preprint on effective stress; Tahvildari 2026), then a synthesis
     (`docs/pp-literature.md`) with a QC checklist for the M4 pressures, then an independent citation check. The papers stay
     outside the repo, and only short quotes with page numbers go in. It feeds the open M4 backlog items (rising stress ratio,
     fracture gradient in salt, the leak-off limit, the narrowest-window depth floor) and M4's "Eaton and Matthews & Kelly not
     read" note.
  5. If allowance remains on Sunday morning, a read-only review of the design against published stratigraphic forward models
     (the Backlog's specialist review) may also run on Fable. The orchestrator decides from the usage meter.
  6. Nothing from these cards reaches main before its review and John's check.

- **D28. Audit batch and pore-pressure literature to main; two small picks (John, 2026-10-18: "merge audit batch", "go with
  recommended", "okay to merge").**
  1. The audit batch (AUD-1 to AUD-8, reviews AUD-6 and AUD-8 APPROVE) merges to main after John's check of the preview.
  2. The shallow Gulf overpressure (Hart mud reads about 1 to 2 ppg over hydrostatic in the top 2,000 ft, AUD-6 B-1) stays a
     documented model limit, as the Gulf preset note and the "Not calibrated to the Gulf" label already say. The permeability
     re-fit stays in the Backlog as its own card with its own review; nothing is tuned toward a result.
  3. AUD-8 N-C / M3b.4 N-1: the crest list gets a capped height with its own scroll, so the crest card stays on screen at
     1920 x 1080 at 100, 125 and 150 % (card CL-1, view only, no engine change). N-7 and N-8 stay open as conveniences.
  4. The pore-pressure literature review (deep-read notes, `docs/pp-literature.md`, citation check) merges to main as docs.
     Its section 10 options for the M4 backlog items wait until John plans the next M4 work.
  5. Spare Fable allowance before the 2026-10-18 reset goes to S5c (spike 005, Q7 option (c) measured) and the stratigraphic
     forward-modelling specialist review (SFM-R, D27.5). Neither reaches main before John's check.

- **D29. Parameter lineage review (John, 2026-10-18: "I love the idea of borrowing this for strata lab so yes lets do that").**
  1. One doc-writer card (LIN-1) traces each tuned physical parameter in `docs/physics-references.md` to its literature
     ancestry using OpenAlex citation data, in the manner of the Sediment research tool: a seed paper, its references, and
     every link marked verified (citation present in the data) or inferred (not present). A verified citation shows a
     reference relationship, not that the value was taken from that paper.
  2. The card changes no parameter and no code. Its output is a recommendation per parameter (adopt with page, obtain paper
     then decide, or keep tuned with a reason) and a ranked "Papers to get" list for John. Adopting any value is a later card.
  3. Only values from papers the writer actually read may be quoted; OpenAlex abstracts are paraphrased and marked
     "(abstract only)". Short quotes stay within the public-repo rule (at most two per paper, with page numbers).
  4. The trace script lives under `scripts/lineage/` and is never part of the app build; the app stays offline.

- **D30. M5 becomes sideways motion over salt, and a canopy spike (John, 2026-10-20: "I'm good with your recommendations for 1 and 2").**
  John's look at the Gulf preset: nothing pushes or pulls the cover sideways, so the basinward half is a flat salt slab with no
  structure. The only driver is vertical load (columns fixed in x, D10, D17.3). The salt literature review rated "columns fixed
  in x" inconsistent for canopies, rafts, spreading and stretching (section 8), and option E was left out of M3b (D23, D24).
  1. **M5 scope:** the growth fault of spike 005 (S5 DESIGN.md cards M5.1 to M5.8, record option A) plus a prescribed linked
     system: updip extension on the growth fault, the cover between the fault and a toe translated basinward, and the same
     shortening taken up at the toe over the salt (Gemmer et al. 2004 pp. 214-215 and Vendeville 2005 pp. 1072-1073 describe
     this pairing). The amount of strain is an input, labelled prescribed, not a prediction. Area and line length balance.
  2. **First card M5.0:** a read-only cover sliding map from the Gemmer et al. (2004) force balance (Eq. 8, p. 202): per column,
     whether a frictional cover over the salt would fail in extension or contraction. No record change and no hash change.
     M5.0 also writes the linked-toe design note; John reads it before the toe card M5.4b runs (a HOLD gate).
  3. **S5 design picks accepted with this go** (spike 005 DESIGN.md section 4): Q1 kinematic slip (prescribed heave), a
     load-driven switch in M5.4; Q2 salt as the mobile layer; Q3 a short growth-fault preset first, a fault in the Gulf preset
     after it is reviewed, at a position John picks; Q4 counter-regional faults later (M5b); Q5 vertical shear by default, the
     angle a parameter; Q6 the fault curve fixed once from the salt top; Q7 option (c), whole-cell record with a sub-cell read,
     as measured by S5c.
  4. **Not in M5:** strain that comes from the forces (a yielding frictional cover, option F). Reopen it if the prescribed
     system proves useful. A full Stokes solver stays out of the live app (D4).
  5. **Canopy spike S6 after M5.0:** salt that reaches the seafloor spreads basinward over younger sediment as a second thin
     salt sheet (a viscous gravity current), stored as salt above sediment (D10). Benchmark: the similarity solution of a 2D
     viscous gravity current (Huppert 1982; to verify; not read), derived and checked in the spike. No dissolution term: the
     missing sink is named. Spike only, then a salt-reviewer review (S6-R). The Gulf preset's bare salt wall (AUD-4 question)
     keeps its keep-and-label default until S6 reports.
  6. Nothing merges to main without John (D6).

- **D31. CL-1 merged; the SFM-R fixes come before M5.1 (John, 2026-10-20: "merge cl-1, sure they can come before").**
  1. CL-1 (crest-list height cap, D28.3) merges to main; John's preview check passed on 2026-10-20.
  2. The SFM-R findings (`docs/reviews/sfm-review.md` on `strata-lab/sfm-review`, verdict NEEDS WORK) are fixed before
     M5.1, as a chain SFM-1 to SFM-4 (roadmap section "SFM fixes"). M5.0 (read-only) and M5.0v, S6 and S6-R are not
     held; M5.1 branches from the SFM chain's tip after its review approves.
  3. Picks, following the reviewer's minimum fixes: F2 open basinward boundary (fixed-elevation outflow, booked as
     exported in the ledger per grain size), not a wider wall; F1 and F4 a minimum water depth before a face can count
     as the shelf edge (`shelfBreakDepth`, cited or labelled tuned), with the turbidite feed taken from the flux arriving
     at the shelf edge rather than from the supply; F5 a routed deposit spread over at least one column width; F7 and
     the two user-guide sentences reworded; F3 re-measured after F1 and F2. F6, F8 and F9 stay documented limits.
  4. These are physics fixes to the default behaviour, so goldens, fixture hashes and preset results change. Each card
     reports old and new numbers (Windows and Linux) and nothing is tuned toward a result. The Gulf preset bands are
     re-set from new medians only if the review approves (as D27.1).
  5. The SFM-R test thresholds (share < 0.05 at constant sea level with the shoreline inboard; < 5 % change in sand
     beyond 100 km when the section is widened) are round numbers, not cited targets; the docs say so.
  6. Nothing merges to main without John (D6). Superseded by D32.

- **D32. Merge policy: the orchestrator merges when the gates pass; John checks afterwards (John, 2026-10-20: "I'm good with your recommendations"). Replaces D6 and the one-time grants (D13); the same policy applies to all of John's projects.**
  1. Worker cards never push or merge to main. Unchanged: cards run in parallel and stack on each other's branches.
  2. The orchestrator (Hermes, or a shepherd job it writes) merges a card's branch or a chain's tip to main with `--no-ff` and pushes it when all of these hold: the review says APPROVE; `npm ci`, `npm run check`, `npm run build` and `npm run check:offline` pass on a fresh clone; the Linux parity run passes; and the diff has no secrets, local paths or personal data (the repo is public). After the push, the CI run for that commit must go green, or the merge is reverted with `git revert`.
  3. After a merge John gets a plain summary and his checks on the Checks page. He decides keep or revert; a revert is one `git revert`, and nothing deploys from main.
  4. A REQUEST CHANGES or NEEDS WORK verdict means nothing merges.
  5. Still John's: geology, physics and product decisions (D17.6, including changing a cited default or picking an option), anything only he can test by hand, force-pushes and history rewrites, secrets, and the repo's visibility and licence.
  6. "Nothing merges to main without John" lines in earlier decisions (D6, D31.6) and in the roadmap describe the old rule.

- **D33. LIN-1 papers: read Yang and Aplin first (John, 2026-10-20: "go with your pick").**
  1. Yang and Aplin 2010 (mud permeability against porosity and clay fraction) and Yang and Aplin 2004 (mudstone
     porosity against effective stress) are read first; both have free copies. Card LIN-2 reads both full texts and
     writes deep-read notes in `docs/pp-notes/`: the 2010 equation checked against the paper, its units, its limits
     (porosity, clay fraction, stress), which flow direction it describes, and whether 2004 gives an unloading ratio
     for `elastic`. It updates sections 2 and 3 of `docs/parameter-lineage.md`. No parameter or code changes.
  2. Imran et al. 2001, Clauser and Huenges 1995 and Hampton, Lee and Locat 1996 wait until a card needs them.
  3. LIN-1 and LIN-2 reach main together once an independent citation check (LIN-R) says APPROVE (D32).
  4. The mud-permeability re-fit (D28.2) is created after the SFM chain is on main and starts from the LIN-2 notes.
     Where the clay fraction comes from (one value per lithology, or from the sand share) is a physics choice for
     John: LIN-2 lists the options with one recommendation, and any new Gulf default stays John's call (D32.5).
