# SALT-R1: independent review of the salt evidence round (SALT-1, S3b, S4)

Reviewer: salt-reviewer profile, 2026-10-17. Branch `strata-lab/salt-r1-review` (merges `strata-lab/salt-01-qc-tests` and `strata-lab/s4-stokes-check`, which carries S3b). Evidence base: `docs/salt-literature.md` v2 (sections 7, 9, 10, 11, 12) and the notes in `docs/salt-notes/`, read from `strata-lab/lit-04b-recheck`; nothing in `src/` or `tests/` was changed by this review. My own recomputation is `scripts/review/salt-r1.mjs` (sections `qc4 qc20 vk s4 s3b pit`); it imports the spike 003 engine only to produce the state it then measures with its own code, and nothing from `src/`.

Units for John: metres are given; 100 m = 328 ft, 500 m = 1,640 ft, 1 km = 0.62 mi. Rates in m/Myr.

## 1. Summary

- SALT-1 (QC tests 4, 5, 19, 20): APPROVE on its own. The numbers reproduce with my own arithmetic, the tolerances are justified by the reasons the test gives, and the two places the test could have flattered the engine (the "limiter on" row, the Fig. 7a ratio of 1.7) are reported honestly. Two NON-BLOCKING notes.
- S4 (Stokes check): APPROVE the method and the headline answer. My own linear-theory solve gives the same growth rate as the spike's benchmark 2a to four figures; the cover-over-crest table and the salt-area drift recompute from the run outputs; A and B agree where the conclusion needs them to. The van Keken first-peak values remain secondary-sourced (I could not read the 1997 paper either). NON-BLOCKING notes on how the GL24-like case and the resolution scatter are worded.
- S3b (per-crest log): REQUEST CHANGES. The "exposed for 27 Myr" crests are not crests in the seafloor at all. In every census I took (10 to 66 Myr) not one exposed column stands above its non-exposed neighbours; the decisive one (column 271, crest id 21) sits 84 to 134 m below both neighbours at 40 Myr and 1,900 m below them at 54 Myr. The transport fills that hole by about 70 m per 20 kyr substep, and the bypass rule then hands the whole fill to a neighbour because it compares against the transport-smoothed surface instead of the real one (engine.js lines 633-634 say the opposite is intended). The exposure durations, the F - A rates at burial and the "burial by flank aggradation" sentence all rest on this. S4's artefact verdict is not weakened by this (it is strengthened: the thin-sheet exposure is doubly an artefact), but the S3b README's reading of its own log is wrong and must be re-run after the fix.

VERDICT on the round as a whole is at the end.

## 2. SALT-1: QC tests (tests/saltQc.test.ts)

Run on this branch: `npx vitest run tests/saltQc.test.ts --project main` gives 11 passed, 0 failed, no `it.fails`, `it.skip` or `it.todo` (grep of the file). Measured values printed by the tests and checked by me:

QC 4 (flux goes as h^3; checklist item 4, HJ07 p. 11, WJ11 Eq. 7).
- `salt-r1.mjs qc4`: q = h^3/(12 mu) dP/dx at 500, 1,000, 2,000 m gives ratios 8.000000000000 and 8.000000000000 per doubling. The test's face-flux ratio of 8 to 1e-9 is the same formula, so it is a self-check of the code path, not of the physics; the real-step ratios are the physics check.
- Real one-year step, bending off: 7.99959 and 7.99672 (test output), i.e. 5e-5 and 4e-4 relative below 8. My one-step backward-Euler estimate (c M a with c = dt/dx^2, M = h^3/12 mu, a = (2,400 - 1,025) 9.81 Pa/m) is 1.4e-6, 1.1e-5 and 9e-5 at 500, 1,000 and 2,000 m, the same order and the same growth with h. The 0.5 % tolerance is justified for this reason; I would not have accepted a looser one.
- Bending on: 7.913 and 7.446. The test explains the drop as the plate spreading the load step, which lowers the local head gradient most for the thickest layer. That is a plausible reason but it is asserted, not measured; see NON-BLOCKING S1-1.

QC 5a/5b (null cases; item 5, HJ07 Fig. 7c p. 8; GL24 Fig. 5a p. 626).
- 5a flux exactly 0 against a reference of 8.5e-8 m2/s and 55 m per 0.1 Myr. 5b ratio 9e-14 against a 2,400 kg/m3 reference. Both are what a correct zero of the loading term looks like. The 5b test writes cover weight and thickness into `eng.salt.W` and `eng.salt.Sb` by hand because the engine takes cover density from the record; the physics-references entry says so. Honest, and the only way to do it without an engine change.

QC 20 (weld thinning time; item 20, WJ11 Eq. 9 p. 313, Fig. 7a p. 316).
- `salt-r1.mjs qc20` (own code): Eq. 9 with the test's measured P' = 80.06 MPa, mu 1e17 Pa s, L 1,000 m gives 71,245 yr for 100 m to 50 m. The test's engine value is 71,590 yr (+0.48 %). Integrating the same law with the roof dropping as the layer thins (a = (2,160 - 1,025) 9.81 = 11,134 Pa/m, so 50 m of thinning removes 0.557 MPa) gives 71,577 yr (+0.47 %). So the whole 0.48 % is the dropping roof, which Eq. 9 (zero roof speed) does not include; it is not time-step error. The 1 % tolerance is justified and could be halved.
- WJ11 Fig. 7a values (P' 1 MPa, L 1,000 m, mu 1e17, h0 100 m): Eq. 9 gives 5.70 Myr to 50 m, 9.70 m at 200 Myr and 4.36 m at 1,000 Myr; the paper states 9.7 m (Fig. 7a caption, p. 316, full text in the note) and the note's own arithmetic gives 4.4 m. With the roof dropping 0.554 MPa of the 1 MPa I get 9.54 Myr (ratio 1.67); the engine gives 9.67 Myr (ratio 1.70). The test reports this ratio and the reason; my integration confirms the reason, so the 1.7 is physics (a falling roof), not the limiter.
- "Limiter on" row: there is no switch, the limiter never fired in this test (0 firings), so the on/off comparison the checklist asks for could not be made. The test says so plainly. NON-BLOCKING S1-2.
- Eq. 9 form: the note (`docs/salt-notes/wagner-jackson-2011.md` line 105) says the sign in the text extraction was garbled and the form was fixed by reproducing the paper's 9.7 m. My independent arithmetic gives 9.70 m with that form, so the form is right and the physics-references wording ("the form that reproduces their 9.7 m at 200 Myr") is accurate about its own basis.

QC 19 (remnants in the Gulf preset; item 19, WJ11 p. 311). Printed only. Windows: 27 columns with salt under 100 m, 12 under 50 m; the SALT-1 handoff reports Linux 64 / 49. That difference is the D16.4 noise sensitivity of columns at a threshold (the M3.10 review found the same with 1 ulp of noise). Printing rather than asserting is the right call. NON-BLOCKING S1-3: the two platform counts should be in the physics-references table next to each other, so a reader does not take the Windows 27/12 as "the" number.

Findings (SALT-1)
- S1-1 NON-BLOCKING. tests/saltQc.test.ts, QC 4 bending-on rows (ratios 7.913 and 7.446, 1 % and 7 % below 8). The explanation (plate spreads the load step) is stated, not measured. Minimum fix: print the head difference across the test face with bending on at each h, so the reader sees the gradient fall with h; or widen the load step to several plate lengths and show the ratio return towards 8.
- S1-2 NON-BLOCKING. Checklist item 20 asks for limiter on against off. The test cannot do it (no switch, 0 firings). Minimum fix: say in physics-references that item 20's on/off comparison is not covered and that only the thinning time is; the "reported, not tested" step of 20 Eq. 9 times that fires it once is a start, and a run that fires the limiter at 50 to 100 m rather than at 0 m is what the checklist is after.
- S1-3 NON-BLOCKING. QC 19 counts differ by platform (27/12 Windows, 64/49 Linux). Minimum fix: record both in physics-references with the D16.4 reason, and keep the test printing both thresholds.

## 3. S4: 2D Stokes check (spikes/004-stokes-check)

Benchmarks (README table, lines 20-29), my checks:
- 2a linear growth rate, no-slip top and bottom. My own finite-difference solve of the stream-function ODE for the van Keken case 1a geometry (0.9142 by 1, eta 100, drho 10, g 10, interface at 0.2) gives sigma = 0.010946, 0.010942, 0.010941 at N = 200, 400, 800 and 0.01094 extrapolated; with free-slip walls 0.02813. The spike's reference 0.01094 is right, and the README's remark that free slip moves the first peak to t = 120 is consistent with a 2.6 times faster growth rate. The spike's solver was 1.4 % high at 96 by 104 against a 5 % tolerance: acceptable for a marker-in-cell code at that resolution.
- 2b van Keken first v_rms peak. The spike used 208.99 and 0.0031 from the Underworld example notebook and says so. I found the same pair in two further secondary places (Underworld documentation example 1_06, which gives t = 208.99 and v_rms "approximately 0.0031"; the underworld-standard-examples notebook, which lists 3.0916e-3) and the ASPECT cookbook `van-keken-discontinuous.prm`, which uses the same box, boundary conditions and densities and states its first peak is within 1 % of the paper. I could not read the 1997 paper (JGR 102, 22477-22495, doi 10.1029/97JB01353, publisher wall). So the values are consistent across three independent codes' documentation but remain SECONDARY: the README's caveat (lines 31-32) must stay, and the benchmark should not be cited as "van Keken et al. (1997)" in physics-references without that label.
- 3 area conservation 0.003 % of the box through the overturn; the Gulf runs drift by -0.20 to +1.30 % and the GL24-like A run by -2.20 % (my recompute from `saltArea1/saltArea0` in the run outputs, same as the README). For a marker-in-cell code with sedimentation these are usable, but 1 to 2 % of a 4 km sheet is 40 to 90 m of salt, which is the same size as the cover differences between A and B at some times. The README says this (line 158). Fine.
- 4 free-surface relaxation 30.13 vs 30.16 kyr: a clean check of the sticky-air treatment.

Cover over the crest (my recompute from `out-gulf-*.json`, `salt-r1.mjs s4`, metres at 26.8 / 40 / 54 Myr, minimum over 26 to 66 Myr):
- A x1: 233 / 617 / 263, min 110. B x1: 228 / 667 / 281, min 186.
- A x10: 188 / 356 / 339, min 165. B x10: 238 / 420 / 559, min 216.
- A x0.1: 541 / 343 / 184, min 36 (first below 50 m at 60.3 Myr, back over 100 m by 62.3). B x0.1: 508 / 392 / 202, min 186.
- Unfiltered A and B: minima 127, 214 (x1), 174, 157 (x10), 181, 171 (x0.1). A at CFL 1: min 145.
- Thin sheet in the same window (case file): 468 m at 24.8 Myr, 0 m from 26.8 to 54 Myr.
These match the README table (lines 60-100) to the metre, and the handoff's "11 of 12 runs never under 110 m; the twelfth touches 36 m at 60 Myr" is right. The largest |B - A| over 26 to 66 Myr is 104 m (x1 filtered), 214 m (x1 unfiltered), 351 m (x10) and 249 m (x0.1). So the two resolutions agree on "buried throughout 26.8 to 54 Myr" (every run, both grids, three cover viscosities) and do not agree on the cover history itself (a 40 Myr peak of 617 against 667 m is fine; 349 against 567 m at 50 Myr for x10 is not). The README draws exactly that line (lines 126-136). I agree with its confidence: medium to high for "not exposed for 27 Myr", low to medium for the history.

GL24-like case: relief from 5 Myr on 36 to 238 m (median 112) in A, crest at the surface throughout, area drift -2.2 %. The README is honest that this does not validate against GL24 (line 112) and is only a "does the solver bury everything" check. Good.

Findings (S4)
- S4-1 NON-BLOCKING. README line 24 and any future physics-references entry: the van Keken 1997 values are secondary (Underworld notebook, confirmed by me against Underworld docs and the ASPECT cookbook, but not the paper). Minimum fix: keep the caveat and cite as "van Keken et al. (1997) case 1a, values as tabulated in the Underworld and ASPECT example documentation (secondary)".
- S4-2 NON-BLOCKING. The negative relief ("falls behind the seafloor by 490 to 640 m near the peak", README line 139) is a one-grid-pair, one-section number with an A/B scatter of 100 to 350 m. Minimum fix: give the relief as a range across A and B at the peak, not as a single pair of numbers, and say that only its sign is supported.
- S4-3 NON-BLOCKING. The answer "neither alternative" (README line 140) is right for the Gulf sheet but is worded as if the Stokes crest's own cover history were trustworthy. Minimum fix: state it as "buried throughout, with a cover of order 100 to 700 m that is not converged".

## 4. S3b: per-crest log (spikes/003-passive-diapir, crestlog.js, s3b.js)

Start state: `salt-r1.mjs s3b` reports salt in columns 10 to 239 (10 to 240 km), maximum 4,000 m, which is the main preset's saltThick 4,000 m, pinch 10 to 100 km, limit 200 to 240 km (`src/engine/presets.ts` line 74; `spikes/003-passive-diapir/gulf.js` line 12). Match confirmed.

Two crests hand-checked with my own tracker (same following rule as crestlog.js, re-implemented), per-crest CSV values from the spike in brackets:
- Crest id 21, start column 270: first exposed 26.8 Myr, buried 54.3 Myr [54.3], exposed 27.1 Myr. Last 1 Myr before burial, least squares: F -276 m/Myr [-382], A -9 m/Myr [-11], F - A -267 [-371]. Neighbour salt at the last near record: 3,930 / 3,880 / 4,334 m at 1 / 5 / 10 km [3,956 / 3,877 / 4,337]. Crest salt 4,774 m.
- Crest id 13, start column 230: first exposed 13.3 Myr, buried 34.9 Myr [34.9], exposed 21.2 Myr. F -272 [-388], A -6 [-5], F - A -267 [-382]. Neighbour salt 3,892 / 4,204 / 3,814 m [3,913 / 4,203 / 3,802].
Burial times and neighbour thicknesses reproduce. The F_pre values do not: crestlog.js records the first two steps after the cover passes 500 m (line 64-75: `record(ep)` runs while `ep.over` is 1 and 2), so its "last 1 Myr before the end" includes the burial itself, when the salt top is being pushed down by the new fill. In my window (records with cover under 500 m only) the drop is 270 m/Myr; over the 1.2 Myr before that (51.8 to 53.0 Myr for crest 21) the salt top fell only 28 m, i.e. about 23 m/Myr, while the flank seafloor fell 9 m/Myr. So during the exposed phase the crest loses against its flank by 10 to 15 m/Myr, not 370; the big number is the squeeze during the last 1.2 Myr when 495 m of cover arrives at once. NON-BLOCKING S3-2 below.

What the exposed columns are (BLOCKING). `salt-r1.mjs pit` walks the Gulf run and, at each of 11 marks, classes every exposed column by the seafloor of its nearest non-exposed neighbours:

    t Myr | exposed | above both | below both | mixed | median step down to the higher neighbour | deepest
    10    | 10      | 0          | 1          | 9     | 23 m   | 96 m
    20    | 10      | 0          | 7          | 3     | 36 m   | 129 m
    27    | 12      | 0          | 9          | 3     | 102 m  | 396 m
    30    | 11      | 0          | 9          | 2     | 140 m  | 485 m
    40    | 11      | 0          | 9          | 2     | 291 m  | 983 m
    50    | 6       | 0          | 5          | 1     | 362 m  | 1,275 m
    54    | 5       | 0          | 5          | 0     | 361 m  | 1,941 m
    66    | 2       | 0          | 2          | 0     | 723 m  | 723 m

Not one exposed column, at any mark, stands above both neighbours. Column 271 (crest id 21, the section S4 was built on) at 40 Myr: seafloor -1,212 m against -1,129 m (left, cover 182 m) and -1,078 m (right, cover 326 m). Its salt top is 100 to 190 m above the neighbours' salt tops, so it is a salt crest, but the seafloor over it is a hole 84 to 134 m deep (276 to 440 ft), growing to 1,900 m by 54 Myr.

Why the hole never fills (measured with an instrumented copy of engine.js in my scratch space, not committed). At 40.0 Myr, in each 20 kyr transport substep: the implicit diffusion solve (Ke about 1,000 m2/yr at the faces) brings the surface at 271 from -1,212 to -1,145 m, i.e. deposits about 74 m of bulk sediment in the hole (face fluxes +229 m in from the left, +155 m out to the right, scratch Qf). Then `bypassFresh` (engine.js line 375, called after every substep) tests `receivers` (lines 637-644) against the surface as it stands after that deposit, where the right neighbour is now 6 m lower (-1,155 against -1,149 m), and hands the entire 27 m of solids to it. The salt step then returns the recorded geometry with the hole. Five times per record step, every record step, for 27 Myr. The engine's own comment (lines 633-634) says "a crest that sits in a depression (neighbours higher) keeps what arrives and is buried"; the code does the opposite because the depression test is made on the smoothed intermediate surface and uses `<=` against a neighbour that the same substep has just eroded. The bypass counters confirm it: 2.7e6 m2 of mud per 0.1 Myr record (27 m2/yr) are bypassed at 40 Myr, which is of the order of the whole 28 m2/yr supply.

Why this matters against the literature. The burial rule the spike leans on (VJ92a p. 347; HJ07 Fig. 11 p. 11) compares the crest's net rise with aggradation at the crest; it presumes the crest is at or near the sediment surface. A hole 100 to 1,900 m deep over a salt crest, kept open for 27 Myr while the transport wants to fill it in a few tens of kyr, is not a passive diapir of any published kind (GR12 p. 8: hooks and wedges form against a crest at or above the surrounding surface; HJ07 pp. 11, 24: an emergent diapir's crest is at the surface). So the S3b results that depend on exposure are not evidence about geology:
- "Exposed 1 to 48 Myr (median 24)" (README line 85): measures how long the bypass loop runs, not how long salt stays at the surface.
- "At burial F - A is -382 to -57 m/Myr ... Burial is by flank aggradation, not by source depletion" (line 85): the neighbour-thickness part stands (thick neighbours, 2,900 to 4,300 m, reproduced here), but the "flank aggradation" mechanism is the fill of the hole once the bypass loop finally fails, and the F - A at burial is the squeeze from that fill.
- The 16-run sweep statistics (line 87) and the six 1-ulp runs (line 86) inherit the same rule.
- The S4 starting section (24.8 Myr, 463 m of cover at the crest) is taken before crest 21 is exposed and is not affected at the crest S4 reports on; S4's verdict that the thin-sheet exposure is an artefact is confirmed, and the mechanism is now identified: it is the bypass rule, with the thin-sheet drain only as background. One caveat: crest 13 (column 230, exposed since 13.3 Myr, a hole of order 100 m at 20 Myr) lies inside the S4 window (columns 226 to 315, README line 37). The median filter over 11 columns removes a one-column hole from the sediment level; the unfiltered runs carry it. Both give the same burial verdict at the x1 crest, so the verdict does not depend on it, but the S4 README should say the start section inherits that hole.

What stands in S3b regardless: salt, sand and mud balance closed (1e-13, zero clips, reproduced by my runs); the equal-density null (9e-13 m); the per-crest log machinery (candidates, following, neighbour thickness) which is exactly what checklist items 10 and 11 ask for; and the GL24-like thin-sheet result that the 2 km source drains by 3 Myr, which does not involve exposure.

Platform check (Linux, WSL Ubuntu, node 22, same script). The pit census gives the same picture: at the 11 marks 1 to 14 exposed columns, 0 or 1 of them above both neighbours, median step down 47 to 1,026 m. So S3-1 is not a platform effect. But the individual crests differ: on Linux crest 21 (column 270/271) is never exposed at all; it is buried from 24.8 Myr on (cover at column 271: 512 m at 27 Myr, 408 m at 30, 703 m at 40, 2,320 m at 50). Crest 13 is exposed on both platforms (13.3 to 36.7 Myr on Linux against 13.3 to 34.9 on Windows; F_pre -276 against -272 m/Myr; neighbours 3,566 / 4,266 / 4,885 m). This is the D16.4 noise sensitivity the S3b README itself warns about (line 86: single-crest outcomes are noise-sensitive, medians are not). The consequence for S4 is that its thin-sheet comparison target, "exposed 26.8 to 54 Myr at x1", is a Windows-only realisation of the spike; the S4 answer (Stokes keeps that crest buried) does not change, because on Linux the thin sheet keeps it buried too, but the S4 README should say which platform its thin-sheet case came from and that the exposure does not reproduce on Linux.

Findings (S3b)
- S3-1 BLOCKING. spikes/003-passive-diapir/engine.js lines 375 and 637-660. Bypass sheds the fill of a seafloor depression because `receivers` is evaluated on the transport-smoothed surface after the deposit. Minimum fix: (a) evaluate the depression test on the seafloor at the start of the record step (or on H before the substep's deposit) and require H[j] to be at or above the receiving neighbour by more than the deposit just made; (b) require the exposed column to be a topographic high (H[j] >= both nearest non-exposed neighbours) before any shedding; (c) rerun `node s3b.js gulf` and the sweep, regenerate gulf-crests.csv and the README results block, and re-state the exposure durations and the F - A values. If after the fix no crest is exposed for more than a few Myr, the README answer becomes "the thin sheet does not keep an exposed crest; S4 says Stokes does not either for the Gulf sheet", which is a cleaner result than the present one.
- S3-2 NON-BLOCKING. crestlog.js lines 64-75 and 114-116: F_pre and A_pre include the first two records after the cover passes 500 m. Minimum fix: define the window as records with cover under NEAR only, or report both ("rate while near" and "rate at burial") with the window stated in the CSV header; the README's "F - A at burial" then changes from -382 to about -270 m/Myr for the two crests checked, and the exposed-phase rate (about -10 to -25 m/Myr) should be the one quoted against VJ92a's rule.
- S3-3 NON-BLOCKING. README line 72 ("bypass shares sediment equally to the two lower sides; real sediment would follow the slope") understates the problem; after S3-1 it should also say that bypass acts only from a topographic high.
- S3-4 NON-BLOCKING (S4 README as well). The crest S4 was built on (id 21, column 270/271) is exposed on Windows and never exposed on Linux. Minimum fix: both READMEs state the platform of the thin-sheet run they quote and that the single-crest exposure does not reproduce across platforms (D16.4); S3b quotes medians over the six 1-ulp runs and over both platforms for the exposure duration, not the one crest.

## 5. The S3 question: my answer with confidence

Question (salt-literature section 9): is exposed salt buried within a few Myr while the 4 km source is thick a thin-sheet limit or geology?

Answer: thin-sheet artefact in the model as it stands, and specifically an artefact of the exposed-salt bypass rule rather than of the lubrication flow. Confidence high (measured, section 4) that the 27 Myr exposure is produced by the bypass loop; confidence medium to high (S4, twelve Stokes runs on two grids, three cover viscosities) that a Newtonian Stokes salt under this Gulf-preset load keeps the crest buried under at least 110 m through the same window; confidence low on what a real Gulf crest with a frictional, faulted roof does, because neither solver has one and the literature is split on fast sedimentation (section 7 item 4; GL24 Fig. 10a against Fernandez and Kaus 2015 as cited by GL24 p. 631). The published rule (VJ92a p. 347) is not contradicted by anything here: once the hole is filled, the crests lose against their flanks at 10 to 25 m/Myr under a supply of 28 m2/yr with thick neighbours, which is the "sedimentation outpaces rise" case the literature does describe (GR12 p. 8, tapered sequences), not the "supply exhausted" case.

## 6. The four open S3 questions (recommendations; John decides)

1. Prescribed feed versus a source layer. Recommend: no prescribed feed in the product. Reason: S4 shows the Gulf-type sheet does not need one to get the first-order answer, and the GL24-like thin-sheet drain (source gone by 3 Myr) is a case the product does not claim. A feed would add a parameter with no published calibration (section 12 option C, cost high).
2. Dissolution of exposed salt. Recommend: not in M3b; name the missing sink in the output wherever salt is exposed (checklist item 13). Reason: with S3-1 fixed, exposure will be rare and short; a dissolution rate would be a tuned number on top of a rule that is itself under repair.
3. Bypass following the slope. Recommend: yes, but only after S3-1: shed from a topographic high only, split by the slope to each lower neighbour, tested on the seafloor at the start of the step. Reason: section 4 of this review.
4. Roof thinning as a tuned rule. Recommend: keep it labelled "tuned" and keep `shed` off by default until a run shows a roof above about one-third of the neighbouring cover (checklist item 14, VJ92a p. 335). Reason: the S3b Gulf run has 0 shed events (shed counters 0 in my probe), so there is no evidence either way yet.

## 7. QC checklist v2 walk (section 11), 24 items

1 Mass balance: pass. Salt, sand, mud 1e-13 or better in S3b (my run), clips 0; S4 0.003 % benchmark, 0.1 to 2.2 % in production runs (marker method, stated).
2 One ulp: pass in spirit. S3b ran six noise salts; crest counts vary by up to 3; the README quotes medians. Red flag note: single-crest outcomes (such as id 21's 54.3 Myr) are noise-sensitive and should not be quoted alone.
3 Grid: S3b dx 1,000 and 500 m give the same seafloor test; S4 A/B agree on burial, not on history. Pass for the claims made.
4 h^3: pass (section 2).
5 Nulls: pass (section 2; S3b equal-density 9e-13 m).
6 Pile ratio: not re-measured here; M3.10 value 1.25 stands. Not changed by this round.
7 Advance: not re-measured; not changed.
8 Start thickness: thickest landward, tapering seaward (pinch 10 to 100 km, limit 200 to 240 km). Pass.
9 Weld vs pillow against progradation rate: not addressed by this round. Open.
10 Rise-to-accumulation per crest: the log exists (S3b), but the F values at burial include the burial step (S3-2) and the exposure they rest on is an artefact (S3-1). Fail until rerun.
11 Neighbour salt and L/h at burial: logged and reproduced (3,800 to 4,300 m at 1 to 10 km). Pass as a measurement; the conclusion drawn from it is suspended by S3-1.
12 Flank dip precursor: logged (dipPeak); not checked here.
13 Dissolution sink named: S3b README line 71 names it. Pass.
14 Roof thickness at exposure: 0 shed events in the Gulf run; roofMin 2 m. The exposed columns have zero cover and sit in holes (S3-1), so this item cannot be assessed until rerun.
15 Down-building with a thick source: S4 GL24-like keeps the crest at the surface for 50 Myr; S3b thin sheet drains the source by 3 Myr. The README says the two differ and why. Pass as a statement; no GL24 numbers were matched (README line 112).
16-18 Minibasins: not addressed by this round.
19 Remnants: counted (27/12 Windows, 64/49 Linux). Pass with S1-3.
20 Limiter on/off: not possible (S1-2). Thinning time pass.
21 Viscosity range: 1e17 (QC 20) and 1e18 (Gulf) used; S4 varied cover viscosity by 10 both ways and the burial conclusion survived. Pass.
22 n = 5: S3b has saltN, not run in this round. Open.
23 Sources and labels: all new numbers in physics-references carry page and access level; van Keken values marked secondary in the README (S4-1 asks for the same in physics-references when it gets there). Pass.
24 Stems, canopies, spreading: S4 README line 158 and the salt-literature section 8 say what the model cannot hold. Pass.

## 8. Citation honesty of the new documents

- docs/physics-references.md (SALT-1 section): every row has a source, page and tolerance reason; the Eq. 9 form is attributed to the note's reading and its 9.7 m check, which I reproduced. No abstract-only source is upgraded. Pass.
- spikes/004-stokes-check/README.md: secondary status of the van Keken values stated twice (lines 31, 163); "does not validate against GL24" stated (line 112); scaled-model versus natural rates not an issue (all numerical). Pass with S4-1.
- spikes/003-passive-diapir/README.md: sources named for the burial rule; the results block (lines 83-89) needs re-writing after S3-1. The "tuned" label on prominence 100 m and roofMin 2 m is present.
- No paper text copied; page numbers given; no local paths or personal data in the committed files (checked `git diff main --stat`, 31 files, all under docs/, spikes/, tests/, scripts/review/).

## 9. M3b options (section 12), in the light of this round

- A (per-crest rise-to-accumulation output): still first. The S3b log is the prototype; after S3-1 and S3-2 it answers items 10 and 11 cleanly. Cost low.
- B (power-law salt): unchanged, a sensitivity test; not needed for anything found here.
- C (source-layer feed): not needed for the Gulf sheet (S4); only if GL24-style stem growth becomes a product goal.
- D (full Stokes): S4 shows the cost (15 to 120 minutes per run) and that the Gulf answer does not require it. Keep as the long-term answer, not M3b.
- E (translating cover): leave out.
- F (frictional cover): the one option this round makes more interesting, because both solvers used a Newtonian cover and the exposure question depends on whether a roof can fail. Medium to high cost; no number here argues for it yet.
- New, cheapest, and before any of them: fix S3-1 in the spike (and check `src/engine` for the same `receivers` logic if bypass is ported), rerun S3b, and add the pit census of `salt-r1.mjs pit` as a test: "no exposed column lies below both nearest non-exposed neighbours by more than one record step of deposition".

## 10. Gates

- Windows: `npm ci` exit 0 (node v26.7.0); `CI=true npm run check` (typecheck, lint, vitest main and wallclock): see the result block below.
- Linux parity (WSL Ubuntu, node 22, a script that makes a fresh clone of this branch, `npm ci`, `CI=true npm run check`, then `salt-r1.mjs qc4 qc20 vk s3b pit`): see the result block below.

GATE RESULTS
- Windows (this worktree, node v26.7.0): `npm ci` exit 0; `CI=true npm run check` exit 0: typecheck and lint clean; vitest main 33 files, 355 passed, 1 skipped; wallclock 5 files, 81 passed, 7 skipped.
- Linux (WSL Ubuntu, node v22.23.3, fresh clone of `strata-lab/salt-r1-review`): `npm ci` and `CI=true npm run check` exit 0: main 33 files, 355 passed, 1 skipped; wallclock 5 files, 81 passed, 7 skipped. Parity with Windows on the gates.
- Review script on Linux: QC 4 ratios 8.000000000000; QC 20 Eq. 9 71,245 yr and 71,577 yr with the dropping roof; van Keken growth rate 0.010946 / 0.010942 / 0.010941 (bit-for-bit the Windows values); S3b and pit census as described in section 4 (same conclusion, different individual crests, D16.4).

## 11. Findings index

BLOCKING
- S3-1 bypass sheds the fill of a seafloor hole (engine.js 375, 637-660); exposure durations and burial rates in S3b rest on it.

NON-BLOCKING
- S1-1 QC 4 bending-on explanation asserted, not measured.
- S1-2 QC 20 limiter on/off not covered; say so in physics-references.
- S1-3 QC 19 platform counts both to be recorded.
- S4-1 van Keken values secondary; label in physics-references when cited.
- S4-2 negative relief quoted as a single pair; give the A/B range.
- S4-3 "neither alternative" wording; say cover history is not converged.
- S3-2 F_pre window includes the burial step; report the exposed-phase rate.
- S3-3 README bypass note to be extended after S3-1.
- S3-4 the S4 reference crest is exposed on Windows only; state platform and quote medians.

The verdict covers the round as a whole, because John sets the M3b scope from it: SALT-1 and S4 can be merged as they are (with the non-blocking fixes as follow-ups), but the S3b results block cannot be used to set that scope until S3-1 is fixed and the spike re-run.

VERDICT: REQUEST CHANGES
