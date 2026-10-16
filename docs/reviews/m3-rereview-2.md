# M3.12 integrity re-review 2 (salt basin edge fix M3.10, docs M3.11; branch tip c4c5ba3)

Role: integrity reviewer (geology, physics honesty, one-record rule, offline, licences). I reviewed only; no product
code was changed. Checks are my own scripts: `scripts/review/m3-rereview-2.mjs` (parts edge, crests, ulp, hash) and
`scripts/review/m3-rereview-2-browser.mjs`. Every feature measure (weld runs, crests, salt front, thickness table,
conservation) is written in the script from the raw record (salt thickness in layer 0, surface `rec.H`, basement
`rec.b`). Nothing is taken from `saltStructures.ts` or the salt physics. Screenshots are in the reviewer scratch
directory, not the repo. Main and the M3.9 branch were run in separate worktrees for the hash comparison.

## Findings

All findings are NON-BLOCKING. I found nothing that makes a number wrong, hides a failure, or breaks a house rule.

1. NON-BLOCKING. The registry and the physics doc say the Hudec et al. (2013) abstract describes salt that thins
   seaward. It does not. I read the abstract (AAPG Bulletin 97(10) 1683-1710, doi 10.1306/04011312073; the
   reference entry is correct and marked to verify). It says that the limit of normal oceanic crust coincides with a
   basement ramp near the seaward end of the salt basin, and that in places salt flowed seaward onto new oceanic
   crust. Both of those support the preset (a basin that ends, with salt spreading past its end). "Thins seaward"
   is not in it. Places: `src/engine/params.ts:208` ("where the salt thins seaward (Hudec et al. 2013, abstract
   read ...)") and `docs/physics-references.md:325` ("Hudec et al. (2013) describe, in the abstract, salt that thins
   seaward"). Minimum fix: delete that clause in both places. The reference stays "to verify".
2. NON-BLOCKING. The crests are called "ripples of the cover seed" (`src/engine/presets.ts:77` note,
   `docs/physics-references.md` M3.10 "Crests" bullet and M3.8 bullet, `docs/handover.md` "Crests", user guide 14.5).
   The seed attribution is not supported. With `coverUneven` 0 (no seeded unevenness) my count is still 5 crests
   within 2 km of the seafloor (275.5 to 318.5 km, relief 340 to 711 m, cover 1.58 to 1.99 km); with seeds 1, 3, 4
   it is 3, 3, 3. At M3.9 the same control gave 0. The crests are small highs on the advancing salt tongue; the seed
   moves where they are, not whether they exist. Minimum fix: say "ripples on a flat slab that also appear with the
   cover unevenness off", and drop "of the cover seed". The conclusion (not diapirs) is unchanged.
3. NON-BLOCKING. The flow limiter now acts in the Gulf run. At M3.9 `diag.saltLimited` was 0; now it is 333,553
   column-substeps, withholding 212 m2 in total (3e-7 of the 660 km2 of salt), at thicknesses up to 0.27 mm (I ran
   the same preset with the limit moved out to 2,000 km: 0, as before). That is the front advancing into salt-free
   columns, where the limiter's own design note (`src/engine/salt.ts:59`, "it should act only near zero
   thickness") applies, so it is not a physics problem, and conservation is 6e-15 with `saltClip` 0. But no doc
   says it, and anyone who compares with the M3.9 review ("limited 0") will think something broke. Minimum fix: one
   line in `docs/handover.md` "M3 state after M3.10".
4. NON-BLOCKING. `docs/physics-references.md:239-244` (M3.4 preset values: `coverThick` 1,000 m, `coverVisc` 3e20,
   `saltThick` 2,000 m, supply 22) and `:301-302` ("no welds", "none reaches the seafloor", 11 minibasins) still
   read as the current Gulf preset. They are the M3.4 draft and are replaced by the M3.8 and M3.10 sections lower
   down. M3.11 fixed these in the handover but not here. Minimum fix: prefix both with "M3.4 draft values, replaced
   in M3.8 and M3.10".
5. NON-BLOCKING. `saltLimitEnd` larger than `saltLimitStart` is a note, not a check (`src/engine/params.ts:209`
   "Must be larger", `src/engine/salt.ts:142`). With End below Start the taper's denominator is negative, `g` clamps
   to 0 and the limit silently does nothing; with End equal to Start it is a hard step. The landward pinch-out has the
   same property from before. Minimum fix: validate in the registry, or say so in the note.
6. NON-BLOCKING (cosmetic). In the built app a pseudo-well at 350 to 354 km of the Gulf end state reports "Salt from
   24,511 to 24,511 ft (0 ft thick)" with the salt colour and notes: a salt interval of under half a foot. Salt
   thinner than the display rounding should not produce an interval. Minimum fix: skip salt intervals under 1 ft in
   the well view, or leave and ignore.
7. NON-BLOCKING (information for the docs). The salt front is not the same in the browser as in Node. In Chrome the
   Gulf end state has 2,746 m of salt at 340 km and none at 346 and 348 km; my Node run has 2,012 to 2,124 m at 340
   km and 1.2 to 1.9 km at 346 to 348 km. That is the size of change the ulp runs show (front at 344.5 to 355.5 km
   across the 10 noise salts, 355.5 km plain; the docs say 355 km and "about 45 km short"), so it is consistent
   with last-digit sensitivity and not a bug (I did not prove the cause). Minimum fix: say "the salt front ends 35 to
   55 km short of the edge, and its place moves by about 10 km with the last digit", instead of one number.
8. NON-BLOCKING (plausibility, not new). The grain-size section shows two needle-thin spires at about 25 and 47 km,
   one to two columns wide, reaching 15,000 ft or more above the salt crest: older cover stretched over one-column
   salt crests. This is the "thin-sheet salt has no diapir width" limit already in the handover; it was there at
   M3.9. Not for this card.

## Previous findings (docs/reviews/m3-rereview.md)

1. D18 missing: FIXED. `docs/decisions.md:134` (D18 with John's targets, the 100 m weld label, S3/M3b deferral and
   what M3.8 reached).
2. S3, M3b, done-when, status line: FIXED. `docs/roadmap.md:3`, `:191`, S3 section `:228`, M3b `:243`.
3. Handover stale: FIXED for the handover (no "only one salt preset", "3e20", "has no weld" left in it; new "M3 state
   after M3.10"). The same stale statements remain in physics-references.md: see new finding 4.
4. Salt pile at the closed edge: FIXED by the edge fix (checks below). The crests are still not diapirs: ACCEPTED as
   recorded in D19.3, user guide 14.5 and 14.6, handover; marked for John (check 2). The 20 km assertion exists
   (`tests/gulfPreset.test.ts`, crest test and edge test).
5. Weld not robust: FIXED. D18.7, handover, user guide 14.5 ("where they are, and how long each run is, moves with a
   last-digit change"); the test asks for a band (total 8 km or more, a run of 2 km or more).
6. Missing 10 km table, ulp spread, speed table: FIXED. Handover "M3 state after M3.10" (the table matches my numbers).
7. Grid counts not converged: ACCEPTED. Written in the handover and user guide 14.5 (wavelength 1.3 % at 1,000 against
   500 m; counts and spacing not converged).
8. Step-0 pixel difference: ACCEPTED. Handover "Known limit", drawing only.
9. Wall-clock flakes: FIXED. Serial `wallclock` project (`vitest.config.ts`); three `npm run check` runs and one plain
   `npm run test:run` here passed (check 7). The handover says plain `test:run` is not isolated.
10. Short preset over-filled: FIXED as documentation: user guide 14.3 and the preset list call it a teaching toy.
11. Sources: FIXED. The 4 km salt is "tuned, no source" (`presets.ts:77`, handover); the old "upper end of Louann
    estimates" is withdrawn. The new limit values are tuned with a reference (see finding 1 for the one wrong
    clause).

## Check results

Check 1, edge fix (Gulf preset, dx 1,000 m, 400 columns, Node 26 Windows, 5.3 s):
- Salt thickness every 10 km at the end (m): 5:0 15:30 25:637 35:85 45:2778 55:1809 65:324 75:142 85:533 95:1799
  105:456 115:1792 125:669 135:782 145:569 155:1005 165:1650 175:1431 185:1102 195:955 205:749 215:553 225:1089
  235:2751 245:3838 255:4253 265:4791 275:4835 285:4787 295:4511 305:4566 315:4801 325:3609 335:2620 345:2013
  355:493 365:0 375:0 385:0 395:0. (M3.9 values run on this branch: 295:8094 ... 395:8575.)
- Start salt body 18.5 to 235.5 km; end salt body 18.5 to 355.5 km. Thickest salt beyond 250 km 5,002 m (1.25 times
  the 4 km start; M3.9 9,068 m). Salt within 20 km of the edge: 0 m (M3.9 9,068 m). Nothing past 358 km.
- Salt conserved: relative change -6.1e-15, `saltClip` 0. PASS. Salt front by age: 237 km at 60 Ma, 284 at 40 Ma, 331 at
  20 Ma, 346 at 10 Ma, 355.5 at 0 Ma.
- Wedge still progrades: shoreline 57.5 km at 56 Ma, 121.5 at 9.5 Ma, 215.5 at 0.6 Ma.
- `stateHash` on this branch against main: last3 cb22255b, mtd 9be1b3f3, miocene fa992a56, cenozoic ebd3965b: all
  identical. `saltshort` b9d410d6: identical to `strata-lab/m3-09-rereview`. `gulf` with the two limit parameters set
  back to their defaults has hash dae567c7, the same as the M3.9 branch's `gulf`; with the new values f2e2fd2c. So the
  default leaves every other run unchanged and the M3.9 preset is reproduced exactly.
- Salt-off speed on this machine, two runs each, ms: last3 1,866/1,986 here against 1,787/2,003 main; mtd 3,314/2,928
  against 3,323/2,828; miocene 3,003/2,952 against 3,059/2,891; cenozoic 3,454/3,504 against 3,451/3,559 (three
  processes ran at once; within 5 % in every case). The Gulf run takes 5.3 s alone.

Check 2, crests (my measure: salt high with prominence 300 m or more, top of salt within 2 km of the seafloor, at
least 20 km from both section edges and from the end-of-run salt body's edges):
- Plain run: 5, at 286.5, 308.5, 314.5, 318.5 and 322.5 km, cover 1,358, 1,786, 1,293, 1,900, 1,957 m (4,456 to 6,421
  ft). None within 1 km of the seafloor (minimum cover of any crest 1,293 m). Across 10 ulp noise salts: 2 to 5.
- Relief against slab thickness: the first (286.5 km) is the top of the slab itself, 5.0 km; the other four have a
  relief of 304 to 850 m on slabs 4.2 to 4.8 km thick (7 to 18 %).
- None lies 20 km or more inside the START salt body (all are beyond 240 km, where there was no salt at the start):
  they are on the tongue that flowed past the limit.
- Controls: seeds 1, 3, 4 give 3, 3, 3; no unevenness gives 5 (finding 2); the M3.9 values give 3 on an 8.5 km pile.
  Seed 1 has one salt high with 0 m of cover at 321.5 km (6.1 km thick): the one variant that reaches the seafloor.
  The preset does not.
- D18's "at least two crests within 2 km of the seafloor, not edge artifacts" is met by the letter (5 plain, 2 to 5
  under noise; the test floor is 1). Not met in spirit: no crest reaches the seafloor and all are small highs on a flat
  tongue. The docs say this plainly and in several places (D19.3, user guide 14.5, handover, preset note,
  physics-references M3.10), and name S3 and M3b as the fix. As a geologist: acceptable for M3 given that D18 defers
  seafloor diapirs to S3 and M3b, because the preset is honest about it. The crest target should not be reported
  as "met" without the qualifier. This is John's call; I have not blocked on it.

Check 3, weld, plain run and the test's six salts (3, 5, 7, 11, 13, 17), then my salts 1, 2, 4, 6 (weld = started
at least 100 m, now under 100 m): total 17, 14, 18, 14, 15, 20, 12 km; longest run 4, 3, 4, 3, 3, 3, 3 km; my four
salts 16, 14, 16, 14 km total and longest 5, 3, 4, 3 km. The test band (total 8 km or more and a run of 2 km or more)
holds in all six test salts, the plain run and my four. Total spread 12 to 20 km, longest 3 to 5 km (the docs say
"3 or 4"; 5 occurs at salt 1). The docs do not present the weld as robust (user guide 14.5, D18.7, handover). PASS.
All 11 runs: no salt over 100 m in the last 20 km, thickest salt beyond 250 km 4,949 to 5,071 m, conserved to 6.2e-15
or better, `saltClip` 0.

Check 4: see the list above.

Check 5, sources: `hudec-2013` exists and is correct (finding 1 for the one claim that is not in the abstract).
`saltLimitStart`, `saltLimitEnd` are tuned with a reason (a synthetic section is not scaled to the Gulf). The 4 km salt
thickness is "tuned, no source" in the preset note and the handover. Preset note values are labelled tuned.
`tests/docs.test.ts` passes (registry and reference counts 83 and 27 match). No new bundled data; no `NOTICE.md` change
needed.

Check 6, tests can fail. I set the preset back to the M3.9 values (limit parameters removed from `presets.ts`,
reverted afterwards) and ran `tests/gulfPreset.test.ts` and `tests/saltLimit.test.ts`: 4 tests fail ("edge: no salt
crest ... in the last 20 km", "no pile", "weld band", "the edge fix holds in every noise salt"); 26 pass. The test
that builds the M3.9 preset in-process also asserts it fails (last 20 km above 1,000 m of salt; I measure 9,068 m).

Check 7, wall clock. Three `npm run check` runs on Windows (typecheck, lint, main project, then wallclock project):
main 32 files, 344 passed, 1 skipped; wallclock 5 files, 87 passed, 1 skipped; all three runs identical, no failure.
One plain `npm run test:run`: 37 files, 431 passed, 2 skipped, no failure (212 s).

Check 8, browser (built `dist/strata-lab.html` from file://, headless Chrome, own profile): 0 console errors and 0
external requests. Gulf at the end (step 1430 of 1430, 0.000 Ma): section canvas 643 x 360 CSS px at 100, 125 and 150 %
(backing store follows the scale); the canvas and panel tops (section 142, well 697, controls 36) are the same before
and after three redraw cycles at each scale, and the document is 1,788 px high at all three; no growth. The salt view
and its legend ("Salt", "Older cover", "Weld", each with an (i)) draw. Pseudo-wells at the end: 150 km 2,116 ft of
salt, 200 km 2,602 ft, 220 km 2,508 ft, 235 km 9,101 ft, 245 km 12,741 ft, 270 km 16,272 ft, 286.5 km 16,425 ft
(5,006 m, the slab top), 320 km 14,333 ft, 340 km 9,008 ft, 350 to 354 km a salt interval of 0 ft (finding 6), 356,
360, 380, 395 km no salt (no salt note, no salt colour). So the well agrees with the section: salt stops before the
edge. The salt-off default shows no salt button, no legend and no well salt. Screenshots were read: the section
shows the salt lens from 200 to 350 km ending in a steep front, and nothing against the right edge.

Check 10, gates, Windows: `npm run check` passes (above); `npm run build`, `npm run check:offline` (0 external hosts)
and `npm run verify:built` pass. `eslint` is clean on the two new scripts. No local paths or personal data are in any
committed file (grep of the tracked tree). Linux: see the end of this file.

## Plausibility, as a geologist

What looks right for the northern Gulf: a landward wedge that progrades over salt from the pinch-out; salt
evacuated from under the shelf and left as thin remnants and welds under the ramp (a total of 12 to 20 km of weld,
Miocene to Pleistocene ages); salt expelled basinward; and now, a salt basin that ends. The 8 to 9 km autochthonous
slab against the edge, which I called "the closed edge, not geology" in M3.9, is gone. What replaces it is a lens up
to 5 km thick that starts at 240 km, flows about 115 km basinward over salt-free floor, and ends in a steep front
that thins to nothing in about 10 km, with 1.2 to 2 km of cover over its crest. As a shape this is closer to a
Gulf salt tongue or allochthonous-ish sheet, and Hudec et al. (2013) do describe salt that flowed seaward onto new
oceanic crust, so spreading past the original limit is the right kind of behaviour. It is still not a Gulf
section. The salt is one autochthonous-style slab with no canopy, no feeder and no stratified roof, a vertical
front is not a salt-sheet shape, the outer 160 km has no salt at the start so the salt basin is only the landward 60 per cent
of the section, and the 200/240 km position is tuned (the sweep judged it by the pile test only). Minibasin
spacing is 6 to 9 km, near the 1 km grid scale and below the 10.2 km preferred wavelength; real spacing is more
like 10 to 30 km, and counts are not grid-converged. The landward diapirs are one-column needles (finding 8).
Diapirs that stay at the seafloor, the main feature of the Plio-Pleistocene slope, are absent by decision (D18,
S3/M3b). Read the preset as a teaching section with the right ingredients, now without a boundary artifact, not as
a Gulf section.

Linux parity (WSL Ubuntu, Node 22, CI=true, fresh clone of this branch, npm ci then npm run check): typecheck and lint clean; main project 32 files, 344 passed, 1 skipped; wallclock project 5 files, 81 passed, 7 skipped; 0 failed. Windows, same code: 344 passed, 1 skipped and 87 passed, 1 skipped. The 6 extra Linux skips are the wall-clock tests that skip when CI is set; no count is zero on one OS and many on the other.

VERDICT: APPROVE
