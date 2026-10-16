# Physics references and parameter sources

Every engine parameter belongs in this file with its source and published range, or is marked
**tuned**. Each status means:
- **cited:** the value comes from the reference.
- **tuned:** chosen by eye to give a plausible picture. The app must say so next to the control.
- **to verify:** the reference is believed correct but has not been checked against the paper.

Papers themselves go in the git-ignored `References/` folder, never in git.

## Benchmarks (exact or independent solutions)
| Check | Source | Used for |
|---|---|---|
| Excess pore pressure in a layer growing at a constant rate on an impermeable base | Gibson, R.E. (1958). The progress of consolidation in a clay layer increasing in thickness with time. *Géotechnique* 8(4), 171–182. | Consolidation solver (spike 001: max error 0.0001 of overburden at T = 0.1, 1, 10) |
| Porosity–depth curves for drained sand and shale | Sclater, J.G. & Christie, P.A.F. (1980). Continental stretching: an explanation of the post-mid-Cretaceous subsidence of the central North Sea Basin. *JGR* 85(B7), 3711–3739. | Drained compaction (spike 001: within 0.02 at 1–3 km) |
| Viscous channel (Poiseuille/Couette) flow | Standard fluid mechanics (e.g. Turcotte & Schubert, *Geodynamics*, channel-flow chapter) | Salt flux, spike 002 / M3 |
| Infinite-slope factor of safety with pore pressure | Standard soil mechanics | Slope failure, M2 |

## Parameters used in spike 001
| Parameter | Value | Status | Source / note |
|---|---|---|---|
| Surface porosity φ0, sand / mud | 0.49 / 0.63 | cited | Sclater & Christie (1980) |
| Compaction coefficient β (effective stress), sand / mud | 2.68e-8 / 5.2e-8 Pa⁻¹ | cited (converted) | From S&C depth coefficients 0.27 / 0.51 km⁻¹, converted to effective stress so they match at 2 km under hydrostatic pressure. Athy, L.F. (1930), *AAPG Bull.* 14, 1–24, for the exponential form. |
| Permeability log10 k = A + Bφ, sand | A −14.5, B 7 | tuned | Needs a sand source |
| Permeability, mud | A −22, B 8 | tuned | Candidate: Yang, Y. & Aplin, A.C. (2010). A permeability–porosity relationship for mudstones. *Mar. Pet. Geol.* 27, 1692–1697 (clay-fraction dependent). To adopt in M1. |
| Unloading stiffness | 5% of loading compressibility | tuned | |
| Depth-dependent marine diffusion (form) | K = Km·exp(−d/dm) + Kg | cited (form) | Kaufman, P., Grotzinger, J.P. & McCormick, D.S. (1991). Depth-dependent diffusion algorithm for simulation of sedimentation in shallow marine depositional systems. *Kansas Geol. Survey Bull.* 233. |
| Two-lithology diffusion (form) | separate K for sand and mud | cited (form) | Rivenæs, J.C. (1992). Application of a dual-lithology, depth-dependent diffusion equation in stratigraphic simulation. *Basin Research* 4, 133–146. |
| Diffusivities Kc / Km / dm / Kg | see `engine.js` | tuned | Kc 5e4/1e5, Kg 100/1000 m²/yr picked for about 6° muddy slopes and a 0.3 m/km coastal plain |
| Turbidite routing (share, transport lengths) | see `engine.js` | tuned | A transport-length rule, not flow physics |
| Sediment supply | 20 m²/yr (solid) | tuned | Order of magnitude for a large-river margin; needs a source |
| Subsidence | 40–150 m/Myr | tuned | |
| Sea level (default) | Published global curve, spliced | cited | See "Sea-level data" below. The ±40 m sine is kept as a teaching option (`seaLevelKind: 'sine'`, tuned). |

## Sea-level data (M1.4, bundled)
Fetched at dev time by `scripts/fetch-sealevel.mjs`, never at runtime. Both licences were read on
the archive pages and are bundleable (CC0, CC-BY). Accessed 2026-10-14.

**Younger than 3 Ma: Bintanja & van de Wal (2008)**
- Paper: Bintanja, R. & van de Wal, R.S.W. (2008). North American ice-sheet dynamics and the onset of
  100,000-year glacial cycles. *Nature* 454, 869–872. doi:10.1038/nature07158.
- Archive: NOAA NCEI / WDS Paleoclimatology, "Global 3Ma Temperature, Sea Level, and Ice Volume
  Reconstructions", doi:10.25921/revb-da37. Data file:
  https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/bintanja2008/bintanja2008.txt
- Licence: CC0 1.0 (NOAA metadata record, noaa-recon-11933). Please cite the paper.
- Column used: column 9 (time in column 1, kyr BP). **Sign trap:** the file labels column 9 "global
  sea level relative to present", but it is ice volume as sea-level equivalent (+122.8 m at 21 ka).
  Sea level is its negative, which is what is stored (−122.8 m at 21 ka). Its value for age 0 is
  −1.46 m, not 0; kept as published.
- Bundled as `src/engine/data/sealevel-bintanja2008.json`: every 3rd row of the 100 yr series
  (300 yr), because the full series is about 450 KB (limit 200 KB). Rows are original values, not
  averages. File size 144 KB.

**Older than 3 Ma: Miller et al. (2020)**
- Paper: Miller, K.G., Browning, J.V., Schmelz, W.J., Kopp, R.E., Mountain, G.S. & Wright, J.D.
  (2020). Cenozoic sea-level and cryospheric evolution from deep-sea geochemical and continental
  margin records. *Science Advances* 6(20), eaaz1346. doi:10.1126/sciadv.aaz1346.
- Data: PANGAEA, "Smoothed Cenozoic sea-level relative to modern from deep-sea geochemical and
  continental margin records", doi:10.1594/PANGAEA.923139.
- Licence: CC-BY 4.0 (stated on the PANGAEA data set page). Only the PANGAEA data set is bundled;
  the paper's own terms were not checked (Science Advances articles are normally CC-BY-NC, which
  would not be bundleable). Attribution is required.
- Column used: "Sea lev rel [m]" (relative to present), age in ka BP. 3,193 rows, 20 kyr, from
  0.98 to 64.82 Ma; smoothed (about 2 Myr low-pass), so it has no glacial cycles. Quoted
  uncertainty of the method is about ±10 m (Miller et al. 2024).
- Bundled whole as `src/engine/data/sealevel-miller2020.json` (44 KB).
- Not used: Miller et al. (2005) (NOAA NCEI doi:10.25921/kc41-xy86, 0–100 Ma), superseded by the
  2020 curve; Miller et al. (2024) (NOAA study 39499, 0–66 Ma) is a possible later upgrade.
  de Boer et al. (2014) was not needed because Bintanja & van de Wal already gives 3 Myr under CC0.

**Splice (`src/engine/sealevel.ts`).** Bintanja for ages up to 2.8 Ma; Miller from 3.0 Ma; between
them a linear blend over 200 kyr at the old end of the high-resolution record
(`SPLICE_OVERLAP_YR`). At 3 Ma the two differ by 3.3 m (−1.5 vs −4.8 m), so the blend adds no
jump; tests check that the largest change over 100 yr in the window is below 1 m (it is 0.37 m).
Linear interpolation between rows; ages outside a table clamp to its end. The UI name and
citation come from `curveCreditAtAge(age)` and change with age.

## Candidate sources for later milestones
- **Sea level (done in M1.4, see above).** Also considered: Spratt & Lisiecki (2016), *Clim. Past*
  12, 1079–1092 (last 800 kyr only, so too short).
- **Slope failure and run-out (M2).** Hampton, M.A., Lee, H.J. & Locat, J. (1996). Submarine
  landslides. *Rev. Geophys.* 34(1), 33–59.
- **Salt (S2/M3).**
  - Hudec, M.R. & Jackson, M.P.A. (2007). Terra infirma: understanding salt tectonics.
    *Earth-Sci. Rev.* 82, 1–28.
  - Gemmer, L. et al. (2004). Salt tectonics driven by differential sediment loading.
    *Basin Research* 16 (to verify).
  - Ge, H., Jackson, M.P.A. & Vendeville, B.C. (1997). Kinematics and dynamics of salt tectonics
    driven by progradation. *AAPG Bull.* 81(3) (to verify). Expulsion ahead of a wedge, spike 002.
  - Salt density 2,160 kg/m³ (halite; Hudec & Jackson 2007). Used in spike 002.
  - Salt viscosity, roughly 1e17–1e19 Pa·s (to verify). Spike 002 default 1e17 is **tuned** to
    the fast end so that flow shows in 3 Myr.
  - Spike 002 benchmarks: decay of a thickness bump vs linear lubrication theory
    (rate = h³(ρ_salt−ρ_w)g k²/12η); load-step Poiseuille flux vs hand calculation.
- **Fracture gradient (M4).**
  - Eaton, B.A. (1969). Fracture gradient prediction and its application in oilfield operations.
    *JPT* 21(10).
  - Matthews, W.R. & Kelly, J. (1967). How to predict formation pressure and fracture gradient.
    *Oil & Gas J.*

## Long runs and bundled deep compaction (M1.4b)
- **Bundling is a numerical speed-up, not physics.** Layers older than `bundleAgeYr` are consolidated
  once per `bundleEvery` steps (backward Euler, the same equation as every step) with the time since
  their last update. Between full solves the young window is solved with a no-flow base. Error is
  first order in `bundleEvery x step`. Parameters `bundleEvery` and `bundleAgeYr` are **tuned**.
- **Measured against the unbundled solve, same deposition (no transport),** three columns, 12 Myr at
  5 kyr, solid rates 30/60/120 m/Myr (surface 0.8/1.4/2.5 km): every 10 steps, 100 kyr window: H within
  1.5 m, porosity within 0.0009 (100 m depth bins), max excess pressure within 0.4 %.
  Error scales with `bundleEvery` (every 5: 0.7 m; every 20: 3.1 m) and hardly with the window size.
  At 3-4x those rates (surface 2-6 km) the same setting gives 10 m, i.e. 0.2 % of the thickness.
- **Long schedules.** On the Miocene schedule (every 10) the same test gives 0.25 % of H and 0.0033
  porosity; on the Cenozoic schedule (every 20) 0.8 % and 0.011. These are coarse steps, so the lag is
  `bundleEvery x 50-100 kyr`; the targets of the card apply to the 5 kyr runs.
- **Coupled runs are chaotic.** On the 12 Myr default run a 1e-7 relative change in supply gives dH
  4.2 m, dPhi 0.0067, dU 0.74 %; bundling every 10 gives 5.8 m, 0.0079, 0.81 %. Same size, so the
  coupled comparison cannot resolve the bundling error. The strict comparison uses prescribed deposition.
- **Preset values are tuned.** Supply 20 m^2/yr and subsidence 40-150 m/Myr are the default
  scenario's; no published Gulf of Mexico rate was checked. Never company data.

## M1.4c burial physics (changing subsidence, temperature, quartz cement)

- Thermal subsidence: rate x exp(-t/tau), tau about 62.8 Myr, McKenzie (1978). Decay law only, not a stretching model. Alternative: user piecewise factors. Default is constant (tuned rates).
- Temperature: steady 1D conduction, T = Tsf + q sum(h/k); bulk k is the geometric mean of grains and water (Woodside & Messmer 1961). Heat flow 40 mW/m2 (Gulf of Mexico slope background, Jones 2003 abstract; to verify). Conductivities (quartz 7.7, water 0.6, Clauser & Huenges 1995) to verify; mud grain k 2.5 is tuned. Limits: steady state only (fast burial is really colder at depth), no advection, no salt effect.
- Quartz cement: r = 1.98e-22 x 10^(0.022 T) mol/cm2/s (Walderhaug 1994), onset 70 C, surface area from grain size and clean-quartz share (both tuned, synthetic). Silica comes from outside the model: own mass-balance line. Cement fills sand pores, freezes the sand framework at the stress when cementation began. No chemical compaction of mud (no simple sourced law was found).
- Temperature and cement are off by default (thermal = 0, cement = 0) so default runs stay bit-identical; update every thermalEvery steps (numerical saving).

## M2.1 Slope stability (infinite slope)

- FS = [c' + (sigma_v' cos^2 beta) tan phi'] / (gamma' z sin beta cos beta), slip surface parallel to the seafloor. gamma' z is the buoyant load of the consolidation solver; sigma_v' = that load minus the excess pore pressure `u` in the record. Form: Hampton, Lee & Locat (1996) and standard soil mechanics; written from memory of those texts, to verify against the paper.
- Parameters: friction angle sand 33 deg, mud 25 deg (typical drained ranges: muds about 20-30, sands about 30-38; to verify). Cohesion 0 for both (normally consolidated marine clay is near 0; to verify). Search depth 300 m is a set-up choice (tuned).
- Limits: drained strength only, no earthquake or undrained term, slope resolved only at column spacing, mixed cells average tan(phi') and c' by solid fraction. Benchmarks: tests/stability.test.ts (hand calculations to 1e-9).

## M2.2 Slope failure and debris-flow run-out

- Trigger: after each record step, every column with a factor of safety below 1 (M2.1) fails. The weakest column and its contiguous unstable neighbours (at most `failMaxCells`) fail together; the scar is then checked again, up to `failMaxIters` times per step. Left over: counted in the diagnostics and retried at the next step. Off by default (`failOn` = 0) so the default run stays bit-identical to M1.
- Released: everything above the slip surface, cut by solid volume (sand and mud in the same proportion in the half cell the surface passes through). Salt is not moved. Quartz cement in the released cells is dropped with the debris and has its own mass line.
- Run-out: a depth-averaged Bingham flow (Imran, Parker, Locat & Lee 2001; written from the paper's model description, to verify). Stress above the yield strength tau_y shears at mu; below it the layer is a rigid plug. For bed stress tau_b and thickness h the mean velocity is U = tau_b h (1 - r)^2 (2 + r) / (6 mu), r = tau_y / tau_b. For steady uniform flow on a slope the plug is tau_y / (rho' g sin theta) thick, with rho' the flow density minus sea water (the flow is under water); a layer thinner than that does not move. The flow is a chain of blocks (four per source column, each carrying its own sand and mud) with momentum, gravity and hydrostatic thrust, and an implicit bed stress, so it stops in finite time. A block slower than 1 mm/s counts as stopped (numerical).
- Limits: no water entrainment or hydroplaning (run-out is a lower bound for mud-rich flows, Hampton et al. 1996), rheology constant in time, the bed is not eroded, one layer.
- Deposit: laid in the layer of the step that failed, tagged MTD. Remoulded mud restarts consolidation at the effective stress that gives `mtdPhiMud`. The load changes at constant excess pore pressure, so the effective stress does not jump.
- Mass: sand and mud released = deposited + exported, per event and per grain size (tests/failure.test.ts, 1e-12). Debris past the basinward edge is exported (ledger line `cumOut`).
- Benchmarks: tests/runout.test.ts (Bingham velocity law against a numerical integral of the shear profile, uniform flow on a constant slope: velocity, bed stress and plug thickness within 1 %, no motion below the plug thickness).
- Parameters: `runYield` 5 kPa, `runViscosity` 1000 Pa s, `runDensity` 1800 kg/m3, `mtdPhiMud` 0.55, `failMaxCells`, `failMaxIters`: all tuned. No value was checked against a paper.

### Failure triggers (M2.3)

- What it does: tags each slope failure with the dominant reason its factor of safety fell, and limits the slip-surface search. Code: `src/engine/triggers.ts`, `src/engine/stability.ts`.
- Rule: infinite-slope FS with cohesion and the cos^2 term dropped is proportional to (1 - ru) / tan(beta), ru = u / load at the critical cell. Over a lookback of 4 steps, ln(FS_then / FS_now) = dSlope + dPress, dSlope = ln(tan beta_now / tan beta_then), dPress = ln((1 - ru_then) / (1 - ru_now)). Tag, first match wins: lowstand (sea-level fall >= `failLowstandDrop`), oversteepening (dSlope > 0 and >= dPress), rapid loading (bulk gain of the source column >= `failRapidRate`), else overpressure. Checked by hand calculation in `tests/triggers.test.ts`.
- The rule is a bookkeeping split of one formula, not a mechanism model, and the tag thresholds are tuned. They change the label only, never the physics.
- Search limits: `failMinDepth` (slip surfaces shallower are ignored: the top cells of a fresh layer are undrained, so on any slope they look unstable) and `failSlopeMin` (columns gentler than this are skipped, a speed cut). Failures on slopes under 0.5 deg are therefore not modelled. Both tuned; 10 m as the thinnest seismically resolved MTD and the 0.5 to 1 deg slopes of real MTDs are to verify (Hampton et al. 1996).
- Cost: failure on adds about 9 % (3 Myr preset), 38 % (Miocene) and 45 % (Cenozoic) to the run time (M2.3 measurement, one machine, min of 3 runs). The card's budget was 15 %, so it is not met for the two long presets.

### M2 parameter summary (M2.5)
Status of every M2 registry key, as shown next to the control. "to verify" means the source is believed right but the value was not checked against the paper. None of them is a measured Gulf of America value.

| Key | Default | Status | Source or reason |
|---|---|---|---|
| `phiFric` | 33 deg sand, 25 deg mud | to verify | Hampton, Lee & Locat (1996); typical drained ranges quoted from general knowledge |
| `cohesion` | 0, 0 | to verify | Hampton et al. (1996); normally consolidated marine clay is near 0 |
| `stabMaxDepth` | 300 m | tuned | set-up choice: how deep the FS search goes |
| `failOn` | 0 (off) | tuned | on/off switch; off keeps the run identical to M1 |
| `failMaxCells`, `failMaxIters` | 10, 5 | tuned | caps on sideways spread and on rechecks per step |
| `runYield`, `runViscosity` | 5 kPa, 1000 Pa s | tuned | Bingham terms of Imran et al. (2001), to verify; no value checked against a paper |
| `runDensity` | 1800 kg/m3 | tuned | water plus solids while moving |
| `mtdPhiMud` | 0.55 | tuned | mud porosity in a fresh deposit before it re-consolidates |
| `failMinDepth`, `failSlopeMin` | 10 m, 0.5 deg | tuned | stated search limits (see M2.3); thin-slide and gentle-slope values to verify (Hampton et al. 1996) |
| `failLowstandDrop`, `failRapidRate` | 20 m, 0.001 m/yr | tuned | thresholds for the trigger tag only; they never change the physics (M2.7: 20 m, was 5 m) |
| `failSlopeTerm`, `failPressTerm` | 0.1, 0.1 | tuned | M2.7: scale of the slope and pressure terms in the trigger tag (the largest term divided by its threshold wins); tag only |
| `failStallRunout` | 500 m | tuned | M2.7: a failure running out less than this is not repeated on the same columns in one step |

Method list: infinite-slope FS (Hampton et al. 1996 and soil mechanics), Bingham depth-averaged run-out (Imran et al. 2001), FS-drop attribution for the trigger tag (our own bookkeeping split, no citation). Benchmarks: `tests/stability.test.ts`, `tests/runout.test.ts`, `tests/failure.test.ts`, `tests/triggers.test.ts`.

## M3.1 Salt flow (thin-sheet viscous flow)
Source code: `src/engine/salt.ts`; tests: `tests/salt.test.ts`. Ported from spike 002. Off by default (`saltOn` = 0).

Salt is one layer (record layer 0, every cell tagged salt, thickness stored in `mud`) on the basement,
under an older cover (layer 1). It flows sideways as a thin viscous sheet between two no-slip surfaces
(Poiseuille channel flow; Turcotte & Schubert, *Geodynamics*): flux q = -(h^3 / 12 eta) dPhi/dx, with
Phi = W + rho_w g (water depth) + rho_salt g z_roof, W the weight of the sediment above the salt, and
dh/dt = -dq/dx. Columns do not move sideways; they ride on the salt (D10). Salt density 2,160 kg/m3
(Hudec & Jackson 2007).

| Quantity | Value | Status | Note |
|---|---|---|---|
| `saltOn` | 0 (off) | tuned | switch; off keeps every earlier run bit-identical |
| `saltThick` | 1500 m | tuned | start thickness basinward of the pinch-out; synthetic |
| `saltPinchStart`, `saltPinchEnd` | 25 km, 45 km | tuned | smooth pinch-out of the start thickness |
| `saltVisc` | 1e17 Pa s | tuned | published range about 1e17 to 1e19 (Hudec & Jackson 2007, not checked); default is the fast end so flow shows within 3 Myr |
| `nSaltSub` | 5 | tuned | numerical |
| `coverUneven`, `coverSeed` | 0, 1 | tuned | optional seeded unevenness of the older cover |
| `coverThick` | 200 m | tuned | thickness of the older cover over the salt at the start; 200 m is the salt-off substrate (M3.4) |

Numerics: flux form (salt volume conserved to rounding), upstream face mobility, water-load response
implicit (tridiagonal solve per substep), first order in time. Benchmarks (`tests/salt.test.ts`): decay of a
small thickness bump against linear thin-sheet theory (within 1 % for wavelengths 25 to 200 km and eta 1e17
and 1e18; the 25 km case is the worst at -0.57 %, from the first-order time step), and the flux under a
load step against a hand calculation (-0.02 %). Salt, sand and mud balance separately.

Cover bending (M3.2). `salt.ts` header has the derivation. The cover above the salt is one thin viscous
plate, D = eta_c h_c^3 / 3 (the elastic D = E h^3 / (12 (1 - nu^2)) with E -> 3 eta, nu -> 1/2;
Turcotte & Schubert, *Geodynamics*, plate flexure), adding the pressure d2/dx2(D d2(dh/dt)/dx2) to the
roof. Linear theory for a level seafloor and a dense cover: sigma(k) = drho g h^3 k^2 / (12 eta_s +
(eta_c h_c^3 / 3) h^3 k^6), fastest at lambda* = 2 pi (eta_c h_c^3 h^3 / (18 eta_s))^(1/6); the
dispersion test in `tests/coverBending.test.ts` checks the engine against it. Width of a diapir
here means the power-weighted mean wavelength of the roof relief
(`tests/coverConvergence.test.ts`).
  - Turcotte, D.L. & Schubert, G. (2014). *Geodynamics*, 3rd ed. Cambridge University Press.
  - eta_c, `coverVisc`, default 1e19 Pa s: **tuned** (100 times the salt viscosity); no published
    value for a whole sediment cover is in these references (to verify). It sets the width:
    lambda* scales as eta_c^(1/6).
  - Rejected: elastic flexure of the whole cover (E = 10 GPa, nu 0.25) is stable below 23 km (1 km of
    cover) to 53 km (3 km) and fastest at 31 to 70 km, far wider than minibasins.
  - Not modelled: faulting of the cover; the cover is one plate.

## M3.3 Welds and salt in the burial physics
Source code: `src/engine/salt.ts` (`limitOutflow`), `src/engine/saltIntervals.ts`, `src/engine/thermal.ts`; tests: `tests/welds.test.ts`.
- **Weld limiter (own numerics, no citation).** When a salt substep would leave a cell below 0, each cell's
  outgoing face flux is scaled by min(1, h / out). The same face flux is used on both sides, so salt is
  conserved to rounding and `saltClip` stays 0; the M3.1 clip stays as a last guard. With no negative
  cell the step is untouched. At coarse steps it also acts on thick cells (a step-size guard); at the
  20 kyr benchmark it acts only below 1 m.
- **Weld.** After Hudec & Jackson (2007): where the layers above and below the salt come back together,
  with at most a thin remnant. `weldThick` (10 m, tuned) is the label threshold only. The age of the first
  time a column went from at least `weldThick` to below it is state (`weldAge`).
- **Salt in the load.** Salt weight (2,160 kg/m3, Hudec & Jackson 2007) is in the overburden the views use
  (`columnOverburden`). Compaction of the sediment BELOW salt does not count it yet (not needed without canopies).
  Salt has no porosity and no pore fluid.
- **Salt temperature.** Exact steady conduction through a salt cell with k(T) = k0 / (0.99 + T (a - b / k0)),
  T in deg C, the form Clauser & Huenges (1995) quote from Sass et al. (1992). `saltK0` = 6.0 W/m/K (halite
  about 5 to 6.5 near the surface), `saltKa` = 0.0030 /K and `saltKb` = 0.0042 W/m/K^2 are **to verify**: a
  and b are the crystalline-rock coefficients as remembered, NOT checked for halite.
  - Clauser, C. & Huenges, E. (1995). Thermal conductivity of rocks and minerals. In: *Rock Physics and
    Phase Relations*, AGU Ref. Shelf 3, 105-126 (to verify; same entry as in the registry).
  - Sass et al. (1992) is named only as the source Clauser & Huenges quote for the form; it was not read
    and is not in the registry (to verify).

## M3.4 Gulf-style preset and salt structure measures
Source code: `src/engine/presets.ts` (`gulf`), `src/engine/saltStructures.ts`; tests: `tests/saltStructures.test.ts`,
`tests/saltSpeed.test.ts`; report script: `scripts/review/m3-gulf.mjs`.
- **Preset values** (all **tuned**, labelled draft, not matched to any field): 66 Ma start, 400 columns of 1 km,
  steps 100 kyr to 23 Ma, 50 kyr to 3 Ma, then 5 kyr; supply 22 m2/yr; `subsShelf` 40 and `subsBasin` 80 m/Myr;
  bundled deep compaction every 20 steps (`bundleAgeYr` 100 kyr); `saltThick` 2,000 m; pinch-out 40 to 120 km;
  `saltVisc` 1e18 Pa s (D17.5: middle of the published range of about 1e17 to 1e19, to verify);
  `coverThick` 1,000 m; `coverUneven` 0.2 (seed 1); `coverVisc` 3e20 Pa s (tuned, explored by eye by M3.4; no reason beyond that is recorded). No published Louann salt thickness has been checked against
  the initial 2,000 m (to verify); real thicknesses range from a few hundred metres to several kilometres.
- **Structure measures** are our own definitions, not citations (stated in the header of `saltStructures.ts`):
  prominence = topographic prominence of the salt-thickness profile; width = full width at half prominence;
  minibasin = a local minimum with prominence at least `minProm` on both sides; weld run = neighbouring welded columns.
  Every count depends on `minProm` (the report uses 300 m).
- **Speed.** A 66 Myr Gulf run went from 20.3 s to 5.0 s by caching the sediment-load sums within a bundled
  cycle. The cache is checked to give bit-identical results to a full sum every step (`tests/saltSpeed.test.ts`;
  the state hash was identical before and after, cenozoic with salt on).

## M3.5 Salt in the views and the checks panel
Source code: `src/worker/checksM3.ts`, `src/views/`. The three M3 rows of the physics-checks panel write their expected
values from the formulas, not from the engine: channel-flow decay h3 (rho_salt - rho_w) g k2 / 12 eta (limit 1 %),
the cover-bending wavelength lambda* = 2 pi (eta_c h_c3 h3 / 18 eta_s)^(1/6) (limit 5 %), and salt-only mass balance (limit 1e-12).
On the Gulf preset the panel read 0.00181, 0.0214 and 2.48e-16. The salt-thickness colour scale (0 to 16,404 ft) is a fixed display
choice (tuned), not physics.

## M3 parameter summary (M3.6)
Status of every M3 registry key as shown next to the control; the index at the end of this file is checked by `tests/docs.test.ts`.
| Key | Default | Status | Source |
|---|---|---|---|
| `saltOn` | 0 | tuned | switch |
| `saltThick` | 1,500 m | tuned | synthetic; not checked against a published thickness |
| `saltPinchStart`, `saltPinchEnd` | 25 km, 45 km | tuned | set-up |
| `saltVisc` | 1e17 Pa s | tuned (range cited) | Hudec & Jackson (2007) range about 1e17 to 1e19, not checked against the paper |
| `nSaltSub` | 5 | tuned | numerical |
| `coverUneven`, `coverSeed` | 0, 1 | tuned | set-up; seeded through `rng.ts` |
| `coverThick` | 200 m | tuned | 200 m is the salt-off substrate; the Gulf preset uses 1,000 m |
| `coverBend` | 1 | tuned (switch) | plate theory, Turcotte & Schubert (2014) |
| `coverVisc` | 1e19 Pa s | tuned | plate form cited; no published value for a whole cover (to verify) |
| `weldThick` | 10 m | tuned | label threshold; weld definition Hudec & Jackson (2007) |
| `saltK0`, `saltKa`, `saltKb` | 6.0, 0.0030, 0.0042 | to verify | Clauser & Huenges (1995) |

Correction to a registry note: the `coverVisc` note says 1e19 Pa s gives a preferred spacing of "about 8 km" under 1 km of cover over
1.5 km of salt. The formula above and the dispersion test give lambda* = 10.24 km for those numbers (the measured roof wavelength
is 9.9 to 10.1 km, below). The note in `src/engine/params.ts` was not changed by M3.6 (docs only) and should be.

## M3 benchmarks and results (M3.6)
These are the numbers the roadmap quotes; the tests state the bands.
- Channel-flow decay of a thickness bump against linear thin-sheet theory: within 1 % for 25 to 200 km wavelengths and eta of 1e17 and 1e18
  (worst case 25 km, -0.57 %). Load-step flux against the hand calculation: -0.02 %. Salt volume conserved to rounding
  (the Gulf run: 3e-14 relative over 66 Myr; the sandbox runs under 1e-12). `tests/salt.test.ts`.
- Cover bending: the fastest-growing wavelength of the engine against lambda* (`tests/coverBending.test.ts`; the checks panel row, 5 %).
- Grid convergence (`tests/coverConvergence.test.ts`, mean of 3 seeded roofs, level seafloor, 1.5 km salt under 1 km of cover, power-weighted mean
  wavelength of the roof relief):

| Grid cell | bending on, eta_c 1e19 | bending on, eta_c 1e20 | bending off |
|---|---|---|---|
| 1,000 m | 9.92 km (9.9 cells) | 14.81 km | 2.47 km (2.5 cells) |
| 500 m | 10.12 km (20.2 cells) | 14.98 km | 1.34 km (2.7 cells) |
| 250 m | 9.97 km (39.9 cells) | 14.64 km | 0.77 km (3.1 cells) |

  Analytic lambda* is 10.24 km at 1e19 and 15.03 km at 1e20. With bending the width agrees within 10 % across the three grids and
  sits near lambda* (within about 3 %); without bending it follows the grid (2 to 3 cells). A tenfold stiffer cover
  gives about 1.47 times the wavelength (the 1/6 power). The bands hold under 1 ulp noise (`withUlpNoise`).
- Not a test: the finite-amplitude needle grown from a strong thin spot in the full engine is one to five cells wide, and
  its width changed from 1.76 km to 2.32 km at 250 m cells under 1 ulp noise. It is reported (`STRATA_SLOW=1`), not asserted (D16.4).
- Gulf-style preset at the end of the run (Node 26, Windows, `scripts/review/m3-gulf.mjs`, `minProm` 300 m): 11 minibasins
  (6 to 15 km wide, one 46 km; spacing 15 to 33 km, one 80 km), 11 salt highs (4 to 46 km), cover over the highs 4.6 to 7.8 km,
  so none reaches the seafloor; no welds. The M3.4 handoff did not report the grid check at 1,000 and 500 m, the spread under ulp noise or the thickness table every 10 km that its card asked for; none of them is claimed here (open, for M3.7).

Not in the model: faulting of the cover; salt that flows over the seafloor; dissolution; sideways motion of columns.

## M3.8 Gulf-style preset retuned against the D18 targets
Source code: `src/engine/presets.ts` (`gulf`, `saltshort`), `saltWavelength` in `src/engine/saltStructures.ts`;
tests: `tests/gulfPreset.test.ts`; sweep script: `scripts/review/m3-sweep.mjs` (`ULP=` reruns under 1 ulp noise, `DUMP=` writes profiles).
- **Targets (D18), written before the sweep:** weld runs of 2 km or more; at least two salt crests within 2 km of the seafloor and 20 km or more from the basinward edge; a wedge that keeps prograding; salt conserved.
- **Result.** Weld runs of 2 km or more and four buried crests (3,600 to 6,100 ft below the seafloor) were reached; salt is conserved to about 1e-14 with nothing clipped. A crest *at* the seafloor was not reached. The weld positions and counts are not stable under 1 ulp noise (3, 2, 1, 3 runs in four tries), so the tests only ask for one or more. All values are **tuned**. `weldThick` is 100 m for this preset, a tuned label: thin-sheet flow slows as h^3 and never reaches 10 m in 66 Myr; Wagner & Jackson (2011, abstract only, to verify) report up to about 50 m of salt left in an incomplete weld under a broad prograding wedge.
- **What moved the result** (sweeps of supply, subsidence, salt thickness, pinch-out, cover thickness and viscosity, `tcMax`): a starved deep basin (`tcMax` 0.1) keeps the crests shallow; a thin, uneven cover (300 m, 50 %) lets the salt move; supply 28 m2/yr with subsidence 90 and 80 m/Myr keeps the wedge prograding while loading the ramp enough to weld.
- **Correction to M3.2.** The preferred diapir spacing under 1 km of cover over 1.5 km of salt at cover viscosity 1e19 is about 10.2 km, not the 8 km written in M3.2 (re-measured here).
- **Wavelength measure.** `saltWavelength` is the power-weighted mean wavelength of the Hann-tapered, de-trended spectrum of the salt thickness in a window. It is checked against a sine of known period. It is used instead of the strongest spectral line because that line jumps between neighbouring lines.
- **Grid check.** The record holds 400 columns at most, so dx 500 m covers 200 km; the tests compare dx 1,000 and 500 m on the same 200 km section (wavelengths agree within 15 %).
- **References added:** Wagner & Jackson (2011), Pilcher et al. (2011) (abstract read; gives no minibasin width, so none is used). Both **to verify**.
- **Short preset.** `saltshort` (10 Myr, 150 columns, supply 50 m2/yr, salt 1,000 m at 1e17 Pa s, cover 100 m at 1e18 Pa s, 50 % uneven) makes about 13 small diapirs and minibasins in under a second. A toy; all tuned.

## Set-up parameters and what the registry adds (M1.8)
These are numerical or set-up choices, not measured quantities, so they are all **tuned** and the
app labels them so: columns (`nx`, default 150), column width (`dx`, 1 km), run length
(`duration`, up to 66 Myr, D12), record step (`dtRec`, 5 kyr) and transport substeps (`nSub`, 5).
Others the registry carries that the sections above do not describe one by one:
- `sandFrac` (sand share of supply, 0.35), `slAmp` (40 m), `slPeriod` (100 kyr) and `slShift`
  (sea-level offset, 0): tuned. The sine is a teaching option only.
- `sBreak`, `tcMax`, `tcLambda`, `tcL0`, `tcSref`, `tcN`: the turbidite transport-length rule,
  tuned. It is a rule, not flow physics.
- `kMudMult` (mud permeability multiplier) and `elastic` (unloading stiffness): tuned.
- `linear`: the switch for the Gibson benchmark. Never set in the app.
- `subsMode`, `subsTau`, `subsHistory`: M1.4c, see the burial section above.
- `heatFlow`, `kGrain`, `kWater`, `tSeaDeep`, `tSeaShallow`, `tSeaScale`, `thermalEvery`,
  `thermal`: temperature, see the burial section above. `tSeaDeep` (4 deg C) is to verify.
- `cement`, `cemA`, `cemB`, `cemTonset`, `cemGrain`, `cemSurf`: quartz cement, see above.

Ranges the controls allow are guard rails (`min` and `max` in `params.ts`), not published limits.
Where a source gives a range, it is quoted in the section for that parameter.

<!-- registry-index:start -->
### Registry index
Generated from `src/engine/references.ts` and `src/engine/params.ts` and checked by
`tests/docs.test.ts`. Rewrite with `STRATA_WRITE_DOCS=1 npm run test:run -- docs`.

References (26):
- `gibson-1958`: Gibson (1958)
- `sclater-christie-1980`: Sclater & Christie (1980)
- `athy-1930`: Athy (1930)
- `turcotte-schubert`: Turcotte & Schubert, Geodynamics
- `kaufman-1991`: Kaufman et al. (1991)
- `rivenaes-1992`: Rivenaes (1992)
- `yang-aplin-2010`: Yang & Aplin (2010)
- `mckenzie-1978`: McKenzie (1978)
- `walderhaug-1994`: Walderhaug (1994)
- `walderhaug-1996`: Walderhaug (1996)
- `jones-2003-gom-heatflow`: Jones (2003) (to verify)
- `woodside-messmer-1961`: Woodside & Messmer (1961) (to verify)
- `clauser-huenges-1995`: Clauser & Huenges (1995) (to verify)
- `miller-2005`: Miller et al. (2005)
- `bintanja-van-de-wal-2008`: Bintanja & van de Wal (2008) (data: src/engine/data/sealevel-bintanja2008.json)
- `miller-2020`: Miller et al. (2020) (data: src/engine/data/sealevel-miller2020.json)
- `spratt-lisiecki-2016`: Spratt & Lisiecki (2016)
- `hampton-1996`: Hampton et al. (1996)
- `imran-2001`: Imran et al. (2001) (to verify)
- `hudec-jackson-2007`: Hudec & Jackson (2007)
- `gemmer-2004`: Gemmer et al. (2004) (to verify)
- `ge-1997`: Ge et al. (1997) (to verify)
- `eaton-1969`: Eaton (1969)
- `matthews-kelly-1967`: Matthews & Kelly (1967)
- `wagner-jackson-2011`: Wagner & Jackson (2011) (to verify)
- `pilcher-2011`: Pilcher et al. (2011) (to verify)

Parameters (81), as `key`: status, reference id:
- `nx`: tuned
- `dx`: tuned
- `duration`: tuned
- `dtRec`: tuned
- `nSub`: tuned
- `supply`: tuned
- `sandFrac`: tuned
- `seaLevelKind`: cited, bintanja-van-de-wal-2008
- `slAmp`: tuned
- `slPeriod`: tuned
- `slShift`: tuned
- `subsShelf`: tuned
- `subsBasin`: tuned
- `Kc`: tuned, rivenaes-1992
- `Km`: tuned, kaufman-1991
- `dm`: tuned, kaufman-1991
- `Kg`: tuned, kaufman-1991
- `tcMax`: tuned
- `tcLambda`: tuned
- `sBreak`: tuned
- `tcL0`: tuned
- `tcSref`: tuned
- `tcN`: tuned
- `phi0`: cited, sclater-christie-1980
- `beta`: cited, sclater-christie-1980
- `kA`: tuned, yang-aplin-2010
- `kB`: tuned, yang-aplin-2010
- `kMudMult`: tuned
- `elastic`: tuned
- `linear`: tuned
- `bundleEvery`: tuned
- `bundleAgeYr`: tuned
- `subsMode`: cited, mckenzie-1978
- `subsTau`: cited, mckenzie-1978
- `subsHistory`: tuned
- `thermal`: tuned
- `thermalEvery`: tuned
- `heatFlow`: cited, jones-2003-gom-heatflow
- `kGrain`: to-verify, clauser-huenges-1995
- `kWater`: to-verify, woodside-messmer-1961
- `tSeaDeep`: to-verify
- `tSeaShallow`: tuned
- `tSeaScale`: tuned
- `cement`: tuned
- `cemA`: cited, walderhaug-1994
- `cemB`: cited, walderhaug-1994
- `cemTonset`: cited, walderhaug-1996
- `cemGrain`: tuned
- `cemSurf`: tuned, walderhaug-1996
- `phiFric`: to-verify, hampton-1996
- `cohesion`: to-verify, hampton-1996
- `stabMaxDepth`: tuned
- `failOn`: tuned
- `failMaxCells`: tuned
- `failMaxIters`: tuned
- `runYield`: tuned, imran-2001
- `runViscosity`: tuned, imran-2001
- `runDensity`: tuned
- `mtdPhiMud`: tuned
- `failMinDepth`: tuned
- `failSlopeMin`: tuned
- `failLowstandDrop`: tuned
- `failRapidRate`: tuned
- `failSlopeTerm`: tuned
- `failPressTerm`: tuned
- `failStallRunout`: tuned
- `saltOn`: tuned
- `saltThick`: tuned
- `saltPinchStart`: tuned
- `saltPinchEnd`: tuned
- `saltVisc`: tuned, hudec-jackson-2007
- `nSaltSub`: tuned
- `coverUneven`: tuned
- `coverSeed`: tuned
- `coverThick`: tuned
- `coverBend`: tuned, turcotte-schubert
- `coverVisc`: tuned, turcotte-schubert
- `weldThick`: tuned, hudec-jackson-2007
- `saltK0`: to-verify, clauser-huenges-1995
- `saltKa`: to-verify, clauser-huenges-1995
- `saltKb`: to-verify, clauser-huenges-1995
<!-- registry-index:end -->
