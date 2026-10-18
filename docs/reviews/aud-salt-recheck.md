# AUD-4: salt re-check of the Gulf preset after the Gulf compaction change (D26.4)

Reviewer: salt-reviewer profile, 2026-10-17. Branch `strata-lab/aud-04-salt-recheck` = `strata-lab/aud-03-gulf-compaction` (HEAD 17338d9) merged at f75b941. Under review: the Gulf preset as AUD-3 left it (Hart, Flemings and Deshpande 1995 mud), its tests, and the documents that describe it. I changed no code. Own scripts (they run the engine through `createEngine` / `step` only and recompute every judged quantity with their own code): `scripts/review/aud-04.mjs` (welds, highs and prominence, the 20 km rule, wavelength by own DFT, salt front and pile, mass balance from own sums, largest u/L, crest-log rates F and A by own least squares), `aud-04-front.mjs` (the salt toe through time and at the end), `aud-04-toe.mjs` (toe episode per run), `aud-04-browser.mjs` (the built file in headless Chrome).

Platforms: WIN = Windows 11, node 26.7.0. LIN = Linux WSL Ubuntu, node 22.23.3, clean clone of this branch. "Before" = commit b836550 (AUD-2 tip, North Sea mud), run with the same script in a detached worktree on WIN. Seven runs per platform: plain and 1 ulp noise salts 3, 5, 7, 11, 13, 17 (D16.4); medians over the seven unless a single run is named. Units for John: 1,000 m = 3,281 ft; 25 m/Myr = 82 ft/Myr.

Gates on this branch: WIN `npm ci`, `npm run check`: main 46 files / 522 passed, 1 skipped; wallclock 6 files / 89 passed, 1 skipped; `npm run build` OK. LIN clean clone `CI=true npm run check`: exit 0; main 46 files / 522 passed, 1 skipped; wallclock 6 files / 82 passed, 8 skipped. Built file in Chrome: 0 console errors, 0 external requests.

## 1. Short answer

- **AUD-3's numbers reproduce.** Every number in the AUD-3 handoff, D26.4, physics-references and the user guide that I could measure comes out the same within the noise spread, on both platforms (table in section 2). The physics change is a cited one and nothing was tuned back.
- **But the salt story changed in a way nobody wrote down, and the docs now say the opposite of what the built file shows.** With the Hart mud the salt that flows past its basinward limit no longer tapers out under 1.3 to 5.6 km of cover. It builds a blunt wall 6.2 to 6.7 km thick (20,000 to 22,000 ft) whose top is **bare at the seafloor** over the last 3 to 5 km before the front, with a 1,270 m (4,170 ft) step in the seafloor at the front, and it has been bare since about 21 Ma at the front (the crest log follows the toe as a crest exposed for 44 to 57 Myr). This is so in all 14 runs (7 WIN, 7 LIN) and in the built file in Chrome, where the "?" marker sits on it at the end of the run with the tooltip "still near the surface at the end of the run". The user guide (14.5, 14.7), physics-references (M3b numbers) and the roadmap say there is no salt near the seafloor in any run, that every crest is buried, and that there are no markers at the end of a run. That is BLOCKING (F-1), as documentation: the built file and the docs disagree on the one thing a salt reader looks for first.
- **D18 targets:** welds met (thinner, as reported); the shallow-crest target is not met and was dropped by John (D26.4), which I accept. The statement "no salt high within 2 km of the seafloor in any run" is true **by the letter only**: the 20 km exclusion from the salt front hides the exposed toe.
- **Crest character changed:** the crests are no longer "ripples on a flat slab". Landward of the limit the salt is thinned to 0.5 to 1.3 km with real highs (2.8 km of prominence) under 4.5 km or more of cover; beyond 250 km the slab has no ripples at all, only the one smooth rise to the exposed toe.
- Mass balance, `saltClip`, `saltLimited` and the overburden-cap count are as AUD-3 reported (section 4). The UI-2 crest list works in the built file (section 6).
- Seven NON-BLOCKING items, all documentation (section 7). One doc line fixed by me (section 7, F-3).

## 2. Before and after, own measurements

Medians over 7 runs per platform; the range in brackets. "AUD-3 says" quotes the handoff, D26.4, physics-references or the user guide.

| Quantity | Before (WIN, North Sea mud) | After WIN (Hart mud) | After LIN (Hart mud) | AUD-3 says | Match |
|---|---|---|---|---|---|
| Weld total, km | 15.0 [12 to 20] | 8.0 [6 to 11] | 8.0 [6 to 12] | 16 -> 8.5 WIN, 7.5 LIN (4 runs); 8 to 11 / 6 to 8 | yes |
| Longest weld run, km | 3 [3 to 4] | 2 [2 to 3] | 2 [2 to 3] | 3 -> 2, runs of 2 to 3 | yes |
| Weld runs of 2 km or more | 6 [4 to 7] | 2 [1 to 3] | 2 [1 to 5] | 1 to 3 | yes |
| Thinnest salt left in a weld column, m | - | 43 (plain) | - | "a few tens of metres" | yes |
| Crests under 2 km of cover, 20 km rule (D18) | 4 [2 to 5] | 0 in every run | 0 in every run | 4 -> 0 in every run | yes |
| Least cover on any high inside the 20 km rule, m | 1,355 [1,291 to 1,611] | 4,651 [4,553 to 5,166] | 4,628 [4,567 to 4,810] | not stated | - |
| Salt front (last column over 100 m), km | 355.5 [344.5 to 355.5] | 337.5 [336.5 to 340.5] | 339.5 [337.5 to 342.5] | "about 100 km past its limit, about 60 km short of the edge" (guide); "about 115 km past its limit" (preset note) | guide yes; preset note no (F-4) |
| Thickest salt beyond 250 km, m (times the 4 km start) | 5,014 (1.25) | 6,401 (1.60) [6,273 to 6,581] | 6,381 (1.60) [6,312 to 6,681] | 6.4 to 6.6 km, 1.6 times | yes (one LIN run 6.7) |
| Cover on that thickest column, m | 1,358 | 0 in every run | 0 in every run | **not stated** | F-1 |
| Seafloor step at the front, plain run, m | 11 | 1,270 (4,170 ft) | not probed | **not stated** | F-1 |
| Dominant wavelength 20 to 120 km, km (own DFT) | 13.5 [13.2 to 14.1] | 10.9 [10.4 to 12.3] | 11.0 [9.9 to 13.3] | 10.4 to 12.3 (WIN) | yes; LIN reaches 9.9 and 13.3 |
| Shelf edge at the end, km | 218.5 | 210.5 [205.5 to 214.5] | 207.5 [206.5 to 210.5] | 212 / 208 | yes |
| Shelf edge at 56 Ma, km | 120.5 | 97 [96.5 to 98.5] | 97.5 [96.5 to 98.5] | - | - |
| Shoreline at the end, km (plain) | - | 89.5 | - | guide 14.5: "over 200 km" | no (F-3) |
| Overburden-cap count (`clamps`) | 14.6k [4.9k to 18.7k] | 34.6k [22.8k to 63.0k] | 46.0k [20.9k to 57.2k] | 15.6k -> 36.1k WIN, 48.2k LIN | yes |
| Largest u/L at the end | 1.000 | 1.000 (0.992 in one run) | 1.000 | 1.000 | yes |
| Cells at the cap at the end (of about 430k sediment cells) | 59 to 440 | 0 to 749 | 87 to 959 | - | - |
| Salt balance, own sums against the ledger, relative | 6.1e-15 | 6.7e-15 at most | 7.4e-15 at most | "about 1e-14, nothing clipped" | yes (1e-12 asked) |
| Sand / mud balance, relative, at most | 6.8e-14 / 2.6e-14 | 7.6e-14 / 2.6e-14 | 6.7e-14 / 3.2e-14 | - | fine |
| `saltClip` | 0 | 0 | 0 | 0 | yes |
| `saltLimited` (count; thickest cell it acted on) | 200k to 334k; - | 159k to 337k; 5.8 m | 156k to 342k; - | - | acts near zero, as designed |
| Crest-log episodes per run | 13 [12 to 15], all buried | 16 [16 to 18]: 15 buried + **1 "run end"** in every run | 16 [16 to 17]: same | "16 to 18, every one ended by burial"; "16 buried crests" | **no** (F-1) |
| Episodes with time at the seafloor | 1 per run (about 250 km, 4 to 15 Myr, then buried) | 2 to 3 per run; the toe 44 to 54 Myr, still exposed at the end | 2 to 3; toe 48 to 57 Myr | not stated | F-1 |
| Median F - A, all crests, near window | -70.6 m/Myr (-232 ft/Myr), 95 crests | -84.5 m/Myr (-277 ft/Myr), 114 crests | -84.5 (-277 ft/Myr), 113 crests | -84.5 / -277 both platforms | yes, to the digit |
| Median A | 109.5 m/Myr (359 ft/Myr) | 74.8 (245 ft/Myr) | 75.8 (249 ft/Myr) | 74.8 / 75.8 | yes, to the digit |
| Labels tabular / tapered / unresolved | 1 / 63 / 22 | 2 / 97 / 15 | 3 / 100 / 10 | 2/97/15, 3/100/10 | yes, to the digit |
| Own least-squares F and A against the app's | 0.0 difference, 0 label changes | 0.0, 0 | 0.0, 0 | - | the app's slopes are right |
| Chrome, built file, plain run: crests, labels, median F - A | - | 16; 0 / 14 / 2; -243 ft/Myr; A 246 ft/Myr | - | 16, 14 tapered, 2 unresolved, -243 | yes |
| Crest 5 (km 187.5) F, A, F - A, L/h, salt beside (WIN plain) | - | 15.7 / 45.9 / -30.2 m/Myr = 51 / 151 / -99 ft/Myr; 12.0; 5,561 m | - | guide 14.7 worked example: 51 / 150 / -99; 12; 5,560 m | yes |

The AUD-3 wording "16 to 18 episodes, every one ended by burial" and the roadmap's "16 buried crests" count the toe episode as buried. It is not: its `endReason` is "run end" in the app's own log, in all 14 runs and in the Chrome CSV (`end_reason` "run end", crest 14).

## 3. The toe: what changed and why it matters (F-1)

**Before (North Sea mud, WIN plain, own probe `aud-04-front.mjs`).** Beyond 250 km the salt thinned basinward from 4.6 km at 300 km to 160 m at the front (355 km), under 1.6 to 5.6 km of cover. The least cover on the thickest column was 1,358 m. The seafloor at the front stepped 11 m. One crest near 250 km was at the seafloor for 4 to 15 Myr and was then buried; every episode ended "buried".

**After (Hart mud, WIN plain).** Beyond 250 km the salt rises smoothly from 3.2 km at 255 km to 6.58 km at 335.5 km, and the cover thins with it: 579 m at 300 km, 260 m at 315 km, 54 m at 327 km, 2 m at 331 km, 0 m from 333 to 335.5 km. The salt top there **is** the seafloor, in 1,003 m of water, and one column further on (337.5 km, 17 m of salt) the seafloor is at 2,273 m: a step of 1,270 m (4,170 ft) over 1 km. The front stopped moving at about 18 Ma; the cover on the thickest column reached zero at 21.2 Ma and stayed there. The crest log follows this toe as crest 14 (first seen at 222.5 km at 64.2 Ma, bare since about 55 Ma, 48.4 Myr at the seafloor, "run end", label unresolved on WIN plain; the label is tabular, tapered or unresolved depending on the run, as a single crest should be read, D16.4). The same geometry (0 m of cover over 333 to 335 km, 6.2 to 6.7 km of salt, a toe episode at the seafloor for 44 to 57 Myr ending "run end") is in all 7 WIN and all 7 LIN runs; `aud-04-toe.mjs` lists them.

**In the built file (Chrome, WIN, plain run).** The section shows the pink salt reaching the seafloor from about 300 km to the front and a vertical salt face at 336 km with the seafloor dropping beside it (screenshot `toe-1920x1080@1.png` in the scratch output, not committed). The "?" marker of crest 14 is drawn at 335.5 km at the end of the run, with the tooltip "Crest 14, unresolved, x 335.5 km; 64.20 to 0.00 Ma; ... still near the surface at the end of the run". The pseudo-well placed at the toe reports "Salt from 4,573 to 24,865 ft (20,292 ft thick)"; read against the water depth that is a few hundred metres of cover on 6.2 km of salt, so in Chrome the toe column keeps a thin veneer where node 26 and node 22 have none: the exact cover at one column moves with the maths library, the wall and the marker do not.

**Why the toe exposes now (my reading, not measured):** the stiffer Hart mud (phi0 0.40 instead of 0.63) is denser at every depth, so the same cover pushes harder on the salt, more salt is driven past the limit (salt beyond 250 km 465 km2 against 409 km2 before, salt landward of 200 km 126 against 156 km2), and it inflates at the front where the deep-basin supply is starved (tcMax 0.1). The inflated top rises into the slope, the transport scheme strips the thin cover off the high, and the model has no process that removes or spreads bare salt (no dissolution, no extrusion, no canopy: user guide 14.6), so the wall stays. A limit the model owns, not a result.

**Against the literature (docs/salt-literature.md v2 and docs/salt-notes/, branch `strata-lab/lit-04b-recheck`).**
- Distal inflation at a salt pinch-out is a published behaviour, in a scaled physical model: Vendeville 2005, p. 1078 and Fig. 6D-F, distal salt inflated and extruded beyond the original pinch-out once the cover blocks abutted it (physical model, scaled; the note on that paper, item 2 of its "checks for Strata Lab", asked exactly this question of the M3.10 edge). In the Gulf interpretation of Hudec et al. 2013b, p. 1704 (interpretation, not a measurement), salt that flowed up the ramp was buttressed by sediment aggrading in front of it; where supply was low it stopped and was buried in place, where supply was larger it inflated. So a thick salt mass at the basinward front is not foreign to the Gulf story.
- Bare salt that stays bare for 50 Myr with no sink is not in any source. Net rise is F minus D (Vendeville and Jackson 1992a p. 347; Hudec and Jackson 2007 p. 11): the model has D = 0. Checklist item 13 of docs/salt-literature.md section 11 ("Is the missing dissolution sink named wherever salt stays exposed?") now fails for the Gulf preset: nothing in the docs says the toe is exposed, so nothing names the sink. Benchmark row 46 (dissolution up to a few m/Myr, from an abstract only) would remove only tens to a few hundred metres in 50 Myr against a 6.5 km wall, so dissolution alone would not bury it; spreading (extrusion) would. Labelled judgement.
- A seafloor escarpment at the front of Gulf salt exists in nature (the Sigsbee Escarpment, which HJS09 Fig. 2 uses as the southern bound of the minibasin province and the canopy), but that is the toe of an allochthonous canopy advancing over younger sediment, with a sediment veneer, which this model cannot make (14.6). I have no source in the notes for its relief, so I give no number. Own knowledge, not from the read sources: its relief is of the order of 1 km. Treat as unchecked.
- My judgement: the exposed wall is a thin-sheet-plus-closed-form limit at the toe (no extrusion, no dissolution, salt not eroded), not a geological result, and it should be labelled so. It is not an argument to add salt, change the limit or widen the section to keep or lose it (John, 2026-10-16).

**The "no pile" test.** `tests/gulfPreset.test.ts` widened its band from 1.5 to 2 times the start thickness after measuring 1.6 (commit 9192f37), and the docs say so. That is the honest way to report a measured move. But the test is still named "no pile", and what it now passes is a 6.4 km pile at the salt's own front, bare at the top. The comment should say what the pile is (NON-BLOCKING, F-5). It is for John, not me, to say whether a bare 6.5 km salt wall with a 4,000 ft escarpment is an acceptable teaching picture; my recommendation is in section 9.

## 4. Mass balance, limiter, cap count (card item 3)

- Salt: my own sums of the salt cells at the start and end against the ledger's cumulative in and out: relative difference at most 6.7e-15 (WIN) and 7.4e-15 (LIN) over 14 runs, against the 1e-12 asked. 660.0 km2 of salt at the start and at the end. Sand 7.6e-14 and mud 3.2e-14 at most. The ledger's supply total equals supply x duration (1,848.0 km2) and the sand share equals `sandFrac` 0.350 in every run. `saltClip` 0 in all 14 runs.
- `saltLimited` (the non-negative limiter in `salt.ts`): 156k to 342k face-flux limits per run, about 1e5 m2 of flux held back in all, and the thickest cell it ever acted on was 5.8 m, so it acts only at the pinch-outs, as the header of `salt.ts` says it should. Before AUD-3: 200k to 334k. No change of kind.
- Overburden cap (F-3 of the audit): 34.6k (WIN) and 46.0k (LIN) cells held at the overburden over a run, medians of 7, against 14.6k before (WIN); AUD-3's 36.1k / 48.2k are inside my spread. At the end of a run 0 to 959 cells sit at the cap (u/L = 1.000) out of about 430k sediment cells. Not reduced, not tuned, named in the handoff: for AUD-6 and F-3b, as AUD-3 said. The Hart mud makes the cap bite harder (denser, less porous mud holds pressure); that is the expected direction.

## 5. D18 targets and crest character (card item 2)

- **Welds (2 km or more under 100 m):** met in every run on both platforms (longest 2 to 3 km, total 6 to 12 km). Thinner than before (15 km). The test asks 5 km total and one run of 2 km; the thinnest run in my 14 was 6 km. Fine, but the band sits close to the LIN low of 6 km.
- **Crests within 2 km of the seafloor, 20 km rule:** 0 in all 14 runs; before, 2 to 5. Not met; dropped as a measured result by John (D26.4, D27.1). I accept the decision. By the letter, true. By the spirit, the preset now has salt at the seafloor for 50 Myr, 100 km past its limit, where the 20 km rule does not look.
- **Wedge progrades:** shelf edge 97 km at 56 Ma to 206 to 215 km at the end, on both platforms. Met.
- **Character.** Before: a flat 4 to 5 km slab beyond 250 km with 300 to 850 m ripples under 1.3 to 2.3 km of cover (the M3.12 reading, which I confirm with my prominence function: six highs beyond 250 km in the plain run, prominence 304 to 850 m on 4.1 to 4.8 km of salt). After: beyond 250 km there is exactly one high per run, the toe itself (prominence equals thickness, 6.2 to 6.7 km); landward the salt is thinned to 0.5 to 1.3 km with 12 to 14 highs of 300 m or more, 12 to 13 minibasins, and the shallowest high inside the 20 km rule is at 40.5 km with 2.8 km of prominence on 2.8 km of salt under 4.5 to 5.2 km (14,900 to 16,900 ft) of cover. So the crests are no longer ripples on a slab: they are real but deeply buried highs, and the one shallow feature is the exposed wall. The docs' sentence "the earlier crests were ripples on that pile" is right about the old crests and says nothing about the new picture.
- Wavelength 10 to 12 km on WIN, 9.9 to 13.3 km on LIN; the test band is 8 to 25. The user guide (14.6, last bullet) still says 13 to 14 km (F-6).

## 6. Crest list in the built file (card item 5)

`aud-04-browser.mjs`, built file from file://, headless Chrome, Gulf preset, five screens (CSS viewport = screen / scale minus 130 px):

| Screen | Viewport | Section top-bottom | Crest panel top-bottom | Table top | Page scroll width | Markers at the end | Row click |
|---|---|---|---|---|---|---|---|
| 1920 x 1080, 100 % | 1920 x 950 | 74 to 434 | 45 to 835 | 127 | 1,905 (no horizontal scroll) | 1 (crest 14, "?", 335.5 km) | crest 1 selected; pseudo-well 70 km -> 22 km; time 64.30 Ma |
| 1920 x 1080, 125 % | 1536 x 734 | 74 to 434 | 45 to 835 | 127 | 1,521 | 1 | same, well 185 -> 22 km |
| 1920 x 1080, 150 % | 1280 x 590 | 142 to 502 | 45 to 835 | 127 | 1,265 | 1 | same |
| 2560 x 1440, 125 % | 2048 x 1022 | 74 to 434 | 45 to 835 | 127 | 2,033 | 1 | same |
| 2560 x 1440, 150 % | 1707 x 830 | 74 to 434 | 45 to 835 | 127 | 1,692 | 1 | same |

The list sits beside the section on every screen; the table top and the section are on screen together (at 150 % on 1920 x 1080 the panel runs below the fold but the list scrolls in its own box). A row click selects the row, moves the pseudo-well to the crest's column (21.5 km shown as 22 km) and the time to the crest's last record, and the crest card fills (crest 1: 21.5 km, 65.90 / 64.30 Ma, F - A -74 ft/Myr, L/h 18.6, salt beside 884 ft, "buried at 64.40 Ma"). 16 rows, labels and F - A as in the CSV. The markers at 5.15 Ma: 1 (the toe). All as UI-2 intends. The only mismatch is with the guide's text that there are no markers at the end of a run (F-1).

## 7. Findings

**F-1 BLOCKING (documentation; no code change required by this review).** The Gulf docs say there is no salt near the seafloor and every crest is buried; the engine and the built file show a bare salt wall at the toe for the last 20 to 50 Myr, with its marker at the end of the run. Places: `docs/user-guide.md` 14.5 ("**no** salt highs with tops within 2 km of the seafloor ... in any run" and "The salt basin has its own end ... 6.4 to 6.6 km thick at most" with no word on the cover), 14.7 ("At the end of a run every crest is already buried, so there are no markers until you move back in time"); `docs/physics-references.md` M3b Gulf numbers ("every one ended by burial"); `docs/roadmap.md` AUD-3 line ("crest log 16 buried crests"); `docs/decisions.md` D26.4 outcome (silent on the toe); `src/engine/presets.ts` Gulf note (silent). Evidence: section 3; `aud-04-toe.mjs` on the 14 run files; Chrome marker and CSV `end_reason` "run end" for crest 14. Minimum fix: one honest paragraph in 14.5 (the toe is bare at the seafloor over the last 3 to 5 km before the front, 6.2 to 6.7 km of salt, a seafloor step of about 1,270 m / 4,170 ft in the plain run, bare since about 21 Ma at the front; the crest log carries it as one "run end" crest exposed for 44 to 57 Myr; in Chrome the toe column keeps a thin veneer), a limit bullet in 14.6 naming the missing sink and spreading (dissolution, extrusion, salt not eroded) as the reason it stays, "15 buried and 1 at the run end" in physics-references and the roadmap, the 14.7 sentence corrected ("the Gulf run ends with one crest still at the surface, the toe"), and a line in D26.4 that the toe became exposed with the Hart mud. Platform named on each number.

**F-2 NON-BLOCKING.** The D18 sentence "no salt high within 2 km of the seafloor in any run" should say it holds inside the 20 km rule and that the exposed toe is outside it. Minimum fix: add that clause in 14.5 and in the preset note.

**F-3 NON-BLOCKING, fixed by me.** `docs/user-guide.md` 14.5 said "the shoreline moves from about 54 km at 56 Ma to over 200 km near the end (checked by the tests)". The test checks the shelf edge, which is 97 km at 56 Ma and 206 to 215 km at the end; the shoreline itself ends near 90 km (WIN plain 89.5 km, own and app). I replaced the line with the measured shelf-edge numbers and the platform (one line).

**F-4 NON-BLOCKING.** `src/engine/presets.ts` Gulf note says the salt "flows about 115 km past its limit". Measured: 97 to 100 km (WIN front 336.5 to 340.5 km, LIN 337.5 to 342.5, limit end 240 km); 115 km was the North Sea value (before: 105 to 116 km). The user guide's "about 100 km" is right. Minimum fix: "about 100 km" in the note (src/, so not mine to edit).

**F-5 NON-BLOCKING.** `tests/gulfPreset.test.ts` "no pile" test: the band moved from 1.5 to 2 times the start and the comment gives the measured 1.6. It should also say that the 6.4 km beyond 250 km is the exposed toe wall, not a pile against the section edge (the test's original purpose, M3.9), so the next reader does not think the edge problem came back. Minimum fix: one comment line.

**F-6 NON-BLOCKING.** `docs/user-guide.md` 14.6 last bullet: "The structure width of about 13 to 14 km comes from the tuned cover viscosity" is the North Sea number; 14.5 already says 10 to 12 km (WIN). LIN gives 9.9 to 13.3 km. Minimum fix: "about 10 to 13 km".

**F-7 NON-BLOCKING.** physics-references M3b Gulf numbers: "16 to 18 episodes per run (16 plain on both)" is right; LIN gave 16 to 17 and WIN 16 to 18 in my runs. The label split, medians and the crest 5 example reproduce to the digit on both platforms, which is good evidence that the crest log is deterministic per platform. No fix beyond F-1's wording.

**F-8 NON-BLOCKING, note for AUD-6.** The weld band (5 km total) sits 1 km under the lowest LIN run (6 km) in my 14. Not near zero, but thin; if a later physics change moves welds again, report before re-banding.

## 8. Linux parity

The card's Linux parity script (clean clone of this branch, node 22.23.3; kept in the reviewer's scratch folder, not the repo): `CI=true npm run check` exit 0; wallclock project 6 files / 82 passed, 8 skipped; the main project's summary line scrolled out of the 60-line tail, so it was rerun alone (`vitest run --project main` on the same clone): 46 files / 522 passed, 1 skipped. My review script ran on the clone (`aud04-linux.json`, `aud04-linux.log` in scratch) and gave the LIN column of section 2.

## 9. Recommendation to John (no block raised; the review does not depend on it)

Whether a bare 6.5 km salt wall with a 4,000 ft escarpment at 335 km is an acceptable teaching picture for the Gulf preset is a product and geology call. My recommended answer: **keep it and label it** as a model limit (no dissolution, no extrusion or canopy, salt not eroded; cite Vendeville 2005 p. 1078 for distal inflation at a pinch-out as the part that is geology), do not retune the limit, the supply or the salt thickness to bury it, and let spike S3 / milestone M3b decide what to do with salt that reaches the seafloor, as D26.4 already says. Reason: the inflation is driven by a cited compaction change, the picture is reproducible on both platforms, and every alternative is a tuning step.

VERDICT: REQUEST CHANGES
