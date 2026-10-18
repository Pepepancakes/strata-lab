#!/usr/bin/env bash
# AUD-6 mutation checks on the audit-fix batch. Each case changes one term, runs the test that should catch it,
# reports PASS (test blind) or FAIL (test caught it), and reverts with git checkout.
set -u
cd "$(dirname "$0")/../../.."   # repo root
run() { # name file sed-expr(-E) test-file-list test-name-filter
  local name="$1" file="$2" expr="$3" tfile="$4" filt="$5"
  sed -i -E "$expr" "$file"
  if git diff --quiet -- "$file"; then echo "$name: SED CHANGED NOTHING (anchor not found)"; return; fi
  local out
  if [ -n "$filt" ]; then out=$(NODE_OPTIONS=--no-experimental-webstorage npx vitest run --project main $tfile -t "$filt" 2>&1); else out=$(NODE_OPTIONS=--no-experimental-webstorage npx vitest run --project main $tfile 2>&1); fi
  local st=$?
  local tests
  tests=$(printf '%s' "$out" | grep -E "Tests +[0-9]+ (passed|failed)" | tail -1 | sed -E 's/^ +//')
  if [ $st -eq 0 ]; then echo "$name: PASS (test did NOT catch the mutation) [$tests]"; else echo "$name: FAIL (test caught it) [$tests]"; fi
  printf '%s\n' "$out" | grep -E "^ *(×|✗|FAIL|AssertionError|expected)" | head -6 | sed 's/^/    /'
  git checkout -q -- "$file"
}
echo "# AUD-6 mutation checks"
run "A viscosity: VISC_A 10 % high (mu off by 10 %)" src/engine/viscosity.ts 's|export const VISC_A = 2.5646642e-5|export const VISC_A = 2.8211306e-5|' tests/viscosity.test.ts ""
run "B viscosity: VISC_B 1 % high (mu off by about 1.4 % at 20 C)" src/engine/viscosity.ts 's|export const VISC_B = 548.24198|export const VISC_B = 553.72|' tests/viscosity.test.ts ""
run "C Traugott: exponent 0.6 -> 0.5" src/views/well/audit.ts 's|/ 3125, 0\.6\)|/ 3125, 0.5)|' tests/auditLabels.test.ts ""
run "D Traugott: 16.3 -> 16.0 base density" src/views/well/audit.ts 's|return 16\.3 \+ Math\.pow|return 16.0 + Math.pow|' tests/auditLabels.test.ts ""
run "E compaction heat-on: face uses arithmetic mean of k/mu instead of series (harmonic)" src/engine/compaction.ts 's|for \(let m = 0; m < n - 1; m\+\+\) T\[m\] = 1 / \(hh\[m\] / \(2 \* kk\[m\]\) \+ hh\[m \+ 1\] / \(2 \* kk\[m \+ 1\]\)\)|for (let m = 0; m < n - 1; m++) T[m] = (kk[m] + kk[m + 1]) / (hh[m] + hh[m + 1])|' tests/viscosity.test.ts ""
run "F compaction heat-on: mu(T) ignored (kk = k always)" src/engine/compaction.ts 's|kk\[m\] = P\.thermal === 1 \? k \* \(MU / waterViscosity\(eng\.temp\[i\]\)\) : k|kk[m] = k|' tests/viscosity.test.ts ""
run "G Gulf preset: Hart beta 3.68e-8 -> 4.0e-8 (wrong conversion)" src/engine/presets.ts 's|beta: \[2\.68e-8, 3\.68e-8\]|beta: [2.68e-8, 4.0e-8]|' "tests/gulfPreset.test.ts tests/scenarioFile.test.ts tests/docs.test.ts tests/run.test.ts tests/longruns.test.ts" ""
run "H bundle table: Gulf maxPpg 8.7 -> 2.0 (hand-edited table)" src/views/well/bundleTable.ts 's|maxPpg: 8\.7,|maxPpg: 2.0,|' "tests/auditLabels.test.ts tests/deepCompaction.test.ts" ""
run "I cap at overburden removed (u may exceed L)" src/engine/compaction.ts 's|if \(uu > L\[m\]\) \{|if (false) {|' "tests/compaction.test.ts tests/auditLabels.test.ts tests/longruns.test.ts" ""
echo "# git status after reverts (must be empty):"
git status --short -- src/
