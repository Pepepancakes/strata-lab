# SALT-R3: short check of the S3d docs fix and the S4b Stokes rerun

Reviewer: salt-reviewer profile, 2026-10-17. Branch `strata-lab/salt-r3-check` = `strata-lab/s3d-docs-fix` (HEAD e908080) + `strata-lab/s4b-stokes-rerun` (HEAD 115c3e5), both merged with no conflict. Own code: `scripts/review/salt-r3.mjs` (reads JSON only, imports no app or spike module) and the existing `scripts/review/salt-r2.mjs pool`. Reviewed against `docs/reviews/salt-evidence-recheck.md` (SALT-R2). This is the last round on the salt evidence (D23).

Platforms: WIN = Windows, node 26.7.0. LIN = Linux (WSL Ubuntu), node 22. Units for John: 100 m = 328 ft; 33 m/Myr = 108 ft/Myr; 4,500 m = 14,760 ft.

`git diff strata-lab/salt-r2-recheck -- src tests` is empty (checked). Both cards touched docs, spike files and a spike `cases.js` switch only.

## 1. Short answer

- **S3d: all five SALT-R2 items are closed.** The README numbers match my own pooling to the digit.
- **S4b: sound.** I reproduced the start section, the thin-sheet series, and then the whole Stokes run on Windows; the output is identical to the committed result tables (only wall-clock time differs).
- **S3 question: Stokes does not hold the crest at the surface, and it does not show the steady fall the thin sheet shows. So the thin sheet's exposed episode and its steady fall are thin-sheet behaviour (not shown by Stokes); burial itself is not.** Confidence medium to high (section 4).
- **Option C: do not build it on this evidence** (section 5). It is not a way to keep a crest exposed; burial of a crest is expected geology.
- Four NON-BLOCKING wording items (section 6). Nothing blocks.

## 2. S3d: SALT-R2 items

| Item | Status | Evidence |
|---|---|---|
| D-1 BLOCKING (README carries pre-fix results) | CLOSED | `spikes/003-passive-diapir/README.md`: line 75 now says "sheds only from a topographic high, tested on the seafloor at the start of the record step, split by slope"; the three pre-fix S3b result bullets are gone (line 86 says so); the S3c results table, the measured F and A sentence ("salt top falling by about 37 m/Myr ... A is about -1 m/Myr") and a one-paragraph S3 answer are in. The old first-run section is kept but marked as superseded (line 51). "43 checks" is now 50. |
| D-2 (no platform on CSV) | CLOSED | Every committed crest CSV starts with `# Platform: <OS>, node <version>` (gulf, ulp, sweep, both platforms). I looked at the first line of each of the six files. `s3c-pool.js` skips `#` lines, so pooling is unchanged. |
| N-1 (test 12 only at 8 marks) | CLOSED | Test 12 now runs at every 0.1 Myr record and asserts longest run of 10 records or fewer and deepest pit of 100 m or fewer. Evidence in section 2.3. |
| N-2 (exposed columns sit on slopes) | CLOSED | README table "below both / mixed / above both": WIN 215 / 1,216 / 16, LIN 293 / 1,202 / 7, plus the sentence "A reader should not picture an exposed crest as a high". I reproduced the WIN split in test 12's output (215, 1216, 16). |
| N-4 (command lines) | CLOSED | README section "How to reproduce these numbers" lists the commands for `test.js`, `s3b.js gulf|ulp|sweep` and both `s3c-pool.js` calls; `pooled-s3d.txt` holds the raw output. |

### 2.1 Spot-check of README numbers against my own pooling (WIN, `salt-r2.mjs pool` on the committed CSVs)

| README row | README | Mine |
|---|---|---|
| pooled 14 runs | 169 crests, 73 exposed, 58 buried, exposure median 4.8 / longest 16.2 Myr, 55 over 3 Myr, F_near -37 / A_near -1 / F-A -33 | identical, all figures |
| WIN plain Gulf | 12 / 6 / 5, 4.4 / 12.1, -38 / +1 / -33, neighbour salt at 10 km 4,849 m | identical |
| pooled sweep | 36 / 18 / 14, 2.0 / 4.4 Myr, +1 / +172 / -115, 6 over 3 Myr | identical |

(My script gives F_near and A_near as the rounded medians; "A_near -0" for LIN ulp is the README's "0".)

### 2.2 Platform labels

The README table has a platform on every row (WIN / LIN / pooled), and the text names node 26.7.0 and node 22.23.3. The README says the plain Gulf runs differ in median exposure (4.4 against 8.7 Myr) because each has 5 or 6 exposed crests, which is the D16.4 warning, and quotes pooled medians for the conclusion. Pass.

### 2.3 Test 12

- Fixed spike, WIN (I ran `node test.js`, 43 s): ALL PASS, 50 checks. Census: 1,447 exposed column-records; longest run 1 record; deepest pit 61 m (200 ft); split 215 / 1,216 / 16. LIN, my own Linux run: longest run 1, deepest pit 51 m (168 ft), split 293 / 1,202 / 7, ALL PASS (section 7).
- **Unfixed engine: I ran it, not reasoned it.** I took `strata-lab/salt-r1-review` (the pre-fix spike), copied in the new `test.js` and ran it on WIN. Test 12 FAILS both assertions: longest run 295 records (29.5 Myr), deepest pit 1,573 m (5,161 ft); 5,354 exposed column-records. Identical to the coder's claim. (Test 13 then throws on the old engine because `st.H0` does not exist, as expected.) My scratch copy was removed afterwards.
- **Why the longest run is 1 here but 5 (WIN) and 8 (LIN) in SALT-R2:** different allowance. The test uses the thickness of the newest layer on a neighbour; my census used the larger seafloor gain of either neighbour. Both agree on the deepest pit and the position split. I accept the coder's DECISION. NON-BLOCKING remark: with this allowance the 10-record limit is loose (measured 1), so a regression with a run of 2 to 9 records would pass; the 100 m pit limit (measured 61 m) is the tighter guard. Fine for a spike.

## 3. S4b: checks

| Check | Result |
|---|---|
| Start section comes from the fixed spike at the stated time | Reproduced. I ran `dump_s4b.js` (writes to a scratch file): start section (121 columns), thin-sheet series (362 records) and crest-log row are identical to the committed `s4b-case.json` as parsed JSON (the files differ only in a line ending, byte 65474). Start time 24.9 Myr = crest 26's first record under 500 m of cover. The crest column's start cover is 427 m in both. |
| Same crest as SALT-R2 | Yes: id 26, col 270 -> 275, exposed 27.5 to 33.7 Myr (6.2 Myr), buried 60.9 Myr, F_near -30.5, A_near +0.9, F-A -31.4: exactly SALT-R2's table (section 3.4 there). |
| Settings match S4 case A, cover x1 | The run output's own config: 180 x 37 cells, dx 500 m, dy 249 m, salt 1e18 Pa s, cover 1e19 Pa s, name `gulf-A-s4b`; `cases.js` diff is only the `S4B` env switch (start, forcing, thin-sheet crest from the S4b case), S4 path unchanged. The README lists the remaining settings (sticky water 1e16, CFL 0.5, theta 0.5, 5x5 markers, seed 4321, median-filtered sediment level). I read the diff, not the whole solver again. |
| Benchmarks pass | Spike 004 `test.js` 12 of 12 on WIN (my run, section 7) and on LIN; spike 003 test ALL PASS on both. |
| Headline numbers reproduced | **I reran the full Stokes run on WIN** (10.3 min here; the coder logged 8.9). Same 1,271 steps, same salt area change +0.988 %; `analyse_s4b.js` output on my run is identical to the committed `s4b-results-windows.md` line for line, except the wall-clock minutes. My own script (`salt-r3.mjs`) gives: cover at 30, 40, 50, 60 Myr = 301, 612, 323, 257 m; no record under 100 m (0 of 83); minimum 105 m (whole box, at 61.4 Myr); minimum 138 m up to the thin-sheet burial; F-A over 55.9 to 60.9 Myr: thin -28.1, Stokes +4.9 m/Myr; first 10 Myr: thin +28.9, Stokes -31.4. All match. The Linux run I did not repeat (reasoned from its committed tables only); its tables are internally consistent with its case file. |
| Crest followed is the right one | For the thin sheet, yes (section above). For Stokes the follower takes the highest salt top within 4 km of its previous position and wanders from 264 to 291 km (README says so). That is not the same structure as the thin sheet's fixed column 275, so rates at the Stokes "crest" are low-confidence. The verdict does not depend on the follower: the shallowest salt anywhere in the 90 km box after the start record is 105 m (WIN, 61.4 Myr), and on LIN 45 m once (65.4 Myr). |
| Mass balance | Stokes salt area +0.99 % WIN, +0.78 % LIN (marker-in-cell; README limit says up to 1.3 %); thin sheet 1.4e-14 total, 3.6e-15 salt. My cell-sum of the window's thin-sheet salt is 159.415 km2 against Stokes 159.349 km2 at the start. Small beside 100 to 600 m of cover. |

## 4. The S3 question, re-answered

Question (literature section 9): is exposed salt buried within a few Myr while the 4 km source is thick a thin-sheet limit, or geology?

**Answer: a thin-sheet limit, for the two things that matter. Confidence: medium to high that Stokes does not hold the crest at the surface; medium that the thin sheet's steady fall relative to the flank is a thin-sheet artefact; low on the size of the cover and the rates.**

Evidence (WIN, one Stokes run; LIN agrees in kind, one run):

1. **No exposure in Stokes.** Cover over the followed crest never goes below 138 m (453 ft) up to the thin-sheet burial at 60.9 Myr; 0 of 83 records under 100 m; the whole-box minimum is 105 m (344 ft). The thin sheet holds the same crest at the seafloor for 6.2 Myr. LIN: 165 m or more up to 56.1 Myr, with three late dips (79 m, 62 m, and a 45 m touch in the crest zone at 65.4 Myr), 8 to 9 Myr after the thin-sheet burial, treated as noise as in S4.
2. **Stokes does not fall like the thin sheet.** In the last 5 Myr before the thin-sheet burial, the thin sheet's salt top falls 28 m/Myr (92 ft/Myr) relative to the flank (LIN: 23). Stokes rises +5 m/Myr (+16 ft/Myr; LIN: +17). SALT-R2's second change-my-mind condition ("a Stokes crest that also falls about 30 m/Myr") is therefore not met. Stokes' cover over the same crest goes down, from 612 m at 40 Myr to 152 to 257 m at 60 Myr, while the thin sheet's goes up, from 69 m to 501 m.
3. **The one place Stokes falls about 30 m/Myr** (-31 WIN, -32 LIN, first 10 Myr) is the flank aggrading at 35 to 38 m/Myr past a salt top that rises 2 to 7 m/Myr; the thin sheet rises 36 and 25 m/Myr in that window. The cause is different from the thin sheet's, and the models disagree there too.

What this means. The fixed thin-sheet model buries a crest under about 4,500 m (14,760 ft) of neighbouring salt by a steady fall of the salt top. Stokes, given the full 4 km layer with closed sides and the same prescribed seafloor, does not. So that fall comes from the thin-sheet method, and the literature expects the same (no published burial case has a thick source behind it: VJ92b pp. 364-365; HJ07 p. 24, from the salt-review notes, not re-read in this round). The other half is equally clear: Stokes does not show a passive diapir held at the seafloor either (viscous cover, Newtonian). So, as I read it (judgement): **the Gulf slab, with a 1e19 Pa s cover, in either solver, does not make a long-lived exposed crest. The thin sheet's 2 to 16 Myr of exposure is not supported by Stokes. Where the cover is viscous, the crest is buried by 100 to 600 m of cover and does not come to the seafloor.**

Not a settled geological finding. What keeps confidence off "high":
- One start section and one run per platform; S4's own scatter between grids A and B is 100 to 250 m. The cover history (612 m, 152 m) is that scatter or worse. The sign of the difference (no exposure; no steady fall) is what is supported, and it agrees with S4's 12 runs on the older start section.
- Newtonian cover only. Neither solver can fail the roof (literature section 7 item 4; Fernandez & Kaus 2015 as cited by GL24 p. 631 against GL24 Fig. 10a). A brittle cover is still the open question (option F).
- The box has closed sides and the Stokes salt body spreads about 10 to 20 km basinward with its cover, while the thin sheet's columns are fixed in x (D10). Part of the thin-versus-Stokes difference may be that translation, not the flow law. That favours option E more than C, and E stays out.
- The Stokes crest follower wanders (264 to 291 km), so its F and A are low-confidence; the cover minimum (whole box) is not.
- A late, partial re-shoaling in Stokes: cover goes from 612 m at 40 Myr to 105 to 150 m by 61 to 66 Myr (F-A about +5 to +17 m/Myr on both platforms). The README calls the crest "buried throughout" (true) and says Stokes "supports the burial itself" (see N-8 below).

What would change my mind: a Stokes run with a brittle or weak roof that brings the crest to the surface and holds it; or a Stokes run on a wider box with salt arriving from outside that falls the way the thin sheet does.

## 5. Option C: recommendation for John

**Recommendation: do not build C for the Gulf slab. Confidence medium. John decides.**

What C is: a feed so a crest keeps drawing salt from its neighbours, so that a crest could last longer. It is not a means of keeping salt on the seafloor; burial of a diapir is expected geology and the output should show it.

Why not (evidence):
1. The Stokes model already has the whole layer as its source (the 90 km window holds about 159 km2 of salt, 3.1 to 5.9 km thick on the landward side) and gets no exposure and no sustained fall. So the thin sheet's problem is not that it lacks a feed. The feed would be a tuned number with no published calibration (literature section 12).
2. A feed would make the thin sheet's crest rise more, which moves it further from the Stokes answer, not closer.
3. The part of the thin-sheet result that Stokes does not reproduce (exposure for 2 to 16 Myr, steady fall at 33 m/Myr) is something option A will display with the rates, and the reader can then judge it. A's per-crest F, A and F - A are already trustworthy (SALT-R2 section 3.4).

What would reopen C: a case like GL24's down-building run, where a thick source and a fast-rising surface keep crests in step for 30 Myr (GL24 Fig. 10a); the S3 README notes the thin sheet drains that case in 3 Myr. If M3b is ever meant to reproduce that kind of crest, C or D is needed, and that is a separate product decision, not an S3 repair.

### M3b options line (changed from SALT-R2 section 7)

| Option | Now |
|---|---|
| A | first, and in scope (D23), unchanged |
| B | later sensitivity test only, unchanged |
| **C** | **not on this evidence: Stokes with the full layer as source also buries the crest. Reopen only for a GL24-like thick-source down-building case.** (SALT-R2: conditional on N-3, now answered.) |
| D | long-term, unchanged; its one-off offline use for S3 is done (S4, S4b) |
| E | out, unchanged; note that spreading cover may explain part of the thin-versus-Stokes difference |
| F | still the open one: neither solver can fail the roof |

Suggested wording for `docs/roadmap.md`: "Option C: S4b (Stokes rerun from the fixed spike) buried the crest too, so a feed is not recommended for the Gulf slab (SALT-R3, medium confidence). John decides."

## 6. New findings

- **N-5 NON-BLOCKING (stale text after the merge).** `spikes/003-passive-diapir/README.md` (the paragraph "The S3 question after the fix") still says S4 "has not been rerun on the fixed model" and "this paragraph is to be revised when it reports". S4b has now reported (`spikes/004-stokes-check/README.md`, S4b section). The two cards ran in parallel, so each is right alone and the merged page is stale. Minimum fix: replace the last sentence of that paragraph with a pointer to the S4b answer and this review's section 4.
- **N-6 NON-BLOCKING (the S3d "what would change the answer" line).** The coder asked whether "a Stokes crest falling about 30 m/Myr would point to geology, not the thin sheet" follows SALT-R2. It does: SALT-R2 section 5 lists it as a condition that would change my mind. Closed; no change.
- **N-7 NON-BLOCKING (S4b README, Stokes "crest" meaning).** The Stokes follower wanders 264 to 291 km, and the thin-sheet column stays at 275 km. The F, A and relief columns compare two different positions. The README already says the follower wanders; minimum fix: add "the Stokes F and A are at a moving point, not at the thin sheet's column" next to the rate table.
- **N-8 NON-BLOCKING (S4b README wording).** "The burial itself (100 m or more of cover on the Windows crest for the whole run) is supported by Stokes" is true but could be read as "Stokes agrees with the thin sheet's 500 m". At 60.9 Myr the thin sheet has 501 m and Stokes 152 m (difference 349 m, above the 100 to 250 m scatter), and Stokes is shoaling then. Minimum fix: say "Stokes also buries the crest, but by 100 to 260 m late in the run, not 500 m, and the cover is thinning."
- **N-9 NON-BLOCKING (run hygiene).** The S4b run output (`out-gulf-A-s4b.json`) and `forcing-s4b.json` are not committed (scratch), so a reviewer must rerun 9 to 10 minutes, as I did. Fine for a spike; the committed results tables reproduced exactly.

## 7. Gates

- Windows (node 26.7.0): `npm ci`, `npm run check` exit 0 (main project 41 files, 443 passed, 1 skipped; wallclock project 6 files, 89 passed, 1 skipped), `npm run build`, `npm run check:offline` (0 external hosts) and `npm run verify:built` OK; spike 003 `test.js` ALL PASS (50 checks); spike 004 `test.js` 12 of 12.
- Linux (WSL Ubuntu, node 22.23.3, fresh clone of this branch): `npm ci` and `CI=true npm run check` exit 0 (main 41 files, 443 passed, 1 skipped; wallclock 6 files, 82 passed, 8 skipped; skip counts differ by platform as before). Spike 003 `test.js` ALL PASS, with test 12 reproducing the coder's LIN numbers: 1,502 exposed column-records, longest run 1 record, deepest pit 51 m (168 ft), split 293 / 1,202 / 7. Spike 004 `test.js` 12 of 12.
- `git diff strata-lab/salt-r2-recheck -- src tests` is empty.
- Public repo: this review and `scripts/review/salt-r3.mjs` hold no local paths, personal data or secrets.

## 8. QC items touched

10 rise-to-accumulation per crest: pass (unchanged; F, A reproduced by SALT-R2). 11 neighbour salt: pass (README 4,499 m pooled, reproduced). 13 dissolution sink: named in the 003 README (D = 0). 14 roof at exposure: unchanged. 15 Stokes comparison: now done on a fixed start section (S4b), with the limits in section 4. 1 mass balance: pass. 2 one ulp: pass (medians quoted, D16.4). 21 viscosity range: S4b ran cover x1 only (card scope); S4's x10 and x0.1 runs are on the older start section.

VERDICT: APPROVE
