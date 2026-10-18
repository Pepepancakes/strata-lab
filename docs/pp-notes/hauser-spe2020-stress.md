# Hauser 2020, Evaluating an integrated physical model for borehole-leakoff pressures

Deep-read note (LIT-PP-2b, D27.4). Written to be checked against the paper: every number carries a page, figure, table or equation and a setting.
Page numbers are the paper's own (1-21, pdf page = printed page). Claims the paper takes from other authors are written "Hauser (citing Y)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Author: Matt R. Hauser, Shell Exploration and Production Company.
- Year: 2020. SPE Journal; "Original SPE manuscript received for review 9 July 2020 ... peer approved 1 October 2020" (p. 1).
- Title: Evaluating an Integrated Physical Model for Borehole-Leakoff Pressures.
- Paper number: SPE 204453 (p. 1). DOI not printed in the copy (SPE papers of this number carry 10.2118/204453-PA; to verify).
- Access: full text, John's copy (pp. 1-21 read: body, nomenclature, references, Appendix A). The equation typography did not survive text extraction for Eqs. 7, 8 and A-6 to A-11; the body equations transcribed below (1, 3, 4, 5, 6, 11, 13, 15, 16, 17) were legible. Figures are pictures and were not rendered.

## 2. What it is

A model paper with a global test. The pressure at which a leak-off test first deviates from linear build-up (LOP) is modelled as the smaller of (a) reopening a pre-existing fracture at the minimum horizontal stress Sh, and (b) creating a new fracture at the borehole wall by tensile failure or by any of three Mohr-Coulomb shear modes, then opening it. Far-field Sh comes from the uniaxial poroelastic relation (Eaton's form) with Poisson's ratio from Vp/Vs. Tested against 254 LOTs from six regions (GoM, Nigeria, Brazil, Nova Scotia, French Guiana, Nile Delta) and 30 GoM lost-circulation events. The mixed-mode model matches to about 0.8 MPa sd; Hubbert-Willis and Matthews-Kelly forms do much worse.

## 3. Key findings

1. Two mechanisms, bimodal data. LOPs cluster tightly at either calculated Sh (reopening) or the calculated fracture-initiation pressure (creation); the sd of residuals within each mode is under 1 MPa, while the gap between the modes averages 3 MPa and reaches nearly 13 MPa (p. 11, Fig. 8b). Overall split 58 % creation, 42 % reopening, with no correlation to depth, overpressure or VES (p. 14, Fig. 10).
2. Residuals, all 254 tests, GoM-calibrated strength: mean -0.18 MPa, sd 0.82 MPa, max 2.64 MPa (Table 3, p. 12; Table 4). Hubbert and Willis form: mean -1.31, sd 2.86, max 13.4 MPa. Matthews and Kelly form, calibrated on the same 15 GoM LOTs: mean -2.12, sd 2.66, max 19.1 MPa (Table 4, p. 12). "The empirical approach performs poorly on the full data set ... it must simply be calibrated on a local scale for each application" (p. 12).
3. The far-field stress model is Eq. 11, sigma_h = nu / (1 - nu) sigma_v, with Terzaghi effective stress sigma_i = S_i - P (p. 4). It holds "strictly" only for zero lateral strain, uniaxial vertical load and isotropic linear elasticity (p. 4). Validated on the GoM by 30 lost-circulation events whose pressure ranges span the calculated Sh, none farther than 1 MPa from it (p. 8, Fig. 6).
4. Loading history does not invalidate Eq. 11: with a stress-dependent Poisson's ratio the differential form (Eq. 12) integrates to Eq. 11 with the present cumulative load and the present nu, contrary to Voight 1974 and Prats 1981 (p. 5). Structuration is the real threat to the assumptions, not consolidation (p. 5).
5. Eaton 1969's back-calculated nu trend is not evidence for a physical model: it treated lost-circulation onset as stress and assumed hydrostatic pore pressure under very high mud weights (Costley 1967 data); "neither stress nor pore pressure were unambiguously available to Eaton (1969)" (p. 6).
6. Shear-initiation strength from velocity: friction angle phi = C0 + C1 Vs, UCS = C2 Vs^C3 (Eq. 17, p. 11), fitted on 15 GoM LOTs (Table 5, p. 13). Shear in the r-theta plane followed by tensile opening is the minimum mode for 80 % of the creation tests, z-theta shear 15 %, pure tensile only 5 % (p. 13). About 10 % of the LOTs are above the overburden and are still matched, because Sv only enters through the shear modes (p. 11).
7. Frame (drained) moduli from Gassmann (Eqs. 15-16) remove a systematic overprediction for Vp < 2400 m/s (high porosity): residual -0.01 +/- 0.45 MPa against -0.33 +/- 0.50 MPa undrained (p. 13). The shift is 1-1.4 MPa or less for GoM conditions, but 0.5 MPa at 300 m below mudline is 0.17 g/cc (1.4 ppg) of EMW referenced to seafloor, against 0.017 g/cc (0.14 ppg) at 3000 m (p. 6). Grain fit: rho_gr = 2.85 g/cc, K_gr = 18.58 GPa (p. 13).
8. Temperature: a 25-35 degC cooler mud (mud coolers) lowers initiation pressure by 1-4 MPa, sometimes below Sh; those tests "fell uniformly on minimum stress" (p. 14, Eq. 2). A 5 degC contrast shifts it by up to 0.2 MPa (p. 14).
9. Salt proximity: 29 % of Set GOM (1) tests are within 2500 m below tabular salt and 8 % of Set GOM (2) within 2000 m, with no correlation of residuals; "salt tectonics have a negligible impact on stresses for the locations in this study. This assumption should obviously be revisited if more complex salt structures are involved" (p. 11).
10. Operational reading (p. 16): below Sh, low loss risk; between Sh and P_init, stable unless pre-existing fractures are met; above P_init, losses very likely, and after large losses the effective strength falls to Sh (one event dropped more than 26 MPa, p. 16). Mud type had no effect on LOP (p. 11, citing Onyia 1994).
11. Example well, Texas shelf, 2004 (Fig. 11, pp. 15): offset LOTs below about 2500 m sit at initiation; most LOTs in the well (mud coolers) sit at Sh. "A Matthews and Kelly (1967) approach would generate a single reliable-looking fracture gradient close to overburden below approximately 3300 m, and the actual test results would have come as something of a surprise" (p. 15). Plot axes: TVD below rotary table against pressure gradient in kPa/m, 10 to 24 (Fig. 11).

## 4. Equations (as transcribed; symbols from the Nomenclature, p. 16-17; compression positive, p. 3)

- Eq. 1 (p. 3), stresses at the wall of a vertical borehole in a VTI stress field: S_r = P_w + dS_r^m; S_theta = 2 S_h - P_w + dS_theta^m; S_z = S_v + dS_z^m. P_w borehole fluid pressure; dS^m an added increment from mechanism m (thermal, poroelastic).
- Eq. 2 (p. 3), thermal: dS_r = 0; dS_theta = dS_z = E_fr alpha_T (T_w - T_0) / (1 - nu_fr), an upper bound at thermal equilibrium.
- Eq. 3 (p. 3), tensile initiation, no tensile strength: P_w,tensile > 2 S_h - P + dS_theta^m (the Hubbert and Willis 1957 mode; the upper bound on LOP).
- Eq. 4 (p. 3), Mohr-Coulomb: tau = S_0 + sigma_m tan phi = (1 - sin phi) UCS / (2 cos phi) + sigma_m tan phi.
- Eq. 5 (p. 3): sigma_i = sigma_j (1 - sin phi) / (1 + sin phi) - UCS (1 - sin phi) / (1 + sin phi), for sigma_i < sigma_j.
- Eq. 6 (p. 3), normal stress on the shear plane: sigma_norm = (sigma_i + sigma_j) / 2 + (sigma_i - sigma_j) sin phi / 2.
- Eqs. 7-8 (p. 4): the three shear-initiation pressures (r-theta, r-z, z-theta pairings) and the three opening pressures; garbled in the text layer, not transcribed. Eq. 9: P_w^(i-j) = max(P_shear, P_norm) per pairing. Eq. 10: P_w,init = min(P_w^(r-theta), P_w^(r-z), P_w^(z-theta), P_w,tensile).
- Eq. 11 (p. 4): sigma_h = nu / (1 - nu) sigma_v, sigma_i = S_i - P (Terzaghi 1943). This is the relation `eatonK` implements.
- Eq. 12 (p. 4): the differential form with nu(sigma_v); not needed here.
- Eq. 13 (p. 5): nu = (1/2) (3K - 2 mu) / (3K + mu) = (1/2) ((Vp/Vs)^2 - 2) / ((Vp/Vs)^2 - 1).
- Eq. 14 (p. 5), VTI anisotropy (Amadei et al. 1987): sigma_h = (E_h / E_v) nu_v / (1 - nu_h) sigma_v, approximately (nu / (1 - nu) + delta) sigma_v with Thomsen delta; not used.
- Eqs. 15-16 (pp. 5-6), Gassmann: K_fr from K_u, K_gr, K_fluid, phi; K_u = rho_u (Vp^2 - 4/3 Vs^2), mu_u = rho_u Vs^2, phi = (rho_gr - rho_u) / (rho_gr - rho_fluid).
- Eq. 17 (p. 11): phi = C0 + C1 Vs; UCS = C2 Vs^C3.
- Appendix A (pp. 17-21): the general form for an arbitrary stress tensor and borehole orientation (Eqs. A-1 to A-12), reducing to a quadratic in P_w (A-8, A-9); poroelastic increment at the wall from Detournay and Cheng 1988 (A-12), average shift 0.2 MPa, sd 0.3, max about 4 MPa for a hypothetical horizontal hole (p. 20).

## 5. Numbers

| Value | Setting | Page |
|---|---|---|
| 254 LOTs, 6 regions; 30 lost-circulation events (GoM) | data set | 6, Table 1 |
| < 8 % | tests at inclination > 20 degrees | 6 |
| < 2 % | overburden change from +/- 1 sd on the regional density trend; < 1.5 % between integrated log and trend | 8 |
| 4 % sd, about 10 % max | error of the GoM shale pressure transforms against sand pressures | 8 |
| none > 1 MPa from Sh | loss-event ranges against calculated Sh | 8 |
| 3 MPa mean, nearly 13 MPa max | gap between reopening and creation pressures | 11 |
| 58 % / 42 % | creation / reopening split, all data | 14 |
| 80 % / 15 % / 5 % | r-theta shear / z-theta shear / pure tensile as the minimum creation mode | 13 |
| about 10 % | LOTs above overburden | 11 |
| -0.18, 0.82, 2.64 MPa | mixed-mode residual mean, sd, max (all data) | Table 3, 4 |
| -1.31, 2.86, 13.4 MPa | Hubbert and Willis residuals | Table 4 |
| -2.12, 2.66, 19.1 MPa | Matthews and Kelly residuals (15-point calibration) | Table 4 |
| C0 = 0.0 deg, C1 = 0.01035 deg/(m/s), C2 = 5.529e-9 MPa, C3 = 2.955 | undrained GoM strength calibration | Table 5 |
| C0 = 3.082, C1 = 0.01344, C2 = 1.269e-7, C3 = 2.524 | frame-moduli calibration | Table 5 |
| C0 = 5.75, C1 = 0.009822, C2 = 6.400e-9, C3 = 2.919 | refit including inclination (Appendix A) | 20 |
| rho_gr = 2.85 g/cc, K_gr = 18.58 GPa; 14,000 ppm | best-fit grain properties; assumed brine salinity | 13 |
| K_fluid 2.173 GPa, rho_fluid 1.013 g/cc | Fig. 2 example | 6 |
| 1-1.4 MPa or less | max undrained-vs-frame shift in Sh, GoM | 6 |
| 0.17 g/cc (1.4 ppg) at 300 m; 0.017 g/cc (0.14 ppg) at 3000 m bml | EMW equivalent of a 0.5 MPa shift | 6 |
| 2400 m/s | Vp threshold separating the biased (slow) from the unbiased subset | 12-13 |
| phi about 20 deg (Ingram and Urai 1999 shales); phi = 25 deg, UCS = (7682 / Dt)^1.82 / 145 (Militzer and Stoll 1973, carbonates, Dt in us/ft, UCS in MPa) | alternative strength models | 10-11 |
| 5 degC; 25-35 degC | typical mud-formation contrast; with mud coolers | 14 |
| up to 0.2 MPa; 1-4 MPa | thermal shift of initiation pressure for those contrasts, alpha_T 1e-6 to 1e-5 | 14 |
| 0.2 MPa mean, 0.3 sd, about 4 MPa max | poroelastic shift, hypothetical horizontal hole | 20 |
| 10-24 kPa/m; g/cc x 0.43353 = psi/ft; kPa/m x 0.8510 = ppg EMW | Fig. 11 axis; conversion factors used | 15, 21 |

## 6. Limits the author states

- Stress model: VTI, uniaxial loading, zero lateral strain, isotropic elasticity, no viscous or thermal far-field effects; "it will not be valid in all basins" (p. 16). Data are all passive-margin extensional settings; near salt only tabular bodies (pp. 5, 11).
- Impermeable shale and tight carbonate only; the Haimson and Fairhurst permeable-rock term is omitted (p. 3). Conductive faults and matrix losses (vuggy, karst) are excluded (p. 16).
- Only the first inflection (LOP) is modelled; fracture propagation, bedding and stress redistribution are not (p. 4).
- No image logs: the failure mode of any test is inferred from proximity, not observed (p. 11, 16).
- Frame-moduli improvement may be a fit artefact (more parameters) (p. 13).
- Eqs. 7-8 give near-wall initiation only; fracture must still exceed far-field Sh to propagate (p. 4).

## 7. Relevance to Strata Lab

Bears on `src/engine/wellPressure.ts` (`fracturePressurePa`, `eatonK`, the comment block "to verify against the papers"), `src/engine/wellPressureParams.ts` (`poissonRatio`, `matthewsKellyKi`, `fgMethod`) and the M4 plot.

- Eaton's form confirmed. Eq. 11 is sigma_h = nu / (1 - nu) sigma_v with Terzaghi effective stress; adding P gives S_h = nu / (1 - nu) (S_v - P) + P, which is `fracturePressurePa(sv, p, eatonK(nu))` exactly. The comment in wellPressure.ts "written from the commonly quoted form (to verify against the papers)" can now cite this paper (p. 4) for the Eaton form. Hauser also says what the form physically is: a minimum horizontal stress Sh, hence a REOPENING pressure, the lower bound of LOP, not a fracture-initiation pressure (pp. 1, 9).
- Matthews and Kelly's form confirmed as Pf = Ki (S - P) + P with Ki "correlated with vertical effective stress" (p. 1); the paper tests it and finds it the worst of the three models unless locally calibrated (Table 4). The engine's constant Ki is, per this paper, a locally calibrated empirical number; label stays "tuned".
- What the engine's single curve is: with constant K it is Sh, the reopening line. Hauser's data say LOT falls at Sh about 42 % of the time and about 3 MPa (up to 13 MPa) higher the rest (p. 11, 14). So the engine's FG is a conservative lower bound on leak-off, consistent with IOGP's advice to calibrate the fracture gradient to the lower end of the range where poorly constrained (IOGP 608 p. 15). Not modelled: initiation pressures (Eqs. 3, 7-10), which need Vp, Vs, UCS and phi the engine does not carry.
- Poisson's ratio. The engine's `poissonRatio` default should be checked against what this paper uses: nu from Vp/Vs (Eq. 13), with frame moduli better at high porosity (p. 13). No single value is quoted; the paper uses log-derived profiles. Eaton 1969's back-calculated nu-depth trend is argued to be an artefact of hydrostatic-pressure and lost-circulation assumptions (p. 6), so a depth-trend for nu is not endorsed here.
- Overburden: regional density trends integrated from mudline, with < 2 % sensitivity (p. 8): same recipe as the engine's Sv.
- Pore pressure: shale pressures from resistivity and sonic transforms calibrated to sand pressures, 4 % sd (p. 8); carbonates assumed lithostat-parallel within units (p. 8). The engine's compaction-derived pore pressure is a different route to the same quantity.
- Salt: "negligible impact on stresses" for tabular salt (p. 11), supporting the engine's not perturbing Sh near its salt bodies, with the paper's own caveat for complex structures.
- Window near surface: the EMW sensitivity example (0.5 MPa = 1.4 ppg at 300 m bml, p. 6) is the arithmetic reason the M4 plot's shallow EMW curves are so sensitive; worth a note in the M4 docs.
- Temperature and mud type: out of scope for the engine; recorded for the plot's "tuned" margins (a 1-4 MPa thermal drop with cold mud, p. 14).

## 8. Could not confirm

- Eqs. 7, 8 and A-6 to A-11 are not legible in the extracted text; only their structure (Eqs. 9-10, the max/min logic) is reported.
- Figures 2-11 and A-1 were not rendered; their values are from the captions and text.
- The DOI is not printed; the paper number SPE 204453 is.
- Table 1 and Table 3 row alignment was partly scrambled in extraction; only the "All data" and GoM aggregate figures are used above.
