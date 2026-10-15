# Strata Lab: agent guide

Read this first. It is the source of truth for how work is done in this repo.
**Status (2026-10-14):** spikes 001 and 002 are done. M1 is approved and being built as a chain of cards.
Plan: `docs/roadmap.md`. Decisions: `docs/decisions.md`. Background: `PROJECT.md`.
Physics sources: `docs/physics-references.md`.

## What this is
A browser app that builds a 2D basin section by running physical processes (sediment transport,
compaction with pore pressure, later slope failure and salt flow). The user changes conditions
and watches the result, with rewind and what-if branches. It is for learning and for deepwater
well planning.

Owner: John, a geologist planning deepwater wells (mostly Gulf of America). He knows the
domain well but is not a professional developer, and not a specialist in forward modelling.
Explain things in plain language and use oilfield units (ft, ppg) in anything he reads.

## Non-negotiable principles
1. **Physics honesty.**
   - Every process conserves mass. Check the balance per grain size and per material, not
     only in total.
   - Every solver has a test against an exact solution or an independent hand calculation.
     Example: consolidation against Gibson (1958).
   - Every parameter in `docs/physics-references.md` carries a citation and a published range,
     or is marked **tuned**. The app shows which, next to the control.
2. **Deterministic.** Same starting state + parameters + seed = bit-identical results. Rewind and
   branches depend on this. Keep the engine free of unseeded randomness, clock reads, and any
   iteration order that is not fixed. Determinism has its own test.
3. **One stratigraphic record, many views.** The engine's layer record is the only source of
   truth. Views (section colourings, pseudo-well, charts) read it and keep no geology of their own.
4. **Engine is pure.** `src/engine/` has no DOM, React or canvas, and runs in a Web Worker
   (lint enforces this). Engine units are SI. Views convert to ft/ppg in one place.
5. **Data.** Synthetic, or published examples rebuilt with a full citation. Never use company,
   well, lease or seismic data. Papers stay in the git-ignored `References/` folder.
6. **Local-only.** No network requests at runtime. The app must work offline from one built
   HTML file *for now*. John expects it to grow beyond one file later (hosted page and/or desktop
   app; `docs/decisions.md` D9). So keep the single file a build output only, and put nothing in
   `src/` that only works as one file.
7. **Permissive licences only** (MIT / Apache-2 / BSD).
8. **Readable over clever.** Each physics module starts with a comment giving the equation, its
   source and its assumptions.

## Stack (decided 2026-10-14; set up in M1)
TypeScript (strict) + Vite + React + Vitest, ESLint, GitHub Actions CI, vite-plugin-singlefile.
The engine runs in a Web Worker. The section is drawn on canvas. This is the same stack as
geoblock, so agents and tooling carry over.

## Layout
- `spikes/NNN-*/`: throwaway prototypes. Nothing imports them; read them as references.
  `spikes/001-shelf-to-basin/engine.js` is the reference implementation of the spike physics.
- `docs/`: agent guide, roadmap, decisions, handover, physics references.
- `src/engine/`: pure physics, runs in the worker. Lint bans DOM, React, app/view imports,
  `Math.random`, `Date.now`, `performance.now` here.
- `src/worker/`: `protocol.ts` (message types), `handler.ts` (pure request -> response),
  `engine.worker.ts` (entry), `client.ts` (`EngineClient`, used by the app).
- `src/app/`: React shell (`App.tsx`, four regions filled from the view registry).
- `src/views/`: one folder per view (`<name>/index.tsx` default-exports a `ViewDefinition`).
  `registry.ts` finds them by glob, so adding a view never edits a shared switch.
- `src/units.ts`: the only place unit conversions live (m/ft/km, Pa/psi, gradient to ppg EMW).
- `tests/`: cross-cutting tests and shared fixtures. Unit tests sit beside the code (`*.test.ts`).
- `scripts/`: node scripts (`check-offline.mjs`, `verify-built.mjs`).
- `vite.config.ts`: the one-file build lives ONLY here (inlines the worker, renames to
  `dist/strata-lab.html`). `STRATA_SINGLE_FILE=0` gives a normal multi-file build instead.
  The one-file worker is a classic (iife) script: a Blob-URL module worker is refused on file://.

## Commands
- `npm ci` then `npm run check`: typecheck + lint + tests (CI runs exactly this).
- `npm run build`: writes `dist/strata-lab.html`. `npm run check:offline`: fails on any remote URL
  or network call in it, or any extra file in `dist/`.
- `npm run verify:built`: opens the built file from file:// in headless Chrome/Edge over CDP
  and requires "Engine worker: OK" and zero console errors.
- `npm run dev`: dev server (module worker).
- Local Node 26: if localStorage tests misbehave, prefix `NODE_OPTIONS=--no-experimental-webstorage`.
- Spikes (CommonJS, `spikes/package.json` keeps them so): `node spikes/001-shelf-to-basin/test.js`,
  `node spikes/002-salt/test.js`; each ends `ALL PASS`.

## Domain glossary
- **Clinoform:** a sloping depositional surface (shelf → slope → basin floor). It builds out
  (progrades) as sediment piles up at the shelf edge.
- **Shelf edge / shoreline:** the break in slope at the outer shelf / where sea level meets land.
- **Lowstand:** a time of low sea level. The shoreline sits near the shelf edge, and sand bypasses
  to the slope and basin floor.
- **Turbidite:** a sand or mud bed laid down by a turbidity current (a dense, sediment-laden flow).
- **MTD (mass-transport deposit):** a slump or debris-flow deposit from a slope failure.
- **Effective stress:** load carried by the grains, which equals total vertical stress minus
  pore pressure. It controls compaction.
- **Overpressure (excess pore pressure):** pore pressure above hydrostatic. It happens when fluid
  can't escape as fast as burial squeezes it. Shown as λ*, the fraction of the buoyant load that
  the fluid carries.
- **Consolidation:** compaction limited by fluid drainage. Gibson (1958) gives the exact solution
  for a layer that grows at a constant rate.
- **Athy's law:** porosity falls exponentially with burial (here, with effective stress).
- **Minibasin / weld / diapir / canopy:** a sediment basin sinking into salt / the contact left
  where salt has flowed away completely / salt rising through its cover / salt that has spread
  sideways over younger sediment.
- **ppg / EMW:** pounds per gallon, the equivalent mud weight that would balance a pressure at a
  given depth.
- **Snapshot / branch:** a saved engine state / a what-if timeline that shares history with its
  parent up to its start time.

## Working rules for agents
- Work only on your branch. **Never push to main, merge to main, or deploy.** Code from cards
  waits on its branch until John approves it for main. Only the orchestrator may push, and only
  docs and spikes. Stacked cards merge the previous card's branch into their own.
- Test-first for `src/engine`. A new process needs its benchmark test and a mass-balance test
  before it is wired into the UI.
- Don't change a published parameter's default without updating `docs/physics-references.md`
  and saying why on the card.
- Conventional commits (`feat(engine): ...`).
- Handoff: diff summary, files changed, `npm run check` result, branch, open questions.
- For product or geology decisions you can't infer from this file or the card, stop and ask
  John with a recommended answer. Don't guess.
