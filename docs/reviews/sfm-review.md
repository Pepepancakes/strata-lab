# SFM-R: stratigraphic forward-modelling review of the transport engine

Review of main at f00020b (branch `strata-lab/sfm-review`, read-only: no `src/` or `tests/` change).
Scope: `src/engine/transport.ts`, `turbidites.ts`, `sealevel.ts`, `subsidence.ts`, `step.ts`,
`schedule.ts`, `presets.ts`, and the docs that describe them. Earlier reviews covered mass balance,
determinism, parameter labelling, salt and pressures (AUDIT-1 and the salt and M4 reviews); none of
that is repeated. The question here is whether the sediment-transport and stratigraphic behaviour
responds the way a forward modeller expects, and where a specialist would distrust it.

All numbers come from the scripts in `scripts/review/sfm/` (run with `node scripts/review/sfm/NN-*.mjs`
from the repo root; they load the engine from `src/` through vite, so they test main unchanged).
Each number names its platform: **W** = Windows node 26.7, **L** = Linux WSL node 22.23. Where one
value is given, both platforms agree to the printed precision. Metres first, feet in brackets.

## 1. Plain-language summary for John

**What you can trust.** The core of the model, diffusion of sand and mud down a surface, does what
the textbooks say. On the coastal plain the slope settles to supply divided by diffusivity to within
1 % for pure sand or pure mud (section 3.1). Sand stays landward and mud goes basinward in every run
(3.3). Sea-level rise moves the shoreline landward, fall moves it basinward, and when the shoreline
turns before a highstand it is for the right reason (3.2). The record step and the transport substep
are fine enough: halving them changes the shoreline by under 1 km (3.5). Mass is conserved per grain
size (the earlier audit; confirmed again here by the ledger figures).

**What you should not read into the sections.**
1. **"Turbidites" are not lowstand sand.** The rule is meant to send sand down the slope when the
   shoreline reaches the shelf edge. In practice the detector reads the model's own shoreface (the
   steep first marine step below the shoreline) as the shelf edge, so about 60 % of the supply is
   thrown down-slope almost all the time, including at constant sea level, where a forward modeller
   expects the delta to build out and the basin to be starved. With constant sea level the basin
   beyond 100 km gets 26 % of the sand supplied; with the real glacial sea-level curve it gets 25 %;
   with turbidites switched off, 1 % (W and L). So the basin-floor sand in the sections is set by the
   `tcMax` dial, not by sea level, supply or shelf width. The user guide's sentences "at a lowstand the
   shoreline sits near the shelf edge and sand bypasses" and "sand that bypassed the shelf at a
   lowstand" describe behaviour the engine does not have. (Finding F1, HIGH.)
2. **The far end of the section is a wall.** Nothing leaves the basinward edge by diffusion, so mud
   piles against it: in an all-mud run with no subsidence the sea floor at 150 km rose 795 m
   (2608 ft) in 3 Myr. Moving the wall from 150 to 300 km changes the sand stored beyond 100 km by
   +52 % at constant sea level and +16 to 17 % on the default run. Do not read thicknesses or sand
   volumes in the outer third of the section as results. (F2, HIGH.)
3. **At constant sea level the shoreline position is grid-dependent.** Halving the column width
   moves it 9 to 11 km (section 3.5). With the glacial curve the dependence is about 1 km. (F3, MEDIUM.)
4. Runs with mixed sand and mud differ between Windows and Linux by about 1 km of shoreline and
   about 1 degree of foreset slope (pure-lithology runs are bit-identical). This is the known 1-ulp
   noise (D16.4); the sorting pass and the on/off turbidite trigger amplify it. Quote medians. (F6.)

**The three changes I would make first.**
1. Make the shelf-edge detector unable to see the shoreface: require a minimum water depth (say
   the depth where marine K has fallen to Kg, about 5 x dm, or a user parameter "shelf-break depth")
   before a face can count as the shelf edge, or skip the first few marine columns. Test: at constant
   sea level with the shoreline 30 km inboard of the initial shelf edge, the turbidite share must be
   below 0.05 for the whole run; with the shoreline at the shelf edge it must reach `tcMax`.
2. Open the basinward boundary (fixed elevation or outflow counted as exported) or document that
   the outer third is a sink and widen the default section. Test: the sand stored beyond 100 km
   changes by less than 5 % when the section is widened from 150 to 300 km.
3. Reword the two user-guide sentences now (they are wrong today), and add the turbidite share to
   the on-screen diagnostics so the user can see when the rule is at its cap.

## 2. The formulation the code actually solves

Checked against the code, not the docs. Line numbers are for main at f00020b.

**Transport law** (`transport.ts:3-8`, `:102-129`). One surface H(x), two grain sizes, one equation:

    dH/dt = d/dx ( K_eff dH/dx ) + q_in at x = 0

solved by backward Euler on a tridiagonal system (`:121-129`, `thomas()`), with the face diffusivity
frozen at the start of the substep: `K_eff(face) = K_sand(d) F_up + K_mud(d) (1 - F_up)` (`:116-118`),
where F_up is the sand share of the active layer (top 1 m of solids, `constants.ts:17`,
`surfComp()` `:33-46`) of the **upwind (higher) cell** (`:106`), and d is the water depth at the
face from the mean of the two old surfaces (`:107`). The supply enters cell 0 as a source term
(`:127`), i.e. a point source at the landward edge, in bulk (solid / (1 - phi0), `:98-100`).

**Diffusivity by environment** (`:109-115`, parameters `params.ts:75-82`):

    land  (d <= 0):  K = Kc                         Kc  = 5e4 (sand), 1e5 (mud) m2/yr
    marine (d > 0):  K = Km exp(-d / dm) + Kg       Km = 400 / 2500, dm = 10 / 40 m, Kg = 100 / 1000

So marine K has fallen to within 1 % of Kg by d = 5 dm = 50 m (sand) and 200 m (mud); the whole
slope and basin floor run at Kg. The land-to-sea jump at the shoreline is a factor 25 (sand, Kc to
Km + Kg = 500) and 29 (mud). This jump is what builds the shoreface step (section 3.4).

**Grain-size partition** (`:132-242`). The implicit solve gives the new surface Hn and hence a bulk
flux per face `Qf = K_eff (Hn_j - Hn_j+1) / dx * dt` (`:140`). Cells are then visited from highest
to lowest Hn (`:151`, stable sort, deterministic) and each passes on sand and mud separately:
- net-depositing cell (`:165-198`): the outflow mix is the mobility-weighted mix of a pool made of
  the inflow plus the active layer, weights `K_sand * pool_sand` and `K_mud * pool_mud` evaluated at
  the cell's own depth (`:169-179`), capped by what the pool holds (`:183-189`);
- net-eroding cell (`:199-221`): everything arriving passes through, plus bed material in its real
  mix, layer by layer, stopping at salt (`:206`).
Solids are booked with surface porosity on deposition (`:193`, `:197`) and with the layer's actual
porosity on erosion (`:74`, `:216`), so H after the sorting pass is not exactly Hn; compaction then
recomputes H from the record (`step.ts:111`, `:184`, `:192`).

**Turbidite trigger** (`turbidites.ts:21-30`, called before diffusion `transport.ts:92-100`):
shoreline = first column with H < sea level (`turbidites.ts:24`); shelf edge = first face at or
beyond it with gradient > `sBreak` = 0.01 (`:26`); share of supply diverted
`Ftc = tcMax exp(-(x_edge - x_shore) / tcLambda)`, `tcMax` 0.6, `tcLambda` 8 km (`:27`). The
diverted share is removed from the diffusion supply (`transport.ts:100`) and routed after the
diffusion pass on the updated surface (`:248-252`).

**Turbidite run-out** (`turbidites.ts:38-65`). From the shelf-edge column basinward, each grain
size loses `q (1 - exp(-dx / L))` per column (`:57`), with
`L = tcL0 (S / tcSref)^tcN`, `tcL0` 20 km (sand) / 400 km (mud), `tcSref` 0.005, `tcN` 2 (`:56`),
S the local down-dip gradient floored at 1e-5 (`:53-54`). Flow still in hand at the last column is
exported and booked in the ledger (`transport.ts:251-252`). With these values sand stops where the
gradient drops below about 0.5 % (L < dx) and travels hundreds of km where S > 2 %; mud needs
S < 0.1 % to stop within a few columns.

**Boundary conditions.** Landward: point source in cell 0 and zero diffusive flux through x = 0
(`transport.ts:122`, a = 0 at j = 0). Basinward: **zero flux** through the last face (`:123`, c = 0
at j = nx - 1) for diffusion; turbidite flow that reaches the last column is exported. Nothing else
leaves. The initial surface is a fixed synthetic ramp: plain 15 m to 0 m over 0-10 km, shelf to
-100 m at 40 km, slope to -1500 m at 65 km (gradient 0.056, 3.2 deg), floor to -1900 m at 150 km
(`step.ts:26`).

**Sea level and subsidence.** Sea level is read at the middle of each transport substep
(`step.ts:110`), from the published spliced curve (Bintanja and van de Wal 2008 to 3 Ma, Miller et
al. 2020 before, 200 kyr blend, `sealevel.ts:70-75`, `:87-90`) or a sine (`:18-21`). Subsidence lowers
the basement once per record step before transport (`step.ts:106`), linear across the section from
`subsShelf` 40 to `subsBasin` 150 m/Myr (`subsidence.ts:64`). No isostatic response to the load, no
flexure (stated at `subsidence.ts:11-12`).

**Time stepping and stability.** Record step 5 kyr, 5 transport substeps of 1 kyr (`params.ts:51`,
`:53`). The linear implicit solve has no step limit (the explicit number r K = 1000 yr x 1e5 m2/yr /
(1000 m)^2 = 100 is far past the explicit limit of 0.5, so the implicit solve is essential). The
non-linear parts are explicit: K is frozen for the substep, F comes from the old active layer, and
the sorting pass redistributes the implicit flux. Section 3.5 measures the cost: a 5 kyr substep
(nSub 1) is visibly different from 1 kyr; 0.5 kyr (nSub 10) is not.

**Departures from the standard diffusion family, and whether they are defensible.**
- Two-lithology K mixed linearly with the upwind active-layer share, and depth-dependent marine K:
  these are the forms attributed to Rivenaes (1992) and Kaufman et al. (1991) in
  `docs/physics-references.md:27-28`. I have not read either paper in this review (to verify; not
  read); the forms are standard in the field and the code matches the forms the docs state.
- The mobility-weighted pool partition of the outgoing flux is the engine's own closure (header
  `transport.ts:9-14`). It is a reasonable way to get sorting from a single-surface solve and is
  honestly described; its consequence is that mud outruns sand on the plain because Kc_mud = 2 Kc_sand
  (section 3.3). Defensible as a simplification.
- The turbidite share-and-run-out rule is a transport-length closure, not flow physics, and says so
  (`turbidites.ts:1`, user guide section "Transport and turbidity currents"). The closure itself is
  defensible; the **trigger** is not, because its threshold is below the gradient the model's own
  shoreface must have (section 3.4). This is a design flaw, not a labelling problem.
- A closed basinward boundary is unusual for a basin-fill model (an open or fixed-elevation outer
  boundary, or a section long enough that nothing reaches the wall, is the norm). With Kg_mud =
  1000 m2/yr the diffusion length in 3 Myr is sqrt(2 K t) = 77 km, so the wall at 85 km from the
  slope foot is well within reach. Not defensible as a default without a warning.

## 3. Behavioural tests

### 3.1 Steady supply, constant sea level (`01-steady.mjs`)
No subsidence, no turbidites, sine amplitude 0, 3 Myr, default supply 20 m2/yr solid (48.9 m2/yr
bulk at surface porosity for the default mix). Expected: a graded coastal plain of slope S = q / Kc
(a Paola-type steady grade; the grade result is the standard diffusion steady state, which I state
from first principles rather than from a paper), prograding into the basin.

| Case | Proximal plain slope, measured | q / Kc | Error | Shoreline at 3 Myr | Steepest foreset |
|---|---|---|---|---|---|
| A all mud | 0.540 m/km (2.85 ft/mi) | 0.541 | 0.0 % | 91.60 km | 2.31 deg |
| B all sand | 0.785 m/km (4.14 ft/mi) | 0.784 | 0.1 % | 101.82 km | 15.49 deg |
| C default mix | 0.976 m/km (5.15 ft/mi) | 0.978 at F = 1 | 0.2 % | 91.83 km W, 91.33 km L | 5.46 deg W, 6.69 deg L |
| D mix, half supply | 0.485 W / 0.487 L m/km | 0.489 at F = 1 | 0.8 % W, 0.4 % L | 55.67 km W, 55.81 km L | 3.35 deg W, 3.79 deg L |

(W and L identical for A and B; C and D differ as noted.)

- The grade is exact for pure lithologies. For the mix the proximal plain grades as if it were pure
  sand (the active-layer share that reproduces the slope is 0.998 W / 0.999 L): mud bypasses the
  upper plain because Kc_mud = 2 Kc_sand, so the inner plain is 97 % sand (section 3.3). That is the
  closure working as designed, not an error.
- Down the plain the slope departs from q / Kc by 4 to 51 % because the plain is still aggrading
  (10 to 23 % of the supply is stored on the plain in the last step) and the flux reaching the
  shoreline is smaller than q. The plain is not at steady state after 3 Myr; a specialist would
  not expect it to be with a 1500 m deep basin to fill.
- Foreset slope: with marine K at Kg over the whole foreset the steady grade would be q / Kg, i.e.
  4.4 deg (mud), 16.7 deg (sand) and 9.9 deg (mix) for the flux arriving at the shoreline. Measured
  steepest gradients are 2.3, 15.5 and 5.5 deg (W) / 6.7 deg (L): below grade because the foreset is
  prograding and part of the flux is spread onto the basin floor by Kg before it reaches the toe.
  Note that `docs/physics-references.md:29` says Kg was "picked for about 6 deg muddy slopes": the
  all-mud foreset here is 1.7 to 2.3 deg; the 5 to 7 deg slope is the mixed case. (F7, LOW.)
- Progradation rate over the last third: 18.4 (W) / 16.9 (L) m/kyr for the mix against a hand value
  of (q - plain aggradation) / toe depth x compaction ratio = 19.0 (W) / 23.0 (L) m/kyr. Same order;
  the hand value ignores the mud spread onto the floor.
- Shoreline against a hand fill (plain at the measured slope, planar foreset at the measured slope,
  bulk actually stored): the model shoreline is 4 to 18 km landward of the hand fill. The difference
  is the mud that diffused onto the basin floor instead of building the foreset, and it is largest
  for the mixed case. Not an error, but it shows how much of the supply the Kg term carries past the
  foreset.
- Closed boundary: the sea floor at 150 km rose 795 m (2608 ft) in A, 668 m (2193 ft) in C, 115 m
  (379 ft) in B, with no subsidence and no turbidites. See F2.

### 3.2 Accommodation vs supply: shoreline trajectory (`02-sealevel.mjs`)
Default supply and subsidence, turbidites on unless stated. Steps are classified from the shoreline
and sea-level change: T transgression, NR normal regression, FR forced regression.

| Run | Steps T / NR / FR (of 599) | Shoreline turns before highstand by | Shoreline turns relative to lowstand | corr(sea level, tc share) |
|---|---|---|---|---|
| A sine 40 m, 1 Myr | 260/126/213 W, 256/130/213 L | 95 to 185 kyr W, 50 to 90 kyr L | 30 to 105 kyr BEFORE W, 0 to 55 kyr before L | +0.098 W, +0.091 L |
| B sine 40 m, 100 kyr (teaching default) | 177/122/300 W, 176/123/300 L | 15 kyr | 5 to 10 kyr after | -0.829 W, -0.826 L |
| C published curve (default run) | 164/106/329 W, 170/103/326 L | 0 to 30 kyr | 10 to 30 kyr after | -0.331 W, -0.322 L |
| D as A, turbidites off | 239/146/214 W, 232/147/220 L | 110 to 145 kyr W, 115 to 165 kyr L | 20 to 45 kyr AFTER W, 35 to 40 kyr after L | n/a |

- Order of events is right: rise gives transgression, then the shoreline turns basinward before the
  highstand (when the rate of rise drops below what the supply can fill), fall gives forced
  regression. The 100 kyr sine never produces normal regression on the rising limb: a rise of 1.6
  m/kyr on a 0.4 to 0.9 m/km plain demands 2 to 4 km/kyr of retreat, far beyond what 20 m2/yr can
  fill. Expected.
- Hand check (forced regression): with no deposition the shoreline after an 80 m fall sits where
  the previous highstand surface, lowered by subsidence, crosses the new sea level. Measured
  shorelines are 7.0 to 10.2 km (A) and 13.6 to 15.3 km (D) basinward of that line (W; L within
  0.5 km), i.e. normal regression adds to the forced component. The rising-limb hand line is off the
  landward edge of the model (-110 to -140 km: an 80 m rise on a 0.6 m/km plain floods 130 km),
  so the measured 12 to 25 km of retreat is set by the aggrading plain and the shoreface step, not
  by the plain slope alone.
- **With turbidites on, the shoreline turns landward 30 to 105 kyr BEFORE the lowstand of a slow
  cycle** (A) while with the rule off it turns 20 to 45 kyr after (D), as a forward modeller expects.
  In A the shoreline stalls at 40 to 46 km (the initial shelf edge) because 60 % of the supply is
  diverted the moment the shoreface is detected; in D it reaches 76 km. The turbidite rule halves
  progradation at every sea-level stand. (F1.)
- tc share at its cap: A 461 (W) / 452 (L) of 600 steps; C 321 (W) / 328 (L); B 272 (W) / 274 (L).
  The sign of corr(sea level, share) is right only when the shoreline retreats across a wide flat
  shelf (B, C at highstand), where the shelf edge is far from the shoreline.

### 3.3 Grain-size fractionation (`03-grainsize.mjs`)
Sand share of the solids deposited during the run, by zone of the final surface (plain, shelf < 200 m
water, slope > 0.5 %, floor) and in 15 km bands.

| Run | Plain | Shelf | Slope | Floor | Bands where sand share rises basinward (of 9) |
|---|---|---|---|---|---|
| default (published curve) | 0.681 W / 0.675 L | 0.599 | 0.326 W / 0.330 L | 0.145 W / 0.153 L | 4 |
| constant sea level | 0.894 W / 0.897 L | 0.762 | 0.412 W / 0.415 L | 0.231 W / 0.226 L | 1 |
| constant sea level, no turbidites | 0.631 W / 0.630 L | 0.351 | 0.080 | 0.001 | 0 |
| as above, Kc mud = Kc sand | 0.543 W / 0.545 L | 0.494 | 0.118 W / 0.120 L | 0.001 | 2 |

- Sand is proximal and mud distal in every run. Supply sand share is 0.35; the plain deposit is 0.63
  to 0.90 sand because mud is twice as mobile on land. With equal land K the plain deposit is 0.54:
  still sand-enriched, through the marine partition at the shoreline. The down-dip sand share is
  monotonic at constant sea level without turbidites (0.98 at 0 km to 0.00 beyond 105 km).
- The four basinward rises in the default run come from the sea-level history (sand left on the
  flooded shelf at highstands, lowstand shorefaces further out), which is the right sense.
- The response to supply and sea level is in the right sense where the diffusion acts alone; where
  turbidites act, the basin sand share is set by `tcMax` (3.4).

### 3.4 Turbidites (`04-turbidites.mjs`)
- **Trigger.** At constant sea level the detected shelf edge is the shoreline column itself in 544
  (W) / 546 (L) of 600 steps; mean share 0.591 of a cap of 0.6. The first marine faces have gradients
  0.012 to 0.051 against `sBreak` 0.01. Hand: a bulk flux of 48.9 m2/yr through a face with K about
  2000 m2/yr (shoreline K at F = 0.5) needs a gradient of 0.024 = 2.4 x sBreak; even 10 % of the
  supply needs 0.2 x sBreak and the next face down is already deeper and slower. The rule is
  guaranteed to fire by the model's own parameters. Raising `sBreak` does not cure it
  (0.01 to 0.05: cap hit 461 to 194 of 600, corr(sea level, share) +0.10 to -0.10; W and L within
  0.01).
- **Sea-level signal in the default run.** Mean share by sea-level band: -150 to -80 m: 0.599 (99 %
  of steps at the cap); -80 to -40: 0.448 W / 0.457 L; -40 to -20: 0.325 W / 0.331 L; -20 to 0:
  0.361 W / 0.366 L; 0 to +50 m: 0.418 W (16 steps). There is a lowstand signal, but the highstand
  floor is 0.33 to 0.42, not near zero.
- **Run-out.** Applying the routing to the final surface of the default run (sea level -1.5 m, the
  plain drowned by the Holocene rise): the detected "shelf edge" is the drowned shoreface at 2 km (W)
  / 3 km (L), and 50 % of the routed sand lands within 8 to 9 km of it, 90 % within 11 to 13 km, at
  1.4 to 1.5 m (4.6 to 4.9 ft) per kyr in the thickest cell: a "turbidite" on the inner shelf in a
  few metres of water. Mud: 50 % within 21 km, 90 % within 35 to 38 km. Nothing is exported. The
  fall-off with distance is exponential by construction and plausible in shape; where it starts is
  wrong whenever the trigger is wrong.
- **Volume.** Sand stored beyond 100 km after 3 Myr (solid, W; L within 1 %): default 5.2 km2
  (24.8 % of the sand supplied); supply 30: 9.3 km2 (29.7 %); sandFrac 0.5: 7.8 km2 (25.9 %);
  tcMax 0.3: 3.6 km2 (17.3 %); tcMax 0: 0.2 km2 (0.9 %); constant sea level: 5.6 km2 (26.5 %);
  sine 40 m: 4.7 km2 (22.5 %); sine 80 m: 3.7 km2 (17.7 %). Basin-floor sand is almost entirely the
  rule's output (routed sand = supply x sandFrac x share x (1 - exported), `transport.ts:98-100`,
  `:249-250`); shelf width, shelf storage and sea level have little say, and a bigger sea-level
  swing gives LESS basin sand, the opposite of the lowstand-shedding expectation.
- The Gulf preset already shows the symptom: it lowers `tcMax` to 0.1 "so the deep basin is
  starved" and the wedge "keeps prograding" (`presets.ts:73`, `:77`). That is tuning around the
  trigger, not a fix.

### 3.5 Grid and time-step convergence (`05-convergence.mjs`)
Base: dx 1 km, record step 5 kyr, 5 substeps. Changes relative to base.

Constant sea level (turbidites on):

| Measure | base W / L | dx 2 km | dx 0.5 km | nSub 1 (5 kyr) | nSub 10 (0.5 kyr) | dtRec 2.5 kyr | section 300 km |
|---|---|---|---|---|---|---|---|
| mean shoreline, last 1 Myr | 36.33 / 36.34 km | -0.3 / -0.1 km | +9.0 / +9.4 km | +10.1 / +10.5 km | +0.7 / +0.7 km | +0.2 / +0.2 km | +1.5 / +1.3 km |
| steepest foreset | 2.42 / 2.26 deg | -13 / -7 % | +17 / +21 % | +51 / +71 % | 0 / -1 % | +1 / -1 % | +3 / +17 % |
| plain slope | 0.391 m/km | -14 % | +1 % | -7 % | -11 % | -3 % | -7 % |
| sand beyond 100 km | 5.56 / 5.55 km2 | +5 % | -25 / -24 % | -12 / -15 % | -2 % | -3 % | +52 % |
| mean tc share | 0.591 | +1 % | -4 % | -12 % | +1 % | +1 % | 0 % |
| sea floor at 150 km | -1046 m (-3433 ft) | -31 m | -306 / -304 m | -193 / -229 m | +13 m | +14 m | (wall moved) |

Published curve (default run):

| Measure | base W / L | dx 2 km | dx 0.5 km | nSub 1 | nSub 10 | dtRec 2.5 kyr | section 300 km |
|---|---|---|---|---|---|---|---|
| mean shoreline, last 1 Myr | 41.56 / 41.74 km | -0.8 / -0.5 km | +1.0 / +1.1 km | +2.8 / +2.0 km | -0.1 / -0.2 km | 0.0 / -0.2 km | +1.1 / +0.8 km |
| mean shelf edge, last 1 Myr | 54.44 km W | +0.4 km | +2.6 km | +1.9 km | +0.5 km | -0.4 km | +3.3 km |
| steepest foreset | 6.11 / 5.49 deg | -27 / -14 % | +8 / +1 % | -13 / -30 % | -6 / +5 % | -7 / -4 % | -3 / -5 % |
| sand beyond 100 km | 5.22 / 5.25 km2 | +6 / +5 % | -7 / -8 % | -7 % | 0 / -1 % | 0 / -1 % | +17 / +16 % |
| mean tc share | 0.406 / 0.412 | +4 / +2 % | -2 / -4 % | +4 / +3 % | -1 / -3 % | 0 / -2 % | -1 / -2 % |

- **Time step is converged** at the defaults: nSub 10 and dtRec 2.5 kyr move the shoreline by under
  1 km and the foreset by a few per cent (the few per cent is the 1-ulp noise, F6). nSub 1 is not
  acceptable: +10 km of shoreline and +51 to 71 % foreset gradient at constant sea level.
- **Grid is not converged for the constant-sea-level shoreline:** dx 0.5 km moves it 9 to 11 km
  (24 to 28 %) while dx 2 km barely moves it, a threshold response, not a smooth one. The culprit
  is the same trigger: with finer columns the detected shelf edge and the amount of mud that reaches
  the wall both change (sand beyond 100 km -25 %, wall fill -306 m). With the glacial curve the
  shoreline is grid-stable to about 1 km and the foreset to about 10 %.
- **Section length matters:** widening the section to 300 km changes the sand beyond 100 km by +52 %
  (constant sea level) and +16 to 17 % (default), and the mean shelf edge by +3.3 km. (F2.)
- The plain slope is grid- and step-dependent by 7 to 14 % in all directions because it is still
  aggrading (section 3.1); it is not a converged quantity in a 3 Myr run.

## 4. Where a specialist would distrust it

W = wrong behaviour; S = simplified and honestly labelled. "Matters" is for John's uses: where
sand reaches the slope and basin floor, and the section shape a planned well is read against.

| # | Rank | Type | Where | Behaviour | Why it matters | Minimum fix | Test that proves it |
|---|---|---|---|---|---|---|---|
| F1 | HIGH | W | `turbidites.ts:26` (sBreak test), `:24-27`; parameters `params.ts:85-90`; prose `docs/user-guide.md:105-108`, `:254` | The shelf-edge detector fires on the shoreface, so ~60 % of supply bypasses at any sea-level stand; basin sand is set by `tcMax`, not by sea level or shelf width; shoreline turns before the lowstand; "turbidites" land on the inner shelf after a transgression | Basin-floor sand volume and timing, the main thing the sections are read for, is a dial | Require a minimum water depth (e.g. 5 x dm or a new `shelfBreakDepth`) at the shelf-edge face, or search from the first column deeper than that; reword the two user-guide sentences until then | Constant sea level, shoreline 30 km inboard of the initial shelf edge: share < 0.05 all run; with the shoreline at the shelf edge: share reaches tcMax. corr(sea level, share) < -0.5 for the 1 Myr sine |
| F2 | HIGH | W (undocumented) | `transport.ts:123` (zero flux at nx - 1); `step.ts:26` (150 km section) | Diffusing mud ponds against the basinward wall: +795 m (2608 ft) at 150 km in 3 Myr with no subsidence; sand beyond 100 km changes +52 % / +17 % when the wall moves to 300 km | Thickness, water depth and sand in the outer third of every default-length section are artefacts of the wall | Open outer boundary (fixed elevation, outflow counted as exported in the ledger) or a stated "sink zone" and a wider default section | Sand beyond 100 km and sea floor at 150 km change < 5 % when nx goes 150 -> 300 at dx 1 km |
| F3 | MEDIUM | W | `turbidites.ts:26`, `transport.ts:105-119` | Constant-sea-level shoreline moves 9 to 11 km when dx is halved; wall fill -306 m; sand beyond 100 km -25 % | Any comparison between runs at different dx (the Gulf preset uses 400 columns) is not like-for-like | Falls out of F1 and F2; then re-run `05-convergence.mjs` | Shoreline changes < 2 km and sand beyond 100 km < 10 % for dx 1 km -> 0.5 km at constant sea level |
| F4 | MEDIUM | W | `transport.ts:92-100`, `:248-252`; `turbidites.ts:57` | Diverted supply is routed from the shelf-edge column every substep regardless of shelf storage; a bigger sea-level swing gives LESS basin sand (sine 80 m: 17.7 % vs constant 26.5 %) | Inverts the lowstand-shedding expectation a Gulf geologist brings to the sections | Part of F1; additionally consider feeding the rule from the flux arriving at the shelf edge rather than from the supply | Sand beyond 100 km: sine 80 m > sine 40 m > constant sea level |
| F5 | MEDIUM | S | `turbidites.ts:53-57` (S floored at 1e-5, L ~ S^2) | Sand stops in the first cell where S < ~0.5 %; a local flat on the slope (an MTD top, a salt-withdrawal low) captures all sand in one column, at up to 8 m per substep | Thick single-column sand bodies where the surface has a kink; grid-sized | Spread deposition over a minimum length (e.g. L >= dx) or cap the per-column deposit; document that sand ponds at the first flat | Thickness of a routed deposit on a surface with a one-cell terrace is spread over >= 3 cells and is the same at dx 1 km and 0.5 km |
| F6 | MEDIUM | S (known, D16.4) | `transport.ts:151-242` sorting pass; `turbidites.ts:24-27` binary trigger | Mixed runs differ Windows vs Linux: shoreline ~1 km, foreset 5.5 vs 6.7 deg, step counts by a few; pure-lithology runs are bit-identical | John reads one run on one machine; a 1 deg foreset or 1 km shoreline is noise | None in the engine; quote medians over noise runs (D16.4) and show the noise band in the UI | Already covered by the golden parity tolerances in `tests/run.test.ts` |
| F7 | LOW | S | `docs/physics-references.md:29` | "Kg picked for about 6 deg muddy slopes": the all-mud steady foreset is 1.7 to 2.3 deg; 5 to 7 deg is the default mix | Misleads a reader calibrating by eye | Reword: "about 2 deg all-mud, 5 to 7 deg at the default mix, 15 deg all sand" | `01-steady.mjs` cases A to C |
| F8 | LOW | S | `transport.ts:107`, `:169` (K from depth at the OLD surface, frozen for the substep) | The land-to-sea K jump (x25 to x29) is applied one substep late at a moving shoreline; nSub 1 shows the cost (+10 km, +51 to 71 % foreset) | Only if someone raises the substep to save time | Keep nSub >= 5; or document the 1 kyr substep as a hard floor | `05-convergence.mjs` nSub 1 vs 5 vs 10 |
| F9 | LOW | S | `transport.ts:127` point source; `subsidence.ts:11-12` no flexure | Supply enters one cell; no isostatic response to the load | Standard simplifications; the plain grade is unaffected (3.1) | None; already labelled | n/a |

Not findings (checked and in order): the implicit solve and its zero-flux ends; the stable
high-to-low visiting order (deterministic); sea level at substep midpoints; subsidence integral
exactness (tested elsewhere); supply booking in the ledger; export booking for turbidite flow;
grade q / Kc to within 1 %.

## 5. Papers to get

- Kaufman, Grotzinger and McCormick (1991), Kansas Geol. Survey Bull. 233 (the depth-dependent
  marine diffusivity form). To verify the form and whether their Kg-type background term is meant
  to act on a 1500 m slope as it does here. (To verify; not read in this review.)
- Rivenaes (1992), Basin Research 4, 133-146 (dual-lithology diffusion). To check how the sand share
  of the flux is partitioned there against the engine's pool-based mobility weighting
  (`transport.ts:166-182`). (To verify; not read.)
- A published 1D or 2D diffusion-delta benchmark with a closed-form moving shoreline (for example a
  Paola-type or Swenson-type steady-grade solution with a fixed foreset slope) so that section 3.1's
  "hand fill" becomes a true analytical test rather than a geometric estimate. I have not identified
  a specific paper I have read for this; treat as a request, not a citation.
- Any Gulf shelf-margin study John already trusts giving the share of sediment delivered past the
  shelf edge at highstand versus lowstand, to turn the F1 test thresholds (share < 0.05 at
  highstand) into a cited target rather than a round number.

## 6. How to rerun

    node scripts/review/sfm/01-steady.mjs       # grade, foreset, shoreline, progradation
    node scripts/review/sfm/02-sealevel.mjs     # A/S trajectories, phases, hand lines, tc share
    node scripts/review/sfm/03-grainsize.mjs    # sand share by zone and band
    node scripts/review/sfm/04-turbidites.mjs   # trigger, run-out, volume, sBreak sweep
    node scripts/review/sfm/05-convergence.mjs  # dx, dt, nSub, section length

All deterministic on one machine; the five scripts take about 3 minutes on Windows node 26 and about
4 minutes on WSL node 22. Gates on this branch: `npm run check` passes on both platforms (Windows
and Linux counts in the card's handoff).

## 7. Verdict

The diffusion core is sound and behaves as a forward modeller expects, with the honest limits of a
single-surface two-lithology model. The turbidite trigger and the closed basinward boundary make the
slope-and-basin part of every section, which is what John reads it for, a function of two settings
(`tcMax`, section length) rather than of sea level, supply and shelf geometry, and the user guide
currently describes a lowstand behaviour the engine does not produce.

VERDICT: NEEDS WORK
