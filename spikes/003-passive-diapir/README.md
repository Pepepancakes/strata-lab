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
  side whose seafloor is lower or level (no uphill shedding). Sand and mud are moved separately, so each is conserved.
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
- Bypass shares sediment equally to the two lower sides. Real sediment would follow the slope; a gradient-weighted split is a small change.
- Roof thinning is a tuned rule (`shed`), not physics; it is off by default and labelled as such.

## S3b: per-crest log on the M3.10 start (card t_575d9327)

What changed
- engine.js: the starting salt now uses initialSaltThickness(P, x), the same arithmetic as src/engine/salt.ts (pinch-out smoothstep, then the M3.10 basinward limit smoothstep, P.saltLimit). Default limit [2e6, 2.5e6] lies beyond any section, so older runs are unchanged. gulf.js sets saltLimit [200 km, 240 km]. test.js section 7 checks the spike against main's function (loaded through vite) at every column, worst difference 0.
- engine.js: P.rhoSalt overrides the salt density (default 2160) for the density tests.
- crestlog.js: finds crests (salt-top maxima, prominence 100 m (tuned), cover under 500 m), follows them until buried (cover over 500 m for 3 steps) and records F (crest rise), A (flank rise), dips, neighbour salt at +-1/5/10 km, L/h, roof-thickness ratios. D (dissolution) is 0: the spike has none. Hand-calculation test in test.js section 8.
- s3b.js: `gulf`, `sweep`, `ulp` modes. ulp.js: plain-JS copy of the 1 ulp noise helper. qc.js: equal-density null and GL24-like run. s4case.js writes s4-case.json for S4.

Results (all from `node test.js`, ALL PASS, 43 checks, about 40 s)
- Equal-density null: max salt change 9e-13 m. Control (cover 2600 vs salt 2160 + 440 contrast): 77 m.
- Gulf start: 17 crests, 10 exposed (9 interior, 1 toe), 8 buried. Exposed 1 to 48 Myr (median 24). At burial F-A is -382 to -57 m/Myr (crest loses against the flank), neighbouring salt is thick (2900 to 4300 m at +-10 km, all 8 classed thick). Burial is by flank aggradation, not by source depletion.
- Six 1 ulp runs: 13 to 16 crests, 7 to 10 exposed, 6 to 9 buried; exposed duration medians 22 to 25 Myr. Count of exposed crests varies by up to 3, so single-crest outcomes are noise-sensitive, medians are not.
- 16-run sweep (supply, salt, viscosity, cover; 150 km strip, my choice, S3's strip was not recorded): 36 crests, 25 exposed, 22 buried, 21 with F-A < 0; 15 thick / 4 mid / 3 depleted neighbours.
- GL24-like (2 km source, level seafloor rising 200 m/Myr): the thin sheet keeps the crest 265 m below the surface and rising at 204 m/Myr for 20 to 50 Myr, so it keeps pace. With 1e19 salt, or 400 m/Myr, it does not (rise 33 and 6 m/Myr). The source drains by 3 Myr (peak salt 12.5 km), so the "thick source" is a one-off pulse, a thin-sheet limit; S4 should compare against s4-case.json.
- Mass balance everywhere: salt under 1e-13, sand and mud under 1e-13, zero clips.
