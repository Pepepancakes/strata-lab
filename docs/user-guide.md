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
- optionally, burial temperature and quartz cement are tracked in the sands;
- optionally, steep slopes fail and run out as debris flows, leaving mass-transport deposits
  (MTDs; section 13).

You choose the conditions, watch the section build, scrub back to any time, and branch a what-if.
Same inputs always give the same result, bit for bit, which is what makes rewind and branches
trustworthy.

It is a learning and planning tool. It is not calibrated to any field and uses no company data.
See section 14 for what it cannot do.

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
**Scenario preset** (tuned): four standard runs. Choosing one replaces the main run.
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
| Shallowest slip surface considered (ft) | 32.8 (10 m) | tuned (allowed 0 to 328). Thinner slides than this are skin slides, not MTDs; 0 searches every cell |
| Gentlest slope checked for failure (deg) | 0.5 | tuned (allowed 0 to 5). A speed cut and a stated limit: failures on slopes under this are not modelled |
| Sea-level fall that makes an event a lowstand event (ft) | 65.6 (20 m) | tuned (allowed 0.3 to 328). Only the trigger tag |
| Accumulation rate that counts as rapid loading (m/yr) | 0.001 | tuned (allowed 0.00001 to 0.1). Only the trigger tag |
| Slope term that counts as oversteepening | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Pressure term that counts as overpressure | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Run-out below which a repeat failure is not tried again (km) | 0.5 | tuned (allowed 0 to 10). Skips re-failing a column that moved nothing |

With the switch on, any column whose factor of safety falls below 1 fails: the sediment above the slip surface runs out as a debris flow and stops where the yield strength holds it, as a mass-transport deposit (MTD). Sand and mud are conserved separately; debris that runs off the basinward edge counts as exported.

Why did it fail? (M2.3, rule changed in M2.7.) Every failure carries one trigger tag, worked out from the weakest column's change over the last 4 steps (20 kyr at 5 kyr steps). Nothing is imposed; the factor of safety falls for physical reasons and the tag says which one did most of it. Each of three terms (steeper sea floor, rising pore pressure, falling sea level) is divided by its own tuned threshold, and the term with the largest ratio wins if that ratio is at least 1: *oversteepening*, *rapid loading* (the pressure term, when the column gained sediment faster than the rapid-loading rate), *overpressure* (the pressure term, when loading was slow) or *lowstand*. If no ratio reaches 1 the tag is *mixed*. The tag does not change the physics; it is a label on the cause, and the list shows all three terms behind it (section 13.4). Failures that move almost nothing are flagged *stalled*, and failures cut by the search depth limit are flagged *window-limited* (section 13.4). The preset *Overpressured slope (MTD-prone)* turns failure on with mud permeability x0.1 and supply 30 m²/yr (both tuned) so there are events to look at. Limits: slopes under 0.5° and slip surfaces shallower than 10 m are not searched.

Salt (M3.1 to M3.3; off by default, so the default run is unchanged)

| Control | Default | Source |
|---|---|---|
| Salt layer on (1) / off (0) | 0 | start. tuned (switch). A mobile salt layer between the basement and the sediment |
| Initial salt thickness (ft) | 4921 (1500 m) | start. tuned. Synthetic |
| Salt pinch-out: no salt landward of (km) | 25 | start. tuned |
| Salt pinch-out: full thickness basinward of (km) | 45 | start. tuned |
| Salt viscosity (Pa s) | 1e17 | tuned. Hudec & Jackson (2007) range about 1e17 to 1e19, to verify; the default is the fast end so flow shows in 3 Myr |
| Salt substeps per record step | 5 | start. tuned. Numerical |
| Cover resists bending (1) / not (0) (salt on) | 1 | tuned (switch). 1: the sediment above the salt is a viscous plate, so a preferred diapir width emerges. 0: thin-sheet flow only (M3.1), where the narrowest bumps grow fastest |
| Cover effective viscosity as a plate (salt on) (Pa s) | 1e19 | tuned. No published value for a whole cover is in the references (to verify). Widths scale as its 1/6 power |
| Unevenness of the older cover (salt on) | 0 | start. tuned. Seeded random thickness variation of the older cover |
| Seed of the cover unevenness | 1 | start. tuned |
| Weld: salt thinner than (ft) | 32.8 (10 m) | tuned (allowed 0 to 656). Hudec & Jackson (2007). A column counts as welded once its salt, which was thicker, falls below this. A label and an age only |
| Salt thermal conductivity at 0 deg C (W/m/K) | 6.0 | to verify (Clauser & Huenges 1995). Halite is about 5 to 6.5 near the surface, 2 to 4 times the sediment |
| Salt conductivity falls with temperature: a (1/K) | 0.0030 | to verify (Clauser & Huenges 1995). Coefficients as remembered for crystalline rock, not checked for halite |
| Salt conductivity falls with temperature: b (W/m/K^2) | 0.0042 | to verify (Clauser & Huenges 1995). See a |

With salt on, the sediment loads the salt and squeezes it basinward; the cover above rides up and down on the salt. Salt volume is conserved and has its own line in the mass balance. The cover resists bending (M3.2), so the width of the structures is set by the cover viscosity and thickness, not by the cell size: check by halving the cell size. Welds (M3.3): salt can never go below zero thickness. When a long step would ask a cell for more salt than it holds, the outflow is cut to what the cell has, so nothing is clipped and salt stays conserved. A column whose salt falls below Weld: salt thinner than is welded, and its first weld age is kept (it rewinds with the run). Salt conducts heat well, so everything below salt is cooler in the Temperature colour mode and the pseudo-well, and the weight of salt counts in the overburden.

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
(and always for the event picked in the event list; section 13.4). With a picked event, the source columns are
drawn in pink on the seafloor and its deposit is outlined in yellow.

Click anywhere on the section to move the pseudo-well to that column. A vertical line shows where it is.

### The time bar
Under the section: **Play** (or Pause), **Back** and **Forward** (one step), **Start**,
**Present**, a slider to drag to any time, and two speed settings (frames per second, steps per
frame). The readout says which step you are at and its age in Ma (millions of years ago). All
of it is rewind: dragging back gives exactly the state the run had then.

## 5. Run length, presets and time steps
Speed depends on the number of **steps**, not the number of years. The presets balance this
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

Salt (when Salt layer is on) is drawn pink and labelled "salt".

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
time (Ma), cause (lowstand, oversteepening, rapid loading, overpressure or mixed; section 13.3), source
position (km along the section), scar depth (ft), volume and run-out (km). Volume is the area
removed from this 2D section in km², not a 3D volume. Click a row (or its number) to go to that
event: the time bar moves to just after it, the pseudo-well moves to the middle of its deposit,
and the section marks the headwall, the source columns and the deposit. Click again to clear.
Under each row a grey line gives the three terms behind the cause in words, and a stalled or window-limited event adds a note (section 13.4). The header counts events, stalled events and unresolved columns. Rows after the current time are greyed. With failure off the panel says so.

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
| **Infinite-slope FS, 6° slope, 25° friction, r_u 0.5** | The engine's factor of safety equals tan 25° / tan 6° × (1 − 0.5) = 2.2183 (hand calculation, relative error under 1e-12) |
| **FS crosses 1 at r_u = 1 − tan β / tan φ** | For 6° and 25° that is r_u = 0.7746. The engine gives FS = 1 there, above 1 just below it and below 1 just above it |
| **Bingham plug thickness** | A debris flow on a 5° slope has a rigid plug of thickness τ_y / (ρ′ g sin θ); a flow thinner than that does not move |
| **Mass balance through a slope failure, sand** and **... mud** | On a steep, overpressured hand-built slope, the sand (and the mud) before the failure equals what is left in the section plus what ran off the end, to 1e-12 |
| **Rewind is bit-identical** | A state restored from a saved state and replayed equals an uninterrupted run exactly. This is why scrubbing and branching can be trusted |

What the checks do **not** prove: that the parameters are right for any real basin, that the
turbidite rule is physical, or that cement and temperature give the right numbers. Those
parameters are labelled tuned or to verify. Cement and temperature have their own tests in the
project (`tests/burial.test.ts`) but not in this panel.

## 12. Save, open and autosave
The four buttons at the top of the controls:
- **Save** downloads a file `*.strata.json`. It stores the recipe: preset, seed, grid, run length,
  time steps, the main run's edited controls, every branch with its edits, and one fingerprint (a
  hash) per branch plus a few summary numbers (total sand and mud, mean surface height, largest
  overpressure, number of slope failures). It does **not** store the computed section.
- **Open…** reads such a file, recomputes everything, and compares the fingerprints. If they
  match you get exactly what was saved. If a fingerprint differs, the app compares the summary
  numbers: the same computer program gives slightly different last digits on a different
  operating system (Windows, Linux, Mac), so a file saved on one machine can open on another with
  a different fingerprint but the same totals. That is accepted without a warning. Only if the
  summary numbers differ too (usually because the engine changed after the file was made), or the
  file has no summary numbers (files from before this was added), a warning banner says the file
  "was made with a different engine version; results differ" and names the branches that differ.
  A file that is not a valid scenario is refused with a plain message and your current work is
  left alone.
- **New** goes back to the default last-3-Myr scenario.
- **Reset** keeps the current preset at full length and puts the controls back to its values.

**Autosave** keeps a copy of the recipe in this browser (local storage) a moment after every
change, and puts it back when you reload the page. It is a safety net, not a save: the line
under the buttons still says **Changes not saved to a file (kept in this browser)** until you
press Save. If the browser blocks local storage the app works but tells you autosave is off.

**Replace warning.** New, Open and Reset ask first if you have changes not saved to a file:
**Save first**, **Replace** or **Cancel**. Changing the preset, the run length or a main-run control
also asks if it would throw away branches.

## 13. Slope failure and MTDs
A mass-transport deposit (MTD) is what a slope failure leaves behind: a slab of slope sediment
slides, breaks up, runs down the slope as a debris flow and stops as a chaotic body. The app does
not draw MTDs on request. It checks every slope column at every step and lets the sediment fail
when the physics says so. Slope failure is **off** by default, so the default run is unchanged.
Turn it on with the check box *Slope failure (MTDs)* at the top of the controls (it restarts the
run, and a branch cannot change it) or choose the preset *Overpressured slope (MTD-prone)*.

### 13.1 What the factor of safety (FS) means
FS is the strength holding a slab of sediment in place divided by the pull of gravity along the
slope. Above 1 the slab stays. Below 1 it would slide. The slab is a thin sheet parallel to the
seafloor. The app tries every layer in the top 984 ft below the seafloor (**Stability search depth
below the seafloor**) in each sloping column and keeps the weakest.
- A steeper seafloor raises the pull, so FS falls.
- Overpressure means the pore water carries part of the weight, so the grains press together less,
  friction is lower and FS falls. The pressure is the model's own, from the compaction solver, so
  fast loading of slow-draining mud lowers FS without any extra setting.
- Friction angle and cohesion (section 3.3) set the strength. With cohesion 0, FS is
  (1 - share of the load carried by the pore fluid) x tan(friction angle) / tan(slope). On a 6°
  slope, mud at 25° (the default) needs the pore fluid to carry about three quarters of the
  buoyant load before FS reaches 1.
- Flat seafloor has no pull along the slope, so it cannot fail.

### 13.2 What happens in a failure
After each step every column with FS below 1 fails. The weakest column and the unstable columns
touching it (at most **Most columns in one failure**) fail together. The sediment above the slip
surface is taken out, runs downslope as a debris flow and stops where its yield strength holds it.
The debris is laid down as an MTD in the layer of that step, and the scar is checked again (at
most **Most failures per step (rechecks of the scar)** times). Sand and mud are each conserved:
removed = deposited + exported, where exported is debris that ran past the basinward edge. The
mass-balance panel counts it under *exported*.

### 13.3 What each trigger means
Each event is tagged with the main reason FS fell, worked out from the weakest column's change
over the last 4 steps (20 kyr at 5 kyr steps). Nothing is forced: the tag is a label on a physical
result. Three terms are measured, each divided by its own threshold (**Slope term that counts as oversteepening**, **Pressure term that counts as
overpressure** and **Sea-level fall that makes an event a lowstand event** in section 3.3, all tuned), and the largest ratio wins if it
is at least 1:
- **oversteepening**: the sea-floor slope got steeper.
- **rapid loading**: pore pressure rose and the column gained sediment faster than
  **Accumulation rate that counts as rapid loading** (0.001 m/yr).
- **overpressure**: pore pressure rose and loading was slow, so the pressure was already there.
- **lowstand**: sea level fell (default threshold 65.6 ft, 20 m, over those steps).
- **mixed**: none of the three reaches its threshold, so no single cause stands out.

The thresholds change the tag only, never the physics. Because the pressure term is measured on
a log scale it can reach tens of times its threshold when the pressure jumps toward the load, so
on the MTD-prone preset most events read rapid loading or oversteepening and few read lowstand.
That is a property of the tuned thresholds, not a finding about the sea level. Read the tag as
"what changed most just before the failure", not as the whole chain of cause. Tap the (i) next to
**Cause** in the list for the same rule in short form.

### 13.4 Reading the Factor of safety colour mode and the event list
- **Factor of safety** (a colour button above the section). Dark red to red is FS below 1, pink is
  1 to 1.2 (close to failing), then pale grey-blue to deep blue is safe (log scale, 0.25 to 4).
  The black dashed line follows the critical slip depth of each sloping column. Scrub the time bar
  and watch the red patches: they appear where overpressure builds or the slope steepens, and a
  failure removes the red above its slip surface. Hatched cells are MTDs and show in every colour
  mode.
- **Slope failures (MTDs)** (the panel at the top of the right column). One row per event: #,
  Time (Ma), Cause, Source (km), Scar (ft), Volume (km²) and Run-out (km). Volume is the area
  removed from this 2D section, not a 3D volume. A run-out of 0.0 means the debris stopped
  inside its own source columns. Click a row: the time bar goes to just after the event, the
  pseudo-well moves into the deposit, and the section shows the pink *headwall #n* flag, the source
  columns and the yellow-outlined deposit. Click again to clear. Rows later than the current time
  are grey. Under each row, a grey line gives the three terms behind the cause in words, for
  example *steepening ×1.2 in the last 4 steps; pressure rise: effective stress fell to 67% of its earlier
  value; sea-level fall 7.0 m*. The ×1.2 is how many times steeper the sea floor became, and the
  percentage is how much of the effective stress (load minus excess pore pressure) was left.
- **Stalled.** A row marked *(stalled)* says *failed but debris stayed: column unresolved*. The slope
  failed, but the debris moved less than 0.5 km, so the columns are still unstable. The model
  does not fail the same columns again in the same step, so they are counted, not hidden: the
  list header gives *N events, M stalled; K unresolved columns*. K adds up the columns of the
  stalled events only. Treat an unresolved column as
  "still unstable, not modelled further in that step". Tap the (i) next to the note. A step that
  hits the limit of rechecks while a column is still unstable is not flagged on any row; the model
  counts it internally (the MTD-prone preset in Node: header 2, internal count 4).
- **Window-limited.** A note *scar depth equals the search window (300 m, tuned)* means the
  scar went as deep as the search allows, so the real failure may be deeper and the scar depth and
  volume are lower bounds.
- **Pseudo-well** (section 8). MTD intervals are hatched and labelled *MTD #n*. Hover one to read
  its event.
- Events in the same step share a place and a time, so their headwall flags overlap in the section.
  Use the list to tell them apart.

### 13.5 The preset *Overpressured slope (MTD-prone)*
The default scenario with **Mud permeability multiplier** 0.1 and **Sediment supply** 30 m²/yr
(both tuned), slope failure on, 3 Myr, 5 kyr steps. Slow draining plus fast loading overpressures
the slope mud. The run is deterministic: the same code in the same runtime gives the same events. It does
**not** give the same events on every platform (section 14). After the M2.7 fixes it gave:
- Node 26 (the tests): 24 events, 16 tagged rapid loading and 8 oversteepening, 2 stalled (header: 2 unresolved columns;
  the engine's own count is 4, because two steps ended at the recheck limit with the slope still unstable and no stalled flag), 3 window-limited (deepest scar 299.3 m of the 300 m window).
- The built app in Chrome 155: 37 events from 2.49 Ma to 0.02 Ma, 32 rapid loading and 5
  oversteepening, 9 stalled, 10 unresolved columns, 1 window-limited. The sources are between km 47 and km 98.
- No event is tagged lowstand, overpressure or mixed. The M2.3 version tagged 32 of 33 events
  lowstand because sea level was tested first with a 5 m threshold; that was a flaw of the rule and
  it is fixed.

The events sit where the pressure is high and the slope is steep, which is what the physics says
should fail first. Whether the places and times
look right for an overpressured slope is your call. Nothing here is calibrated to a basin.

### 13.6 Limits (read before trusting a picture)
- **Infinite slope, 2D only.** The slip surface is a slab parallel to the seafloor. There are no
  rotational slumps (curved slip surfaces) and nothing in the third dimension. Volume is an area.
- **No earthquakes.** Strength is drained only: no shaking, no undrained or cyclic strength loss.
  Earthquakes are a common real trigger, so the model can miss failures.
- **Searched slopes and depths are limited.** Columns gentler than **Gentlest slope checked for
  failure** (0.5°) and slip surfaces shallower than **Shallowest slip surface considered** (32.8 ft)
  are skipped, so failures on very gentle slopes are not modelled at all.
- **The run-out method is simple.** It is a depth-averaged Bingham flow (Imran et al. 2001, written
  from the paper's model description, to verify) in one layer. There is no water entrainment or
  hydroplaning, so run-outs of mud-rich flows are likely too short. The rheology is constant
  and the bed is not eroded. A block slower than 1 mm/s counts as stopped.
- **Tuned parameters.** All the failure and run-out settings are tuned, not measured: yield
  strength, viscosity, flow density, mud porosity in the deposit, the limits above and the trigger
  thresholds. Friction angle and cohesion are "to verify", not tuned, but their values have not been
  checked against the paper. Treat run-out distances as order-of-magnitude.
- **Slope is resolved at column spacing** (1 km), so steep local scarps are smoothed.
- **Salt is never moved** by a failure, and cement in the released cells is dropped with the debris.

## 14. Known limits
- **Same results on the same machine, not on every machine.** On one browser the same inputs give
  identical results, and rewind and scrubbing are bit-exact. Different platforms (Node against
  Chrome, Windows against Linux) can differ in the last digit of a calculation. Slope failure is a
  threshold process, so a last-digit difference can move an event by whole steps: the same preset gave
  24 events in Node and 37 in Chrome. Compare event lists only on one runtime. A project file opened
  on another machine can show a different list of failures.
- **Slope failure costs run time.** The M2.3 aim of at most 15 % extra is met only on the 3 Myr
  preset and missed elsewhere with failure on. Measured (M2.10, five runs each, best time with
  failure on against best time with it off, noisy machine): 3 Myr +11 %, Miocene +48 % (single runs
  +20 to +73 %; about 3.3 to 4.1 s against 2.2 to 2.9 s), Cenozoic +45 % (+17 to +52 %; about 3.9 to
  4.4 s against 2.7 to 3.4 s), the MTD-prone preset +20 % (+16 to +31 %). Every preset finishes in
  under 5 s. Failure off costs nothing.
- **Turbidites are a transport-length rule, not flow physics.** No turbidity-current flow, no
  channels or levees, slope failure is off by default and limited (section 13.6), no faults, salt or 3D yet.
- **The slopes are tuned.** Slope and coastal-plain diffusivities were tuned by eye to about 6°
  muddy slopes and a 0.3 m/km coastal plain, not calibrated to data.
- **Default overpressure is mild** (maximum about 14 % of the load, at 20 m²/yr supply). To see
  strong overpressure lower **Mud permeability multiplier** or raise **Sediment supply**.
- **Salt is early (M3.2).** Salt flows under the sediment load when Salt layer is on (section 3.3) and the
  cover resists bending, so a preferred width appears (it depends on the tuned cover viscosity). Welds are recorded (M3.3) but salt is not yet checked against a published field example.
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
