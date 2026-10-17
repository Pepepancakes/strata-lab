# Spike 004: Stokes check of the thin-sheet salt result (S4)

Question: does a full 2D Stokes flow model agree with the thin-sheet engine (spike 003) that the decisive Gulf crest is exposed
from about 26.8 to 54 Myr and then buried? Everything here is offline node, never ships in the app, synthetic data only.

## What is here

- `stokes.js`  2D Stokes solver: staggered grid, variable viscosity, markers carry material, banded direct solve, RK4 advection,
  free surface by a sticky low-viscosity water layer with a surface-stabilisation term (Kaus et al. 2010 style), sediment added
  by turning water markers below a prescribed level into cover. Deterministic (seeded markers).
- `bench.js`, `test.js`  the four benchmarks. `node test.js` (about 3 min) prints the table, exit 0 only if all pass.
- `dump_start.js`  runs the plain Gulf run of spike 003 (`gulfParams({exposed: 1})`, the run `s4-case.json` comes from) to tNear = 24.8 Myr
  and writes `start-gulf.json` (the shared starting state: basement, salt, seafloor, cover per column). It also writes a forcing file
  (seafloor and basement every 0.1 Myr) to the scratch folder, not committed.
- `cases.js`  the two cases. `node cases.js gulf A|B [coverViscosityFactor]`, `node cases.js gl24 A|B`. Env: S4_SCRATCH, S4_CFL, S4_ETAW, S4_TEND, S4_MAXMIN, S4_TAG, S4_UNFILT (1 = raw thin-sheet seafloor as the sediment level, no median filter; `runall-unf.js` launches the six unfiltered Gulf runs).
- `table.js` (the thin-sheet-against-Stokes table, output in `table-gulf.md`), `summary.js`, `cmp.js`, `ser.js`, `plot.py` (needs matplotlib, `uv run --with matplotlib python plot.py`), `results-summary.txt`, `s4-stokes-check.png`.

## Benchmarks (all pass, 12/12)

| check | exact / reference | solver | tolerance |
|---|---|---|---|
| 1 Poiseuille flux | 0.005208 | 0.005215 (0.13 %) | 1 % |
| 2a Rayleigh-Taylor initial growth rate (linear theory, no-slip top and bottom) | 0.01094 | 1.4 % high at 96x104, 3.5 % at 64x70 | 5 % |
| 2b van Keken et al. (1997) case 1a, time of first v_rms peak | 208.99 | 212.27 (1.6 %) | 5 % |
| 2b v_rms at that peak | 0.0031 | 0.00310 | 5 % |
| 3 area per material through the overturn | conserved | 0.003 % of the box | 0.1 % |
| 3 sedimentation area gain | area between old and new surface | 0.19906 vs 0.19934 | 1 % |
| 4 free-surface relaxation time (4 pi eta / (rho g lambda)) | 30.16 kyr | 30.13 kyr (0.1 %) | 10 % |
| bit-identical rerun | | yes | |

Caveat: the van Keken numbers 208.99 and 0.0031 were taken from the Underworld example notebook table (a secondary source),
not from the 1997 paper, which I could not retrieve. Please check against the paper if the benchmark is to be cited.
With free-slip top and bottom the first peak moves to t = 120, so the reference needs no-slip top and bottom, as used here.

## Starting state

Both solvers start from the same section. 24.8 Myr, window columns 226-315 of the thin-sheet run (90 km, x = 226 to 316 km). Salt sheet
over the crest zone, 463 m of cover at the crest at tNear in the thin-sheet run vs 471-480 m in the Stokes start (the markers resolve the
interface to a cell). The Stokes run sees the thin-sheet seafloor (median filtered over 11 columns, plus the mean basement drop) as
the sediment level. Sediment is never removed, and sediment density is Athy compaction with the engine's 35/65 sand/mud mix.

## Results

All Gulf numbers below are the cover over the tracked crest (m of cover between the salt top and the seafloor at the crest), every
run starting from the same 24.8 Myr section. "Filtered" is the first sedimentation law (11-column median of the thin-sheet seafloor);
"UNFILTERED" is the thin-sheet seafloor itself as the sediment level (`S4_UNFILT=1`), the check asked for in review. A and B are the two
resolutions (A 180x38 cells, dx 500 m, dy 250 m; B 270x57 cells, dx 333 m, dy 167 m). The thin-sheet series stops at 54.8 Myr in the
case file, so 60 and 66 Myr are blank for it (the thin sheet is buried at about 560 m by then). Exposed means cover under 50 m, burial
means cover over 100 m for 3 consecutive records after exposure (same rule as S3b). The "min cover" column is the smallest cover over
the crest between 26 and 66 Myr; in brackets the smallest salt cover anywhere in the 262-285 km crest zone.


Reading the table:

- No Stokes run holds the crest exposed. In 11 of 12 runs the cover over the crest never drops below 110 m (the 50 m "exposed" line is
  not reached). The one exception is the filtered x0.1 A run: it touches 36 m in the crest zone and is flagged exposed at 60.3 to 61.3 Myr;
  the B run at the same settings and both unfiltered x0.1 runs do not. The x10 runs show brief shallow touches somewhere in the crest zone
  at the very end (filtered runs, zone minimum 19 to 30 m; unfiltered A 32 m; not at the tracked crest). I treat these as noise (see scatter below), not as exposure.
- The thin sheet has 0 m from 26.8 to 54 Myr; Stokes has 225 to 255 m at 26.8 Myr, 310 to 360 m at 30 Myr and 600 to 670 m at 40 Myr
  (cover viscosity x1, both level laws). There is a real burial peak near 40 Myr that the thin sheet does not have.
- Unfiltered level versus median-filtered level: same picture within the scatter (min cover 127 to 214 m unfiltered against 110 to 186 m
  filtered; cover at 40 Myr 604 to 653 m against 617 to 667 m). The median filter is not what buries the crest.
- Resolution scatter, stated plainly. A and B disagree by up to 100 m for cover x1 (for example 172 against 236 m at 60 Myr, filtered),
  by up to 220 to 280 m for cover x10 (filtered 349 against 567 m at 50 Myr, 345 against 609 m at 60 Myr) and by up to 230 m for x0.1
  (filtered 62 against 296 m at 60 Myr). Changing the advection Courant number (0.5 to 1, run A) moves records by 50 to 100 m. So
  individual values are good to about +-100 to 250 m and the timing of the cover peak moves with cover viscosity and run; the
  conclusion is the absence of exposure, not any single number.
- Finer grid does not make the crest shallower: the minimum cover goes up from A to B (110 to 186 m filtered, 127 to 214 m unfiltered). So
  the 50 m threshold, which is smaller than one B cell (167 m), is not the reason exposure is missing; resolution would make B shallower
  than A if it were.
- Salt area drift over the Gulf runs: -0.2 to +1.3 %, small beside the 100 to 600 m effects.
- Run times: A 14 to 19 min; B 81 to 119 min for the unfiltered runs (six runs sharing the PC) and 45 to 53 min for the filtered B runs
  (fewer parallel jobs). The card's one hour guide was exceeded by the unfiltered B runs because of that sharing.

### Table: cover over the tracked crest (m), thin sheet against Stokes

Burial time is by the S3b rule (exposed at cover under 50 m, then buried at cover over 100 m for 3 records); "none" means the crest was never exposed.

| run | 24.8 | 26.8 | 30 | 40 | 50 | 54 | 60 | 66 | min cover 26-66 Myr | first t cover<50 | burial t |
|---|---|---|---|---|---|---|---|---|---|---|---|
| thin sheet | 468 | 0 | 0 | 0 | 0 | 0 | - | - | 0 | 26.8 | 54.3 |
| **Gulf, filtered level, cover x1** | | | | | | | | | | | |
| gulf-A 180x38 | 480 | 233 | 341 | 617 | 311 | 263 | 172 | 192 | 110 (zone 110) | none | none |
| gulf-B 270x57 | 471 | 228 | 320 | 667 | 350 | 281 | 236 | 246 | 186 (zone 211) | none | none |
| **Gulf, UNFILTERED level, cover x1** | | | | | | | | | | | |
| gulf-A-unf 180x38 | 480 | 253 | 355 | 604 | 330 | 296 | 154 | 235 | 127 (zone 154) | none | none |
| gulf-B-unf 270x57 | 471 | 226 | 314 | 653 | 346 | 246 | 257 | 302 | 214 (zone 214) | none | none |
| **Gulf, filtered level, cover x10** | | | | | | | | | | | |
| gulf-A-cov10 180x38 | 480 | 188 | 311 | 356 | 349 | 339 | 345 | 349 | 165 (zone 30) | none | none |
| gulf-B-cov10 270x57 | 471 | 238 | 306 | 420 | 567 | 559 | 609 | 503 | 216 (zone 19) | none | none |
| **Gulf, UNFILTERED level, cover x10** | | | | | | | | | | | |
| gulf-A-cov10-unf 180x38 | 480 | 211 | 341 | 474 | 590 | 431 | 365 | 409 | 174 (zone 32) | none | none |
| gulf-B-cov10-unf 270x57 | 471 | 164 | 321 | 515 | 599 | 573 | 640 | 548 | 157 (zone 66) | none | none |
| **Gulf, filtered level, cover x0.1** | | | | | | | | | | | |
| gulf-A-cov0.1 180x38 | 480 | 541 | 586 | 343 | 115 | 184 | 62 | 243 | 36 (zone 36) | 60.3 | 61.3 |
| gulf-B-cov0.1 270x57 | 471 | 508 | 604 | 392 | 205 | 202 | 296 | 301 | 186 (zone 186) | none | none |
| **Gulf, UNFILTERED level, cover x0.1** | | | | | | | | | | | |
| gulf-A-cov0.1-unf 180x38 | 480 | 522 | 612 | 302 | 261 | 236 | 365 | 328 | 181 (zone 151) | none | none |
| gulf-B-cov0.1-unf 270x57 | 471 | 484 | 599 | 346 | 211 | 301 | 340 | 303 | 171 (zone 165) | none | none |

Chart: `s4-stokes-check.png` (cover over the crest against time, A and B, filtered and unfiltered, cover viscosity runs, and the GL24-like case).
The table is produced by `node table.js` from the run outputs (`S4_SCRATCH` points at them); `table-gulf.md` is its output.

### GL24-like case (down-building, 200 m/Myr, 100 km box, 50 Myr)

Thin sheet: the crest sits 265 m below the seafloor from 10 Myr on and the source is drained by 3 Myr (thinnest salt 44 m at 10 Myr, 8 m at
50 Myr). Stokes (A 200x52, B 250x65): salt reaches the seafloor by about 1 to 2 Myr and stays there to 50 Myr, standing 30 to 230 m above
the flank seafloor (typical 70 to 110 m, with strong scatter between records), and the thick salt stays thick (snapshots: maximum 12.6 km
at 50 Myr). Salt area drift is -2.2 % (A) and -0.5 % (B).

What this does and does not tell us:
- It does not validate the solver against GL24. The set-up (initial salt thickness, how the sediment level is placed) is mine and I did
  not compare numbers with GL24. I have dropped the "sanity check" label.
- It is a bias check on the Gulf result. The same solver, sticky water and level law keep a salt crest at the seafloor for 50 Myr when the
  source is thick and sediment aggrades, so the Gulf burial is not something the solver produces for any crest.
- It shows that the thin sheet is wrong in the other direction here: it drains the source and buries the crest, where Stokes keeps it up.
  The two models disagree by a large margin in both cases, in opposite senses (thin sheet too exposed in the Gulf case, too buried in the
  GL24-like case).
- The -2.2 % drift comes from the pinched salt (minimum thickness 0 to 3 m in the snapshots at 5 to 20 Myr, below one cell), where markers
  are lost and reseeded. It does not touch the Gulf runs, where the neighbour salt is about 4 km thick and the drift is -0.2 to +1.3 %. It
  does not undermine the Gulf conclusion; it does mean the GL24-like Stokes numbers (relief 30 to 230 m) are not accurate to better than
  the scatter.

## Answer

Is the thin-sheet exposed crest (26.8 to 54 Myr in the Gulf case) geology or a thin-sheet artefact? Most likely an artefact of the thin
sheet, at medium to high confidence for "not exposed for 27 Myr" and low to medium confidence for the actual cover history.

Evidence for: 12 Stokes runs (A and B, filtered and unfiltered level, cover viscosity x1, x10, x0.1) hold the crest under at least 110 m of
cover through the whole 26.8 to 54 Myr window (one filtered A run touches 36 m in the zone only at 60 Myr); the burial peak near 40 Myr
of 600 to 670 m at cover x1 is not in the thin sheet at all; the minimum cover rises with resolution, so it is not a resolution limit;
the same solver keeps a crest at the surface in the GL24-like case, so it is not biased to bury.

Evidence against certainty: Newtonian viscous cover only (GL24 stress that cover viscosity matters and a brittle cover with faults could
behave differently); one starting section; resolution scatter of 100 to 250 m between A and B at some times; the cover history (when the
peak occurs, how deep it gets) is not converged, so only "buried, not exposed" is supported; plane strain; no dissolution.

The Stokes crest is also not keeping pace with the seafloor in the Gulf case: it sits 110 to 670 m deep and falls behind the seafloor
(relief against the flank is negative, down to about -490 to -640 m near the peak). So the answer to the card's question is neither
of the two alternatives: not "buried within a few Myr after a long exposure", and not "keeps pace for tens of Myr".

### What it means for M3b options C and D (recommendation only, John decides)

- Gulf-type salt sheet (the case in the card): neither C nor D is needed to get the first-order answer. The thin sheet over-states
  exposure, so a source feed into stems (C) would push the model further from Stokes there. If the product shows exposed crests, label
  the exposed duration as an upper bound, or cap it (a rule that a crest cannot stay at zero cover for tens of Myr).
- GL24-like down-building with a thick source: the thin sheet drains the source and under-states how long a diapir stays at the seafloor, so
  C (a source feed into stems) is the cheap fix for that case, and only for that case.
- D (a Stokes solver in the product) is the only option that gets both cases right from one model. It is a large step and the spike
  shows the cost (minutes to an hour and more per run in node, no real-time use). My recommendation: neither C nor D for the Gulf
  work now; take C only if GL24-style stem growth is a product goal; keep D as the long-term answer if both behaviours are needed.

## Limits

Plane strain; Newtonian salt and cover unless stated (no power-law run, the optional n = 5 run was not done); no dissolution; no
faults or brittle failure in the cover; viscous cover; prescribed sediment level (from the thin-sheet run); sediment never removed (no
erosion or slumping); compaction through an Athy density only; sticky-water free surface (water viscosity 1e16 Pa s, a tuned
choice; the free-surface benchmark used a sticky layer of eta/1000 with theta 0.5, so the 1e16 value itself is not benchmarked, only tried at 1e15 to 1e17 early on); marker-in-cell, so salt area drifts by up to 1.3 % (Gulf) and 2.2 % (GL24-like A);
one start section; resolution scatter of 100 to 250 m.

## Open questions for John

1. The van Keken reference values (time 208.99, v_rms 0.0031) are from the Underworld example notebook, a secondary source; I tried a
   second search for the 1997 paper and a primary table and did not find one that I could read. Check against the paper before citing.
2. Is a brittle or plastic cover (GL24 mention it) a case you want checked? It would change the conclusion if the cover can open over
   the crest.
3. A second window or a second Gulf crest would test whether this is general (one start section here).
