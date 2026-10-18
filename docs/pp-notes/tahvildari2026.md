# Tahvildari, Shojaei and Masihi 2026, A physics-informed hybrid ML framework for pore pressure and fracture gradient prediction in carbonate reservoirs

Short note (LIT-PP-2a): low relevance, read to confirm it. Pages are "pdf p. N" of the unedited article-in-press
copy, which carries no page numbers and whose equations [1]-[4] are partly lost in the text layer (page 8 was
rendered to read them). Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Authors: Seyed Pouyan Tahvildari, Soroush Shojaei, Mohsen Masihi (University of Tehran; Sharif University of
  Technology).
- Year: 2026 (received 18 October 2025, accepted 23 February 2026; article in press, unedited).
- Title: A physics-informed hybrid ML framework for pore pressure and fracture gradient prediction in carbonate
  reservoirs.
- Journal: Scientific Reports, DOI 10.1038/s41598-026-41773-z.
- Access: full text, John's copy (20 pdf pages).

## 2. What it is

A machine-learning calibration paper. The classical pore-pressure methods (Eaton sonic and resistivity, Miller,
d-exponent) and Zhang's fracture-gradient correlation are run on logs from six wells in an Iranian offshore
carbonate gas field, calibrated to sparse MDT/XPT pressure points by an "adaptive calibration layer", and fed as
features to a gradient-boosted model with an uncertainty module. Well-wise cross-validation. The physics content is
the restated classical equations; the contribution is the calibration workflow and its error statistics.

## 3. Equations (as restated; none new)

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | pdf 5 | P_p = sigma_v - (sigma_v - P_hyd) f(x) | Generic form: pore pressure as a deviation from normal compaction, f of sonic, resistivity or d-exponent. |
| 2 | pdf 8 | P_p = sigma_v - (sigma_v - P_n) (delta t_n / delta t)^x | Eaton sonic form, x "typically 3.0 for sonic logs"; psi, microseconds/ft. |
| 3 | pdf 8 | P_p = sigma_v - (sigma_v - P_n) (R / R_n)^y | Miller/Eaton resistivity form. |
| 4 | pdf 8 | FG = sigma_v - alpha (sigma_v - P_p) k + tensile-strength term | "Zhang's correlation", with Biot's coefficient alpha and a lithology-dependent constant k; the exact form is garbled in the text layer and the rendered page shows the same partial symbols. Not transcribable with confidence from this copy. |

## 4. Numbers

| Quantity | Value | Units | Setting | Page |
|---|---|---|---|---|
| Wells | six, Iranian offshore carbonate gas field; one (B-08) blind with no MDT/XPT | - | field | pdf 2, 8 |
| MDT/XPT coverage | A-08 2850-3250 m, 33 valid points; C-08 2980-3440 m, 26; D-05 2890-3260 m, 26 | m TVD | Table 2 | pdf 8 |
| Classical methods after calibration | R^2 0.85-0.90, RMSE 0.7-1.1 MPa | - | cross-well | pdf 2 |
| Hybrid model | R^2 0.94, RMSE 0.45 MPa, MAE 0.32 MPa (about 60 % error reduction) | MPa | cross-well | pdf 2, 15 |
| Uncertainty bounds | 95 % bounds typically within +/- 0.4 MPa | MPa | - | pdf 2 |
| Adaptive calibration, Well C | RMSE 1.02 MPa without, 0.56 MPa with (45 % better); largest gains in stylolitic and vuggy intervals | MPa | Well C | pdf 17 |
| Eaton exponent | 3.0 (sonic), cited as typical | - | - | pdf 8 |

Count recorded: 7 rows. No overburden densities, no stress ratios, no LOT values are tabulated.

## 5. Limits the authors state

Results depend on log quality (washouts, gaps); carbonates with vuggy porosity and stylolites break the clean
exponential compaction relationship; future work is pre-drill prediction from seismic and cross-field validation
(pdf p. 17, 19).

## 6. Relevance to Strata Lab

- Low. Strata Lab models clastic (and salt) compaction with a deterministic exponential law; this paper's subject is
  calibrating empirical log-based predictors in carbonates, where the authors themselves say compaction trends do
  not hold (pdf p. 3, Table 1). No equation, parameter or dataset here bears on `wellPressure.ts`,
  `compaction.ts` or the engine parameters.
- Two things worth keeping: (1) a published statement that Eaton's sonic exponent is "typically 3.0", agreeing with
  Traugott 1997 (see `traugott1997.md`); (2) MDT/XPT direct measurements are the ground truth pore-pressure
  predictors are calibrated to, with the accuracy scale (RMSE about 0.5-1 MPa at 3 km) that a calibrated predictor
  reaches in practice. That is the realistic tolerance for any future "compare model to measured pressure" claim.
- Not in Tahvildari et al.: salt, deep water, overburden construction, stress ratio with depth.

The one finding that matters most for M4: nothing to adopt; the paper confirms the Eaton exponent of 3 and gives a
field-calibrated accuracy scale (about 0.5-1 MPa RMSE) for pore-pressure prediction against MDT points.
