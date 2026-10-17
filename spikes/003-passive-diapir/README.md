# Spike 003: passive diapirs (exposed salt, sediment bypass, roof thinning)

Question: can the engine hold a salt crest at the seafloor while sediment piles up around it (a passive diapir),
and what has to change so that it does? Follows spike 002 (thin-sheet salt) and the M3 salt engine (D17, D18).

Run: `node test.js` (about 10 s, prints the tables below, exit 0 when everything passes).
`node gulf.js base|bypass|shed|both [json overrides]` runs the gulf preset values in this spike's engine copy (about 8 s).

## What is in `engine.js`

A copy of spike 002's engine plus switchable options, all off by default (so nothing changes unless asked):

- Cover bending (`coverBend`, `coverVisc`) and the weld outflow limiter (`limiter`, `weldThick`): ported from
  `src/engine/salt.ts` (M3.2, M3.3) so the spike runs the same salt physics as the product. Weld ages are recorded.
- Exposed salt with sediment bypass (`exposed`, `roofMin`). A column with salt and under `roofMin` (2 m) of cover has
  no roof. Sediment that lands on it is not stored; it goes to the nearest covered column on each side, but only to a
  side whose seafloor is lower or level (no uphill shedding), and since S3c only if the exposed column is itself a
  topographic high (details in the S3c section). Sand and mud are moved separately, so each is conserved.
  At the seafloor the pressure on the salt is the water load alone (the potential formula already handles zero cover).
- Roof thinning (`shed`): a rising crest with under `shedBelow` of cover sheds `shed` m of cover per m of salt rise
  to its lower neighbours. Conserved per grain size.
- Power-law salt (`saltN`, `saltTauRef`): mobility from channel flow of a power-law fluid (derivation in the code).
  `saltN = 1` is exactly the Newtonian mobility.
- Controlled test mode (`ctrl`, see `ctrl.js`): prescribed aggradation `A`, prescribed salt feed `Q`, no transport,
  no compaction (constant-property sediment so heights are exact), equilibrium-surface rule: a crest column standing
  above the flank seafloor sheds the excess cover to the flanks.
- Mass balance now reports salt, sand and mud separately, plus bypassed and shed volumes.

## Results

1. Stay-at-the-seafloor rule (hand calculation, `test.js` section 1). With W the fed width, nT columns of which nD are
   fed, every column receiving A m/yr, the flank seafloor rises at A_eff = A nT / nF. The crest stays at the seafloor
   iff its rise rate R = Q / W is at least A_eff; otherwise it is buried and the cover grows at
   (A_eff - R) / (1 + nD / nF). Eleven runs from R/A_eff 0.25 to 4 match the closed form to under 0.2 % (cover 749.96
   vs 750.00 m at 0.25; threshold resolved between 0.99 and 1.00). Conservation: salt 1e-14, sand 6e-13, mud 1e-12.
   Bypassed bulk volume 3.00 km2 equals A W t exactly.
2. Determinism: bit-identical across repeated runs, with all new options on.
3. Wall shape with flow on (section 3). With Q = 4 A W0 the exposed wall widens from 3 km to 9 km while the crest
   rises 480 m above the flanks, then narrows again as salt spreads sideways; with Q = A W0 or less it is buried.
   The "A_eff" rule above holds only while the fed width stays fixed; with flow on the salt body widens and the
   effective R falls, which is why walls close again.
4. Grid (section 4): the seafloor test gives the same answer at dx 1000 and 500 m; the flow-on exposed width is 7 km at
   both. Widths are quantised to whole cells, so only compare them across dx within one cell.
5. Cover bending at zero cover: K stays positive semi-definite with columns of no cover (D = 0 there), so the banded
   solve does not become singular. The end rows are mirror ends (as in the product), so tilt is not free at the very
   ends; a rigid shift is free everywhere. With no cover at all bending-on equals bending-off to 0 m.
6. Power-law mobility matches the hand calculation to 1e-12 for n = 1, 3, 4, 5. n = 1 is exactly Newtonian.

## Gulf preset in this engine (what the spike did not find)

(This section is the first S3 run, on the spike's own start profile and the original bypass rule. The M3.10 start with the fixed rule is in the S3b and S3c sections below, which supersede it for the question of how often salt is exposed.)

Same parameter values as the M3.8 gulf preset (4 km salt, 66 Myr, viscosity 1e18, cover 300 m with noise, supply 28),
in this spike's own engine (100 kyr record step, its own seeded noise and start profile; not the product's numbers):

- Mass balance stays at 1e-15 for salt, sand and mud with bending, limiter and bypass on. 828 limiter events.
- Salt is welded in 11 runs of 1 to 4 km in the proximal 80 km with ages 22 to 58 Myr; the thick salt sits at 250 to 400 km.
- With `exposed` on, only 2 columns ever hold exposed salt (at about 360 km, 6 to 16 Myr, in the first 2 to 20 Myr);
  none at the end. Salt viscosity 1e17 gives 4 columns for 5 Myr; 3e17 gives none. With supply halved the same few
  columns appear early and the shoreline retreats.
- A 16-run sweep on a smaller strip (supply 8 or 20, salt 2000 or 3500 m, viscosity 1e16 or 1e17, cover 50 or 150 m)
  gave exposed salt in 12 runs, but only for 0 to 8 columns and always gone within about 3 Myr (0.05 to 3.3 Myr in the
  run traced); none persisted to the end.
- Roof thinning (`shed = 1`) moves 7e6 m2 of cover in the 2 Myr test run and does not change this.

Reading: with Newtonian thin-sheet flow the salt is drawn out of a column as fast as sediment loads it. A column does not
get a sustained supply, so the crest gets buried again (the R < A_eff branch of result 1). The controlled test shows the
bypass machinery is right when a feed exists. Making passive diapirs appear on their own needs a source of salt that keeps
up (power-law weakening, or a deeper source layer), which this spike only supplies as a prescribed feed.

## Open questions (for John)

- Is a transient, prescribed-feed passive diapir enough for M3, or should the next card add a salt source that keeps up?
- Should exposed salt dissolve (rate-limited loss to seawater)? Not modelled; it would break salt conservation unless booked as a sink.
- Bypass sheds only from a topographic high, tested on the seafloor at the start of the record step, split by slope (S3c; the earlier equal split to the two lower sides, and shedding from any exposed column, are gone).
- Roof thinning is a tuned rule (`shed`), not physics; it is off by default and labelled as such.

## S3b: per-crest log on the M3.10 start (card t_575d9327)

What changed
- engine.js: the starting salt now uses initialSaltThickness(P, x), the same arithmetic as src/engine/salt.ts (pinch-out smoothstep, then the M3.10 basinward limit smoothstep, P.saltLimit). Default limit [2e6, 2.5e6] lies beyond any section, so older runs are unchanged. gulf.js sets saltLimit [200 km, 240 km]. test.js section 7 checks the spike against main's function (loaded through vite) at every column, worst difference 0.
- engine.js: P.rhoSalt overrides the salt density (default 2160) for the density tests.
- crestlog.js: finds crests (salt-top maxima, prominence 100 m (tuned), cover under 500 m), follows them until buried (cover over 500 m for 3 steps) and records F (crest rise), A (flank rise), dips, neighbour salt at +-1/5/10 km, L/h, roof-thickness ratios. D (dissolution) is 0: the spike has none. Hand-calculation test in test.js section 8.
- s3b.js: `gulf`, `sweep`, `ulp` modes. ulp.js: plain-JS copy of the 1 ulp noise helper. qc.js: equal-density null and GL24-like run. s4case.js writes s4-case.json for S4.

Results (from `node test.js`, ALL PASS, 50 checks, about 45 s on Windows). The Gulf, six-ulp and sweep lines of the first S3b write-up were produced with the bypass rule that S3c then fixed; they were wrong (the exposed crests were holes in the seafloor) and are replaced by the S3c results below.
- Equal-density null: max salt change 9e-13 m. Control (cover 2600 vs salt 2160 + 440 contrast): 77 m.
- GL24-like (2 km source, level seafloor rising 200 m/Myr): the thin sheet keeps the crest 265 m below the surface and rising at 204 m/Myr for 20 to 50 Myr, so it keeps pace. With 1e19 salt, or 400 m/Myr, it does not (rise 33 and 6 m/Myr). The source drains by 3 Myr (peak salt 12.5 km), so the "thick source" is a one-off pulse, a thin-sheet limit; S4 should compare against s4-case.json.
- Mass balance everywhere: salt under 1e-13, sand and mud under 1e-13, zero clips.

## S3c: bypass rule fixed (SALT-R1 S3-1, S3-2)

The S3b exposed-salt bypass rule shed sediment from any exposed column to lower neighbours, tested on the seafloor after the substep own deposit. That made seafloor holes that lasted tens of Myr, and the S3b "exposed for 27 Myr" crests were such holes. S3c sheds only from a topographic high, tested on the seafloor at the start of the record step (st.H0), split by slope. Test 12 is a pit census (the old code fails it at 7 of 8 marks, Windows); test 13 checks the rule by hand. The crest log now has F_near/A_near (rate while near) beside the burial-window rates (S3-2). s3c-pool.js pools crest CSVs; gulf-crests.csv is the Windows S3c Gulf run. Nothing is ported to src/engine.

### S3c results: the Gulf case after the fix (S3d, card t_a8e959ff; reruns checked against SALT-R2 section 4)

Platforms: WIN = Windows, node 26.7.0. LIN = Linux (WSL Ubuntu), node 22.23.3. Medians, because single-crest outcomes are noise-sensitive (D16.4). "Exposed then buried" counts exposed crests that were later buried (the set the F and A medians are taken over).

| run set | crests | exposed | exposed then buried | exposure median / longest (Myr) | F_near / A_near / F-A median (m/Myr) | neighbour salt at 10 km, median (m) |
|---|---|---|---|---|---|---|
| WIN plain Gulf (1 run) | 12 | 6 | 5 | 4.4 / 12.1 | -38 / +1 / -33 | 4,849 |
| LIN plain Gulf (1 run) | 11 | 5 | 4 | 8.7 / 12.9 | -37 / -5 / -33 | 4,361 |
| WIN six 1-ulp runs | 73 | 30 | 23 | 5.4 / 16.0 | -36 / -3 / -32 | 4,436 |
| LIN six 1-ulp runs | 73 | 32 | 26 | 4.7 / 16.2 | -37 / 0 / -33 | 4,508 |
| **pooled, 14 runs, both platforms** | **169** | **73** | **58** | **4.8 / 16.2 (55 of the 73 over 3 Myr)** | **-37 / -1 / -33** | **4,499 (14,760 ft)** |
| WIN 16-run sweep (150 km strip) | 18 | 9 | 7 | 2.0 / 4.4 | 0 / +172 / -115 | 1,911 |
| LIN 16-run sweep | 18 | 9 | 7 | 1.9 / 4.4 | +2 / +171 / -115 | 1,902 |
| pooled sweep, both platforms | 36 | 18 | 14 | 2.0 / 4.4 (6 of 18 over 3 Myr) | +1 / +172 / -115 | 1,906 |

Before the fix (Windows, the old README): exposed 1 to 48 Myr, median 24; F-A at burial -382 to -57 m/Myr; 25 of 36 sweep crests exposed. After: median 4.8 Myr, at most 16.2 Myr; F-A about -33 m/Myr; 18 of 36 sweep crests exposed, for 1 to 4.4 Myr. WIN and LIN agree on the pooled medians within 1 m/Myr (F-A) and 1 Myr (exposure). The two plain Gulf runs differ in median exposure (4.4 against 8.7 Myr) because each has only 5 or 6 exposed crests: do not read either alone. Mass balance in the plain Gulf runs: salt 3.6e-15, sand -2.2e-14, mud -9.5e-15 (WIN); salt -1.8e-16, sand -8.7e-15, mud -1.6e-14 (LIN); zero clips.

Comparison with SALT-R2 section 4 (its own pooling of the same runs, `docs/reviews/salt-evidence-recheck.md`): every figure in the table matches, including the pooled row, with no difference to explain. The one number that is not the same is not in this table: SALT-R2 quotes the longest run over the allowance as 5 records (WIN) and 8 records (LIN) from its own census, which uses its own allowance (the larger seafloor gain of either neighbour over the record step). Test 12 uses the allowance it always had (the bulk thickness of the newest layer on either neighbour) and measures a longest run of 1 record on both platforms. The two censuses agree on the deepest pit (61 m WIN, 51 m LIN) and on the split in the next section. Both say the same thing: no hole.

What the rates say. A typical exposed crest has its salt top falling by about 37 m/Myr (120 ft/Myr) while the flank seafloor is about flat (A is about -1 m/Myr), so the crest loses about 33 m/Myr (108 ft/Myr) relative to a flat flank. It is not buried by the flank aggrading, and it is not buried because the source ran out: the neighbours still hold about 4,500 m (14,760 ft) of salt at 10 km. "Burial by flank aggradation", the phrase in the first S3b write-up, does not describe this model. Exposure is not rare: 73 of 169 crests were exposed, median 4.8 Myr, up to 16.2 Myr. The model has no dissolution sink (D = 0, QC 13): wherever salt is exposed here, the salt that a real exposed crest would lose to seawater is not removed, and the exposure times above are for that case.

Where exposed columns sit (SALT-R2 N-2; test 12, every record). Exposed columns mostly sit on slopes, not on highs, because the rule sheds only from a high and so keeps (or never receives) what lands on a slope. Exposed column-records (a column exposed at one 0.1 Myr record) split by seafloor position against the two nearest non-exposed neighbours:

| platform | exposed column-records | below both | mixed (slope) | above both |
|---|---|---|---|---|
| WIN | 1,447 | 215 | 1,216 | 16 |
| LIN | 1,502 | 293 | 1,202 | 7 |

A reader should not picture an exposed crest as a high standing above its flanks.

Test 12 (SALT-R2 N-1) now runs the census at every 0.1 Myr record, not only at the 8 marks, and asserts that no exposed column stays over its one-record allowance for more than 10 successive records and that no exposed column is more than 100 m (328 ft) below its lower non-exposed neighbour. Measured after the fix: longest run 1 record and deepest pit 61 m (200 ft) on WIN; longest run 1 record and deepest pit 51 m (168 ft) on LIN. The old engine (branch `strata-lab/salt-r1-review`, new `test.js` copied in, run on Windows) fails both assertions: longest run 295 records (29.5 Myr), deepest pit 1,573 m (5,161 ft), 5,354 exposed column-records of which 3,487 were below both neighbours and 53 above both. (Test 13 then throws on the old engine because `st.H0` does not exist; expected.) The census prints, but does not assert, the number of exposed column-marks at the 8 marks (12 WIN, 15 LIN): a count that small is platform-dependent and a test must not stand on it (D16.4).

The S3 question after the fix. The question: is exposed salt buried within a few Myr while the 4 km source is thick a thin-sheet limit, or geology? Answer: more likely a thin-sheet limit in the model, with medium confidence (SALT-R2 section 5; down from medium-high). The 27 Myr exposure was a bug (high confidence, measured). The fixed model exposes crests for a median of 4.8 Myr (up to 16.2 Myr) and then buries them by a steady fall of the salt top relative to the flank, under about 4,500 m of neighbouring salt, and that is the thing a thin sheet is least able to hold up; no published burial case has a thick source behind it (VJ92b pp. 364-365; HJ07 p. 24, from the salt-review notes). Two things keep the confidence at medium. The spike 004 Stokes comparison used a start section and a crest (id 21) from the pre-fix run that no longer exist, and has not been rerun on the fixed model; and neither solver has a frictional or faulted roof (Fernandez and Kaus 2015, as cited by GL24 p. 631, disagree with GL24 Fig. 10a). What would change the answer: a Stokes run from a fixed start section that keeps the crest at the surface for more than about 5 Myr, or a Stokes crest that also falls at about 30 m/Myr relative to the flank (which would point to geology, not the thin sheet). S4b (card t_4cfa925f) has since run that Stokes check from a section cut from the fixed spike at about 24.9 Myr: Stokes never exposes the crest (at least 138 m, 453 ft, of cover up to the thin-sheet burial) and does not show the 30 m/Myr fall, so the answer is now a thin-sheet limit with medium-to-high confidence. See `spikes/004-stokes-check/README.md` (S4b section) and `docs/reviews/salt-r3-check.md` section 4. The sentence above about spike 004 using the pre-fix start section describes S4 only.

### How to reproduce these numbers (exact command lines, run from `spikes/003-passive-diapir/`)

```
node test.js                                   # 50 checks, ALL PASS (WIN and LIN); prints the test 12 census
SCRATCH=<dir> node s3b.js gulf                 # plain Gulf run, writes <dir>/gulf-crests.csv
SCRATCH=<dir> node s3b.js ulp                  # six 1-ulp runs, writes <dir>/ulp-crests.csv
SCRATCH=<dir> node s3b.js sweep                # 16-run sweep, writes <dir>/sweep-crests.csv
node s3c-pool.js WIN-gulf=gulf-crests.csv LIN-gulf=gulf-crests-linux.csv WIN-ulp=ulp-crests-windows.csv LIN-ulp=ulp-crests-linux.csv
node s3c-pool.js WIN-sweep=sweep-crests-windows.csv LIN-sweep=sweep-crests-linux.csv
```

The second `s3c-pool.js` command prints the four 14-run rows and the pooled row of the table; the third prints the sweep rows. Its output is saved in `pooled-s3d.txt`. Each CSV records its platform and node version in its first line. Run on WIN with node 26.7.0 and on LIN with node 22.23.3. The CSVs are named by platform: `gulf-crests.csv` (WIN) and `gulf-crests-linux.csv`; `ulp-crests-windows.csv` and `ulp-crests-linux.csv`; `sweep-crests-windows.csv` and `sweep-crests-linux.csv`. They are the files the commands above write, renamed. `s3c-pool.js` reports medians and counts only from the crests it is given; a different noise realisation (another node version or platform) will move single crests, and the pooled medians by about the amounts in the WIN and LIN rows.
