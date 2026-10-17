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
- S4b (fixed-spike rerun): `dump_s4b.js`, `analyse_s4b.js`, `s4b-case*.json`, `s4b-results-*.md`, see the S4b section below.
- `table.js` (the thin-sheet-against-Stokes table, output in `table-gulf.md`), `summary.js`, `cmp.js`, `ser.js`, `plot.py` (needs matplotlib, `uv run --with matplotlib python plot.py`), `results-summary.txt`, `s4-stokes-check.png`.

## Benchmarks (all pass, 12/12)

| check | exact / reference | solver | tolerance |
|---|---|---|---|
| 1 Poiseuille flux | 0.005208 | 0.005215 (0.13 %) | 1 % |
| 2a Rayleigh-Taylor initial growth rate (linear theory, no-slip top and bottom) | 0.01094 | 1.4 % high at 96x104, 3.5 % at 64x70 | 5 % |
| 2b van Keken et al. (1997) case 1a, time of first v_rms peak (secondary value, see caveat) | 208.99 | 212.27 (1.6 %) | 5 % |
| 2b v_rms at that peak (secondary value) | 0.0031 | 0.00310 | 5 % |
| 3 area per material through the overturn | conserved | 0.003 % of the box | 0.1 % |
| 3 sedimentation area gain | area between old and new surface | 0.19906 vs 0.19934 | 1 % |
| 4 free-surface relaxation time (4 pi eta / (rho g lambda)) | 30.16 kyr | 30.13 kyr (0.1 %) | 10 % |
| bit-identical rerun | | yes | |

Caveat (SALT-R1 S4-1): cite the benchmark as "van Keken et al. (1997) case 1a, values as tabulated in the Underworld and ASPECT example
documentation (secondary)". The numbers 208.99 and 0.0031 were taken from the Underworld example notebook; the SALT-R1 reviewer found the
same pair in the Underworld documentation (example 1_06) and the ASPECT cookbook (first peak within 1 % of the paper). None of the three
is the 1997 paper, which neither of us could retrieve. The values are therefore secondary until someone checks the paper.
With free-slip top and bottom the first peak moves to t = 120, so the reference needs no-slip top and bottom, as used here.

## Starting state

Both solvers start from the same section. 24.8 Myr, window columns 226-315 of the thin-sheet run (90 km, x = 226 to 316 km). Salt sheet
over the crest zone, 463 m of cover at the crest at tNear in the thin-sheet run vs 471-480 m in the Stokes start (the markers resolve the
interface to a cell). The Stokes run sees the thin-sheet seafloor (median filtered over 11 columns, plus the mean basement drop) as
the sediment level. Sediment is never removed, and sediment density is Athy compaction with the engine's 35/65 sand/mud mix.

Two things about this start section (SALT-R1, S4 section and S3-4):
- It inherits a hole. The thin-sheet run it was cut from had the S3b bypass bug (fixed in S3c, see spike 003 README). Crest 13 (column 230,
  exposed from 13.3 Myr) lies inside the window (columns 226 to 315) and sits in a seafloor hole of order 100 m at 20 Myr. The 11-column
  median filter removes a one-column hole from the sediment level; the unfiltered runs carry it. Both give the same burial verdict at the
  x1 crest, so the verdict does not depend on it. S4 was not rerun on a fixed start section there; S4b (below) does that.
- The thin-sheet comparison case ("exposed 26.8 to 54 Myr at x1", crest 21, column 270/271, `s4-case.json`) is a Windows-only realisation
  of the spike (Windows, node 26). On Linux (WSL, node 22) crest 21 is never exposed; it is buried from 24.8 Myr on (D16.4, noise-sensitive
  single crest). The S4 answer does not change, because on Linux the thin sheet keeps that crest buried too.

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

Is the thin-sheet exposed crest (26.8 to 54 Myr in the Gulf case, Windows run) geology or a thin-sheet artefact? Most likely an artefact, at
medium to high confidence for "not exposed for 27 Myr" and low to medium confidence for the actual cover history. SALT-R1 identified the
mechanism: the exposed-salt bypass rule of spike 003 kept a seafloor hole open (fixed in S3c). The Stokes crest is buried throughout, with a
cover of order 100 to 700 m that is not converged.

Evidence for: 12 Stokes runs (A and B, filtered and unfiltered level, cover viscosity x1, x10, x0.1) hold the crest under at least 110 m of
cover through the whole 26.8 to 54 Myr window (one filtered A run touches 36 m in the zone only at 60 Myr); the burial peak near 40 Myr
of 600 to 670 m at cover x1 is not in the thin sheet at all; the minimum cover rises with resolution, so it is not a resolution limit;
the same solver keeps a crest at the surface in the GL24-like case, so it is not biased to bury.

Evidence against certainty: Newtonian viscous cover only (GL24 stress that cover viscosity matters and a brittle cover with faults could
behave differently); one starting section; resolution scatter of 100 to 250 m between A and B at some times; the cover history (when the
peak occurs, how deep it gets) is not converged, so only "buried, not exposed" is supported; plane strain; no dissolution.

The Stokes crest is also not keeping pace with the seafloor in the Gulf case: it sits about 110 to 670 m deep and falls behind the seafloor.
The relief against the flank at the peak is a range across the two grids (about -490 to -640 m, with an A/B scatter of 100 to 350 m); only
its sign is supported, not the numbers. So the answer to the card's question is neither
of the two alternatives: not "buried within a few Myr after a long exposure", and not "keeps pace for tens of Myr". It is buried throughout,
with a cover of order 100 to 700 m that is not converged.

### What it means for M3b options C and D (recommendation only, John decides)

- Gulf-type salt sheet (the case in the card): neither C nor D is needed to get the first-order answer. The thin sheet over-states
  exposure, so a source feed into stems (C) would push the model further from Stokes there. If the product shows exposed crests, label
  the exposed duration as an upper bound, or cap it (a rule that a crest cannot stay at zero cover for tens of Myr).
- GL24-like down-building with a thick source: the thin sheet drains the source and under-states how long a diapir stays at the seafloor, so
  C (a source feed into stems) is the cheap fix for that case, and only for that case.
- D (a Stokes solver in the product) is the only option that gets both cases right from one model. It is a large step and the spike
  shows the cost (minutes to an hour and more per run in node, no real-time use). My recommendation: neither C nor D for the Gulf
  work now; take C only if GL24-style stem growth is a product goal; keep D as the long-term answer if both behaviours are needed.

## S4b: one Stokes rerun from the fixed spike 003 (SALT-R2 N-3, D23)

Why: the S4 answer above used a start section cut from the pre-fix spike (it carried crest 13's hole) and compared a crest (id 21, exposed
26.8 to 54 Myr) that no longer exists after the S3c fix. SALT-R2 said what would change its answer: a Stokes run from a fixed start section
that keeps the crest at the surface for more than about 5 Myr, or a Stokes crest that also falls about 30 m/Myr. This is that run. Nothing
here builds anything for option C.

Files: `dump_s4b.js` (runs the fixed spike 003 Gulf run, `gulfParams({exposed: 1})`, tracks crests with the spike's own `crestlog.js`, writes the
start section and the thin-sheet series of the followed crest to `s4b-case.json`; the seafloor and basement per record step go to the
scratch folder as `forcing-s4b.json`, not committed), `analyse_s4b.js` (tables), `cases.js` (new env `S4B=1` selects the S4b start and forcing;
`S4B_CASE=<file>` selects another case file), `s4b-case.json` (Windows, node 26), `s4b-case-linux.json` (Linux, node 22), `s4b-results-windows.md`
and `s4b-results-linux.md` (the full tables). Spike 003 code is not changed.

Commands (Windows; the Linux line differs only in the crest id and the output file):

    node dump_s4b.js                                   (crest 26, writes s4b-case.json)
    S4B_OUT=... node dump_s4b.js 83                    (Linux: crest 83)
    S4B=1 S4_TAG=-s4b node cases.js gulf A 1           (case A, cover viscosity x1)
    node analyse_s4b.js                                (tables)

Start section. Fixed spike 003 Gulf run, state at 24.9 Myr, window columns 226 to 315 (90 km, x = 226 to 316 km) of the 211 to 331 cut, the same
window and cut as S4. Why 24.9 Myr: it is the time at which the followed crest (Windows id 26) first has under 500 m of cover (`tNear`
24.9 in `gulf-crests.csv`), so the start section is the same kind of start as S4 used for crest 21 (24.8 Myr). The Linux equivalent, id 83, first
comes within 500 m at 26.9 Myr, so the Linux case starts there (a different start, D16.4).

Crest followed. Windows: id 26 (start column 270, x = 270.5 km, moves to column 275; exposed 27.5 to 33.7 Myr, 6.2 Myr; buried at 60.9 Myr) as
primary, as the card says. Thin sheet: the spike's `crestlog.js` follows it (the lowest-cover salt column within 3 columns per 0.1 Myr). Stokes: the
highest salt top within 4 km of the previous crest position, every 0.5 Myr (same rule as S4). Linux: id 83 (start column 270, ends column 273, exposed 29.3 to
31.3 Myr = 2.0 Myr, buried at 56.1 Myr). The thin-sheet series reproduces SALT-R2 exactly (27.5, 60.9, 6.2 on Windows).

Settings (S4 case A, cover viscosity x1, the rest unchanged): grid 180 x 37 cells, dx 500 m, dy 249 m (Linux 180 x 36, dy 253 m); box 90 km by
9.2 km; Newtonian salt 1e18 Pa s, density 2160 kg/m3; cover 1e19 Pa s (the spike's `coverVisc`), Athy density with the 35/65 sand/mud mix; sticky
water 1e16 Pa s; free-slip top, no-slip bottom; surface stabilisation theta 0.5; advection Courant number 0.5; 5 x 5 markers per cell, seed 4321;
maximum step 0.2 Myr; records every 0.5 Myr; sediment level = the thin-sheet seafloor of the same fixed run, median filtered over 11 columns, plus the
mean basement drop; the sediment is never removed. Run to 66 Myr.

Benchmarks before the run: `node test.js` 12/12 pass (Windows, node 26, 81 s; Linux, node 22, 12/12). Run time: Windows 8.9 min, Linux 7.1 min (both
well under the 2 hour guide).

Windows (node 26), crest id 26, thin sheet against Stokes. Cover over the crest:

| t Myr | thin cover m (ft) | Stokes cover m (ft) |
|---|---|---|
| 24.9 | 427 (1,401) | 430 (1,410) |
| 26 | 271 (889) | 173 (567) |
| 27.5 | 0 (0) | 229 (752) |
| 30 | 0 (0) | 301 (988) |
| 34 | 0 (0) | 499 (1,638) |
| 40 | 69 (226) | 612 (2,007) |
| 45 | 149 (488) | 589 (1,934) |
| 50 | 229 (751) | 323 (1,061) |
| 55 | 340 (1,116) | 223 (730) |
| 60 | 471 (1,545) | 257 (842) |
| 60.9 | 501 (1,645) | 152 (500) |
| 66 | not run | 262 (859) |

| measure (Windows, node 26) | thin sheet | Stokes |
|---|---|---|
| time with cover under 2 m (the spike's roofMin) | 6.2 Myr | 0 records of 83 |
| time with cover under 50 m | 11.8 Myr | 0 records |
| cover range 24.9 to 60.9 Myr | 0 to 501 m (0 to 1,644 ft) | 138 to 687 m (453 to 2,254 ft); lowest record of the whole run 105 m (344 ft) at 61.4 Myr |
| salt-top rise relative to the flank, F - A, 55.9 to 60.9 Myr (thin sheet falling) | -28.1 m/Myr (-92 ft/Myr) | +4.9 m/Myr (+16 ft/Myr) |
| F - A, whole 24.9 to 60.9 Myr | -11.8 m/Myr (-39 ft/Myr) | +4.2 m/Myr (+14 ft/Myr) |
| F - A, first 10 Myr, 24.9 to 34.9 | +28.9 m/Myr (+95 ft/Myr) | -31.4 m/Myr (-103 ft/Myr) |
| relief (salt top minus flank seafloor) range 24.9 to 60.9 Myr | -500 to +25 m (-1,640 to +82 ft) | -699 to -194 m (-2,293 to -636 ft) |

Linux (node 22), crest id 83, start 26.9 Myr: thin sheet exposed under 2 m for 2.0 Myr (6.9 Myr under 50 m), cover 0 to 501 m up to the 56.1 Myr
burial. Stokes: cover 400 m at 27 Myr, 212 m at 28, 318 m at 30, 616 m at 40, 309 m at 50, 133 m at 60 Myr, 101 m at 66; 0 records under 50 m at
the followed crest, 2 records under 100 m, both late (78.9 m at 64.4 Myr and 62.1 m at 64.9 Myr, 8 Myr after the thin-sheet burial); the cover range over 26.9 to 56.1 Myr is 165 to 645 m (541 to 2,116 ft). In the
crest zone (262 to 285 km) the smallest cover was 45 m at 65.4 Myr, one record, at 279 km, 9 Myr after the thin-sheet burial; treat it as a brief
touch inside the scatter, not as exposure (the same kind of touch S4 saw in its x10 and x0.1 runs). F - A for Stokes: -32.1 m/Myr over the first 10 Myr
(thin sheet +13.4), +17.1 m/Myr over the last 5 Myr before the thin-sheet burial (thin sheet -23.1), +3.7 whole phase (thin sheet -15.5).

Mass balance (Stokes salt area, marker-in-cell): Windows +0.99 % (159.35 to 160.92 km2); Linux +0.78 % (179.57 to 180.98 km2). Thin sheet: relative
mass error 1.4e-14 total, 3.6e-15 for salt (Windows). Both are small beside the 100 to 600 m cover effects.

Answer (one paragraph). **No on both counts.** Stokes does not keep the crest at the surface: in the Windows run the crest has at least 138 m (453 ft) of
cover at every one of the 83 records to 66 Myr (at least 138 m, 453 ft, up to the thin-sheet burial at 60.9 Myr), against 6.2 Myr under 2 m in the
thin sheet; on Linux it is the same through the thin-sheet window (165 m or more up to 56.1 Myr), with 0 records under 50 m at the crest (two late
records at 79 and 62 m at 64.4 and 64.9 Myr, and a 45 m touch in the crest zone at 65.4 Myr, all 8 to 9 Myr after the thin sheet buried its crest).
SALT-R2's first condition (surface for more than about 5 Myr) is not met, with a margin of 100 m or more through the thin-sheet window. The second condition (a Stokes crest that also falls about 30 m/Myr) is not met in the window that matters:
over the last 5 Myr before the thin-sheet burial the thin sheet falls 28 m/Myr (Windows) relative to the flank, while the Stokes crest rises relative
to it, +5 m/Myr (Windows) and +17 m/Myr (Linux). The one 30 m/Myr fall Stokes does show is in the first 10 Myr (-31 m/Myr Windows, -32 Linux), which is
the flank aggrading at 35 to 38 m/Myr past a salt top that rises only 2 to 7 m/Myr; the thin sheet rises 36 and 25 m/Myr in the same window, so the two
models disagree about that period too. Both models do bury the crest, but by different paths: the thin sheet exposes it, then loses it by a steady
fall to 500 m; Stokes never exposes it, buries it deepest near 40 Myr (612 m Windows, 616 m Linux, 2,000 ft) and then lets it shoal again to 100 to
260 m. So the thin sheet's exposed episode (2 to 6 Myr) is a thin-sheet feature that Stokes does not reproduce, and the burial itself (100 m or more of cover on
the Windows crest for the whole run) is supported by Stokes. Confidence: medium to high for "Stokes does not hold the crest at the
surface" (two platforms, two start sections, the same verdict as the 12 S4 runs on the older start section); low for the cover history and the rates
(one run per platform, resolution scatter of 100 to 250 m between A and B in S4, a crest tracker that wanders
between 264 and 291 km as the Stokes salt top is broad and flat).

Does this argue for C (a source layer feeding the crest)? **No, not for the Gulf sheet. Recommendation: do not build C on this evidence; John decides.**
Reason: C is meant to hold a crest up by feeding it. The Stokes model has the full salt layer under the crest as its source (a continuous 4 km
sheet, no prescribed feed) and still does not hold the crest at the surface; it buries it as the thin sheet does. A feed would push the thin
sheet further from Stokes, not closer. What would reopen C: a GL24-like case with a thick source and down-building (the GL24-like check in S4
above, where Stokes keeps the salt at the seafloor and the thin sheet drains it), or a run with a brittle cover. Confidence: medium (Newtonian
cover only; closed box sides, so no salt arrives from outside the 90 km window; one grid; the 0.5 Myr records are too coarse to say
anything about an exposure shorter than about 1 Myr).

DECISIONs: (1) start at the followed crest's own tNear (24.9 Myr Windows, 26.9 Myr Linux) rather than forcing 24.9 on Linux; (2) the same 226 to 315 window and
the same cut as S4, so the two runs compare; (3) `cases.js` got an `S4B` env switch instead of a copy of the case builder (the S4 path is
unchanged and not rerun); (4) no cover-viscosity or resolution variants, because the card asks for one run (case A, x1).

## Limits

Plane strain; Newtonian salt and cover unless stated (no power-law run, the optional n = 5 run was not done); no dissolution; no
faults or brittle failure in the cover; viscous cover; prescribed sediment level (from the thin-sheet run); sediment never removed (no
erosion or slumping); compaction through an Athy density only; sticky-water free surface (water viscosity 1e16 Pa s, a tuned
choice; the free-surface benchmark used a sticky layer of eta/1000 with theta 0.5, so the 1e16 value itself is not benchmarked, only tried at 1e15 to 1e17 early on); marker-in-cell, so salt area drifts by up to 1.3 % (Gulf) and 2.2 % (GL24-like A);
one start section; resolution scatter of 100 to 250 m.

## Open questions for John

1. The van Keken reference values (time 208.99, v_rms 0.0031) are secondary: the Underworld example notebook, confirmed against the Underworld documentation and the ASPECT cookbook by SALT-R1, but not the 1997 paper, which I could not read. Check against the paper before citing.
2. Is a brittle or plastic cover (GL24 mention it) a case you want checked? It would change the conclusion if the cover can open over
   the crest.
3. A second window or a second Gulf crest would test whether this is general (one start section here).
