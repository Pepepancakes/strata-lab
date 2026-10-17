#!/usr/bin/env bash
# AUDIT-1 check 2: mutation checks. Each case changes one physical term in the engine by about 10 %,
# runs the benchmark test that should catch it, records PASS (test still passes = benchmark blind)
# or FAIL (test fails = benchmark catches the error), and reverts the file with git checkout.
# Run from the repo root: bash scripts/review/audit-01/mutations.sh | tee scripts/review/audit-01/mutations.log
set -u
cd "$(dirname "$0")/../../.."
run() { # name file sed-expr(-E) test-file test-name-filter
  local name="$1" file="$2" expr="$3" tfile="$4" filt="$5"
  sed -i -E "$expr" "$file"
  if git diff --quiet -- "$file"; then echo "$name: SED CHANGED NOTHING (anchor not found)"; return; fi
  local out
  out=$(NODE_OPTIONS=--no-experimental-webstorage npx vitest run "$tfile" -t "$filt" 2>&1)
  local st=$?
  local tests
  tests=$(printf '%s' "$out" | grep -E "Tests +[0-9]+ (passed|failed)" | tail -1 | sed -E 's/^ +//')
  if [ $st -eq 0 ]; then echo "$name: PASS (benchmark did NOT catch the mutation) [$tests]"; else echo "$name: FAIL (benchmark caught it) [$tests]"; fi
  printf '%s\n' "$out" | grep -E "^ *(✓|×|✗|FAIL|AssertionError|expected)" | head -8 | sed 's/^/    /'
  git checkout -q -- "$file"
}
echo "# Mutation checks (10 % changes in one engine term); each line is one mutation and the test that should catch it"
run "M1 Gibson: consolidation coefficient 10 % high (w0 = dt YR / MU -> x1.1)" src/engine/compaction.ts 's|const w0 = dtYr \* YR / MU$|const w0 = dtYr * YR / MU * 1.1|' tests/compaction.test.ts "Gibson"
run "M2 S&C drained porosity: beta used 10 % high in porosity()" src/engine/compaction.ts 's|return P.phi0\[lith\] \* Math.exp\(-P.beta\[lith\] \* \(s > 0 \? s : 0\)\)|return P.phi0[lith] * Math.exp(-1.1 * P.beta[lith] * (s > 0 ? s : 0))|' tests/compaction.test.ts "Sclater"
run "M3 Salt channel flux: 12 eta -> 13.2 eta (10 % less mobility)" src/engine/salt.ts 's|const e12 = 12 \* eta$|const e12 = 13.2 * eta|' tests/salt.test.ts "decay rate|Poiseuille"
run "M4 Thermal: bulk conductivity geometric mean, water exponent 10 % high" src/engine/thermal.ts 's|return Math.exp\(\(1 - phi\) \* lnGrain \+ phi \* Math.log\(P.kWater\)\)|return Math.exp((1 - phi) * lnGrain + 1.1 * phi * Math.log(P.kWater))|' tests/burial.test.ts "temperature"
run "M5 Cement: quartz molar mass 10 % high" src/engine/cement.ts 's|export const QUARTZ_MOLAR_MASS = 0.06009|export const QUARTZ_MOLAR_MASS = 0.066099|' tests/burial.test.ts "quartz cement"
run "M6 Run-out: Bingham mean velocity divisor 6 mu -> 6.6 mu" src/engine/runout.ts 's|return \(tauB \* h \* q \* q \* \(2 \+ r\)\) / \(6 \* mu\)|return (tauB * h * q * q * (2 + r)) / (6.6 * mu)|' tests/runout.test.ts "numerical integral|uniform flow|steady"
run "M7 Cover bending: plate stiffness coverVisc / 3 -> / 3.3" src/engine/salt.ts 's|const f = P.coverVisc / 3 / \(dx \* dx \* dx \* dx\) / dtS|const f = P.coverVisc / 3.3 / (dx * dx * dx * dx) / dtS|' tests/coverBending.test.ts "dispersion"
run "M8 Stability: sand friction tan(phi) used 10 % high (infinite-slope FS)" src/engine/stability.ts 's|const tanS = Math.tan\(|const tanS = 1.1 * Math.tan(|' tests/stability.test.ts "stability|FS|strength"
run "M9 Thermal subsidence: tau used 10 % high" src/engine/subsidence.ts 's|const tau = P.subsTau$|const tau = 1.1 * P.subsTau|' tests/burial.test.ts "thermal mode"
echo "# done; git status after reverts (must be empty):"
git status --short -- src/
