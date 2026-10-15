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
