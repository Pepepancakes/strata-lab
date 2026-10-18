# Hauser and Couzens-Schultz (preprint), Can compaction modeling and pore pressure prediction be simplified by the definition of effective stress?

Deep-read note (LIT-PP-2b, D27.4). Written to be checked against the paper: every number carries a page, figure, table or equation and a setting.
Page numbers are pdf pages of the SSRN preprint (the preprint has no printed page numbers; the body runs pdf pp. 4-10, references pp. 11-13, Appendix A pp. 13-15, tables pp. 16-17, figure captions pp. 18-26, then 28 blank pages). Claims the paper takes from other authors are written "H&CS (citing Y)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Authors: Matt R. Hauser (corresponding), Brent A. Couzens-Schultz; both Shell International Exploration and Production, Houston (p. 1).
- Year: undated preprint. SSRN abstract 5128263 (every page footer). Cites Hauser 2020a and 2020b and Xie et al. 2021, so 2025 or later (the SSRN number is consistent with early 2025; to verify).
- Status: "Preprint not peer reviewed" (every page). Not a citable peer-reviewed source; cite as a preprint if at all.
- Title: Can compaction modeling and pore pressure prediction be simplified by the definition of effective stress?
- DOI: none printed. URL https://ssrn.com/abstract=5128263.
- Access: full text, John's copy (pdf pp. 1-27 read: body, nomenclature, references, appendix, tables and captions; pp. 28-54 are blank). Eqs. 1, 2, 4 and Table 2 checked on rendered page images; Eq. 3 (Gassmann) not legible in the text layer and not re-rendered (it is the standard form, also Eq. 15 of Hauser 2020b). Figures are pictures and were not rendered.

## 2. What it is

A data paper arguing that compaction trends (velocity or resistivity against vertical effective stress) are far tighter and more consistent between basins if the effective stress is Biot's, sigma = S - alpha Pp, with alpha = 1 - Kfr / Kgr estimated from logs, than Terzaghi's (alpha = 1). 991 sand pressure points and their bounding shales from 148 wells in three regions (GoM 881 points, Egypt 40, South America 70; Table 1). Under Terzaghi the data scatter and split by pressure regime; under Biot they collapse to two trends, "smectitic" (T < 93 degC) and "illitic". A 13-well GoM test shows a Biot pressure inversion matching better than a Terzaghi one (Fig. 6).

## 3. Key findings

1. Terzaghi trends depend on the pressure path. With Biot alpha < 1 at depth, "a drained formation following a hydrostatic burial trend and an undrained formation following a lithostatic burial trend would exhibit quite different compaction behavior if plotted against a Terzaghi effective stress" (p. 5, Fig. 1, Trinidad). Forward-modelled constant-lambda* paths (lambda* = (Pp - Phyd)/(Sv - Phyd) = 0.25, 0.5, 0.75, 0.9) reproduce the data subsets (p. 7, Fig. 4). Consequence: "a conventional Terzaghi-based effective stress/pore pressure model calibrated in a low-pressure basin would tend to predict low pressures and underpredict any high-pressure sections, while a model calibrated in a high pressure basin would tend to overpredict" (p. 8). Bowers 1995 and Hauser et al. 2013 trends differ for that reason (pp. 7-8).
2. Biot alpha from logs: alpha = 1 - Kfr / Kgr (Eq. 2, p. 5, citing Biot 1941 and Nur and Byerlee 1971); Kfr by Gassmann from Ku (Vp, Vs, rho), Kgr, Kfluid, phi (Eq. 3, p. 6). Alpha is near 1 in soft sediment and falls as the frame stiffens, so "for soft rocks or very low pore pressures the Terzaghi and Biot approaches will converge" (p. 9). Earlier GoM work (Ebrom et al. 2004) estimated a constant alpha of about 0.88; H&CS let it vary (p. 4).
3. Under Biot, "the Vp-VES trend is seen to be much tighter ... and 'smectitic' and 'illitic' trends become clearly separated" (p. 7, Fig. 3b); the trend "showed no apparent dependence on formation age or average rate of burial" (p. 9). The split is by temperature, 93 degC (200 degF), taken as the smectite-illite boundary; 47 XRD-illitic points all above 93 degC, 664 cooler points assumed smectitic, 280 warmer points without XRD partitioned by behaviour (57 smectitic, 223 illitic) (p. 5).
4. Resistivity gains less from Biot than velocity: resistivity is insensitive to effective stress above 10-15 % porosity, so high-pressure data all sit on the flat part and look like one trend under Terzaghi (p. 8, Fig. 5). "when using a Terzaghi-based calibration the resistivity log actually performs better for pressure estimation than velocity logs for many GoM wells (e.g. Hauser, 2020a). This benefit disappears when using a Biot-based model" (p. 14). This explains the resistivity-over-sonic finding of the salt-sealed paper.
5. Inversion example (pp. 8-9, Fig. 6): 10 calibration wells, 3 target wells, GoM; iteration converges to three significant figures by the second pass; Biot matches throughout where Terzaghi over- and underpredicts in different intervals. Patterns that "look like typical expectations for unloading", like "sand-shale disequilibrium", or like "complex salt-related stresses" are reproduced by the Biot model without those mechanisms (p. 9).
6. Sensitivities (Appendix A, pp. 13-15): a 0.1 % change in Vp, Vs or rho, or in Kgr or rho_gr, shifts the pore pressure estimate most where the frame is stiff (high Vp, low porosity); a 5 kppm (25 %) salinity change is needed to matter (p. 13, Fig. A1). The pressure estimate is up to 3 times as sensitive as the effective-stress estimate for hard rock (p. 14, Fig. A2). Near base salt the GoM Vp-Vs trend departs (citing Bakulin et al. 2008); using the measured Vs the Biot pressure matches the sub-salt section "independent of distance from the salt body" with vertical stress only, suggesting present-day salt stress perturbations are small (pp. 14-15, Fig. A3).
7. Stated caveat: "the impact of unloading, complex stresses, sand-shale pressure disequilibrium, etc. are minimal in this dataset, their potential has not been fully characterized or studied here" (p. 10).

## 4. Equations (checked on page images except Eq. 3)

- Eq. 1 (p. 4): sigma = S - alpha Pp. sigma effective stress, S total stress, Pp pore pressure (MPa), alpha Biot coefficient. alpha = 1 is Terzaghi.
- Eq. 2 (p. 5): alpha = 1 - Kfr / Kgr. Kfr drained frame bulk modulus, Kgr effective grain bulk modulus (GPa).
- Eq. 3 (p. 6): Gassmann, Kfr from Ku, Kgr, Kfluid and phi (same as Hauser 2020b Eq. 15; not legible here). Ku from Vp, Vs, rho; phi = (rho_gr - rho) / (rho_gr - rho_brine). Brine properties from Batzle and Wang 1992 at the pressure sought, so the inversion iterates (p. 8).
- Eq. 4 (p. 7): bVES = c1 + c2 exp(-c3 epsilon) + c4 exp(-c5 epsilon). bVES Biot vertical effective stress (MPa), epsilon void ratio from Vp through the regional Vp-rho trend. Constants in Table 2.
- lambda* = (Pp - Phyd) / (Sv - Phyd), overpressure ratio (p. 7; same definition as Hauser 2020b Fig. 3).

## 5. Numbers

| Value | Setting | Page |
|---|---|---|
| 991 sand pressure points, 148 wells, 3 regions | data set | 5, Table 1 |
| GoM 105 wells / 881 points (265 above 93 degC); Egypt 17 / 40 (22); S. America 26 / 70 (39) | by region | Table 1 (p. 16) |
| 556 | GoM shales with resistivity | 5 |
| 376; 529 | GoM shales with wireline Vs; with density logs | 6 |
| < 8 % | points with well inclination above 30 degrees | 5 |
| 93 degC (200 degF) | temperature split, smectitic / illitic; also the Arps normalisation temperature | 5, 6 |
| 47 / 664 / 280 (57 + 223) | XRD-illitic / cool assumed smectitic / warm without XRD (split by behaviour) | 5 |
| 20,000 ppm | salinity that minimised bin scatter for both populations | 6 |
| 15 m/s | velocity bin width used to normalise sampling density | 6 |
| Smectite: Kgr 27.8 GPa, rho_gr 2.65 g/cc, c1 0.093 MPa, c2 39.3 MPa, c3 3.30, c4 188 MPa, c5 11.8 | Eq. 4 and alpha parameters | Table 2 (p. 17) |
| Illite: Kgr 34.6 GPa, rho_gr 2.70 g/cc, c1 0.087 MPa, c2 26.1 MPa, c3 2.48, c4 104 MPa, c5 8.16 | Eq. 4 and alpha parameters | Table 2 (p. 17) |
| 1.07 g/cc (0.465 psi/ft); 2 degC/100 m (11 degF/1000 ft) | brine density and thermal gradient of the forward model | 7 |
| lambda* = 0.25, 0.5, 0.75, 0.9 (+/- 0.02 selection) | modelled pressure paths | 7 |
| 10-15 % | porosity above which resistivity is insensitive to effective stress | 8 |
| about 0.88 | constant Biot alpha of Ebrom et al. 2004 for the GoM (citing) | 4 |
| 13 wells (10 calibration, 3 target); 2 iterations | inversion example | 8-9 |
| 0.1 %; 5 kppm (25 %) | perturbations in the sensitivity study | 13 |
| up to 3x | pressure sensitivity relative to effective-stress sensitivity, hard rock | 14 |
| 20 % | share of T >= 93 degC data that stay on the smectitic trend | 7 |

## 6. Limits the authors state

- Not peer reviewed (every page).
- Kgr, rho_gr and salinity were not measured; they are constant fitting parameters (p. 6), and "local calibration of these properties may still be required" (p. 9).
- Vs and rho mostly from regional trends, not logs (p. 6); trend departures near base salt can mislead a Biot calculation (pp. 14-15).
- Unloading, complex stress and sand-shale disequilibrium were assumed minimal, not tested (p. 10).
- Illitisation kinetics not modelled; the smectite/illite split is by temperature and behaviour (p. 5).
- The paper's compaction state is a log proxy (Vp, resistivity), not a measured porosity; the Eq. 4 constants are tied to Shell's internal Vp-void-ratio trends, which are not given (p. 7).
- Data not fully releasable (p. 11).

## 7. Relevance to Strata Lab

Bears on `src/engine/compaction.ts` (`porosity(P, lith, s)`, Athy phi = phi0 exp(-beta s') in Terzaghi past-maximum effective stress), `src/engine/params.ts` (`phi0`, `beta`), `src/engine/wellPressure.ts` (`fracturePressurePa`, Terzaghi) and physics-references "M4 well pressures".

- The engine is Terzaghi throughout: effective stress is overburden minus pore pressure in `compaction.ts` (the buoyant-load formulation is the same thing with hydrostatic removed) and in `fracturePressurePa`. H&CS do not say Terzaghi is wrong for a forward compaction model; their claim is about log-based inversion, where a Terzaghi trend calibrated at one lambda* mispredicts at another (p. 8). Strata Lab does not invert logs, so the finding changes nothing in the engine. It is worth one line in physics-references: the effective stress is Terzaghi (alpha = 1), and alpha < 1 (Biot) is "not modelled".
- Where it could matter: the porosity-stress law. Athy in Terzaghi stress with constant beta cannot reproduce the H&CS observation that deep, highly overpressured shale (near-zero Terzaghi VES) is faster and less porous than shallow shale at the same VES (p. 4, citing Ebrom et al. 2004). In the engine that case arises in sealed sub-salt or low net-to-gross columns. The engine would keep such mud at phi0; a Biot law would compact it. This is a known simplification to record, not a defect to fix in this card.
- IOGP 608 (p. 6) defines effective stress as Terzaghi, and Hauser 2020b (p. 4) uses Terzaghi for the stress model; the engine agrees with the practice documents. H&CS is the dissenting view and is a preprint.
- Numbers reusable for a future check: brine 1.07 g/cc and thermal gradient 2 degC/100 m (p. 7), grain density 2.65 g/cc for smectitic mud (Table 2) against the engine's RHO_S 2650 kg/m^3 (`constants.ts`). The Eq. 4 constants cannot be used without Shell's Vp-void-ratio trend.
- Sub-salt: Appendix A's observation that a vertical-stress-only Biot model fits the whole sub-salt section (pp. 14-15) is a second, independent hint (with Hauser 2020b p. 11) that stress perturbation near tabular salt is small; both are GoM only.
- Terminology: lambda* (overpressure ratio) is a one-number summary the M4 plot or the crest log could show; it is defined identically in Hauser 2020b and here.

## 8. Could not confirm

- The year and the final publication venue (none printed).
- Eq. 3 was not rendered; it is taken as the standard Gassmann form by analogy with Hauser 2020b Eq. 15.
- Figures 1-6 and A1-A3 were not rendered; statements about them come from the text and captions.
- The reference list gives Hauser 2020b as "SPE Journal, SPE 204453" (p. 12), consistent with the copy read for the sibling note.
