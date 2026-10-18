# AUD-8 Re-review of the AUD-7 fix (last round)

Branch `strata-lab/aud-08-rereview`, on top of `strata-lab/aud-07-fix` (55dea18). Reviewer: safety-reviewer.
Platforms named on every number: Windows node 26, Linux WSL node 22.

## Result

Both AUD-6 blocking findings are closed. No blocking items. Three non-blocking notes.

## Checks

1. B-1 (shallow overpressure). Closed.
   - Re-ran `scripts/review/aud-06/shallow.mjs` (Windows node 26): Gulf hash 12e30532bcb48ca7. Hart mud, 500 ft below sea floor, columns 100/150/200/250: 9.65, 10.45, 10.49, 9.35 ppg (range 9.35 to 10.49); North Sea mud 8.59 to 8.62. At 2,000 ft: 10.24 to 12.16 (10.2 to 12.2) against 8.73 to 8.79 (8.7 to 8.8). Matches the card.
   - `docs/physics-references.md` (AUD-3 Limits, line 390) and `docs/decisions.md` D26.4 (line 279) give the exact numbers, the cause (tuned permeability law log10 k = kA + kB phi, not re-fitted for phi0 0.40) and "nothing was retuned". Linux numbers are added beside the Windows ones.
   - `docs/user-guide.md` (line 459) gives the same numbers rounded (9.4 to 10.5 against 8.6).
   - Gulf preset note (`src/engine/presets.ts:79`) and Backlog (`docs/roadmap.md:395`) carry the finding more briefly; see N-A.
2. B-2 (label). Closed.
   - grep "partly calibrated" over `src/`, `tests/`, `docs/`: only hits are in `docs/reviews/aud-batch-review.md` (my own AUD-6 report, quoted as the finding; a historical record, fine). None in src or tests.
   - `src/views/well/audit.ts:82-83` `GULF_NOT_CALIBRATED` begins "Not calibrated to the Gulf:", names Hart coefficients (one well, fitted above 4,900 ft), North Sea sand, tuned mud permeability, overburden and fracture gradient read low, shallow section reads over hydrostatic.
   - It reaches the pseudo-well note and planned-well notes (`notes.tsx:25`), the PNG title and CSV header (`exportWell.ts:88,120`, fed by `exportNotes` at `wellplan/index.tsx:462`), and the Physics checks line (`checks/index.tsx:32`).
   - `tests/auditLabels.test.ts:130-133` assert the prefix, "mud permeability is tuned", "shallow section reads over hydrostatic" and absence of "partly".
3. No physics change. Closed.
   - `git diff strata-lab/aud-06-review -- src/engine` is one line: the Gulf `note` string in `presets.ts`. No numeric or logic change.
   - Hash tests pass unchanged. Gulf hash is 12e30532bcb48ca7 (shallow.mjs run above); the preset hash tests cover the other five and pass.
4. N-2 to N-6 (new tests). Real.
   - Mutation: changed `if (uu > L[m])` to `if (false && uu > L[m])` in `src/engine/compaction.ts:202`. `tests/auditLabels.test.ts` "AUD-7 N-6" failed with "expected 0 to be greater than 0" (1 failed, 24 passed). Reverted; `git status` clean.
5. Gates.
   - Windows node 26: `npm run check` all green: main 47 files, 532 passed, 1 skipped; second project 6 files, 91 passed, 1 skipped. Build, `check:offline` (0 external hosts) and `verify:built` (Engine worker OK, 0 console errors) pass.
   - Linux node 22 fresh clone: see the handoff (result recorded there).
   - Screen check not repeated: no layout change (text and labels only).

## Findings

BLOCKING: none.

NON-BLOCKING
- N-A. The card asks that all four places give the same numbers. Two do not carry the full set. The Gulf note (`presets.ts:79`) gives 500 ft only, rounded (9.4 to 10.5 against 8.6) and not the 2,000 ft pair. The Backlog line (`roadmap.md:395`) gives only "1 to 2 ppg over hydrostatic". Nothing contradicts the others (the true excess is 0.75 to 1.9 ppg at 500 ft, so "1 to 2" is a fair round-up, slightly generous at the low end). Acceptable; the full numbers sit in references and D26.4.
- N-B. `docs/reviews/aud-batch-review.md` still contains the old wording as a quote. Fine as history.
- N-C. N-1 (crest list pushes the crest card below the fold at 1080p and 150 %) is handled by one sentence in the user guide, not by a layout change; N-7 and N-8 untouched. Those are conveniences, not safety items. John's choice.

## What John should look at (changed since AUD-6 section 8)

- The Gulf label wording: it now starts "Not calibrated to the Gulf:". Check it on the Gulf pseudo-well, planned well and a CSV export.
- The Gulf preset note: it now says the shallow section reads about 1 to 2 ppg over hydrostatic and that nothing was retuned.
- The Physics checks line on the Gulf preset: same wording, plus the "factor of 2 to 3 between machines" remark on the cap count.
- Decide whether the shallow overpressure stays as a documented limit or gets the permeability re-fit card (Backlog).

VERDICT: APPROVE
