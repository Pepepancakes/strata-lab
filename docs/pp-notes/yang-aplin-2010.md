# Yang and Aplin 2010, A permeability-porosity relationship for mudstones

Deep-read note (LIN-2, D33). Six journal pages, four equations, one dataset table. Pages are journal pages 1692-1697.
Claims taken from others are written "Yang and Aplin (citing X)". Nothing in `src/`, `tests/` or presets was changed.
Numbers marked "my arithmetic" are calculations from the paper's equation, not published numbers; the formula is given
so they can be repeated. Numbers marked "read from figure" are eyeballed from a plot and good to about a quarter of a
decade.

## 1. Record

- Authors: Yunlai Yang and Andrew C. Aplin (Newcastle University; Yang also PetroQuant Consultants).
- Year: 2010 (received 9 Feb 2009, accepted 8 Jul 2009, online 18 Jul 2009).
- Title: A permeability-porosity relationship for mudstones.
- Journal: Marine and Petroleum Geology 27 (2010) 1692-1697. DOI 10.1016/j.marpetgeo.2009.07.001 (printed on p. 1692).
- Access: full text, John's copy (6 pages read, including Table 1 and the reference list). The text layer loses minus
  signs in the equations, so eq. 4 was confirmed on the page images (pp. 1692 and 1695, signs agree on both).

## 2. What it is

An empirical fit. The authors argue that most of the 2-5 orders of magnitude scatter of mudstone permeability at one
porosity is a grain-size effect, describe grain size by clay content (mass fraction of particles under 2 microns,
CF), and fit one equation for bedding-perpendicular absolute permeability K (m2) as a function of void ratio and CF
(p. 1692, abstract; p. 1693 aims). It is a curve fit to a compiled dataset, not a mechanism. It does not cover
solution chemistry (p. 1693), and gives no stress or depth dependence beyond what porosity carries.

## 3. Equations

Symbols: K absolute permeability, m2 (length squared); k hydraulic conductivity, L/T; eta fluid dynamic viscosity;
rho unit weight of the fluid; phi porosity; e void ratio; CF clay content as a **fraction** (eq. 2 and eq. 3 say "in
fraction"; the abstract says mass fraction); LL liquid limit, %.

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | 1692 | K = k eta / rho | Absolute permeability from hydraulic conductivity; used to convert published k to K (p. 1693). |
| 2 | 1693 | CF = -0.761 + 0.00438 LL + 0.1872 LL^0.5 (r2 = 0.95) | Clay content from liquid limit, used for the samples with no measured clay content (sources 1 and 5, Table 1). Fitted to 18 samples (Fig. 1); covers CF 12 to 80 %. |
| 3 | 1695 | ln K = a_K + b_K e + c_K e^0.5, and a_K (or b_K, c_K) = c0 + c1 CF + c2 CF^0.5 | The functional form: each coefficient is itself a function of clay content. The paper calls the six coefficients "(m2)" which cannot be right for all of them; read it as a loose label. |
| 4 | 1695 | ln K = -69.59 - 26.79 CF + 44.07 CF^0.5 + (-53.61 - 80.03 CF + 132.78 CF^0.5) e + (86.61 + 81.91 CF - 163.61 CF^0.5) e^0.5 | **The result.** r2 = 0.93. K in m2, e = phi / (1 - phi) (p. 1692, 1695). |

Same equation as LIN-1 copied from the abstract: every coefficient and sign agrees. log10 K = ln K / ln 10 (my
conversion; the paper gives natural logs only).

The authors say that over a restricted porosity range log K is roughly linear in phi or e, but over the full range
"a slightly more complex form fits our dataset best" (p. 1695). So the engine's straight line `log10 k = kA + kB phi`
is the restricted-range form, not the paper's.

## 4. Numbers

| Quantity | Value | Setting | Page, table |
|---|---|---|---|
| Data points / samples | 376 points from 303 samples | whole dataset | 1693 (Section 3); Table 1 sums: 22+261+38+26+24+5 = 376 points, 22+261+9+6+4+1 = 303 samples |
| Marine samples | 299 of 303 (nearly 99 %) | sources 1-4 and one of source 5 | 1693, 1694 |
| Measured or consolidation-test points | 93 of 376 | constant head, constant flow, transient pulse decay, consolidation tests | 1693. I cannot reproduce 93 from Table 1: source 1 (22) + 3 (38) + 4 (26) + 5 (24) + 6 (5) = 115. Treat the paper's own count as uncertain. |
| Modelled points | the rest (283 by the text's count) | permeability computed from pore-size distributions with the Yang and Aplin (1998) model, which the paper says predicts to within a factor of 3 of measured values (Yang and Aplin 2007) | 1693; Table 1 source 2 (261 points) |
| Source 1 (22 points) | cores, North Sea and Gulf of Mexico oil wells; CF 12-41 %, porosity 0.055-0.22, K 2.4e-22 to 1.6e-19 m2 | transient pulse decay, 30,000 mg/L NaCl | Table 1, 1694 |
| Source 2 (261 points) | cuttings and cores, North Sea and Gulf of Mexico oil wells; CF 24-92 %, porosity 0.04-0.45, K 2.5e-22 to 3.0e-19 m2 | modelled from pore size | Table 1, 1694 |
| Source 3 (38 points) | shallow marine sediments, North Sea boreholes (1.2-130 m); CF 32-40 % (from liquid limit), porosity 0.26-0.55, K 3.6e-19 to 1.7e-16 m2 | Terzaghi's model from 1D consolidation | Table 1, 1694 |
| Source 4 (26 points) | shallow buried London clay; CF 33-69 %, porosity 0.22-0.43, K 2.7e-21 to 2.1e-18 m2 | direct measurement | Table 1, 1694 |
| Source 5 (24 points) | reconstituted residual sediments, India; CF 34-70 % (from liquid limit), porosity 0.36-0.70, K 1.1e-18 to 1.6e-16 m2 | direct measurement | Table 1, 1694 |
| Source 6 (5 points) | Na-smectite in concentrated NaCl; CF 97 %, porosity 0.56-0.78, K 3.7e-21 to 3.5e-20 m2 | Terzaghi's model from 1D consolidation | Table 1, 1694 |
| Ranges of the whole set | CF 12-97 %; porosity 0.04-0.78; K 2.4e-22 to 1.7e-16 m2; TOC 0.1-4.8 %; age recent to late Jurassic | | 1694 |
| Natural-sediment limit on CF | the 97 % end is five Na-exchanged smectite points (Mesri and Olson 1971), "not from natural sediments"; natural samples reach 92 % | | 1693 |
| Spread of K at one porosity in the data | over 4 orders at phi 0.4, 2 orders at phi 0.15 | | 1694 |
| Spread after including CF | "one order of magnitude" remains; almost all points within a factor of 3 of eq. 4 over six orders of K (Fig. 5, dashed lines) | | 1696 (text), Fig. 5 |
| Gulf of Mexico example | 58 samples from one 18 m core; porosity 0.20-0.24, CF 37-70 %; permeability varies by about one order of magnitude with CF; K about 4e-21 to 1e-19 m2 (read from Fig. 3b, c); modelled, not measured | | 1694-1695, Fig. 3 |
| Basin example | North Sea well, clay and porosity from logs, K from eq. 4 (Fig. 6); a mud-rich section above 8475 ft has higher porosity but an order of magnitude lower K than the coarser section below | | 1696 |

How many of the 376 points are Gulf of Mexico is **not stated**: Table 1 groups North Sea and Gulf samples together.

## 5. Limits (say them when you quote it)

- **Flow direction.** Eq. 4 is for **bedding-perpendicular** (vertical in flat beds) permeability (abstract; p. 1693
  aim). The paper says mudstone permeability is higher parallel to bedding, from particle alignment and from silt-clay
  lamination (p. 1692-1693), and gives **no anisotropy ratio**. The engine's flow is 1D vertical (`compaction.ts`
  header), so the direction matches.
- **Homogeneous mud only.** The target is "homogeneous, fine-grained clastic sediments" (p. 1693). Layers coarser than
  the mud average get "much higher permeabilities" (p. 1696, Fig. 6 discussion).
- **Marine pore fluids.** The set is nearly all marine (p. 1694). For non-marine, hypersaline or Ca-dominated pore
  fluids, K goes down (low salinity) or up (high salinity), most in clay-rich mud (p. 1696).
- **Range.** Use inside CF 12-92 % (natural) and porosity 0.04-0.78. The paper plots curves only for the CF bands of
  Fig. 4. My check of eq. 4 on a grid (my arithmetic): at CF 0.12 the curve turns over above phi about 0.58 (K falls
  as porosity rises), so the low-clay, high-porosity corner is extrapolation even though both ends are inside the
  stated ranges. Natural low-CF samples reach only phi 0.45 (Table 1, source 2).
- **High porosity rests on non-natural data.** Above phi 0.55 the set is source 5 (24 reconstituted residual sediments
  from India, phi 0.36-0.70, CF 34-70 %) and source 6 (5 Na-smectite points, phi 0.56-0.78) (Table 1, p. 1694); the
  natural shallow marine samples of source 3 stop at 0.55. The engine's mud at phi 0.63 (North Sea default surface
  porosity) is therefore in the least natural part of the fit.
- **Fluid.** Permeability is intrinsic (absolute); the viscosity and temperature of the water are separate (p. 1693).
- **Uncertainty.** One order of magnitude remaining scatter, "partly measurement uncertainty, but probably primarily"
  that CF only approximates the lithology (p. 1696). Modelled points carry a factor of 3 of their own.
- **Not in the paper:** any stress, depth or unloading dependence of K; a Gulf-only fit; a value of CF for any named
  formation or preset.

## 6. Comparison with Strata Lab today

Engine side (from the repo): mud permeability `log10 k = kA + kB phi` with `kA` = -22, `kB` = 8 (log10 m2), tuned with
surface mud porosity phi0 = 0.63 (`params.ts`; `physics-references.md` Hart section). The Hart mud (Gulf-style preset,
AUD-3) uses phi0 = 0.40 and beta = 3.68e-8 /Pa. AUD-6 B-1: with the Hart mud the Gulf pore pressure 500 ft below the sea
floor is 9.35 to 10.49 ppg against 8.59 to 8.62 ppg with the North Sea mud, 1 to 2 ppg over hydrostatic where the Hart
well is hydrostatic, attributed to the tuned permeability law; at phi0 0.40 the engine's surface mud is about 70 times
less permeable than at 0.63 (10^-18.8 against 10^-17 m2) (`physics-references.md`, Hart section).

**Engine against eq. 4 (my arithmetic; log10 K in m2).**

| phi | engine | CF 0.3 | CF 0.4 | CF 0.5 | CF 0.6 | CF 0.7 |
|---|---|---|---|---|---|---|
| 0.10 | -21.20 | -20.34 | -20.55 | -20.77 | -21.01 | -21.26 |
| 0.20 | -20.40 | -19.08 | -19.50 | -19.90 | -20.29 | -20.66 |
| 0.30 | -19.60 | -18.01 | -18.56 | -19.08 | -19.58 | -20.07 |
| 0.40 | -18.80 | -17.00 | -17.61 | -18.22 | -18.82 | -19.43 |
| 0.50 | -18.00 | -15.99 | -16.58 | -17.23 | -17.93 | -18.65 |
| 0.63 | -16.96 | -14.62 | -14.98 | -15.58 | -16.36 | -17.27 |

- The engine mud line lies between the CF 0.5 and CF 0.7 curves from phi 0.1 to 0.5 (agrees with LIN-1) and at 0.63 it
  sits at about CF 0.65. At phi 0.20 it is about CF 0.63 (interpolated). So the tuned law behaves like a clay-rich mud,
  and it is **not** far outside the published band: nothing in the engine mud law is more than about 1.4 decades below
  eq. 4 at CF 0.5 anywhere from phi 0.1 to 0.63.
- Slope. The engine's 8 per unit porosity is below the paper's mean slope over phi 0.1-0.5 at CF 0.3 (10.9) and CF 0.5
  (8.9) and **above** it at CF 0.7 (6.5). LIN-1 said the engine is flatter than the published curves; that holds for
  CF 0.5 and lower but not for CF 0.7.
- Gulf core (Fig. 3, phi 0.20-0.24): the engine gives -20.40 to -20.08, about 4e-21 to 8e-21 m2, inside the plotted K
  of about 4e-21 to 1e-19 m2 but at the clay-rich (low K) end, where CF is 70 %.

**Hart mud and the B-1 shallow overpressure.** At the Hart surface porosity 0.40 the engine's K is 10^-18.8. Eq. 4 at
phi 0.40 gives the change below if the engine used the paper at the same porosity (my arithmetic):

| CF | eq. 4 at phi 0.40 | engine -18.8 vs eq. 4 |
|---|---|---|
| 0.3 | -17.00 | eq. 4 is 1.8 decades more permeable |
| 0.4 | -17.61 | 1.2 decades more |
| 0.5 | -18.22 | 0.6 decades more |
| 0.6 | -18.82 | same |
| 0.7 | -19.43 | 0.6 decades less |

So adopting Yang and Aplin does **not** by itself cure B-1: the cure, if any, depends on which CF is chosen, and a
clay-rich choice (0.6 to 0.7) would leave the surface mud as tight as it is now or tighter. The Hart curve itself
points to a lower CF (see the 2004 note, section 6: the Hart mud's porosity-stress curve lies between the Yang and
Aplin CF 0.3 and CF 0.5 curves from 2 to 20 MPa). With CF 0.3 to 0.5 the surface mud would be 0.6 to 1.8 decades more
permeable than now, the direction that helps the top of the column drain. **No engine run was made**; whether that
removes the 1 to 2 ppg is for the re-fit card to measure, not a claim here.

What the comparison does not show: the 70-fold drop from phi0 0.63 to 0.40 that the repo reports is a feature of the
straight line; eq. 4 has a steeper, CF-dependent slope, so the drop with eq. 4 would be larger or smaller depending
on CF (eq. 4 falls 2.2 to 2.6 decades from 0.63 to 0.40 across CF 0.3 to 0.7, against the engine's 1.8).

## 7. Clay-fraction options for John (D32.5, D33.4)

Eq. 4 needs a number the engine does not have. The engine already handles sand and mud separately: each cell holds a
sand share and a mud share, and vertical permeability is their harmonic mix (`compaction.ts`, header and the `k = 1 / (fs / kS + (1 - fs) / kM)` line).
So the CF eq. 4 needs is the clay content **of the mud component**, not of the whole cell. This is John's physics
decision; the options below, one recommendation, no change made.

- **A. One mud CF per preset (a visible input).** Cost: one new parameter, labelled tuned, with the paper's Gulf-core
  range (37 to 70 %, Fig. 3, p. 1694) as its stated basis. Honest and simple; every run is reproducible; the user can
  change it like any other input. Does not vary with depth or lithology.
- **B. CF derived from the cell's sand share.** Cost: counts sand twice, because the harmonic mix already carries the
  sand share; "clay under 2 microns" is not "not sand" (silt exists); the paper's dataset is homogeneous mud, so a
  mixed cell is outside its basis (p. 1693). Needs an invented mapping with no source.
- **C. A fixed Gulf value read off the paper (for example 0.5, the middle of the Fig. 3 core).** Cost: a constant buried
  in code; the paper does not say the core is typical of Gulf mud, and the Gulf share of its 376 points is not given.
  This is A without the visible input.
- **D. CF read back from the preset's own compaction curve** (the CF whose Yang and Aplin 2004 curve best matches the
  preset's phi-stress curve). Cost: needs the 2004 paper's e100 and beta as a lookup, which is a second adoption step
  (section 6 of the 2004 note), and the match is only rough because the engine law is exponential and theirs is
  logarithmic. Gives a defensible value without a new tuned number.
- **E. A per-lithology table (shale, silty mud, and so on).** Cost: needs a lithology variable that does not exist in
  the record; more input for no data behind it.

**Recommendation: A, with the value chosen by the D cross-check.** One visible mud clay-fraction input per preset,
labelled tuned, starting where the compaction curve already points (my arithmetic, see the 2004 note section 6): about
0.7 for the North Sea default mud and about 0.4 for the Hart mud of the Gulf preset. Reason: it keeps the permeability
law and the compaction curve describing the same mud, which they do not today (the Hart mud's compaction curve is a
CF 0.3 to 0.5 mud while its permeability law behaves like CF 0.6 to 0.7), and it adds one honest number rather than a
hidden rule. Decisions that stay with John: the two starting values, and whether adopting eq. 4 happens before or with
a decision on the compaction law (2004 note).

## 8. Relevance to Strata Lab

- `kA` and `kB` (mud): eq. 4 is a candidate replacement, in a changed form (void-ratio and square-root terms, plus CF),
  not a refit of the same line. The straight line stays valid only as a local fit.
- A mud CF input is needed first (section 7). Until John decides, the mud values stay `tuned`; this note moves the link
  to Yang and Aplin 2010 from "named candidate" to "read, equation confirmed".
- Sand permeability: nothing here (the paper has no sand).
- Not usable from this paper: unloading, anisotropy, depth dependence.
