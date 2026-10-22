# Pore-pressure and fracture-gradient reading notes

One note per paper, each with a claims extraction in `refs/`. Written from full texts for the LIT-PP batch (D27.4) so that
the M4 well-pressure synthesis (`docs/pp-literature.md`) can cite pages and check M4's overburden, pore pressure and
fracture gradient against recommended practice, and answer what happens near and below salt. Format follows
`docs/salt-notes/` (record, what it is, equations, numbers, limits, relevance to Strata Lab); the `refs/<key>.json` files
here list claims as `{"id", "claim", "page", "quote"}` (quote of at most two sentences), not reference lists.
`citation-map.md` lists every citation used in `docs/pp-literature.md` with its note and page.

Engine files these notes bear on: `src/engine/wellPressure.ts` (fracture pressure and the mud-weight window),
`src/engine/wellPressureParams.ts` (`fgMethod`, `poissonRatio`, `matthewsKellyKi`), `src/engine/compaction.ts`
(`porosity`, Athy form) with `phi0` and `beta` in `src/engine/params.ts`, and `src/engine/references.ts`.

LIT-PP-2a (fracture-gradient and compaction papers):

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

LIT-PP-2b (practice and salt papers):

- `iogp608.md`: IOGP Report 608 (2022), Recommended practice for pore pressure and fracture gradient analysis
  (refs/iogp608.json). Section 4 is the checklist of what a pre-drill PPFG forecast must show.
- `hauser-salt-sealed.md`: Hauser 2020, Pore pressure estimation in salt-sealed formations, Marine and Petroleum Geology
  111, 105-115 (refs/hauser-salt-sealed.json)
- `hauser-spe2020-stress.md`: Hauser 2020, Evaluating an integrated physical model for borehole-leakoff pressures, SPE
  Journal, SPE 204453 (refs/hauser-spe2020-stress.json)
- `hauser-couzens-effective-stress.md`: Hauser and Couzens-Schultz, Can compaction modeling and pore pressure prediction
  be simplified by the definition of effective stress? SSRN preprint 5128263, not peer reviewed
  (refs/hauser-couzens-effective-stress.json)
- `yang-aplin-2010.md`: Yang and Aplin 2010, A permeability-porosity relationship for mudstones, Marine and Petroleum
  Geology 27, 1692-1697
- `yang-aplin-2004.md`: Yang and Aplin 2004, Definition and practical application of mudstone porosity-effective stress
  relationships, Petroleum Geoscience 10, 153-162

Page conventions: journal pages where the copy prints them (Eaton, Hart, Alberty & McLean, Hauser 2020 MPG); otherwise
"pdf p. N" counted from the first page of the file (Traugott, Zhang & Yin, Tahvildari) or the page numbering each note
states (IOGP 608, Hauser SPE 2020, the preprint). Values read off a figure are marked "read from Fig. N" with a reading
tolerance; they are not the authors' tabulated numbers.
