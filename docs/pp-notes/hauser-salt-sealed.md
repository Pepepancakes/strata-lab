# Hauser 2020, Pore pressure estimation in salt-sealed formations

Deep-read note (LIT-PP-2b, D27.4). Written to be checked against the paper: every number carries a page, figure or table and a setting.
Page numbers are journal pages 105-115; pdf page 1 is journal p. 105 (pdf page n = journal page n + 104).
Claims the paper takes from other authors are written "Hauser (citing Y)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Author: Matt R. Hauser.
- Year: 2020 (the running head prints "Marine and Petroleum Geology 111 (2020) 105-115"; received 19 November 2018, accepted 13 August 2019, online 14 August 2019, p. 105). The file name says 2019 (the online year); the printed volume year is 2020, so this note cites it as Hauser 2020.
- Title: Pore pressure estimation in salt-sealed formations.
- Journal: Marine and Petroleum Geology, volume 111, pp. 105-115. Research paper.
- DOI: 10.1016/j.marpetgeo.2019.08.020 (printed on p. 105).
- Access: full text, John's copy (all 11 pages read including the reference list; pdf page 2 and 4 rendered to check the equations).

## 2. What it is

A field-data paper. 24 Gulf of Mexico wells in sub-salt sediments enclosed by salt allochthons (four-way salt closure, or three-way dip closure against a concave base salt whose downdip elements seal) are used to test whether the salt seal, not compaction, sets the pore pressure. The result is an empirical model: the salt seal fails at a fixed differential pressure below the base-salt confining stress, and the pressure in the sealed sediment below the leak point rises at a fixed gradient. It gives the overburden recipe used (Eq. 1), the pressure model (Eqs. 2-3) with fitted constants (Table 1), a map application and a well example (Fig. 11).

## 3. Key findings

1. Conventional log and seismic pressure methods are unreliable just below salt: "velocity-pressure or velocity-stress relationships that may be quite reliable in the broader basin are found to be much less stable below salt" (p. 105, citing Hauser et al. 2013). In this dataset the sonic-VES response below salt "is off trend and much more scattered" while the temperature-normalised resistivity response "is consistent for all measurements" (p. 107, Fig. 4), so the quantitative estimates use resistivity.
2. Vertical effective stress (overburden minus pore pressure) at base salt is nearly uniform across the 24 wells: 1.5 to 5.25 MPa (218-761 psi), average 3.27 MPa (474 psi), "a rather narrow VES range of less than 4 MPa across a much larger range of overburden loads (75 MPa)", which "suggests a correlation between pore pressure and overburden pressure, as might be expected in a system controlled by a seal limit" (p. 109, Fig. 6).
3. Two seal models. "Local leak": each point of the base salt leaks into the salt directly above it, so PP at the well tracks the local overburden (Fig. 7); linear fit slope 0.982 +/- 0.0178 MPa/MPa, intercept -1.19 +/- 2.07 MPa, R^2 > 0.99, but residuals correlate with depth below the base-salt crest (p. 109, Fig. 7c, Table 1). "Crestal leak": the whole enclosed basin leaks only at the point of minimum base-salt overburden (the crest), and pressure below it rises along a constant gradient (Fig. 8); fit slope 0.0189 MPa/m (0.837 psi/ft), intercept -2.38 MPa (-345 psi), R^2 > 0.99, residual sd 0.619 MPa (89.8 psi), half that of the local model, with no remaining correlation (p. 110, Table 1). The crestal model is adopted.
4. Seal strength: the salt seal fails about 2.4 MPa (345 psi) below the confining stress at the base-salt overburden minimum, sd about 1.2 MPa (169 psi) (p. 110). Intra-salt pressure events (13 events in 9 wells: 8 well kills, 5 mud-gas responses) sit 1.99-3.36 MPa (289-488 psi) below the local overburden, average 2.85 MPa (413 psi) (pp. 110-111, Fig. 9), "consistent" with the sub-salt seal strength, suggesting "a common effective-stress dependent permeability mechanism" in salt (p. 111).
5. The sub-salt gradient of 0.0189 MPa/m (0.837 psi/ft) matches the upper bound of the 561 regional (non-salt) sand pressures plotted against depth below mudline (p. 111, Fig. 10): the same limit on vertical drainage may control both. The local-leak model would instead imply a near-lithostatic gradient along the salt face (salt about 0.0212 MPa/m, 0.941 psi/ft; sub-salt sediment about 0.0230 MPa/m, 1.02 psi/ft), "substantially higher than the pressure gradients seen in regional data" (p. 111).
6. Stress in salt is taken as isotropic and equal to the overburden, "consistent with common practice in both static and dynamic basin scale numerical models" (p. 107, citing Munson and Dawson 1979; Fredrich et al. 2003; Nikolinakou et al. 2018). This is the paper's statement of the rule the engine uses in salt (D21).
7. Salt density: halite crystal 2.168 g/cc at STP (citing Anthony et al. 1990); thermal expansion and compressibility move salt density by about 0.04 g/cc over the conditions met, which changes base-salt overburden by less than about 0.48 MPa (70 psi); a constant 2.17 g/cc (about 0.9408 psi/ft) is used (p. 108). Sea water 1.03 g/cc (0.446 psi/ft) (p. 107). Formation brine 1.07 g/cc (0.465 psi/ft) for the fluid column term (p. 112).
8. Application: a base-salt overburden map from seismic depths (Eq. 1, 1-D at each point), the minimum found, PP at the minimum set 2.38 MPa below its overburden, extrapolated with Eq. 2 to a base-salt pressure map and a VES (drilling-margin) map, contoured at 30 kg/m^3 (about 0.25 ppg) major and 10 kg/m^3 minor; flat dips assumed, so it is a "worst-case" (lowest margin) map (p. 112, Fig. 11b). Along a well, each mapped horizon's crestal pressure from Eq. 2 is carried to the well along a 1.07 g/cc fluid gradient (Eq. 3); the result "can be seen to agree quite well with observed pressures over the entire well trajectory", and the local-leak trend "substantially overpredicts" (p. 112, Fig. 11c).
9. Mechanism: four salt-permeability mechanisms from the literature (macro-fractures, dilatant grain-scale fracture networks, grain-edge tubules, grain-face films, p. 114); the data imply "essentially a vertical effective stress cutoff on permeability" (p. 114). Brine data only: hydrocarbons would need a capillary entry pressure above the seal pressure, so hydrocarbon pressures could exceed Eqs. 2-3 (pp. 114-115).

## 4. Equations

- Compaction transform (p. 106, unnumbered, checked on the page image): sigma_v = c1 epsilon^d1 + c2 epsilon^d2, with sigma_v vertical effective stress, epsilon void ratio, c1, d1, c2, d2 calibration constants (values not printed). Porosity from sonic through rho = a Vp^b (Gardner form, p. 106) with assumed constant mineral and fluid densities; from resistivity through Archie, R_formation,200 = R_w,200 phi^-m, with resistivities normalised to 93 degC (200 degF) by the modified Arps equation R_200 = R_form (T_form,degF + 6.77) / (200 + 6.77) (p. 106). m and R_w,200 are "effective" fitted coefficients that absorb clay conductivity (p. 106).
- Eq. (1), p. 108 (checked on the page image): OBP = integral(sea level to water bottom) rho_seawater g dz + integral(water bottom to top salt) a z_bml^b g dz + integral(top salt to base salt) rho_salt g dz. g gravity; a, b fitted coefficients of the sediment density-depth-below-mudline trend (values not printed, "internal regional deepwater GoM trendwork"); rho_seawater 1.03 g/cc, rho_salt 2.17 g/cc. Units: MPa with psi in parentheses throughout.
- Eq. (2), p. 111: PP_BS = OBP_BS-min + a (z_BS - z_BS-min) - b, with PP_BS pore pressure at base salt at the well, OBP_BS-min overburden at the base-salt point of minimum overburden, z depths, a = 0.0189 MPa/m (0.837 psi/ft), b = 2.38 MPa (345 psi) (Table 1, "All" row, crestal leak). Away from base salt, for flat or laterally impermeable sediment, z_BS is replaced by the sediment depth z (p. 111). Note the symbols a, b in Eq. 2 are not the a, b of Eq. 1.
- Eq. (3), p. 111: PP_horizon(z) = [OBP_BS-min + a (z_horizon,BS - z_BS-min) - b] + rho_fluid g (z - z_horizon,BS): the crestal value of a laterally connected horizon, carried along a fluid column (rho_fluid 1.07 g/cc) to the point of interest.

## 5. Numbers

| Value | Setting | Page |
|---|---|---|
| 24 wells | sub-salt data, GoM, four-way and three-way closures | 106, Fig. 2 |
| 101-1,798 m (330-5,900 ft) | water depth of those wells | 106 |
| 488-4,968 m (1,600-16,300 ft) | salt thickness | 106 |
| 45-82 degC (114-179 degF) | temperature at base salt | 106 |
| 70-145 MPa (about 10,200-21,000 psi) | overburden at base salt | 106 |
| 9 wells within 150 m (about 500 ft), 7 within 49 m (160 ft) | direct sand pressures near base salt | 106 |
| 7 wells, 180-790 m (600-2,600 ft) below salt | local calibration pressures | 106 |
| 561 pressure points, 56 wells | regional calibration set | 106 |
| 3 m (10 ft) | thickness of the clean mudrock sampled above each pressure point | 106 |
| 1.5-5.25 MPa (218-761 psi), mean 3.27 MPa (474 psi) | VES at base salt | 109, Fig. 6 |
| 75 MPa | span of overburden across the wells | 109 |
| 0.982 +/- 0.0178; -1.19 +/- 2.07 MPa | local-leak fit, all data (slope dP/dOBP, intercept) | 110, Table 1 |
| 0.0189 +/- 0.00103 MPa/m (0.837 +/- 0.0453 psi/ft); -2.38 +/- 0.584 MPa (-345 +/- 84.7 psi) | crestal-leak fit, all data | 110, Table 1 |
| 0.0191 MPa/m, -2.41 MPa; 0.0195 MPa/m, -2.69 MPa | crestal fit for 4-way wells; for pressure-test wells | 110, Table 1 |
| 0.023 MPa (3.4 psi) mean, sd 1.19 MPa (173 psi) | local-leak residuals | 109 |
| 0.030 MPa (4.4 psi) mean, sd 0.619 MPa (89.8 psi) | crestal-leak residuals | 110 |
| about 2.4 MPa (345 psi), sd about 1.2 MPa (169 psi) | seal strength below the crestal confining stress | 110 |
| 1.99-3.36 MPa (289-488 psi), mean 2.85 MPa (413 psi) | intra-salt pressures below local overburden, 13 events, 9 wells | 110-111, Fig. 9 |
| 2.168 g/cc; 2.17 g/cc (0.9408 psi/ft) | halite crystal density; salt density used | 108 |
| about 0.04 g/cc; < about 0.48 MPa (70 psi) | salt density variation from T and P; its effect on base-salt overburden | 108 |
| 1.03 g/cc (0.446 psi/ft) | sea water | 107 |
| 1.07 g/cc (0.465 psi/ft) | formation brine, Eq. 3 | 112 |
| 0.0212 MPa/m (0.941 psi/ft); 0.0230 MPa/m (1.02 psi/ft) | salt gradient; typical sub-salt sediment gradient | 111 |
| 30 kg/m^3 (about 0.25 ppg); 10 kg/m^3 | VES map contour intervals | 112 |
| 0.1 mD | tubule-network permeability estimated by Lewis and Holness 1996 (citing) | 114 |
| 100 MPa | load under which Watanabe 2010 found negligible tubule closure (citing) | 114 |
| several hundred km^2; thousands of metres below base salt | extent over which the model has been applied | 115 |

## 6. Limits the author states

- Overburden uncertainty was not estimated; the plotted uncertainties are pore-pressure only (p. 108). The 1-D overburden "is not exact" unless the surfaces are flat; complex geometries need 3-D stress models (p. 112, citing Fredrich et al. 2003; Nikolinakou et al. 2018).
- Log models assume present effective stress is the historical maximum; unloading and secondary generation were not modelled, only argued unlikely (temperatures below illitisation, no erosion, limited lateral transfer) (p. 113).
- Hydrodynamic (flow-focusing) effects are inside the empirical fits and were not modelled (p. 111).
- Brine only; hydrocarbon columns may exceed the model (pp. 114-115).
- Needs salt in place early, and non-salt bounding elements (welds, faults) sealing at least as well as the salt; sands connected to outside basins break the model (p. 114).
- The sediment gradient 0.0189 MPa/m is regional (GoM mudrock); other lithologies, e.g. carbonates, or regions with lithostat-parallel gradients would differ (pp. 114-115).
- Why resistivity works below salt and sonic does not is left open (p. 114).

## 7. Relevance to Strata Lab

Bears on `src/engine/well.ts` (overburden, hydrostatic and pore-pressure sampling), `src/engine/wellPressure.ts` (`wellPressures`, salt rule), `src/engine/compaction.ts` (`porosity(P, lith, s)`) and the D27 question "what happens near and below salt".

- Overburden. Eq. 1 is the same recipe as the engine's Sv: water column (constant density) plus the integral of sediment bulk density plus salt at constant density. Same form and units (Pa in the engine, MPa or psi in the paper). The engine integrates its own compacted densities rather than a fitted a z^b trend, which is the better of the two where the record is known. Salt 2.17 g/cc (p. 108) is a direct check on the engine's salt density parameter (see `params.ts` and physics-references); sea water 1.03 g/cc (p. 107) against the engine's RHO_W.
- Stress in salt = overburden, isotropic (p. 107). This is the citation physics-references "M4 well pressures" lacks for "In salt the fracture gradient is the overburden (to verify)". The paper cites it as common practice, with Munson and Dawson 1979, Fredrich et al. 2003 and Nikolinakou et al. 2018 as the sources behind it (to verify; not read).
- Pore pressure in salt: the paper treats salt as having no sediment pore pressure but shows intra-salt fluid events at 2-3.4 MPa below overburden (p. 110-111): the engine's NaN in salt is a reasonable display choice, and a mud weight "close to the overburden" in salt (physics-references, no source) is consistent with these events sitting 289-488 psi below the overburden.
- Sub-salt pore pressure: the engine does not model it (physics-references "Sub-salt pore pressure: not claimed"); its compaction solver would give hydrostatic-plus-excess from 1D drainage with the salt as a no-flow top. Hauser's model gives instead PP_BS = OBP at the crest - 2.38 MPa, rising at 0.0189 MPa/m below (Eq. 2): base-salt VES of 1.5-5.25 MPa (p. 109), i.e. a near-closed window. This is the simplest citable sub-salt rule for D27: a seal-limited pressure, not a compaction result. The engine's Terzaghi porosity law `porosity(P, lith, s)` applied with that VES would predict almost uncompacted sediment at base salt, which is what the paper's compaction transform also assumes (Terzaghi VES, p. 106).
- Compaction transform. The paper's sigma_v = c1 e^d1 + c2 e^d2 is a power law in void ratio with Terzaghi VES; the engine uses Athy, phi = phi0 exp(-beta s). Different form, same stress definition; no coefficients are printed, so nothing can be transcribed.
- Window near salt: no window counted in salt (M4.7) agrees with the paper's treatment; below salt the paper's VES map (contours 0.25 ppg) is exactly a "drilling margin" display, which the M4 plot could echo.
- Not transferable: the constants a, b of Eq. 2 are GoM allochthon fits and the paper warns the gradient "may vary from region to region" (p. 115); the engine's synthetic section is a GoM-like margin, so using them would be "cited, GoM only".

## 8. Could not confirm

- Figures 2, 4-11 were not rendered; values are from the text and Table 1. The void-ratio transform coefficients c1, d1, c2, d2 and the density-trend a, b are not printed anywhere in the paper.
- The 0.9408 psi/ft for 2.17 g/cc is the paper's figure (2.17 x 0.4335 = 0.9407, consistent).
- The three works cited for "stress in salt equals overburden" (Munson and Dawson 1979; Fredrich et al. 2003; Nikolinakou et al. 2018) were not read.
