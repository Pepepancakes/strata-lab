# Alberty and McLean 2014, The use of modeling to enhance the analysis of formation-pressure integrity tests

Deep-read note (LIT-PP-2a). Pages are journal pages 431-437 (SPE Drilling & Completion, December 2014). Claims
taken from others are written "Alberty & McLean (citing X)". Nothing in `src/`, `tests/` or presets was changed.

## 1. Record

- Authors: M. W. Alberty (Hess Corporation), M. R. McLean (consultant).
- Year: 2014 (paper SPE 167945, accepted for the 2014 IADC/SPE Drilling Conference, Fort Worth, 4-6 March 2014;
  journal version December 2014).
- Title: The Use of Modeling To Enhance the Analysis of Formation-Pressure Integrity Tests.
- Journal: SPE Drilling & Completion, December 2014, pp. 431-437.
- Access: full text, John's copy (7 pages read: text, Figs. 1-8, nomenclature, 10 references).

## 2. What it is

An engineering-practice paper about reading the pressure-versus-volume curve of a leak-off or formation-integrity
test (FPIT, the authors' generic name). It models the pre-fracture part of the curve from mud compressibility (backed
out of the casing test before drilling out the shoe), casing and cement expansion, exposed-formation compressibility,
air in the lines, a channel behind casing, and permeability losses, so that the point where the data depart from the
model is the leak-off point (fracture initiation). Field examples with and without channels and permeable beds, and
a test repeated with lost-circulation material. It defines the test vocabulary (LOP, FBP, FPP, ISIP, closure) the
pore-pressure literature uses loosely.

## 3. Equations

Symbols (Nomenclature, p. 437): c*_m apparent mud compressibility (psi^-1); c_a air compressibility; V_sys_cit and
V_sys_fpit system volumes at the casing test and the FPIT (bbl); V_p pumped volume; V_fm formation-expansion volume;
V_a air volume; V_k permeability loss volume; G formation shear modulus; HS hole diameter; L_OH open-hole length;
F_f flow factor (K h / mu); r_e, r_w effective permeability radius and wellbore radius; T time increment; P_w-f
well-minus-formation pressure difference.

| No. | Page | Equation | Meaning |
|---|---|---|---|
| 1 | 432 | c*_m = 1 / (V_sys_cit x dP/dV_p) | Apparent mud compressibility from the slope of the casing-integrity test; it lumps mud, casing and cement compliance. |
| 2 | 432 | dP = (dV_p - dV_fm) / (V_sys_fpit x c*_m) | Expected pre-fracture FPIT slope: the CIT compressibility applied to the larger open-hole system volume, less formation expansion. |
| 3 | 433 | dV_fm = f(dP, G, HS, L_OH) | Elastic expansion of the open hole (shear modulus, hole size, open-hole length); negligible except in soft shallow formations, e.g. half-metre-shoe tests, where the deformation is unlikely to be elastic. |
| 4 | 433 | dP = (dV_p - dV_fm - dV_k) / [(V_sys_fpit - V_a) c*_m + V_a c_a] | Eq. 2 with air in the lines (c_a = 1/P_a, recomputed each step) and permeability losses; the curve becomes nonlinear and is run in small increments. |
| 5 | 433 | dV_k = 0.00708 x dT x F_f x dP_w-f / [1440 x ln(r_e/r_w)] | Radial-flow loss to an exposed permeable bed per time step (field units). |
| 6 | 433 | F_f = K h / mu | Flow factor: permeability x exposed height / viscosity, the single fitting parameter for losses. |

Procedure (p. 433-434): (1) apparent mud compressibility from the casing test; (2) expected mud response at the FPIT
volume; (3) formation-compressibility response; (4) adjust air in lines to fit the early upward curvature; (5) adjust
permeability to fit the downward curvature; (6) iterate air, channel volume and permeability to a best fit. The two
conclusions drawn from the comparison (p. 434): the fracture starts where the data depart from the model, and in
clastic sections any permeability seen implies the measured fracture gradient is in sand, which carries a lower
minimum stress than shale.

## 4. Numbers

| Quantity | Value | Units | Setting | Measured / stated | Page |
|---|---|---|---|---|---|
| Typical compressibility, water-based mud | 1.8 to 2.5 x 10^-6 | psi^-1 | authors' experience | stated | 434 |
| Typical compressibility, synthetic mud | 3.0 to 4.0 x 10^-6 | psi^-1 | authors' experience | stated | 434 |
| Pressure at which trapped air becomes indistinguishable | about 100 | psi | surface lines | stated | 434 |
| Typical trapped-air volume | a few tenths of a barrel | bbl | surface lines | stated | 434 |
| Casing-test pressures | often well over 1,000 | psi | CIT | stated | 432 |
| Example with losses before the test began | 0.06 bbl air, average mobility 5.23 md/cp | bbl, md/cp | field example (Fig. 6) | fitted | 435 |
| Idealised test curve (Fig. 2) | LOP, FBP (peak), FPP, ISIP, closure in sequence | - | schematic | drawn | 431-432 |
| Surface vs downhole decline after shut-in | downhole decline "often not as marked"; some surface drop is mud gelling | - | observed | stated | 431 |

Count recorded: 8 rows. No basin, depth or stress data: the paper is about test mechanics, not regional gradients.

## 5. Definitions worth keeping (p. 431)

- Leak-off point (LOP): where a fracture first starts at the wellbore; "most frequently described as the point at
  which the trend of the pressure increase deviates from linearity" (citing Postler 1997; Addis et al. 1998; van Oort
  & Vargo 2008). Used, with a repeat test, to estimate tensile strength.
- Formation breakdown pressure (FBP): the peak, after which unstable fracture growth runs many metres from the well.
- Fracture propagation pressure (FPP): the stabilised pumping pressure.
- ISIP and fracture-closure pressure: closure "can be the most valuable piece of information from the test used to
  determine the stress state of the formation beyond the influence of the well"; many operators stop before FPP for
  fear the fracture reaches lower-stressed rock.
- Four reasons to test (p. 431): verify the cement at the shoe; measure the stress state for well planning; calibrate
  fracture-gradient prediction and lost-circulation planning; set the maximum equivalent circulating density at the
  shoe.

## 6. Limits the authors state

- Eq. 3 (elastic hole expansion) "may not always be adequate" for soft shallow formations (p. 433).
- Channels behind casing make fits non-unique and can expose shallower formations with a lower fracture gradient
  (p. 434).
- Pump-rate irregularities and surface gauges add friction noise; downhole gauges are better (p. 434).
- The radial-flow loss model is an assumption; the true permeability is uncertain, hence one fitted flow factor
  (p. 433).

## 7. Relevance to Strata Lab

- `src/engine/wellPressure.ts` reports a fracture pressure per cell and the mud-weight window. Alberty & McLean say
  what a measured "fracture gradient" is: the LOP from a test whose pre-fracture slope is itself a model, with the
  closure pressure (not the LOP or the peak) being the minimum stress. The engine's fracture pressure (`k (S - P) + P`,
  lines 93-95) is a minimum-stress estimate and so is comparable to closure, not to the LOT peaks that Zhang & Yin's
  229 points and Traugott's empirical k are fitted to (see `zhang-yin2017.md`: "LOT may not be the breakdown
  pressure"). That ordering (closure <= LOP <= FBP) is the reason published k0 values from LOT peaks run higher than
  nu/(1-nu) from closure data, and belongs in `physics-references.md` under M4 "Fracture pressure: what it is
  compared to".
- Sand versus shale: "any measured fracture gradient is likely to be in sand because sands are generally subject to
  a lower minimum Earth stress than shale" (p. 434). The engine uses one `poissonRatio` for all lithologies
  (`wellPressureParams.ts` line 31); a per-lithology k (Zhang & Yin: 0.43 shale, 0.3 sand) is supported by both
  papers if a later card wants it.
- Mud compressibility (1.8-4.0 x 10^-6 psi^-1) and the ECD vocabulary are not engine quantities; the engine's mud
  weight is static EMW (`physics-references.md` M4 "ECD"). Not adopted.
- Not in Alberty & McLean: pore pressure, overburden, Poisson's ratio, salt, water depth.

The one finding that matters most for M4: the engine's fracture pressure is a minimum-stress (closure) estimate, and
field "fracture gradients" from LOT peaks sit above it by the tensile and near-wellbore terms, so a model-to-LOT
comparison needs the closure pressure or an allowance for that difference.
