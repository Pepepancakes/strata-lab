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
| Surface porosity φ0, sand / mud | 0.49 / 0.63 | cited | Sclater & Christie (1980). The Gulf-style preset overrides the mud value: 0.40, Hart et al. (1995) p. 46 (AUD-3) |
| Compaction coefficient β (effective stress), sand / mud | 2.68e-8 / 5.2e-8 Pa⁻¹ | cited (converted) | From S&C depth coefficients 0.27 / 0.51 km⁻¹, converted to effective stress so they match at 2 km under hydrostatic pressure. Gulf-style preset: mud 3.68e-8 (Hart et al. 1995 p. 46, 3.68e-2 /MPa). Athy, L.F. (1930), *AAPG Bull.* 14, 1–24, for the exponential form. |
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
  - Salt density 2,160 kg/m³ (halite; **to verify**). No paper read for this project gives 2,160;
    Hudec & Jackson (2007, p. 4) give about 2,200 kg/m³ for impure rock salt. Used in spike 002.
  - Salt viscosity: field-based estimates for natural rock salt generally 1e17 to 1e20 Pa·s, creep-law
    estimates 1e12 to 1e20 Pa·s (Wagner & Jackson 2011, pp. 311-312; earlier versions of this file
    credited a 1e17-1e19 range to Hudec & Jackson 2007, which gives no viscosity). Spike 002 default
    1e17 is **tuned** to the fast end so that flow shows in 3 Myr.
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
- **Coupled presets (AUDIT-1, F-1; `scripts/review/audit-01/bundle.log`, Windows node 26).** The prescribed-deposition
  figures above do not carry over to the coupled presets, because there the pressure is set by the coupled supply
  and the layers differ. Bundled against `bundleEvery = 1`: **Miocene** (every 10) maximum u 11.2 against 8.4 MPa and mean u 0.49 against 0.29 MPa (the audit quotes these
  differences as 25 % and 40 % of the bundled value), mean H 0.8 %; pore pressure at about 10,000 ft below the sea floor 10.02 against 9.36 ppg (column 80) and 10.39
  against 9.63 ppg (column 100). **Gulf-style** (every 20): maximum u 104 against 110 MPa and mean u 11.3 against 10.3 MPa (-6 % and +8 % of the bundled value); pore pressure 9.93 against
  8.95 ppg at column 250 (about 1 ppg), and 12.68 against 12.59 ppg at column 150 (all with the North Sea mud, measured before AUD-3; with the Hart mud, Windows node 26: 15.15 against 14.03 ppg at column 150 and 13.52 against 11.10 ppg at column 250). The pseudo-well and planned-well
  plots print the largest difference per preset (`src/views/well/bundleTable.ts`, generated by
  `scripts/gen-bundle-table.mjs`, over every cell deeper than 5,000 ft below the sea floor, as |u bundled - u full|
  converted to ppg at the cell). Measured: Miocene up to 1.9 ppg (99 % of cells within 1.1), Cenozoic up to 3.5 ppg
  (99 % within 2.2), Gulf-style up to 13.0 ppg (99 % within 7.1) with the North Sea mud and 8.7 ppg (99 % within 7.0) with the Hart mud; the cause of the Gulf maximum was not examined,
  and the salt moves differently in the two runs, so cells beside salt are suspect. On the Gulf preset the salt and the surface also differ between the fast and the full run (up to about 6.6 km of salt thickness and 2.1 km of surface height, Windows node 26), so the difference is not only in deep pressure. Status: bundling is **tuned**; the full solve is the
  reference. Set `bundleEvery = 1` for pressures.
- **Coupled runs are chaotic.** On the 12 Myr default run a 1e-7 relative change in supply gives dH
  4.2 m, dPhi 0.0067, dU 0.74 %; bundling every 10 gives 5.8 m, 0.0079, 0.81 %. Same size, so the
  coupled comparison cannot resolve the bundling error. The strict comparison uses prescribed deposition.
- **Preset values are tuned.** Supply 20 m^2/yr and subsidence 40-150 m/Myr are the default
  scenario's; no published Gulf of Mexico rate was checked. Never company data.

## Fixed constants (src/engine/constants.ts; F-2 and F-6 of the physics audit)
- `G` = 9.81 m/s^2: standard gravity rounded (9.80665). **Cited value, rounded.** Used for every stress and the EMW
  conversion (1 ppg = 119.8264 kg/m^3 at this g).
- `RHO_W` = 1025 kg/m^3 (8.55 ppg): typical open-ocean sea water. **Typical value, to verify** for the Gulf (salinity
  varies; Traugott 1997 uses 8.5 ppg in his conversion, which `src/views/well/audit.ts` uses for the regional trend).
- `RHO_S` = 2650 kg/m^3: quartz grain density. **Cited generic value, to verify** for the real mineral mix (clay
  minerals are 2.6 to 2.8).
- `MU` = 1.0e-3 Pa s: **pore water at 68 F (20 C)**, used when the heat model is OFF (`thermal` = 0), and as the
  reference in k/mu when it is on. Water at 140 to 250 F is two to four times thinner, so the real k/mu is larger and
  the real overpressure lower; sensitivity in the audit (check 5: a kMudMult of 3 stands for a third of the viscosity).
  **Tuned in effect** (the mud permeability is tuned with it). With the heat model off the pressure panel and the well
  window say "68 F (20 C) viscosity"; with it on, "viscosity follows temperature (IAPWS 2008)" (next section).

## Pore-water viscosity follows temperature (AUD-2; F-2 of the physics audit; D26.2)
- **Source:** IAPWS R12-08, *Release on the IAPWS Formulation 2008 for the Viscosity of Ordinary Water Substance*
  (Huber et al. 2009, J. Phys. Chem. Ref. Data 38, 101). **Function:** `waterViscosity(tC)` in `src/engine/viscosity.ts`, a
  Vogel form mu = A exp(B / (T - C)) with A = 2.5647e-5 Pa s, B = 548.24 K, C = 143.85 K, **fitted by us** to eq. 10 of
  the release evaluated along liquid water at 0.1 MPa / saturation from 0 to 200 C (14 temperatures; log-space least
  squares, C scanned). The fit constants are therefore **fitted to a cited source**, not published values.
- **Accuracy:** within 0.8 % of R12-08 over 0 to 200 C (the 14 fit points); the test claims 1 %. The IAPWS values are
  computed in the test by eq. 10 written from the release; that code is first checked against the release's own
  verification values (its Table 4, 298.15 K / 998 kg/m3 gives 889.735 uPa s, 373.15 K / 1000 gives 307.884, 433.15 K /
  1000 gives 217.685) to 1e-6. Spot values: 10 C 1.306, 20 C 1.002 (ISO value 1.0016), 50 C 0.547, 100 C 0.282,
  150 C 0.182, 200 C 0.135 mPa s. Above 200 C it is an extrapolation (not checked; a cell hotter than that is deep in the
  section, where the pore pressure is capped anyway). Below 0 C the 0 C value (1.79 mPa s) is used.
- **Left out (stated, not measured here):** the pressure dependence (R12-08 is a function of density; at 20 C about +1 % (approximate, from memory of the literature, NOT computed here: to verify)
  per 10 MPa, falling to about zero near 50 C), and salinity (sea water at 35 g/kg is about 5 % more viscous than fresh
  water at 20 C; brines and the Gulf's deep salinities more). Both are small next to the factor 3 to 6 that temperature
  changes mu between the sea floor and 150 C. They push the real mu up, so the pressures here are, if anything, a little low.
- **Which temperature, and when:** the cell's `eng.temp`, the temperature at the cell middle from the last thermal update
  (every `thermalEvery` steps and at the last step; steady conduction of the state at that time). A layer deposited
  since the last update is given the sea-floor temperature at its deposit (`step()`), so a cold new layer is neither 0 C nor
  borrowed from below. The temperature is therefore up to `thermalEvery` steps old in the layers buried since.
- **Face average:** the cell's mobility is k/mu(T) = (k / MU) * (MU / mu(T)), implemented as k * (MU / mu(T)) in place of k,
  and the flux between two cells is the existing series (harmonic) sum of half-cell resistances, so it is the harmonic mean
  of k/mu weighted by thickness. Chosen because Darcy flow through two layers in series adds resistances h/(k/mu). A
  "mean temperature" face would be a different number: for cells at 20 and 150 C it differs by more than 5 %
  (tests/viscosity.test.ts).
- **Tests (tests/viscosity.test.ts):** 14 temperatures against the IAPWS values (1 %); a 60-layer column at constant T
  gives bit-identical u to the same solver with mu fixed (k scaled by MU/mu(T)) at 4, 60 and 150 C; a two-cell column
  with 20 C and 150 C solved by hand (2 x 2 system) matches to 1e-9; heat off ignores `eng.temp`.
- **Heat off:** `thermal` = 0 takes the old branch (kk = k): bit-identical, every preset hash unchanged (no preset has the
  heat model on). Saved heat-on runs replay differently, so `ENGINE_VERSION` is 2.

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
(to verify; Hudec & Jackson 2007, p. 4, give about 2,200 kg/m3 for impure rock salt, and no paper read for this project gives 2,160).

| Quantity | Value | Status | Note |
|---|---|---|---|
| `saltOn` | 0 (off) | tuned | switch; off keeps every earlier run bit-identical |
| `saltThick` | 1500 m | tuned | start thickness basinward of the pinch-out; synthetic |
| `saltPinchStart`, `saltPinchEnd` | 25 km, 45 km | tuned | smooth pinch-out of the start thickness |
| `saltVisc` | 1e17 Pa s | tuned | field-based estimates generally 1e17 to 1e20 (Wagner & Jackson 2011, pp. 311-312); default is the fast end so flow shows within 3 Myr |
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
- **Salt in the load.** Salt weight (2,160 kg/m3, to verify; see M3.1) is in the overburden the views use
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
| `saltLimitStart`, `saltLimitEnd` | 2,000 km, 2,500 km (beyond any section) | tuned | basinward end of the salt basin; idea after Hudec et al. (2013), position tuned (M3.10) |
| `saltVisc` | 1e17 Pa s | tuned (range cited) | Wagner & Jackson (2011, pp. 311-312): field-based estimates generally 1e17 to 1e20, creep-law estimates 1e12 to 1e20; Hudec & Jackson (2007), credited here before, gives no viscosity |
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

## M3.10 Basinward edge of the salt basin (Gulf-style preset)
Source code: `initialSaltThickness` in `src/engine/salt.ts`, parameters `saltLimitStart` and `saltLimitEnd` in `src/engine/params.ts`; tests: `tests/saltLimit.test.ts`, `tests/gulfPreset.test.ts`; numbers: `scripts/review/m3-10-edge.mjs`, full tables in `docs/reviews/m3-10-edge-fix.md`.
- **Cause.** In the M3.8/M3.9 preset the salt started 4 km thick from 100 km to the closed basinward edge (400 km). The wedge squeezed it basinward at about 9 m2/yr across the 250 km face, and with no room it piled against the edge: the salt volume beyond 250 km doubled (600 to 1,202 km2), 8 to 9 km thick at the end. The four crests that met the D18 target were ripples of a few hundred metres on that slab (re-review finding 4).
- **Fix.** The salt basin now ends before the section does: full thickness landward of `saltLimitStart` (200 km in the Gulf preset), none basinward of `saltLimitEnd` (240 km), smoothstep between. The defaults (2,000 and 2,500 km) are beyond any section, so all other runs are unchanged. Both are **tuned**. Hudec, Norton, Jackson & Peel (2013, AAPG Bulletin 97, 1683-1710; abstract read, not the paper, **to verify**) report that the limit of normal oceanic crust coincides with a basement ramp near the seaward end of the salt basin and that salt in places flowed seaward onto new oceanic crust, so a basin that ends, with salt spreading past its depositional limit, is the right kind of geometry; the position in km is not in the abstract and the synthetic section is not scaled to the Gulf.
- **Result.** At the end of the run the salt front is at 355 km, no salt lies within 20 km of the edge (0 m; the test limit is 100 m) and the thickest salt beyond 250 km is 5.0 km, 1.25 times the 4 km start (limit in the test: 1.5 times). The edge did not move: salt is conserved to 1e-14, nothing is clipped, and the edge stays closed.
- **Crests, reported not tuned toward.** Crests within 2 km of the seafloor, 20 km or more from the section edge and from the salt basin's edges (more than 100 m of salt): 5 at the plain run (286.5 to 322.5 km, 4,200 to 6,400 ft below the seafloor), 2 to 5 across six noise salts. Four of the five have a relief of 300 to 850 m on a salt slab 4.2 to 4.8 km thick: ripples of the cover seed on a flat slab, not diapirs. The first, at 286.5 km, is the top of the slab itself. So the D18 count is met by its letter and not in spirit; diapirs that stay at the seafloor are for S3 and M3b. The cover seed and supply were not retuned.
- **The 4 km salt thickness** is **tuned** (re-review finding 11). Hudec et al. (2013) describe, in the abstract, salt that thins seaward; no thickness was taken from it or from any other source, and the old preset note's "upper end of Louann Salt estimates" is withdrawn.
- **Welds.** Total weld length (runs of any width, salt thinner than 100 m that was thicker before) was 17 km in the plain run and 14, 18, 14, 15, 20, 12 km under six 1 ulp noise salts; the longest run 4 km plain and 3, 4, 3, 3, 3, 3 km. The longest run in M3.9 moved from 1 to 3 km between noise salts, so the test now asks only for a band all seven runs pass: total weld length of 8 km or more and a run of 2 km or more.
- **Grid** (200 km section; the record holds 400 columns, so dx 500 m can cover only 200 km). Dominant wavelength 23.2 km at dx 1,000 and 22.9 km at dx 500 (1.3 %); salt highs 4 and 5, mean spacing 16.0 and 17.6 km (9.6 %). On the 400 km section the spacing is 19.2 km at dx 1,000 and 21.5 km at dx 2,000 (12 %), the wavelength 14.1 and 12.8 km (9 %). The 200 km grid check ends the salt basin at the section edge (the limit starts at 200 km), so it still has an edge pile of its own; it checks the wavelength and spacing of the structures, not the edge.
- **Not claimed.** The position of the limit; that 200/240 km is the best one (the sweep in `docs/reviews/m3-10-edge-fix.md` was judged by the pile test only); that the salt shape past the limit resembles the Gulf; that a Gulf geologist would accept a 160 km salt-free outer section.

## AUD-3 Gulf shale compaction for the Gulf-style preset (F-4b of the physics audit; D26.4)
- **Source.** Hart, Flemings and Deshpande (1995), Geology 23, 45-48, p. 46: porosity phi = phi0 exp(-beta sigma) (eq. 1) with sigma = Pl - Pf, the effective stress (eq. 2); fitted for Gulf shale at Eugene Island 330 (Pathfinder well): beta = 3.68e-2 /MPa and phi0 = 0.40. Checked against the paper by the orchestrator (2026-10-17). Reference id `hart-flemings-deshpande-1995`.
- **Same law as the engine.** `porosity(P, lith, smax)` is Athy in effective stress, phi0 exp(-beta sigma), with sigma in Pa. Same form, same variable. Unit conversion: 3.68e-2 /MPa = 3.68e-2 / 1e6 /Pa = 3.68e-8 /Pa. The engine's North Sea mud was phi0 0.63, beta 5.2e-8 /Pa (Sclater and Christie 1980). The paper gives shale only, so sand stays 0.49 and 2.68e-8 /Pa.
- **Where it is used.** Gulf-style preset only (`phi0: [0.49, 0.40]`, `beta: [2.68e-8, 3.68e-8]` in its params). The other presets and the registry defaults keep the North Sea values. Mud permeability, supply, subsidence and salt are untouched (tuned).
- **Limits (say them when you quote it).** The fit is from the shallow, hydrostatically pressured section (under 1,500 m, 4,900 ft) of one well. Using it at 8,000 to 12,000 ft is an extrapolation. The Fig. 3 caption of the paper shows a second curve, beta = 7.2e-2 /MPa, that matches pressures at depth but over-predicts them higher in the section. We use the first only. Shallow section (AUD-6 B-1): with the Hart mud the Gulf pore pressure 500 ft below the sea floor is 9.35 to 10.49 ppg (columns 100, 150, 200, 250; u / L 0.17 to 0.65) against 8.59 to 8.62 ppg (u / L 0.01 to 0.07) with the North Sea mud, and at 2,000 ft it is 10.2 to 12.2 ppg against 8.7 to 8.8 ppg (Windows node 26, `scripts/review/aud-06/shallow.mjs`; Linux node 22: 9.21 to 10.74 ppg at 500 ft, 10.4 to 12.3 ppg at 2,000 ft). Hart's own well is hydrostatic there, so the model now reads 1 to 2 ppg over hydrostatic in the interval the coefficients come from. The cause is the tuned mud permeability law log10 k = kA + kB phi (`params.ts`), which was tuned with phi0 0.63: at phi0 0.40 the surface mud is about 70 times less permeable (10^-18.8 against 10^-17 m^2), so the top of the column no longer drains. Nothing was retuned; this is a model limit, and the re-fit is in the Backlog. It is the same mechanism as the higher cap count (15.6k to 36k), the extra slope failures with failure on (83 to 4,759 events) and the thinner welds.
- **Result (median of 4 runs: plain and 1 ulp noise salts 7, 11, 13; D16.4).** Windows node 26 / Linux WSL node 22, North Sea mud -> Hart mud. Traugott (1997) gap at the check cell, column 150: 1.73 -> 1.15 / 1.73 -> 1.14 ppg (overburden 16.59 -> 17.18 ppg on Windows, trend 18.33); column 250: 1.27 -> 0.85 / 1.28 -> 0.83 ppg. About a third of the gap closes; the rest stays and is not tuned away. Pore pressure at 10,000 ft below the sea floor, column 150: 12.74 -> 15.19 / 12.75 -> 15.15 ppg (u/L 0.54 -> 0.78). The overburden-cap count (cells where pore pressure was held at the overburden, F-3) **rose**: 15.6k -> 36.1k on Windows, 16.1k -> 48.2k on Linux. The largest u/L is 1.000 before and after. Nothing was changed to bring the count down; it is checked against the leak-off limit (F-3b) later. Bundled against full solve, Gulf preset, worst pore-pressure difference below 5,000 ft: 13.1 -> 8.7 ppg (Windows, `scripts/gen-bundle-table.mjs`).
- **D18 targets with the Hart mud.** Welds of 2 km or more under 100 m: still met, thinner (total 16.0 -> 8.5 km Windows, 16.0 -> 7.5 km Linux; longest run 3 -> 2 km). Crests within 2 km of the seafloor, 20 km rule: **dropped for this preset** (4 -> 0 on both platforms, in every run; the old ones were 300 to 850 m cover ripples). Wedge still prograding (final shelf edge 218 -> 212 km Windows, 219 -> 208 km Linux). Salt beyond 250 km reaches 6.4 to 6.6 km (was 5.0 km), so the no-pile band is 2 times the start thickness. Scripts: `scripts/review/aud-03/gulf-compaction.mjs` and `crest-example.mjs`.

## M4.1 Planned well path and sampling (D21)
Source code: `src/engine/well.ts` (pure, in the engine folder because it reads the record and runs in the worker; it changes no engine state); worker request `sampleWell` (`TimeMachine.sampleWell`); the well is the optional `well` field of the scenario file (`src/app/scenarioFile.ts`). Tests: `tests/wellPath.test.ts` (hand calculation), `tests/wellSample.test.ts`, `tests/wellScenario.test.ts`, `tests/wellTiming.test.ts` (wall clock).
- **Path.** Vertical to the kickoff, a circular arc at a constant build rate, then a straight hold, all in the plane of the section (S-shapes and out-of-plane wells are Backlog, D21). In a plane the minimum-curvature method is exactly a circular arc, so the stations are closed-form, not integrated. R = 18,000 / (pi x BUR) ft; on the arc TVD = KOP + R sin a and displacement = R (1 - cos a) with a = (MD - KOP) / R; on the hold TVD gains cos(hold) and displacement sin(hold) per ft of MD. Standard directional geometry (e.g. Bourgoyne et al., 1986, Applied Drilling Engineering, ch. 8; formula only, no data). Hand check, KOP 5,000 ft TVDSS, BUR 3 deg/100 ft, hold 30 deg: R = 1,909.86 ft, build 1,000 ft MD, TVD gain R sin 30 = 954.93 ft, displacement R (1 - cos 30) = 255.87 ft (255.8726; the card quoted 255.88). The test matches both to 1e-9 relative.
- **Stations** every 10 ft of measured depth from the rig floor (`STATION_SPACING_FT`, a sampling choice, not physics), plus one at total depth exactly.
- **Datum.** Depths read as TVDSS. The rig floor (RKB) is the air gap above the sea surface: **80 ft, tuned** (a typical floating-rig air gap; no source; editable per well). EMW = P / (g x depth below RKB), so sea water at depth d reads RHO_W d / (d + air gap): at 3,000 ft below the sea surface 8.554 x 3,000 / 3,080 = 8.332 ppg instead of 8.554. The pseudo-well uses the same datum. Where the ground is above the sea there is ONE rig floor, the air gap above the ground (M4.7): the stations are shifted by the ground's height above the sea at the wellhead, so MD 0 is the rig floor, the first stations are air down to the ground, tvd_rkb equals the depth the EMW uses (psi = ppg x 0.051965 x tvd_rkb), and kickoff and total depth stay TVDSS. At the default Gulf wellhead the ground is about 117 ft above the sea, so the rig floor is about 197 ft above the sea. (M4.1 to M4.5 measured MD and TVDSS from the sea while the EMW used the ground, a 117 ft disagreement found in the M4.6 review.) The pseudo-well uses the same ground-plus-air-gap datum.
- **Sampling.** The record is read in the two columns either side of each station at the same elevation and interpolated by distance between column centres. Numbers (sand fraction, porosity, temperature, excess pore pressure) are interpolated only when both columns hold the same material at that elevation; across a salt flank or an MTD edge the nearest column is used, because a blended "half salt" rock does not exist. Material, layer and age come from the nearest column (a tie goes to the landward one). Overburden is interpolated (a stress field is continuous). Pore pressure = hydrostatic + excess pressure of the sediment (none in salt, as in the pseudo-well). A column that has no rock at that elevation (above its surface or below its basement) is left out of the interpolation; if neither column has rock the station is water or air (above both surfaces) or the base of the record (below either basement), where the well stops, flagged. A well that leaves the section stops, flagged. Cell properties are constant over a cell; hydrostatic and overburden vary smoothly inside it, so at a cell middle a vertical well equals the pseudo-well to 1e-9.
- **Not claimed.** The air gap value; that linear interpolation between columns is right near a salt flank (it is a display choice, labelled); fracture gradient and the mud-weight window are M4.2. **Sub-salt pore pressure: not claimed** (the salt's weight in sub-salt compaction and salt-sealed pressure are not modelled).

## M4 well pressures (M4.2, D21)
Source code: `src/engine/wellPressure.ts` (`wellPressures`), parameters in `src/engine/wellPressureParams.ts`. Tests: `tests/wellPressure.test.ts` (hand calculation in its header). They read a `WellSamples` and change no engine state, so no `stateHash` moves.
- **Units.** psi and equivalent mud weight (EMW, ppg) referenced to RKB: EMW = P / (g D), D = depth below RKB, g = 9.81 m/s^2 (the engine's, as in the samples). 1 ppg = 119.8264 kg/m^3, so 1 ppg over 1 ft is 0.051965 psi at this g (0.051948 at standard gravity; the field rule 0.052). Conversions are in `src/units.ts`.
- **Fracture gradient.** Pf = K (S - P) + P and FG = Pf / D, with S the total vertical stress (the overburden, which contains the weight of the water column), P the pore pressure. Eaton (1969): K = nu / (1 - nu). Matthews & Kelly (1967): K = Ki. Both equations are written from the commonly quoted form; **neither paper was read here (to verify)**. Both are used with ONE constant per well, because the depth curves of the papers (Eaton's Poisson's ratio against depth, Matthews & Kelly's Ki against the depth where the matrix stress would be normal) are not tabulated: no points are invented. With a constant K the two have the same form, so they differ only through the number chosen. Default method Eaton (D21).
- **In salt** the fracture gradient is the overburden (D21). Reason: salt is impermeable and flows until the stress is nearly equal in all directions, and it has no pore pressure to add. Industry practice; **no source is in this project (to verify)**. The pore pressure of salt is not modelled (NaN in the samples). **No window is counted in salt** (M4.7, M4.6 Finding 2; M4.2 had used hydrostatic as a lower limit, which gave a misleading 9.9 ppg window): the window is empty in salt and salt stations are left out of the narrowest window and the tight and no-window runs. The interval needs a mud weight close to the overburden to hold the hole open: practice, no source yet.
- **Cap at the overburden (AUDIT-1, F-3).** The solver holds u at the buoyant load where it would pass it
  (`diag.clamps` counts the times). The Physics checks panel shows the count and the largest u / L; the pseudo-well
  and planned well mark cells at u / L >= 1 - 1e-9 (yellow dot; `capped_at_overburden` in the CSV). Hauser (2020,
  p. 108-109, read via the audit) finds the seal leaks before the effective stress reaches zero; the engine has no
  leak-off, so a capped cell is an upper bound. Where the window is zero or negative the plot says so in words.
- **Overburden against a regional trend (AUDIT-1, F-4a).** Traugott (1997), World Oil Deepwater Supplement, p. 2
  (**read** by the audit review; not re-read for this card): average sediment density between the sea floor and
  depth d = 16.3 + (sediment thickness in ft / 3125)^0.6 ppg. The check (`traugottOverburdenPpg`) combines it with the
  water column at 8.5 ppg: (8.5 w + rho_sed (D - w)) / D, with D the depth below the sea surface. It reproduces the
  audit's worked value (2,000 ft of water, 12,300 ft TVD: 16.7 ppg). The audit also quotes a 13.7 ppg example from the
  same paper; the test does not reproduce it because the example's inputs are not recorded here. Status: **cited**,
  regional average, not a local log; the check flags a gap over 1 ppg (a labelling threshold, not physics).
  The Gulf preset's densities are not calibrated (North Sea coefficients until AUD-3).
- **Stress ratio.** K is constant with depth here; deep-water practice has the stress ratio rising with depth below the mudline (Traugott 1997). Not modelled; on the Backlog (M4.6 Finding 3).
- **Deep water.** S includes sea water from the sea surface down (`overburdenPa` in the samples already does), and EMW is taken from RKB. The same rock under 5,000 ft of water therefore has a much lower fracture gradient in ppg than on land (hand calculation in the test: 9.98 ppg against 14.49 ppg for mud 1,500 ft below the sea floor with 300 psi excess pressure).
- **Window.** lower = pore pressure EMW + lower margin; upper = fracture-gradient EMW - upper margin; width = upper - lower. Tight: 0 < width < 0.5 ppg. No window: width <= 0 (pore pressure has reached the fracture gradient, with the margins). No wellbore-stability (collapse) limit (D21). Water, air and salt stations have no window (salt: see above). Outputs: the narrowest window (ppg, TVDSS, MD), the runs of tight stations and the runs of no-window stations.
- **Parameters** (all in the `WELL_PRESSURE_PARAMS` registry; not engine parameters, they never touch a run):
  - `fgMethod`: eaton (default) or matthews-kelly. Cited (Eaton 1969; Matthews & Kelly 1967), papers not read.
  - `poissonRatio` 0.40, range 0.20 to 0.49. **Tuned**: a mid-range pick for compacted Gulf mud; K = 0.667.
  - `matthewsKellyKi` 0.60, range 0.30 to 1.0. **Tuned**; to verify against the paper's chart.
  - `lowerMarginPpg` 0 and `upperMarginPpg` 0, range 0 to 2 ppg. **Tuned** safety margins.
  - `tightWindowPpg` 0.5, range 0.1 to 2 ppg. **Tuned** labelling threshold (a common rule of thumb; no source, to verify).
  - The air gap (80 ft, tuned) belongs to the well definition (M4.1).
- **Hand calculation** (5,000 ft of water, 3,000 ft of mud of 2,000 kg/m^3 with 500 psi excess pressure, 2,000 ft of salt of 2,160 kg/m^3, mud of 2,200 kg/m^3 with 2,500 psi excess pressure; nu 0.40, Ki 0.60), matched to 1e-9 relative by the test:

| depth (TVDSS) | in | S, psi | P, psi | S, ppg | P, ppg | Eaton FG, ppg | M&K FG, ppg | window (Eaton), ppg |
|---|---|---|---|---|---|---|---|---|
| 6,500 ft | mud 1 | 3,523.614 | 3,389.364 | 10.3049 | 9.9123 | 10.1741 | 10.1479 | 0.2617 (tight) |
| 9,000 ft | salt | 5,761.380 | 4,000.657 (hydrostatic) | 12.2102 | 8.4787 | 12.2102 (= S) | 12.2102 (= S) | none (no window in salt, M4.7) |
| 12,000 ft | mud 2 | 8,606.292 | 7,834.210 | 13.7098 | 12.4799 | 13.2998 | 13.2178 | 0.8200 |

  A deviated well (build-and-hold, KOP 5,000 ft, 3 deg per 100 ft, hold 30 deg) gives the same numbers at the station with TVDSS 12,000 ft, although its MD is about 13,080 ft: depth in every formula is TVD below RKB.
- **Not claimed.** That nu = 0.40 or Ki = 0.60 suits any real basin; that a constant K reproduces Eaton's or Matthews & Kelly's depth curves; that the fracture gradient in salt equals the overburden everywhere (halite near a salt flank or a weld may not); that the model's excess pore pressure is a real pre-drill prediction (it is the output of a synthetic run).

## M3b.1 Crest log: rise to accumulation (D23)
Source code: `src/engine/crestLog.ts` (pure analysis, no physics), history captured in `src/worker/timeMachine.ts`, request `crestLog` in `src/worker/protocol.ts`; tests: `tests/crestLog.test.ts` (hand-made records), `tests/crestLogGulf.test.ts`. Idea: option A of `docs/salt-literature.md` section 12; label rule from Giles and Rowan 2012 (GR12 p. 20).
- **What it reads.** The finished record holds only the final salt, so the log needs the salt thickness, salt top and seafloor at every step. A side output copies them after each step of the main run (3 arrays; nothing is written back). The record, the fixtures, the presets and `ENGINE_VERSION` are unchanged (a test compares the record hash with a straight engine run). Salt is read from the salt layer only: salt that moved into higher layers (a canopy) is not followed. The log is kept for the main run only, not for branches.
- **Crest.** A high of the salt top (`b + h_salt`, found with `saltHighs`) with prominence of 100 m or more (**tuned**, from spike 003), salt thicker than `weldThick` and bulk cover under 500 m (NEAR, **tuned**, the "within 500 m" of the card). It is followed from step to step to the column within 3 columns with salt and the least cover (**tuned**). The episode ends when the cover has been over 500 m for 3 steps in a row (buried; end time = the first of them), when no column in reach holds salt over `weldThick` (welded), or at the run end. Crests that come within 2 columns of an older one are one crest.
- **Rates.** F = least-squares rise rate of the salt top, A = the same for the mean seafloor at 3 to 5 columns either side, both in m/Myr (ft/Myr is the UI's job). F - A > 0 means the crest gains on its flanks. A/F is given only for F > 0. Two windows (SALT-R1 S3-2, SALT-R2 3.4): "near" = the last 1 Myr of the records with cover under 500 m; "burial" = the last 1 Myr up to the last record, which includes the one or two records after the cover passes 500 m. A window with fewer than 2 records gives no rate.
- **Absolute against relative rise.** GR12 p. 19 define rise relative to minibasin subsidence plus differential compaction (and say they do not address absolute rates, pp. 19-20). This code takes F and A as absolute rates (elevation of the salt top and of the seafloor beside it). If the flank subsides at rate s, relative rise is F + s and accumulation is A + s, so F - A and the label are the same; if the salt top sinks with compaction or loading differently from the flank, they are not. Not a defect; a judgement, labelled.
- **Label.** `tabular` when A < F, `tapered` when A > F (GR12 p. 20), `unresolved` when |F - A| is under 25 m/Myr (82 ft/Myr, **tuned**: the 90th percentile of how far F - A of the same crest moves under 1 ulp maths noise, 24.5 m/Myr near and 24.6 burial, 6 noise runs per platform; maximum 86 and 78). The episode label is the near-window label. Hooks and wedges (fold zones of 50 to 1,000 m, GR12 p. 8) are not resolved at dx 1,000 m, so the label comes from rates only.
- **Last record (UI-2, M3b.4 N-3).** The crest list column "Last record" is `lastAgeMa`, the age of the last record followed. It includes the one or two records after the cover passed 500 m, so it can be younger than the burial age. It is not the last time near the seafloor.
- **Neighbour salt, flow length.** At the last record: mean salt thickness at 10 km either side; flow length L = distance to the nearest column with salt under `weldThick` on either side (the smaller), over the mean salt thickness over +-10 km. "At the seafloor" = cover under 2 m (spike 003 `roofMin`; the engine has no exposed-salt rule).
- **Gulf preset (Windows node 26 / Linux WSL node 22; 7 runs each: plain and six 1 ulp noise salts; re-measured for AUD-3, Hart mud).** 16 to 18 episodes per run on Windows, 16 to 17 on Linux (16 plain on both): 15 ended by burial and 1 at the run end, the bare toe wall at 333 to 337 km (6.2 to 6.7 km of salt, 0 m cover over the last 3 to 5 km in node; exposed 44 to 57 Myr; a model limit, no dissolution or extrusion, see user guide 14.6) (it was 10 to 15, 13 plain, with the North Sea mud). Median over all episodes of all runs, near window: F-A -84.5 m/Myr (-277 ft/Myr) on both platforms; A 74.8 (Windows) and 75.8 (Linux) m/Myr, 245 and 249 ft/Myr. The medians of single runs go from -58.8 to -87.8 m/Myr (-193 to -288 ft/Myr) on Windows and -63.5 to -87.6 m/Myr on Linux: the spread between seeds on one machine is as large as any difference between the platforms, so no platform difference is claimed (M3b.4 N-2). Labels (near, floor 25; 14 runs): 5 tabular, 197 tapered, 25 unresolved (Windows 2 / 97 / 15; Linux 3 / 100 / 10). Chrome (built file, plain run): 16 crests, 14 tapered, 2 unresolved, 0 tabular, median F - A -243 ft/Myr. Reading: the flank seafloor builds about 75 m/Myr while the salt top does not rise, so the crests are buried, with 4 km of salt next to them, as SALT-R2 found in the spike. (The North Sea mud numbers were: F - A -70.6 / -102.8 m/Myr and A 109.5 / 115.5 m/Myr on Windows / Linux, 125 tapered of 14 runs.)
- **Sources and status of each definition and number (M3b.3).**

  | Item | Value | Status | Source |
  |---|---|---|---|
  | Rise against accumulation as the burial test | crest stays up while net rise F - D is at least A; buried when it is below | the rule is cited; **the code detects burial with a depth rule, labelled tuned** (cover over 500 m for 3 steps); the sign of F - A is then read against the cited rule | VJ92a p. 347 (also HJ07 p. 11). The log has no dissolution term D (the engine has none), so F is the whole net rise |
  | Tabular (A < F) and tapered (A > F) | label from the rates | cited | GR12 p. 20 |
  | Hooks and wedges, fold zones of 50 to 1,000 m | not resolved at dx 1,000 m, so never read from the grid | cited | GR12 p. 8 (dx 1,000 m is the section's own grid) |
  | Crest prominence | 100 m (328 ft) | tuned | copied from spike 003; not measured |
  | NEAR, cover that counts as near the seafloor | 500 m (1,640 ft) | tuned | the card's "within 500 m"; same as spike 003 |
  | Burial gap | 3 steps in a row over NEAR | tuned | spike 003 |
  | Tracking reach | 3 columns either side per step | tuned | spike 003 |
  | Merge distance | 2 columns | tuned | no source; set in M3b.1 |
  | Flank columns for A | columns 3 to 5 either side (3 to 5 km at dx 1,000 m) | tuned | columns 1 and 2 are left out because the crest's own mound bends the seafloor there; no source |
  | Neighbour distance for salt beside the crest | 10,000 m (32,808 ft) | tuned | no source; set in M3b.1 (shorter than the 13 to 14 km structure spacing) |
  | Window length | 1 Myr | tuned | after SALT-R1 S3-2 and SALT-R2 3.4; the records are 5 kyr apart so it holds about 200 |
  | Noise floor for the label | 25 m/Myr (82 ft/Myr) | tuned | measured: 90th percentile of the change in F - A of the same crest under 1 ulp maths noise (24.5 m/Myr near, 24.6 burial, 6 noise runs per platform; maximum 86 and 78) |
  | At the seafloor | cover under 2 m | tuned | spike 003 `roofMin`; the engine has no exposed-salt rule |
  | Weld thickness used to end an episode and measure flow length | the engine's `weldThick` | tuned | the registry value, not a new number |

  Every value above is in `crestParams` in `src/engine/crestLog.ts` and is written in the header lines of the CSV, so a file says which thresholds made it. A tuned value is a choice, not a measured quantity; only the noise floor was set from a measurement (Gulf preset, Windows node 26 and Linux WSL node 22). The label rule and the burial test are the only cited rules.
- **Not claimed.** That a tabular or tapered label says anything about hooks, wedges or growth strata; that the thresholds (100 m, 500 m, 3 steps, 3 columns, 25 m/Myr) are measured; that the single-crest numbers are stable (quote medians, D16.4); anything about salt that moved up into a canopy.

## Salt QC tests (SALT-1)
Source: `tests/saltQc.test.ts` (engine level, calls `src/engine/salt.ts` directly; no engine change). They turn checks 4, 5, 19 and 20 of the QC checklist in `docs/salt-literature.md` section 11 into tests. Keys: HJ07 Hudec & Jackson (2007), WJ11 Wagner & Jackson (2011), GL24 as defined in that document.

| Check | Test | Source | Tolerance and why |
|---|---|---|---|
| 4: flux goes as h^3 | Flat salt sheet of 500, 1,000 and 2,000 m under the same step in cover load. Face flux from `saltFluxes`, with cover bending on and off. Also the salt that moves in one real 1-year `saltStep`. | HJ07 p. 11; WJ11 Eq. 7 | Face flux ratio 8 per doubling to 1e-9 (explicit formula, only rounding of the head difference). Real step, bending off: 0.5 % (the backward-Euler roof response costs about 3e-5 at 1,000 m and 2.4e-4 at 2,000 m; a wrong exponent would be off by 100 %). Real step, bending on: ratios are **not** 8 (7.91 and 7.45) because the cover resists with a stiffness that does not go as h^3; only "never faster than bending off" is tested. |
| 5a: no differential load, no flow | HJ07 Fig. 7c, p. 8: flat salt top (uniform head), uniform cover, salt thickness varying with an uneven base. Reference: the same base and salt thickness with a cover on the left half only. | HJ07 Fig. 7c, p. 8 | Flux and 0.1 Myr thickness change below 1e-9 of the reference (reference 8.5e-8 m2/s and 55 m; measured zero). Bending on and off. |
| 5b: equal densities, no flow | Cover density = salt density, flat seafloor, cover 800 to 1,200 m thick. The engine takes cover density from the record (grain density 2,650 kg/m3), so the cover weight and thickness are written to `eng.salt.W` and `eng.salt.Sb` and the engine's own `saltPotentialOf` and `saltFluxes` are called. Reference: the same geometry with a 2,400 kg/m3 cover. | GL24 Fig. 5a, p. 626 | Below 1e-9 of the reference (measured 9e-14: rounding of a head of 1e8 Pa against a difference of 1e5 Pa). |
| 20: weld thinning time | 100 m salt column next to a thick salt reservoir under a heavy cover, so that face 0 carries the only head difference; L = dx = 1,000 m, mu = 1e17 Pa s, bending off, P' (80 MPa) measured from the engine. Time to thin to 50 m against Eq. 9, 1/h^2 = 1/h0^2 + t P'/(6 mu L^2) (the form that reproduces their 9.7 m at 200 Myr). | WJ11 Eq. 9, p. 313; Fig. 7a, p. 316 | Within 1 % (measured +0.48 %). The engine's roof drops as the layer thins (a = (rho_salt - rho_w) g), so P' falls by about 0.3 % over 50 m; the rest is first-order time stepping. Halving the step changes the answer by less than 0.5 %. |
| 20: limiter on | No switch exists: the weld limiter runs only when a step would leave a column below 0 m. At every step that leaves the layer above 0 it never ran, so limiter off and on are the same run (0 firings). Reported, not tested: a step of 20 Eq. 9 times fires it once. The Fig. 7a values (P' 1 MPa) give 9.7 Myr in the engine against 5.7 Myr from Eq. 9 (ratio 1.7): WJ11 holds P' fixed, the engine loses head as the roof drops (0.56 MPa of the 1 MPa over 50 m). | WJ11 Eq. 9 | Printed only. |
| 19: thin salt in the Gulf preset | End state of the `gulf` preset: columns with salt under 100 m and under 50 m. Printed only; the counts sit near thresholds (D16.4). | WJ11 p. 311 | None. |

The weld limiter in the Gulf run acts only at zero thickness (`saltLimitMaxH` 0.00 m, 2.1e2 m2 in total), so it does not stall welds at 50 to 100 m.

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

References (28):
- `gibson-1958`: Gibson (1958)
- `sclater-christie-1980`: Sclater & Christie (1980)
- `hart-flemings-deshpande-1995`: Hart et al. (1995)
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
- `hudec-2013`: Hudec et al. (2013) (to verify)
- `gemmer-2004`: Gemmer et al. (2004) (to verify)
- `ge-1997`: Ge et al. (1997) (to verify)
- `eaton-1969`: Eaton (1969)
- `matthews-kelly-1967`: Matthews & Kelly (1967)
- `wagner-jackson-2011`: Wagner & Jackson (2011)
- `pilcher-2011`: Pilcher et al. (2011) (to verify)

Parameters (83), as `key`: status, reference id:
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
- `saltLimitStart`: tuned, hudec-2013
- `saltLimitEnd`: tuned, hudec-2013
- `saltVisc`: tuned, wagner-jackson-2011
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
