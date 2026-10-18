# IOGP Report 608 (2022), Recommended practice for pore pressure and fracture gradient analysis

Deep-read note (LIT-PP-2b, D27.4). Written to be checked against the report: every number carries a page.
Page numbers are the printed page numbers; in this pdf the printed and pdf page numbers agree (printed p. 5 is pdf page 5).
Claims the report takes from other authors are written "IOGP (citing Y)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Author: International Association of Oil & Gas Producers, Wells Expert Committee, Pore Pressure Fracture Gradient Task Force (p. 2). No individual authors are named.
- Year: July 2022, Version 1.0, first release (p. 3).
- Title: Recommended practice for pore pressure and fracture gradient analysis for well design: construction, intervention, and abandonment.
- Series: IOGP Report 608. 41 numbered pages plus cover and back matter. No DOI is printed.
- Licence: "Permission is given to reproduce this report in whole or in part provided (i) that the copyright of IOGP and (ii) the sources are acknowledged" (p. 2). Short quotes here are within that permission.
- Access: full text, John's copy (all 41 pages read, including the references on p. 41). Figures 1 to 7 are pictures; only Figure 7's axis labels survive in the text layer and the figures were not rendered for this note.
- Scope: "the document does not cover any activity related to wellbore stability" (p. 2). It is a practice document, not a methods paper: it contains no numbered equations and almost no numbers.

## 2. What it is

Industry guidance on preparing a pre-drill pore pressure / fracture gradient (PPFG) forecast, stating its uncertainty, and monitoring it while drilling. Three parts: terms (section 1, pp. 6-10), pre-drill prediction (section 2, pp. 11-30) and real-time monitoring (section 3, pp. 31-38), then sample plots (Appendix 1, pp. 39-40) and 16 references (p. 41). It names the methods (Eaton, Bowers, Matthews & Kelly, Gardner, Zhang, Zoback) but does not reproduce their equations; it says what a forecast must contain and how it should be calibrated and communicated.

## 3. Key findings

1. Definitions (pp. 6-8). Effective stress "is estimated as the difference between the total applied stress and pore pressure" (p. 6): Terzaghi, no Biot coefficient. Overburden (lithostatic, vertical stress, Sv) "is the total vertical load of the static column of formation water and the overlying sediments, calculated from bulk density" (p. 6): in deep water the water column is part of Sv. Effective stress ratio = (Shmin - P) / (Sv - P) (p. 7), "empirical". Normal pressure is "pressure exerted by a column of brine extending to the surface" (p. 7). Undercompaction (disequilibrium compaction) "is the common mechanism which generates overpressure in most basin settings" (p. 7).
2. Fracture pressure is defined operationally: "the pressure in the wellbore at which partial or significant losses are noted" (p. 7). The report separates leak-off pressure (LOP), formation breakdown (FBP), propagation (FPP), instantaneous shut-in (ISIP), closure (FCP, "generally the best approximation of the minimum in situ stress") and re-opening (FRP) pressures (pp. 7-8, Figure 1, modified from White, Traugott & Swarbrick 2002). A FIT "does not provide minimum principal stress information" (p. 8).
3. Three sources feed a PPFG model: offset wells, seismic interval velocities, basin modelling (p. 12). Basin models "are more likely to accurately represent systems dominated by burial-related overpressure (disequilibrium compaction or primary overpressure)" and "are best used to test the impact of geologic scenarios on the pore pressure profile" (p. 18). This is the slot Strata Lab's M4 occupies.
4. Indirect pore pressure from logs rests on a porosity proxy (sonic, resistivity) against vertical effective stress, in shale only: "For a constant overburden gradient, an increase in pore pressure gradient and corresponding decrease in effective stress will manifest as a decrease in sonic velocity or resistivity" (p. 13, citing Eaton 1975 and Bowers 1995). Seismic velocities are converted the same way but smear ramps (pp. 16-17).
5. Overburden: "Vertical stress is calculated by integrating the density profile from sea level/ground level to planned well TD, which requires a continuous density curve with depth" (p. 19). Preferred source: density logs from offset wells; else velocity to density (Gardner et al. 1974), a double-exponential density-depth fit to offset logs, or literature densities per rock type (pp. 19-20). Near-surface density from piston cores, pilot holes, ODP data or the Miller relation (p. 20, citing Zhang 2011). Under a sloping seabed a deviated well's vertical stress "should consider the real burial depth above each section of well trajectory" (p. 20).
6. Pore pressure: "a single-point pore pressure prediction for a reservoir is not considered sufficient. It can be misleading and even hazardous" (p. 20); a range is required. Two ways to express it: probabilistic (P10-P50-P90) or discrete geological scenarios (pp. 19, 20, 26). Sand pressures are estimated separately from shale pressures, by projecting a known pressure along the fluid gradient or by a centroid argument (p. 21, citing Flemings 2021).
7. Evaporites: "Evaporites are generally impermeable; pore pressure is not relevant because there is not usually any fluid filled pore space in evaporite sequences" (p. 21). Interbeds, inclusions and rafts inside salt "may have unexpectedly high pressures (depending on the geological environment, empirical observations indicate it can be as high as approximately 85% to 95% of vertical stress)" (p. 21). "In salt and anhydrite layers, the fracture gradient is generally equal to or above vertical stress. In front of salt layers, the fracture gradient could also be higher than vertical stress. A tensile strength of 500-800 psi is often considered in the computation of fracture gradient in evaporites" (p. 15, citing Barker and Meeks 2003). Among the risks to evaluate: "Dirty salt layers with minor permeability in the presence of tectonic salt deformations" and inclusions or permeable dolomite inside evaporites (p. 27); "Salt tectonics, diapirism and allochthones rock bodies presence can lead a stress redistribution and changes in initial pressure of surrounding rocks" (p. 23, in the post-production list). A casing shoe set in salt with the next section in carbonate is given as a case where the shoe is not the weakest point of the section (p. 26). The report says nothing quantitative about sub-salt pore pressure; "sub-salt" does not appear as a term.
8. Unloading (pp. 22): rocks "cannot 'uncompact' as vertical effective stress (VES) decreases during overpressure generation", so present VES is below the maximum VES (citing Bowers 1995; Sayers et al. 2001). Three causes: uplift and erosion; a mechanism other than undercompaction acting after compaction (diagenesis, gas cracking); pressure transferred along a carrier bed after compaction. Signature: density stays, velocity falls, so unloaded shale plots as high density and slow velocity (p. 22, citing Bowers 2001); a velocity reversal "will" be created by unloading and "whenever a velocity reversal is observed, unloading mechanisms should be considered" (p. 22). Undercompaction methods "will severely underpredict pore pressure in these geologic settings" (p. 22).
9. Minimum stress and fracture pressure (pp. 25-26). Two ways to get horizontal stress from Sv and P: a poro-elasto-plastic 1D-strain compaction model (citing Zoback 2014) with a long-term strength "expressed in terms of the effective stress ratio" (citing Matthews and Kelly 1967), or a fault-stability model from Sv, P, friction angle and cohesion (p. 25). Shmin is "generally, calibrated to the fracture closure pressure interpreted from pressure integrity tests (LOT, XLOT, minifrac)" (p. 25). Fracture pressure "rarely equals the far-field minimum stress", except in fractured rock where losses start at about Shmin (p. 26). "In general, the fracture gradient is calibrated to the leak-off pressure (LOP)"; where poorly calibrated, "it may be prudent to calibrate the fracture gradient to the lower end of the range" (p. 15). Mud weights without losses give a minimum FG; the ECD below which losses stop is a good FCP indicator (p. 15). Offshore, offset PIT data are extrapolated in depth below mudline, or by the K0 ratio per stratigraphic unit (p. 14).
10. Uncertainty (pp. 26-27). The most likely (or P50) case is used for primary design; contingency covers low and high; worst cases are checked for containment, not used for design (p. 27). Horizontal stress is "generally greater in shale than in sandstone and/or limestone" (p. 25).
11. The forecast is a safety document: it needs independent SME/TA assurance, a documented review, and management of change (pp. 29-30). Post-well reviews are recommended as mandatory for exploration and appraisal wells (pp. 37-38).
12. Real-time (pp. 31-38): alerts by closeness to the margin (green / yellow / red, p. 33); gas (background vs connection gas) as a secondary indicator (pp. 34-35); "Changing the pre-drill, log-derived model parameters is generally not recommended while drilling" when they were calibrated to offsets (p. 37).

## 4. What a pre-drill PPFG forecast must show (checklist, pp. 19 and 28)

Curves "generally" contained (p. 19):
- [ ] Overburden (p. 19)
- [ ] Pore pressure (p. 19), for each formation from surface to TD (p. 20)
- [ ] Fracture pressure and/or minimum stress, per lithology to be drilled (p. 19)
- [ ] Pore pressure and fracture pressure uncertainties (p. 19), as P10-P50-P90 or discrete scenarios (pp. 19, 26)

Recommended in addition (p. 19):
- [ ] Formation names and prognosed tops
- [ ] Anticipated lithology (stratigraphic column)
- [ ] Geological features of concern (faults, fracture zones)
- [ ] Anticipated fluid type and fluid gradient
- [ ] Planned casing points
- [ ] Planned mud weights / modelled ECDs
- [ ] A validity time range, for fields under production or injection

Could also contain, adjusted to the planned well (p. 19):
- [ ] Offset formation pressure measurements, PIT data, drilling events (EMW of kicks and losses)
- [ ] Zones at higher risk of well-control issues, highlighted (p. 19)

Sample plots (Figure 2, p. 28; Figures 5-7, pp. 39-40): depth against pressure gradient in sg referenced to the rotary table (Figure 7 axis: 1.0 to 1.8 sg, 1,200 to 3,400 m TVD RT), with curves labelled LOT/LOT offset wells, Pp, OBG, FCP (Shmin), FG_min, FG_max, and offset LOP and FIT points posted at their depths (p. 40). The fracture range runs "from the minimum horizontal stress to formation breakdown pressure, with an estimated fracture gradient based on average effective stress ratios in between" (p. 28, p. 39), and the range "estimated from the most likely pore pressure" (p. 39). Comments on the curves and offset observations are written on the plot (p. 28).

## 5. Equations

None are numbered. The only relations written out are:
- Effective stress = total stress - pore pressure (p. 6, words only).
- Effective stress ratio = (Shmin - P) / (Sv - P) (p. 7). Symbols: Shmin minimum horizontal stress, Sv vertical stress, P pore pressure, all in pressure units (psi or Pa, p. 6). Dimensionless.
- Overburden = integral of bulk density over depth from sea level or ground level (p. 19, words only).
Eaton (1975), Bowers (1995), Matthews & Kelly (1967), Gardner et al. (1974) and the Miller relation (Zhang 2011) are cited by name without their equations.

## 6. Numbers

| Value | Setting | Page |
|---|---|---|
| 14.69 psi | mean atmospheric pressure at sea level | 6 |
| 500-800 psi | tensile strength "often considered" for fracture gradient in evaporites (citing Barker and Meeks 2003) | 15 |
| 85-95 % of vertical stress | pore pressure that inclusions or rafts enclosed in evaporites can reach ("empirical observations", no source given) | 21 |
| 15.5-15.8 ppg | pore pressure inferred from connection gas in the worked gas example, below about 19,500 ft; the ESD thresholds at which connection gas fell | 35 |
| 12-18 hours | look-ahead of the two daily PPFG meetings when uncertainty is high | 34 |
| 1.0-1.8 sg, 1,200-3,400 m TVD RT | axes of sample plot Figure 7 | 40 |
| P10 / P50 / P90 | the probabilistic form of the uncertainty range; P50 = most likely | 19, 26-27 |

No depth range, basin or well count: the report is not fitted to data.

## 7. Limits the report states

- Does not cover wellbore stability (p. 2).
- Porosity-based (log and seismic) methods "are only valid for shales" (pp. 20, 17); they fail in carbonates (p. 21) and are not meaningful in evaporites (p. 21).
- Undercompaction methods "severely underpredict" where overpressure comes from unloading or diagenesis (p. 22).
- Secondary mechanisms (diagenesis, aquathermal expansion, hydrocarbon generation, lateral transfer, uplift, tectonic stress) "typically have no relationship between porosity and effective stress" (p. 12, citing Swarbrick and Osborne 1998).
- No competency standard for the PPFG SME is given (p. 29).
- "There is no single recommended approach to capturing uncertainty" (p. 19).

## 8. Relevance to Strata Lab

Bears on `src/engine/wellPressure.ts` (`wellPressures`, `fracturePressurePa`, `eatonK`), `src/engine/wellPressureParams.ts` (`fgMethod`, `poissonRatio`, `matthewsKellyKi`, margins) and the M4 plot (D21, D27).

- Overburden. The engine's Sv is the integral of bulk density including the water column (physics-references "M4 well pressures"); IOGP defines Sv the same way (p. 6, p. 19). Same quantity, same units (Pa, shown as psi and ppg). Match.
- Effective stress. IOGP uses Terzaghi, S - P (p. 6); so does `compaction.ts` (`porosity(P, lith, s)` with s the past-maximum effective stress) and `fracturePressurePa` (k (S - P) + P). Match.
- Fracture gradient. The engine's Pf = K (S - P) + P with constant K is exactly IOGP's "effective stress ratio" form, (Shmin - P) / (Sv - P) = K (p. 7); IOGP's sample plots draw an "estimated fracture gradient based on average effective stress ratios" between Shmin and FBP (pp. 28, 39). So the engine's single curve corresponds to IOGP's middle estimate, and IOGP expects a RANGE (Shmin to FBP) around it. Not modelled: the range, hoop stress, tensile strength, calibration to LOT/LOP (pp. 15, 25-26). IOGP also notes K0 varies by stratigraphic unit (p. 14) and horizontal stress is higher in shale than sand (p. 25): the engine's one K per well (physics-references "Stress ratio", Backlog) is a simplification IOGP would flag.
- Salt. Engine: FG = overburden in salt, no pore pressure (D21). IOGP: "fracture gradient is generally equal to or above vertical stress" in salt and anhydrite, with a 500-800 psi tensile term often added (p. 15, citing Barker and Meeks 2003), and pore pressure "not relevant" in evaporites (p. 21). The engine's rule is the lower bound of IOGP's statement; this is the first citable source in the project for the salt rule that physics-references marks "(to verify)". Not modelled: interbeds and inclusions at 85-95 % of Sv (p. 21), "in front of salt" FG above Sv (p. 15).
- Pore pressure. The engine's sediment pore pressure is hydrostatic plus the excess from 1D disequilibrium compaction (`compaction.ts`): IOGP's "primary overpressure", the case where basin models work best (p. 18). Unloading (p. 22) is partly in the engine (the `elastic` factor on unloading in `compaction.ts`), but no secondary mechanism is modelled, and IOGP says those cannot be predicted from porosity (p. 12). Sand pressures by centroid or lateral transfer (p. 21) are not modelled: the engine's sand and mud share one cell.
- The plot (D27, "read like a pre-drill prediction"). Against section 4 above, the M4 plot has overburden, pore pressure, fracture gradient and a mud-weight window; it lacks an uncertainty range, formation tops, lithology column, fluid gradient, casing points, mud weights, and posted offset data. IOGP plots in sg or ppg against TVD below the rotary table (p. 40), which is the engine's EMW datum (RKB).
- Terminology to adopt: Sv, Shmin, FCP, LOP, FBP, VES, "regression" (overpressure decreasing with depth) and "pressure ramp" (increasing), p. 7.

## 9. Could not confirm

- Figures 1 to 7 were not rendered; their content is taken from the captions. The Figure 7 curve names come from the legend text in the text layer (p. 40).
- The 85-95 % figure (p. 21) has no citation in the report.
- Matthews & Kelly is cited as "Oil and Gas Journal 65. 1965. p.92-106" in the reference list (p. 41) but as "Matthews and Kelly, 1967" in the text (p. 25): the report is inconsistent; the engine's registry says 1967. Zoback is "2014" in the text (p. 25) and "Reservoir Geomechanics ... 2008" in the list (p. 41).
