# LIN review: citation check of LIN-1 and LIN-2 (D33)

Card LIN-R (safety-reviewer), 2026-10-21. Branch reviewed: `strata-lab/lin-02-yang-aplin` at `da7a919`
(LIN-2, stacked on LIN-1 `2625ab5`).

This file was written by the orchestrator from the reviewer's handoff, because the reviewer ended the
card without committing it. The orchestrator re-ran the DOI check (point 1) itself. Both are marked below.

## Scope
Docs and `scripts/lineage/` only. `git diff origin/main...da7a919 -- src` is empty. No parameter,
preset or Gulf default changes.

## Findings (reviewer)
1. **Gates on a clean clone of the tip:** `npm run check` exit 0 (typecheck, lint, 540 passed and 1 skipped;
   wall-clock suite 91 passed and 1 skipped), `npm run build` ok (single file), `npm run check:offline` ok
   (0 external hosts, 10 inert URL strings).
2. **Trace script:** the permeability trace re-ran and gave the same 52 edges. Only citation counts and one
   link drifted. Inferred links are labelled inferred.
3. **Yang and Aplin full texts:** read directly. The permeability equation, the clay-fraction equation, the 2004
   stress relations (North Sea and Gulf of Mexico) and the e100 coefficients agree with the notes. The
   Wagner and Jackson 2011 viscosity range quoted in the ledger also agrees.
4. **Printed coefficient:** `docs/pp-notes/yang-aplin-2010.md` keeps the printed 0.89 in the e100 equation and
   flags it as probably 0.089. The reviewer's arithmetic supports 0.089 (it reproduces the paper's linear fit;
   0.89 gives a negative value). Keeping the printed value with the flag is correct.
5. **Labels:** every unsourced numerical or set-up parameter is marked "tuned" or "not traced" with a reason.
   Nothing is presented as cited that is not.
6. **Public-repo hygiene:** no local paths, secrets, emails or organisation names in the diff (name matches were
   author names only). No PDFs or images committed.

## Minor notes (non-blocking)
- M-1. `docs/lineage/water-density.json`: work W7057982713 ("Mathematical Statistics", Freund and Walpole,
  1972) is in the seed's OpenAlex reference list, so the edge is "verified" under the D29 definition (the
  citation is in the data). It is probably an OpenAlex reference-matching error and adds nothing to the
  water-density trail. Leave it as traced data; a later lineage rerun or a note can drop it.
- M-2. The reviewer's working notes for the full re-check of the non-permeability lineage files were lost to
  context compaction, so that pass is not itemised here. The orchestrator re-check below covers the citations themselves.

## Orchestrator re-check (2026-10-21)
- Every DOI in `docs/parameter-lineage.md` and both Yang and Aplin notes, plus seed DOIs in the 25
  `docs/lineage/*.json` files: 25 distinct DOIs (27 with case variants). All resolve on Crossref to the paper
  named in the ledger (first author and title checked). Note: Crossref dates the Clauser and Huenges AGU
  Reference Shelf chapter 2013 (online reissue); the ledger's 1995 is the print year.
- Lineage files: 25 files, 1,223 edges, 1,217 verified, 6 inferred.

VERDICT: APPROVE
