# M3.9 integrity re-review (Gulf preset fix, M3.8 at 02e453c)

Reviewed against the D18 targets John gave in the card comment (weld = salt under 100 m, one weld run of 2 km or more
under the shelf or ramp, at least two salt crests within 2 km of the seafloor and not edge artifacts, wedge still
progrades, saltVisc 1e18 and the 66 Ma start unchanged), plus the M3.7 browser gaps.
Own scripts: scripts/review/m3-rereview.mjs (parts gulf, grid, grid2, ulp, seeds, short, hash, seek0) and
scripts/review/m3-rereview-browser.mjs. Feature measures are written in the script from the raw record (salt thickness
in layer 0, surface H, basement b); nothing comes from saltStructures.ts or the salt physics. Screenshots are in the
reviewer scratch directory, not the repo.

## Findings

1. BLOCKING. D18 is not recorded in docs/decisions.md (it ends at D17, line ~114). Code and docs cite it
   (src/engine/presets.ts:77, src/engine/params.ts weldThick note, tests/gulfPreset.test.ts:4,
   docs/physics-references.md:306-309, docs/user-guide.md:626) and a reader cannot find it. Minimum fix: add D18 with
   John's targets, the 100 m weld label, "diapirs at the seafloor deferred to S3/M3b", and what M3.8 actually reached.
2. BLOCKING. S3 and M3b appear nowhere in docs/roadmap.md (grep: no match), the M3 "Done when" text is not updated
   and the status line (roadmap.md:3) still says "waiting for the M3.7 review". Minimum fix: add spike S3 and
   milestone M3b to the roadmap and rewrite the M3 done-when to the D18 targets.
3. BLOCKING. docs/handover.md still carries the old Open items: lines 139-142 ("only one salt preset", "Gulf preset
   (draft) has no weld ... at the seafloor", speed 5.0 s), line 128-129 (11 minibasins / 11 highs, "spread NOT reported"),
   and line 132 (Gulf uses coverVisc 3e20; it is now 1e19). Minimum fix: replace them with the M3.8 state: two salt
   presets, weld label 100 m, the basin-floor pile (finding 4), weld wobble under ulp (finding 5), run time.
4. BLOCKING (needs John's decision, or a fix). The two-crest D18 target is met by the letter but not in spirit.
   The four crests within 2 km of the seafloor (287.5, 314.5, 354.5, 389.5 km; cover 1,863 / 1,567 / 1,247 / 1,106 m)
   all sit on a salt pile 7.8 to 9.1 km thick, twice the 4 km start, caused by salt piling up against the closed
   basinward edge (zero flux at 400 km). Their relief is 370 to 490 m on 8.5 km, about 5 %. Evidence they are not
   independent diapirs: with coverUneven 0 there are 0 shallow crests; with coverSeed 1/3/4 there are 1/2/2 (at other
   positions); mean salt beyond 250 km is 8,013 to 8,020 m for every seed (the pile is the same, the ripples follow
   the seed); the crest depths are identical to 4 digits under every ulp noise (they are a deterministic result of
   the boundary and the seed, not of the flow). The one at 389.5 km is 10.5 km from the edge, inside the 20 km the
   docs claim to exclude (physics-references.md:309); the test title at tests/gulfPreset.test.ts:112 says "20 km or
   more from the basinward edge" and never asserts it. The preset note (presets.ts:77) and the M3.8 handoff admit the
   pile. Minimum fix: either John accepts this explicitly and it is written into D18 and the user guide
   ("shallow crests are ripples on a basin-floor salt pile"), or the preset needs an open or distant basinward
   boundary (the 400-column record limit prevents a longer section). In either case add the 20 km assertion
   (c.x <= 400 km - 20 km) to the test, or drop the claim.
5. NON-BLOCKING (should be fixed with the docs). The weld target is not robust. Under 1 ulp noise (six salts, my
   measure) the longest weld run is 2, 3, 1, 2, 2, 3 km at dx 1,000 m, so one of six runs fails the 2 km target; the
   weld runs are 1 to 3 columns wide. Weld positions move (28-31, 35-37, 44-45, 50-52, 75-76 km in the base run).
   tests/gulfPreset.test.ts:186 only asks for weldsAny >= 1, so the test cannot see this. M3.8 flagged it. Minimum
   fix: say in the user guide and D18 that the 2 km weld is not stable to 1 ulp, and ask only for a band (for example
   total weld length >= 3 km) in the test. Do not present the weld as robust.
6. NON-BLOCKING. Three items were missing from the M3.8 summary and are reported here: the 10 km salt table, the ulp
   spread and the speed table. Numbers are below; add them to the handover.
7. NON-BLOCKING. Grid check. The record allows 400 columns, so dx 500 m can only cover 200 km. My spectral wavelength
   (20 to 110 km) is 18.5 km at dx 1,000 against 20.6 km at dx 500 (10.6 %, within 15 %); 20 to 70 km window
   11.9 against 13.4 km (12.2 %). On the full 400 km, dx 1,000 against dx 2,000: 13.2 against 12.6 km (4.7 %). So the
   width measure the docs quote holds. The count-based measures do not: median crest gap 10.0 against 18.5 km
   (59.6 %), mean crest spacing over 20 to 110 km at 400 km, 8.4 against 10.9 km (25.8 %). Weld runs of 2 km or more
   exist on both grids. The docs must keep saying counts and spacing are not grid-converged (M3.7 note 3).
8. NON-BLOCKING. The section's vertical scale depends on viewing history: step 0 drawn on the first visit and on
   later visits differs in 7,750 of 231,480 pixels (every layer line and axis label shifted by about a pixel).
   Engine state and StateView at step 0 are identical across visits (seek0 part, hash 566eca05 every time, all view
   arrays equal), so the difference is in the drawing only. No fix needed for physics; note it.
9. NON-BLOCKING. Wall-clock tests flake on a loaded Windows machine. In three full-suite runs here
   tests/longruns.test.ts (miocene 5,278 ms and cenozoic 6,767 ms against 5,000) and tests/run.test.ts:37 (3,429 to
   4,412 ms against 3,000) failed; they pass alone, and main's full suite passes here (26 files, 300 tests). The branch
   has ten more test files that run heavy salt runs in parallel. They are skipped when CI is set. Minimum fix: keep
   them, but run them in a serial vitest project or raise the limits for non-CI. Same as M3.7 note 1.
10. NON-BLOCKING. The short preset's section is over-filled: the surface ends 3.3 km above sea level, with
    3.5 to 6 km of cover over the salt, and structures are 1 to 2 cells wide (minibasin widths 2, 25, 2, 1, 1, 5 km).
    The docs already say it is a toy; the preset label should not suggest a realistic section.
11. NON-BLOCKING. Sources. Every changed gulf value is "tuned" in the note (presets.ts:77) with a reason. weldThick 100
    is tuned with Wagner and Jackson (2011), marked to verify (abstract only). saltThick 4,000 "upper end of Louann
    estimates, to verify" has no reference entry. Pilcher et al. (2011) is added and is used for no number. saltVisc
    1e18 and the 66 Ma start are kept (presets.ts, test asserts both). Minimum fix: add a reference entry for the 4 km
    salt or label it tuned only.

## Check results

Check 1, Gulf preset at dx 1,000 m (400 columns), run 5.4 s, saltClip 0, saltLimited 0:
- Weld (started at least 100 m, now under 100 m): runs at 28-29, 30-31, 35-37 (2 km), 44-45, 50-52 (2 km), 75-76 km.
  Longest 2 km. PASS the D18 target of 2 km, narrowly. All lie landward of the final shoreline (115 km) and on the
  pinch-out ramp (10 to 100 km). The card's old 3 km target is not met.
- Crests within 2 km of the seafloor, not at the edge: 4, all on the basin-floor pile (finding 4). Within 1 km: 0
  (the old target; D18 replaced it). Landward crests are 4.6 to 10.8 km below the seafloor (14 crests in all).
- Minibasins by my measure (prominence 300 m, half-relief width): 13; widths 6, 6, 4, 18, 2, 2, 9, 4, 7, 88, 8, 9,
  16 km; 8 of 13 within 5 to 30 km. PASS ("mostly"), with the pile ripples counted.
- Salt basinward: centroid 226.9 to 307.3 km; salt landward of 55 km 34 to 20 (km2 x 1e-3). PASS.
- Salt conserved: 5.8e-15 relative. saltClip 0. PASS.
- Wedge progrades: shoreline 54.5 km at 56 Ma, 120.5 km at 9.5 Ma, 212.5 km at 0.6 Ma. PASS.
- Salt thickness every 10 km (m): 5:0 15:30 25:637 35:145 45:41 55:546 65:201 75:248 85:1159 95:674 105:726 115:894
  125:987 135:718 145:565 155:381 165:505 175:368 185:324 195:459 205:478 215:590 225:817 235:1595 245:3521 255:4615
  265:6020 275:7107 285:8057 295:8094 305:8283 315:8741 325:8495 335:8524 345:8578 355:8969 365:8550 375:8609
  385:8709 395:8575. Beyond 250 km the section is one salt body 8 to 9 km thick.

Check 2: finding 7. Check 3, six ulp salts: longest weld 2, 3, 1, 2, 2, 3 km (spread 1 to 3 km), weld runs of 2 km or
more 4, 1, 0, 1, 2, 1; shallow-crest count 4 in all six, depths unchanged (1,862 to 1,864, 1,567, 1,248, 1,106 m);
median minibasin width 6 to 11 km; saltClip 0. The weld fails in one of six, the crests do not move.

Check 5, saltshort: 0.42 s (second run 0.415 s), deterministic, salt conserved to 2.2e-16, saltClip 0, six crests with
prominence 355 to 1,507 m, relief 1.8 km. Visible, but 1 to 2 cells wide (finding 10).

Check 6, nothing else moved: stateHash identical to main on this machine for last3 (cb22255b), mtd (9be1b3f3),
miocene (fa992a56), cenozoic (ebd3965b). Best-of-3 time, main against branch, two rounds: last3 1,447/1,505 against
1,475/1,447 ms, mtd 2,103/2,062 against 2,130/2,103, miocene 2,307/2,327 against 2,276/2,412, cenozoic 2,746/2,839
against 2,751/2,894. All within 5 % (largest, miocene +3.6 % in round two, -1.3 % in round one, which is scatter).

Check 7, real browser (built dist/strata-lab.html from file://, headless Chrome, own profile; 0 console errors,
0 external requests):
- Every salt (i), text recorded: salt thickness scale ("fixed at 0 to 16,404 ft ... Thickness is the total salt in the
  column, in feet"), salt colour (section and well, "halite ... 2,160 kg/m3 ... creeps sideways and upward"), older
  cover ("darker ... dashed brown line marks its top"), weld ("salt thinner than the weld thickness, a control under All
  other parameters ... records that the salt was once thicker"), broken pressure line ("pore-pressure line stops at the
  salt and starts again below it ... overburden uses 2,160 kg/m3"). All open and say what they should.
- Scaling 100/125/150 %: section top 142 px, well svg top 697, wellRegion 659, controls 36, right panel 36, document
  height 6,084 px; identical at all three scales and before and after three redraw cycles (mode change and scrub).
  Canvas 643 x 360 CSS px every time (backing store 643/804/965 wide). No growth.
- Gulf at mid-run (step 715) and end (1430): salt pixels 9,356 and 9,314; all seven colour modes draw.
- Pseudo-wells at the end: weld column 37 km (salt 311 ft, "Weld at this column from 12.00 Ma", weld marker); weld at
  64 km (248 ft, 8.30 Ma) and 76 km (306 ft, 1.82 Ma); diapir 33 km (7,597 ft salt, top 14,500 ft), 48 km (6,660 ft);
  landward minibasin 176 km (1,324 ft); pile 352 and 354 km (28,483 and 28,389 ft of salt). The note and both (i)
  appear each time. The salt-off default shows no salt button, no legend, no well salt.
- Rewind and branch with salt on: scrub salt pixels 9,322 / 9,300 / 9,313 / 9,318 / 9,238 / 9,229; end hash identical
  on return to the main run; branch at 2.86 Ma is identical to main in the compare view ("surface differs by up to 0 ft");
  start-only controls (saltOn, saltThick, pinch, coverUneven, coverSeed, coverThick, nSaltSub) are locked on the
  branch. Step 0 drawing: finding 8.

Check 4/9: gates. Windows: typecheck and lint clean (my scripts lint clean), build, check:offline (0 external hosts) and
verify:built pass; npm run check ran 418 passed and 2 or 3 failed, all wall-clock tests (finding 9); those files
pass alone. Linux: see the end of this file.

## Plausibility, as a geologist

What looks like the northern Gulf: a landward wedge that progrades 150 km or more over autochthonous salt from the
pinch-out; salt evacuated from under the shelf and upper slope and left as thin remnants and welds (the weld ages, 12 to
1.8 Ma, are the right order for Miocene to Pleistocene shelf welds); salt expelled basinward; minibasins of a few km
to 18 km between salt walls and welds in the landward 100 km; total column 10 to 12 km on the shelf, which is the order
of the Cenozoic fill there.

What does not: (a) the basin floor. Beyond 250 km there is one salt body 8 to 9 km thick and 150 km wide under only
1.1 to 1.9 km of cover and 1.2 km of water. The northern Gulf has allochthonous salt sheets and canopies a few km
thick, tongues thinning basinward; no 8 km autochthonous slab. It is the closed edge, not geology, and the crests on it
are ripples that follow the cover seed. (b) No canopies or allochthonous sheets: a known limit (D17.1). (c) Minibasin
spacing is 6 to 9 km, about the grid scale of the 1 km columns and below the 10.2 km preferred wavelength, with 2 km
minibasins at the thin end; real spacing is nearer 10 to 30 km. (d) Diapirs here are buried 4.6 to 10.8 km under the
seafloor; the shallow Gulf diapirs and welds of the Plio-Pleistocene slope are missing (deliberately deferred to
S3/M3b). (e) All values are tuned and the preset says so; start time 66 Ma means the salt is covered by 300 m only,
where the real Mesozoic cover is thicker. Read the preset as a teaching section with the right ingredients, not as a
Gulf section.

VERDICT: REQUEST CHANGES
(Blocking: 1, 2, 3 are docs the shepherd or orchestrator can add; 4 needs John's decision or a boundary fix.
The physics core is unchanged and sound: salt conserved, no clipping, nothing else moved, salt off equals main.)
