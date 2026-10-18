# LIT-PP-4: citation check of the pore-pressure literature review (D27.4)

Reviewer: safety-reviewer (independent). Branch `strata-lab/lit-pp-04-check`, which merges
`strata-lab/lit-pp-03-synthesis` (eca57dc). Scope: `docs/pp-literature.md` sections 2, 4, 5, 7, 8 and 10 in full, a
seeded random sample of 25 further citations, section 7 against the engine source, section 10 for pick-versus-tuning,
and a privacy pass over every file changed since main. Nothing in `docs/pp-literature.md` or `docs/pp-notes/` was
edited by this card.

## Method

- Full texts: the extracted text of each source (one file per paper, pages split on form feeds), searched by regular
  expression with the printed page computed from the pdf index. Page offsets were confirmed on page images: Eaton
  pdf 1 = p. 1353 (header on every page), Hart pdf 2 = p. 45 (pdf 1 is the download cover; footer "46 GEOLOGY,
  January 1995" on pdf 3), Hauser 2020 MPG pdf 1 = p. 105, Alberty & McLean pdf 1 = p. 431 (footer "435" on pdf 5),
  IOGP, Hauser SPE, Traugott, Zhang & Yin, Tahvildari and the preprint pdf = printed or pdf page as the review states.
- Figure readings (Eaton Figs. 3, 4, 6, 7; Hart Figs. 1-2; Alberty & McLean p. 435) were checked on page images
  rendered with PyMuPDF at 110-220 dpi; renders deleted at the end.
- Sample: all 365 citation instances were extracted from `docs/pp-literature.md` with the review's own syntax
  (`KEY p. N` / `KEY pdf p. N`); the 156 instances outside the fully checked sections (sections 1, 3, 6, 9, 11 and
  the summary) were the pool; `random.seed(20261017); random.sample(pool, 25)`.
- Gates on Windows node 26.7: `npm ci` exit 0; `npm run check` exit 0 (typecheck, lint, vitest main 483 passed /
  1 skipped in 44 files, wallclock 89 passed / 1 skipped). Linux parity not run (no code or tests changed).

## Findings

| Id | Severity | Claim in the review | What the source says (page) | Fix |
|---|---|---|---|---|
| F1 | BLOCKING | Hart et al. Eqs. 1-3, Fig. 2 and the coefficients phi_0 = 0.40, beta = 3.68 x 10^-2 MPa^-1 are on **p. 45** (`pp-literature.md` lines 11, 48, 53, 58, 62, 102, 121, 146, 147, 173, 257; `hart1995.md` lines 34-36, 48-49, 92), and line 270 says `presets.ts` line 76 and D27.1 are wrong to cite p. 46 | Printed p. 45 (pdf 2) holds the abstract, introduction, Fig. 1 and the first lines of "Porosity and pressure model"; equations (1), (2), (3), Fig. 2 and its caption, "3.68 x 10^-2 MPa^-1, and phi_0 of 0.40", Issler's 220 microseconds/m and x = 2.19, and the 10.5 MPa/km gradient are all on printed **p. 46** (pdf 3, footer "46 GEOLOGY, January 1995"). `presets.ts` line 76 (aud-03 branch) and D27.1 are correct. | Change "H95 p. 45" to "H95 p. 46" wherever it cites Eqs. 1-3, Fig. 2 or the coefficients (11 places in the review, 6 in the note); "pp. 45-46" at line 11 and "pp. 45, 47" stay valid only where p. 45 is used for the abstract (overpressure below 2 km, three-quarters disequilibrium). Delete or reverse the "Hart page" item at line 270 and the matching key finding in the LIT-PP-3 handoff. Regenerate the citation map counts. |
| F2 | BLOCKING | Public-repo privacy: the review says "no affiliations or addresses" (line 275), but the notes it merges carry author affiliations and a personal-communication name | `hart1995.md` 8-9 (Pennsylvania State University), `alberty-mclean-spe167945.md` 8 (Hess Corporation; consultant), `hauser-spe2020-stress.md` 8 (Shell Exploration and Production Company), `hauser-couzens-effective-stress.md` 8 (Shell International Exploration and Production, Houston; "corresponding"), `tahvildari2026.md` 9 (University of Tehran; Sharif University), `refs/hart1995.json` quote with "Steven Losh, 1994, personal commun." | Strip the affiliations from the five Record lines (authors' names and year suffice; the house rule forbids affiliations in committed files), and cut the quoted sentence in `refs/hart1995.json` before the parenthesis. Nothing else about the authors remains. |
| F3 | NON-BLOCKING | Alberty & McLean: "sands carry a lower minimum stress than shale" cited to **p. 434** (lines 75, 205, 267; `alberty-mclean-spe167945.md` line 98) | The sentence "sands are generally subject to a lower minimum Earth stress than shale, hence the success of the fracture-stimulation industry" is on printed **p. 435** (pdf 5, footer "435"), first bullet of the left column. The closure quote at p. 431 is correct. | p. 434 -> p. 435 in the three review lines and the note. |
| F4 | NON-BLOCKING | Eaton's Gulf Coast Poisson's ratio curve "runs from 0.25 near 1,000 ft to 0.50 at 20,000 ft" (lines 9, 93) | Fig. 4 (p. 1356): the Gulf Coast variable-overburden curve starts at about 0.28 at 1,000 ft (0.31 at 2,000 ft, 0.40 at about 6,000 ft, 0.45 at 10,000 ft, approaching the 0.5 "extreme upper limit" at 20,000 ft). 0.25 is the West Texas constant line, not the start of the Gulf curve. Line 157 ("0.31 to 0.50 over 2,000 to 20,000 ft") and QC item 15 ("0.25-0.50" as the range of the figure) are consistent with the figure. | At lines 9 and 93 write "about 0.28 near 1,000 ft" (or "0.31 at 2,000 ft" as line 157 does). |
| F5 | NON-BLOCKING | Section 7 line references into `wellPressureParams.ts`: 207-208, 209-210, 211-212, 213-216, 217-218 (lines 141-145) | The file is 62 lines; `fgMethod` is line 29, `poissonRatio` 31, `matthewsKellyKi` 33, `lowerMarginPpg` 35, `upperMarginPpg` 37, `tightWindowPpg` 39. The `wellPressure.ts` (13, 19-21, 93-95, 98-100, 135-136) and `compaction.ts` (30-32, 198-200, 204-206) references are correct. | Replace the five line numbers. |
| F6 | NON-BLOCKING | "Gulf mud phi0 0.40, beta 3.68e-8 /Pa (`presets.ts` 77, D27.1)" (line 147) | On main and on this branch `presets.ts` line 77 is the Gulf salt note; the Hart pair is on the unmerged `strata-lab/aud-03-gulf-compaction` branch (lines 76-79). | Say "presets.ts on the aud-03 branch" or cite D27.1 alone until that branch lands. |
| F7 | NON-BLOCKING | Surface-casing depth: "3,000 ft is the one published example (E69 p. 1358)" (line 254) | Eaton's worked example sets surface pipe at **3,100 ft** (p. 1357 text, "In the example of Fig. 9, surface pipe was set at 3,100 ft"; figure on p. 1358). Line 252 says 3,100 ft correctly. | 3,000 -> 3,100 at line 254. |
| F8 | NON-BLOCKING | Hauser 2020 SPE p. 5 cited for "Shmin follows nu/(1-nu) with the present nu whatever the loading history" (line 95) | p. 5 derives the differential form with an irreversible-consolidation term and then argues (Prats 1981) that with only the elastic term it integrates to Eq. 11 with the present nu; "regardless of loading history" is the note's gloss (`hauser-spe2020-stress.md` line 23), not the paper's words. Supported in substance; wording is stronger than the page. | Optional: "argues it integrates back to Eq. 11 (p. 5)". |

Everything else checked in sections 2, 4, 5, 7, 8 and 10 agrees with the sources at the cited page, including: Eaton
Eq. 1 and the Hubbert & Willis constants (p. 1354), the Matthews & Kelly procedure with D_i = sigma/0.535 and Eaton's
recommendation to read K_i at the actual depth (p. 1355), Fig. 3 (K_i = 0.60 at about 5,000 ft on the right-hand
curve and about 6,000 ft on the left-hand curve; the review's 6,500 ft is within reading tolerance), Fig. 7 overburden
gradient 0.85 / 0.92 / 0.95 / 1.00 psi/ft at 0 / 6,000 / 10,000 / 20,000 ft (p. 1357, within +/- 0.01), Traugott's
k = 0.039 (D - W/4 - A)^0.33, the equivalent-depth formula with 8.5 ppg, 19.25 ppg per psi/ft and the overburden trend
(pdf pp. 1-2), Zhang & Yin's k0 0.5-1 average 0.75, Eq. 15 constants (0.75, 0.15, 7,200 ft), nu 0.43 / 0.3 and the
"may not be the breakdown pressures" caveat (pdf pp. 4, 6, 7), Hauser MPG Table 1 (0.0189 MPa/m = 0.837 psi/ft,
-2.38 MPa = -345 psi, p. 110), 1.07 g/cc / 0.465 psi/ft brine (p. 112), 2.17 and 2.168 g/cc salt, 0.04 g/cc and
0.48 MPa (70 psi) (p. 108), isotropic stress equal to overburden in salt (p. 107), Hauser SPE Terzaghi definition and
Eq. 11 (p. 4), the Eaton critique (p. 6), 4 % SD / 10 % maximum (p. 8), tabular-salt proximity (29 % within 2,500 m,
8 % within 2,000 m, p. 11), IOGP's effective stress ratio (Shmin - P)/(Sv - P) (p. 7), secondary mechanisms (p. 12),
salt and anhydrite FG at or above vertical stress with the 500-800 psi tensile term (p. 15), the centroid projection
citing Flemings 2021 (p. 21), the green/yellow/red alerts (p. 33), the preprint's Biot Eq. 1 (pdf p. 4) and the
resistivity flat-part argument (pdf pp. 8, 14), and Tahvildari's RMSE 0.7-1.1 MPa and 0.45 MPa (pdf p. 2).

## Random sample (seed 20261017, 25 of 156 pool instances)

| # | Line | Citation | Result |
|---|---|---|---|
| 1 | 7 | T97 pdf p. 2, "standard fracture gradient formula" | correct |
| 2 | 9 | E69 p. 1356, nu curve 0.25 to 0.50 | page correct; start value misread (F4) |
| 3 | 32 | T97 pdf p. 1, 1 psi/ft = 19.25 ppg | correct |
| 4 | 40 | IOGP p. 21, sand pressure by fluid gradient or centroid, citing Flemings 2021 | correct |
| 5 | 42 | Hau20a pp. 110-111, 345 psi below confining stress, 0.837 psi/ft | correct |
| 6 | 58 | H95 p. 45, Eq. 3 inversion | page wrong, p. 46 (F1) |
| 7 | 60 | HCS p. 8, p. 14, resistivity insensitive above 10-15 % porosity | correct |
| 8 | 61 | Hau20b p. 8, 4 % SD, about 10 % maximum | correct |
| 9 | 61 | Tah26 pdf p. 2, RMSE 0.7-1.1 MPa and 0.45 MPa | correct |
| 10 | 99 | ZY17 pdf p. 6, "may not be the breakdown pressure" | correct (paper: "pressures") |
| 11 | 102 | Hau20b p. 4, Terzaghi | correct |
| 12 | 110 | ZY17 pdf p. 4, apparent nu 0.43 for shale | correct |
| 13 | 114 | Hau20b p. 11, negligible for tabular salt | correct (29 % within 2,500 m, no residual correlation) |
| 14 | 188 | T97 pdf p. 1, overburden from the derrick floor with the water column | correct |
| 15 | 195 | Hau20a p. 112, brine 1.07 g/cc | correct |
| 16 | 196 | IOGP pp. 12, 22, secondary mechanisms | correct |
| 17 | 202 | E69 p. 1354, effective-stress-ratio form | correct |
| 18 | 202 | ZY17 pdf p. 4, Eqs. 3-4 | correct |
| 19 | 204 | ZY17 pdf p. 6, Eqs. 12-14 upper and lower bounds | correct |
| 20 | 205 | AM14 p. 434, stress ratio per lithology | page wrong, p. 435 (F3) |
| 21 | 205 | ZY17 pdf p. 4, 0.43 shale / 0.3 sandstone | correct |
| 22 | 206 | ZY17 pdf p. 6, 0.5-1, average 0.75 | correct |
| 23 | 208 | Hau20a p. 107, stress in salt isotropic and equal to overburden | correct (a stress statement, used as FG support; the inference is stated) |
| 24 | 208 | ZY17 pdf p. 7, FG in salt (Eq. 17) | correct |
| 25 | 209 | Hau20b p. 11, stress perturbation near salt | correct |

Sample result: 23 correct, 2 page wrong (both the same two pages as F1 and F3), 0 claim not supported, 0 misquoted.
Sample page-error rate 8 % (2 of 25); both errors are systematic (one source page each), not scattered.

## Section 7 against the engine

Read on this branch: `src/engine/wellPressure.ts`, `wellPressureParams.ts`, `compaction.ts`, `presets.ts`,
`params.ts`, `constants.ts`. Every "same form and units" verdict holds: `fracturePressurePa = k (S - P) + P` is
Eaton Eq. 1 times depth, Traugott's F = k (O - P) + P, Zhang & Yin Eqs. 3-4, IOGP's ratio definition and Hauser SPE
Eq. 11 plus P; `eatonK = nu / (1 - nu)`; salt returns `sv` for both methods; `porosity = phi0 exp(-beta s)` with `s`
the running maximum effective stress is Hart Eq. 1 in Pa; the clamp `uu = L[m]` with `diag.clamps++` is at
`compaction.ts` 198-200; `RHO_W = 1025` at `constants.ts` 6; defaults `poissonRatio` 0.4, `matthewsKellyKi` 0.6,
margins 0, `tightWindowPpg` 0.5 as stated. Line references wrong only as F5 and F6 say.

## Section 10

Each item lists options and ONE recommended pick with a reason tied to cited pages; none of the recommendations
introduces a new numeric default. The one number offered as a possible default (surface casing 3,000 ft, item d) is
explicitly labelled "would be labelled tuned" and is itself off by 100 ft (F7). Option B under item (e) (Hart's
second curve) is correctly described as tuning by another name and not recommended. Picks are picks, not tuning.

## Privacy and public repo

No local paths, OneDrive or AppData strings, emails or URLs other than DOIs in any changed file. The preprint is
labelled "SSRN preprint, not peer reviewed" in the access table and at each use. Quotes are one to two sentences.
Author affiliations remain in five notes and a personal-communication name in one quote: F2.

## Summary counts

- Sections 2, 4, 5, 7, 8, 10 full check: 2 BLOCKING (F1 Hart page, F2 affiliations), 6 NON-BLOCKING (F3-F8).
- Random sample: 25 drawn, 23 correct, 2 page wrong, 0 unsupported, 0 misquoted.
- Section 7 form-and-units verdicts: 23 rows, all confirmed; 2 rows with stale file line references.
- Section 10: 6 lettered items plus 7 "other" lines, all picks with reasons, none tuned.
- Open question resolved: the Hart coefficients are on p. 46, as `presets.ts` (aud-03) and D27.1 already say; the
  LIT-PP-3 "key finding" to the contrary should be withdrawn.

VERDICT: REQUEST CHANGES

BLOCKING list and minimum fix:
1. F1: in `docs/pp-literature.md` and `docs/pp-notes/hart1995.md` cite Hart's Eqs. 1-3, Fig. 2 and the coefficients to
   p. 46, not p. 45; remove the "Hart page" item (line 270) and withdraw the handoff finding; regenerate
   `citation-map.md` counts.
2. F2: remove author affiliations from the Record lines of `hart1995.md`, `alberty-mclean-spe167945.md`,
   `hauser-spe2020-stress.md`, `hauser-couzens-effective-stress.md`, `tahvildari2026.md`, and the personal-
   communication clause from the quote in `refs/hart1995.json`.
