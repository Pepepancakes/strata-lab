# Traugott 1997, Pore pressure and fracture pressure determinations in deepwater

Deep-read note (LIT-PP-2a). Short paper (4 text pages plus 3 figure pages); every equation is listed. Pages are
"pdf p. N" because the copy prints no page numbers. Claims the author takes from others are written "Traugott
(citing X)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Author: Martin Traugott.
- Year: 1997.
- Title: Pore Pressure and Fracture Pressure Determinations in Deepwater.
- Venue: Deepwater Technology Supplement to World Oil, August 1997. No volume, page numbers or DOI printed.
- Access: full text, John's copy (7 pdf pages read: 4 of text with 14 cited references, Figs. 1-3).

## 2. What it is

A practitioner's methodology note. It defines the gradients used in deepwater well planning (all referenced to the
derrick floor, so water depth and air gap lower every gradient), gives an overburden estimate for deep water, the
stress-ratio fracture-gradient formula with seven ways to estimate the ratio k, the vertical (equivalent depth) and
horizontal (Eaton) shale pore-pressure models, a default porosity-depth trend, and the centroid concept (reservoir and
shale pressures differ away from the centroid depth). Two headline points: a well at the crest of a large overpressured
structure risks mechanical failure, and pressure models need a precise overburden (pdf p. 1). Units: ppg, ft, psi.

## 3. Equations

Symbols (pdf p. 1): O overburden gradient, P pore-pressure gradient, F fracture gradient, all in ppg and all divided
by true vertical depth from the derrick floor; D measured (vertical) depth, W water depth, A air gap, ft;
1 psi/ft = 19.25 ppg = 2.31 g/cc; rho_avg average sediment density, ppg; nu Poisson's ratio; phi fractional
porosity; mu coefficient of friction; theta fault angle from the horizontal.

| Page | Equation | Meaning |
|---|---|---|
| pdf 1 | O = [8.5 W + rho_avg (D - W - A)] / D | Overburden gradient from the derrick floor: sea water at 8.5 ppg over the water depth, sediment of average density rho_avg over the sediment thickness. |
| pdf 2 | rho_avg = 16.3 + {(D - W - A)/3125}^0.6 | Average sediment density (ppg) against depth below the mudline, "a compaction relationship based on regional density data". Exponent 0.6 confirmed on the page image. |
| pdf 2 | k = (F - P)/(O - P) | Definition of the effective stress ratio (minimum horizontal effective stress to vertical effective stress). Fracture pressure is assumed equal to the minimum horizontal stress. |
| pdf 2 | F = k (O - P) + P | "The standard fracture gradient formula." |
| pdf 2 | k = 0.039 (D - W/4 - A)^0.33 | Empirical k, constants fitted by the author to Gulf of Mexico leak-off tests. Note W/4: a quarter of the water depth counts. Exponent 0.33 confirmed on the page image. |
| pdf 2 | k = nu/(1 - nu) | Uniaxial strain (Eaton's form). |
| pdf 2 | k = 1 | Plastic (citing Rocha & Bourgoyne 1996; Barker & Wood 1997). |
| pdf 2 | k = 1 - phi | Solidity (citing Holbrook 1996). |
| pdf 2 | k = 2 nu/(1 - nu) | Hoop stress. |
| pdf 2 | k = 1 / [(mu^2 + 1)^0.5 + mu]^2 | Failure (citing Fenner 1938; Zoback & Healy 1984). Exponents from the text layer; the page crop shows the 0.5 and the squared bracket. |
| pdf 2 | k = 1 / tan^2(theta) | Fault angle. |
| pdf 2 | P = O - (O_e - 8.5)(D_e / D) | Vertical (equivalent-depth) model: O_e and D_e are the overburden gradient and depth where a vertical line on the velocity-depth plot meets the normal compaction line; 8.5 ppg is the normal pressure gradient. |
| pdf 3 | P = O - (O - 8.5)(M/E)^x | Horizontal model (citing Eaton 1976): M/E is the measured over expected (trend) value of resistivity, velocity or travel time; x = 3 for velocity or travel time, 1.2 for resistivity. |
| pdf 3 | phi = 0.41 - (D - W - A)/45,455 | Default porosity-depth trend when no trend line can be defined; 0.41 adjusted to fit data; phi = 0.025 below 17,500 ft of sediment. |
| pdf 3 | phi = (43/t_ma)(1 - t_ma/t) | Porosity transform; t_ma and t matrix and bulk acoustic travel times, microseconds per ft. |
| pdf 4 | (O - P)(1 + 2k)/3 | Mean effective stress recommended instead of vertical effective stress in vertical models; "because k tends to increase with depth" the predicted pressures are higher. |
| pdf 4 | t_m = 95 [(O - P)(D - W - A)]^-0.05 + 15 (clay fraction) | Acoustic matrix travel time against effective stress, "only an approximation". Exponent -0.05 confirmed on the page image (printed "-.05"). |

Count: 17 equations (3 definitional, 7 estimates of k, 2 pore-pressure models, 2 compaction, 1 transform, 2 others).

Hand checks of the worked numbers (pdf p. 2): with W = 2,000 ft, A = 50 ft, D = 5,200 ft, rho_avg = 16.3 +
(3150/3125)^0.6 = 17.3 ppg and O = (8.5 x 2000 + 17.3 x 3150)/5200 = 13.7 ppg (paper: 13.7); at D = 12,300 ft,
rho_avg = 18.3 and O = 16.7 ppg (paper: 16.7). Empirical k at 5,200 ft: 0.039 x (5200 - 500 - 50)^0.33 = 0.63 (paper:
0.63); F = 0.63 (13.4 - 8.5) + 8.5 = 11.6 ppg (paper: 11.6; the example takes O = 13.4, not the 13.7 of the
previous example, which the text does not explain). At 12,300 ft the same formula gives k = 0.86.

## 4. Numbers

| Quantity | Value | Units | Setting | Stated / cited / derived | Page |
|---|---|---|---|---|---|
| Sea-water density | 8.5 | ppg | assumed | stated | pdf 1 |
| Normal pressure gradient | 8.5 (can be as high as 8.95) | ppg | Gulf of Mexico | stated | pdf 1, 3 |
| Unit conversions | 1 psi/ft = 19.25 ppg = 2.31 g/cc; 1 m = 3.281 ft | - | - | stated | pdf 1 |
| Overburden at 5,200 ft and 12,300 ft (W 2,000, A 50) | 13.7; 16.7 | ppg | deepwater example | stated | pdf 2 |
| Textbook overburden of 1 psi/ft (19.25 ppg) | "not recommended for deepwater" | - | - | stated | pdf 2 |
| Empirical k at 5,200 ft; resulting F | 0.63; 11.6 | -; ppg | example, P = 8.5 | stated | pdf 2 |
| Eaton exponent x | 3 (velocity, travel time); 1.2 (resistivity) | - | - | stated | pdf 3 |
| Fig. 2 example: D_e/D; vertical and horizontal pore pressures | 0.42; 13.9 and 14.1 | -; ppg | D 12,300, W 2,000 | stated | pdf 2-3 |
| Porosity trend intercept; floor | 0.41; 0.025 below 17,500 ft of sediment | - | - | stated | pdf 3 |
| Apparent porosity reversal (may be a stress effect) | 8,500 | ft | Fig. 3 example | Traugott (citing Scott & Thomsen 1993) | pdf 3 |
| Centroid rule: shale pressure below reservoir pressure | about 50 psi per 100 ft above the centroid | psi/ft | overpressured cells | stated | pdf 4 |
| Fig. 1 cell: pressure at crest and base | 15 at crest, 13 at base, centroid about 11,000 ft | ppg | schematic | drawn | Fig. 1 |
| Temperature correction constant a (R200 = R (bht + a)/(200 + a)) | 6.77 (Arps); -6 (Exxon) | deg F | resistivity | drawn | Fig. 3 |

Count recorded: 13 rows. No well count, no basin-wide depth range beyond the examples (the LOT data behind the
empirical k are Gulf of Mexico, number not given).

## 5. Data the method was fitted to

Not stated beyond "leak off test (LOT) data from the Gulf of Mexico" for the empirical k constants (pdf p. 2) and
"regional density data" for rho_avg. Figures are single synthetic or type examples (Fig. 2: water depth 2,000 ft,
velocity 4,000 to 18,000 ft/s, depth to 13,000 ft).

## 6. Limits the author states

- Vertical models suffer from temperature effects on resistivity; horizontal models from the need to extrapolate the
  trend line (pdf p. 3). Porosity reversals may be stress effects (citing Scott & Thomsen). The normal gradient itself
  is uncertain (8.5 to 8.95 ppg).
- Horizontal methods without an overburden term (Hottmann & Johnson type) need local calibration for water depth.
- Shale pressure is not reservoir pressure except at the centroid; a crest well can lose returns to the seal and flow
  from the reservoir (pdf p. 4). Guidelines: add 50 psi per 100 ft of structure to shale-derived pressure; do not drill
  the crest of a high-relief overpressured structure.
- The t_m relation is "only an approximation"; the mean-stress recommendation ends with a question mark.

## 7. Relevance to Strata Lab

- `src/engine/wellPressure.ts` lines 93-95, `fracturePressurePa(S, P, k) = k (S - P) + P`: **identical in form** to
  Traugott's F = k (O - P) + P, with his gradients (ppg from the derrick floor) in place of the engine's pressures (Pa
  converted to EMW from RKB, lines 116-120). The engine's EMW datum (rig floor, air gap, water from the sea
  surface; `docs/physics-references.md` M4 "Datum" and "Deep water") is exactly Traugott's convention: "all the
  gradients decrease as the rig floor elevation increases".
- `src/engine/wellPressureParams.ts` lines 29-34: the engine's two methods are Traugott's "uniaxial strain" k =
  nu/(1-nu) and a constant k. His empirical k rises with depth below the mudline (0.63 at 3,150 ft of sediment, 0.86 at
  10,250 ft, hand calculation above), which is the "rising stress ratio with depth" the M4.6 review left open
  (`physics-references.md`, M4 "Stress ratio"): source found, with its formula and the caveat that its constants are
  Gulf of Mexico LOT fits by the author with no data shown. Note the W/4 term: only a quarter of the water depth counts.
- Overburden: the engine integrates bulk density including the water column (`overburdenPa` in `well.ts`), which is
  Traugott's O equation with the real density profile instead of rho_avg. His rho_avg relation (16.3 ppg at the
  mudline, about 1.95 g/cc) is a deepwater check value for the engine's shallow mud density; Eaton's onshore composite
  starts at about 1.91 g/cc (see `eaton1969.md`).
- `src/engine/compaction.ts` lines 30-32 use an exponential porosity-effective-stress law; Traugott's phi = 0.41 -
  z/45,455 is linear in depth and is a fitting default, not a physical law. Not adopted.
- Salt: not mentioned. Leak-off below the overburden: fracture pressure is set equal to the minimum horizontal stress,
  i.e. always below the overburden by (1 - k)(O - P) for k < 1; the plastic option k = 1 gives F = O.
- Centroid effect: the engine's planned well samples the model's own pore pressure in each cell (no shale-reservoir
  split), so the 50 psi per 100 ft correction does not apply; worth a "not claimed" line if M5 adds structure.

The one finding that matters most for M4: the stress ratio k in F = k (O - P) + P rises with depth below the mudline
(empirical k = 0.039 (D - W/4 - A)^0.33 from Gulf of Mexico LOTs), and every gradient must be referenced to the
derrick floor with the water column in the overburden, which the engine already does.
