# M3b.4 Salt review of M3b part 1 (the crest log)

Reviewer: salt-tectonics reviewer (salt-reviewer profile). Date: 2026-10-17.
Branch: `strata-lab/m3b-04-review` (merge of `strata-lab/m3b-03-docs`, which stacks M3b.1 and M3b.2). Reviewed against main `4162044`.
Own code: `scripts/review/m3b-a.mjs` (recompute of the crest log) and `scripts/review/m3b-a-browser.mjs` (built-file pass over CDP). Neither imports `src/engine/crestLog.ts` for any quantity. The engine is only run to make the record, and the app's log is read at the end as the thing being checked.
Platforms are named on every number: Windows node 26.7 (also headless Chrome on Windows for the built file) and Linux WSL node 22.23.

## Verdict in one paragraph

The crest log does what it says. My own finder, tracker and least-squares code reproduces all 13 Gulf crests of the plain run, F, A, F - A and the label in both windows, to 9e-11 relative on Windows and 3e-11 on Linux. Nothing in the physics moved: `src/engine` gains one new file, the record hash of my own plain engine run equals the app's hash, and no test or fixture changed apart from one line in `tests/docs.test.ts`. The table, the markers and the CSV show the same numbers for the same crest at 100, 125 and 150 % display scaling, the label never depends on colour alone, and the built file has 0 console errors, 0 external requests and 0 hosts. There is no BLOCKING finding. The one thing John will notice first is that the worked example in the user guide (Windows node 26) does not match what the built file shows in Chrome, because single crests move with the maths library (finding N-1). That is documentation and is NON-BLOCKING; John's check list below says what Chrome shows.

VERDICT: APPROVE (last line of this file).

## Findings

All are NON-BLOCKING. There is no BLOCKING finding.

N-1. The user-guide worked example is not what the built file shows in Chrome. (docs/user-guide.md 14.7, "Worked example")
- Guide, Windows node 26: crest 5 at km 187.5, F 182, A 371, F - A -189 ft/Myr, A/F 2.0, tapered; crest 11 F - A -15, unresolved. I reproduce those exactly with node 26.
- Built file, headless Chrome on Windows, plain Gulf preset: 12 crests (not 13), crest 5 at km 187.5 has F +148, A +223, F - A -75 ft/Myr, A/F 1.51, label **unresolved** (the 82 ft/Myr floor). Last record 57.30 Ma, buried at 57.40 Ma.
- Linux node 22 plain run: crest 5 has F 175, A 387, F - A -212 ft/Myr, tapered. Crest 11: F -9, A 60, F - A -69, A/F empty, unresolved.
- This is the D16.4 noise sensitivity, not a bug (three maths libraries, three answers). The guide already says "do not read a single crest as a result" and names the platform, which is honest.
- Minimum fix: add one sentence to the example giving the Chrome numbers above (or the range of F - A for crest 5 over platforms, -75 to -212 ft/Myr) and say that the same crest is "tapered" on two platforms and "unresolved" in the browser. It is documentation only.

N-2. The guide and physics-references read a spread of seeds as a platform difference. (docs/user-guide.md 14.7 "Quote the middle"; docs/physics-references.md M3b.1 Gulf numbers)
- They quote median F - A (near window, all crests of 7 runs) of -232 ft/Myr on Windows and -337 ft/Myr on Linux.
- My 7 runs (the plain run plus six 1 ulp noise runs, my own seeds) give Windows node 26: 92 crests, median F - A -102.8 m/Myr = -337 ft/Myr; Linux node 22: 97 crests, -76.1 m/Myr = -250 ft/Myr. The two platforms swap places. The middle value moves by about 100 ft/Myr with the noise seeds on one machine.
- The sign, the tapered majority and the size (-230 to -340 ft/Myr) are stable; the platform ordering is not.
- Minimum fix: quote "about -230 to -340 ft/Myr, both platforms, seeds change it" and drop the Windows-versus-Linux wording. The same applies to "median A is 360 to 380 ft/Myr on both": my per-run medians of A are 253 to 383 ft/Myr on Windows and in the browser run it was 189 ft/Myr, so say "about 190 to 380".

N-3. The "Last" column is the last record, not the last time near the seafloor. (src/views/crests/model.ts; docs/user-guide.md worked example "is last near it at 57.8 Ma")
- `lastAgeMa` is the last record of the episode, which includes the one or two records after the cover passes 500 m (crestLog.ts header, "windows"). In the browser table crest 5 shows Last 57.30 Ma and "buried at 57.40 Ma": the Last age is younger than the burial age, which reads oddly.
- Minimum fix: in the guide and the table's info text say "Last = last record followed; it can be one or two records after the cover passed 1,640 ft".

N-4. One Gulf test sits two crests from its threshold. (tests/crestLogGulf.test.ts, `tapered > E.length / 2`)
- Observed tapered / crests: Windows 9/13, 9/13, 10/13, 9/13, 11/14, 9/14, 10/12 (so the worst margin is 9 against a threshold of 7 for 14); Linux 10/14 median. Chrome 8/12. The test is not on a count near zero (the tabular count, 0 or 1 per run, is not asserted, and the file says so), so D16.4 is respected. But a 12-crest run with 6 tapered would fail it.
- Minimum fix (optional): assert tapered at least a third of the crests, or only that the median F - A is negative (which is already asserted with a wide margin: -55 to -105 m/Myr against a bound of -25).

N-5. The missing dissolution sink is named in the references but not in section 14.7 of the guide. (QC item 13; VJ92a p. 347)
- The burial rule of VJ92a p. 347 is F - D against A. The log has no D (the engine has none), so F is the whole net rise. docs/physics-references.md says so in the sources table; docs/user-guide.md has it only in section 15 ("No dissolution", line 830).
- Minimum fix: one sentence in 14.7 ("A crest that stays at the seafloor would in nature lose some salt to dissolution, which the model does not have").

N-6. The "burial" test in the code is a depth rule, not the VJ92a rule, and the references table lists it as cited. (docs/physics-references.md "Rise against accumulation as the burial test", status cited)
- The code ends an episode when the cover has been over 500 m for 3 steps (crestLog.ts:285-289). That is a tuned geometric rule from spike 003. VJ92a p. 347 (net rise F - D below A buries a crest) is what the label tests afterwards. So "cited" applies to what F - A means, not to how a burial is detected.
- Minimum fix: reword the status as "burial detected by a tuned depth rule; the sign of F - A is then checked against VJ92a p. 347".

N-7. GR12 count rise as relative rise; this code counts absolute rise. (judgement, labelled)
- GR12 p. 19: rise rate is relative, "rise of the diapir relative to minibasin subsidence plus differential compaction", and they say they do not address absolute rates (pp. 19-20). GR12 p. 20: tabular when accumulation next to the diapir is slower than the rise, tapered when faster, judged over a third-order sequence (several hundred thousand years to several million years, p. 8).
- The code compares absolute salt-top rise F with absolute seafloor rise A beside it. If the flank subsides with the same rate s, relative rise is F + s and accumulation is A + s, so the difference F - A is the same: the label rule survives the change. If the salt top sinks with compaction or loading differently from the flank, it does not. The 1 Myr window sits at the short end of GR12's third-order range.
- Not a defect. Minimum fix: one sentence in 14.7 and in the physics-references entry saying that F and A are absolute rates (elevation of the salt top and of the seafloor) and why that matches GR12's relative rule when the flank subsides like the crest.

N-8. The CSV header line reads "F - A > 0 = tabular, < 0 = tapered" without the floor. (src/views/crests/exportCrests.ts:46)
- The thresholds line below it gives the floor, so nothing is hidden. Minimum fix: add "(within the noise floor: unresolved)" to the same line.

## 1. No physics change

- `git diff main...HEAD --stat -- src/engine`: one file, `src/engine/crestLog.ts` (397 lines, new). Other `src` changes are the worker (history capture `captureCrest`, a `crestLog` request) and views. `captureCrest` copies three arrays after each step and writes nothing back (src/worker/timeMachine.ts).
- Record hash of the plain Gulf run: my own engine run (no capture) gives f2e2fd2ca42afb35 on Windows and 1ab55b6cde2ec371 on Linux, each equal to the hash of the app's TimeMachine run on the same platform. The two platforms differ, as D16.4 expects.
- `ENGINE_VERSION` stays 1 (src/version.ts). No test file changed except one line in `tests/docs.test.ts` (three new strings in `APP_STRINGS`); no preset or fixture changed. The M1 to M3 golden tests pass unchanged.
- No `Math.random`, `Date.now` or `performance.now` in the added engine code (only the Gulf test uses `performance.now` to time the log, and asserts under 2,000 ms against a measured 13 to 25 ms).
- PASS.

## 2. Measures, by my own code

Method (`scripts/review/m3b-a.mjs`): run the Gulf preset through the engine step by step and keep salt thickness, salt top (basement plus salt) and seafloor after each step. Find salt-top highs with my own prominence function (100 m); follow each crest to the column within 3 columns with salt thicker than the weld thickness and the least cover; end it after 3 steps over 500 m, at a weld, or at the run end; merge crests within 2 columns; take F and A as least-squares slopes (a sums formulation, not the app's centred loop) over the last 1 Myr of the near records and over the last 1 Myr of all records; label with the 25 m/Myr floor.

Result, plain Gulf run: 13 crests on both platforms; every app crest has an own crest with the same start column and first step (13 of 13); F, A and F - A agree in both windows (worst relative difference, against max(1, |value|) m/Myr, 8.7e-11 Windows and 2.6e-11 Linux, which is rounding in two different summation orders); all labels agree; the end reasons agree.

Two-crest table (plain Gulf run, near window, 11 records each, Windows node 26; own value first, app value in brackets; metres per Myr with feet per Myr):

| Crest | km | F m/Myr | A m/Myr | F - A m/Myr | F, A, F - A ft/Myr | Label |
|---|---|---|---|---|---|---|
| 4 | 157.5 | 28.715337448559 (28.715337448545) | 131.484756811998 (131.484756812003) | -102.769419363439 (-102.769419363458) | 94, 431, -337 | tapered (tapered) |
| 11 | 203.5 | 32.066805040822 (32.066805040785) | 36.491839994415 (36.491839994433) | -4.425034953594 (-4.425034953500) | 105, 120, -15 | unresolved (unresolved) |

The guide's worked example, crest 5 at km 187.5 (Windows node 26): own and app agree: F 55.4 m/Myr (182 ft/Myr), A 113.0 (371), F - A -58 (-189), A/F 2.04, tapered; first record 65.9 Ma, near 7.9 Myr, last record 57.8 Ma; burial-window F - A -174 ft/Myr (tapered); salt beside 16,542 ft (5,042 m), L/h 10.3. The guide's numbers (16,540 ft, 5,040 m, L/h 10, -174) reproduce. Guide crest 11: F 105, A 120, F - A -15 ft/Myr, A/F 1.14, unresolved: reproduces.

Is the hand-calculation test a hand calculation? Yes. `tests/crestLog.test.ts` builds a record with the answer written into it: a salt top rising 10 m per 0.1 Myr frame (F = 100 m/Myr), a flank seafloor rising 4 m per frame (A = 40 m/Myr), so F - A = 60, A/F = 0.4, and a 1 Myr window of 11 records with both ends included. The expected values are literals, not outputs of the code. The tests also check cover and depth records, neighbour salt (1,000 m), the flow length (10.5 cells), mean salt `(1390 + 20 x 1000) / 21`, the burial age (frame 10, 58.9 Ma), the weld end, the exposed time (0.4 Myr), the merge, and determinism (same input, same JSON). PASS.

## 3. Definitions against the literature

- Tabular and tapered (GR12 p. 20): A < F is tabular, A > F is tapered. The code (crestLog.ts:199-204) does the same, with a floor for "unresolved" (tuned). Reading of rise as relative (GR12 p. 19) versus absolute: N-7 above. Judged over a third-order sequence (p. 8) versus the 1 Myr window: the window is at the short end of that range, a tuned choice that the docs call tuned.
- Burial test (VJ92a p. 347): F - D below A buries a crest, F - D equal to A keeps the flanks vertical, F - D above A overflows. The log reports F - A per crest, so QC item 10 passes (ratio per crest). The detection of burial is a depth rule (N-6) and D is absent (N-5). In the Gulf plain runs the buried crests have a negative near-window F - A in 11 to 13 of 13 crests on Windows (the others are within the floor), which agrees with VJ92a's direction.
- Windows (SALT-R1 S3-2, SALT-R2 3.4): "near" is the last 1 Myr of the records with cover under 500 m; "burial" is the last 1 Myr up to the last record and includes the one or two records after the cover passes 500 m. That is what SALT-R2 section 3.4 asked for ("report both, window stated in the CSV header"). The CSV header states both windows. PASS. In the plain Gulf run on Windows, burial-window medians are about -104 m/Myr against near-window medians of -80 to -103 m/Myr: the burial window is more negative or equal in every run, as the guide says.
- Thresholds: every value is listed as cited or tuned in the physics-references table (prominence 100 m, NEAR 500 m, 3 steps, 3 columns, merge 2 columns, flank columns 3 to 5, neighbour distance 10 km, window 1 Myr, 2 m seafloor test: tuned, with "no source" written where there is none). The 25 m/Myr floor is tuned and set from a measurement. I checked the measurement in kind: the same crest's F - A moves by tens of m/Myr between my plain run and my noise runs, so a floor near 25 m/Myr is of the right size (a floor of 25 leaves 2 to 5 of 12 to 14 crests unresolved per run on Windows; Chrome 4 of 12; Linux 4 of 14). PASS.
- No claim of hooks or wedges at dx 1,000 m (QC red flag 3): the guide says in plain words that the grid "cannot show hooks and wedges" (GR12 p. 8: hook fold zones 50 to 200 m, wedge 300 to 1,000 m), the table's info text, the CSV header and the physics-references "Not claimed" line say the same. PASS.
- One more thing the guide does say that I checked: "There was about 16,540 ft of salt beside it ... the burial of crests is more likely a limit of the thin-sheet flow than a lack of salt (medium confidence)". That is SALT-R2's reading (my own review, not a new result); QC item 11 passes with the flag reported.

QC items touched (the others are not affected by a read-only analysis):

| Item | Result |
|---|---|
| 1 mass balance | Not changed: balance tests pass unchanged on both platforms (Windows and Linux counts below). |
| 2 survives 1 ulp noise | The log is built from the record, and I ran it on six noise runs per platform. Per-crest numbers do move; medians and signs do not. PASS with the N-1, N-2 notes. |
| 3 widths with dx, no hooks or wedges at 1,000 m | PASS. |
| 10 ratio per crest | PASS (table and CSV carry F, A, F - A, A/F for every crest). |
| 11 neighbour thickness and L/h | PASS: "Salt beside" and L/h columns; Windows median beside the crest about 5,000 m. |
| 13 dissolution sink named | Partial, N-5. |
| 14 roof against neighbouring cover | Not in scope of the log (cover is reported per record in the CSV). |
| 19, 24 weld counts; features the column model cannot hold | Not in scope of the log. The guide says salt in higher layers (a canopy) is not followed, and the log is for the main run only. |
| 23 every number sourced, access level, setting | PASS: cited rules carry page numbers (GR12 p. 8, p. 20; VJ92a p. 347); tuned values are labelled tuned; no scaled model rate is quoted as natural. |

## 4. Cross-machine (D16.4)

Gulf preset, near window, own code, plain run and six 1 ulp noise runs (seeds 7 to 12) per platform:

| Platform | Crests per run | Tapered per run | Unresolved per run | Tabular per run | Median F - A over all crests | Median A over all crests |
|---|---|---|---|---|---|---|
| Windows node 26 (92 crests) | 13, 13, 13, 13, 14, 14, 12 | 9, 9, 10, 9, 11, 9, 10 | 4, 4, 3, 4, 3, 5, 2 | 0 in every run | -102.8 m/Myr (-337 ft/Myr) | 373 ft/Myr |
| Linux node 22 (97 crests) | 14 median, 13 plain | 10 median | 4 median | 0 in six runs, 1 in one | -76.1 m/Myr (-250 ft/Myr) | 374 ft/Myr |
| Chrome on Windows, plain run (12 crests) | 12 | 8 | 4 | 0 | -241 ft/Myr (median) | 189 ft/Myr (median) |

Every platform and every run has a negative median F - A and a tapered majority. Tabular crests are 0 or 1 per run. The tests assert neither a tabular count nor an exact crest count: they assert 6 to 30 crests, a median A between 30 and 300 m/Myr (observed 77 to 117), a median F - A under -25 m/Myr (observed -55 to -105), neighbour salt between 2,500 and 5,500 m, L/h above 3, a log time under 2 s, and that the log is identical on a second call and leaves the record hash untouched. N-4 notes the one threshold that sits two crests away. The test runs both the plain and the noise run. PASS with N-4.

## 5. The views, in the built file

`dist/strata-lab.html` opened from a file in headless Chrome over CDP, own profile, fresh state, Gulf preset, at 100, 125 and 150 % (`scripts/review/m3b-a-browser.mjs`). Crest 5 picked by clicking its table row.

- Table, marker and CSV agree on the same crest at all three scalings. Table row: 5, x 187.5 km, First 65.90 Ma, Last 57.30 Ma, F +148, A +223, F - A -75 ft/Myr, A/F 1.51, label "unresolved", salt beside 16,707 ft, L/h 10.4, "buried at 57.40 Ma". The crest CSV row for crest 5: F 147.6, A 222.9, F - A -75.4 ft/Myr, A/F 1.511, label unresolved, neighbour salt 16,707 ft, L/h 10.40, 87 record rows in the records file. The marker's hover text shows the same F, A, F - A and salt beside it. The CSV header lines name the units, windows and thresholds.
- Label by more than colour: every marker is a shape plus a letter (triangle up T tabular, triangle down P tapered, diamond ? unresolved); the table cell repeats the glyph and the word; the key under the section lists all three. The hit target of each marker is 44 x 44 css px.
- Marker position: the horizontal centre equals the column centre exactly (0 css px offset at 100, 125 and 150 %). At 100 % the marker's lower edge is 3.2 to 3.6 css px above the seafloor pixel for all three markers (crests 5, 6 and 10); the three marker positions in css pixels are identical at 125 and 150 % (glyph bottoms 179.8, 184.4, 188.7), the canvas keeps the same css size (643 x 360) and the backing size scales (643 x 360, 804 x 450, 965 x 540) and is the same before and after a redraw. My pixel scan for the seafloor line at 125 and 150 % hit the dashed sea-level line and is not used; I judged those two by the screenshot instead (markers stand on the seafloor, selected marker has a yellow ring). The canvas-at-display-scaling trap does not recur.
- Console and network: 0 console errors or warnings, 0 external requests at every scaling. `npm run verify:built`: VERIFY OK, 0 console errors. `npm run check:offline`: 10 URL strings, all allowlisted, 0 external hosts.
- The crest count in Chrome (12) differs from node (13 on both platforms): N-1.

## 6. Docs

- Numbers in the user guide section 14.7 reproduce on Windows node 26 (crest 5, crest 11, 16,540 ft, L/h 10, burial -174 ft/Myr, the thresholds in ft: 328, 1,640, 82 ft/Myr). They do not reproduce in the built file in Chrome (N-1) or in the platform split of the medians (N-2).
- Units: ft, ft/Myr, km, Ma, and metres in brackets. The guide shows 328 ft, 1,640 ft and 82 ft/Myr for 100 m, 500 m and 25 m/Myr (rounded correctly: 328.08, 1,640.4, 82.02).
- Honest references: the sources table says "no source" and "tuned" where that is true; abstract-only or extract-only sources are not upgraded; the GR12 page numbers (p. 8, p. 19, p. 20) match my notes of the full text. N-5, N-6 and N-7 are the corrections I ask for.

## 7. Gates

| Gate | Windows node 26 | Linux WSL node 22.23 (fresh clone of this branch) |
|---|---|---|
| `npm ci` | ok | ok |
| `npm run check` (typecheck, eslint, both vitest projects) | exit 0 | `CI=true`, exit 0 |
| main project | 43 files, 472 passed, 1 skipped | 43 files, 472 passed, 1 skipped |
| wallclock project | 6 files, 89 passed, 1 skipped | 6 files, 82 passed, 8 skipped (CI skips the wall-clock gates) |
| `npm run build` | ok (dist/index.html 702 kB) | not run (the card asks for it on Windows) |
| `npm run check:offline` | 0 external hosts | not run |
| `npm run verify:built` | VERIFY OK, 0 console errors | not run |
| `node scripts/review/m3b-a.mjs` | ALL PASS | ALL PASS |

The first Windows `npm run check` failed on two lint errors in my own new script (an unused constant and an unused helper); I fixed them in the script and the gate then passed. They were not in the work under review. The spike checks (`spikes/003`, `spikes/004`) were not run: no spike is touched and those spikes are not on this branch.

## 8. Checks for John in the built file

Open `dist/strata-lab.html` (after `npm run build`) in your browser. Numbers come from my run in headless Chrome on Windows; your browser may differ a little, because single crests move with the maths library.

1. Choose the scenario "Gulf-style: wedge over salt" and wait for the run to finish. A panel "Salt crests" appears under the pseudo-well with a table. You should see about 12 to 14 crests (I got 12 in Chrome, 13 in node). If the run has no salt, the panel is not there.
2. Look at the end of the run. You should see no triangles on the section: every Gulf crest is buried by the end, and the guide says so. Drag the time slider back to about 59 Ma. You should see two or three markers standing on the seafloor.
3. Look at the shape of each marker. A triangle down with P means tapered, a diamond with ? means unresolved, a triangle up with T means tabular; the key under the section says the same. At 59 Ma I saw ? ? P. You should not need the colour to tell them apart.
4. In the table, click the "5" in the Crest column. The slider should jump to that crest's last record (57.30 Ma in my Chrome run) and its marker gets a yellow ring. The row I got: x 187.5 km, F +148, A +223, F - A -75 ft/Myr, A/F 1.51, "unresolved", salt beside 16,707 ft, L/h 10.4, "buried at 57.40 Ma". Your numbers for crest 5 may differ by tens to a few hundred ft/Myr; that is the noise the guide warns about, not a fault.
5. Sort the table by "F - A" (click the head twice). The most negative values should be the tapered rows, and rows without a number should sort last. Check that no row says "tabular": I found none in Chrome, and 0 or 1 per run elsewhere. That is the model's finding, not a display error: here the sediment beside a crest builds up faster than the salt top rises.
6. Hover over a marker. A line of text under the section should give the crest number, label, F, A, F - A and the salt beside it, the same as the table row. Tab to a marker with the keyboard: the same text appears.
7. Click "Export crests (CSV)" and open the file in a spreadsheet. Lines starting with # give units, the 1 Myr windows, the thresholds (82 ft/Myr floor, 328 ft prominence, 1,640 ft near) and the sentence that hooks and wedges are not resolved at the grid size. Find crest 5: its F, A and F - A should equal the table's to within the rounding (+147.6, +222.9, -75.4 against +148, +223, -75). Then "Export crest records (CSV)": crest 5 has 87 rows with depths in ft.
8. Press "Branch from here" (or edit a control, so a branch is active) and look at the Salt crests panel. It should say the crest log is kept for the main run only, and no markers should show. Switch back to the main run: the table returns.
9. Zoom the browser to 125 % and then 150 % (Ctrl and +). The section should keep the same shape, the markers should stay on the seafloor, and the page should not grow or freeze.
10. Read the worked example in the user guide (14.7). You should find that the guide's numbers for crest 5 (F 182, A 371, F - A -189, tapered) differ from yours: finding N-1. If you decide that matters, say so and it goes back as a documentation fix.

## Open questions for John (judgement, one recommended answer each)

These come from M3b.1 to M3b.3; they do not change the verdict.
- Should the 25 m/Myr noise floor drop to 10 m/Myr? Recommended: no, keep 25. It is the size by which the same crest's F - A moves under 1 ulp of maths noise; at 10 m/Myr the label would flip on noise. It leaves 2 to 5 of 12 to 14 Gulf crests unresolved. Confidence: high. A better evidence base (more noise runs) could change it.
- Should the app open at the first crest's time? Recommended: not now; the guide tells John to drag back. It is a UI choice, not a physics one.
- Keep or hide the merged-candidate footnote? Recommended: keep (it explains why the number of crests is not the number of salt highs; 94 candidates were merged into 13 crests on the plain Gulf run).
- A per-branch crest log? Recommended: later, only if John wants to compare crests across a branch; it needs shared history before the fork.
- Should clicking a row also move the pseudo-well to the crest column? Recommended: yes in a later UI card, small and read-only.

VERDICT: APPROVE
