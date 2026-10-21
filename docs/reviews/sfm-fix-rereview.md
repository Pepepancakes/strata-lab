VERDICT: APPROVE

# SFM-6 re-review of the SFM-5 documentation fix

Branch strata-lab/sfm-06-rereview (SFM-5 merged, fast-forward, commit ffbcd7f). Reviewer: safety-reviewer.

## 1. Scope of the diff
`git diff strata-lab/sfm-04-review..HEAD --stat`: 4 files, docs/physics-references.md, docs/roadmap.md, docs/user-guide.md, tests/shelfEdge.test.ts.
- Nothing under `src/` (diff is 0 lines), so `ENGINE_VERSION` is unchanged.
- No golden, no fixture. The test file change is two comment lines only (no code line).

## 2. Numbers against the scripts (rerun)
- 02-shelf-depth-sweep, Windows node 26, depth 50 m, steps at or above 0.8 x highest sea level: 80 m = 0.007 (doc: about 0.7 %, matches); 40 m = 0.088 (doc: about 9 %, matches within rounding).
- Same script, Linux node 22: 80 m = 0.008, 40 m = 0.084 (8.4 %). Docs name Windows for these, so no error; "about 9 %" is a fair rounding of 8.4 to 8.8.
- 04-claims, Windows: shelf edge within 2 km at step 6 = 0.030 Myr; share reaches 0.9 x cap at step 11 = 0.055 Myr. Linux: identical steps. Docs say 0.03 and 0.055 Myr, matching.
- Grep for "0.3 Myr" and "under 5 %" across docs, src, tests: no shelf-fill or highstand claim remains. One unrelated hit (salt-evidence-review, a salt thickness line).

## 3. F-D and Gulf bands
F-D is recorded in docs/roadmap.md (min / median / max, platform named, grid agreement failing on Linux, John sets bands). No band or `it.fails` changed in the diff.

## 4. Gates
- Windows node 26, `npm run check`: exit 0. First suite 568 passed, 2 expected fail, 1 skipped (53 files). Second suite 85 passed, 6 expected fail, 1 skipped (6 files).
- Linux (WSL node 22, clean clone of this branch): `CI=true npm run check` second suite 76 passed, 8 expected fail, 8 skipped, 6 of 6 files passed. Those 8 expected fails include the 2 known Linux-only cases.

## Non-blocking notes (no change needed for approval)
- N1: docs/physics-references.md says 12.5 % at 0 m; the script prints 12.4 % (0.124) by the 0.8 x definition (11.8 % by the top-20 % definition). Worth a one-digit fix if someone touches the line.
- N2: The text "stays 1 to 2 km from the shoreline at every stand" is a summary. Measured at constant sea level: 573 of 594 steps within 2 km, all within 4 km, median 1 km (Windows); 576 and 592 on Linux. Not misleading, but not literally "every".
- N3: Linux cannot run the 2 wallclock-gated Windows counts the same way; unchanged from SFM-4.
