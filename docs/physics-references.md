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

References (23):
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
- `hudec-jackson-2007`: Hudec & Jackson (2007)
- `gemmer-2004`: Gemmer et al. (2004) (to verify)
- `ge-1997`: Ge et al. (1997) (to verify)
- `eaton-1969`: Eaton (1969)
- `matthews-kelly-1967`: Matthews & Kelly (1967)

Parameters (49), as `key`: status, reference id:
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
<!-- registry-index:end -->
