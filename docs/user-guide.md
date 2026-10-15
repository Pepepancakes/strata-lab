# Strata Lab: user guide

For the person using the app. Depths and elevations are in feet, pressures in ppg (equivalent mud
weight), temperatures in °F, distances along the section in km. Where a unit is something else
(for example diffusivity in m²/yr) the control says so. The model works in SI inside; the
conversion happens in one place (`src/units.ts`).

How the project works is in `docs/agent-guide.md`. Where each number comes from is in
`docs/physics-references.md`. This guide says what to click and what to expect.

## 1. What the app does
It builds a 2D slice of a deepwater margin, from the shelf out to the basin floor, by running
physical processes forward in time:
- sediment is supplied at the landward end and spread by transport (rivers on land, waves and
  gravity in the sea, turbidity currents to the basin floor);
- sea level rises and falls, which moves the shoreline and decides where sand goes;
- the basement subsides, faster at the basinward end;
- buried layers compact, and the water they squeeze out can only escape at a rate set by their
  permeability, so fast-buried mud stays overpressured;
- optionally, burial temperature and quartz cement are tracked in the sands.

You choose the conditions, watch the section build, scrub back to any time, and branch a what-if.
Same inputs always give the same result, bit for bit, which is what makes rewind and branches
trustworthy.

It is a learning and planning tool. It is not calibrated to any field and uses no company data.
See section 13 for what it cannot do.

## 2. Opening it
Open `dist/strata-lab.html` in a browser (after `npm run build`; see `README.md`). It is one file,
works offline and sends nothing anywhere. The default scenario (last 3 Myr) runs on load, in
about 2 seconds. The line **Engine worker: OK** in the controls column tells you the physics engine started.

The page has three columns: the controls on the left; in the middle the section with its time
bar, and under it the pseudo-well and charts; and on the right branches, mass balance, speed and
physics checks.

## 3. The controls
Editing the **main run** runs it again from the start. Editing while a **branch** is active
changes only that branch, from where it forks (section 7). Controls that set up the run
(marked "start" below) are locked in a branch.

Every control has a small **ⓘ** button and a tag next to its name:
- **cited**: the value or its form comes from a published source. ⓘ shows the full citation.
- **tuned**: chosen by eye to give a plausible picture, not measured. ⓘ says what it was tuned for.
- **to verify**: the source is believed right but has not been checked against the paper.

"Allowed" below is what the number box accepts. Those limits are guard rails, **not published
ranges**. A published range is given only where one exists.

### 3.1 Scenario (top of the controls)
**Scenario preset** (tuned): three standard runs. Choosing one replaces the main run.
- *Last 3 Myr (default)*: 150 columns of 1 km, 5 kyr steps, 600 steps.
- *Miocene to present (23 Myr)*: 400 columns of 1 km, 50 kyr steps back to 3 Ma, then 5 kyr.
- *Full Cenozoic (66 Myr)*: 400 columns, 100 kyr steps back to 23 Ma, then as the Miocene run.
- *Overpressured slope (MTD-prone)*: the 3 Myr default with mud permeability x0.1, supply 30 m²/yr and slope failure on; 5 kyr steps.

**Run length (Myr)** (tuned): how long to run, from 0.5 Myr up to the preset's length. A shorter
run keeps the **youngest** part of the preset's schedule, so a 10 Myr run of the Miocene preset
is the last 10 Myr, cut on a whole step.

The line **Time steps:** under it says exactly what steps are used, for example "5 kyr steps back
to 3 Ma (600 steps)". Read section 5 before trusting a coarse-step run for fine detail.

### 3.2 Main controls
| Control | Default | Allowed | Source |
|---|---|---|---|
| **Sediment supply** (ft²/yr) | 215.3 (20 m²/yr) | 0 to 2153 | tuned. Solid volume per foot of margin; an order of magnitude for a large-river margin, no source yet |
| **Sand share of supply** | 0.35 | 0 to 1 | tuned. Share of the solid volume that is sand |
| **Sea-level source** | Published curve | Published curve, Sine (teaching) | cited (section 6) |
| **Sea-level amplitude (sine only)** (ft) | 131.2 (40 m) | 0 to 492 | tuned. Used only with the sine |
| **Sea-level period (sine only)** (kyr) | 100 | 10 to 1000 | tuned. Used only with the sine |
| **Sea-level offset** (ft) | 0 | -656 to 656 | tuned. Shifts either source up or down; a what-if knob |
| **Subsidence, landward edge** (ft/Myr) | 131.2 (40 m/Myr) | 0 to 1640 | tuned. The 40 to 150 m/Myr range was chosen by eye |
| **Subsidence, basinward edge** (ft/Myr) | 492.1 (150 m/Myr) | 0 to 1640 | tuned. Rate varies linearly between the two edges |

What they do physically:
- *Supply and sand share* set how much solid is delivered and how much of it is sand. More supply
  makes the shelf edge advance faster and buries mud faster (more overpressure). More sand makes
  more sand available to bypass to the basin floor at lowstand.
- *Sea level* moves the shoreline across the shelf. At a lowstand the shoreline sits near the
  shelf edge and sand bypasses to the slope and basin floor. The offset raises or lowers the
  whole record.
- *Subsidence* creates room. Where it is faster, more sediment piles up and burial is deeper.

### 3.3 Under "All other parameters (N)"
Click the arrow to open the list. Pairs of boxes are **sand** and **mud**, in that order.

**Transport** (all tuned; the form is cited where noted)
| Control | Default (sand / mud) | Note |
|---|---|---|
| **Subaerial diffusivity** (m²/yr) | 50,000 / 100,000 | Fluvial spreading on land. Gives about a 0.3 m/km coastal plain. Two-lithology form: Rivenæs (1992) |
| **Marine diffusivity at shoreline** (m²/yr) | 400 / 2,500 | Wave and current spreading at the shoreline. Form K = Km·exp(-d/dm) + Kg: Kaufman et al. (1991) |
| **Marine diffusivity e-folding depth** (ft) | 32.8 / 131.2 | How fast that spreading dies off with water depth |
| **Deep-marine background diffusivity** (m²/yr) | 100 / 1,000 | Slow gravity creep on the slope; picked to give about 5 to 7° muddy slopes |
| **Max share routed as turbidity currents** | 0.6 | Cap on the share of supply sent down as turbidity currents |
| **Shoreline-to-shelf-edge distance scale** (km) | 8 | Ties turbidity-current share to how close the shoreline is to the shelf edge |
| **Gradient defining the shelf edge** (m/m) | 0.01 | Where the model puts the shelf edge |
| **Turbidite deposition length at reference gradient** (km) | 20 / 400 | How far sand and mud travel before settling |
| **Reference gradient for turbidite length** (m/m) | 0.005 | |
| **Turbidite gradient exponent** | 2 | How strongly slope changes that length |
| **Columns** | 150 | start. Grid size |
| **Column width** (km) | 1 | start. Grid spacing |
| **Transport substeps per record step** | 5 | start. Numerical |

The turbidite controls are a **transport-length rule, not flow physics**: no flow is simulated. The
slope and coastal-plain diffusivities were tuned by eye, not calibrated to data.

**Compaction and pore pressure**
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Surface porosity** | 0.49 / 0.63 | start. cited: Sclater & Christie (1980) |
| **Compaction coefficient (effective stress)** (1/psi) | 0.000185 / 0.000359 | start. cited: converted from Sclater & Christie's depth coefficients; exponential form after Athy (1930) |
| **Permeability intercept (log10 m^2)** | -14.5 / -22 | tuned. Mud: Yang & Aplin (2010) is the candidate source |
| **Permeability slope vs porosity** | 7 / 8 | tuned. log10 k = intercept + slope × porosity |
| **Mud permeability multiplier** | 1 | tuned. Scales mud permeability: the quickest way to see more or less overpressure |
| **Unloading stiffness (share of loading compressibility)** | 0.05 | start. tuned |
| **Benchmark mode (constant properties)** | none | start. Switch for the Gibson benchmark. Leave it alone |
| **Deep compaction: full solve every N steps (1 = off)** (steps) | 1 | start. tuned. Speed-up for long runs (section 5) |
| **Deep compaction: age of the always-updated window** (kyr) | 500 | start. tuned. Used only when the line above is more than 1 |

**Changing subsidence** (M1.4c; off by default)
| Control | Default | Source |
|---|---|---|
| **Subsidence history** | constant | start. cited: McKenzie (1978). Choices *constant*, *thermal*, *history* |
| **Thermal subsidence decay time** (Myr) | 62.8 | cited: McKenzie (1978). Used only for *thermal* |
| **Subsidence history (piecewise factors)** (Ma, -) | empty | start. tuned. See below |

**Temperature and quartz cement** (M1.4c; off by default)
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Temperature on (1) / off (0)** | 0 | start. tuned (on/off switch) |
| **Temperature and cement: update every N steps** (steps) | 5 | start. tuned. Speed-up |
| **Basal heat flow** (mW/m²) | 40 | cited: Jones (2003), to verify. The Gulf of America spans from under 20 to about 100 mW/m² |
| **Grain thermal conductivity** (W/m/K) | 7.7 / 2.5 | to verify (Clauser & Huenges 1995). Mud value is tuned |
| **Pore-water thermal conductivity** (W/m/K) | 0.6 | to verify (Woodside & Messmer 1961) |
| **Deep-water seafloor temperature** (deg F) | 39.2 (4 °C) | to verify. Not checked against a source |
| **Shelf / land surface temperature** (deg F) | 68 (20 °C) | tuned |
| **Seafloor temperature e-folding depth** (ft) | 984 | tuned. Smooth stand-in for the thermocline |
| **Quartz cement on (1) / off (0)** | 0 | start. tuned (switch). Needs temperature on |
| **Quartz precipitation rate prefactor** (mol/m^2/s) | 1.98e-18 | cited: Walderhaug (1994) |
| **Quartz precipitation temperature coefficient** (1/deg C) | 0.022 | cited: Walderhaug (1994). Walderhaug (1996) varied it from 0.018 to 0.023 |
| **Temperature where cementation starts** (deg F) | 158 (70 °C) | cited: Walderhaug (1996). Below it the rate is zero |
| **Sand grain diameter (cement surface area)** (mm) | 0.2 | tuned. Synthetic |
| **Share of grain surface that is clean quartz** | 0.7 | tuned. Synthetic |

**Slope stability** (M2.1; drawn by the Factor of safety colour mode, section 4)
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Friction angle phi' (effective stress)** (deg) | 33 / 25 | to verify (Hampton et al. 1996). Muds about 20 to 30°, sands about 30 to 38° |
| **Cohesion c' (effective stress)** (psi) | 0 / 0 | to verify (Hampton et al. 1996). Normally consolidated marine clay is near 0 |
| **Stability search depth below the seafloor** (ft) | 984 (300 m) | tuned. How deep the factor-of-safety search goes |

The factor of safety is the strength holding a slab of sediment in place divided by the pull of
gravity along the slope. Below 1 the slab would slide. The engine works it out from the
seafloor slope and the model's own pore pressure, so overpressure lowers it directly.

Slope failure and debris-flow run-out (M2.2; drawn in the section, the event list and the pseudo-well, sections 4, 8 and 10)

| Control | Default | Source |
|---|---|---|
| Slope failure on (1) / off (0) | 0 | start. tuned (switch). Shown as the check box *Slope failure (MTDs)* at the top of the controls. Off keeps the run identical to M1 |
| Most columns in one failure | 10 | tuned. How far a failure spreads sideways |
| Most failures per step (rechecks of the scar) | 5 | tuned |
| Debris-flow yield strength (psi) | 0.73 (5 kPa) | tuned. Imran et al. (2001) model, to verify |
| Debris-flow viscosity (Pa s) | 1000 | tuned. Sets the speed, not where the flow stops |
| Debris-flow bulk density (kg/m^3) | 1800 | tuned |
| Porosity of mud in a fresh debris deposit | 0.55 | tuned |
| Shallowest slip surface considered (ft) | 32.8 (10 m) | 0 to 328 | tuned. Thinner slides than this are skin slides, not MTDs; 0 searches every cell |
| Gentlest slope checked for failure (deg) | 0.5 | 0 to 5 | tuned. A speed cut and a stated limit: failures on slopes under this are not modelled |
| Sea-level fall that makes an event a lowstand event (ft) | 16.4 (5 m) | 0 to 328 | tuned. Only the trigger tag |
| Accumulation rate that counts as rapid loading (m/yr) | 0.001 | 0.00001 to 0.1 | tuned. Only the trigger tag |

With the switch on, any column whose factor of safety falls below 1 fails: the sediment above the slip surface runs out as a debris flow and stops where the yield strength holds it, as a mass-transport deposit (MTD). Sand and mud are conserved separately; debris that runs off the basinward edge counts as exported.

Why did it fail? (M2.3.) Every failure carries one trigger tag, worked out from the weakest column's change over the last 4 steps (20 kyr at 5 kyr steps). Nothing is imposed; the factor of safety falls for physical reasons and the tag says which one did most of it. In order: *lowstand* (sea level fell by at least the lowstand threshold), *oversteepening* (the slope got steeper, and that explains more of the drop than pore pressure), *rapid loading* (pressure explains it and the column gained sediment faster than the rapid-loading rate) and *overpressure* (pressure explains it and the loading was slow, so the pressure was already there). The tag does not change the physics; it is a label on the cause. The numbers behind it are stored with each event. The preset *Overpressured slope (MTD-prone)* turns failure on with mud permeability x0.1 and supply 30 m²/yr (both tuned) so there are events to look at. Limits: slopes under 0.5° and slip surfaces shallower than 10 m are not searched.

Two things to know about the edit boxes:
- **Subsidence history (piecewise factors)** has no boxes in the app yet. It is a list the
  engine accepts but the controls have no editor for, so the *history* choice of **Subsidence
  history** has nothing to work with. Use *constant* or *thermal*.
- **Benchmark mode (constant properties)** is for the Gibson test. Do not set it.

## 4. Reading the section
The big picture is the section: distance in km along the bottom, depth in ft on the left. A note
at the top right gives the vertical exaggeration (the section is much longer than it is deep, so
it is stretched). The shoreline and the shelf edge are marked. Water is pale blue.

Pick a colour mode with the buttons above it. The legend below the picture shows the ramp.
- **Grain size**: share of sand in each layer. Grey-green is mud, yellow is sand. Look for yellow
  tongues out in the basin: sand that bypassed the shelf at a lowstand.
- **Age**: when each layer was laid down, purple oldest, yellow youngest. Lines of constant
  colour are time lines. This is the mode for seeing how the clinoform builds out.
- **Porosity**: from 0.10 (brown) to 0.65 (teal). Deep and sandy layers lose porosity. A porous
  layer buried below a tight one is a candidate for trapped water.
- **Overpressure (λ*)**: the share of the buoyant load that the pore fluid carries. 0 is
  hydrostatic (pale), 1 is at the overburden (dark red). Look for the dark red under the fast
  depocentre in mud.
- **Temperature (°F)**: 32 to 392 °F, blue to red, steady conduction from the basal heat flow.
  It is always available. It does not need the temperature switch (that switch matters for
  cement, section 9).
- **Factor of safety**: the slope-stability result for every cell, on a log scale from 0.25 to 4 with 1.0
  in the middle. Reds are cells with a factor of safety below 1.2 (below 1 the slab would slide);
  pale to blue is safe. Flat seafloor has nothing pulling the slab down, so it is blue. A black
  dashed line shows the critical slip depth: the cell with the lowest factor of safety in each
  sloping column. Safety is worked out from the model's own pore pressure, so overpressure turns
  cells red.

**MTDs in every colour mode.** Debris-flow deposits (MTDs) are drawn hatched, with the stripes
changing direction from patch to patch, so they stand out over any colour. The hatching marks every
cell in the deposit of a slope-failure event, not only cells where debris is at least half of the
solids. A pink flag marked *headwall #n* shows where a failure started, for three steps after it
(and always for the event picked in the event list). With a picked event, the source columns are
drawn in pink on the seafloor and its deposit is outlined in yellow.

Click anywhere on the section to move the pseudo-well to that column. A vertical line shows where it is.

### The time bar
Under the section: **Play** (or Pause), **Back** and **Forward** (one step), **Start**,
**Present**, a slider to drag to any time, and two speed settings (frames per second, steps per
frame). The readout says which step you are at and its age in Ma (millions of years ago). All
of it is rewind: dragging back gives exactly the state the run had then.

## 5. Run length, presets and time steps
Speed depends on the number of **steps**, not the number of years. The three presets balance this
by using longer steps further back in time.

What coarse steps can and cannot show:
- A 100 kyr step cannot show a 20 kyr or 41 kyr glacial cycle. **Individual glacial cycles
  disappear** in the old part of a long run. What survives is the average of sea level over the
  step, and the long trend.
- For 3 Ma to present, the Miocene and Cenozoic presets still use 5 kyr steps, so the glacial
  cycles are resolved there.
- The Miller et al. (2020) record used before 3 Ma is itself smoothed (about 2 Myr), so it has no
  glacial cycles to show even with fine steps.
- To keep long runs fast, the preset runs use **bundled deep compaction**: old layers are
  consolidated once every 10 or 20 steps, with the summed time. This is a numerical saving, not
  physics. It was measured against the full solve (about 0.25 % of the thickness on the Miocene
  preset and 0.8 % on the Cenozoic one; see `docs/physics-references.md`). The layer record still holds every layer.
- Use the long presets to see where sand and mud go over millions of years, not to read
  precise pressures at a fixed depth.

## 6. Sea level: the published curve, the sine, and the splice
**Sea-level source** switches between two:
- **Published curve** (default): a real global record. Younger than about 3 Ma it is Bintanja &
  van de Wal (2008) (ice-volume record, every 300 yr). Older than that it is Miller et al. (2020)
  (smoothed Cenozoic record, 20 kyr, uncertainty about ±10 m).
- **Sine (teaching)**: a plain sine of **Sea-level amplitude (sine only)** and **Sea-level period
  (sine only)**. Good for seeing cause and effect; real sea level is not periodic.

**The splice.** The two published curves meet between 2.8 and 3.0 Ma. Over that 200 kyr window
the model blends them linearly. At 3 Ma they differ by only 3.3 m, so there is no jump (the
largest change over 100 yr in the window is 0.37 m). In the chart, the line **changes colour**
where the record changes, and the line under the chart says which curve is in use at the time on
the slider and gives its citation.

The chart is **Sea level through time**, in ft, with the time axis in Ma (million years ago)
and a black line at the current slider time. A second chart, **Subsidence rate through time**,
shows the two edge rates (green landward, orange basinward) that were applied at each step.

## 7. Branches and compare
A branch is a what-if timeline. It shares the main run's history up to where you forked and
then runs with changed controls.

1. Drag the slider to the moment you want to change things from.
2. Press **Branch from here**. A new branch appears, active.
3. Change a control. Only the active branch changes, from the fork onward. Controls marked
   "start" are locked in a branch.
4. Select **Main run** or another branch with its radio button to look at it.
5. To compare, tick **compare with active** on another branch. A line under the section says how
   far the two surfaces differ at the current time, in ft, or "(identical)".
6. **Delete** removes a branch and its memory. The main run cannot be deleted.

Each branch keeps its own saved states; the list shows the memory a branch needs ("own 7.5 MB").
There can be **at most 8 branches**.

The classic test is the one from the spike: fork at 2 Ma, set **Sea-level offset** to
-164 ft (-50 m), and compare. Everything before 2 Ma is identical. After, the shoreline and shelf
edge sit further basinward at highstands. The effect is modest (the spike measured about 5 % more
basin-floor sand) because the ±40 m cycles already swing the shoreline across the whole shelf.

## 8. The pseudo-well
The **Pseudo-well** panel is a synthetic well at the column you clicked, at the time on the slider.
Depth is TVDSS in ft (below the sea surface). It has four tracks:
1. **Pressure, ppg EMW**: pore pressure (red), overburden (black) and hydrostatic (blue dashed),
   on a 6 to 20 ppg scale. Where red moves right of blue, the well is overpressured. If it
   approaches black, the pore fluid is carrying nearly all the load.
2. **Porosity**, 0 to 0.7.
3. **Temperature, °F**. A purple line marks where **Temperature where cementation starts** is
   crossed, and the depth where it happens is labelled. If cement is off the label says
   "(cement off)".
4. **Grain size**: yellow is sand, grey-green is mud.
   Debris-flow deposits (MTDs) in the column are hatched, labelled *MTD #n* with the event number.
   Hover (or tab to) a hatched interval to read the event: time, cause, source position, scar depth,
   volume and run-out. The same text appears under the plot.

If salt is ever present (it is not, in M1) it is drawn pink and labelled "salt".

The temperature in this panel and in the Temperature colour mode is **steady conduction**: it
assumes the heat has had time to reach its balance. Real, fast-buried basins are colder at depth
than this, so deep temperatures read too warm.

## 9. Burial temperature, quartz cement and changing subsidence
These three arrive with M1.4c. All are **off** by default so the default run is identical to
the spike.

**Changing subsidence.** Set **Subsidence history** to *thermal*: the two edge rates are the
rates at the start of the run and decay as exp(-t/τ) with τ = **Thermal subsidence decay time**,
62.8 Myr (McKenzie 1978). That is the decay law only, not a stretching model, and the rates are
still tuned. It is a start-only control, so change it on the main run.
- Effect on porosity and pressure: subsidence that slows with time gives less room later, so
  late sediment is buried more slowly and has more time to lose its water; fast early
  subsidence buries fast and keeps more water in. That is the direction to expect. The tests
  check the subsidence arithmetic against its closed form, not the size of the pressure effect,
  so judge that by running both and comparing branches or runs.

**Burial temperature.** Set **Temperature on (1) / off (0)** to 1. The model computes steady
conduction: temperature = seafloor temperature + heat flow × Σ(thickness / conductivity), where
the bulk conductivity mixes grain and water. On its own it changes nothing in porosity or
pressure. It exists to drive cement. It also feeds the Temperature colour mode and the temperature track.

**Quartz cement.** Set **Quartz cement on (1) / off (0)** to 1 (temperature must also be on).
Above about 158 °F (70 °C) quartz precipitates in sands at Walderhaug's rate, which grows by a
factor of about 4.6 for every 30 °C (54 °F) of heating. What it does:
- It fills pore space in sand, so sand porosity falls and sand permeability follows it down.
- It freezes the sand framework at the stress it had when cementing began, so cemented sand stops
  compacting. Mud keeps compacting by stress as before.
- The silica comes from outside the model. It has its own line, **Quartz cement**, in the mass
  balance panel, so sand and mud still balance on their own.
- Effect on pressure: cemented sand is tighter, so it can be expected to drain less easily. The
  tests check the cement amount (against a hand calculation) and its mass line, not the
  pressure effect. The model has no chemical compaction of mud.

If you change these on the main run you must wait for the run to recompute.

## 10. Panels on the right
**Slope failures** (the list at the top of the right column). One row per failure event: number,
time (Ma), cause (lowstand, oversteepening, rapid loading or overpressure; section 3.3), source
position (km along the section), scar depth (ft), volume and run-out (km). Volume is the area
removed from this 2D section in km², not a 3D volume. Click a row (or its number) to go to that
event: the time bar moves to just after it, the pseudo-well moves to the middle of its deposit,
and the section marks the headwall, the source columns and the deposit. Click again to clear.
Rows after the current time are greyed. With failure off the panel says so.

**Mass balance** (km² of solid in the section; grains only, no pores):
- *supplied*: total delivered at the landward end.
- *stored*: change in the amount in the record since the start.
- *exported*: what left the model at the basin edge.
- *imbalance*: stored − (supplied − exported). Must be zero to rounding (1e-13 or so). Hover it
  for the relative error.
- Rows: **All sediment**, **Sand only**, and **Quartz cement** when cement is on. Sand has its own
  row on purpose: a total can balance while the sand/mud split is wrong.

**Speed**: **Run time**, **Last jump (worker)** (the last seek) and **Draw time**.

**Physics checks**: see section 11.

## 11. The physics checks panel
Press **Run checks**. It runs eight benchmarks in the browser, each against an exact solution or
a hand calculation, takes about 0.2 s and prints **ALL PASS (8/8)** or says what failed. Each row
shows the measured number, its limit and its source.

| Check | What it proves |
|---|---|
| **Consolidation vs Gibson (1958)**, T = 0.1, 1, 10 | The pore-pressure solver reproduces the exact solution for a clay layer that thickens at a constant rate. Limit 0.001 of overburden. Results are of order 1e-4 or less |
| **Drained sand porosity at 2 km vs Sclater & Christie (1980)** and **Drained mud porosity at 2 km ...** | With water free to leave, compaction follows the published porosity-depth curve to within 0.02 porosity |
| **Mass balance, sand only** and **Mass balance, mud only** | Over a 1 Myr coupled run, what is stored equals what was supplied minus what left, per grain size, to 1e-9 |
| **Rewind is bit-identical** | A state restored from a saved state and replayed equals an uninterrupted run exactly. This is why scrubbing and branching can be trusted |

What the checks do **not** prove: that the parameters are right for any real basin, that the
turbidite rule is physical, or that cement and temperature give the right numbers. Those
parameters are labelled tuned or to verify. Cement and temperature have their own tests in the
project (`tests/burial.test.ts`) but not in this panel.

## 12. Save, open and autosave
The four buttons at the top of the controls:
- **Save** downloads a file `*.strata.json`. It stores the recipe: preset, seed, grid, run length,
  time steps, the main run's edited controls, every branch with its edits, and one fingerprint (a
  hash) per branch. It does **not** store the computed section.
- **Open…** reads such a file, recomputes everything, and compares the fingerprints. If they
  match you get exactly what was saved. If they don't (usually because the engine changed after
  the file was made) a warning banner says the file "was made with a different engine version;
  results differ" and names the branches that differ. A file that is not a valid scenario is
  refused with a plain message and your current work is left alone.
- **New** goes back to the default last-3-Myr scenario.
- **Reset** keeps the current preset at full length and puts the controls back to its values.

**Autosave** keeps a copy of the recipe in this browser (local storage) a moment after every
change, and puts it back when you reload the page. It is a safety net, not a save: the line
under the buttons still says **Changes not saved to a file (kept in this browser)** until you
press Save. If the browser blocks local storage the app works but tells you autosave is off.

**Replace warning.** New, Open and Reset ask first if you have changes not saved to a file:
**Save first**, **Replace** or **Cancel**. Changing the preset, the run length or a main-run control
also asks if it would throw away branches.

## 13. Known limits
- **Turbidites are a transport-length rule, not flow physics.** No turbidity-current flow, no
  channels or levees, slope failure is off by default and limited (section 3.3), no faults, salt or 3D yet.
- **The slopes are tuned.** Slope and coastal-plain diffusivities were tuned by eye to about 6°
  muddy slopes and a 0.3 m/km coastal plain, not calibrated to data.
- **Default overpressure is mild** (maximum about 14 % of the load, at 20 m²/yr supply). To see
  strong overpressure lower **Mud permeability multiplier** or raise **Sediment supply**.
- **No salt yet.** The record can hold salt (and the pseudo-well and balance panel will draw
  it), but nothing creates it until a later milestone. Salt weight on the sediment below is not
  counted.
- **Supply and subsidence are tuned**, not taken from a published Gulf of America rate.
- **Temperature is steady conduction.** It ignores the cooling effect of fast burial, so deep
  temperatures read too warm. Several thermal inputs are marked to verify.
- **Cement:** the grain surface area is held at its starting value, which slightly overestimates
  late rates. Mud has no chemical compaction.
- **Long runs are coarse.** Glacial cycles vanish in the old part (section 5).
- **Chaos.** The coupled system is sensitive: a 1e-7 relative change in supply moves the surface
  by about 4 m on a 12 Myr run. A tiny difference between two branches cannot be read as a
  physical effect.
- **Memory.** Measured: the main run needs about 21 MB (3 Myr), 76 MB (Miocene) or 88 MB (66 Myr),
  and a branch forked at 80 % of the run adds about 7, 27 or 38 MB. The cap is 8 branches.
- **Seek speed.** Scrubbing is quick for the default run (median about 30 ms) and slower for
  66 Myr runs (about 110 ms); that was measured on one Windows machine and moves with load.
- **Branches in a reopened file get new internal names** (branch 4 may become 3). Nothing in
  the file depends on them.
- The app has not had a specialist review. Treat the pictures as a thinking aid, not a prediction.
