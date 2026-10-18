# Zhang and Yin 2017, Fracture gradient prediction: an overview and an improved method

Deep-read note (LIT-PP-2a). Pages are "pdf p. N" (the copy carries the publisher's running header but no page
numbers). Claims taken from others are written "Zhang & Yin (citing X)". Nothing in `src/`, `tests/` or presets was
changed.

## 1. Record

- Authors: Jincai Zhang, Shang-Xian Yin.
- Year: 2017 (received 25 May 2017; open access, CC BY 4.0).
- Title: Fracture gradient prediction: an overview and an improved method.
- Journal: Petroleum Science, DOI 10.1007/s12182-017-0182-1 (volume and pages not printed on the copy).
- Access: full text, John's copy (pdf pp. 1-12 read: text, Figs. 1-8, 50-odd references).

## 2. What it is

A review plus a data paper. Section 2 restates the standard fracture-gradient methods (Hubbert & Willis, Matthews &
Kelly, Eaton, Daines, Kirsch tensile failure, upper and lower bounds). Section 3 analyses 229 public leak-off tests
from offshore wells (Gulf of Mexico, North Sea, South America, Gulf of Guinea, Asia; young Neogene-Paleogene sediments
in a normal-faulting regime), finds the effective stress coefficient k0 = (LOT - Pp)/(OBG - Pp) scattered between
0.5 and 1 with an average of 0.75, shows that k0 falls with depth below the mudline, fits an exponential k0(Z), and
proposes a salt fracture gradient equal to the overburden plus a constant from 15 Gulf of Mexico salt wells. Three
case studies. Field units (ppg, psi, ft) with 1 psi = 0.00689 MPa.

## 3. Equations

Symbols: FG fracture gradient, OBG overburden gradient, Pp pore-pressure gradient (all ppg); sigma_V overburden
stress, sigma_h minimum horizontal stress, p pore pressure (psi); k0 effective stress coefficient; nu Poisson's ratio;
Z depth below the mud line (ft); T0 tensile strength; alpha_b Biot coefficient.

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | pdf 4 | P_min-inj = sigma_h' + p = sigma_h | Hubbert & Willis: minimum injection pressure equals the minimum horizontal stress. |
| 2 | pdf 4 | FG = (OBG + 2 Pp)/3 | Hubbert & Willis with the horizontal stress one-third of the effective overburden. |
| 3 | pdf 4 | FG = k0 (OBG - Pp) + Pp | Matthews & Kelly, k0 "obtained from the fracture-initiation pressures of LOTs" in the Gulf Coast. |
| 4 | pdf 4 | FG = nu/(1 - nu) (OBG - Pp) + Pp | Eaton; "equivalent to Matthews & Kelly if k0 = nu/(1-nu)". |
| 5 | pdf 4 | nu = (0.5 (vp/vs)^2 - 1) / ((vp/vs)^2 - 1) | Dynamic Poisson's ratio from sonic logs. |
| 6-7 | pdf 4-5 | Daines: sigma_t superposed tectonic stress; FG = nu/(1-nu)(OBG - Pp) + Pp + sigma_t/D | Daines 1982 (restated). |
| 8 | pdf 5 | p_b = 3 sigma_h - sigma_H - p + T0 (impermeable case) | Kirsch breakdown pressure, vertical well, non-penetrating fluid; thermal term optional. |
| 9-11 | pdf 5 | permeable case with eta = alpha_b (1 - 2nu)/(2(1 - nu)) as a lower bound; thermal stress sigma_T = alpha_T E (T_mud - T_f)/(1 - nu) | Lower bound of breakdown; cooling lowers it. |
| 12 | pdf 6 | P_FPmax = 2 sigma_h - p | Upper bound of fracture pressure (Zhang 2011), from Eq. 8 with sigma_H ~ sigma_h and T0 neglected. |
| 13 | pdf 6 | sigma_h = nu/(1 - nu) (sigma_V - p) + p | Lower bound: the minimum stress itself (Eaton's form in stresses). |
| 14 | pdf 6 | p_avg = (P_FPmax + sigma_h)/2 | Most likely fracture pressure, the mean of the bounds (Zhang 2011). |
| 15 | pdf 7 | k0 = k + a / e^(Z/b) | Depth-dependent effective stress coefficient; k, a, b fitted to offset LOTs. |
| 16 | pdf 7 | FG = (k + a / e^(Z/b)) (OBG - Pp) + Pp | The improved fracture gradient: Eq. 3 with Eq. 15. |
| 17 | pdf 7 | P_s = sigma_V + C | Fracture pressure in salt: overburden plus C, with 0 < C < 1000 psi and C = 500 psi most likely. Empirical, salt only. |

Hand check of Eq. 15 with the most-likely set (k 0.75, a 0.15, b 7,200 ft): k0 = 0.90 at the mudline, 0.86 at
2,000 ft, 0.825 at 5,000 ft, 0.79 at 10,000 ft, 0.76 at 20,000 ft below the mudline. The low set (0.5, 0.1, 5,100)
gives 0.60 at the mudline falling to 0.51 by 12,000 ft; the high set (0.9, 0.4, 12,500) gives 1.30 falling to 0.98 at
20,000 ft (k0 > 1 means LOT above the overburden, which the authors say occurs in young Gulf of Mexico sediments
and in subsalt wells, pdf p. 8).

## 4. Numbers

| Quantity | Value | Units | Setting | Measured / cited / derived | Page, fig |
|---|---|---|---|---|---|
| LOT datasets analysed | 229 (initiation passed, FITs excluded, mostly LOT, some XLOT) | - | Gulf of Mexico, North Sea, South America, Gulf of Guinea, Asia; Neogene-Paleogene, normal faulting | compiled | pdf 6 |
| k0 = (LOT - Pp)/(OBG - Pp) range; average | mostly 0.5 to 1; 0.75 | - | all 229 | measured | pdf 6, Fig. 4 |
| Suggested constant k0 for Matthews & Kelly | 0.75 ("most likely") | - | - | derived | pdf 6 |
| Apparent Poisson's ratio used in Eaton's method (citing Zhang 2011 practice) | 0.43 for shales (nu/(1-nu) = 0.75); 0.3 for sandstones (0.43) | - | - | stated | pdf 4 |
| Biot coefficient | "usually assumed to be 1" in practice | - | - | stated | pdf 4 |
| Eq. 15 low case | k 0.5, a 0.1, b 5,100 | -, -, ft | Fig. 5 left line | fitted | pdf 7 |
| Eq. 15 high case | k 0.9, a 0.4, b 12,500 | -, -, ft | Fig. 5 right line | fitted | pdf 7 |
| Eq. 15 most likely | k 0.75, a 0.15, b 7,200 | -, -, ft | Fig. 5 middle line | fitted | pdf 7 |
| Depth range of Fig. 5 | 0 to about 24,000 ft below the mudline; k0 axis 0 to 1.3 | ft | 229 LOTs | plotted | pdf 7, Fig. 5 |
| Regional pattern | Green Canyon (GoM) LOTs high; North Sea and Gulf of Guinea low | - | - | observed | pdf 6-7 |
| Salt wells examined | 15 (10 Mississippi Canyon, 5 Green Canyon) | - | Gulf of Mexico | compiled | pdf 7, Fig. 6 |
| Salt LOT/FIT relative to overburden | most > sigma_V and < sigma_V + 1000 psi; overburden axis 0 to 20,000 psi | psi | GoM salt | measured | pdf 7, Fig. 6 |
| Salt-creep mud weight | 80-90 % of overburden stress | - | subsalt wells (citing Zhang et al. 2008) | stated | pdf 7 |
| Case 1 (Fig. 7): salt FG from Eq. 17 with C = 500 psi matches salt FITs; subsalt Eaton underestimates; Eq. 16 fits | - | - | GoM salt/presalt/subsalt well | compared | pdf 8, Fig. 7 |
| Breakdown example (Fig. 8) | 10,800 ft: sigma_h 12.8, sigma_H 13.4, Pp 11 ppg, T0 100 psi gives breakdown ~ 14.1 ppg vs OBG 13.9 ppg; measured 14.1 | ppg | shale-gas well | computed | pdf 8-9 |
| Mud-loss classes (seepage, small, partial, natural-fracture, total) and the rule that 0.3 ppg over LOT starts loss | 0.3 | ppg | Fig. 2 | observed | pdf 3 |

Count recorded: 17 rows. The 229 LOTs are not tabulated; only Figs. 4 and 5 show them.

## 5. Data the method was fitted to

229 public LOT/XLOT values from offshore exploration and production wells in five regions, mostly young clastic
sediments, with overburden from density logs and pore pressure from the operators' estimates (section 3.1). Salt: FIT
and LOT in 15 Gulf of Mexico wells. Case studies: one GoM salt-presalt-subsalt well, one shale-gas well with DFIT and
LOT, one offshore well with a kick history.

## 6. Limits the authors state

- The LOT peak "may not be the breakdown pressure, but greater than the initiation pressure"; the paper assumes LOT
  = fracture gradient (pdf p. 6).
- k0 is scattered and depth dependent; "for a better predrill prediction, the fracture gradient needs to be
  calibrated to the offset data, because k0 may behave differently for different regions" (Conclusions, pdf p. 10).
- Eq. 17 is "an empirical equation only for salt formations"; rock inclusions or sutures lower it (pdf p. 7-8).
- Eaton's method "underestimates the fracture gradient" in subsalt formations in the case shown (pdf p. 8).
- Dynamic Poisson's ratio from sonic works for old, cemented formations (Cretaceous and older); young Tertiary
  sediments need the apparent values (0.43 shale) or calibrated k0 (pdf p. 4).

## 7. Relevance to Strata Lab

- `src/engine/wellPressure.ts` lines 93-95: `fracturePressurePa = k (S - P) + P` is Eq. 3 (constant k0) and Eq. 4
  (k0 = nu/(1-nu)). **Form verified** against the review's statement of both methods and their equivalence
  (`eatonK` at lines 98-100 is the nu/(1-nu) of Eq. 4).
- `src/engine/wellPressureParams.ts` lines 31-34: `poissonRatio` 0.40 gives k = 0.67; `matthewsKellyKi` 0.60. The
  229-LOT average is k0 = 0.75 (nu = 0.43), range 0.5-1, and the depth fit gives 0.90 at the mudline falling to 0.76
  at 20,000 ft. The engine's 0.60 and 0.67 therefore sit in the lower half of the published scatter; 0.75 is the
  citable "most likely" constant, and Eq. 15 with (0.75, 0.15, 7,200 ft) is the citable depth curve. This is the
  opposite sense to Eaton's Fig. 4 (k rising with depth from 0.45 to 1.0): Eaton's 1969 curve was back-calculated
  from Gulf Coast onshore fracture data, Zhang & Yin's from offshore LOTs referenced to the mudline. The M4.6 open
  item ("rising stress ratio with depth") has two published answers that disagree in sign; both are now in the notes.
- Salt: Eq. 17, P_s = sigma_V + 500 psi (0 to 1000 psi), from 15 GoM wells. The engine already sets the fracture
  pressure in salt equal to the overburden (`wellPressure.ts` lines 19-21 and 135-136, marked "industry practice; no
  source is in this project (to verify)"). This is the published source: Zhang & Yin's data put salt LOT/FIT at or
  above sigma_V, so the engine's rule is the conservative (C = 0) end of their 0-1000 psi band, and the "to verify"
  can be closed with this citation. Subsalt: constant-nu Eaton underestimates (Fig. 7), and the mud weight needed
  against salt creep is 80-90 % of the overburden (pdf p. 7), a published number for the salt notes (D22-D24).
- Not in Zhang & Yin: compaction or pore-pressure prediction (pore pressure is an input), deep-water overburden
  (OBG is taken from logs), any tabulated dataset.

The one finding that matters most for M4: from 229 offshore LOTs the effective stress coefficient averages 0.75 and
decreases with depth below the mudline (k0 = 0.75 + 0.15 e^(-Z/7200 ft)), and in salt the fracture pressure is the
overburden plus about 500 psi.
