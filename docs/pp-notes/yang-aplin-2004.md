# Yang and Aplin 2004, Definition and practical application of mudstone porosity-effective stress relationships

Deep-read note (LIN-2, D33). Ten journal pages, 28 equations, two datasets. Pages are journal pages 153-162.
Claims taken from others are written "Yang and Aplin (citing X)". Nothing in `src/`, `tests/` or presets was changed.
Numbers marked "my arithmetic" are calculations from the paper's equations, not published numbers; formulas are given
so they can be repeated.

## 1. Record

- Authors: Yunlai Yang and Andrew C. Aplin (NRG, School of Civil Engineering and Geosciences, University of
  Newcastle).
- Year: 2004 (received 16 December 2002; revised typescript accepted 10 November 2003).
- Title: Definition and practical application of mudstone porosity-effective stress relationships.
- Journal: Petroleum Geoscience, Vol. 10, 2004, pp. 153-162 (confirmed from the running header and first page of the
  paper itself). The copy carries no DOI; the DOI 10.1144/1354-079302-567 in `parameter-lineage.md` comes from OpenAlex
  and was not seen on the paper.
- Access: full text, John's copy (10 pages read, including equations on page images; the text layer drops Greek
  letters and minus signs, so equations 4, 18, 22-27 were confirmed on the page images).

## 2. What it is

A compaction-law paper. The authors take the soil-mechanics law of void ratio against the logarithm of vertical
effective stress, e = e100 - beta ln(sigma'/100) (eq. 1), and ask two questions: does it hold to basin stresses (up
to 40 MPa), and how do e100 and beta depend on lithology. Lithology is clay content. They first derive the dependence
from soil-mechanics data (Skempton 1970; Burland 1990; low stress, mostly remoulded and high-clay samples; eqs 14, 15),
then from 3847 geological data points from 22 wells (eqs 23, 24), and use the second for geology (p. 153, abstract;
p. 157). They then invert the law to estimate pore pressure from log-derived porosity (eq. 25) and show four examples.
It is about mechanical compaction only; it does not give permeability.

## 3. Equations

Symbols: e void ratio; phi porosity; e100 void ratio at 100 kPa vertical effective stress; beta slope of e against
ln sigma' (dimensionless as printed; sigma' is in kPa in eq. 1 because of the 100); sigma'_v vertical effective
stress; sigma_v total vertical stress; u pore pressure; clay clay content (see the units warning below); e_L void ratio
at liquid limit.

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | 153 | e = e100 - beta ln(sigma'_v / 100) | The compaction law: void ratio linear in the log of effective stress ("virgin compression line", Fig. 1). |
| 2 | 153 | sigma'_v = sigma_v - u | Terzaghi effective stress. |
| 3 | 153 | e = phi / (1 - phi) | Void ratio from porosity. |
| 4 | 155 | e*100 = 0.109 + 0.679 e_L - 0.89 e_L^2 + 0.016 e_L^3 (r = 0.991) | Burland's intrinsic e*100 against e_L. The "0.89" is as printed; with 0.089 it gives 1.19 at e_L = 1.904 (clay 0.5), matching eq. 7 (1.21); with 0.89 it gives -1.7. Looks like a misprint (my arithmetic). Not used further. |
| 5, 6 | 155 | C*c = 0.256 e_L - 0.04 (r = 0.985); beta* = 0.11 e_L - 0.0174 | Intrinsic compressibility constants; C*c = beta* ln 10 (log base 10 against natural log). |
| 7 | 155 | e*100 = 0.1387 + 0.5616 e_L (r = 0.989) | Linear alternative. |
| 8-10 | 155 | I_vo = (e - e*100) / C*c; I_vo = 0.7974 - 0.4726 ln(sigma'/100); e = e*100 + 1.836 beta* - 1.088 beta* ln(sigma'/100) | Burland's void index and the natural-sediment compression line, restated in the form of eq. 1. |
| 11, 12 | 155 | e100 = e*100 + 1.836 beta*; beta = 1.088 beta* | Link from reconstituted (intrinsic) to natural sediments. |
| 13 | 155 | e_L = 0.723 + 0.775 clay + 3.174 clay^2 (r = 0.987) | Void ratio at liquid limit from clay (Fig. 2). |
| 14 | 155 | e100 = 0.659 + 0.592 clay + 2.424 clay^2 | **Soil-mechanics (Burland-Skempton) fit**, low stress (under 5 MPa). |
| 15 | 155 | beta = 0.0686 + 0.0937 clay + 0.384 clay^2 | As eq. 14. |
| 16 | 156 | e = (G_s - rho) / (rho - G_w) | Void ratio from bulk density, grain density G_s, water density G_w (g/cm3) (Type 1, 2 data). |
| 17 | 156 | e = G_s / rho_d - 1 | From dry bulk density (Type 3 lab data). |
| 18, 19 | 156 | porosity corrections, lab to log (North Sea eq. 18; Gulf of Mexico eq. 19, with clay in %, burial depth h in m) | Corrects measured porosity to log porosity. The Gulf form is fitted to the Gulf well samples. |
| 20, 21 | 157 | e100 = a + b clay + c clay^2; beta = f + g clay + h clay^2 | General quadratic form. |
| 22 | 157 | e = a + b clay + c clay^2 - (f + g clay + h clay^2) ln(sigma'/100) | Eq. 1 with 20 and 21 substituted; regressed on all the data. |
| 23 | 157 | **e100 = 0.3024 + 1.6867 clay + 1.9505 clay^2** | **The result: geological fit.** |
| 24 | 157 | **beta = 0.0407 + 0.2479 clay + 0.3684 clay^2** | **The result: geological fit.** r2 = 0.92 for the fit of eq. 22 (n = 3847; Fig. 7). |
| 25 | 158 | sigma' = 100 exp((e100 - e) / beta) | Eq. 1 inverted: effective stress (kPa) from void ratio. Pore pressure = total stress minus this. |
| 26 | 158 | sigma_v = 0.01799 h + 9.95e-7 h^2 (North Sea) | Total vertical stress from the sea floor, MPa; h in metres. |
| 27 | 158 | sigma_v = 0.006074 h + 4.44e-8 h^2 (Gulf of Mexico) | Same; h in **feet**. |
| 28 | 159 | porosity from sonic travel time (Raiga-Clemenceau et al. 1988 form, matrix transit time and a coefficient c) | Used where the density log was poor. Not transcribed: coefficient c is calibrated per well and no value is given. |

Hand checks (my arithmetic): eq. 23, 24 at clay 0.5 give e100 = 1.633 and beta = 0.2568, so at 5 MPa e = 1.633 - 0.2568
ln 50 = 0.628, porosity 0.386. Eq. 25 at clay 0.5, porosity 0.30 (e = 0.4286) gives sigma' = 10.9 MPa. Eqs 6, 7, 11-13
recombine to eq. 14, 15 (clay 0.5: e100 1.561, beta 0.209 against eqs 14, 15: 1.561, 0.211), so the printed chain is
internally consistent.

**Units warning.** The paper defines clay content as "the percentage of particles less than 2 micron" (p. 154) and eqs 18
and 19 say clay in %, but eqs 13-15 and 23-24 do not state a unit. Only a fraction gives sensible values (eq. 13 at 0.5
gives e_L = 1.90; at 50 it would give 8,000; eq. 23 at 0.5 gives e100 = 1.63). Use clay as a fraction in 13-15, 20-24
(inference from the numbers, not stated), and the Fig. 8 curves are labelled in percent (30, 40, 50, 60 %).

## 4. Numbers

| Quantity | Value | Setting | Page |
|---|---|---|---|
| Geological dataset | 3847 data points, 22 wells (21 North Sea, one Gulf of Mexico) | | 156 |
| Type 1 | 1977 points, five North Sea wells, shallow (<700 m), sandy; hydrostatic pressure assumed; porosity from density log | | 156 |
| Type 2 | 1702 points, 11 North Sea wells, depths 800-3500 m; pressure interpolated from RFT in adjacent sands, within 20 m only | | 156 |
| Type 3 | about 170 lab samples from 18 wells, **including 60 from a single Gulf of Mexico well** (mainly cuttings); clay, grain density, void ratio measured | | 156 |
| Gulf share (my arithmetic) | 60 of 3847 points, about 1.6 % | the only Gulf data in the fit | 156 |
| Ranges | clay 8-90 %; effective stress 0.8-40 MPa (100 m to about 3500 m burial); void ratio 0.07-1.2 (porosity 0.06-0.55); TOC under 5 %, under 1 % for most | | 156 |
| Spread at one stress | at 5 MPa void ratio 0.33 to 1.1 (porosity 0.25 to 0.52) | | 156 |
| Excluded | TOC over 5 %; samples with cement factor over 0.1 (lithified by carbonate or clay recrystallisation) | | 156 |
| Clay content from logs | ANN models predict clay to plus or minus 10 % | | 156 |
| Fit quality | r2 = 0.92, n = 3847; most modelled void ratios within 0.1 of the true value; four clay-content groups show scatter that reflects model error and the 10 % clay range per group | | 157, 158 (Figs 7, 8) |
| Soil-mechanics data | stress generally under 5 MPa (a few hundred metres); coefficients differ from the geological fit | | 155, 157 |
| Difference between the two fits | similar below about 2 MPa and for fine material; the geological fit gives **lower porosity at higher stress** | | 157 |
| Total stress trends | eqs 26, 27 from 10 North Sea and six Gulf of Mexico wells | | 158 |

## 5. Limits (say them when you quote it)

- **Mechanical compaction only.** Above about 80-100 C smectite recrystallisation changes the microfabric and can lose
  porosity independent of effective stress (p. 154). The fit excludes lithified samples. Neither the paper nor the
  engine models chemical compaction of mud.
- **Stress range of the data:** 0.8 to 40 MPa. Below that the law is an extrapolation (the soil-mechanics fit, eqs 14-15,
  covers lower stress and the paper says the natural-sediment line is roughly linear above 10 kPa, p. 155). Eq. 1
  makes void ratio rise without bound as stress goes to zero (my reading of the equation; the paper does not discuss it).
- **North Sea dominated.** The Gulf supplies 60 points from one well; the Gulf of Mexico enters eq. 19, eq. 27 and the
  Fig. 12 pore-pressure example (deep-water Miocene, pp. 159-161).
- **Virgin curve only.** Eqs 1 and 25 "only describe virgin compaction and the effective stress estimated in this way is
  the maximum that the sediment has ever experienced" (p. 159). The method is **not applicable to uplifted sediments**
  (p. 159), and where pressure has risen by other causes (lateral transfer, hydrocarbon cracking) it gives the pressure
  from compaction only, so it underestimates (p. 159).
- **Vertical effective stress, one-dimensional.** (Abstract, p. 153.) No direction dependence of porosity.
- **Uncertainty:** void ratio typically within 0.1; clay content from logs within 10 %; RFT pressure itself may be
  inflated by supercharging (p. 161, Gulf example).

## 6. Comparison with Strata Lab today

Engine law (`compaction.ts` header, `params.ts`): phi = phi0 exp(-beta sigma') from the past-maximum effective stress,
with phi0 and beta per component: mud phi0 0.63, beta 5.2e-8 /Pa (North Sea default) or phi0 0.40, beta 3.68e-8 /Pa
(Hart mud, Gulf-style preset; Hart et al. 1995 p. 46, fitted to the shallow hydrostatic section of one well).

The two laws differ in **form**, not only in values: Yang and Aplin is linear in ln sigma' (no finite surface porosity),
the engine exponential in sigma' (finite phi0). Adopting eqs 23, 24 would be a change of compaction law, with its own
benchmark and review, not a coefficient swap.

**Porosity at given effective stress (my arithmetic): engine against eqs 23, 24.**

| sigma' MPa | engine North Sea mud | engine Hart mud | Y&A CF 0.3 | Y&A CF 0.5 | Y&A CF 0.7 |
|---|---|---|---|---|---|
| 0.8 | 0.604 | 0.388 | 0.403 | 0.524 | 0.618 |
| 1 | 0.598 | 0.386 | 0.391 | 0.510 | 0.605 |
| 2 | 0.568 | 0.372 | 0.351 | 0.464 | 0.557 |
| 5 | 0.486 | 0.333 | 0.288 | 0.386 | 0.472 |
| 10 | 0.375 | 0.277 | 0.232 | 0.311 | 0.383 |
| 20 | 0.223 | 0.192 | 0.166 | 0.214 | 0.258 |
| 40 | 0.079 | 0.092 | 0.087 | 0.087 | 0.069 |

- The **North Sea default mud** tracks the CF 0.7 curve closely from 1 to 10 MPa (0.598 / 0.605, 0.568 / 0.557, 0.486 /
  0.472, 0.375 / 0.383) and sits between CF 0.5 and 0.7 at 20 MPa. This agrees with its permeability law, which behaves
  like CF about 0.65 (2010 note, section 6).
- The **Hart mud** is at or just below the CF 0.3 curve at 0.8-1 MPa and between the CF 0.3 and CF 0.5 curves from 2 to
  20 MPa, so it is a **less clay-rich mud, CF about 0.3 to 0.5**, in these terms. Its permeability law was tuned for
  phi0 0.63 and behaves like CF 0.6 to 0.7. So in the Gulf preset the compaction curve and the permeability law describe
  different muds. That mismatch is the mechanism behind AUD-6 B-1 in the repo's own account (tuned law not re-fitted for
  phi0 0.40); the 2010 note, section 6, gives the numbers.
- Where Hart's well is (shallow, under 1,500 m, stress up to about 12 MPa per the repo), the Hart fit and the paper's
  CF 0.3-0.5 curves agree to within about 0.1 in porosity from 2 to 20 MPa. That is a rough match between two fits of
  different forms, not a validation of either.
- Burland-Skempton fit (eqs 14, 15) for comparison, my arithmetic: at 1 MPa CF 0.5 it gives porosity 0.518 against 0.510
  for eqs 23, 24; at 10 MPa 0.37 against 0.311. The geological fit gives lower porosity at depth, as the paper says
  (p. 157).

**Unloading and `elastic` (0.05).** The paper gives **no numerical unloading law**. What it says: mudstone deformation is
"a predominantly plastic process" and the major part is not recovered when sediments are unloaded; an unloaded mud
reloaded returns to the virgin line (p. 153, Fig. 1); the "essentially inelastic nature of mudstones means that porosity
is only slightly restored" when effective stress falls (p. 159). Fig. 13 (p. 161) shows a break in the slope of
permeability against effective stress at the past-maximum stress, the paper's evidence for unloading in a Gulf sample,
with no numbers. The engine's `elastic` scales the compressibility used in the pore-pressure equation when effective
stress is below its past maximum (`compaction.ts` header; porosity itself is held at the past-maximum value). So `elastic`
= 0.05 agrees in direction with "only slightly restored" but has **no published value behind it**: the paper cannot
move it from `tuned`. It does support a stronger statement in the ledger: tuned, qualitatively consistent with Yang and
Aplin 2004 pp. 153, 159.

## 7. Relevance to Strata Lab

- **Compaction (`phi0`, `beta`, mud):** eqs 23, 24 are an alternative published law for mud in the Gulf and North Sea,
  with clay content as the one lithology input. It is a form change; see section 6. Not proposed here.
- **Clay content for the permeability re-fit:** the cross-check in section 6 is the basis for the clay-fraction
  recommendation in `yang-aplin-2010.md` section 7.
- **Pore pressure from porosity (eq. 25):** relevant to the M4 well-pressure checks, as an explicit-physics alternative to
  Eaton-type methods (the paper itself contrasts the two, p. 158). Its caveats (virgin curve, not for uplift or
  unloading-driven pressure, p. 159) match the engine's own limits.
- **Sea-floor total stress trends (eqs 26, 27):** an empirical overburden from the sea floor, 31.5 MPa at 5,000 ft below
  the sea floor for the Gulf trend (my arithmetic); could be compared with the engine's own overburden; not done here.
- `elastic`: unchanged, see section 6.
