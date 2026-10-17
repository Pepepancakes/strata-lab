# SALT-R2: re-check of the S3c bypass fix

Reviewer: salt-reviewer profile, 2026-10-17. Branch `strata-lab/salt-r2-recheck` = main (M4 merged) + `wt/t_f3c312dd` (S3c, HEAD 07aa31a, which contains `strata-lab/salt-r1-review`). The merge had one conflict, in `docs/physics-references.md` (M4 added a section, S3c's parent added the SALT-1 section at the same spot); I kept both. Reviewed against `docs/reviews/salt-evidence-review.md` (SALT-R1). Own code: `scripts/review/salt-r2.mjs` (modes `pit`, `pool`, `rates`); it runs the spike engine only to make the state it then measures itself. Nothing in `src/` or `tests/` was touched; `git diff strata-lab/salt-r1-review wt/t_f3c312dd -- src tests` is empty.

Units for John: 100 m = 328 ft; 33 m/Myr = 108 ft/Myr; 4,500 m = 14,760 ft. Platform labels: WIN = Windows, node 26; LIN = Linux (WSL Ubuntu), node 22.

## 1. Short answer (docs fix versus physics fix)

- **The physics fix is sound.** The bypass rule now sheds only from a topographic high, tests on the seafloor at the start of the record step, and splits by slope. The holes are gone: deepest hole under any exposed column 61 m (200 ft) WIN and 51 m LIN, against 1,573 m (5,160 ft) with the old rule; longest time a column stayed over its allowance 5 records (0.5 Myr) WIN and 8 (0.8 Myr) LIN, against 410 records (41 Myr). Mass balance closed, zero clips, `npm run check` green on both platforms.
- **What is missing is documentation, not physics.** The spike 003 README still prints the pre-fix results block ("exposed 1 to 48 Myr", "burial by flank aggradation") and the old bypass sentence. The rerun numbers exist only in the coder's scratch. I reran everything myself (section 5) so John does not have to wait for them. Fixing that is a README edit; no engine change.
- **One thing the numbers change about the story.** Exposure is not gone: median 4.8 Myr, longest 16.2 Myr (pooled, both platforms). And the crests are not buried by the flank rising (flank rise about 0 m/Myr); the salt top falls about 37 m/Myr under thick neighbours. See section 4.

VERDICT summary: S3-1 CLOSED, S3-2 CLOSED, S3-3 and S3-4 OPEN (README), one new BLOCKING finding that is docs only (D-1). VERDICT: REQUEST CHANGES, on documentation grounds only.

## 2. SALT-R1 findings, status

| Finding | Status | Evidence |
|---|---|---|
| S3-1 BLOCKING bypass sheds fill of a hole | CLOSED (with N-1) | section 3 |
| S3-2 rate window includes burial step | CLOSED | section 3.4 |
| S3-3 README bypass sentence | OPEN | `spikes/003-passive-diapir/README.md:72` still says "shares sediment equally to the two lower sides"; the S3c section lower down says the rule changed but the old open-question line and results block are untouched (D-1) |
| S3-4 platform of quoted numbers, medians not single crests | OPEN for spike 003, CLOSED for spike 004 | spike 004 README now names Windows/node 26 for the crest-21 case and says Linux never exposes it; spike 003 README quotes no new numbers at all, and the committed CSV and its header name no platform (D-2) |
| S4-1 van Keken values secondary | CLOSED | spike 004 README table rows and caveat; physics-references has no van Keken entry to relabel |
| S4-2 relief as A/B range | CLOSED | README "Answer": range across both grids, scatter 100 to 350 m, "only its sign is supported" |
| S4-3 "neither alternative" wording | CLOSED | README: "buried throughout, with a cover of order 100 to 700 m that is not converged" |
| S1-1, S1-2, S1-3 (SALT-1 notes) | not in this card's scope, unchanged | |

## 3. Checks

### 3.1 Bypass code (engine.js:629-690 in the branch, read, not just run)
- Depression test uses `st.H0`, set in `step()` at line 754 after the subsidence and before any deposit (`st.H0.set(st.H)`), not the surface after the substep deposit. Correct: the substep's smoothed surface can no longer turn a hole into a "high".
- Shedding only from a high: `receivers` returns nothing if either nearest non-exposed neighbour has `H0` above this column. A column on a slope (one neighbour higher) keeps what arrives. Hand test 13c covers exactly this.
- Split follows the slope: weight = (H0[j] - H0[q]) / (distance), normalised; level top splits equally; exposed neighbours are skipped and the real distance is used (test 13e: 8/3 hand value reproduced, 2.6667). Test 13a gives 2 / 6 against hand 2 / 6 for sand and 1 / 3 for mud.
- Conservation: `s*w` and `m*w` per grain size, weights sum to 1; the bulk added to the receiver is computed at the receiver's own cell. Balance in my runs: salt 3.6e-15, sand -2.2e-14, mud -9.5e-15, clip 0 (WIN Gulf); salt -1.8e-16, sand -8.7e-15, mud -1.6e-14 (LIN). Test run passes 50 checks WIN and LIN, ALL PASS.
- One design note (judgement): `H0` is fixed for all five substeps of a record, so a column that becomes a high during the record is judged on its start-of-record state. That is conservative (it sheds less), which is the right direction.

### 3.2 Pit census, my own code (`salt-r2.mjs pit`, every 0.1 Myr record, not the 8 marks the test uses)
Pit = lower non-exposed neighbour's seafloor minus the column's; allowance = largest seafloor gain of either neighbour over that record step (plus subsidence), my own measure.

| | exposed column-records | below both | above both | max pit | records over allowance | over it at 2 successive records | longest run |
|---|---|---|---|---|---|---|---|
| old rule (`salt-r1-review`), WIN | 5,354 | 3,487 | 53 | 1,573 m (5,160 ft) | 3,106 | 3,037 | 410 records (41 Myr) |
| S3c, WIN | 1,447 | 215 | 16 | 61 m (200 ft) | 29 | 9 | 5 records |
| S3c, LIN | 1,502 | 293 | 7 | 51 m (167 ft) | 57 | 26 | 8 records |

`salt-r1.mjs pit` (R1's script) on the fixed spike, WIN: 0 to 1 exposed column at the marks from 20 Myr on, none "above both", one "below both" at 10 Myr; LIN: 1 to 3 "below both" at 10 Myr (deepest step 98 m) and 1 at 50 Myr (37 m). Column 271 is never exposed at a mark on either platform. Compared with R1's table (9 of 11 exposed columns below both, 983 to 1,941 m deep from 40 Myr), S3-1 is closed. The pits that remain are notches of tens of metres lasting up to 0.8 Myr, the size of a record step of deposition, which is what the card allowed.

The coder's census (test 12) says 12 column-marks WIN and 15 LIN with no holes: reproduced exactly (both numbers appear in my test logs).

### 3.3 Regression test against the unfixed spike: RAN, not reasoned
I made a scratch worktree of `strata-lab/salt-r1-review`, copied in the new `test.js` only, and ran `node test.js`. Test 12 FAILS on the old engine: holes (over the allowance at two successive records) at 20, 27, 30, 40, 50, 54 and 66 Myr, that is 7 of 8 marks; 10 Myr passes; deepest pit 1,268 m at 50 Myr; 67 exposed column-marks. (Test 13 then throws on the old engine because `st.H0` does not exist; expected.) On the fixed spike test 12 and 13 pass. So the test detects the bug and the fix removes it.

### 3.4 S3-2 rate window
`crestlog.js`: `nearRecs = s.filter(q => q.cover < NEAR)`, last 1 Myr of those; `F_pre/A_pre` stay as "rate at burial", both in the CSV with a four-line header stating the windows. Closed. Hand check with my own follower (`salt-r2.mjs rates`, same following rule, own least squares), against `gulf-crests.csv` (WIN):

| crest | mine F_near / A_near / F-A | CSV | mine F_pre-window F-A | CSV |
|---|---|---|---|---|
| id 8 (start col 229, final col 255, exposed 12.1 Myr) | -37.5 / -3.1 / -34.4 | -37.5001 / -3.09787 / -34.4022 | -34.6 | -34.5549 |
| id 26 (start col 270, final col 275, exposed 6.2 Myr) | -30.5 / 0.9 / -31.4 | -30.5154 / 0.910062 / -31.4255 | -34.4 | -34.3955 |

Match to the digit. (Minor: F_near and F_pre are now within 3 m/Myr of each other because the burial squeeze R1 saw was the hole filling; the two columns are still worth keeping.)

### 3.5 Mass balance and gates
Per material and clips: section 3.1. `npm ci` and `CI=true npm run check` exit 0 on WIN (41 files / 443 passed, 1 skipped; wallclock 6 files / 82 passed, 8 skipped) and on LIN (fresh clone of this branch, node 22.23.3): identical counts. Spike `test.js` ALL PASS on both. `git diff strata-lab/salt-r1-review wt/t_f3c312dd -- src tests`: empty.
Note: the card's Linux script `strata-linux-salt-r2.sh` was not on disk; I wrote an equivalent (fresh clone, `npm ci`, spike test, `s3b gulf/ulp/sweep`, both pit scripts, `npm run check`).

## 4. S3b rerun, my numbers (WIN and LIN, node `s3b.js gulf`, `ulp` (six 1-ulp salts) and `sweep`)

Pooled with my own `pool` mode (the coder's `s3c-pool.js` gives the same figures): medians, because single crests are noise-sensitive (D16.4).

| run set | crests | exposed | exposed then buried | exposure median / longest (Myr) | F_near / A_near / F-A median (m/Myr) | neighbour salt at 10 km, median |
|---|---|---|---|---|---|---|
| WIN plain Gulf | 12 | 6 | 5 | 4.4 / 12.1 | -38 / +1 / -33 | 4,849 m |
| LIN plain Gulf | 11 | 5 | 4 | 8.7 / 12.9 | -37 / -5 / -33 | 4,361 m |
| WIN six ulp runs | 73 | 30 | 23 | 5.4 / 16.0 | -36 / -3 / -32 | 4,436 m |
| LIN six ulp runs | 73 | 32 | 26 | 4.7 / 16.2 | -37 / 0 / -33 | 4,508 m |
| pooled, 14 runs | 169 | 73 | 58 | 4.8 / 16.2 (55 of 73 over 3 Myr) | -37 / -1 / -33 | 4,499 m (14,760 ft) |
| WIN 16-run sweep (150 km strip) | 18 | 9 | 7 | 2.0 / 4.4 | about 0 / +172 / -115 | 1,911 m |
| LIN sweep | 18 | 9 | 7 | 1.9 / 4.4 | about the same | |

Before the fix (README, WIN): exposed 1 to 48 Myr (median 24), F-A at burial -382 to -57 m/Myr, 25 of 36 sweep crests exposed. After: exposure about 5 Myr median, 16 Myr at most (about one fifth of the old median), F-A -33 m/Myr, 9 of 18 sweep crests exposed for 1 to 4 Myr. WIN and LIN agree on the pooled medians within 1 m/Myr for F-A and within 1 Myr for exposure; the plain-run medians differ (4.4 against 8.7 Myr) because there are only 5 or 6 crests each, which is what D16.4 warned about.

What the rates say (judgement, labelled): a typical exposed crest has its salt top falling about 37 m/Myr (120 ft/Myr) while the flank seafloor is flat (A about 0). It is not buried by the flank aggrading, and it is not buried because the source ran out (neighbours still hold about 4,500 m, 14,760 ft, of salt, L/h 10 to 16). The R1 phrase "burial by flank aggradation" no longer describes this model, and "supply exhausted" is also excluded. By QC red flag "burial with thick neighbours" the thin-sheet method is the first suspect: no published burial case has a thick source behind it (VJ92b pp. 364-365; HJ07 p. 24, from the salt-review notes; I did not re-read them in this round).

## 5. The S3 question, re-answered

Question (literature section 9): is exposed salt buried within a few Myr while the 4 km source is thick a thin-sheet limit or geology?

Answer: **still a thin-sheet limit in the model, but the evidence is now weaker and different from SALT-R1.** The 27 Myr exposure was a bug (high confidence, measured). What the fixed model does is expose crests for a median of 5 Myr (up to 16 Myr), then bury them by a steady fall of the salt top of about 33 m/Myr relative to the flank, under thick neighbours. That is "a few Myr" in the literature's sense only roughly, and it is the thing the thin sheet is least able to hold up. Confidence: medium that this is a thin-sheet limit (down from medium-high), because (a) S4's Stokes comparison was made on a start section and a crest (id 21) that no longer exist in the fixed spike, and was not rerun (N-3); (b) neither solver has a frictional or faulted roof (section 7 item 4 of the literature: Fernandez & Kaus 2015 as cited by GL24 p. 631 disagree with GL24 Fig. 10a). What would change my mind: a Stokes run from a fixed start section that keeps the crest at the surface for more than about 5 Myr, or a Stokes crest that also falls about 30 m/Myr.

## 6. The four open S3 questions (only where numbers changed)

1. Prescribed feed versus a source layer: unchanged, no feed in the product. The fall of the salt top is now a measured 33 m/Myr, but a feed would be a tuned number with no published calibration; test with Stokes first.
2. Dissolution of exposed salt: wording changes. R1 said exposure "will be rare and short". It is not rare (73 of 169 crests exposed) and not very short (median 4.8, up to 16 Myr). Still not in M3b, but the output must name the missing sink wherever salt is exposed (QC 13), and the README must stop calling exposure rare.
3. Bypass following the slope: done in the spike (S3c). Not ported; `src/engine` has no exposed-salt bypass, so nothing there to fix.
4. Roof thinning as a tuned rule: unchanged, still labelled tuned, `shed` off by default. I did not re-measure the Gulf shed counters in this round.

## 7. M3b table (options A to F), updated

| Option | SALT-R1 | Now | Changed by these numbers? |
|---|---|---|---|
| A per-crest rise-to-accumulation output | first | first, and its prototype is now trustworthy: both windows reported, two crests reproduced to the digit (F, A) | strengthened |
| B power-law salt | sensitivity only | same | no |
| C source-layer feed | not needed for Gulf sheet | same, conditional on N-3 (one Stokes check on the fixed spike) | no, but conditional |
| D full Stokes | long-term | long-term; its first use is the N-3 rerun | no |
| E translating cover | out | out | no |
| F frictional cover | the open one | still the open one: the fixed model still buries a crest under thick salt and neither solver can fail the roof | no |

**The SALT-R1 recommendation for M3b (A first; C not needed for the Gulf sheet; D long-term; E out; F the open one) still holds.** Confidence medium. The one new condition is N-3: do the cheap S4 rerun before deciding C.

## 8. New findings

- **D-1 BLOCKING (documentation only, no physics change).** `spikes/003-passive-diapir/README.md` lines 72 and 83-89 carry pre-fix statements: "bypass shares sediment equally to the two lower sides", "Exposed 1 to 48 Myr (median 24)", "At burial F-A is -382 to -57 m/Myr... Burial is by flank aggradation", the 16-run sweep and six-ulp lines, and "43 checks" (now 50). The S3c section below them says the old crests were holes, so the page contradicts itself, and the rerun numbers (section 4 here) are in no committed file. Minimum fix: replace the results block with the rerun numbers (name platform on each; medians; the pooled row), replace line 72 with "bypass sheds only from a topographic high, tested on the seafloor at the start of the record step, split by slope", replace the flank-aggradation sentence with the measured F and A, and answer the S3 question in one paragraph (section 5 here).
- **D-2 NON-BLOCKING.** Only the WIN `gulf-crests.csv` is committed and the CSV header names no platform or node version. Minimum fix: add "Windows, node 26" to the CSV note lines (or commit `gulf-crests-linux.csv`), and commit the pooled figures of section 4 (or the six-ulp CSVs) next to it.
- **N-1 NON-BLOCKING.** Test 12 asserts at 8 marks only and only for holes (over the allowance at two successive records). My every-record census shows 9 (WIN) and 26 (LIN) column-records over at two successive records, longest 5 and 8 records, max pit 61 and 51 m. All small, none a hole in the S3-1 sense, but the test would not notice a short regression. Minimum fix: run the census at every record and assert "no run longer than 10 records and no pit over 100 m (328 ft)".
- **N-2 NON-BLOCKING.** Exposed columns almost never stand above both neighbours (7 to 16 of about 1,450 to 1,500 column-records). They sit on slopes. That is what the rule produces, and the README should say it, because a reader will picture an exposed crest as a high. Minimum fix: one sentence plus the "above both / mixed / below both" split.
- **N-3 NON-BLOCKING.** S4's Stokes comparison used a start section cut from the pre-fix run (it inherits crest 13's hole; the README now says so) and a comparison crest that does not exist after the fix (exposed 26.8 to 54 Myr, WIN). The fixed spike's equivalent (id 26, col 271, WIN) is exposed 6.2 Myr and buried at 60.9 Myr; on LIN the equivalent (id 83) is exposed 2.0 Myr. Minimum fix: one S4 run (A, cover viscosity x1) from a start section cut from the fixed spike at about 24.9 Myr, to see whether Stokes holds the crest up longer than the thin sheet (15 to 120 minutes, S4 README). Not blocking because S4's answer was about the artefact, and the artefact is now confirmed independently.
- **N-4 NON-BLOCKING.** The decision log D22 and the handoff say the S3b rerun was done; I confirm the rerun is reproducible, but the committed record should include its command lines (`node s3b.js gulf|ulp|sweep`, `node s3c-pool.js ...`) in the README results block. Folds into D-1.

## 9. QC checklist items touched by this round

10 Rise-to-accumulation per crest: pass as a measurement (both windows, hand-checked). 11 Neighbour salt and L/h: pass (about 4,500 m at 10 km, L/h 10 to 16). 13 Dissolution sink named: still named, but must be restated after the exposure numbers change (section 6). 14 Roof at exposure: roof ratio at exposure 0.01 to 0.05 in the CSV, measured, not interpreted. 1 Mass balance: pass. 2 One ulp: pass; medians quoted, D16.4 followed in the pool. 21 Viscosity range: sweep varied salt viscosity 1e16 and 1e17 (spike units), not rerun beyond that. Other items unchanged by this round.

VERDICT: REQUEST CHANGES
