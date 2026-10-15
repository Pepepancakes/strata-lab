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

<<<<<<< HEAD
- **D14. Linux CI is red after the M1 merge (2026-10-15, shepherd note, for John).** All gates passed on Windows (198 tests, build, offline). On the GitHub Linux runner `npm run check` failed 8 tests: golden parity with spike 001 (largest height difference 55.7 m against 0.01 m), the committed scenario fixture hashes, and the burial rewind test timed out at 5 s. Wall-clock limits also failed (runner is slower). The parity and hash failures mean results are not bit-identical across operating systems (likely `Math.pow`/`Math.exp` differences amplified by threshold logic). Same inputs give the same result on one machine; across machines they do not. Nothing deploys from CI. Needs a decision: loosen goldens to a tolerance and hash with rounding, or make the engine platform-independent. M2 was started anyway because it is local work.
- **D15. The repository is public, under the MIT licence (John, 2026-10-15).** John asked to make it public so he can clone it on another computer and others can try it; it holds no company or confidential data. Before the switch, the full history of `main` was checked for secrets, company names, local paths and copyrighted papers (none found; one local path in `PROJECT.md` removed). MIT was chosen because every runtime and dev dependency is permissive and it is the simplest licence for others to reuse. The bundled sea-level data keep their own licences (CC0 1.0 and CC BY 4.0) with attribution in `NOTICE.md`. Only `main` is pushed; milestone branches stay local until John approves them, as before (D6). Commit history shows the author name and email of existing commits.
=======
- **D14. Linux CI is red after the M1 merge (2026-10-15, shepherd note, for John).** All gates passed on Windows (198 tests, build, offline). On the GitHub Linux runner `npm run check` failed 8 tests: golden parity with spike 001 (largest height difference 55.7 m against 0.01 m), the committed scenario fixture hashes, and the burial rewind test timed out at 5 s. Wall-clock limits also failed (runner is slower). The parity and hash failures mean results are not bit-identical across operating systems (likely `Math.pow`/`Math.exp` differences amplified by threshold logic). Same inputs give the same result on one machine; across machines they do not. Nothing deploys from CI. Needs a decision: loosen goldens to a tolerance and hash with rounding, or make the engine platform-independent. M2 was started anyway because it is local work. Decided in D16.4.

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
  5. **Kept as is, labelled:** the cause-label rule (largest term wins, 20 m lowstand threshold,
     tuned) and the slope strength defaults (friction 33/25 deg, no cohesion, "to verify").
  6. **Overnight D13 calls kept:** Miocene wall-clock limit 5 s, starting M2 while CI was red, two
     M2 fix rounds.
>>>>>>> e3647b6 (docs: M2 on main; D16 John's answers (checks all pass, keep M1, M2 to main, D14 tolerances))
