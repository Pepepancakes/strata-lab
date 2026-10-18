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
  (MTDs; section 13);
- optionally, a layer of salt under the sediment flows sideways and bends the cover above it into
  minibasins, diapirs and welds (salt; section 14).

You choose the conditions, watch the section build, scrub back to any time, and branch a what-if.
Same inputs always give the same result, bit for bit, which is what makes rewind and branches
trustworthy.

It is a learning and planning tool. It is not calibrated to any field and uses no company data.
See section 15 for what it cannot do.

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
**Scenario preset** (tuned): six standard runs. Choosing one replaces the main run.
- *Last 3 Myr (default)*: 150 columns of 1 km, 5 kyr steps, 600 steps.
- *Miocene to present (23 Myr)*: 400 columns of 1 km, 50 kyr steps back to 3 Ma, then 5 kyr.
- *Full Cenozoic (66 Myr)*: 400 columns, 100 kyr steps back to 23 Ma, then as the Miocene run.
- *Overpressured slope (MTD-prone)*: the 3 Myr default with mud permeability x0.1, supply 30 m²/yr and slope failure on; 5 kyr steps.
- *Gulf-style: wedge over salt (66 Ma)*: 400 columns, 100 kyr steps back to 23 Ma then 50 kyr and 5 kyr, salt on (4000 m thick, pinching out between 10 and 100 km, ending between 200 and 240 km) under a 300 m uneven cover, supply 28 m²/yr, 10 % of it as turbidity currents. Tuned (M3.8, M3.10), not matched to a field.
- *Salt: uneven cover (10 Myr)*: 150 columns of 1 km, 50 kyr steps, 200 steps, runs in under a second. Thin salt (1000 m, viscosity 1e17) under a thin uneven cover and a fast supply (50 m²/yr) gives a dozen small diapirs and minibasins. A teaching toy, tuned and synthetic.

**Run length (Myr)** (tuned): how long to run, from 0.5 Myr up to the preset's length. A shorter
run keeps the **youngest** part of the preset's schedule, so a 10 Myr run of the Miocene preset
is the last 10 Myr, cut on a whole step.

The line **Time steps:** under it says exactly what steps are used, for example "5 kyr steps back
to 3 Ma (600 steps)". Read section 5 before trusting a coarse-step run for fine detail.

### 3.2 How the Controls panel is laid out
Below **Scenario** is the **Controls** heading, a line saying whether you are editing the main run or a branch, then:

- **Find a parameter** (the box says *Find a parameter (e.g. salt, viscosity)*): a search box that stays at the top of the controls column. Type part of a control's name (for example *salt* or *viscosity*), of a heading inside a group, or of a group's title. The groups with a match open and the others hide; inside a group only the matching controls stay, unless the group's title matched, which keeps the whole group. *salt* shows the whole **Salt** group and also **Salt substeps per record step** under **Grid and numerical settings**. The × button (**Clear search**) empties the box and puts the groups back as you left them. When nothing matches the panel says *No parameter matches "text"*.
- **Ten groups**, in this order: **Sediment supply**, **Sea level**, **Subsidence**, **Salt**, **Slope failure (MTDs)**, **Transport and turbidity currents**, **Compaction and pore pressure**, **Temperature**, **Quartz cement**, **Grid and numerical settings**. Each group header shows its title, *on* or *off* for the groups that have a switch, *N changed* when some of its controls differ from the preset, and how many controls it holds. The first three start open. Open or close a group by clicking its header; the browser remembers which are open (separately from the scenario autosave, so it never goes into a scenario file).
- **Switches.** Salt, Slope failure (MTDs), Temperature and Quartz cement each have a check box at the top of their group: **Salt layer on**, **Slope failure (MTDs) on**, **Temperature on** and **Quartz cement on**. They are start-only, so ticking one runs the main run again from the start, and a branch cannot change them. The other controls of a switched-off group stay visible and editable, with the line *Off: these settings have no effect until it is switched on.* Quartz cement only runs together with temperature: if cement is on and temperature is off, the group says *Needs Temperature on to have any effect.* Inside Salt, **Cover resists bending (1) / not (0) (salt on)** is a check box too, *Cover resists bending*.
- **Controls the current choice ignores are hidden.** The sine's amplitude and period appear only when **Sea-level source** is *Sine (teaching)*; the decay time only when **Subsidence history** is *thermal*; the piecewise factors only when it is *history*. A short grey line says when they will appear. Their values are kept, and a search still finds them.
- **Changed from the preset.** A control whose value differs from the chosen preset (a main-run change, or a branch's edit) gets a small dot (*changed from preset*) before its name and, under the box, *preset* followed by the preset's value in the units you read. The group header counts them (*N changed*). The Scenario controls are not marked.

Pairs of boxes are **sand** and **mud**, in that order. The ⓘ button on each control gives its source, and the tag says *cited*, *tuned* or *to verify*. In the tables below, "start" means the control only sets the start of the run, so a branch cannot change it.

### 3.3 The groups, in panel order

**Sediment supply** and **Sea level** (open at the start)
| Control | Default | Allowed | Source |
|---|---|---|---|
| **Sediment supply** (ft²/yr) | 215.3 (20 m²/yr) | 0 to 2153 | tuned. Solid volume per foot of margin; an order of magnitude for a large-river margin, no source yet |
| **Sand share of supply** | 0.35 | 0 to 1 | tuned. Share of the solid volume that is sand |
| **Sea-level source** | Published curve | Published curve, Sine (teaching) | cited (section 6) |
| **Sea-level amplitude (sine only)** (ft) | 131.2 (40 m) | 0 to 492 | tuned. Used only with the sine |
| **Sea-level period (sine only)** (kyr) | 100 | 10 to 1000 | tuned. Used only with the sine |
| **Sea-level offset** (ft) | 0 | -656 to 656 | tuned. Shifts either source up or down; a what-if knob |

**Subsidence** (open at the start)
| Control | Default | Allowed | Source |
|---|---|---|---|
| **Subsidence, landward edge** (ft/Myr) | 131.2 (40 m/Myr) | 0 to 1640 | tuned. The 40 to 150 m/Myr range was chosen by eye |
| **Subsidence, basinward edge** (ft/Myr) | 492.1 (150 m/Myr) | 0 to 1640 | tuned. Rate varies linearly between the two edges |
| **Subsidence history** | constant | | start. cited: McKenzie (1978). Choices *constant*, *thermal*, *history* (changing subsidence, M1.4c; off by default) |
| **Thermal subsidence decay time** (Myr) | 62.8 | | cited: McKenzie (1978). Used only for *thermal* |
| **Subsidence history (piecewise factors)** (Ma, -) | empty | | start. tuned. See below |

What these three groups do physically:
- *Supply and sand share* set how much solid is delivered and how much of it is sand. More supply
  makes the shelf edge advance faster and buries mud faster (more overpressure). More sand makes
  more sand available to bypass to the basin floor at lowstand.
- *Sea level* moves the shoreline across the shelf. At a lowstand the shoreline sits near the
  shelf edge and sand bypasses to the slope and basin floor. The offset raises or lowers the
  whole record.
- *Subsidence* creates room. Where it is faster, more sediment piles up and burial is deeper.

**Subsidence history (piecewise factors)** has no boxes in the app yet. It is a list the engine
accepts but the controls have no editor for, so the *history* choice of **Subsidence history**
has nothing to work with. Use *constant* or *thermal*.

**Salt** (M3.1 to M3.3; off by default, so the default run is unchanged). Section 14.2 explains each control.

*Starting salt*
| Control | Default | Source |
|---|---|---|
| Salt layer on (1) / off (0) | 0 | start. tuned (switch). Shown as the check box *Salt layer on* at the top of the group. A mobile salt layer between the basement and the sediment |
| Initial salt thickness (ft) | 4921 (1500 m) | start. tuned. Synthetic |
| Salt pinch-out: no salt landward of (km) | 25 | start. tuned |
| Salt pinch-out: full thickness basinward of (km) | 45 | start. tuned |
| Salt basin limit: full thickness landward of | 2000 | start. tuned; idea after Hudec et al. (2013), to verify. The basinward end of the salt basin; the Gulf-style preset uses 200 km |
| Salt basin limit: no salt basinward of | 2500 | start. tuned. The Gulf-style preset uses 240 km. Salt can flow past it, but none starts there |

*Flow and cover*
| Control | Default | Source |
|---|---|---|
| Salt viscosity (Pa s) | 1e17 | tuned. Hudec & Jackson (2007) range about 1e17 to 1e19, to verify; the default is the fast end so flow shows in 3 Myr |
| Thickness of the older cover (salt on) (ft) | 656 (200 m) | start. tuned (allowed 164 to 9,843). The pre-run cover over the salt; the Gulf-style preset uses a thicker one |
| Unevenness of the older cover (salt on) | 0 | start. tuned. Seeded random thickness variation of the older cover |
| Seed of the cover unevenness | 1 | start. tuned |
| Cover resists bending (1) / not (0) (salt on) | 1 | tuned (check box). 1: the sediment above the salt is a viscous plate, so a preferred diapir width emerges. 0: thin-sheet flow only (M3.1), where the narrowest bumps grow fastest |
| Cover effective viscosity as a plate (salt on) (Pa s) | 1e19 | tuned. No published value for a whole cover is in the references (to verify). Widths scale as its 1/6 power |

*Welds and heat*
| Control | Default | Source |
|---|---|---|
| Weld: salt thinner than (ft) | 32.8 (10 m) | tuned (allowed 0 to 656). Hudec & Jackson (2007). A column counts as welded once its salt, which was thicker, falls below this. A label and an age only |
| Salt thermal conductivity at 0 deg C (W/m/K) | 6.0 | to verify (Clauser & Huenges 1995). Halite is about 5 to 6.5 near the surface, 2 to 4 times the sediment |
| Salt conductivity falls with temperature: a (1/K) | 0.0030 | to verify (Clauser & Huenges 1995). Coefficients as remembered for crystalline rock, not checked for halite |
| Salt conductivity falls with temperature: b (W/m/K^2) | 0.0042 | to verify (Clauser & Huenges 1995). See a |

With salt on, the sediment loads the salt and squeezes it basinward; the cover above rides up and down on the salt. Salt volume is conserved and has its own line in the mass balance. The cover resists bending (M3.2), so the width of the structures is set by the cover viscosity and thickness, not by the cell size: check by halving the cell size. Welds (M3.3): salt can never go below zero thickness. When a long step would ask a cell for more salt than it holds, the outflow is cut to what the cell has, so nothing is clipped and salt stays conserved. A column whose salt falls below Weld: salt thinner than is welded, and its first weld age is kept (it rewinds with the run). Salt conducts heat well, so everything below salt is cooler in the Temperature colour mode and the pseudo-well, and the weight of salt counts in the overburden.

**Slope failure (MTDs)** (M2.1 and M2.2; drawn by the Factor of safety colour mode, section 4, and in the section, the event list and the pseudo-well, sections 4, 8 and 10)

*Stability*
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Friction angle phi' (effective stress)** (deg) | 33 / 25 | to verify (Hampton et al. 1996). Muds about 20 to 30°, sands about 30 to 38° |
| **Cohesion c' (effective stress)** (psi) | 0 / 0 | to verify (Hampton et al. 1996). Normally consolidated marine clay is near 0 |
| **Stability search depth below the seafloor** (ft) | 984 (300 m) | tuned. How deep the factor-of-safety search goes |

The factor of safety is the strength holding a slab of sediment in place divided by the pull of
gravity along the slope. Below 1 the slab would slide. The engine works it out from the
seafloor slope and the model's own pore pressure, so overpressure lowers it directly.

*Failure and run-out*, and the switch and the triggers below
| Control | Default | Source |
|---|---|---|
| Slope failure on (1) / off (0) | 0 | start. tuned (switch). Shown as the check box *Slope failure (MTDs)* at the top of the group. Off keeps the run identical to M1 |
| Most columns in one failure | 10 | tuned. How far a failure spreads sideways |
| Debris-flow yield strength (psi) | 0.73 (5 kPa) | tuned. Imran et al. (2001) model, to verify |
| Debris-flow viscosity (Pa s) | 1000 | tuned. Sets the speed, not where the flow stops |
| Debris-flow bulk density (kg/m^3) | 1800 | tuned |
| Porosity of mud in a fresh debris deposit | 0.55 | tuned |

*Triggers*
| Control | Default | Source |
|---|---|---|
| Shallowest slip surface considered (ft) | 32.8 (10 m) | tuned (allowed 0 to 328). Thinner slides than this are skin slides, not MTDs; 0 searches every cell |
| Gentlest slope checked for failure (deg) | 0.5 | tuned (allowed 0 to 5). A speed cut and a stated limit: failures on slopes under this are not modelled |
| Sea-level fall that makes an event a lowstand event (ft) | 65.6 (20 m) | tuned (allowed 0.3 to 328). Only the trigger tag |
| Accumulation rate that counts as rapid loading (m/yr) | 0.001 | tuned (allowed 0.00001 to 0.1). Only the trigger tag |
| Slope term that counts as oversteepening | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Pressure term that counts as overpressure | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Run-out below which a repeat failure is not tried again (km) | 0.5 | tuned (allowed 0 to 10). Skips re-failing a column that moved nothing |

With the switch on, any column whose factor of safety falls below 1 fails: the sediment above the slip surface runs out as a debris flow and stops where the yield strength holds it, as a mass-transport deposit (MTD). Sand and mud are conserved separately; debris that runs off the basinward edge counts as exported.

Why did it fail? (M2.3, rule changed in M2.7.) Every failure carries one trigger tag, worked out from the weakest column's change over the last 4 steps (20 kyr at 5 kyr steps). Nothing is imposed; the factor of safety falls for physical reasons and the tag says which one did most of it. Each of three terms (steeper sea floor, rising pore pressure, falling sea level) is divided by its own tuned threshold, and the term with the largest ratio wins if that ratio is at least 1: *oversteepening*, *rapid loading* (the pressure term, when the column gained sediment faster than the rapid-loading rate), *overpressure* (the pressure term, when loading was slow) or *lowstand*. If no ratio reaches 1 the tag is *mixed*. The tag does not change the physics; it is a label on the cause, and the list shows all three terms behind it (section 13.4). Failures that move almost nothing are flagged *stalled*, and failures cut by the search depth limit are flagged *window-limited* (section 13.4). The preset *Overpressured slope (MTD-prone)* turns failure on with mud permeability x0.1 and supply 30 m²/yr (both tuned) so there are events to look at. Limits: slopes under 0.5° and slip surfaces shallower than 10 m are not searched.

**Transport and turbidity currents** (all tuned; the form is cited where noted)
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

**Temperature** (M1.4c; off by default)
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Temperature on (1) / off (0)** | 0 | start. tuned (on/off switch). Shown as the check box *Temperature on* at the top of the group |
| **Basal heat flow** (mW/m²) | 40 | cited: Jones (2003), to verify. The Gulf of America spans from under 20 to about 100 mW/m² |
| **Grain thermal conductivity** (W/m/K) | 7.7 / 2.5 | to verify (Clauser & Huenges 1995). Mud value is tuned |
| **Pore-water thermal conductivity** (W/m/K) | 0.6 | to verify (Woodside & Messmer 1961) |
| **Deep-water seafloor temperature** (deg F) | 39.2 (4 °C) | to verify. Not checked against a source |
| **Shelf / land surface temperature** (deg F) | 68 (20 °C) | tuned |
| **Seafloor temperature e-folding depth** (ft) | 984 | tuned. Smooth stand-in for the thermocline |

**Quartz cement** (M1.4c; off by default; only runs when Temperature is on)
| Control | Default | Source |
|---|---|---|
| **Quartz cement on (1) / off (0)** | 0 | start. tuned (switch). Shown as the check box *Quartz cement on* at the top of the group. Needs temperature on |
| **Quartz precipitation rate prefactor** (mol/m^2/s) | 1.98e-18 | cited: Walderhaug (1994) |
| **Quartz precipitation temperature coefficient** (1/deg C) | 0.022 | cited: Walderhaug (1994). Walderhaug (1996) varied it from 0.018 to 0.023 |
| **Temperature where cementation starts** (deg F) | 158 (70 °C) | cited: Walderhaug (1996). Below it the rate is zero |
| **Sand grain diameter (cement surface area)** (mm) | 0.2 | tuned. Synthetic |
| **Share of grain surface that is clean quartz** | 0.7 | tuned. Synthetic |

**Grid and numerical settings.** Not geology: these trade speed for accuracy. Change them only to check that a result does not depend on them.

**Deep compaction: Fast (bundled) / Full accuracy (slower).** A two-way switch in the **Scenario** block at the top of the controls (under *Time steps*, so it stays on screen beside the section; this group only points to it), for the presets that bundle deep compaction (Miocene, Cenozoic, Gulf). *Fast* is the preset as shipped. *Full accuracy* solves every layer at every step (it sets **bundleEvery** to 1) and runs the main run again from the start. Use it when you want to read pore pressure below about 5,000 ft below the sea floor: bundling moves the 10,000 ft pore pressure by about 0.7 to 1 ppg on the Miocene preset and by more on the Gulf one (section 5). On the Gulf preset the salt and the surface also differ between the two runs (up to about 6.6 km of salt thickness and 2.1 km of surface height, Windows node 26), so the whole section moves, not only the deep pressure. It costs 6 to 12 times the run time. Measured in the built file in Chrome on the development Windows computer: Miocene 2.6 s fast and 16.7 s full; Cenozoic 2.8 s and 34.0 s; Gulf 3.6 s and 36.9 s. A slower computer takes proportionally longer; the switch shows these numbers for the loaded preset. It can only be changed on the main run (a branch shows it locked), the choice is saved in a scenario file like any other control, and *Fast* takes the preset's own value back. The yellow bundling note under the well plot goes away with Full accuracy. The presets that never bundle (last 3 Myr, MTD, short salt) show a line saying there is nothing to switch.

| Control | Default | Source |
|---|---|---|
| **Columns** | 150 | start. Grid size |
| **Column width** (km) | 1 | start. Grid spacing |
| **Transport substeps per record step** | 5 | start. Numerical |
| **Salt substeps per record step** | 5 | start. tuned. Numerical |
| **Deep compaction: full solve every N steps (1 = off)** (steps) | 1 | start. tuned. Speed-up for long runs (section 5) |
| **Deep compaction: age of the always-updated window** (kyr) | 500 | start. tuned. Used only when the line above is more than 1 |
| **Temperature and cement: update every N steps** (steps) | 5 | start. tuned. Speed-up |
| **Most failures per step (rechecks of the scar)** | 5 | tuned |
| **Benchmark mode (constant properties)** | none | start. Switch for the Gibson benchmark. Leave it alone: it is for the Gibson test |

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
- **Salt thickness** (only when **Salt layer** is on): the salt is coloured by how thick it is in each column, pale pink for thin to dark plum for 16,404 ft (5,000 m) or more. The scale is fixed, so colours compare across time steps. Sediment is grey, and the older cover (the sediment that lay on the salt before the run) is a shade darker than the sediment the run lays down. In every colour mode a run with salt also shows a magenta line on the top of the salt, a dashed brown line on the top of the older cover, and a heavy dark line labelled *weld* where the salt has been squeezed out. A key under the section explains each, with an (i) button.
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
  physics. On prescribed deposition (three columns, no transport) it matched the full solve to about
  0.25 % of the thickness on the Miocene preset and 0.8 % on the Cenozoic one; see
  `docs/physics-references.md`. **On the coupled presets the pressures are less exact.** The audit
  (AUDIT-1, `scripts/review/audit-01/bundle.log`) ran each preset bundled and with `bundleEvery = 1`.
  Miocene: the largest excess pressure is 11.2 MPa bundled against 8.4 MPa (25 % of the bundled value) and the mean 0.49
  against 0.29 MPa (40 %); at about 10,000 ft
  below the sea floor the pore pressure reads 10.02 against 9.36 ppg (column 80) and 10.39 against
  9.63 ppg (column 100). Gulf-style (Hart mud, AUD-3; Windows node 26): the pore pressure at about 10,000 ft below the sea floor is 15.15 ppg bundled against 14.03 ppg full at column 150 and 13.52 against 11.10 ppg at column 250; the table in the well window gives a largest difference of 8.7 ppg (99 % of cells within 7.0), found at column 71 about 12,700 ft below the sea floor. (With the North Sea mud the figures were 12.68 against 12.59 and 9.93 against 8.95 ppg, and a largest difference of 13.1 ppg.) The salt and the surface also differ between the two runs, up to about 6.6 km of salt thickness and 2.1 km of surface height. The pseudo-well
  and planned-well plots show a yellow note with the largest difference found on that preset
  (`scripts/gen-bundle-table.mjs` measures it, with the 99th percentile; it is also written into the PNG and CSV exports). To read
  pressures with full accuracy, use the **Deep compaction** switch (Full accuracy) under **Scenario** at the top of the controls (the run is then 6 to 12 times
  slower). The layer record still holds every layer.
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
Depth is TVDSS in ft (below the sea surface). Mud weights are measured from the rig floor, the
same datum as the planned well (air gap 80 ft by default, or the air gap of the planned well). It
has four tracks:
1. **Pressure, ppg EMW**: pore pressure (red), overburden (black) and hydrostatic (blue dashed),
   on a 6 to 20 ppg scale. Where red moves right of blue, the well is overpressured. If it
   approaches black, the pore fluid is carrying nearly all the load. A **yellow dot** on the red
   line marks a cell where the model has *capped* the pore pressure at the overburden (the water
   carries the whole load). The model has no leak-off, so a capped cell is a warning, not a
   prediction; the sentence under the plot counts them.
2. **Porosity**, 0 to 0.7.
3. **Temperature, °F**. A purple line marks where **Temperature where cementation starts** is
   crossed, and the depth where it happens is labelled. If cement is off the label says
   "(cement off)".
4. **Grain size**: yellow is sand, grey-green is mud.
   Debris-flow deposits (MTDs) in the column are hatched, labelled *MTD #n* with the event number.
   Hover (or tab to) a hatched interval to read the event: time, cause, source position, scar depth,
   volume and run-out. The same text appears under the plot.

Salt (when **Salt layer** is on) is drawn pink and labelled "salt", with its top and base depths. Salt has no pores and no pore fluid, so the pore-pressure and porosity lines stop at the top of the salt and start again below its base; the overburden line carries on and counts the salt at its own weight (about 18 ppg). If the column is welded, a heavy line marks the weld and a note under the plot gives its age and the salt left.

The temperature in this panel and in the Temperature colour mode is **steady conduction**: it
assumes the heat has had time to reach its balance. Real, fast-buried basins are colder at depth
than this, so deep temperatures read too warm.

### The planned well (M4.3)
The **Planned well** panel draws a well you design, with its pressures. It is a view: it never
changes a run, and it is saved in the scenario file (files without a well open as before).
Press **Plan a well here** to start a vertical well at the column you last clicked, and click the
section to move it. The path is drawn on the section in every colour mode, with a marker at the
total depth, and follows the time slider and the active branch.
- **Surface location**: km from the landward edge of the section.
- **Well shape**: Vertical, or Build and hold (a straight hole, a curve, then a straight tilted
  hold, all in the plane of the section).
- **Total depth**: ft TVDSS, the true vertical depth below the sea surface.
- **Air gap**: ft from the sea surface (or, for a wellhead on land, from the ground) up to the rig floor (80 ft, tuned). Mud weights are measured from the rig floor.
- **Kickoff depth**: where the hole starts to curve (build and hold only).
- **Build rate**: degrees of inclination gained per 100 ft drilled.
- **Hold angle**: the tilt from vertical where the curve stops.
- **Direction**: toward the basin or toward the land.
- **Fracture-gradient method**: Eaton (1969) or Matthews & Kelly (1967).
- **Remove well** deletes the well from the scenario.

**Planning steps.** (1) Run the scenario and put the slider at the time you want. (2) Click the
section where the well should start, then press **Plan a well here**. (3) Set **Total depth**; for
a deviated well choose **Build and hold** and set **Kickoff depth**, **Build rate**, **Hold angle**
and **Direction**. (4) Read the plot below. (5) To see how another scenario changes the answer,
make a branch (section 7), change the cause there, and tick it under **Compare branches**. Moving
the well or changing the method never re-runs the model.

**Reading the pressure plot.** Mud weight (ppg, measured from the rig floor) is across and depth
(ft TVDSS) is down. Hover the plot, or use the arrow keys, to read the values and the measured
depth; each line, shade and flag has an (i) that explains it.
- **Hydrostatic** (blue, dashed): the pressure of sea water down to that depth. It reads a little
  under 8.55 ppg because mud weight is measured from the rig floor, not the sea surface.
- **Pore pressure** (red): the pressure of the water in the rock pores. To the right of the blue
  line the rock is overpressured. It stops in salt, which has no pore water.
- **Overburden** (black): the weight of the sea water and all the rock above, as a mud weight.
- **Fracture gradient** (brown): the mud weight at which the rock would split. Above salt it is the
  pore pressure plus a share of the load the grains carry. In salt it is the overburden.
- **Mud-weight window** (green): the band between pore pressure and fracture gradient. A mud weight
  inside the band holds the hole open without a kick (too light) or a loss (too heavy).
- **Tight** (amber): the band is narrower than 0.5 ppg (a labelling threshold, not physics).
- **No window** (red): the pore pressure has reached the fracture gradient, so no mud weight fits.
  In a real well a casing string would have to be set above this depth.
- **Salt** (pink) and **sea water** (blue shade, with the dashed sea floor). Neither has a window; in
  salt the hole needs a mud weight close to the overburden (practice, no source yet).
- A well that leaves the section, or reaches the base of the record, stops there and is flagged.

Under the plot a line gives the narrowest window, with its depth and measured depth. Tick other
branches under **Compare branches** to draw the same well on up to three branches on the same
axes, with a legend of branch names and a table of the narrowest window on each. The green window
is shaded for the active branch only.

**Choosing the fracture-gradient method.** Both methods give the pore pressure plus K times the
load the grains carry (overburden minus pore pressure); they differ in K. **Eaton (1969)** is the
default: K = Poisson's ratio / (1 - Poisson's ratio), 0.67 at a ratio of 0.40. **Matthews & Kelly
(1967)** uses a stress ratio, 0.60 here. Each uses one number for every depth, and both numbers
are tuned, not read from the papers' depth charts, so the two lines lie close together and
neither is a calibrated field curve.

**Limits of the pressures** (also printed under the plot): one vertical column at a time (1D
drainage, no sideways flow, no leak-off); disequilibrium compaction is the only source of
overpressure; the mud permeability is tuned, not measured; the shale pressure is used for sands too
(no centroid effect); pore pressure is capped at the overburden; and, with the heat model off, the pore water is taken at 68 F
(20 C) viscosity, which is thicker than water at depth, so the real overpressure would be lower.
With the heat model on (Temperature on under Controls) the water viscosity follows each cell's
temperature (IAPWS 2008 water, no pressure or salinity effect): thinner at depth, so overpressure is
lower there, but thicker than the 68 F value in cold sea-floor mud, so shallow slope mud drains
more slowly than with the heat model off.
On the Gulf-style preset the mud uses Gulf shale coefficients (Hart, Flemings and Deshpande 1995, p. 46:
surface porosity 0.40, compaction 3.68e-2 per MPa), but the sand is still the North Sea curve and the
permeability is tuned. That fit comes from the shallow, hydrostatic part (under 4,900 ft, 1,500 m) of one
well, so using it at 8,000 to 12,000 ft is an extrapolation; the paper also shows a second curve (7.2e-2 per
MPa) that matches pressures at depth. The overburden still reads low: the **Physics checks** panel compares
the pseudo-well overburden with the Traugott (1997) deep-water Gulf regional trend and shows the gap, which
with the Hart mud is 1.1 ppg at column 150 and 0.8 to 0.9 ppg at column 250 (about 1.7 and 1.3 ppg with the
North Sea mud; medians of four runs, Windows and Linux agree to 0.02 ppg). At 10,000 ft below the sea floor the
pore pressure at column 150 is about 15.2 ppg (it was 12.7). The number of cells where the pore pressure was
held at the overburden also rose, from about 16,000 to 36,000 (Windows) or 48,000 (Linux). That count moves by a factor of 2 to 3 between browsers and machines (a last-digit difference, section 15), so the claim is only "tens of thousands on the Gulf preset, 0 on the others". **The shallow section also reads over hydrostatic.** With the Hart mud the pore pressure 500 ft below the sea floor is 9.4 to 10.5 ppg (columns 100 to 250) against 8.6 ppg with the North Sea mud, and 10.2 to 12.2 ppg against 8.7 to 8.8 ppg at 2,000 ft (Windows node 26; Linux node 22 gives 9.2 to 10.7 and 10.4 to 12.3 ppg). Hart's own well is hydrostatic there. The cause is the mud permeability law, which is tuned and was not re-fitted for the lower surface porosity (the surface mud is about 70 times less permeable); nothing was retuned, and the re-fit is in the roadmap Backlog. Where the window is
zero or negative (red), look for yellow dots: in this model the pore pressure has usually just hit the cap.

**Limits of the planned well** (read before trusting a plot):
- The well is in the plane of the section (2D). There are no S-shaped or sideways wells.
- The window runs from pore pressure to fracture gradient only. There is **no collapse or shear
  limit**, so the true lower limit can be higher than the pore pressure.
- The pore pressure is the model's, from a synthetic run. It is not a pre-drill prediction for a
  real prospect until it is calibrated to data.
- In salt the fracture gradient is the overburden and **no window is counted** (the pore pressure of
  salt is not modelled, so there is no lower limit). The salt interval needs a mud weight close to the
  overburden to hold the hole open: practice, no source yet. This is common practice but has no source
  in this project, and may not hold near a salt flank or a weld.
- **Sub-salt pore pressure: not claimed** (the salt's weight in sub-salt compaction and salt-sealed
  pressure are not modelled).
- The stress ratio is constant with depth here; deep-water practice has it rising with depth below
  the mud line (Traugott 1997). Not modelled.
- **Wellhead on land.** The rig floor is the air gap above the ground, MD 0 is the rig floor, the
  first stations are air down to the ground, and the panel says how high the ground is above sea
  level. Total depth and kickoff stay TVDSS.
- Between two columns, numbers are interpolated only where both hold the same rock; across a salt
  flank or a slope-failure deposit edge the nearest column is used.
- Pressure depends on true vertical depth (TVDSS) only, so a deviated well and a vertical well
  read the same pressure at the same TVD in the same rock.

**Exporting the well (M4.4).** Under the plot, **Export plot (PNG)** saves the picture with a
title (scenario, branches, time in Ma, the well, the fracture-gradient method) and a legend.
**Export stations (CSV)** saves one row per station: measured depth, true vertical depth from the
rig floor and below sea level, position, material, porosity, pore pressure (psi and ppg),
hydrostatic, overburden, fracture gradient, window width, temperature (deg F) and branch. The lines at the
top start with `#` and give the units, the method, the app and engine versions and the state hash of
each branch. With branches ticked under Compare branches, the file holds one block per branch.
Both files are made in the browser and nothing leaves your machine.

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

**Burial temperature.** Tick the **Temperature on** check box at the top of the **Temperature** group. The model computes steady
conduction: temperature = seafloor temperature + heat flow × Σ(thickness / conductivity), where
the bulk conductivity mixes grain and water. On its own it changes nothing in porosity or
pressure. It exists to drive cement. It also feeds the Temperature colour mode and the temperature track.

**Quartz cement.** Tick the **Quartz cement on** check box at the top of the **Quartz cement** group (temperature must also be on).
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
Press **Run checks**. It runs the benchmarks below in the browser (eleven groups, some with several rows), each against an exact solution or
a hand calculation, takes about 0.5 s and prints **ALL PASS (n/n)** or says what failed. Each row
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
| **Salt channel-flow decay** | A small bump on a flat salt sheet relaxes at h³ (ρ_salt − ρ_w) g k² / 12η (thin-sheet flow). Within 1 % |
| **Cover bending: fastest-growing wavelength** | With the cover as a viscous plate, the width that grows fastest is λ* = 2π (η_c h_c³ h³ / 18η_s)^(1/6). Within 5 % |
| **Mass balance, salt only** | Salt volume is the same before and after the flow, none clipped; sand and mud are not touched by the salt step |
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
Turn it on with the check box *Slope failure (MTDs)* at the top of the **Slope failure (MTDs)** group (it restarts the
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
**not** give the same events on every platform (section 15). After the M2.7 fixes it gave:
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

## 14. Salt

Salt is off by default, so the default run and every other earlier preset look exactly as before. Turn
it on with the **Salt layer on** check box (section 3.3) or pick the *Gulf-style: wedge over salt (66 Ma)*
preset.

### 14.1 What the model does
- A layer of salt lies on the basement, under an **older cover**: the sediment that was already
  there before the run starts. The salt is weak and light (2,160 kg/m³, against about 2,300 to 2,600
  for compacted sediment), so the weight of the new sediment squeezes it sideways, away from where
  the load is heaviest.
- It flows as a thin sheet of very thick fluid (the same maths as oil between two plates). The
  push comes from differences in the weight of the sediment on top and in the relief of the
  seafloor. Neither a fault nor a dip is needed.
- The sediment above the salt is treated as one stiff plate that resists bending. Without that,
  the narrowest bump would always grow fastest and the structures would come out one to four
  cells wide, whatever the grid. With it, the structure width comes from the cover's thickness and
  stiffness. That stiffness is a tuned number (**Cover effective viscosity as a plate (salt on)**), so the
  widths are a model result, not a measurement.
- **Columns do not move sideways.** They ride up and down on the salt: as salt leaves a column, its
  sediment sinks; where salt arrives, the sediment is lifted. Sediment that sinks forms a
  minibasin, and the sea-floor sag fills with more sediment, which presses harder on the salt.
- Salt is counted separately in the mass balance (salt only), and it is conserved to rounding.
  Salt can never go below zero thickness: when a column runs out of salt the flow out of it is
  cut to what is there, which is how a weld forms.
- Salt has no pores and no pore fluid. It adds its own weight to the load on everything below it
  and, because it conducts heat well, makes the sediment below it cooler (section 8).

### 14.2 The controls
They sit in the **Salt** group (three sections: Starting salt, Flow and cover, Welds and heat); the full table with defaults and sources is in section
3.3. Depths and thicknesses show in ft, distances along the section in km.
- **Salt layer on**: the check box at the top of the **Salt** group. Set at the start of a run.
- **Initial salt thickness**: how thick the salt is basinward of the pinch-out (default 4,921 ft; the Gulf-style
  preset uses 13,123 ft). Set at the start.
- **Salt pinch-out: no salt landward of** and **Salt pinch-out: full thickness basinward of**: the salt
  thins smoothly from nothing to its full thickness between these two distances from the landward
  edge (default 25 and 45 km; the Gulf-style preset uses 10 and 100 km). Set at the start.
- **Salt basin limit: full thickness landward of** and **Salt basin limit: no salt basinward of**: where the
  salt basin ends on the basinward side. Salt starts at full thickness landward of the first distance and
  tapers to nothing at the second (defaults 2,000 and 2,500 km, so they do nothing; the Gulf-style preset uses
  200 and 240 km). Salt can still flow past the limit, but none starts there. Without a limit, salt that is
  pushed basinward piles up against the closed end of the section (section 14.6). Set at the start.
- **Salt viscosity**: how stiff the salt is. Lower flows faster. 1e17 Pa s is the fast end of the
  published range, chosen so something happens in 3 Myr; the preset uses 1e18. Can be changed on a branch.
- **Salt substeps per record step**: a numerical setting; more substeps are slower and steadier. Set at the start.
- **Cover resists bending (1) / not (0) (salt on)** and **Cover effective viscosity as a plate (salt on)**:
  the plate that gives the structures their width. Widths grow with the 1/6 power of the viscosity, so
  ten times stiffer gives about 1.5 times wider. Can be changed on a branch.
- **Thickness of the older cover (salt on)**: the sediment on the salt at the start (default 656 ft;
  the Gulf-style preset uses 984 ft). Set at the start.
- **Unevenness of the older cover (salt on)** and **Seed of the cover unevenness**: a small seeded
  variation in the older cover's thickness. Salt flow needs something to start from; with a perfectly
  flat cover and a flat seafloor nothing grows. The same seed always gives the same pattern. Set at the start.
- **Weld: salt thinner than**: a column counts as welded when its salt, once thicker than this,
  falls below it (default 33 ft; the Gulf-style preset uses 328 ft, 100 m). It only labels the column and
  records when; it does not change the flow.
- **Salt thermal conductivity at 0 deg C (W/m/K)**, **Salt conductivity falls with temperature: a (1/K)**
  and **Salt conductivity falls with temperature: b (W/m/K^2)**: how well salt carries heat. All three
  are marked *to verify*.

The ⓘ button on each control gives its source, and the tag says *cited*, *tuned* or *to verify*.

### 14.3 The presets
*Gulf-style: wedge over salt (66 Ma)* runs the Cenozoic from 66 Ma on 400 columns of 1 km: salt 13,123 ft
(4,000 m) thick basinward of a pinch-out between 10 and 100 km, ending between 200 and 240 km (the basin
limit), a 984 ft (300 m) older cover with 50 % seeded unevenness (seed 2), salt viscosity 1e18 Pa s, cover
viscosity 1e19 Pa s, supply 28 m²/yr, only 10 % of it routed as turbidity currents, a weld threshold of 328 ft
(100 m), and the bundled sea-level curve. A wedge builds out across the salt. It takes about 5 s to run on the
development machine. The values were found by sweeping them against targets written down in advance (decisions
D18 and D19). They are all tuned and not matched to any field, except the mud compaction, which uses the Gulf
shale fit of Hart et al. (1995, p. 46; AUD-3) and moved the results below. Whether it looks like Gulf salt is for you to
judge, and 14.5 says plainly what it does and does not show.

*Salt: uneven cover (10 Myr)* is a **teaching toy**, not a Gulf section. It runs in under a second and shows
diapirs, minibasins and the cover's bending in one short run. To get that in 10 Myr it uses thin salt, a fast
supply and a thin cover, so the section is over-filled: the surface ends about 3.3 km above sea level, with 3.5
to 6 km of sediment over the salt. Its structures are 1 to 25 km wide and several are only one or two cells
wide, so do not read their widths or depths.

### 14.4 Reading the picture
Salt is pink in every colour mode (never coloured as porosity or pressure). Pick **Salt thickness**
to colour the salt by how thick it is in each column, pale pink for thin to dark plum at 16,404 ft or
more; the sediment turns grey. The scale is fixed so colours compare from step to step.
Under the section, a key shows: *Salt*, *Older cover (before the run)* and *Weld (none yet)*, which
becomes *Weld* once a column has welded. Each has an (i) button.

- **Minibasins** are places where the cover is thick and has sunk into the salt, so the salt below
  is thin or gone. In **Salt thickness** mode they are a pale patch (or none) under a thick grey
  fill; in the section the strata thicken into them. They are the places the sediment piles up.
- **Salt highs** are where the salt is thick between minibasins. In **Salt thickness** mode they
  are the dark columns. Sediment above them is thin or lifted, so look for thinner layers, onlap and
  a raised older-cover line (the dashed line). A **passive diapir** is a salt high whose crest stays
  near the seafloor while the sediment builds up around it. The model does not label diapirs; you
  read them from the section.
- **Welds** are columns where the salt has been squeezed out. They are drawn as a heavy dark line
  labelled *weld*, with white circles. A column becomes welded the first time its salt falls below
  **Weld: salt thinner than**, and keeps its first weld age when it is rewound.
- Lines on the section in every mode: a magenta line on the top of the salt, a dashed brown line
  on the top of the older cover.

In the pseudo-well (section 8), salt is a pink band over the pressure, porosity and temperature
tracks, labelled *salt: no pore fluid* and *no pores*, with its top and base depths in ft. The
overburden line carries on and counts the salt at about 18 ppg. The pore-pressure line stops at the top
of the salt and starts again below its base, because salt has no pore fluid; a note under the plot says so.
A well through a welded column shows the weld, its age and the salt that is left.
Tap the (i) buttons for what each mark means.

**Salt crests (M3b.2, UI-2).** At the top of the right-hand column, beside the section, the **Salt crests** list
shows each salt crest that came within 1,640 ft of the seafloor, and markers on the section show them. Click a row
to see the crest on the section at once. Section 14.7 explains how to read them.

### 14.5 What the Gulf-style preset gives
These are numbers from one run on the development machine (Node 26, Windows); they are the model's
output, not data. Another machine can move single structures a little (section 15). At the end of
the run, with structures counted when their relief is at least 300 m (984 ft):
- The wedge keeps building out: the shelf edge moves from about 97 km at 56 Ma to 206 to 215 km at the end
  (Windows Node 26 and Linux Node 22, 7 runs each, AUD-4; the shoreline itself ends near 90 km; checked by the tests).
- **Welds** (salt thinner than 100 m where it was thicker before) are real but thinner than before the mud change
  (AUD-3): about 8 to 11 km of weld in total on Windows and 6 to 8 km on Linux (the plain run and three 1-ulp
  repeats), in runs of 2 to 3 km, under the shelf and the ramp the wedge crossed. They were 12 to 20 km in
  runs of up to 3 or 4 km with the North Sea mud. **But where they are, and how long each run is, moves with a
  last-digit change in the maths.** Treat the places as examples, not predictions, and do not quote one weld
  length. The tests ask only for a total of 5 km or more and one run of 2 km or more. The thinnest salt left
  in a weld column is a few tens of metres; thin-sheet flow slows as the cube of the thickness, so it never
  reaches zero.
- **Crests**: with the Gulf shale mud there are **no** salt highs with tops within 2 km of the seafloor and
  well away from the section edge, in any run (Windows and Linux, plain and noise runs); this holds inside the
  20 km rule, and the exposed toe (below) is outside it. With the North Sea mud
  there were two to five, 300 to 850 m bumps of the seeded cover unevenness on a flat salt slab; they were not
  diapirs, and John accepted losing them as a measured result of the cited compaction change (decision D26.4).
  The D18 target (a crest within 2 km of the seafloor) is dropped for this preset. Diapirs that reach the
  seafloor and stay there need new physics (spike S3, then milestone M3b). The crest log of section 14.7 still
  finds 16 crests, 15 of them buried and one, the toe, still at the surface at the end of the run (it follows
  highs from the beginning, when they were near the seafloor).
- **The salt basin has its own end.** Before the basin limit was added, the salt pushed basinward piled up against
  the closed end of the section, 8 to 9 km thick, and the earlier "crests" were ripples on that pile. Now the
  salt starts out between 10 and 240 km, flows about 100 km past its limit, stops about 60 km short of the end of
  the section and is 6.4 to 6.6 km thick at most (it was 5 km with the North Sea mud; the no-pile test now allows
  twice the start thickness).
- **The toe of the salt is bare.** With the Gulf shale mud the front of the salt does not stay buried. Over the last
  3 to 5 km before the front the salt is at the seafloor with no cover, and there it is 6.2 to 6.7 km (20,000 to
  22,000 ft) thick (Windows node 26 and Linux node 22, 7 runs each, AUD-4). The seafloor drops by a step of about
  1,270 m (4,170 ft) there in the plain run (Windows), and the front has been bare since about 21 Ma. The crest log
  carries it as one crest that ends "run end", exposed for 44 to 57 Myr. In Chrome the toe column keeps a thin
  veneer of cover; the exact cover at one column moves with the maths library, but the wall and its marker do not.
  This is a limit of the model, not a result (14.6).
- Spacing: the dominant wavelength of the salt thickness is about 10 to 12 km (Windows; it was 13 to 14 km). On
  a 200 km section it is 34 to 38 km and the two grids still agree within 15 %. The counts of highs and
  minibasins and their spacing do **not** hold, so do not trust a count.
- Total salt is conserved to about 1e-14 (relative), with nothing clipped.

If this does not look like Gulf salt to you, that is a finding; say what is wrong. The model has no
canopies, no sideways movement of salt and no faults, which may be the cause (below). The 200 to 240 km limit,
the 4 km start thickness and the 300 m cover are tuned and have no field behind them.

### 14.6 Limits (read before trusting a picture)
- **No canopies, tongues or sheets.** Salt never flows over the seafloor or over younger sediment. It
  stays under the cover, so "salt that reaches the seafloor" is a passive diapir only. Canopies need a
  different solver (backlog).
- **Columns do not move sideways.** There is no tilt of structures, no overhang and no lateral
  shift of a diapir.
- **No dissolution.** Salt that reaches the seafloor is not dissolved away.
- **Why the bare toe wall stays.** The model has no sink for salt at the seafloor: no dissolution, no extrusion
  or canopy, and the exposed salt is not eroded. Thin-sheet flow pushes salt to the toe and nothing takes it away.
  Vendeville (2005, p. 1078) shows distal inflation at a pinch-out, but that is a scaled physical model and only
  the geological part of the picture. Bare salt that stays bare for 50 Myr is a model limit, not a result; do not
  read it as a prediction of the Gulf.
- **No faults over salt.** The cover is one plate and does not break, so there are no crestal
  faults, rafts or counter-regional faults.
- **The cover is a viscous plate.** This stands in for real brittle and ductile cover and is the
  main tuned unknown: widths scale with the 1/6 power of its viscosity, and no published value for a
  whole sediment cover is in the references.
- **Runs start at 66 Ma at the earliest.** Salt is already in place when a run starts, under an
  older cover; the model does not deposit salt. Runs from the Jurassic need a redistributable older
  sea-level curve and are in the backlog (D17.4).
- **A finite-amplitude needle is a few cells wide**, and its width is not the same on every machine.
  Check any narrow structure by halving **Column width**.
- **Salt thermal conductivity is unchecked** (to verify). Compaction of the sediment below salt does not yet
  count the weight of the salt; the overburden shown in the views does.
- **Slope failure does not move salt** (section 13.6).
- The Gulf-style preset is tuned to targets, not matched to any field, and not yet judged by a stratigraphic specialist. The weld threshold of 100 m is a tuned label, chosen because thin-sheet flow never gets to 10 m in 66 Myr. The weld is real but its length moves under tiny numerical noise (14.5).
- **Salt against a closed edge.** The end of the section is closed: no salt can leave. Salt that starts all the way to it
  is squeezed basinward and stacks up against it, thick and flat, with ripples on top that are not diapirs. Give the salt
  its own basinward limit (14.2) and leave room beyond it.
- **Diapirs at the seafloor are not in the model yet.** Where a crest gets near the seafloor, thin-sheet flow drains the
  column as fast as sediment loads it, so a crest that is exposed is buried again within a few million years unless salt is
  fed in by hand. That is spike S3; milestone M3b is meant to deal with it (roadmap).
- The structure width of about 10 to 13 km comes from the tuned cover viscosity. It is a model result, not a measurement, and no published minibasin width was used (Pilcher et al. 2011 gives none).

### 14.7 Salt crest log (M3b)
The crest log answers one question about each salt high: while it was near the seafloor, did the salt keep
rising faster than the sediment piled up beside it, or did the sediment win? It only reads a finished run. It
changes no physics, so the section, the pseudo-well and every other view are the same with or without it.
It is kept for the main run only: with a branch active the table says so and there are no markers.

**What a crest is here.** A crest is a high of the top of the salt, at least 328 ft (100 m) higher than the
salt around it, with the sediment over it less than 1,640 ft (500 m) thick. The log follows it from one time
step to the next, to the neighbouring column (up to 3 columns away) that still has salt and the thinnest
cover. It ends when the cover has stayed thicker than 1,640 ft for 3 steps in a row (*buried*), when no column in
reach has salt thicker than the weld threshold (*welded*), or when the run ends. Two crests that come within
2 columns of each other are counted as one. The 328 ft, 1,640 ft, 3 steps and 3 columns are tuned choices, not
measurements (docs/physics-references.md, M3b.1).

**F, A, F - A and A/F in plain words.**
- **F** is how fast the top of the salt rose at the crest, in ft/Myr. Up is positive, so a negative F means the
  salt top sank.
- **A** is how fast the seafloor beside the crest built up, in ft/Myr: the mean seafloor 3 to 5 km either side
  (columns 3 to 5 at 1,000 m wide; the two nearest columns are left out because the crest's own mound bends the
  seafloor there). Sediment piling up at the flank is a positive A.
- **F - A** is the difference. Above zero, the crest gains height on its flanks; below zero, the flanks gain on it.
- **A/F** is the sediment rate divided by the salt rate. It is shown only when F is above zero (for a sinking salt
  top the ratio means nothing, and the cell is empty). Near 1, the crest and its flanks keep pace; well above 1,
  the sediment is winning.
- Both rates are least-squares slopes over a window of 1 Myr. They are not a single before-and-after pair.
- The model has no dissolution. A crest that stays at the seafloor would in nature lose some salt to dissolution,
  which the model does not have, so F is the whole net rise (the burial rule of VJ92a p. 347 uses F minus the
  dissolution rate).

**The two windows.** The table shows the *near* window: the last 1 Myr of the time the crest was within 1,640 ft of
the seafloor. This is the rate while the crest was still near the surface. The CSV also has the *burial* window:
the last 1 Myr up to the last record, which includes the one or two records after the cover passed 1,640 ft, when
the new fill is pushing the salt top down. The burial numbers are usually more negative. A window with fewer than
2 records gives no rate, and its cells are empty.

**Tabular and tapered.** The label follows Giles and Rowan (2012), who describe two kinds of sequence next to a
rising salt body (GR12 p. 20). When the sediment builds up slower than the salt rises (A below F) the sequence is
*tabular*. When it builds up faster (A above F) the sequence is *tapered*. If F and A differ by less than
82 ft/Myr (25 m/Myr) the label is *unresolved*: that difference is what 1 ulp of maths noise moves the same crest
by, so it cannot be told from noise (a tuned floor). F and A are absolute rates, the rise of the salt top and of the
seafloor in elevation. GR12 (p. 19) define rise relative to the minibasin subsidence plus differential compaction.
If the flank subsides by the same rate as the crest, both rates shift by that rate and F - A does not change, so the
label rule carries over; if the salt top sinks differently from the flank, it does not. One thing to keep in mind: GR12 name the kinds from the
shape of the strata (hook and wedge sequences, fold zones of 50 to 1,000 m wide, p. 8). The grid here is 1,000 m wide,
so it **cannot show hooks and wedges**. The label comes from the two rates only, and says nothing about
the strata themselves.

**The list and the card.** The list at the top of the right-hand column has four columns: *Crest* (its number),
*Label* (a shape and a word), *F - A* (ft/Myr, near window) and *Last record* (Ma). It shows about ten rows and
scrolls inside; the column heads stay in view and sort the list (empty cells sort last). Rows are grey when the
crest is not active at the time shown. Click a row, or a marker on the section, to select the crest: the time slider
moves to the crest's last record, its marker gets a ring and the **pseudo-well moves to the crest's column**. A
planned well is not moved; the card says so. Click the row again to clear the selection (the pseudo-well stays). The list is capped to a share of the window height, so the list, the card and the section are on screen together even on a 1080p screen at 150 % (the list then shows about four rows, and a short window hides the card's note and the list's intro line); a selected row that is hidden inside the list is scrolled into view.
Under the list, the card of the selected crest gives: *Position* (km, at the last record), *Followed from / to*
(Ma), *Time at the seafloor* (Myr with the cover under 2 m; 0 for every Gulf crest), *F*, *A* and *A/F* (near
window), *Label*, *Salt beside* (ft, the mean salt thickness 10 km either side at the last record), *L/h* (the
distance to the nearest column without salt, divided by that mean salt thickness: how many salt thicknesses of
flow the crest has behind it) and *How it ended*. With nothing selected the card says how to select. The two
export buttons are on the card. *Last record* is the age of the last record the log followed. It can be one or two
records after the cover passed 1,640 ft, so it can be younger than the burial age that *How it ended* gives (a
crest can read "Last record 57.30 Ma, buried at 57.40 Ma"). A note under the card gives the number of candidate
highs that were merged into an older crest, when there are any.

**The markers.** On the section a marker stands on the seafloor at each crest active at the time shown. The shape
carries the label, not the colour: a triangle up with T is tabular, a triangle down with P is tapered, a diamond
with ? is unresolved. Hover over a marker, or tab to it, to see its numbers. A key sits under the section. The
Gulf run ends with one crest still at the surface, the toe, so there is one marker at the end of the run; the
other 15 crests are buried and show only when you move back in time.

**The CSV files.** **Export crests (CSV)** writes one row per crest; **Export crest records (CSV)** writes
one row per record of each crest, which is the series the fits are made from. Lines that start with `#` give units,
windows, thresholds and versions. Empty cells mean the number does not exist. The table file has:
- `crest_id`, `x_first_km`, `x_last_km`, `first_age_ma`, `last_age_ma`, `end_reason`, `end_age_ma`,
  `time_at_seafloor_myr`, `time_near_myr`
- near window: `F_near_ft_per_myr`, `A_near_ft_per_myr`, `F_minus_A_near_ft_per_myr`, `A_over_F_near`, `label`
- burial window: `F_burial_ft_per_myr`, `A_burial_ft_per_myr`, `F_minus_A_burial_ft_per_myr`, `label_burial`
- `neighbour_salt_ft`, `flow_length_ft`, `mean_salt_ft`, `L_over_h`

The records file has `crest_id`, `record_step`, `age_ma`, `time_myr`, `x_km`, `salt_top_depth_ft`,
`salt_thickness_ft`, `cover_ft`, `seafloor_depth_ft` and `flank_seafloor_depth_ft`. The table, the markers and both
files read the same rows, so the numbers agree.

**Worked example, Gulf-style preset (plain run).** The run gives 16 crests on Windows Node 26 and on Linux Node 22,
and 16 in the built file in Chrome. Crest 5 is at km 187.5 on all three. On Windows Node 26 it first appears at
65.9 Ma, is followed to a last record at 52.5 Ma and is then buried (52.6 Ma). In the near window its salt top
rose at F = 51 ft/Myr (16 m/Myr) while the seafloor beside it built up at A = 150 ft/Myr (46 m/Myr). So
F - A = -99 ft/Myr (-30 m/Myr), A/F = 2.9 and the label is *tapered*: the flanks gained on the crest at about
three times its rise rate, and the difference is past the 82 ft/Myr floor. The burial window gives
F - A = -121 ft/Myr, also tapered. There was about 18,240 ft (5,560 m) of salt beside it and L/h = 12, so the
salt was not short of supply; this agrees with SALT-R2, which reads the burial of crests as more likely a limit
of the thin-sheet flow than a lack of salt (medium confidence).
- **Which platform each number is from (M3b.4 N-1).** The numbers above are Windows Node 26. The same crest on
  Linux Node 22 has F - A = -101 ft/Myr (-30.7 m/Myr), tapered. In the built file in Chrome (Windows) the list
  row shows -98 ft/Myr, tapered, so for this crest the three agree to a few ft/Myr and the label is the same.
  That is not guaranteed: single crests move with the maths library (with the North Sea mud the same crest was
  *tapered* in Node and *unresolved* in Chrome). Read the list in your own browser; do not expect the guide's
  digits.
- **Do not read a single crest as a result.** Crest 11 (km 175.5) has F - A = -130 ft/Myr on Windows and
  -131 ft/Myr in Chrome (*tapered*); a crest with |F - A| under 82 ft/Myr is *unresolved* (2 to 3 of the 16 in
  the plain run). Which crests are tabular, tapered or unresolved moves with 1 ulp of maths noise, and the numbers
  differ between machines.
- **Quote the middle of all crests, and the range, not a platform difference (N-2).** Over all crests of 7 runs
  on each platform (the plain run and six with 1 ulp noise), the median near-window F - A is -277 ft/Myr
  (-84.5 m/Myr) on both Windows Node 26 and Linux Node 22, and the median A is 245 and 249 ft/Myr. The median of
  one run moves from -193 to -288 ft/Myr on Windows and from -208 to -287 ft/Myr on Linux depending only on the
  noise seed, so the spread between seeds is as big as any difference between platforms; none is claimed. Across
  all 14 runs 197 of 227 crests are tapered, 25 unresolved and only 5 tabular, so the Gulf-style preset shows
  crests buried by their flanks, not crests that keep up. That is expected geology for a buried diapir; the log
  reports it and does not try to change it.

## 15. Known limits
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
- **Slope failure on the Gulf-style preset is very slow (AUD-6 N-3).** Nothing in the preset turns failure on, but if you do, the Hart mud (less permeable at the surface, section 5) makes the slopes fail far more often: about 4,759 events and 37 minutes on Windows node 26 (it was 83 events and 26 s with the North Sea mud). Mass is still conserved.
- **Turbidites are a transport-length rule, not flow physics.** No turbidity-current flow, no
  channels or levees, slope failure is off by default and limited (section 13.6), no faults or 3D yet, and salt is limited (section 14.6).
- **The slopes are tuned.** Slope and coastal-plain diffusivities were tuned by eye to about 6°
  muddy slopes and a 0.3 m/km coastal plain, not calibrated to data.
- **Default overpressure is mild** (maximum about 14 % of the load, at 20 m²/yr supply). To see
  strong overpressure lower **Mud permeability multiplier** or raise **Sediment supply**.
- **Salt is a draft, and not checked against a field.** Salt flows under the sediment load when
  **Salt layer on** is ticked and the cover resists bending, so a preferred width appears; that
  width depends on a tuned cover viscosity. The limits are in section 14.6. The Gulf-style preset is tuned to targets, for you to judge.
- **Supply and subsidence are tuned**, not taken from a published Gulf of America rate.
- **The planned well is a 2D view with no collapse limit.** Its fracture gradient uses one tuned
  constant per method and, in salt, the overburden (section 8). Its window is not a drilling plan.
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
