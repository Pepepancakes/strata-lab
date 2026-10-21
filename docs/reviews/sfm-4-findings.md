# SFM-4 review findings (independent integrity review of the SFM fix chain, a1eda7c..HEAD)

Scripts: scripts/review/sfm-fix/01..05 (and the older scripts/review/sfm/01..07). Numbers are Windows node 26 unless marked Linux node 22.

## Engine: no change requested
- Ledger closes per grain size, recomputed from the layer record: closure error about 1e-14 on every case (default, constant sea level, all mud, all sand, tcMax 0, closed wall, mtd, Gulf, short salt). cumEdge <= cumOut; with turbidites and failures off cumOut == cumEdge exactly; closed wall gives cumEdge 0. Rerun is bit-identical. (01-ledger)
- Mutation check: changing the outflow level in transport.ts makes 2 of the 9 openBoundary tests fail, so they bite.
- Default run exports 1.3 % of sand and 19 % of mud past the basinward edge (nx 400 section: 0.1 % and 1.8 %). Those are real losses, now booked; the section length matters (nx 150: 17 % of mud).
- npm run check: Windows 568 + 85 passed, 2 + 6 expected fail; Linux node 22 gated suite passed, 8 expected fail (the 2 extra are the documented itFailsOnLinux cases). Build OK; built file at 5 sizes: see 05-built-check output in the handoff.

## F-A (doc, REQUEST CHANGES) docs/user-guide.md:111
"averages under 5 % at highstand" is stated for both 40 m and 80 m swings. Measured (02-shelf-depth-sweep, steps at or above 0.8 x the highest sea level, shelfBreakDepth 50 m): 80 m = 0.7 %, 40 m = 8.8 %. tests/shelfEdge.test.ts only asserts the 80 m case. Say 80 m only, or give 40 m as about 9 %.

## F-B (doc, REQUEST CHANGES) docs/user-guide.md:112, docs/physics-references.md:546-549, tests/shelfEdge.test.ts:67,75
"the shelf fills within about 0.3 Myr". Measured (04-claims, constant sea level): shelf edge is within 2 km of the shoreline from 0.03 Myr and the turbidite share is at 0.9 x its cap from 0.055 Myr (Linux the same). 0.3 Myr is about 5 to 10 times too slow. The qualitative conclusion (bypass all run at constant sea level) is unaffected; the number is wrong.

## F-C (note, no change) shelfBreakDepth 50 m is "tuned" and is labelled so
Sweep 0..300 m: it moves the numbers (sine 40 m / 100 kyr highstand share 12.5 % at 0 m, 8.8 % at 50 m, 4.4 % at 150 m; sand beyond 100 km 7.1 -> 5.9 -> 5.0 %) but no SFM-R ordering flips except the 40 m "under 5 %" which fails at 50 m (F-A). The value was not what produced the shelf-edge result; keep the tuned label.

## F-D (note) Gulf bands over six noise salts and two platforms
Grid-agreement (dx 1000 vs 500) wavelength difference: Linux plain 0.32, noise 3/5/7 = 0.22/0.10/1.17 against a 0.15 band; Windows passes on the plain run. The edge fix and no-pile bands still fail with the open edge (it.fails, SFM-1 decision), so John needs to set new bands from the min/median/max tables in 03-gulf-bands output. This review does not change bands.
