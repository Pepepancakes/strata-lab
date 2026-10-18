# Pore-pressure and fracture-gradient reading notes

One note per paper, each with a claims extraction in `refs/`. Written from full texts for the LIT-PP batch (D27.4) so that
the M4 well-pressure synthesis can cite pages. Format follows `docs/salt-notes/` (record, what it is, equations, numbers,
limits, relevance to Strata Lab); the `refs/<key>.json` files here list claims as `{"id", "claim", "page", "quote"}`
(quote of at most two sentences), not reference lists.

Engine files these notes bear on: `src/engine/wellPressure.ts` (fracture pressure and the mud-weight window),
`src/engine/wellPressureParams.ts` (`fgMethod`, `poissonRatio`, `matthewsKellyKi`), `src/engine/compaction.ts`
(`porosity`, Athy form) with `phi0` and `beta` in `src/engine/params.ts`, and `src/engine/references.ts`.

- `eaton1969.md`: Eaton 1969, fracture gradient prediction, JPT 21(10), 1353-1360 (refs/eaton1969.json). Also the only
  account of Matthews & Kelly 1967 in this project ("via Eaton 1969").
- `traugott1997.md`: Traugott 1997, pore pressure and fracture pressure in deepwater, World Oil deepwater supplement
  (refs/traugott1997.json)
- `hart1995.md`: Hart, Flemings and Deshpande 1995, porosity and pressure in a Gulf Coast Pleistocene basin, Geology
  23(1), 45-48 (refs/hart1995.json)
- `zhang-yin2017.md`: Zhang and Yin 2017, fracture gradient prediction overview and an improved method, Petroleum Science
  (refs/zhang-yin2017.json)
- `alberty-mclean-spe167945.md`: Alberty and McLean 2014, modelling formation-pressure integrity tests, SPE Drilling &
  Completion, December 2014, 431-437 (refs/alberty-mclean-spe167945.json)
- `tahvildari2026.md`: Tahvildari, Shojaei and Masihi 2026, physics-informed ML for pore pressure and fracture gradient in
  carbonates, Scientific Reports, article in press (refs/tahvildari2026.json). Low relevance; one page.

Page conventions: journal pages where the copy prints them (Eaton, Hart, Alberty & McLean); otherwise "pdf p. N" counted
from the first page of the file (Traugott, Zhang & Yin, Tahvildari). Values read off a figure are marked "read from Fig. N"
with a reading tolerance; they are not the authors' tabulated numbers.
