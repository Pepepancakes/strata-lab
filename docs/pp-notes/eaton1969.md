# Eaton 1969, Fracture gradient prediction and its application in oilfield operations

Deep-read note (LIT-PP-2a). Written to be checked against the paper: numbers carry a page and a figure or equation.
Page numbers are journal pages (1353-1360; pdf page N is journal page 1352 + N). Claims the paper takes from other
authors are written "Eaton (citing X)". The Matthews & Kelly 1967 material below is known only via this paper.
Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Author: Ben A. Eaton (SPE-AIME).
- Year: 1969. Original manuscript received 2 July 1968, revised 26 June 1969; presented as SPE 2163 at the SPE 43rd
  Annual Fall Meeting, Houston, 29 Sept to 2 Oct 1968 (p. 1360).
- Title: Fracture Gradient Prediction and Its Application in Oilfield Operations.
- Journal: Journal of Petroleum Technology, October 1969, pp. 1353-1360 (volume 21, number 10 from the publisher's
  running header; printed again in SPE Transactions volume 246). No DOI printed.
- Access: full text, John's copy (8 pages read, including the nomograph and the reference list).

## 2. What it is

A method paper. Eaton keeps the Hubbert & Willis (1957) fracture-gradient equation but replaces its two constants (an
overburden gradient of 1.0 psi/ft and a Poisson's ratio of 0.25) with depth curves measured in the Gulf Coast: a
composite overburden gradient from density logs (Figs. 6, 7) and a Poisson's ratio back-calculated from field fracture
data (Fig. 4). He compares it with Hubbert & Willis, Matthews & Kelly (1967) and Goldsmith & Wilson (unpublished) on
two East Cameron wells, gives a nomograph with a worked example (Fig. 12), and lists what another area needs to
repeat the method. Field units throughout (ft, psi/ft, ppg, g/cc).

## 3. Equations

All on pp. 1354-1356. Symbols from the Nomenclature (p. 1360): D depth, ft; D_i equivalent depth of the lowermost
normally pressured formation, ft; K_i matrix stress coefficient; p_w wellbore pressure, psi; p formation pressure, psi;
S overburden stress, psi; sigma net effective overburden stress, sigma = S - p, psi; nu Poisson's ratio.

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | 1354 | p_w/D = (S/D - p/D) (nu / (1 - nu)) + p/D | Fracture gradient (Eaton, citing Hubbert & Willis): pore-pressure gradient plus the share nu/(1-nu) of the effective overburden gradient. All three terms in psi/ft. |
| 2 | 1354 | p_w/D = (1.0 + 2p/D) (1/3) | Eq. 1 with S/D = 1.0 psi/ft and nu = 0.25 ("the Hubbert and Willis equation"). |
| 3 | 1355 | p_w/D = K_i (sigma/D) + p/D | Matthews & Kelly (1967) fracture gradient, as Eaton states it (via Eaton 1969). K_i read from Fig. 3 at the depth D_i. Matthews & Kelly call it the breakdown gradient and say it is higher than the extension gradient (p. 1355 note). |
| (unnumbered) | 1355 | D_i = sigma / 0.535 | Step 3 of the Matthews & Kelly procedure: the depth at which the matrix stress sigma would be normal, with sigma = 1.0 D - p (step 2) and an overburden of 1.0 psi/ft. 0.535 psi/ft is the normal matrix-stress gradient (1.0 - 0.465). |
| 4 | 1356 | nu / (1 - nu) = (p_w/D - p/D) / (S/D - p/D) | Eq. 1 solved for the stress ratio: how the Poisson's-ratio curves of Fig. 4 are back-calculated from field fracture data. |

Matthews & Kelly procedure as Eaton gives it (p. 1355): 1. obtain the formation pore pressure; 2. sigma = 1.0 D - p;
3. D_i = sigma/0.535; 4. read K_i from Fig. 3 at D_i; 5. Eq. 3; 6. plot against depth. Eaton's two criticisms (p. 1355):
the overburden is assumed to be 1.0 psi/ft, and the stress ratio is read at the depth of the deepest normally pressured
formation rather than at the actual depth.

Hand check of the nomograph example (Fig. 12, p. 1359): at 12,000 ft, p/D = 0.67 psi/ft, S/D = 0.96 psi/ft, nu = 0.46:
nu/(1-nu) = 0.852; (0.96 - 0.67) x 0.852 + 0.67 = 0.917 psi/ft; the nomograph reads 0.91 psi/ft or 17.5 ppg (0.91 / 0.052
= 17.5). Eq. 1 and the example agree.

## 4. Numbers

| Quantity | Value | Units | Setting | Measured / cited / read | Page, fig |
|---|---|---|---|---|---|
| Usual assumed overburden gradient | 1.0 | psi/ft | textbook | stated | 1354 |
| Usual assumed Poisson's ratio (stress ratio one-third) | 0.25 | - | textbook | stated | 1354 |
| Laboratory Poisson's ratio of rocks | "well under to well over 0.25, never greater than 0.50" | - | lab | Eaton (citing Wuerker 1963) | 1354 |
| Normal matrix-stress gradient in the D_i step | 0.535 | psi/ft | Gulf Coast | via Eaton (M&K 1967) | 1355 |
| K_i, South Texas Gulf Coast curve, at 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 thousand ft | 0.45 / 0.55 / 0.66 / 0.75 / 0.81 / 0.86 / 0.90 / 0.94 / 0.97 / 1.00 | - | South Texas | read from Fig. 3 (reproduction of M&K), +/- 0.03 | 1355 |
| K_i, Louisiana Gulf Coast curve, same depths | (0.30 at about 3,000 ft) 0.46 / 0.57 / 0.66 / 0.73 / 0.78 / 0.82 / 0.85 / 0.88 / 0.90 | - | Louisiana | read from Fig. 3, +/- 0.03 | 1355 |
| Poisson's ratio, West Texas producing formations (overburden 1.0 psi/ft) | 0.25, constant with depth | - | West Texas | from Crittendon (1959) fracture data, Eq. 4; the "S/D = 1.0 and nu = 0.25" assumptions "are valid" there | 1356, Fig. 4 |
| Poisson's ratio, Gulf Coast shales with overburden 1.0 psi/ft (middle curve), at 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 thousand ft | 0.25 / 0.31 / 0.36 / 0.40 / 0.44 / 0.46 / 0.47 / 0.48 / 0.50 | - | Gulf Coast | read from Fig. 4, +/- 0.02 | 1356 |
| Poisson's ratio, Gulf Coast variable overburden (right curve, the one Eaton recommends), same depths | 0.31 / 0.36 / 0.40 / 0.43 / 0.46 / 0.47 / 0.48 / 0.49 / 0.50 | - | Gulf Coast | read from Fig. 4, +/- 0.02 | 1356 |
| "Extreme upper limit" of Poisson's ratio | 0.5 (an incompressible material in plastic failure) | - | general | stated and drawn | 1356, Fig. 4 |
| Composite bulk density, Gulf Coast, mean at 0 / 1 / 2 / 4 / 6 / 8 / 10 / 14 / 20 thousand ft | 1.91 / 1.98 / 2.04 / 2.15 / 2.23 / 2.30 / 2.35 / 2.43 / 2.48 | g/cc | Gulf Coast, many wells | read from Fig. 6, +/- 0.02; the band of all data points is about +/- 0.05 g/cc at depth, wider near the surface | 1357 |
| Composite overburden gradient, Gulf Coast, at 0 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 thousand ft | 0.85 / 0.87 / 0.90 / 0.92 / 0.94 / 0.955 / 0.965 / 0.975 / 0.98 / 0.99 / 1.00 | psi/ft | Gulf Coast | read from Fig. 7, +/- 0.005 | 1357 |
| Overburden gradient near surface, and at depth | "about 0.85 psi/ft near the surface and increases smoothly to 1.0 psi/ft at about 20,000 ft" | psi/ft | Gulf Coast | stated (Conclusion 4) | 1360 |
| Fig. 7 construction | bulk density read at the mid-point of each 1,000 ft interval and averaged step by step to 20,000 ft | - | Gulf Coast | stated | 1356 |
| Nomograph example | 12,000 ft, p/D 0.67, S/D 0.96, nu 0.46 gives 0.91 psi/ft = 17.5 ppg | psi/ft, ppg | example | stated | 1359, Fig. 12 |
| Well C, East Cameron: surface pipe depth; deepest casing point from the curves; a 11,000 ft target would break down between | 3,100; 10,400; 5,000 and 3,100 | ft | East Cameron, offshore Louisiana | stated (worked example) | 1358, Fig. 9 |
| Curve-fit interpolation for Fig. 9 | fracture gradient between the 0.8 and 0.9 psi/ft overburden curves near the surface | psi/ft | Well C | stated | 1358 |
| West Texas injector: fracture gradient of old producers; of new in-fill wells | 0.57; 0.68 to 0.70 | psi/ft | West Texas | measured (Fig. 13) | 1359 |
| California injector, fracture gradients on three dates (Dec 1961, Jun 1962, Dec 1962) | 0.748, 0.864, 0.993 | psi/ft | California | measured | 1359 |
| psi/ft to ppg | 0.91 psi/ft = 17.5 ppg (0.052 psi/ft per ppg) | - | field rule | implied by Fig. 12 | 1359 |

Count recorded: 17 rows. Eaton tabulates no numbers; the depth curves exist only as figures, so the rows marked "read
from Fig." are this note's readings, not his values.

## 5. Data the method was fitted to

- Overburden: "a composite group of density logs from many Gulf Coast wells" (p. 1356), 0 to 20,000 ft; a similar
  curve for the Santa Barbara Channel (Figs. 10, 11, p. 1358), with density rising from the sea floor.
- Poisson's ratio: West Texas from Crittendon's (1959) hydraulic-fracture treatments; Gulf Coast back-calculated with
  Eq. 4 from "field data" (fracture, lost-circulation and squeeze data; the wells and their count are not given), with
  Fig. 7 as the overburden (p. 1356).
- Examples: Well B and Well C, East Cameron (offshore Louisiana), pore pressures from shale resistivity (Figs. 1A, 1B,
  5, 8, 9).
- To repeat the method elsewhere (p. 1359): overburden gradient against depth from density logs, seismic or shale
  densities; actual fracture gradients at several depths; the pore pressures at those depths; then Eq. 4.

## 6. Limits the author states

- Developed for the Gulf Coast; "should be highly reliable for all areas, provided that the variables reflect the
  conditions in the specific area" (abstract, p. 1353). The Poisson's-ratio trend "will not be exactly the same for
  data from different areas" (Conclusion 3, p. 1360).
- Breakdown versus extension: field data cannot say whether a wellbore has natural fractures, so the difference between
  the two gradients is not treated (p. 1354). Tectonically relaxed areas only (p. 1359).
- Pore pressure is an input, assumed known from logs or pressure bombs (p. 1354).
- Accuracy claim: "as much accuracy as the log-derived pressure gradient" (Conclusion 5, p. 1360).

## 7. Relevance to Strata Lab

- `src/engine/wellPressure.ts` lines 12-13 (header), 93-95 and 98-100: `fracturePressurePa(S, P, k) = k (S - P) + P`
  and `eatonK(nu) = nu / (1 - nu)`. **Same form as Eq. 1** (divide Eq. 1 by 1/D: p_w = (S - p) nu/(1-nu) + p). Symbols
  differ only in name (engine S, P, Pf for Eaton's S, p, p_w). Units: the engine works in Pa and converts to psi and ppg
  from RKB (`wellPressure.ts` lines 116-120, `emwPpg` from `well.ts`); Eaton works in psi/ft and converts to ppg with 0.052. The engine's
  Matthews & Kelly branch (lines 13 and 136) is Eq. 3 with K_i applied at the actual depth, not at D_i; Eaton himself
  recommends the actual depth (p. 1355), so this is Eaton's reading of M&K rather than M&K's own procedure. The
  comments at lines 17-18 ("depth curves of the papers were not read", "to verify") can now be settled: form verified.
- `src/engine/wellPressureParams.ts` lines 31-32: `poissonRatio` default 0.40, tuned, constant with depth. On Eaton's
  Gulf Coast variable-overburden curve (Fig. 4) 0.40 is the value at about 6,000 ft; at 10,000 ft he reads about 0.46
  (K = 0.85) and at 20,000 ft 0.50 (K = 1.0). A constant 0.40 therefore underestimates Eaton's fracture gradient below
  about 6,000 ft and overestimates it above. The Fig. 4 readings in section 4 are enough to tabulate the curve if a
  later card wants a depth-dependent nu (D21 open item; M4.6 Finding 3).
- `src/engine/wellPressureParams.ts` lines 33-34: `matthewsKellyKi` default 0.60. On Fig. 3 (via Eaton) 0.60 is the
  Louisiana curve at about 6,500 ft and the South Texas curve at about 5,000 ft, read at D_i (the normal-pressure
  equivalent depth), which is shallower than the actual depth where pressures are abnormal.
- Overburden: the engine integrates its own bulk density (water column included). Eaton's Gulf Coast composite (Fig. 7:
  0.85 psi/ft at the surface, 0.955 at 10,000 ft, 1.0 at 20,000 ft; Fig. 6 densities) is the published check the
  physics audit asked for (AUDIT-1, F-3 "Gulf overburden densities"); an onshore datum, no water column.
- `src/engine/references.ts` lines 163-167: the `eaton-1969` entry can carry pages 1353-1360; the "not read" notes
  live in `wellPressureParams.ts` lines 30-34 and can be dropped.
- Salt: not mentioned, so the engine's rule that the fracture pressure in salt equals the overburden
  (`wellPressure.ts` lines 19-21 and 135-136, "industry practice; no source") gets no support here; see
  `zhang-yin2017.md` for the published salt rule.
- Not in Eaton: deep water (none; Santa Barbara Channel is the only offshore trend), a leak-off limit
  below the overburden (he treats the fracture gradient as the limit itself), and any tabulated curve.

The one finding that matters most for M4: Eaton's method is Eq. 1 with BOTH nu and S/D varying with depth; his Gulf
Coast nu rises from about 0.25 to 0.50 between 1,000 and 20,000 ft, so the constant 0.40 the engine uses is a mid-depth
value, not Eaton's curve.
