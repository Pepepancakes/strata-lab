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
- `cases.js`  the two cases. `node cases.js gulf A|B [coverViscosityFactor]`, `node cases.js gl24 A|B`. Env: S4_SCRATCH, S4_CFL, S4_ETAW, S4_TEND, S4_MAXMIN, S4_TAG.
- `summary.js`, `cmp.js`, `ser.js`, `plot.py` (needs matplotlib, `uv run --with matplotlib python plot.py`), `results-summary.txt`, `s4-stokes-check.png`.

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

Cover over the tracked crest (m). The thin-sheet run says 0 m from 26.8 to 54 Myr (exposed), then about 560 m.

Gulf, cover viscosity 1e18 as in the case file (rows: grid A 180x38, B 270x57):
- both resolutions agree: cover drops to about 200-230 m at 26 Myr, rises to about 670-700 m at 40-43 Myr (the crest is pushed down relative to the seafloor), then falls to about 250 m by 54 Myr and stays 200-250 m to 66 Myr.
- cover never falls below 110 m in the crest zone (minimum over the A run) or 184 m (B). No exposure at any time in the central cases.
- Changing the advection Courant number from 0.5 to 1 gives the same picture with run-to-run scatter of about 50-100 m. The A runs with CFL 2 and 4 are noisier and are not used.

Cover viscosity x10 and x0.1 (A and B): the time of the cover maximum moves (earlier for the weaker cover, later and flatter for the stronger),
but no run holds exposure. Weak cover (x0.1, A) shows a brief exposure only at 60.3-61.3 Myr; strong cover (x10) touches exposure only at the end (60.8-61.3 Myr in the crest zone). These end-of-run touches are not stable between A and B, so treat them as noise.

Salt area drift over the runs: 0.1 to 1.3 % (markers, free surface, reseeding), well below the effects reported.

GL24-like case (down-building, 200 m/Myr, 100 km box): the Stokes runs do not reproduce the thin-sheet crest depth of 265 m below the seafloor
(thin-sheet). In Stokes the salt reaches the seafloor by about 1 Myr and stays there with a crest 30-230 m above the flank, with strong scatter between records
(A 200x52, B 250x65). This case is a sanity check only; its set-up (initial salt thickness, how the level is placed) is mine and not yet checked against GL24.

## Verdict (provisional, see open questions)

The thin-sheet "exposed from 26.8 to 54 Myr" is not supported by the Stokes run: the Stokes crest stays buried under 110-700 m of cover, with a
burial peak near 40 Myr that the thin sheet does not have. The thin-sheet result depends on dropping the cover over the crest to 0 once the
salt is "extruded" and keeping it there, which in the Stokes run is replaced by lateral viscous flow of cover. That flow is controlled by the
cover viscosity (a tuned parameter in the case file) and by the 11-column median filter of the sediment level, which I chose.

## Open questions for John

1. Is the median-filtered seafloor the right sedimentation law for the Stokes run? It removes narrow crests from the level, so it may over-bury the crest. A level that follows the unfiltered thin-sheet seafloor is the other option.
2. The van Keken reference values come from a secondary source (see caveat).
3. GL24-like check does not match the thin-sheet crest depth and has not been compared with GL24 itself.
4. The Gulf run result (never exposed) depends on one starting state (single section). A second S4 case with a different window would tell whether it is general.
