# Physics audit of M1 to M3 on main (AUDIT-1)

Reviewer: safety-reviewer (integrity reviewer), 2026-10-16. Read-only audit of main at `388743a`.
Scripts and logs: `scripts/review/audit-01/` (`params-census.mjs` -> `params-census.md`; `audit-runs.mjs <part>` ->
`balance.log`, `schedule.log`, `rewind.log`, `saltoff.log`, `mtd.log`, `m4.log`, `bundle.log`, `mu.log`;
`mutations.sh` -> `mutations.log`). Nothing in `src/`, `tests/` or the other docs was changed.

## Summary for John

- Solid: mass is conserved to rounding (about 1e-14) for sand, mud, salt and cement on every preset, including
  salt + slides + heat + cement together; rewind and branches are bit-exact with every later state; salt-off runs are
  untouched by salt code; the Gibson, salt-flow, cover-bending, Bingham, heat and thermal-subsidence benchmarks all
  catch a 10 % error in the term they test.
- Weakest: the pore pressure. It comes from a tuned mud permeability, a water viscosity fixed at 68 F, and a numerical
  speed-up (bundled compaction) that moves the deep pore pressure in the long presets by 0.7 to 0.8 ppg at 10,000 ft and
  changes the Gulf section shape by hundreds of feet. The docs quote the speed-up as a 0.25 % effect; that figure is from
  a 3-column test without transport, not the presets.
- The Gulf preset's overburden is 1.5 to 2 ppg lighter at 8,000 to 12,000 ft than the regional deepwater Gulf trend a
  well planner would use, because the mud stays very porous when it is this overpressured. Any fracture gradient built
  on it will come out low.
- Where pore pressure reaches the overburden the engine silently caps it there (14,600 times in the Gulf run) and
  nothing on screen says so: those cells have zero effective stress, which no real seal allows.
- Top 5 fixes, in order: (1) show the bundled-vs-full difference honestly and let M4 refuse ppg from a bundled run or
  run the pseudo-well column unbundled; (2) make water viscosity follow temperature (the heat model is already there) or
  label pore pressure "20 C water"; (3) report the pressure cap on screen and in the physics checks, and label any cell
  at the cap; (4) move the hard-coded substrate (20 MPa past stress, 30 % sand), water density, grain density and
  viscosity into the registry with a status; (5) add a benchmark for pore pressure in the real (non-linear) compaction
  mode, since the only exact check runs in a constant-property mode the app never uses.

## 1. Parameter census

`scripts/review/audit-01/params-census.mjs` reads `PARAMS`, `PRESETS` and `defaultEngineParams()` through vite's SSR
loader and writes `params-census.md`: 83 registry parameters, every preset's value, unit, status and reference, plus
every numeric `const` in `src/engine/*.ts`. Counts: **cited 9, to-verify 8, tuned 66**. Every `EngineParams` field is a
registry key and vice versa; no preset sets a key outside the registry (`params-census.md` line 97).

### 1a. Cited values against the named source

| key | value | source named | verdict | note |
|---|---|---|---|---|
| `phi0` | 0.49 / 0.63 | Sclater & Christie 1980 | MATCHES (reviewer knowledge, paper not in repo) | S&C Table: sandstone 0.49, 0.27 /km; shale 0.63, 0.51 /km |
| `beta` | 2.68e-8 / 5.2e-8 1/Pa | S&C 1980, converted | MATCHES as a derived value | the conversion point (2 km, hydrostatic) is stated in `params.ts` and `physics-references.md:23`; the derived number is only as good as the mean bulk density assumed there, which is not written down (LOW, F-15) |
| `subsTau` | 62.8 Myr | McKenzie 1978 | MATCHES | a^2 / (pi^2 kappa) with a = 125 km, kappa = 8e-7 m^2/s gives 62.8 Myr |
| `subsMode` | 'constant' | McKenzie 1978 | MISMATCH of status | the default mode is the tuned constant rates; only the 'thermal' option is McKenzie. A mode switch labelled "cited" reads as if the default were (LOW, F-14) |
| `heatFlow` | 40 mW/m^2 | Jones 2003 | MISMATCH of status | registry says `cited`; `physics-references.md:123` and `:365` say "abstract; to verify" (LOW, F-13) |
| `cemA` | 1.98e-18 mol/m^2/s | Walderhaug 1994 | MATCHES | 1.98e-22 mol/cm^2/s x 1e4; also quoted in Walderhaug 1996 |
| `cemB` | 0.022 /C | Walderhaug 1994 | MATCHES | |
| `cemTonset` | 70 C | Walderhaug 1996 | MATCHES (approximate; paper gives 70-80 C) | |
| `seaLevelKind` | 'curve' | Bintanja & van de Wal 2008 / Miller 2020 | MATCHES | data bundled, CC0 / cited in `physics-references.md:39-71` |

Constants outside the registry (from `params-census.md`, "Numbers set in engine code"):

| constant | value | file:line | status in docs | verdict |
|---|---|---|---|---|
| `RHO_SALT` | 2160 kg/m^3 | `constants.ts:10` | cited to Hudec & Jackson 2007 | MISMATCH of attribution, already found by LIT-4 (that paper gives about 2,200). Hauser (2020, p. 111) uses 0.0212 MPa/m for salt, i.e. 2,160 kg/m^3, so the value is defensible with a better source. |
| `RHO_W` | 1025 | `constants.ts:6` | none | CANNOT CHECK: no status, no source. 8.55 ppg; Traugott (1997) uses 8.5 ppg for Gulf sea water. Fine, but unlabelled. |
| `RHO_S` | 2650 | `constants.ts:7` | none | quartz density; unlabelled. Used for every grain, including clay (2,700-2,800) (LOW). |
| `MU` | 1.0e-3 Pa s | `constants.ts:8` | none | water viscosity at 20 C, fixed for all depths and temperatures. Drives pore pressure directly (section 5, F-2). |
| `G` | 9.81 | `constants.ts:5` | none | fine. |
| `SUBSTRATE` | bulk 200 m, smax 20 MPa, 30 % sand | `step.ts:38` | 200 m mentioned (`physics-references.md:190`); 20 MPa and 30 % nowhere | no status. This sets the porosity (0.243) and density of the bottom cell of every pseudo-well (F-7). |
| `QUARTZ_MOLAR_MASS`, `QUARTZ_DENSITY` | 0.06009 kg/mol, 2650 | `cement.ts:41-42` | none | correct (60.08 g/mol); unlabelled. |
| `LOOKBACK_STEPS` | 4 steps | `triggers.ts:40` | documented as steps (`user-guide.md:185`) | honest, but it makes the trigger tag depend on the step length (section 3c). |
| `WINDOW_LIMITED_SHARE` 0.95, `RU_CAP` 0.999, `TAN_FLOOR` 1e-4, `CFL` 0.2, `STOP_SPEED` 1e-3 | | `failure.ts:58`, `triggers.ts:136-137`, `runout.ts:105-111` | none | numerical guards; fine unlabelled, but `RU_CAP` and `STOP_SPEED` change results at the margin. |

### 1b. Tuned parameters behind headline results

| parameter | drives | admitted where John reads it? |
|---|---|---|
| `kA`, `kB`, `kMudMult` (mud permeability) | every pore pressure and so every ppg M4 will show; the MTD preset's 24 events | registry and user guide call them tuned (`user-guide.md:122`); the pseudo-well pressure panel (`user-guide.md:319`) does not say its red line rests on a tuned permeability. Judgement: say it there (MEDIUM, F-9). |
| `elastic` 0.05 | the only unloading term; small negative u after erosion (last3 col 60, `m4.log`) | tuned in registry; not mentioned near the pressure panel. |
| `supply`, `sandFrac`, `Kc`, `Km`, `Kg`, `dm`, transport-length rule | section shape, water depths, shelf edge, hence the datum M4 converts from | user guide section 16 admits the slopes are tuned. OK. |
| `saltVisc`, `coverVisc`, `saltThick`, `coverThick`, `weldThick`, `coverUneven` | Gulf preset welds, diapir widths, the 18 ppg salt interval | user guide 14.6 and physics-references say tuned. OK. |
| `mtdPhiMud` 0.55 | porosity and pressure a fresh slide deposit carries (section 3b) | registry says tuned; user guide 13 does not say the deposit's starting state is a guess. LOW. |
| `heatFlow`, `kGrain[mud]` 2.5, `tSeaShallow`/`tSeaScale` | temperatures, cement onset depth | mud k admitted tuned; heat flow mislabelled (F-13). |
| `bundleEvery`, `bundleAgeYr` | numerical, but moves deep pore pressure by 0.7-0.8 ppg (section 3c) | user guide quotes 0.25 % (F-1). |

## 2. Benchmark audit

Benchmarks claimed in `docs/physics-references.md` and where they live:

| claim | test | production path? | tolerance | mutation (10 %) |
|---|---|---|---|---|
| Gibson 1958 (`physics-references.md:14`) | `tests/compaction.test.ts:56` | `compactColumn` with `P.linear` set: production solver, but the constant-property branch (`compaction.ts:159-162`) the app never uses. The non-linear branch (porosity, permeability, compressibility from `beta`, cement cap) is not exercised by any exact solution. | 0.001 of overburden, stated | FAIL (caught): 0.0038 / 0.0152 at T 0.1 / 1 |
| S&C drained porosity (`:15`) | `tests/compaction.test.ts:98` | production `porosity()` + solver | 0.02 porosity at 2 km, stated, not justified | **PASS (blind)**: a 10 % error in `beta` moves the 2 km porosity by 0.015-0.02 and both tests still pass |
| Salt channel flow decay and Poiseuille load step (`:193-196`) | `tests/salt.test.ts:44,77` | production `saltStep` | 1 % / 0.1 %, stated | FAIL (caught): 9 tests |
| Cover-bending dispersion (`:203`) | `tests/coverBending.test.ts:85` | production | 2 %, stated | FAIL (caught): 3.1-8.2 % |
| Grid convergence (`:205`) | `tests/coverConvergence.test.ts` | production | 10 % band, stated, with a "can fail" check | not mutated (slow) |
| Infinite-slope FS hand cases (`:131`) | `tests/stability.test.ts:33` | production `computeStability` | 1e-9 | FAIL (caught) on the sand/mud mix test; the pure-mud hand cases do not see a sand-friction error (they are mud columns) |
| Bingham velocity, uniform flow (`:141`) | `tests/runout.test.ts:40,51` | production | 0.1 % / 1 %, stated | FAIL (caught): 9.1 % |
| Steady conduction, two layers, geometric mean (`:123`) | `tests/burial.test.ts:41` | production `cellConductivity`, `columnTemperatures` | 5e-10 | FAIL (caught) |
| Quartz growth (`:124`) | `tests/burial.test.ts:79` | production `quartzGrowth` | 1e-12 | **PASS (blind)**: the test imports `QUARTZ_MOLAR_MASS` and `QUARTZ_DENSITY` from the engine (`burial.test.ts:80`), so the molar volume is tautological; only a and b are checked |
| Thermal subsidence closed form (`:122`) | `tests/burial.test.ts:19` | production `subsidenceIntegral` | 1e-9 | FAIL (caught) |
| Bundled vs full compaction (`:108-113`) | `tests/longruns.test.ts:94,125` | production, prescribed deposition on 3 columns | 2 m / 0.005 / 2 % (5 kyr); 2 % / 0.02 / 5 % (long) | not a benchmark against an exact answer: a self-comparison, and on prescribed deposition only (section 3c) |
| Golden parity with spike 001 (`run.test.ts:70`) | | regression, not a benchmark | | has its own "can fail" test |

Mutation table (`mutations.log`; each mutation reverted with `git checkout`, `git status` clean afterwards):

| id | mutation | test | result |
|---|---|---|---|
| M1 | consolidation coefficient x1.1 (`compaction.ts:180`) | Gibson | caught |
| M2 | `beta` x1.1 in `porosity()` (`compaction.ts:31`) | S&C drained | **blind** |
| M3 | salt mobility 12 eta -> 13.2 eta (`salt.ts:286`) | salt decay / Poiseuille | caught |
| M4 | water exponent x1.1 in geometric-mean conductivity (`thermal.ts:83`) | conduction hand calcs | caught |
| M5 | quartz molar mass x1.1 (`cement.ts:41`) | quartz growth | **blind** (tautology) |
| M6 | Bingham divisor 6 mu -> 6.6 mu (`runout.ts:43`) | Bingham | caught |
| M7 | plate stiffness / 3 -> / 3.3 (`salt.ts:319`) | dispersion | caught |
| M8 | sand friction tan(phi) x1.1 (`stability.ts:115`) | FS hand cases | caught (by the sand/mud test only) |
| M9 | `subsTau` x1.1 (`subsidence.ts:26`) | thermal subsidence | caught |

Processes with NO benchmark against an exact solution or hand calculation (non-negotiable 2):
- **Pore pressure in the production (non-linear) mode**: Gibson covers the discretisation only. No check that the
  coupled porosity-permeability-compressibility column reproduces a known overpressure profile (for example a published
  1D disequilibrium-compaction solution, or at least a step/grid refinement test with a stated order) (F-5).
- **Sediment transport** (diffusion, transport-length rule, turbidites): regression against spike 001 only. The docs say
  the rule is not flow physics, which is honest, but the diffusion solver itself (a linear PDE with an exact solution) is
  not benchmarked.
- **Failure geometry and run-out deposition** (`failure.ts`, `runout.ts` beyond the uniform-flow law): tested for
  conservation, bounds and determinism, not against any hand case of how far a given slide should run.
- **Trigger tagging**: a bookkeeping split with no citation (`physics-references.md:170`); honest, nothing to benchmark.
- **Cover bending inside a full run**: the dispersion relation is checked on a level seafloor; the coupled run uses
  bands and summary statistics (acceptable for a non-linear problem, stated as such).

## 3. Cross-process coupling

### 3a. Salt with compaction, pore pressure, temperature, cement
- `compaction.ts:107,145`: salt cells are skipped by `loadsInto` and `compactColumn` and are not added to `above`, so
  salt adds no load to sediment beneath it. On main there is no sediment beneath salt: salt is layer 0
  (`salt.ts:118 SALT_LAYER = 0`), the cover sits above it, and the substrate exists only when salt is off. So the
  skip is harmless today, but the comment at `compaction.ts:15` ("neither compacts nor adds load in M1") is now the
  rule for M3 too and any future sub-salt sediment would be unloaded (LOW, F-16).
- Views: `saltIntervals.ts columnOverburden` adds salt weight at 2,160 kg/m^3 to the overburden John sees
  (`m4.log`: Gulf col 150 overburden 17.93 ppg at the salt). Pore pressure and porosity lines stop at the salt
  (`user-guide.md:331`). Consistent with the code.
- Thermal: `thermal.ts` uses `saltK0`, `saltKa`, `saltKb` for salt cells; `saltoff.log` shows changing them with
  salt off leaves a thermal + cement run bit-identical. Correct.
- Cement: `cement.ts` works on sand pore space only; salt cells have no `cem`. With salt + thermal + cement + MTDs on
  (`balance.log`, "saltshort + MTDs + thermal + cement") the cement ledger closes to 8.6e-15 and sand/mud to 1e-14.
- Salt as a seal: nothing to seal in the compaction solver (base of the sediment column is already no-flow,
  `compaction.ts:11`). The pore pressure above salt is the ordinary 1D compaction result; the salt does not change it.

### 3b. MTDs with compaction and pore pressure (`mtd.log`)
- `failure.ts:253-272`: a fresh deposit gets `smax` blended by solid mass between what was in the top cell and
  `mtdSmax(P)` = 2.61e6 Pa, the stress at which the mud law gives `mtdPhiMud` 0.55; `setPor` then sets porosity from
  that `smax`. Checked: `mtdSmax` -> mud porosity 0.5500. The sand share of the deposit gets porosity 0.457 at the
  same stress (sand law), not a remoulded value; acceptable, undocumented.
- Pressure carried: the deposit cell inherits the host cell's `u` and gets a new, larger load. Event 1: u/L 0.73 at
  deposit; events 2 and 3: 0.81, 0.87. So a fresh debris deposit is nearly undrained (sensible for a remoulded
  flow) but this is an accident of inheriting `u`, not a modelled state. 100 kyr later u/L is 0.10-0.42 and porosity
  is unchanged (0.551) because the new load (7e5 Pa) is below the inherited `smax` (1.3e6 Pa): the deposit stays
  pre-consolidated until the load passes the blended `smax`. Judgement (medium confidence): physically defensible
  for mud, but the deposit will not compact at all for its first few hundred metres of burial, which keeps the MTD
  porous and light in the overburden (LOW, F-17).
- Conservation across failure + run-out + later compaction: `Fail.mtdBalance` worst relative error 4.4e-16 per
  event; record ledger closes to 1e-14 on all five MTD runs (`balance.log`). Scar cells that are emptied keep their
  `u` and `ld` (event 3, "scar col 68 layer 391: solids 0.00 m, u 2.9e5") until the clean-up scan; harmless since
  empty cells are skipped everywhere, but a reader of `rec.u` must skip them too (M4 should).

### 3c. Variable step length with every rate-dependent process (`schedule.log`, `bundle.log`)
Same scenario at two step lengths (no bundling unless stated):

| scenario | compared | sand | mud | mean H | max u | mean u | events |
|---|---|---|---|---|---|---|---|
| last3 5 vs 10 kyr | | 3e-7 | 0.4 % | 0.17 % (max 171 m) | 1.5 % | 7.7 % | 0 / 0 |
| last3 5 vs 2.5 kyr | | 2e-8 | 0.6 % | 0.43 % | 2.1 % | 4.2 % | 0 / 0 |
| mtd 5 vs 10 kyr | | 2e-5 | 0.3 % | 0.9 % (max 190 m) | 1.4 % | 3.3 % | **24 vs 6** |
| mtd 5 vs 2.5 kyr | | 2e-8 | 0.9 % | 3.0 % | 0.5 % | 6.3 % | **24 vs 111** |
| saltshort 50 vs 25 kyr | | 0.03 % | 0.01 % | 0.16 % | 0.13 % | 0.7 % | salt max dh 1,540 m, welds 0 vs 1 |
| saltshort 50 vs 100 kyr | | 0.03 % | 0.18 % | 0.4 % | **10 %** | 1.5 % | salt max dh 706 m |
| last3 + thermal + cement, 5 vs 10 kyr | | | | | | | cement 1,802 vs 1,504 m^2 (**20 %**) |
| miocene bundled x10 vs full solve | | 2e-14 | 2e-5 | 0.83 % (max 236 m) | **25 %** | **40 %** | u/L p90 0.100 vs 0.059 |
| gulf bundled x20 vs full solve | | 3e-15 | 9e-5 | **22 %** (max 728 m) | 6 % | 8.5 % | salt max dh 3,725 m |

Findings:
- Slope failures are strongly step-dependent: 6 / 24 / 111 events at 10 / 5 / 2.5 kyr on the MTD preset. The
  trigger lookback is 4 steps, so the tag window is 40 / 20 / 10 kyr, and the search finds more FS < 1 moments with
  finer steps (each step is a fresh undrained load). The user guide (13.5, 15) says the count is platform-dependent;
  it does not say it is step-dependent (MEDIUM, F-8).
- Cement differs 20 % between 5 and 10 kyr steps with thermal on. The cement hand test checks a linear-in-time T; in
  the coupled run T is recomputed every `thermalEvery` = 5 steps, so the temperature history lags by 25 kyr at 5 kyr
  steps and 50 kyr at 10 kyr steps (LOW, F-18; cement is off by default).
- Salt max u 10 % between 50 and 100 kyr steps: first-order time stepping of the salt-compaction coupling. Within the
  spirit of the "coarse steps" caveat in `physics-references.md:113`, but not stated as a number anywhere.
- **Bundled deep compaction on the coupled presets is far outside the documented figures.** `physics-references.md:
  108-113` and `user-guide.md:272` quote 0.25 % of H (Miocene) and 0.4 % of max u from `tests/longruns.test.ts`,
  which uses prescribed deposition on 3 columns. On the real Miocene preset the bundled run has max u 25 % and mean u
  40 % higher than the full solve, and the pore pressure at about 10,000 ft TVDSS is 10.02 vs 9.36 ppg (col 80) and
  10.39 vs 9.63 ppg (col 100) (`bundle.log`). On the Gulf preset the mean surface differs by 170 m (22 %), the salt
  by up to 3.7 km in places (the structures are in different places: the coupled system is chaotic, as
  `physics-references.md:114` says) and the pore pressure at 10,000 ft by 1 ppg at col 250. Neither doc says the
  presets' pressures carry this (HIGH, F-1).

### 3d. Rewind, branches, snapshots with every later state (`rewind.log`)
Three cases, snapshot at 1/3, run to 2/3, restore, replay, compare hash; then one more step against a fresh run:
- saltshort + MTDs + thermal + cement, unbundled: IDENTICAL; events 75 = 75; weldAge, temp identical.
- Gulf (20 Myr at 100 kyr), bundled x20, salt + thermal + cement + MTDs: IDENTICAL.
- Miocene (10 Myr at 50 kyr), bundled x10, thermal + cement: IDENTICAL.
- The cached load `eng.ld` differs after restore only in cells that hold no sediment (max 2.5e5 Pa in empty cells,
  0 in filled cells): `rebuildCaches` leaves stale values in emptied scar cells. Harmless for the hash and for every
  consumer that skips empty cells (LOW, F-19).
- Code trace: `snapshotEngine` / `restoreEngine` (`step.ts`) carry the record (incl. `material`, `cem`, `cemS`,
  `smax`, `u`), `weldAge`, `temp`, the trigger ring `hist`, `events` and `diag`; the cover noise is regenerated from
  `coverSeed` at engine creation. The three replays above are the empirical proof that nothing added in M1.4c-M3 is
  missing.

### 3e. Salt on and off (`saltoff.log`)
- last3 with every salt parameter changed (`saltThick`, `saltVisc`, `coverUneven`, `coverSeed`, `coverThick`,
  `weldThick`, `coverVisc`, `saltK0`): IDENTICAL hash. last3 with `coverBend 0`, `nSaltSub 1`: IDENTICAL. mtd with
  salt params changed: IDENTICAL. last3 thermal + cement with salt conductivity changed: IDENTICAL.
- Code trace for shared arrays and order of operations: `saltStep` returns at once when `saltOn = 0`
  (`salt.test.ts:201`); `step.ts` builds the salt layer and cover only when `saltOn = 1`, so the record layout
  itself differs (salt-off has the substrate in layer 0). `compaction.ts`, `stability.ts`, `thermal.ts` test
  `material === SALT`, a branch that is never true with salt off; `summary.ts` and `saltIntervals.ts` likewise.
  `rec.material` is allocated either way (zeroed). No shared scratch array is written by the salt path before the
  `saltOn` test. Result: salt-off runs are untouched beyond the stateHash check already in the tests.

## 4. Conservation across combined processes (`balance.log`)

Per class, stored - init against in - out, relative error (documented tolerance 1e-9 sand/mud, 1e-12 salt):

| run | sand | mud | salt | cement | MTD worst event | clamps | notes |
|---|---|---|---|---|---|---|---|
| last3 | 4e-15 | 4e-15 | 0 | 0 | - | 0 | |
| mtd | -6e-15 | -4e-15 | 0 | 0 | 2e-16 | 4 | 24 events, 4 unresolved |
| miocene | -7e-14 | -3e-14 | 0 | 0 | - | 0 | |
| cenozoic | -3e-14 | 2e-14 | 0 | 0 | - | 0 | |
| saltshort | -8e-15 | -1e-14 | 2e-16 | 0 | - | 0 | saltClip 0 |
| gulf | -4e-14 | -7e-15 | -6e-15 | 0 | - | **14,626** | saltLimited 333,553 face-steps, limited volume 212 m^2 |
| saltshort + MTDs (failOn, kMudMult 0.1) | -7e-15 | 3e-15 | -3e-16 | 0 | 4e-16 | 33 | 60 events |
| saltshort + MTDs + thermal + cement | -1e-14 | -9e-15 | -1e-16 | 9e-15 | 4e-16 | 78 | 75 events, cement 2.3e7 m^2 |
| mtd + thermal + cement | 7e-16 | -1e-14 | 0 | 1e-16 | 2e-16 | 6 | |
| gulf + MTDs (failOn), bundled x20 | -4e-14 | -4e-14 | -6e-15 | 0 | 4e-16 | 10,695 | 83 events |

All inside tolerance. Two things the balance does not see: (a) `clamps` (u forced down to the load,
`compaction.ts:198-200`) removes pore pressure, not mass, so the ledger is blind to it (F-3); (b) `saltLimited`
(the basinward salt limit holding salt back) is volume-neutral by construction. Neither counter reaches the UI.

## 5. What M4 inherits

| quantity M4 reads | method on main | benchmark | known limits / tuned inputs | trust |
|---|---|---|---|---|
| Bulk density per cell -> overburden | `cellBulk` (solids / (1 - phi)) with `RHO_S` 2650 and `RHO_W` 1025, salt 2160 (`saltIntervals.ts columnOverburden`) | none for the integral; S&C for drained porosity | one grain density for sand and clay; porosity from a tuned pore pressure (below); substrate cell fixed at 20 MPa past stress (phi 0.243) | medium in shallow drained sections, low where overpressured |
| Porosity | `porosity(P, lith, smax)`: Athy-in-stress with S&C coefficients, `elastic` 0.05 on unloading, cement cap | S&C at 2 km, drained, 0.02 tolerance (blind to a 10 % beta error) | North Sea coefficients; no clay-mineral or temperature dependence; MTD cells pre-consolidated | medium |
| Pore pressure (u, excess over hydrostatic) | 1D vertical consolidation per column, no lateral flow, free drainage at the seafloor, no-flow base; disequilibrium compaction only; unloading via `elastic`; **no aquathermal, no lateral transfer / centroid, no hydrocarbon buoyancy, no diagenetic (smectite-illite) source, no fracture / seal-leak cap other than u <= L** | Gibson in constant-property mode only | mud permeability `kA`, `kB`, `kMudMult` tuned; `MU` fixed at 20 C (a 3x change in k/mu moves max u by 29-33 %, `mu.log`); bundled compaction moves it 25-40 % on the long presets; capped silently at the overburden | **low** |
| Hydrostatic | `RHO_W` g depth, depth from sea level (`views/well/profile.ts`) | unit round-trip tests | 8.55 ppg constant; no salinity gradient | high |
| Salt flags / intervals | `rec.material === SALT`, `saltIntervals.ts` | salt tests | salt only as layer 0; welds by `weldThick`; no sub-salt sediment at all, so no sub-salt pressure exists to read | high as a flag; M4 must not extrapolate below salt |
| Water depth and datum | sea level from the spliced curve minus `rec.H`; sea level at the end of a run is -1.5 m (`m4.log`) | sealevel tests | fine; M4 should state the datum (sea surface) explicitly since Traugott (1997, p. 1) converts with water depth and air gap | high |
| Temperature | steady conduction | hand calcs | no advection, no transient, no salt-chimney lateral effect | medium |

What a Gulf pore-pressure specialist would question before M4 touches these (judgements, medium-high confidence):
1. **Overburden is light.** Traugott (1997, p. 2) gives a deepwater Gulf regional average sediment density of
   16.3 + (sediment thickness ft / 3125)^0.6 ppg; for 2,000 ft water and 12,300 ft TVD that gives an overburden
   gradient of 16.7 ppg. The Gulf preset at col 150 (252 ft water, 12,174 ft TVDSS) gives 16.59 ppg where that
   trend gives 18.3 ppg; at col 250 (2,824 ft water, 10,830 ft TVDSS) it gives 14.27 ppg where the trend gives
   about 16.0 ppg (`m4.log`). The 1.5 to 2 ppg gap comes from porosities of 0.29 to 0.35 at 8,000 to 12,000 ft
   below mudline (regional shale is 0.10 to 0.20), which come from the extreme undercompaction (u/L 0.4 to 0.75)
   the tuned permeability produces. Eaton's fracture gradient scales with the overburden, so M4's fracture gradient
   will be low by about the same amount (HIGH, F-4).
2. **Pore pressure equals overburden in places.** Gulf col 345 at 11,467 ft below mudline has u/L = 1.000; the run
   clamped u 14,626 times. Hauser (2020, p. 108-109) finds base-salt and salt-sealed sediments sit at a nearly
   constant vertical effective stress of about 3.3 MPa (480 psi) over 75 MPa of overburden: the seal leaks before
   effective stress reaches zero. The engine has no such leak-off, so a pseudo-well through those cells will show
   pore pressure at the overburden line and a negative mud-weight window with no warning (HIGH, F-3).
3. **Mechanism is disequilibrium compaction only.** No unloading beyond the 5 % elastic rebound, no aquathermal
   term, no lateral transfer. Traugott (1997, p. 4-5) stresses the centroid effect (sand pressure differs from the
   bounding shale by about 50 psi per 100 ft above the centroid); the model's sands and muds share one cell with a
   harmonic-mean permeability, so every sand is at shale pressure. A planner would read the red line as a shale
   pressure and ask for the sand pressure separately. Hauser & Couzens-Schultz (preprint, not peer reviewed) argue
   compaction-based prediction stands or falls on the effective-stress definition and the porosity-stress law used;
   here that law is S&C with a tuned permeability, uncalibrated to any Gulf well (MEDIUM, F-9).
4. **Viscosity at 20 C.** Pore water at 100 C is about 4x less viscous; with the heat model on, the solver still uses
   `MU` = 1e-3 everywhere. `mu.log`: multiplying mud k by 3 (the same term as mu / 3) lowers max u from 302 to 201
   psi on last3 and from 1,104 to 785 psi on the MTD preset and removes every slide (HIGH, F-2).
5. **The deep pressure depends on a speed-up knob.** `bundleEvery` 10/20 on the long presets changes 10,000 ft pore
   pressure by 0.7 to 1 ppg (section 3c). Anything in ppg from a bundled run needs that bar on it (HIGH, F-1).
6. **Negative excess pressure is possible** (last3 col 60: u/L -0.001 after erosion). Tiny on main, but M4 should
   floor the pore-pressure line at hydrostatic or show it honestly.
7. **The mechanism itself is the right first-order one, but the mud law is not a Gulf law.** Hart, Flemings &
   Deshpande (1995, Geology 23, 45-48) show at Eugene Island 330 that shale porosity falls exponentially with
   effective stress and that compaction disequilibrium explains about three-quarters of the overpressure, with
   measured pressures reaching about nine-tenths of lithostatic below 2 km (abstract, p. 45); the rest they put on
   later pressure sources that move the shale onto an unloading curve (p. 47). Their fitted shale coefficients are
   phi0 = 0.40 and beta = 3.68e-2 per MPa (p. 46), against the engine's mud phi0 = 0.63 and beta = 5.2e-2 per MPa
   from the North Sea curve. So on this Gulf dataset the engine's mud starts 0.23 more porous and compacts 41 %
   faster per unit stress: both push the overburden light (F-4) and the pressure high. The engine's u/L = 1.000 cells
   (F-3) also exceed anything in that dataset (0.93 of lithostatic at most, p. 46). Judgement, high confidence: a Gulf
   preset needs Gulf compaction coefficients, labelled as such, before any ppg is read from it.

Papers added to the reference folder for M4.6 (Eaton 1969, Zhang & Yin 2017, IOGP Report 608, Hauser 2020 SPE,
Alberty & McLean) concern the fracture-gradient step that lives on the M4 branches, out of this card's scope; they
were not used here beyond noting that the M4 reviewer now has the primary Eaton source the docs mark "not read".

## 6. Docs honesty

| claim | doc | code / run | verdict |
|---|---|---|---|
| MTD preset on Node 26: 24 events, 16 rapid loading, 8 oversteepening, 2 stalled, engine count 4, 3 window-limited | `user-guide.md:534-535` | `mtd.log`: 24 events, {rapid loading 16, oversteepening 8}, stalled 2, failUnresolved 4, windowLimited 3 | MATCHES |
| Default overpressure is mild, max about 14 % of the load | `user-guide.md:748` | `m4.log` last3: largest u/L 0.148 | MATCHES |
| Bundled compaction: about 0.25 % of the thickness on the Miocene preset, 0.8 % on the Cenozoic | `user-guide.md:272`, `physics-references.md:111` | measured on prescribed deposition (3 columns, `longruns.test.ts:125`); the Miocene preset itself gives 0.83 % mean H, 236 m max, 25 % max u | MISLEADING (F-1) |
| Compaction: free drainage at the top, no flow at the base; 1D | `compaction.ts:11-12`; `physics-references.md` limits | the limits section of physics-references lists compaction limits only in the M1 table; "1D, no lateral flow, no leak-off, u capped at the load" is not stated for the reader of the pressure panel | GAP (F-3, F-9) |
| Salt weight is in the overburden the views use | `physics-references.md:224` | `saltIntervals.ts`; and NOT in the compaction load (`compaction.ts:107`) | TRUE but incomplete (F-16) |
| `heatFlow` cited | `params.ts` | `physics-references.md:123,365` "to verify" | INCONSISTENT (F-13) |
| Salt density 2,160 (Hudec & Jackson 2007) | `physics-references.md:90,180,224` | LIT-4 found H&J give about 2,200; Hauser (2020) uses 0.0212 MPa/m = 2,160 | attribution MISMATCH (known) |
| Trigger tag window "4 steps (20 kyr at 5 kyr steps)" | `user-guide.md:185,478` | `triggers.ts:40` | MATCHES; the consequence (event count depends on the step length, 6/24/111) is not stated (F-8) |
| "Use the long presets ... not to read precise pressures at a fixed depth" | `user-guide.md:274` | right, but M4 is about to do exactly that | needs a number, not a hint (F-1) |
| Every parameter cited / tuned / to verify | agent-guide non-negotiable | `RHO_W`, `RHO_S`, `MU`, `SUBSTRATE` have no status | GAP (F-6, F-7) |

## 7. Findings

| id | severity | affects M4 | finding | evidence | minimum fix |
|---|---|---|---|---|---|
| F-1 | HIGH | yes | Bundled deep compaction on the coupled long presets changes deep pore pressure by 0.7-1 ppg at 10,000 ft and the Gulf section by hundreds of metres; docs quote 0.25 % / 0.4 % from a prescribed 3-column test | `bundle.log`; `user-guide.md:272`; `physics-references.md:108-113`; `tests/longruns.test.ts:94-146` | Rewrite the two doc passages with the coupled-preset numbers; have M4 either refuse ppg from a bundled run, re-solve the pseudo-well column unbundled, or print the bundled-vs-full difference as an error bar |
| F-2 | HIGH | yes | Pore-water viscosity fixed at 1e-3 Pa s (20 C) for all depths even with the heat model on; a 3x change in k/mu moves max u by about 30 % and removes every slide on the MTD preset | `constants.ts:8`; `compaction.ts:180-181`; `mu.log` | Give `MU` a registry entry with status and note, or make it follow `eng.temp` when thermal is on; say "20 C water" on the pressure panel until then |
| F-3 | HIGH | yes | Pore pressure is clamped at the overburden (zero effective stress) silently: 14,626 clamps on the Gulf preset, u/L = 1.000 at col 345; no leak-off or fracture limit, counter never shown | `compaction.ts:198-200`; `balance.log` gulf; `m4.log`; Hauser 2020 p. 108-109 (near-constant ~3 MPa effective stress under salt seals) | Surface `diag.clamps` in the physics checks and the pseudo-well (mark clamped cells); document the limit; consider a leak-off cap below the overburden as a later card |
| F-4 | HIGH | yes | Gulf preset overburden is 1.5-2 ppg lighter than the deepwater Gulf regional trend at 8,000-12,000 ft because mud porosity stays 0.29-0.35 under the tuned undercompaction; Eaton fracture gradient inherits it | `m4.log` cols 150, 250; Traugott 1997 p. 2 formula and example (13.7 / 16.7 ppg); Hart et al. 1995 p. 46 Gulf shale phi0 0.40, beta 3.68e-2 /MPa vs engine mud 0.63, 5.2e-2 | State on the Gulf preset that density and overburden are not calibrated; add a physics check comparing a pseudo-well overburden to a regional trend with a cited formula |
| F-5 | MEDIUM | yes | The only exact pore-pressure benchmark runs in constant-property mode (`P.linear`), which the app never uses; the non-linear production path has no benchmark | `tests/compaction.test.ts:26-54`; `compaction.ts:159-162` | Add a benchmark of the non-linear column (published 1D disequilibrium-compaction case, or a refinement study with stated order) |
| F-6 | MEDIUM | yes | `RHO_W`, `RHO_S`, `MU`, `G` are physical constants outside the registry with no status or source | `constants.ts:5-8`; `params-census.md` | Add them to `physics-references.md` with status (cited / to verify) and a one-line source each |
| F-7 | MEDIUM | yes | Substrate (200 m, 20 MPa past stress, 30 % sand) is hard-coded and undocumented; it is the bottom cell of every salt-off pseudo-well (phi 0.243) | `step.ts:38`; `m4.log` last3/mtd bottom rows | Registry entry (tuned) or a doc line; have M4 label the substrate cell |
| F-8 | MEDIUM | no | Slope-failure count depends on the step length (6 / 24 / 111 at 10 / 5 / 2.5 kyr) and the trigger window is 4 steps, not a time; docs mention platform dependence only | `schedule.log`; `triggers.ts:40`; `user-guide.md:13.5, 15` | Add the step-dependence to user guide 13.6 limits; consider making the lookback a time |
| F-9 | MEDIUM | yes | The pressure panel does not say the red line rests on a tuned mud permeability, 1D vertical drainage, disequilibrium compaction only, shale pressure for sands too (no centroid) | `user-guide.md:319-331`; `compaction.ts:1-17`; Traugott 1997 p. 4-5 | One paragraph of limits under the pressure panel; M4 should carry it into the mud-weight window |
| F-10 | MEDIUM | no | S&C drained-porosity test (0.02 tolerance) is blind to a 10 % error in `beta` | `mutations.log` M2; `tests/compaction.test.ts:109` | Tighten to 0.005, or test the slope of ln(phi) vs stress instead of one point |
| F-11 | MEDIUM | no | Quartz-growth hand test imports the engine's own molar mass and density (tautological for Vm) | `tests/burial.test.ts:80`; `mutations.log` M5 | Hard-code Vm = 2.27e-5 m^3/mol in the test from the paper |
| F-12 | LOW | no | Cement differs 20 % between 5 and 10 kyr steps (temperature recomputed every 5 steps) | `schedule.log` last line | State the step dependence in the cement limits |
| F-13 | LOW | no | `heatFlow` is `cited` in the registry but "to verify" in the references | `params.ts`; `physics-references.md:123,365` | Make them agree (to verify) |
| F-14 | LOW | no | `subsMode` is `cited` though the default mode is tuned constant rates | `params-census.md` | Status tuned, note that 'thermal' follows McKenzie |
| F-15 | LOW | yes | The `beta` conversion from S&C depth coefficients does not record the bulk density / hydrostatic assumption used at 2 km | `params.ts beta note`; `physics-references.md:23` | Write the arithmetic down once |
| F-16 | LOW | no (today) | Compaction skips salt and adds no salt load to anything below it; harmless because nothing is below salt on main, but the comment says "in M1" | `compaction.ts:15,107,145` | Update the comment; if sub-salt sediment is ever added, add the salt weight |
| F-17 | LOW | yes | MTD cells inherit the host cell's `u` and a blended `smax`, so a fresh deposit is near-undrained by accident and does not compact until the load passes the blended `smax` | `failure.ts:265-272`; `mtd.log` | Document the deposit's starting state; decide whether a remoulded deposit should start at u = 0 or near the load |
| F-18 | LOW | no | Trigger window is step-based (`LOOKBACK_STEPS`) | `triggers.ts:40` | covered by F-8 |
| F-19 | LOW | no | `rebuildCaches` / restore leave stale `ld` in emptied scar cells (differs from a straight run only in empty cells) | `rewind.log` first case | Zero `ld` for empty cells in `rebuildCaches`, or note that consumers must skip empty cells |
| F-20 | LOW | no | `RHO_SALT` 2,160 credited to Hudec & Jackson 2007 (about 2,200 there); Hauser 2020 uses 0.0212 MPa/m (2,160) | LIT-4; Hauser 2020 p. 111 | Re-credit (literature card) |

Counts: HIGH 4, MEDIUM 7, LOW 9. Affecting M4: 11.

## 8. Parameters whose cited source must be re-checked against the paper (for a literature card)

- `phi0`, `beta` (Sclater & Christie 1980): the four coefficients and the conversion to effective stress; the
  paper's curves are North Sea, which should be said where the Gulf preset is described. Hart et al. (1995) give
  Gulf Coast shale values (0.40, 3.68e-2 /MPa) that a Gulf preset could cite instead.
- `cemA`, `cemB`, `cemTonset`, `cemSurf` (Walderhaug 1994, 1996): a, b, the 70-80 C onset, and whether a is quoted
  in mol/cm^2/s.
- `heatFlow` (Jones 2003): abstract only; find the figure or table and the range.
- `kGrain` sand 7.7, `kWater` 0.6, `saltK0` 6.0, `saltKa` 0.0030, `saltKb` 0.0042 (Clauser & Huenges 1995; Woodside &
  Messmer 1961): the salt form quoted from Sass et al. 1992 has not been read.
- `phiFric`, `cohesion`, `failMinDepth`, `failSlopeMin` (Hampton et al. 1996).
- `runYield`, `runViscosity` (Imran et al. 2001): the Bingham values and the model equations.
- `kA`, `kB` (Yang & Aplin 2010): the mud permeability law the registry says is "the candidate to adopt" but has
  not; this is the single most consequential tuned input for M4.
- `RHO_SALT` (Hudec & Jackson 2007 vs Hauser 2020), `RHO_W`, `RHO_S`, `MU` (no source at all).
- `subsTau` (McKenzie 1978): confirm a and kappa used for 62.8 Myr.
- `saltVisc` range (Hudec & Jackson 2007), `coverVisc` (no published value; stays tuned).

## 9. Gates

`npm ci` and `npm run check` on the final commit: see the handoff (no product code changed, so they match main).
